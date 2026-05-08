# PropPulse — User Experience Flow

**Last updated**: 2026-05-06  
**Status**: Design reference — pre-development

---

## Page Inventory

| Route | Page | Auth Required | Pro Required |
|-------|------|--------------|-------------|
| `/` | Pre-auth landing (home) | No | No |
| `/login` | Sign-in | No | No |
| `/auth/callback` | OAuth redirect handler | No | No |
| `/onboarding` | Financial profile setup | Yes | No |
| `/dashboard` | My Analyses (post-auth home) | Yes | No |
| `/analyze` | Property search + analysis | Yes | No |
| `/analyze/loading` | Analysis processing state | Yes | No |
| `/results/[id]` | Property detail / results | Yes | No |
| `/results/[id]/manual` | Manual data entry fallback | Yes | No |
| `/compare` | Side-by-side comparison | Yes | **Yes** |
| `/settings` | Profile + preferences | Yes | No |
| `/upgrade` | Pro paywall page | Yes | No |
| `/auth/error` | Auth failure state | No | No |

---

## Master Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│                  PRE-AUTH LANDING  /                │
│       Hero → Sign in with Google / Magic Link       │
└─────────────────┬───────────────────────────────────┘
                  │ Sign in
                  ▼
┌─────────────────────────────────────────────────────┐
│              AUTH CALLBACK  /auth/callback          │
│         PKCE code exchange → session created        │
└─────────────────┬───────────────────────────────────┘
                  │
          ┌───────┴───────┐
          │ first visit?  │
          ▼               ▼
    onboarding_     onboarding_
    complete=false  complete=true
          │               │
          ▼               ▼
┌─────────────────┐  ┌──────────────────────────────┐
│  ONBOARDING     │  │  DASHBOARD  /dashboard        │
│  /onboarding    │  │  My Analyses list             │
│  3-step wizard  │  └──────────────┬───────────────┘
└────────┬────────┘                 │
         │ complete / skip          │
         └──────────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
  ┌─────────────┐   ┌──────────────────┐
  │  ANALYZE    │   │  RESULTS /results│
  │  /analyze   │   │  /[id]           │
  │  (search)   │   │  (saved/recent)  │
  └──────┬──────┘   └────────┬─────────┘
         │ address            │
         ▼ entered            │
  ┌─────────────┐             │
  │  LOADING    │             │
  │  /analyze/  │             │
  │  loading    │             │
  └──────┬──────┘             │
         │ done               │
         └────────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  RESULTS DETAIL │
         │  /results/[id]  │◄──── from dashboard
         └─────────┬───────┘
                   │
         ┌─────────┼──────────┐
         ▼         ▼          ▼
    Compare    Settings    Upgrade
    /compare  /settings  /upgrade
    (Pro)
```

---

## Page 1 — Pre-Auth Landing `/`

**Purpose**: Convert visitor to signed-in user. Communicate value proposition in 10 seconds.

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  NAV: PROPPULSE logo          Sign In  (no other links)  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  HERO (full viewport height)                             │
│                                                          │
│  Know before you buy.                                    │
│  Personalized property analysis for W2 investors.        │
│                                                          │
│  [  Sign in with Google  ]  ←── primary CTA             │
│  [ Or sign in with email ]  ←── magic link secondary    │
│                                                          │
│  "Free — 3 property analyses, no credit card"           │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  SOCIAL PROOF: "Same $400K property looks different      │
│  to different buyers." → side-by-side Buyer A / B card  │
├──────────────────────────────────────────────────────────┤
│  FEATURES (3-column):                                    │
│  Tax-Personalized · Neighborhood Signals · Env Risk      │
├──────────────────────────────────────────────────────────┤
│  HOW IT WORKS (3 steps):                                 │
│  1. Set up your profile  2. Enter address  3. Get answer │
├──────────────────────────────────────────────────────────┤
│  RESULTS PREVIEW: blurred/teased analysis screenshot     │
│  "Sign in to see your numbers"                           │
├──────────────────────────────────────────────────────────┤
│  FOOTER: Privacy Policy · Terms · Do Not Sell My Info    │
└──────────────────────────────────────────────────────────┘
```

### Key Elements

| Element | Detail |
|---------|--------|
| Primary CTA | "Sign in with Google" — one-tap, above the fold |
| Secondary CTA | "Or use email" → magic link input |
| Trust signal | "Free · No credit card · 3 analyses" below CTA |
| Value prop | Buyer A vs Buyer B comparison card (same property, different verdict) |
| Social proof | "Analyze 10–20 deals to buy 1? So do we." |
| Preview tease | Blurred results page — shows richness without giving it away |

