# PropPulse — API Strategy

**Created**: 2026-05-07  
**Stack**: Next.js 15 App Router · Supabase · REST

---

## GraphQL vs REST — Decision

**Decision: REST via Next.js App Router API routes. No GraphQL.**

| Factor | REST | GraphQL |
|--------|------|---------|
| Data shape | Fixed per endpoint — fits PropPulse perfectly | Useful when client needs flexible field selection |
| Analysis pipeline | Single `POST /api/analyze` → sequential pipeline | No advantage; adds resolver complexity |
| Caching | HTTP cache headers, Next.js `fetch` cache, CDN | Harder — all requests are POST |
| Supabase integration | Direct server-side client, no extra layer | Requires schema + resolvers duplicating Supabase |
| Team overhead | Zero config | Schema definition, codegen, N+1 guards |
| Next.js 15 Server Components | RSC reads Supabase directly — no API route needed | Incompatible with RSC data fetching pattern |

**Verdict**: GraphQL solves problems PropPulse doesn't have. The data shape is predictable, not user-defined. REST + Next.js Server Components + Server Actions covers every use case with less code and better caching.

---

## API Architecture

```
Client (React)
    │
    ├── Server Components ──────────────────────► Supabase (direct read)
    │   dashboard, results page, settings              (no API round-trip)
    │
    ├── Server Actions ──────────────────────────► Supabase (mutations)
    │   star/unstar, update profile                    (form actions)
    │
    └── API Routes (/api/*)  ────────────────────► Supabase + External APIs
        analysis pipeline, Stripe, webhooks            (complex orchestration)
```

**Rule**: Use Server Components for reads. Use Server Actions for simple mutations. Use API routes for anything that calls external APIs, requires complex orchestration, or handles webhooks.

---

## Internal API Routes

All routes are Next.js App Router handlers (`app/api/**/route.ts`). Auth checked server-side via `createServerClient` from `@supabase/ssr`. Service role key never leaves the server.

### Auth

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/auth/callback` | PKCE code exchange after OAuth / magic link redirect |
| `POST` | `/api/auth/signout` | Invalidate session, clear cookies |

**`/auth/callback`** — critical path:
```typescript
// app/auth/callback/route.ts
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createServerClient(...)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check onboarding_complete → redirect to /onboarding or /dashboard
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('onboarding_complete')
        .single()
      return redirect(profile?.onboarding_complete ? next : '/onboarding')
    }
  }
  return redirect('/login?error=auth_failed')
}
```

---

### Analysis Pipeline (Core)

| Method | Route | Description | Auth | Free tier |
|--------|-------|-------------|------|-----------|
| `POST` | `/api/analyze` | Trigger full property analysis | Required | Enforced |
| `GET` | `/api/analyses/[id]` | Fetch saved analysis by ID | Required | — |
| `DELETE` | `/api/analyses/[id]` | Delete saved analysis | Required | — |

**`POST /api/analyze`** is the primary endpoint. Orchestrates 8 data sources with cache-first logic.

**Request body**:
```json
{
  "address": "1842 Maple Ave, Austin, TX 78704",
  "assumptions": {
    "purchase_price": 415000,
    "down_payment_pct": 20,
    "interest_rate": 6.87,
    "loan_term_years": 30,
    "monthly_rent": 2100,
    "vacancy_pct": 5,
    "property_tax_monthly": 433,
    "insurance_monthly": 150,
    "hoa_monthly": 0,
    "maintenance_pct_annual": 1.0,
    "property_mgmt_pct": 0,
    "closing_cost_pct": 1.8,
    "house_hack": false
  }
}
```

**Pipeline** (sequential where dependent, parallel where independent):

```
1. Auth check + free tier gate (analyses_used < 3 OR tier = 'pro')
2. Geocode address → Mapbox (cache: indefinite)
3. Property fetch → Rentcast (cache: 7 days)
   └─ Miss: return { needs_manual_entry: true }
4. [Parallel]:
   ├── Environmental risk → FEMA + First Street + AirNow + USGS (cache: 90–365d)
   ├── Neighborhood signals → Walk Score + GreatSchools + CrimeGrade (cache: 30d)
   ├── Location demographics → Census ACS (cache: 180d)
   ├── Infrastructure projects → Haversine query on local DB (no external call)
   └── Mortgage rate → latest from mortgage_rates table (FRED fetched weekly)
5. Financial model computation (pure function, no I/O):
   └── cashflow, COC, cap rate, GRM, depreciation, PAL rules, tax savings,
       stress scenarios (6), verdict scoring (6 dimensions)
