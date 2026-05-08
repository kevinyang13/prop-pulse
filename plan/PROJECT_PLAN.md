# PropPulse — Project Plan

**Tagline**: Know before you buy.

**Summary**: Web + iPhone app giving W2 investors a personalized go/no-go analysis on residential investment properties. Same $400k property looks different to different buyers — PropPulse personalizes the math.

**Created**: 2026-05-06  
**Status**: Phase 1 — Web MVP in development

---

## Problem

Casual real estate investors (1–3 properties) waste 30–60 min per deal stitching together Zillow, BiggerPockets calculator, Rentometer, and a spreadsheet — then still lack tax-personalized numbers. Existing tools give generic cap rates; none factor in the user's W2 income, tax bracket, and passive activity loss (PAL) rules.

## Target User

**Casual accumulator** — W2 professional with 1–3 rental properties.

- Income: $120k–$350k
- Evaluates 10–20 deals to buy 1
- Time-poor: wants answer in under 2 minutes
- Knows basic terms but not a spreadsheet power user
- Cares most about: monthly cashflow, cash-on-cash return, tax impact, downside risk

**Out of scope**: first-time investors, RE professionals, active traders, commercial investors.

## Core Value Proposition

Personalized W2 + passive activity loss tax math + neighborhood map signals + environmental risk in one view. No existing calculator does all four.

- User A: $180k income, 22% bracket, $100k cash → **CAUTION**
- User B: $280k income, 32% bracket, $200k cash → **GO**

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 15 (React, App Router) |
| Styling | Tailwind CSS |
| Backend | Next.js API routes |
| Database | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth — Google OAuth + Magic Link |
| Property Data | Rentcast API |
| Geocoding | Mapbox |
| Maps | Leaflet.js + OpenStreetMap tiles |
| Payments | Stripe (Pro subscription) |
| Email (transactional) | Resend |
| Deployment | Vercel |
| iPhone (Phase 3) | React Native / Expo |

## Auth Strategy

**Primary**: Google OAuth 2.0 — one-tap, highest conversion for W2 professional audience.  
**Secondary**: Magic Link (passwordless email) — no password friction, no credential risk.  
**No username/password** — deliberate; adds friction and support burden with no benefit.

Phase 2: Apple Sign-In (required before App Store submission).  
Phase 3: Facebook (low priority; lower trust signal for finance tool).

→ Full details: [AUTH_STRATEGY.md](AUTH_STRATEGY.md)

## Data Sources

| Need | API | Free Tier | Paid |
|------|-----|-----------|------|
| Property details + rent estimate | Rentcast | 50 calls/mo | $50/mo (1K calls) |
| Walk / transit score | Walk Score API | 5K/day | Free (with attribution) |
| School ratings | GreatSchools API | Free (approval required) | Free |
| Crime index | CrimeGrade.org scrape | Free | NeighborhoodScout $99/mo |
| Geocoding | Mapbox | 50K/mo | $0.50/1K |
| Mortgage rate | FRED API | Free | Free |
| Map tiles | Leaflet + OpenStreetMap | Free | Maptiler at scale |
| City infrastructure | Manual curation (8 metros) | — | Socrata ETL post-MVP |
| Flood zone | FEMA NFHL ArcGIS API | Free | Free |
| Fire risk | First Street API (CA: Cal Fire) | 100 calls/mo | $49/mo |
| Air quality (AQI) | AirNow EPA API | Free | Free |
| Wind risk | FEMA Wind Zone + First Street | Free / bundled | Bundled |
| Earthquake hazard | USGS Seismic Hazard API | Free | Free |
| Location demographics | US Census / ACS 5-Year API | Free | Free |

**Caching**: All external API responses cached in Supabase `data_cache` table. TTLs range from 1 day (mortgage rate) to indefinite (geocode, earthquake). Full TTL reference in DATA_SOURCES.md.

→ Full API analysis, rate limits, fallbacks: [DATA_SOURCES.md](DATA_SOURCES.md)

## Data Model

10 core tables in Supabase PostgreSQL:

| Table | Purpose |
|-------|---------|
| `user_profiles` | W2 income, tax bracket, filing status, cash, onboarding state |
| `properties` | Rentcast property cache — beds/baths/sqft/AVM/rent range/tax |
| `property_units` | Per-unit rows for 2–4 unit properties |
| `neighborhood_signals` | Walk Score, schools, crime, infra project count |
| `environmental_risks` | Fire/flood/AQI/wind/earthquake with risk levels + insurance delta |
| `saved_analyses` | Verdict, assumptions (jsonb), results (jsonb), stress scenarios |
| `property_searches` | Search history — raw query + resolved property |
| `infrastructure_projects` | Manually curated projects, geo-queried by Haversine |
| `subscriptions` | Stripe sync — tier, status, period |
| `data_cache` | Raw API response cache keyed by `source:address_key` |
| `mortgage_rates` | Weekly FRED time series |

RLS enabled on all user-scoped tables. Service role key server-side only.

→ Full schema, indexes, RLS policies, jsonb shapes: [DATA_MODEL.md](DATA_MODEL.md)

## Monetization

| Tier | Price | Features |
|------|-------|---------|
| Free Trial | $0 | 3 property analyses, no credit card |
| PropPulse Pro | $7.99/mo or $59/yr | Unlimited analyses, saved properties, comparison |

Free tier counter enforced server-side in `user_profiles.analyses_used`. Never trust client-side checks.

Growth lever: "Invite a friend, get 2 more free analyses."

---

## Phase Roadmap

### Phase 1 — Web MVP (current)

**Goal**: Working analysis tool with personalized tax math, auth, and data pipeline.

#### Sprint 1 — Foundation + Auth (Weeks 1–2)

**Project scaffold**
- [ ] Next.js 15 + Tailwind project scaffold
- [ ] Vercel project + preview deployments configured
- [ ] Environment variables structure (`.env.local`, Vercel env)

**Supabase setup**
- [ ] Supabase project created
- [ ] All 11 tables created per DATA_MODEL.md schema
- [ ] RLS policies applied to all user-scoped tables
- [ ] Postgres trigger: auto-create `user_profiles` + `subscriptions` on auth.users insert
- [ ] `data_cache` cleanup cron job (nightly delete expired rows)

**Auth**
- [ ] Google OAuth configured (GCP Console → Supabase Dashboard)
- [ ] Magic Link (passwordless email) enabled
- [ ] `/auth/callback` route handler (PKCE code exchange)
- [ ] Middleware: session refresh on every request
- [ ] Protected route wrapper (server component session check)
- [ ] Sign-out

**Onboarding flow** (`/onboarding`)
- [ ] Step 1: W2 annual income + filing status
- [ ] Step 2: State of residence (pre-fill state tax rate)
- [ ] Step 3: Liquid cash + default down payment %
- [ ] Write to `user_profiles`, set `onboarding_complete = true`
- [ ] Skip link available — analysis runs with 22% default bracket if skipped

**Address input + property data**
- [ ] Address autocomplete (Mapbox Geocoding API)
- [ ] Rentcast property fetch + parse → insert into `properties`
- [ ] Cache check before Rentcast call (TTL 7 days)
- [ ] Manual entry fallback if Rentcast returns no data

**SFH financial model**
- [ ] Monthly cashflow, annual cashflow
- [ ] Cash-on-cash return, cap rate, GRM, NOI
- [ ] Break-even occupancy

#### Sprint 2 — Tax Engine (Weeks 3–4)
- [ ] Depreciation calc (27.5-year straight-line, 80% building value)
- [ ] PAL rules engine (AGI < $100k / $100k–$150k / > $150k tiers)
- [ ] Schedule E deductions (mortgage interest, tax, insurance, repairs, PM)
- [ ] Tax-adjusted COC
- [ ] Multi-unit (2–4) property support + per-unit rent inputs
- [ ] House hack toggle (owner-occupied unit exclusion from depreciation + Schedule E)
- [ ] Stress scenario engine (6 scenarios, cashflow + COC per scenario)