### Flows Out

| Action | Destination |
|--------|-------------|
| Sign in with Google | `/auth/callback` → onboarding or dashboard |
| Enter email + submit | Magic link sent; show "check your email" confirmation |
| Magic link click (from email) | `/auth/callback` → onboarding or dashboard |
| Auth error | `/auth/error` |

---

## Page 2 — Sign-In `/login`

**Purpose**: Standalone sign-in page for direct link visits (e.g., from magic link email, direct URL).

### Layout

```
┌───────────────────────────────────────┐
│  NAV: logo only (no links)            │
├───────────────────────────────────────┤
│                                       │
│  PROPPULSE                            │
│  Sign in to continue.                 │
│                                       │
│  [  Sign in with Google  ]            │
│                                       │
│  ─────────── or ───────────           │
│                                       │
│  Email  [_____________________]       │
│  [  Send me a sign-in link  ]         │
│                                       │
│  ✓ Sent! Check your inbox.  (state)  │
│                                       │
│  60s cooldown countdown after send    │
│                                       │
└───────────────────────────────────────┘
```

### Error States

| Scenario | Message |
|----------|---------|
| OAuth provider error | "Sign-in failed. Try again or use email link." |
| Magic link expired | "Link expired — request a new one." |
| Magic link already used | "Link already used — request a new one." |
| Rate limited | "Please wait 60 seconds before requesting another link." |
| Unknown email (magic link) | Always show "Check your email" — never confirm/deny existence |

---

## Page 3 — Auth Callback `/auth/callback`

**Purpose**: Server-side only — no UI except loading spinner. Exchanges PKCE code for session, then redirects.

### Redirect Logic

```
/auth/callback receives code
        │
        ▼
exchangeCodeForSession()
        │
  ┌─────┴──────┐
  │ error?     │
  ▼            ▼
/auth/error   check user_profiles.onboarding_complete
                        │
              ┌─────────┴──────────┐
              │ false              │ true
              ▼                   ▼
         /onboarding         /dashboard
```

---

## Page 4 — Onboarding `/onboarding`

**Purpose**: Collect financial profile once. Powers all personalized tax math on every future analysis.

### 3-Step Wizard

```
Progress bar: ●──○──○   ○──●──○   ○──○──●
              Step 1    Step 2    Step 3

Step 1: Income & Filing
┌────────────────────────────────────────────┐
│ What's your annual W2 income?              │
│ [___________] /year                        │
│                                            │
│ Filing status                              │
│ ○ Single  ● Married Filing Jointly         │
│ ○ Married Filing Separately                │
│ ○ Head of Household                        │
│                                            │
│            [ Continue → ]    Skip for now │
└────────────────────────────────────────────┘

Step 2: Location
┌────────────────────────────────────────────┐
│ State of residence?                        │
│ [California          ▼]                   │
│ State income tax rate: 9.3%               │
│ (pre-filled from state lookup)            │
│                                            │
│ [ ← Back ]          [ Continue → ]        │
└────────────────────────────────────────────┘

Step 3: Cash Available
┌────────────────────────────────────────────┐
│ Liquid cash available for investing?       │
│ [___________]                              │
│                                            │
│ Default down payment %                     │
│ ○ 20%  ● 25%  ○ 30%  ○ Other             │
│                                            │
│ [ ← Back ]  [ Complete Setup → ]          │
│                                            │
│ Skip for now → analysis uses 22% default  │
└────────────────────────────────────────────┘
```

### Behavior

| Scenario | Behavior |
|----------|---------|
| All fields complete → submit | Write to `user_profiles`, set `onboarding_complete = true`, redirect `/dashboard` |
| Skip (any step) | Redirect `/dashboard`; show "Complete your profile for personalized tax math" banner on dashboard and results |
| Back navigation | Preserve already-entered values |
| Income entered | Auto-compute and display estimated federal bracket (22% / 24% / 32% / 35% / 37%) |

### Incomplete Profile Banner (shown until complete)

> ⚠ Your tax profile is incomplete — analysis is using a 22% default bracket. [Complete your profile →]

Shown on: dashboard, results page (tax panel), recommendation section.

---

## Page 5 — Dashboard `/dashboard` (Post-Auth Home)