6. Persist:
   ├── INSERT/UPDATE properties, neighborhood_signals, environmental_risks,
   │   location_demographics (upsert by property_id or address_key)
   └── INSERT saved_analyses (assumptions + results jsonb)
7. Increment user_profiles.analyses_used (if free tier)
8. Return full analysis response
```

**Response** (abbreviated):
```json
{
  "analysis_id": "uuid",
  "verdict": "GO",
  "verdict_reason": "Strong cashflow + suspended PAL = tax-adj COC above 8%.",
  "property": { ... },
  "results": {
    "monthly_cashflow": 312,
    "cash_on_cash_return": 6.8,
    "tax_adjusted_coc": 9.2,
    "stress_scenarios": [ ... ]
  },
  "neighborhood": { ... },
  "environmental": { ... },
  "demographics": { ... },
  "equity_outlook": { ... }
}
```

**Free tier gate** (server-side, never trust client):
```typescript
const { data: profile } = await supabase
  .from('user_profiles')
  .select('analyses_used, tier')
  .eq('id', userId)
  .single()

const sub = await supabase
  .from('subscriptions')
  .select('tier')
  .eq('user_id', userId)
  .single()

if (sub.data?.tier !== 'pro' && profile.data.analyses_used >= 3) {
  return NextResponse.json({ error: 'free_limit_reached' }, { status: 402 })
}
```

**Rentcast miss → manual entry**:
```typescript
if (!rentcastData) {
  return NextResponse.json(
    { needs_manual_entry: true, geocode: { lat, lng, address } },
    { status: 200 }
  )
  // Client redirects to /analyze/manual with address pre-filled
}
```

---

### Dashboard

Read-only. Handled by **Server Component** directly (no API route):

```typescript
// app/dashboard/page.tsx (Server Component)
const supabase = createServerClient(...)
const { data: analyses } = await supabase
  .from('saved_analyses')
  .select(`
    id, verdict, created_at, is_starred, notes,
    properties ( full_address, city, state, property_type, beds, baths ),
    results
  `)
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
```

---

### User Profile

| Method | Route | Description |
|--------|-------|-------------|
| `PUT` | `/api/profile` | Update tax profile (income, state, filing, cash, down pct) |
| `DELETE` | `/api/profile` | Soft-delete account (sets `deleted_at`) |

Profile reads handled by Server Component. Profile updates are a **Server Action** (simple Supabase write):

```typescript
// app/settings/actions.ts
'use server'
export async function updateProfile(formData: FormData) {
  const supabase = createServerClient(...)
  const { error } = await supabase
    .from('user_profiles')
    .update({
      w2_income: Number(formData.get('w2_income')),
      filing_status: formData.get('filing_status'),
      state: formData.get('state'),
      state_tax_rate: Number(formData.get('state_tax_rate')),
      liquid_cash: Number(formData.get('liquid_cash')),
      default_down_pct: Number(formData.get('default_down_pct')),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) throw new Error('Profile update failed')
  revalidatePath('/settings')
}
```

**Soft delete**:
```typescript
// PUT /api/profile (DELETE method)
await supabase
  .from('user_profiles')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', userId)
// Supabase cron job hard-deletes auth.users row after 30 days
// All API routes check deleted_at IS NULL on session load
```

---

### Saved Analyses

| Method | Route / Action | Description |
|--------|----------------|-------------|
| Server Action | `toggleStar(id)` | Star / unstar saved analysis |
| `DELETE` | `/api/analyses/[id]` | Delete analysis |

Star is a Server Action (single field update, instant revalidation):
```typescript
'use server'
export async function toggleStar(analysisId: string) {
  const supabase = createServerClient(...)
  const { data } = await supabase
    .from('saved_analyses')
    .select('is_starred')
    .eq('id', analysisId)
    .single()
  await supabase
    .from('saved_analyses')
    .update({ is_starred: !data?.is_starred })
    .eq('id', analysisId)
  revalidatePath('/dashboard')
}
```

---

### Payments (Stripe)

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/stripe/checkout` | Create Stripe Checkout session, return URL |
| `GET` | `/api/stripe/portal` | Create billing portal session, return URL |
| `POST` | `/api/stripe/webhook` | Receive Stripe events, sync `subscriptions` table |

**Checkout** — always server-side:
```typescript
// POST /api/stripe/checkout
const session = await stripe.checkout.sessions.create({
  customer_email: user.email,
  line_items: [{ price: priceId, quantity: 1 }],
  mode: 'subscription',
  success_url: `${origin}/dashboard?upgraded=true`,
  cancel_url: `${origin}/upgrade`,
  metadata: { user_id: userId },
})
return NextResponse.json({ url: session.url })
```

**Webhook** — syncs Stripe → Supabase:
```typescript
// POST /api/stripe/webhook
// Events handled:
// customer.subscription.created → set tier='pro', status, period
// customer.subscription.updated → update status, cancel_at_period_end
// customer.subscription.deleted → set tier='free', status='canceled'
// invoice.payment_failed       → set status='past_due'

const event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
// Use stripe_subscription_id to find user, upsert subscriptions row
```

**Webhook security**:
- Verify `stripe-signature` header with `stripe.webhooks.constructEvent`
- Raw body required — disable Next.js body parser for this route
- Return `200` immediately; process async if needed

---

### Data Export (CCPA)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/export` | Generate JSON export of all user data |

```typescript
// Returns: profile, all saved_analyses, all property_searches
// Streams as downloadable JSON
// Rate limit: 1 request per 24h per user
```

---

### Admin / Internal

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST` | `/api/internal/fetch-mortgage-rate` | Cron: pull latest FRED rate | `CRON_SECRET` header |
| `POST` | `/api/internal/purge-cache` | Cron: delete expired data_cache rows | `CRON_SECRET` header |
| `POST` | `/api/internal/purge-deleted-users` | Cron: hard-delete users with deleted_at > 30d | `CRON_SECRET` header |

Cron jobs triggered by Vercel Cron or Supabase pg_cron. Authenticated via `Authorization: Bearer $CRON_SECRET` header checked at route level.

---

## External API Calls — Server-Side Only

All external API calls happen exclusively in API routes or Server Actions. API keys never reach the client bundle.

| External API | Called From | Cache Key Pattern | TTL |
|-------------|-------------|-------------------|-----|
| Mapbox Geocoding | `/api/analyze` | `mapbox:{address_key}` | indefinite |
| Rentcast Property | `/api/analyze` | `rentcast:{address_key}` | 7 days |
| Walk Score | `/api/analyze` | `walkscore:{address_key}` | 30 days |
| GreatSchools | `/api/analyze` | `greatschools:{address_key}` | 30 days |
| CrimeGrade | `/api/analyze` | `crimegrade:{address_key}` | 30 days |
| FEMA NFHL | `/api/analyze` | `fema_flood:{address_key}` | 90 days |
| First Street | `/api/analyze` | `first_street:{address_key}` | 90 days |
| AirNow | `/api/analyze` | `airnow:{zip}` | 365 days |
| USGS Seismic | `/api/analyze` | `usgs:{lat_lng_rounded}` | indefinite |
| FRED Mortgage | `/api/internal/fetch-mortgage-rate` | `mortgage_rates` table | weekly |
| Stripe | `/api/stripe/*` | — | — |
| Resend (email) | Server Action | — | — |

**Cache-first pattern** (every external call):
```typescript
async function fetchWithCache(cacheKey: string, ttlDays: number, fetcher: () => Promise<any>) {
  // 1. Check data_cache
  const { data: cached } = await supabase
    .from('data_cache')
    .select('payload')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (cached) return cached.payload

  // 2. Fetch from external API
  const payload = await fetcher()

  // 3. Store in cache
  await supabase.from('data_cache').upsert({
    cache_key: cacheKey,
    source: cacheKey.split(':')[0],
    payload,
    fetched_at: new Date().toISOString(),
    ttl_days: ttlDays,
  })

  return payload
}
```

---

## Error Handling

### Error response shape (all routes)

```json
{
  "error": "error_code",
  "message": "Human-readable description",
  "details": {}
}
```

### Standard error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `unauthorized` | 401 | No session or expired session |
| `forbidden` | 403 | Authenticated but not allowed (deleted account, wrong user) |
| `free_limit_reached` | 402 | 3 analyses used, not Pro |
| `property_not_found` | 200 | Rentcast miss — trigger manual entry flow |
| `external_api_error` | 503 | Upstream API failure (with graceful fallback) |
| `validation_error` | 400 | Bad request body |
| `rate_limited` | 429 | Too many requests |

### Graceful degradation

External API failures must not break the analysis. Each data source is optional:

| Failure | Fallback |
|---------|----------|
| Walk Score down | `null` scores, show "unavailable" badge in UI |
| GreatSchools unavailable | Null, note in UI: "Try Niche.com" |
| CrimeGrade scrape fails | Null, no crime section rendered |
| First Street rate limit | Fall back to FEMA wind zone only |
| AirNow no data for zip | Null AQI |
| USGS timeout | Null earthquake section |
| Census zip suppressed | Retry with county FIPS code |

Verdict and financial model are **never** blocked by neighborhood/env data. They degrade to showing fewer sections, never an error page.

---

## Security

### Authentication pattern (every protected route)

```typescript
// lib/auth.ts — shared helper
export async function requireAuth(request: Request) {
  const supabase = createServerClient(...)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }

  // Check soft delete
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('deleted_at')
    .eq('id', user.id)
    .single()

  if (profile?.deleted_at) {
    throw new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
  }

  return { user, supabase }
}
```

### Key rules
- **Service role key**: server-side only, never in client bundle, never in API response
- **Stripe webhook**: always verify signature — reject unsigned requests with `400`
- **Cron routes**: `CRON_SECRET` required — no auth.getUser() needed, but secret checked first
- **RLS**: Supabase RLS is a safety net; API layer always checks ownership explicitly
- **Input validation**: Zod schema on all `POST`/`PUT` request bodies
- **Rate limiting**: Vercel Edge middleware — 20 req/min per user on `/api/analyze`, 5/min on `/api/stripe/checkout`

---

## Response Caching (Next.js)

| Route | Cache strategy |
|-------|---------------|
| Server Components (dashboard, results) | `cache: 'no-store'` — user-specific data |
| `/api/analyses/[id]` (GET) | `cache: 'no-store'` — mutable |
| `/auth/callback` | `cache: 'no-store'` |
| `/api/stripe/webhook` | `cache: 'no-store'` |
| `/api/internal/fetch-mortgage-rate` | Revalidates `mortgage_rates` tag |

No public CDN caching — all responses are user-authenticated. Next.js fetch cache used only for internal server-to-server calls (e.g., FRED API fetch in cron route).

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # client-safe
SUPABASE_SERVICE_ROLE_KEY=         # server-side only, never NEXT_PUBLIC_

# External APIs (server-side only)
RENTCAST_API_KEY=
MAPBOX_SECRET_TOKEN=               # server-side; NEXT_PUBLIC_MAPBOX_TOKEN for map tiles
WALKSCORE_API_KEY=
GREATSCHOOLS_API_KEY=
FIRST_STREET_API_KEY=
FRED_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # client-safe

# Email
RESEND_API_KEY=

# Internal
CRON_SECRET=

# App
NEXT_PUBLIC_APP_URL=               # https://proppulse.com
```

**Rule**: Any variable without `NEXT_PUBLIC_` prefix is never exposed to the browser. Stripe publishable key and Supabase anon key are the only intentionally client-facing secrets. Mapbox has two tokens — secret for geocoding API (server), publishable for map tiles (client).

---

## APIs by Data Model Table

Every table in [DATA_MODEL.md](DATA_MODEL.md) mapped to its API surface. Columns: how the data is read, how it's written, what's missing from original route list.

### `user_profiles`
| Operation | Method | Route / Mechanism | Notes |
|-----------|--------|-------------------|-------|
| Read own profile | Server Component | direct Supabase read | settings page, dashboard header |
| Read own profile (client refresh) | `GET` | `/api/profile` | returns profile + PAL tier derived from w2_income |
| Update tax profile | `PUT` | `/api/profile` | income, filing, state, cash, down pct |
| Soft-delete account | `DELETE` | `/api/profile` | sets `deleted_at`; cron hard-deletes after 30d |
| Auto-create on signup | DB trigger | `auth.users` insert | no API route needed |

### `properties`
| Operation | Method | Route / Mechanism | Notes |
|-----------|--------|-------------------|-------|
| Fetch + cache property | internal | inside `POST /api/analyze` | Rentcast → upsert by `address_key` |
| Read property detail | Server Component | joined from `saved_analyses` | no standalone property endpoint needed |
| Manual entry (Rentcast miss) | `POST` | `/api/analyze` with `manual: true` body flag | skips Rentcast, uses user-supplied values |

### `property_units`
| Operation | Method | Route / Mechanism | Notes |
|-----------|--------|-------------------|-------|
| Read units | Server Component | joined from `saved_analyses` → `properties` | MFU only |
| Write units | internal | inside `POST /api/analyze` | upserted per unit from Rentcast or manual entry |

### `neighborhood_signals`
| Operation | Method | Route / Mechanism | Notes |
|-----------|--------|-------------------|-------|
| Read | Server Component | joined from analysis result | |
| Write | internal | inside `POST /api/analyze` | upserted; Walk Score + GreatSchools + CrimeGrade |

### `environmental_risks`
| Operation | Method | Route / Mechanism | Notes |
|-----------|--------|-------------------|-------|
| Read | Server Component | joined from analysis result | |
| Write | internal | inside `POST /api/analyze` | upserted; FEMA + First Street + AirNow + USGS |

### `location_demographics`
| Operation | Method | Route / Mechanism | Notes |
|-----------|--------|-------------------|-------|
| Read | Server Component | joined from analysis result | |
| Write | internal | inside `POST /api/analyze` | upserted by zip; Census ACS |

### `saved_analyses`
| Operation | Method | Route / Mechanism | Notes |
|-----------|--------|-------------------|-------|
| List all (dashboard) | `GET` | `/api/analyses` | paginated; filtered by verdict, sorted by date/coc |
| Read single | `GET` | `/api/analyses/[id]` | full analysis JSON |
| Create | internal | inside `POST /api/analyze` | auto-saved after pipeline completes |
| Update (star / notes) | `PATCH` | `/api/analyses/[id]` | body: `{ is_starred?, notes? }` |
| Delete | `DELETE` | `/api/analyses/[id]` | hard delete (no retention needed) |

### `property_searches`
| Operation | Method | Route / Mechanism | Notes |
|-----------|--------|-------------------|-------|
| List search history | `GET` | `/api/searches` | last 20 searches for "Recent" list in address input |
| Create | internal | inside `POST /api/analyze` | written at search time, before Rentcast call |

### `subscriptions`
| Operation | Method | Route / Mechanism | Notes |
|-----------|--------|-------------------|-------|
| Read own subscription | `GET` | `/api/subscription` | returns `{ tier, status, current_period_end, cancel_at_period_end }` |
| Create / update | internal | `POST /api/stripe/webhook` | Stripe events only; never written by client directly |

### `infrastructure_projects`
| Operation | Method | Route / Mechanism | Notes |
|-----------|--------|-------------------|-------|
| Proximity query | internal | inside `POST /api/analyze` | Haversine query; no external API |
| Admin insert/update | internal | direct Supabase Studio or seed script | manually curated; no public write endpoint |

### `data_cache`
| Operation | Method | Route / Mechanism | Notes |
|-----------|--------|-------------------|-------|
| Read | internal | `fetchWithCache()` helper | service role only; never client-facing |
| Write | internal | `fetchWithCache()` helper | upsert on external API miss |
| Purge expired | `POST` | `/api/internal/purge-cache` | nightly cron |

### `mortgage_rates`
| Operation | Method | Route / Mechanism | Notes |
|-----------|--------|-------------------|-------|
| Read latest rate | `GET` | `/api/mortgage-rate` | pre-fills interest rate in analysis assumptions |
| Write (FRED sync) | `POST` | `/api/internal/fetch-mortgage-rate` | weekly cron; inserts new row |

---

## Route Summary

```
/auth/callback                    GET    PKCE exchange → redirect to /onboarding or /dashboard
/api/auth/signout                 POST   Invalidate session, clear cookies

/api/analyze                      POST   Full analysis pipeline (core endpoint)
/api/analyses                     GET    List saved analyses (paginated, filterable)
/api/analyses/[id]                GET    Fetch single saved analysis
/api/analyses/[id]                PATCH  Update star / notes
/api/analyses/[id]                DELETE Delete saved analysis

/api/profile                      GET    Read own user profile + derived PAL tier
/api/profile                      PUT    Update tax profile (income, state, filing, cash)
/api/profile                      DELETE Soft-delete account (sets deleted_at)

/api/searches                     GET    Search history (last 20, for Recent list)

/api/subscription                 GET    Current subscription tier + status

/api/mortgage-rate                GET    Latest 30yr fixed rate from mortgage_rates table

/api/export                       GET    CCPA: download all user data as JSON

/api/stripe/checkout              POST   Create Stripe Checkout session, return URL
/api/stripe/portal                GET    Create Stripe billing portal session, return URL
/api/stripe/webhook               POST   Receive Stripe events, sync subscriptions table

/api/internal/fetch-mortgage-rate POST   Cron: pull FRED rate, insert mortgage_rates row
/api/internal/purge-cache         POST   Cron: DELETE FROM data_cache WHERE expires_at < now()
/api/internal/purge-deleted-users POST   Cron: hard-delete auth.users where deleted_at > 30d
```

Total: **21 routes**. No GraphQL schema, no resolvers, no codegen.

---

*See also: [AUTH_STRATEGY.md](AUTH_STRATEGY.md) · [DATA_MODEL.md](DATA_MODEL.md) · [DATA_SOURCES.md](DATA_SOURCES.md)*