#### Sprint 3 — Results Page (Weeks 5–6)
- [ ] GO / CAUTION / PASS verdict with narrative
- [ ] Stress test compact table (6 scenarios, color-coded rows: positive/marginal/negative, sorted best→worst)
- [ ] Scenario assumptions panel (live recalc on keystroke)
- [ ] Monthly cashflow breakdown
- [ ] Key metrics grid (SFH: 4 metrics; Multi-unit: 6 metrics)
- [ ] Property details table
- [ ] Recommendation panel (black background) with env risk factor chip

#### Sprint 4 — Map, Neighborhood & Environmental Risk (Weeks 7–8)

**Neighborhood signals**
- [ ] Walk Score API integration + cache
- [ ] GreatSchools API integration + cache (apply for key in Week 1)
- [ ] CrimeGrade.org scrape + cache (graceful null if unavailable)
- [ ] Neighborhood signals cards (Walk Score, Schools, Crime, Infra count)

**Location demographics**
- [ ] Census API key (api.census.gov/data/key_signup.html — instant, no approval)
- [ ] ACS 5-year fetch by zip code (B19013, B01003, B25003, B23025, B15003, B25002, B25064, B25077, B01002)
- [ ] Compute derived signals: renter_ratio, vacancy_rate, unemployment_rate, college_educated_pct, price_to_rent_ratio, renter_demand_signal
- [ ] Insert into `location_demographics` table; cache in `data_cache` TTL 180 days
- [ ] Fall back to county-level ACS if zip suppressed
- [ ] Demographics section: 6-card grid (income, renter ratio, population/age, unemployment, college %, P/R ratio) + stat bar (vacancy, raw unit counts)

**Environmental risk**
- [ ] FEMA NFHL flood zone lookup + cache (TTL 90 days)
- [ ] Cal Fire FHSZ layer for CA properties; First Street for non-CA
- [ ] AirNow annual AQI by zip + cache (TTL 365 days)
- [ ] FEMA wind zone + cache (TTL 90 days)
- [ ] USGS earthquake PGA + cache (TTL indefinite)
- [ ] Environmental Risk section: 5-card grid with risk badges + insurance impact alert bar
- [ ] Elevated risk (fire HIGH or flood AE/VE) → force CAUTION floor on verdict

**Map**
- [ ] Leaflet map with property + POI markers
  - Black label pin: subject property
  - Blue dots: nearby schools
  - Green dots: transit stops
  - Orange dots: infrastructure projects
  - Red dots: elevated crime zones
  - Orange shading: high fire hazard severity zones
  - Blue shading: FEMA flood zones (AE/VE)
- [ ] Photo/Map tab on property header

**Equity outlook**
- [ ] Infrastructure project cards (manual curation for 8 metros in `infrastructure_projects`)
- [ ] Haversine proximity query (projects within 2 mi / 10 mi of property)
- [ ] Equity outlook section (population, migration, job growth, home price trend — static data per metro at MVP)

**Mortgage rate**
- [ ] FRED API weekly fetch → `mortgage_rates` table
- [ ] Pre-fill interest rate assumption from latest rate

#### Sprint 5 — Save, Paywall & Share (Weeks 9–10)
- [ ] Save analysis to `saved_analyses` (assumptions jsonb + results jsonb)
- [ ] "My Analyses" dashboard — list saved analyses with verdict badges
- [ ] 3 free analyses enforcement — server-side counter, upgrade prompt at limit
- [ ] Stripe integration: Pro subscription ($7.99/mo + $59/yr)
- [ ] Stripe webhook → sync `subscriptions` table
- [ ] Export PDF (html-to-pdf via Puppeteer or React PDF)
- [ ] Compare up to 3 properties side-by-side (Pro feature)

---

### Phase 2 — Polish + Apple Auth

- [ ] Apple Sign-In (required before iOS App Store submission)
- [ ] Custom auth UI (replace Supabase Auth UI with PropPulse-branded components)
- [ ] Stress test interactive sliders (not static table)