**Purpose**: Home base after sign-in. Search bar to start new analysis. List of all saved properties with summary.

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  NAV: logo  |  My Analyses  Compare  Settings  Sign Out  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  [  Search or enter a property address...  🔍  ]          │
│  (Mapbox autocomplete)                                     │
│                                                            │
│  [  Analyze  ]                                             │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  MY ANALYSES                           [ Compare ✓ ]    │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ □  4821 Oakwood Dr, San Diego CA          [ GO ]    │  │
│  │    $625K · SFH · +$412/mo · 6.8% COC               │  │
│  │    Saved May 1 · ⭐ Starred               [ View ]  │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ □  1142 Maple Ave, San Diego CA           [ GO ]    │  │
│  │    $1.1M · Triplex · +$1,104/mo · 8.2% COC         │  │
│  │    Saved Apr 28                            [ View ]  │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ □  3307 Sunset Blvd, Los Angeles CA   [ CAUTION ]   │  │
│  │    $780K · SFH · +$94/mo · 3.1% COC                │  │
│  │    Saved Apr 22                            [ View ]  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  FREE TIER: 2 of 3 analyses used.  [Upgrade to Pro →]     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Empty State (no saved properties yet)

```
┌────────────────────────────────────────────────────────────┐
│  [  Search or enter a property address...  🔍  ]          │
│                                                            │
│       🏠                                                   │
│       No properties analyzed yet.                          │
│       Enter an address above to run your first analysis.   │
│       Free — up to 3 properties, no credit card.           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Compare Mode

Checkbox appears on each property card when user clicks "Compare ✓" toggle.
- Select 2–3 properties → "Compare Selected (2)" button appears
- Click → navigates to `/compare?ids=id1,id2,id3`
- Pro gate: if free user clicks Compare → redirect to `/upgrade` with context "Side-by-side comparison is a Pro feature"
- Max 3 selectable; selecting a 4th auto-deselects oldest

### Free Tier States

| analyses_used | Banner |
|--------------|--------|
| 0 | None |
| 1 | None |
| 2 | "1 free analysis remaining. [Upgrade →]" (soft nudge) |
| 3 | "You've used all 3 free analyses. [Upgrade to continue →]" (hard block) |

### Flows Out

| Action | Destination |
|--------|-------------|
| Enter address + Analyze | `/analyze/loading` |
| Click saved property row | `/results/[id]` |
| Compare Selected | `/compare?ids=...` (Pro) |
| Upgrade → | `/upgrade` |
| Settings | `/settings` |
| Sign Out | `/` (hard redirect) |

---

## Page 6 — Analysis Loading `/analyze/loading`

**Purpose**: Non-blocking processing screen while APIs are called and analysis is computed. Keeps user engaged.

### Layout

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│              Analyzing 4821 Oakwood Dr                     │
│              San Diego, CA 92103                           │
│                                                            │
│  ████████████████░░░░░░░░░  68%                           │
│                                                            │
│  ✓  Property data fetched          (Rentcast)             │
│  ✓  Rent estimate: $2,950–$3,100/mo                       │
│  ✓  Location geocoded                                      │
│  ◌  Neighborhood signals...        (Walk Score)           │
│  ◌  Environmental risk...          (FEMA · First Street)  │
│  ◌  Demographics...                (Census ACS)           │
│  ◌  Computing your tax impact...                          │
│                                                            │
│         Usually takes 8–12 seconds                        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### States

| State | Behavior |
|-------|---------|
| Rentcast returns no data | Navigate to `/results/[id]/manual` — prompt user for manual entry |
| All APIs complete | Navigate to `/results/[id]` |
| API timeout (>20s) | Show "Taking longer than usual — we'll show partial results" → navigate anyway |
| Network error | Show retry button; preserve entered address |

### Free Tier Gate

Before starting analysis — server-side check:
- `analyses_used >= 3` AND `tier = 'free'` → redirect to `/upgrade` with message "You've used your 3 free analyses."
- Do not show loading screen before the gate check passes.

---

## Page 7 — Results / Property Detail `/results/[id]`

**Purpose**: Full analysis output. The core product experience.

### Layout (scrolling single-page)

```
NAV
│
├── Property Header (address, price, beds/baths, photo/map tab, verdict badge)
│
├── [Assumptions panel — collapsed by default, expandable]
│
├── Key Metrics (4-grid SFH / 6-grid MFU)
│
├── Cashflow Breakdown + Tax Impact (2-col panel)
│
├── Stress Test (compact table, 6 scenarios)
│
├── Neighborhood Signals (4-card grid)
│
├── Location Demographics (6-card grid + stat bar)
│
├── Environmental Risk (5-card grid + alert bar if elevated)
│
├── Map (Leaflet + POI markers + hazard overlays)
│
├── Equity Outlook (city metrics + verdict bar + infra project cards)
│
├── Property Details (table)
│
└── Recommendation (full dimension scorecard — 6 dimensions)
    │
    └── Action Buttons: Save Analysis · Compare · Edit Assumptions · Export PDF
