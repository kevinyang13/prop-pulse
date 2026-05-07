# PropPulse — Auth Strategy

**Provider**: Supabase Auth (wraps GoTrue)  
**Last updated**: 2026-05-06

---

## Provider Priority

| Provider | Status | Rationale |
|----------|--------|-----------|
| Google OAuth | **Required — Phase 1** | Highest conversion for W2 professional target user. One-tap on mobile. |
| Magic Link (email) | **Required — Phase 1** | Fallback for users without Google. No password friction. |
| Apple Sign-In | Recommended — Phase 2 | Required by App Store if any other social login present on iOS app. |
| Facebook | Optional — Phase 3 | Lower trust signal for finance app; adds OAuth surface area |
| GitHub | Skip | Wrong audience for a real estate tool |

---

## Phase 1 Implementation

### Providers Enabled

1. **Google OAuth 2.0** — primary CTA
2. **Magic Link (passwordless email)** — secondary

No username/password. Passwords add friction, support burden, and credential breach risk — none of which serve a time-poor W2 investor audience.

---

## Supabase Auth Setup

### Google OAuth

**Step 1 — Google Cloud Console**:
1. Create project at console.cloud.google.com
2. Enable Google+ API / People API
3. Create OAuth 2.0 credentials (Web application)
4. Authorized redirect URIs:
   ```
   https://<project>.supabase.co/auth/v1/callback
   https://proppulse.com/auth/callback          (production)
   http://localhost:3000/auth/callback           (dev)
   ```
5. Copy Client ID + Client Secret

**Step 2 — Supabase Dashboard**:
- Authentication → Providers → Google → Enable
- Paste Client ID + Client Secret
- Save

**Step 3 — Next.js client**:
```typescript
// lib/auth.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabase = createClientComponentClient()

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',   // get refresh token
        prompt: 'consent',        // force consent screen to always get refresh token
      },
    },
  })
  if (error) throw error
}
```

**Step 4 — Callback route** (`app/auth/callback/route.ts`):
```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
```

---

### Magic Link (Passwordless Email)

```typescript
export async function signInWithMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      shouldCreateUser: true,  // auto-create account on first link click
    },
  })
  if (error) throw error
}
```

Email template customization in Supabase Dashboard → Authentication → Email Templates. Customize "Magic Link" template to match PropPulse brand.

---

## Session Management

Supabase Auth uses **JWT + refresh token** pattern.

| Token | Lifetime | Storage |
|-------|----------|---------|
| Access token (JWT) | 1 hour | Memory (never localStorage) |
| Refresh token | 7 days | HttpOnly cookie via `@supabase/auth-helpers-nextjs` |

**`@supabase/auth-helpers-nextjs`** handles all of this automatically with server components + middleware. Use it — do not implement session handling manually.

### Middleware (token refresh on every request)

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Refreshes session if expired. Must be called in middleware.
  await supabase.auth.getSession()

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### Protected routes

```typescript
// app/dashboard/layout.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }) {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  return <>{children}</>
}
```

---

## User Profile Creation (Post-Auth Trigger)

On first sign-in, create `user_profiles` row automatically via Postgres trigger:

```sql
-- Trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id, tier)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
```

`full_name` is populated from Google's `given_name + family_name` passed through OAuth metadata. Magic link users get null name — prompt for it in onboarding flow.

---

## Onboarding Flow (Post-Auth)

First sign-in → redirect to `/onboarding` instead of `/dashboard`.

```
/auth/callback
    ↓
check user_profiles.onboarding_complete
    ↓ false              ↓ true
/onboarding         /dashboard
```

Onboarding collects:
1. W2 annual income
2. Tax filing status
3. State of residence
4. Available cash for investment
5. Default down payment %

On submit: update `user_profiles`, set `onboarding_complete = true`, redirect to `/dashboard`.

Skip link available — all fields pre-fillable later from profile settings. Analysis still runs with assumed bracket (22% default) if profile incomplete; shows "complete your profile for personalized tax math" banner.

---

## Phase 2 — Apple Sign-In

**When**: Before shipping iOS app (App Store requires Apple sign-in if any other social login exists on the platform).

**Supabase setup**: Authentication → Providers → Apple → Enable. Requires Apple Developer account ($99/yr), Service ID, and private key.