**Analysis Comparison (up to 3 analyses)**
- [ ] `/compare` page — Pro-gated; redirect free users to upgrade prompt
- [ ] Property selector bar: 3 slots; pull from `saved_analyses`; empty slot shows "＋ Add Property" dashed picker
- [ ] Highlight best-in-dimension per row (green left border + background tint); worst in red
- [ ] Section headers: Cashflow · Tax Impact · Equity Outlook · Environmental Risk · Location Demographics · Downside Resilience · Neighborhood Signals
- [ ] Per-section summary bar shows which property wins that dimension
- [ ] Overall Verdict row: GO/CAUTION/PASS badge + score pip bar (6 pips, colored by dimension outcome) + narrative
- [ ] Action footer per property: "View Full Analysis" · "Star Property"
- [ ] Mobile: show max 2 properties; hide 3rd column below 600px
- [ ] "My Analyses" dashboard: "Compare" checkbox on each saved analysis card → opens `/compare?ids=...`
- [ ] Saved property history with verdict tracking over time
- [ ] Email alerts for saved search price drops (Resend)
- [ ] Unit rent history chart (multi-unit)
- [ ] GreatSchools → Niche.com fallback if API unavailable
- [ ] CrimeGrade → NeighborhoodScout API migration
- [ ] Maptiler tile CDN (replace raw OSM for reliability)

### Phase 3 — iPhone App

- [ ] React Native / Expo scaffold
- [ ] Same analysis engine (shared API routes)
- [ ] Quick-check mode at open houses
- [ ] Native map view
- [ ] Apple Sign-In active (already shipped in Phase 2)

### Phase 4 — Advanced

- [ ] LLM-generated narrative recommendation (replace static verdict text)
- [ ] Short-term rental (Airbnb) model toggle
- [ ] Cost segregation / bonus depreciation calculator
- [ ] Plaid integration for financial verification
- [ ] Facebook Sign-In (if demand signals warrant it)

---

## Key Metrics (Formula Reference)

### SFH

| Metric | Formula |
|--------|---------|
| Monthly Cashflow | Rent × (1 − vacancy%) − (Mortgage + Tax + Insurance + HOA + Maintenance + PM) |
| Cash-on-Cash Return | Annual Net Cashflow ÷ Total Cash Invested |
| Cap Rate | NOI ÷ Purchase Price |
| Gross Rent Multiplier | Price ÷ Annual Gross Rent |
| Tax-Adjusted COC | (Annual Cashflow + Tax Savings) ÷ Cash Invested |
| Break-Even Occupancy | Fixed Monthly Costs ÷ Monthly Gross Rent |

### Multi-Unit Additions

| Metric | Formula |
|--------|---------|
| Price Per Unit | Purchase Price ÷ Units |
| Expense Ratio | Total Monthly Expenses ÷ Gross Monthly Rent |
| Per-Unit Depreciation | Building Value ÷ 27.5 ÷ Units |
| Blended Vacancy | Weighted avg vacancy across occupied units |

### Tax Math (Killer Feature)

1. **Depreciation**: 27.5-year straight-line on ~80% of purchase price
2. **PAL rules**: AGI < $100k → up to $25k deductible; $100k–$150k → phases out; > $150k → suspended (carry forward)
3. **Schedule E**: mortgage interest, property tax, insurance, repairs, PM fees — all deductible
4. **House hack**: owner-occupied unit % excluded from depreciation and Schedule E

---

## Design System

| Token | Value |
|-------|-------|
| Background | `#FAFAF8` warm white |
| Surface / Card | `#F2EDE8` cream |
| Surface 2 | `#EAE3DC` darker cream |
| Primary text | `#1A1A1A` near black |
| Muted text | `#6B6560` warm gray |
| Accent | `#C4B5A5` warm taupe |
| Border | `#E0D8D0` |
| GO badge | `#1A1A1A` fill, `#FAFAF8` text |
| CAUTION badge | `#C4B5A5` fill, `#1A1A1A` text |
| PASS badge | `#E8E4E0` fill, `#6B6560` text |
| Positive cashflow | `#2D7A4F` green |
| Negative cashflow | `#B94040` red |
| Risk: High | `#C05A1A` orange-red |
| Risk: Severe | `#B94040` red |
| Font | Inter 300–900, wide tracking |
| Border radius | 4px — sharp, not bubbly |