```

### Action Buttons

| Button | Behavior |
|--------|---------|
| Save Analysis | POST to `/api/analyses` → saves to `saved_analyses`; button changes to "Saved ✓" (note: pipeline auto-saves; button confirms/stars) |
| Compare Properties | If Pro: navigates to `/compare` with this property pre-loaded. If free: navigates to `/upgrade` |
| Edit Assumptions | Expands assumptions panel; fields become live-editable; recalculates on keystroke |
| Export PDF | Generates PDF of current analysis; downloads in browser |

### Incomplete Profile Banner

If `onboarding_complete = false`:
> ⚠ Tax math is using a 22% default — your actual bracket may differ. [Complete your profile →]

### Manual Entry Fallback `/results/[id]/manual`

Shown when Rentcast returns no data for the address.

```
┌────────────────────────────────────────────────────────────┐
│  We couldn't find data for this address automatically.     │
│                                                            │
│  Enter the details manually to continue.                   │
│                                                            │
│  Purchase price    [___________]                           │
│  Beds / Baths      [__] / [__]                            │
│  Sqft              [___________]                           │
│  Year built        [___________]                           │
│  Monthly rent est. [___________]                           │
│  Annual prop. tax  [___________]                           │
│  HOA / month       [___________]  (0 if none)              │
│                                                            │
│  [  Run Analysis  ]                                        │
│                                                            │
│  Results will be flagged as "user-supplied data."         │
└────────────────────────────────────────────────────────────┘
```

Results show a banner: "⚠ Property data manually entered — not verified by Rentcast."

---

## Page 8 — Analysis Comparison `/compare`

**Purpose**: Side-by-side comparison of up to 3 saved properties across all investment dimensions.

**Pro gate**: Free users who navigate here see the upgrade prompt instead of the table.

### Layout

```
NAV
│
├── Page header: "Analysis Comparison"
│
├── Property selector bar (3 slots)
│   ├── Slot 1: filled (property card with address, verdict, COC)
│   ├── Slot 2: filled
│   └── Slot 3: "+ Add Property" dashed (picker opens saved list)
│
└── Comparison table
    ├── CASHFLOW section
    │   └── rows: Monthly cashflow · COC · Cap rate · Break-even occupancy
    ├── TAX IMPACT section
    │   └── rows: Depreciation · Tax savings · PAL status · Tax-adj COC
    ├── EQUITY OUTLOOK section
    │   └── rows: Home price trend · Pop growth · Job growth · Infra projects
    ├── ENVIRONMENTAL RISK section
    │   └── rows: Fire · Flood · AQI · Earthquake · Est. insurance impact
    ├── LOCATION DEMOGRAPHICS section
    │   └── rows: Renter ratio · Median income · Unemployment · Vacancy · P/R ratio
    ├── DOWNSIDE RESILIENCE section
    │   └── rows: Stress scenarios positive · Worst-case cashflow · Vacancy shock · Reserve
    ├── NEIGHBORHOOD SIGNALS section
    │   └── rows: Walk Score · School rating · Crime grade
    └── OVERALL VERDICT row
        └── GO/CAUTION/PASS + score pips + narrative + action buttons