**Additional requirement**: Apple may anonymize the user's email (relay address). Store Apple's `sub` (stable user ID) in `user_profiles.apple_id` column. Do not rely on email as identifier for Apple users.

```sql
ALTER TABLE user_profiles ADD COLUMN apple_id text UNIQUE;
```

**Next.js**:
```typescript
export async function signInWithApple() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  if (error) throw error
}
```

---

## Phase 3 — Facebook (Optional)

Low priority. Facebook OAuth adds OAuth app review overhead and is lower-trust for a finance tool. Enable only if data shows meaningful signup drop-off from missing it.

**Supabase setup**: Authentication → Providers → Facebook → Enable. Requires Facebook Developer app with `email` and `public_profile` permissions.

---

## Sign-Out

```typescript
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (!error) window.location.href = '/'  // hard redirect to clear state
}
```

Supabase `signOut()` revokes the refresh token server-side and clears the cookie.

---

## Security Rules

### Token storage
- **Never** store access tokens in `localStorage` or `sessionStorage` — XSS vectors
- `@supabase/auth-helpers-nextjs` uses HttpOnly cookies automatically — use it
- Never log JWT payloads or tokens

### OAuth redirect validation
- Supabase validates `redirectTo` against allowlist configured in Dashboard → URL Configuration
- Allowlist must be explicit — no wildcards in production:
  ```
  https://proppulse.com/**
  http://localhost:3000/**   (dev only — remove before prod deploy)
  ```

### CSRF
- Supabase Auth uses PKCE flow for OAuth — state parameter validated server-side
- No additional CSRF handling needed for auth routes

### Rate limiting
- Supabase Auth has built-in rate limits on magic link sends (default: 1 email/60s per address)
- Increase threshold in Dashboard → Auth → Rate Limits if needed
- Add client-side cooldown UI (60s countdown after send) to match

### Service role key
- `SUPABASE_SERVICE_ROLE_KEY` used only in server-side API routes (Stripe webhook, admin ops)
- **Never** expose to client — not in `NEXT_PUBLIC_` env vars
- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` go to client

### Anon key scope
- Anon key is public-safe but RLS must be enabled on all tables with user data
- Anon key cannot bypass RLS — service role key can (use only server-side)

---

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # public — safe in client
SUPABASE_SERVICE_ROLE_KEY=eyJ...              # secret — server only
SUPABASE_JWT_SECRET=...                        # for custom JWT verification

# Google OAuth (stored in Supabase dashboard, not env — but keep local copy)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## Free Tier Enforcement

```typescript
// server-side: check before running analysis
async function canRunAnalysis(userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('analyses_used')
    .eq('id', userId)
    .single()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .single()

  if (sub?.tier === 'pro') return true
  return (profile?.analyses_used ?? 0) < 3
}

// After successful analysis, increment counter
await supabase
  .from('user_profiles')
  .update({ analyses_used: supabase.raw('analyses_used + 1') })
  .eq('id', userId)
```

Enforce server-side only — never trust client-side checks for paywalls.

---

## Auth UI Components

Use **Supabase Auth UI** (`@supabase/auth-ui-react`) for rapid MVP, then replace with custom UI.

```tsx
// app/login/page.tsx
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

export default function LoginPage() {
  return (
    <Auth
      supabaseClient={supabase}
      appearance={{ theme: ThemeSupa }}
      providers={['google']}
      magicLink={true}
      redirectTo={`${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`}
    />
  )
}
```

Custom UI replaces this in Phase 2 — Supabase Auth UI styling is limited and won't match PropPulse brand.

---

## Error States

| Scenario | User-facing message |
|----------|-------------------|
| OAuth provider error | "Sign-in failed. Try again or use email link." |
| Magic link expired (1hr TTL) | "Link expired. Request a new one." |
| Magic link already used | "Link already used. Request a new one." |
| Email not found (magic link) | Always show "Check your email" — do not confirm/deny address exists |
| Session expired | Silent token refresh via middleware. If refresh fails, redirect to `/login`. |
| Account exists with different provider | "An account with this email already exists. Sign in with [original provider]." |

---

## Package Dependencies

```bash
npm install @supabase/supabase-js \
            @supabase/auth-helpers-nextjs \
            @supabase/auth-ui-react \
            @supabase/auth-ui-shared
```

---

*All OAuth credentials must be rotated if accidentally committed to git. Use `git filter-repo` or contact Supabase support to invalidate.*