**Aesthetic**: Clean, minimal, luxury-adjacent. Warm neutrals. Bold typography. Not corporate SaaS blue.

---

## Competitive Landscape

| Tool | Gap |
|------|-----|
| BiggerPockets Calculator | No tax personalization, manual input, no map, no environmental risk |
| DealCheck | No W2 tax math, no neighborhood signals, no map, no environmental risk |
| Roofstock | Buy-side marketplace, not analysis tool |
| Climate Check / Risk Factor | Environmental risk only, no financial analysis |
| Excel spreadsheet | User's current solution — fully manual |

**Wedge**: personalized W2 + PAL tax math + map + environmental risk in one view. Climate Check shows risk; PropPulse shows risk AND whether the numbers still work.

---

## Key Risks

1. **Data gaps**: infrastructure project data sparse outside 8 target metros — manual curation required
2. **Tax accuracy liability**: PAL rules complex — "estimate only, consult CPA" disclaimer on every screen
3. **Rentcast coverage**: smaller markets have thin data; free tier burns at ~16 new users/mo
4. **CrimeGrade scrape fragility**: site changes break scraper silently — graceful null, migrate to NeighborhoodScout early
5. **Environmental data accuracy**: First Street scores are modeled estimates; FEMA flood maps lag real conditions — display source + date
6. **Insurance unavailability**: high fire/flood zones may have no carrier — flag as CAUTION floor regardless of cashflow numbers
7. **Auth surface area**: OAuth misconfiguration (open redirects, missing PKCE) — follow AUTH_STRATEGY.md exactly; restrict redirect URI allowlist to explicit paths only
8. **GreatSchools API approval**: apply Week 1 — approval takes 1–3 days; build fallback to Niche scrape

---

## Open Decisions

- [x] App name: **PropPulse** — "Know before you buy."
- [x] Tech stack: Next.js 15 + Tailwind + Supabase + Rentcast + Mapbox + Leaflet + Vercel
- [x] Auth: Google OAuth (primary) + Magic Link (secondary). No passwords. Apple in Phase 2.
- [x] Monetization: free trial (3 analyses) → $7.99/mo or $59/yr Pro via Stripe
- [x] DB schema: defined in DATA_MODEL.md
- [x] Data sources + caching TTLs: defined in DATA_SOURCES.md
- [ ] Tax disclaimer strategy: "estimate only" footer vs CPA partnership / review
- [ ] Rentcast API tier: upgrade to $50/mo Starter at first paying user
- [ ] Geographic launch scope: full coverage 8 metros; partial (property + rent only) everywhere else
- [ ] Email provider: Resend vs SendGrid for magic links + transactional

---

## Geographic Launch Scope (Phase 1)

**Full data coverage** (all signals + env risk + infrastructure): San Diego, Los Angeles, San Francisco, New York, Chicago, Seattle, Denver, Austin.

**Partial coverage** (property + rent + env risk only, no infra projects): all other US cities.

---

## Supporting Docs

| File | Contents |
|------|---------|
| [AUTH_STRATEGY.md](AUTH_STRATEGY.md) | OAuth setup, session management, RLS, security rules, onboarding flow |
| [API_STRATEGY.md](API_STRATEGY.md) | REST vs GraphQL decision, all 21 routes, analysis pipeline, error handling, security |
| [DATA_MODEL.md](DATA_MODEL.md) | Full Supabase schema, indexes, RLS policies, jsonb shapes, TTL reference |
| [DATA_SOURCES.md](DATA_SOURCES.md) | Per-API analysis: endpoints, cost tiers, coverage, rate limits, fallbacks, risk register |
| [COMPLIANCE.md](COMPLIANCE.md) | CCPA, privacy policy, ToS, financial disclaimer, data retention, breach response |
| [UX_FLOW.md](UX_FLOW.md) | Full UX flow: 10 pages, user journeys, layouts, empty/error states, nav structure |
| [BUSINESS_PLAN.md](BUSINESS_PLAN.md) | Business model, GTM, financials, competitive analysis |