```

### Selector Picker

Clicking "+ Add Property" opens an inline drawer/modal showing saved analyses list:

```
┌─────────────────────────────────────┐
│  Add a property to compare          │
│                                     │
│  ○  4821 Oakwood Dr · GO · 6.8%    │
│  ○  1142 Maple Ave · GO · 8.2%     │
│  ● Already in comparison           │
│  ○  3307 Sunset Blvd · CAUTION     │
│                                     │
│  [ Add Selected ]   [ Cancel ]      │
└─────────────────────────────────────┘
```

### Flows Out

| Action | Destination |
|--------|-------------|
| "View Full Analysis" | `/results/[id]` |
| "Star Property" | Toggles `saved_analyses.is_starred` in place |
| Remove property (×) | Removes from comparison; slot returns to empty |
| Add property | Picker → slots filled from `saved_analyses` |

---

## Page 9 — Settings `/settings`

**Purpose**: View and update financial profile. Manage subscription. Account actions.

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  FINANCIAL PROFILE                             [ Edit ]    │
│  ──────────────────────────────────────────────────────    │
│  Annual W2 Income         $185,000                         │
│  Filing Status            Married Filing Jointly           │
│  State                    California (9.3% rate)           │
│  Liquid Cash Available    $200,000                         │
│  Default Down Payment     25%                              │
│  Federal Bracket          24%                              │
│  PAL Status               Fully deductible (AGI < $100K)  │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  SUBSCRIPTION                                              │
│  ──────────────────────────────────────────────────────    │
│  Plan          PropPulse Pro (Monthly)                     │
│  Renews        June 6, 2026 · $7.99                       │
│  [ Manage Subscription ]  (→ Stripe billing portal)       │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  ACCOUNT                                                   │
│  ──────────────────────────────────────────────────────    │
│  Email         kevin@example.com                           │
│  Signed in via Google                                      │
│                                                            │
│  [ Export My Data ]   (→ JSON download)                   │
│  [ Delete Account ]   (→ confirmation modal)              │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  EMAIL PREFERENCES                                         │
│  ──────────────────────────────────────────────────────    │
│  ☑ Product updates and new features                       │
│  ☑ Investment tips and market updates                     │
│  ☐ Weekly digest of saved property changes                │
│                                                            │
│  [ Save Preferences ]                                      │
└────────────────────────────────────────────────────────────┘
```

### Account Deletion Flow

```
Click "Delete Account"
        │
        ▼
Confirmation modal:
"This will permanently delete your account and all saved analyses.
 You have 30 days to recover before permanent deletion."
        │
  ┌─────┴─────┐
  │ Cancel    │ Type "DELETE" to confirm
  │           ▼
  │    Stripe subscription cancelled
  │    user_profiles.deleted_at = now()
  │    Sign out → redirect to /
  │
  └─── no action taken
```

### Financial Profile Edit

Inline form replacing read-only view. On save:
- Updates `user_profiles`
- Re-runs background recalculation on all saved analyses? (Phase 2 — flag stale instead at MVP)
- Show success toast: "Profile updated — new analyses will use your updated numbers."

---

## Page 10 — Upgrade / Paywall `/upgrade`

**Purpose**: Convert free users to Pro. Shown when free limit hit or Pro feature accessed.

### Layout

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  [context banner — explains why user is here]             │
│  "You've used all 3 free analyses."                        │
│  "Side-by-side comparison is a Pro feature."              │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  PROPPULSE PRO                                             │
│                                                            │
│  ┌───────────────┐     ┌───────────────────────────────┐  │
│  │   Monthly     │     │   Annual         BEST VALUE   │  │
│  │   $7.99/mo    │     │   $59/yr                      │  │
│  │               │     │   = $4.92/mo · 2 months free  │  │
│  │  [ Start Pro ]│     │  [ Start Annual ]             │  │
│  └───────────────┘     └───────────────────────────────┘  │
│                                                            │
│  ✓ Unlimited property analyses                            │
│  ✓ Save and revisit all analyses                          │
│  ✓ Side-by-side comparison (up to 3)                      │
│  ✓ Export analysis as PDF                                  │
│  ✓ Full tax math (depreciation, PAL, Schedule E)          │
│  ✓ Environmental risk + demographic intelligence          │
│                                                            │
│  Cancel anytime. No commitment.                            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Flow

```
Click "Start Pro" or "Start Annual"
        │
        ▼
Stripe Checkout (hosted page)
        │
        ▼
Stripe redirects to /dashboard?upgraded=true
        │
        ▼
Stripe webhook fires → update subscriptions table → tier = 'pro'
        │
        ▼
Dashboard shows success toast: "Welcome to Pro! Unlimited analyses unlocked."
```

---

## Additional Flows

### Flow A — Address Not Found → Manual Entry

```
/analyze → address entered
        │
        ▼
/analyze/loading → Rentcast call
        │
  Rentcast: no data
        │
        ▼
/results/[id]/manual → user enters property details
        │
        ▼
/results/[id] → analysis with "user-supplied data" warning banner
```

### Flow B — Free Tier Limit Hit Mid-Session

