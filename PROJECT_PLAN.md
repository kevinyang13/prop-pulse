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

Personalized W2 + passive activity loss tax math + neighborhood map signals in one view. No existing calculator does all three.

- User A: $180k income, 22% bracket, $100k cash → **CAUTION**
- User B: $280k income, 32% bracket, $200k cash → **GO**

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 15 (React, App Router) |
| Styling | Tailwind CSS |
| Backend | Next.js API routes |
| Database + Auth | Supabase (Postgres + Auth) |
| Property Data | Rentcast API |
| Maps | Leaflet.js + OpenStreetMap |
| Deployment | Vercel |
| iPhone (Phase 3) | React Native / Expo |

## Data Sources

| Need | API | Cost |
|------|-----|------|
| Property details + rent estimate | Rentcast | $0 (50 calls/mo free) → $50/mo |
| Walk / transit score | Walk Score API | Free (5K/day) |
| School ratings | GreatSchools API | Free with approval |
| Crime index | CrimeGrade.org | Free scrape → NeighborhoodScout post-revenue |
| Geocoding | Mapbox | Free (50K/mo) |
| Mortgage rate | FRED API | Free |
| Map tiles | Leaflet + OpenStreetMap | Free |
| City infrastructure | Socrata permit APIs | Free (~200 cities) |

**Caching**: Rentcast responses cached in Supabase (TTL 7 days). Walk Score / crime cached 30 days.

## Monetization

| Tier | Price | Features |
|------|-------|---------|
| Free Trial | $0 | 3 property analyses, no credit card |
| PropPulse Pro | $7.99/mo or $59/yr | Unlimited analyses, saved properties, comparison |

Growth lever: "Invite a friend, get 2 more free analyses."

---

## Phase Roadmap

### Phase 1 — Web MVP (current)

**Goal**: Working analysis tool with personalized tax math.

#### Sprint 1 — Foundation (Weeks 1–2)
- [ ] Next.js 15 + Tailwind project scaffold
- [ ] Supabase project setup (auth, DB schema)
- [ ] User profile setup flow (income, bracket, state, cash, down payment %)
- [ ] Address input + Rentcast auto-fill integration
- [ ] SFH financial model: cashflow, COC, cap rate, GRM

#### Sprint 2 — Tax Engine (Weeks 3–4)
- [ ] Depreciation calc (27.5-year straight-line, 80% building value)
- [ ] PAL rules engine (AGI < $100k / $100k–$150k / > $150k tiers)
- [ ] Schedule E deductions (mortgage interest, tax, insurance, repairs, PM)
- [ ] Tax-adjusted COC and break-even occupancy
- [ ] Multi-unit (2–4) property support
- [ ] House hack toggle (owner-occupied unit exclusion)

#### Sprint 3 — Results Page (Weeks 5–6)
- [ ] GO / CAUTION / PASS verdict with narrative
- [ ] Stress test grid (6 scenarios, color-coded)
- [ ] Scenario assumptions panel (live recalc on keystroke)
- [ ] Monthly cashflow breakdown
- [ ] Key metrics grid (SFH: 4 metrics; Multi-unit: 6 metrics)
- [ ] Property details table
- [ ] Recommendation panel (black background)

#### Sprint 4 — Map & Neighborhood (Weeks 7–8)
- [ ] Leaflet map with property + POI markers
  - Black label pin: subject property
  - Blue dots: nearby schools
  - Green dots: transit stops
  - Orange dots: infrastructure projects
  - Red dots: elevated crime zones
- [ ] Neighborhood signals cards (Walk Score, Schools, Crime, Infra count)
- [ ] Equity outlook section (population, migration, job growth, home price trend)
- [ ] Infrastructure project cards (city-level, manual curation for 8 metros)
- [ ] Photo/Map tab on property header

#### Sprint 5 — Save & Share (Weeks 9–10)
- [ ] Save property to account
- [ ] Compare up to 5 properties
- [ ] Export PDF
- [ ] 3 free analyses enforcement + upgrade prompt

---

### Phase 2 — Polish

- [ ] Stress test interactive sliders (not static grid)
- [ ] Side-by-side comparison table UI
- [ ] Saved property history with verdict tracking
- [ ] Email alerts for saved search price drops
- [ ] Unit rent history chart (multi-unit)

### Phase 3 — iPhone App

- [ ] Same analysis, mobile-optimized (React Native / Expo)
- [ ] Quick-check mode at open houses
- [ ] Native map view

### Phase 4 — Advanced

- [ ] Plaid integration for financial verification
- [ ] LLM-generated narrative recommendation
- [ ] Short-term rental (Airbnb) model toggle
- [ ] Cost segregation / bonus depreciation calculator

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
| Font | Inter 300–900, wide tracking |
| Border radius | 4px — sharp, not bubbly |

**Aesthetic**: Clean, minimal, luxury-adjacent. Warm neutrals. Bold typography. Not corporate SaaS blue.

---

## Competitive Landscape

| Tool | Gap |
|------|-----|
| BiggerPockets Calculator | No tax personalization, manual input, no map |
| DealCheck | No W2 tax math, no neighborhood signals, no map |
| Roofstock | Buy-side marketplace, not analysis tool |
| Excel spreadsheet | User's current solution — fully manual |

**Wedge**: personalized W2 + PAL tax math + map with POI signals in one view.

---

## Key Risks

1. **Data gaps**: infrastructure project data sparse outside 8 target metros
2. **Tax accuracy liability**: PAL rules complex — "estimate only, consult CPA" disclaimer on every screen
3. **Rentcast coverage**: smaller markets may have thin data; free tier limited to 50 calls/mo
4. **Competition**: DealCheck covers basic math; moat is tax personalization + map + UX

## Open Decisions

- [x] App name: **PropPulse** — "Know before you buy."
- [x] Tech stack: Next.js 15 + Tailwind + Supabase + Rentcast + Leaflet + Vercel
- [x] Monetization: free trial (3 analyses) → $7.99/mo or $59/yr Pro
- [ ] Tax disclaimer strategy: "estimate only" footer vs CPA partnership / review
- [ ] Rentcast API tier selection (free vs paid based on usage)
- [ ] Geographic launch scope: Full coverage SD, LA, SF, NYC, Chicago, Seattle, Denver, Austin; partial elsewhere

---

## Geographic Launch Scope (Phase 1)

**Full data coverage** (all signals + infrastructure): San Diego, Los Angeles, San Francisco, New York, Chicago, Seattle, Denver, Austin.

**Partial coverage** (property + rent only): all other US cities.

---

*Estimate only — consult a CPA for tax advice.*