## Mockups — Source of Truth for UI

**All UI implementation must match these mockups exactly.** Pixel-for-pixel fidelity to layout, spacing, color tokens, typography, and interaction states. Any deviation requires explicit product decision.

| Mockup | Route | Implements |
|--------|-------|-----------|
| [../ux/mockup-landing.html](../ux/mockup-landing.html) | `/` (pre-auth) | Hero, Google sign-in CTA, Buyer A/B comparison, feature grid, how-it-works, blurred preview |
| [../ux/mockup-login.html](../ux/mockup-login.html) | `/login` | Google OAuth button, magic link form + 60s countdown, sent/error states |
| [../ux/mockup-onboarding.html](../ux/mockup-onboarding.html) | `/onboarding` | 3-step wizard: income+filing → state → cash+down; bracket auto-display; skip link |
| [../ux/mockup-dashboard.html](../ux/mockup-dashboard.html) | `/dashboard` | Property cards with verdict badges + metrics; compare-select mode; free tier banner; sort/search |
| [../ux/mockup-loading.html](../ux/mockup-loading.html) | `/analyze` (in-progress) | 8-step animated progress; Rentcast fallback banner trigger; auto-redirect on completion |
| [../ux/mockup-results.html](../ux/mockup-results.html) | `/results/[id]` | Full analysis: metrics, cashflow, tax, stress table, scenario editor, neighborhood, demographics, env risk, equity, recommendation scorecard |
| [../ux/mockup-comparison.html](../ux/mockup-comparison.html) | `/compare` (Pro) | 3-analysis side-by-side, 7 dimensions, per-row highlight, per-section winner, verdict pip bar |
| [../ux/mockup-manual-entry.html](../ux/mockup-manual-entry.html) | `/analyze/manual` | Rentcast fallback form: address, property basics, purchase/financing, income, expenses, house hack toggle |
| [../ux/mockup-settings.html](../ux/mockup-settings.html) | `/settings` | Profile, tax profile edit, subscription (free/pro states), notifications, privacy/CCPA, danger zone |
| [../ux/mockup-upgrade.html](../ux/mockup-upgrade.html) | `/upgrade` | Pricing cards (monthly/annual toggle), feature comparison table, testimonials, FAQ |

### Design tokens (enforce in Tailwind config / CSS vars)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#FAFAF8` | Page background |
| `--surface` | `#F2EDE8` | Cards, surface elements |
| `--surface-2` | `#EAE3DC` | Hover states, secondary surfaces |
| `--text` | `#1A1A1A` | Primary text, filled buttons |
| `--text-muted` | `#6B6560` | Secondary text, labels |
| `--accent` | `#C4B5A5` | Logo span, CAUTION badge, decorative |
| `--border` | `#E0D8D0` | All borders |
| `--green` | `#2D7A4F` | Positive cashflow, COC |
| `--red` | `#B94040` | Negative cashflow, PASS verdict text |
| `--orange` | `#C05A1A` | Risk: High, moderate warnings |
| Font | Inter 300–900 | All text — import from Google Fonts |
| Border radius | `4px` | All elements — sharp, never bubbly |

### Per-sprint mockup reference

| Sprint | Primary mockup(s) |
|--------|------------------|
| Sprint 1 — Auth + Onboarding | mockup-login.html · mockup-onboarding.html |
| Sprint 2 — Tax engine | mockup-results.html (stress table, tax section) |
| Sprint 3 — Results page | mockup-results.html (full page) |
| Sprint 4 — Map + Neighborhood + Env | mockup-results.html (map, neighborhood, env, equity sections) · mockup-loading.html |
| Sprint 5 — Dashboard + Paywall | mockup-dashboard.html · mockup-upgrade.html · mockup-settings.html |
| Ongoing — Fallback + Edge states | mockup-manual-entry.html · mockup-loading.html (fallback banner) |

---

*Estimate only — consult a CPA for tax advice.*