```
User clicks Analyze (analyses_used = 3, tier = free)
        │
  server-side gate check fails
        │
        ▼
/upgrade → context: "You've used all 3 free analyses"
        │
  User upgrades or dismisses
        │
  ┌─────┴──────┐
  │ upgraded   │ dismissed
  ▼            ▼
/analyze    /dashboard
(unlocked)
```

### Flow C — Compare From Dashboard

```
Dashboard → check 2–3 property checkboxes
        │
  "Compare Selected (2)" button appears
        │
        ▼
  Pro check
  ┌─────┴──────┐
  │ Pro user   │ Free user
  ▼            ▼
/compare    /upgrade → context: "Comparison is Pro"
?ids=...
```

### Flow D — Share / Deep Link to Results

```
User shares /results/[id] URL
        │
        ▼
Recipient visits URL (not signed in)
        │
  middleware: no session
        │
        ▼
Redirect to /login?next=/results/[id]
        │
  Sign in
        │
        ▼
/auth/callback → /results/[id]

Note: Results are private to the owner. Shared links require sign-in.
Phase 2: public share links with read-only token (/share/[token]).
```

### Flow E — Magic Link Email → App Entry

```
User requests magic link on /login
        │
        ▼
Email sent via Resend:
  Subject: "Sign in to PropPulse"
  CTA: "Sign in →" [link to /auth/callback?token=...]
        │
  User clicks link
        │
        ▼
/auth/callback → token validated → session created
        │
  check onboarding_complete
        │
  ┌─────┴──────┐
  │ false      │ true
  ▼            ▼
/onboarding  /dashboard
```

### Flow F — Return User (Session Expired)

```
User visits /dashboard with expired session
        │
  middleware: getSession() → refresh token valid
        │
  ┌─────┴──────────────────────────────┐
  │ refresh succeeds (within 7 days)   │ refresh fails (>7 days)
  ▼                                    ▼
/dashboard (seamless)            /login (silent redirect)
                                 "Your session expired — sign in again."
```

---

## Navigation Structure

```
Pre-auth nav:
  PROPPULSE logo         Sign In →

Post-auth nav (desktop):
  PROPPULSE logo    My Analyses    Compare*    Settings    [ Analyze Property ]

Post-auth nav (mobile):
  PROPPULSE logo                     ☰ hamburger
  Drawer: My Analyses / Compare* / Settings / Sign Out

* Compare: hidden for free users until they save ≥ 2 properties;
  clicking opens /upgrade if free tier
```

---

## Notification & Toast System

| Event | Toast | Duration |
|-------|-------|---------|
| Analysis saved | "Property saved ✓" | 3s |
| Profile updated | "Profile updated — new analyses use your numbers" | 4s |
| Upgrade successful | "Welcome to Pro! Unlimited analyses unlocked." | 6s |
| Analysis export ready | "PDF downloaded" | 3s |
| Free limit at 1 remaining | "1 free analysis remaining. [Upgrade →]" (dismissible) | Persistent |
| Magic link sent | "Check your inbox — link expires in 1 hour" | Persistent until dismissed |
| API error on analysis | "Couldn't load all data — showing partial results" | Persistent |

---

## Accessibility & Performance Notes

- All interactive elements keyboard-navigable (Tab / Enter / Space)
- Analysis results page: heading hierarchy H1 → H2 (section labels) → H3 (panel titles)
- Color is never the only signal — always paired with label text (GO/CAUTION/PASS, not just green/yellow/gray)
- Map is decorative — all data present in text form; map has `aria-hidden` fallback
- Loading state: announce "Analysis complete" via `aria-live` when results render
- Results page target: LCP < 2.5s on 4G mobile (Vercel edge, cached API responses)
- Address autocomplete: debounce 300ms; keyboard accessible; WCAG AA contrast

---

## Supporting Documents

| File | Contents |
|------|---------|
| [PROJECT_PLAN.md](PROJECT_PLAN.md) | Sprint roadmap, tech stack |
| [AUTH_STRATEGY.md](AUTH_STRATEGY.md) | OAuth flows, session management, security |
| [DATA_MODEL.md](DATA_MODEL.md) | Database schema |
| [COMPLIANCE.md](COMPLIANCE.md) | CCPA, privacy, ToS, data deletion |
| [../ux/mockup-results.html](../ux/mockup-results.html) | Results / detail page mockup |
| [../ux/mockup-comparison.html](../ux/mockup-comparison.html) | Property comparison page mockup |
