# PropPulse — Business Plan

**Tagline**: Know before you buy.  
**Status**: Phase 1 — Web MVP in development  
**Date**: 2026-05-06

---

## Executive Summary

PropPulse is a web app that gives W2 professionals a personalized go/no-go decision on residential investment properties in under 2 minutes. Where generic calculators output the same cap rate for every user, PropPulse factors in the buyer's W2 income, tax bracket, filing status, and passive activity loss (PAL) eligibility to compute true after-tax cashflow. Combined with forward-looking neighborhood signals and environmental risk, PropPulse surfaces the analysis a buyer used to need a CPA, a spreadsheet, and three browser tabs to produce.

**Problem**: Casual real estate investors spend 30–60 minutes per deal stitching together Zillow, BiggerPockets, Rentometer, and a spreadsheet — then still lack tax-personalized numbers or neighborhood-level demographic data.

**Solution**: One screen. Setup once. Analyze any property in under 2 minutes, with numbers personalized to the buyer's tax situation and demographic context (renter demand, income profile, vacancy rate) sourced from US Census ACS data.

**Business model**: Freemium → $7.99/month Pro subscription.

**Target**: W2 professionals earning $120K–$350K who own or are buying 1–3 rental properties.

---

## Problem

### The Status Quo

A typical casual investor evaluating a $400K rental property today:

1. Checks Zillow for list price + Zestimate
2. Looks up comparable rents on Rentometer or Zillow
3. Runs numbers in BiggerPockets Calculator or a spreadsheet
4. Googles their tax bracket
5. Separately researches neighborhood safety, schools, walkability
6. Makes a gut call

This takes 30–60 minutes per property. The investor evaluates 10–20 deals to buy 1 — that's 5–20 hours of manual work before any purchase decision.

**The result is still generic.** The same $400K property looks different to different buyers:

- Buyer A ($180K income, 22% bracket, $100K cash): monthly cashflow may be negative after tax impact is modeled correctly
- Buyer B ($280K income, 32% bracket, $200K cash): same property yields meaningful tax savings that flip the verdict to GO

No existing tool makes this distinction. BiggerPockets, DealCheck, and Roofstock all output the same numbers regardless of who's buying.

### Root Causes

1. **No tax personalization**: tools don't ask for W2 income, so they can't compute depreciation benefit, PAL eligibility, or Schedule E impact
2. **No demographic context**: renter ratio, median income, vacancy rate, and price-to-rent ratio directly affect rental demand and long-term viability — none surfaced in existing tools
3. **No neighborhood forward signals**: walk score alone doesn't show planned transit lines or infrastructure investments
4. **No environmental risk in the financial model**: fire/flood risk affects insurance costs and insurability — none of this flows into cashflow projections
5. **Fragmented workflow**: no single tool combines property data + rent estimates + tax math + demographics + map + risk

---

## Solution

### Core Product

PropPulse is a one-screen investment analysis tool. The user enters a property address; PropPulse fetches property details, rent estimates, neighborhood data, and environmental risk — then runs the full financial model personalized to the user's tax profile.

**Setup-once model**: the user completes a 3-minute onboarding (income, filing status, state, cash available, default down %) and never fills in their tax situation again. Every subsequent analysis is instantly personalized.

**Output**: a single results page with:

| Section | What it shows |
|---------|---------------|
| Verdict badge | GO / CAUTION / PASS with narrative |
| Key metrics | Monthly cashflow, cash-on-cash return, cap rate, GRM |
| Cashflow breakdown | Income − expenses → net cashflow + tax impact |
| Tax panel | Depreciation benefit, PAL status, Schedule E deductions |
| Stress test | 6 scenarios (vacancy, rate shock, rent drop) in compact table |
| Neighborhood signals | Walk Score, school rating, crime index, infrastructure project count |
| Location demographics | Median income, renter ratio, population, unemployment, college %, price-to-rent ratio (Census ACS) |
| Environmental risk | Fire, flood, AQI, wind, earthquake — each with insurance impact |
| Map | Property + POIs, fire hazard zones, flood zones |
| Equity outlook | Population, migration, job growth, home price trend, major projects |
| Property details | Beds, baths, sqft, year built, lot size, property tax, HOA |
| Recommendation panel | Verdict + top 3 supporting factors |

### Killer Feature: Tax Math

1. **Depreciation**: 27.5-year straight-line on ~80% of purchase price
2. **PAL rules**:
   - AGI < $100K: deduct up to $25K passive losses against ordinary income
   - AGI $100K–$150K: phases out linearly
   - AGI > $150K: losses suspended, carry forward to sale
3. **Schedule E**: mortgage interest, property tax, insurance, repairs, PM fees — all deductible
4. **House hack toggle**: owner-occupied unit excluded from depreciation and Schedule E

This is the wedge. No other consumer-facing tool implements PAL rules.

### Property Types (Phase 1)

- Single-family homes (SFH)
- 2–4 unit multifamily (duplex, triplex, fourplex)
- Owner-occupied with house hack toggle

Out of scope in Phase 1: commercial, 5+ units, short-term rental (Airbnb), mobile homes, land.

---

## Target Market

### Primary Persona: Casual Accumulator

| Attribute | Detail |
|-----------|--------|
| W2 income | $120K–$350K |
| Portfolio | 1–3 rental properties owned or buying first |
| Deal evaluation | Reviews 10–20 deals to buy 1 |
| Time per deal | 30–60 min today; wants < 2 min |
| Tool fluency | Knows basic terms; not a spreadsheet power user |
| Top concerns | Monthly cashflow, tax impact, downside risk |
| Location | US, any market |
| Age | 30–50 |

### Target User Demographics

**Age**
- Core: 32–48 years old
- Peak buying years for rental property accumulation
- Old enough to have W2 income + savings; young enough to build a portfolio pre-retirement

**Income & Employment**
- W2 income: $120K–$350K household
- Employed full-time; rental property is side income, not primary livelihood
- Common occupations: software engineer, product manager, finance professional, physician, attorney, executive
- Dual-income households common (married filing jointly = larger PAL phase-out window)

**Financial Profile**
- Liquid assets: $50K–$300K available for investment
- Typical down payment: 20–25% on properties $200K–$700K
- Tax bracket: 22%–32% federal; most benefit meaningfully from depreciation deductions
- Existing debt: primary mortgage; may have 1–2 rental mortgages already
- Credit: 720+ (needed for investment property financing)

**Education**
- Bachelor's degree minimum; majority post-graduate (master's, JD, MD, MBA)
- Analytically literate — comfortable reading a spreadsheet but not building one from scratch
- High research orientation — reads forums, listens to RE podcasts before acting

**Geography**
- Concentrated in high cost-of-living metros (SF Bay Area, NYC, LA, Seattle, Boston, Chicago, Denver, Austin)
- Often buying in adjacent or Sun Belt markets (San Diego, Phoenix, Nashville, Tampa, Dallas) where numbers pencil better
- Remote-work enabled: geographic flexibility in where they invest vs. where they live

**Psychographic Profile**
- **Mindset**: "I want my money working for me" — views real estate as wealth-building, not gambling
- **Risk tolerance**: moderate; wants downside scenarios before committing, not after
- **Time scarcity**: busy career + family = values tools that compress research time dramatically
- **Tool skepticism**: has been burned by oversimplified calculators before; wants to see the math
- **Tax awareness**: knows depreciation exists; doesn't fully understand PAL rules; wants to learn via results, not docs
- **Status signal**: property ownership = financial sophistication; takes pride in doing the math right

**Media & Community Habits**
- Reads: BiggerPockets (forums + podcast), On the Market podcast, Bigger News newsletter
- Follows: r/realestateinvesting, r/financialindependence, r/personalfinance
- YouTube: Graham Stephan, Meet Kevin (early audience), Andrei Jikh
- Social: LinkedIn for professional identity; Facebook RE investor groups for local markets
- Attends: local REIA meetups, BiggerPockets events, occasional RE conferences
- Trusts: peer recommendations + data over marketing; skeptical of "get rich quick" framing

**Buying Behavior**
- Evaluates 10–20 deals before purchasing 1
- Research phase: 1–6 months before pulling trigger on a market/property
- Decision triggers: interest rate environment, life event (bonus, liquidity event), spouse alignment
- Primary research tool today: spreadsheet + 3–4 browser tabs simultaneously
- Pain point: 30–60 min per deal; loses deals when analysis takes too long
- Purchase decision: data-driven; needs numbers + gut check alignment before offering

**Device & Platform**
- Primary: desktop/laptop during work hours (analysis = focused task, not mobile-first)
- Secondary: mobile at open houses or during casual browsing
- Browser: Chrome/Safari
- Comfortable with SaaS subscriptions; already pays for Zillow Premier, Redfin, Notion, etc.

### Out of Scope

- First-time investors (no property yet; different product)
- RE professionals and syndicators (need enterprise tools, not consumer tier)
- Active traders / fix-and-flip (different model)
- Commercial investors (different asset class, different analysis)

### Market Size

- ~18M non-primary-residence rental property owners in the US (US Census)
- ~6M earn $100K–$350K W2 income (propensity-to-pay segment)
- 1% penetration at $7.99/month = ~$6M ARR

Near-term addressable: property investors actively evaluating deals — estimated 500K–2M active deal evaluators in the W2 income band at any time.

---

## Business Model

### Monetization

| Tier | Price | Limits | Target user |
|------|-------|--------|-------------|
| **Free Trial** | $0 | 3 analyses, no expiry, no credit card | New users evaluating fit |
| **PropPulse Pro** | $7.99/month or $59/year | Unlimited analyses, saved properties, side-by-side comparison (up to 3) | Active deal evaluators |

**Rationale**:
- 3 free analyses = enough to prove value on a real deal; not enough for ongoing use
- $7.99/month is below the $9.99 psychological threshold; affordable vs. $50/mo BiggerPockets Pro
- Annual option = 2 months free (26% savings); increases LTV and reduces churn
- Server-side enforcement only — free tier counter lives in `user_profiles.analyses_used`, never trusted from client

### Revenue Projections (Conservative)

| Month | Free Users | Pro Users | MRR |
|-------|-----------|-----------|-----|
| 3 | 200 | 20 | $160 |
| 6 | 800 | 80 | $640 |
| 12 | 3,000 | 300 | $2,400 |
| 18 | 8,000 | 800 | $6,400 |
| 24 | 20,000 | 2,000 | $16,000 |

Assumes ~10% free-to-paid conversion, driven by analysis limit hit + deal urgency.

### Growth Lever

"Invite a friend, get 2 more free analyses." Referral loop targeted at the investor community — BiggerPockets forums, Facebook RE groups, local REIA meetups.

---

## Competitive Landscape

| Tool | Category | What they do | Gaps |
|------|----------|-------------|------|
| BiggerPockets Calculator | Analysis | Cap rate, cashflow | No tax personalization, no map, no env risk, manual input |
| DealCheck | Analysis | Property metrics | No W2 tax math, no neighborhood signals, no map, no env risk |
| Roofstock | Marketplace | Buy-side curated listings | Not an analysis tool |
| Climate Check / Risk Factor | Risk | Environmental risk scores | No financial analysis |
| Redfin / Zillow | Listing | AVM, basic estimates | No rental analysis at all |
| Excel spreadsheet | DIY | Fully customizable | Manual, 30–60 min per deal, no live data |

**PropPulse's wedge**: personalized W2 + PAL tax math + map + environmental risk in one view.

Climate Check shows risk. PropPulse shows risk AND whether the numbers still work after pricing in the insurance delta.

---

## Go-to-Market Strategy

### Phase 1: Community-Led Growth

**Channel 1 — BiggerPockets**
- Participate in forums answering tax/cashflow questions
- "I built a tool that does this" soft launch
- Target: 50–100 early users from organic forum presence

**Channel 2 — Reddit**
- r/realestateinvesting, r/personalfinance, r/financialindependence
- Problem-aware audience; receptive to tools that solve real pain
- Target: 100–200 early users from launch posts

**Channel 3 — Content SEO**
- Long-tail: "duplex cashflow calculator", "rental property tax deduction calculator", "passive activity loss rules"
- Target: 500–1000 organic visitors/month by month 6

**Channel 4 — Direct**
- Local REIA (Real Estate Investor Association) meetups in 8 launch metros
- Host a "know your numbers" workshop; use PropPulse live during session

### Phase 2: Paid Acquisition

- Google Ads targeting "rental property calculator", "investment property analysis"
- Facebook/Instagram targeting W2 professionals (household income >$100K + real estate interest)
- Budget: ~$1K/month after achieving $2K MRR (50% reinvestment)

### Referral Program

- Invite link: friend signs up → inviter gets 2 bonus analyses
- Post-analysis share: "I just analyzed [property] — GO" shareable card with PropPulse branding
- Target: 15–20% of new signups from referrals at steady state

---

## Product Roadmap

### Phase 1 — Web MVP (Weeks 1–10)

Goal: working analysis tool with personalized tax math, auth, and data pipeline.

| Sprint | Focus | Key deliverables |
|--------|-------|-----------------|
| 1 | Foundation + Auth | Next.js scaffold, Supabase setup, Google OAuth + Magic Link, onboarding, Rentcast integration |
| 2 | Tax Engine | Depreciation, PAL rules, Schedule E, multi-unit support, house hack toggle, stress scenarios |
| 3 | Results Page | GO/CAUTION/PASS verdict, stress table, cashflow breakdown, key metrics, recommendation panel |
| 4 | Map + Neighborhood + Demographics + Env Risk | Leaflet map, Walk Score, GreatSchools, Census ACS demographics, FEMA flood, fire risk, AQI, earthquake, equity outlook |
| 6 (Phase 2) | Analysis Comparison | Side-by-side up to 3 saved analyses across 7 dimensions; best-in-row highlighting; overall verdict with score pips |
| 5 | Save + Paywall + Share | Saved properties dashboard, 3-analysis free tier, Stripe Pro subscription, PDF export |

### Phase 2 — Polish + Apple Auth

- Apple Sign-In (required before App Store)
- Custom PropPulse-branded auth UI (replace Supabase Auth UI)
- Interactive stress test sliders (not static table)
- Side-by-side property comparison table
- Email alerts for saved search price drops
- Unit rent history chart (multi-unit)
- CrimeGrade → NeighborhoodScout API migration

### Phase 3 — iPhone App

- React Native / Expo scaffold (same Next.js API routes as backend)
- Quick-check mode at open houses
- Native map view
- Apple Sign-In active

### Phase 4 — Advanced Features

- LLM-generated narrative recommendation (replace static verdict text)
- Short-term rental (Airbnb) model toggle
- Cost segregation / bonus depreciation calculator
- 1031 exchange analysis
- Portfolio-level tax optimization
- Plaid integration for financial verification

---

## Technology & Operations

### Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | Next.js 15 (App Router) | React, SSR, SEO, shared API routes with mobile |
| Styling | Tailwind CSS | Fast design system, consistent tokens |
| Backend | Next.js API routes | No separate server at MVP scale |
| Database | Supabase (PostgreSQL 15) | Auth, RLS, jsonb for analysis results, caching |
| Auth | Supabase Auth | Google OAuth + Magic Link; HttpOnly cookie sessions |
| Property data | Rentcast API | Property details + rent estimates in one call |
| Geocoding | Mapbox | Address autocomplete + lat/lng for all downstream calls |
| Maps | Leaflet.js + OpenStreetMap | Free, open-source, flexible for custom overlays |
| Payments | Stripe | Pro subscription; webhook → subscriptions table |
| Email | Resend | Magic links + transactional |
| Deployment | Vercel | Preview deployments, edge network, zero-config |
| iPhone (Phase 3) | React Native / Expo | Shared logic with Next.js backend |

### Data Infrastructure

All external API responses cached in Supabase `data_cache` table. TTLs:

| Source | TTL | Rationale |
|--------|-----|-----------|
| Rentcast | 7 days | Property data changes slowly |
| Walk Score | 30 days | Scores update rarely |
| FEMA flood | 90 days | FIRM maps updated infrequently |
| First Street fire | 90 days | Annual model updates |
| AQI annual avg | 365 days | EPA annual summaries |
| Geocode | Indefinite | Addresses don't move |
| Mortgage rate | 1 day | Weekly FRED updates |

### API Cost Structure

| Monthly Active Users | Rentcast | First Street | Total API cost |
|---------------------|----------|--------------|----------------|
| 0–50 (MVP) | $0 | $0 | $0 |
| 50–500 | $50 | $49 | ~$100 |
| 500–5K | $200 | $49 | ~$250 |
| 5K+ | $200–custom | $199 | ~$450+ |

At $7.99/month with 200 paying users ($1,600 MRR), API costs are <10% of revenue.

### Team

Solo founder at launch. No hires until $5K MRR.

---

## Financial Model

### Unit Economics

| Metric | Value |
|--------|-------|
| MRR per Pro user | $7.99 |
| Annual plan discount | $59/yr (26% savings vs monthly) |
| Free → Pro conversion target | 10% |
| CAC (community-led) | ~$0 initially |
| CAC (paid) | ~$20–40 |
| LTV (12-mo avg) | ~$80 |
| LTV:CAC ratio | 2–4× at paid CAC |

### Cost Structure (Monthly)

| Cost | Amount | Notes |
|------|--------|-------|
| Vercel | $0–$20 | Free until scale |
| Supabase | $0–$25 | Free tier until 500MB DB |
| Rentcast | $0–$200 | Scales with analyses run |
| First Street | $0–$199 | Scale-dependent |
| Stripe | 2.9% + $0.30/txn | Per subscription renewal |
| Domain + misc | ~$15/mo | |
| **Total at MVP** | **~$40/mo** | |
| **Total at $5K MRR** | **~$350/mo** | |

---

## Key Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Tax accuracy liability | High | High | "Estimate only — consult a CPA" disclaimer on every screen; never present as tax advice |
| Rentcast free tier burns fast | High | Low | Aggressive caching; upgrade to $50/mo at first paying user |
| CrimeGrade scrape breaks | High | Medium | Graceful null; migrate to NeighborhoodScout post-revenue |
| Slow organic growth | Medium | High | REIA meetups, Reddit launch, referral program from day 1 |
| Competitive response (BiggerPockets) | Low | High | Fast iteration; defensible with tax engine complexity |
| GreatSchools API approval denied | Low | Low | Niche.com scrape fallback |
| FEMA API downtime | Low | Medium | Cache; "data temporarily unavailable" fallback |
| Insurance unavailability in high-risk zones | High | Medium | Flag CAUTION floor regardless of cashflow; display carrier warning |

### Tax Disclaimer Strategy

Every analysis screen: *"Estimates only — consult a CPA for personalized tax advice. PropPulse is not a tax advisor."*

Options for Phase 2: CPA partnership (referring users to a CPA network), in-product disclaimer upgrades, "reviewed by CPA" badge on methodology docs.

---

## Launch Plan

### Pre-Launch (Weeks 1–8)

- [ ] Build MVP (Sprints 1–4 per PROJECT_PLAN.md)
- [ ] Set up Stripe Pro subscription
- [ ] Configure Supabase prod environment
- [ ] Deploy to Vercel with custom domain (proppulse.com)
- [ ] Apply for GreatSchools API key (Week 1 — takes 1–3 days)
- [ ] Create BiggerPockets account; participate in forums
- [ ] Create Reddit accounts; build karma in target subreddits

### Soft Launch (Week 9–10)

- [ ] Invite 10–20 beta users (personal network of RE investors)
- [ ] Run 3 real deal analyses live; collect feedback
- [ ] Fix top 3 friction points
- [ ] Enable Stripe payments

### Public Launch (Week 11+)

- [ ] Post to r/realestateinvesting ("I built a tool...")
- [ ] BiggerPockets forum post
- [ ] Product Hunt launch (optional — secondary audience)
- [ ] Attend local REIA meetup with live demo
- [ ] Monitor for tax math edge cases; fix fast

### Success Metrics at 30 Days Post-Launch

| Metric | Target |
|--------|--------|
| Signups | 200 |
| Analyses run | 500 |
| Free → Pro conversions | 15 |
| MRR | $120 |
| NPS proxy (would recommend?) | >7/10 |

---

## Open Decisions

| Decision | Status | Notes |
|----------|--------|-------|
| App name | ✓ PropPulse | "Know before you buy." |
| Monetization | ✓ Freemium / $7.99/mo | Free 3 analyses → Pro |
| Tech stack | ✓ Defined | See PROJECT_PLAN.md |
| Auth | ✓ Google OAuth + Magic Link | Apple in Phase 2 |
| Data sources + caching | ✓ Defined | See DATA_SOURCES.md |
| DB schema | ✓ Defined | See DATA_MODEL.md |
| Tax disclaimer strategy | Open | "Estimate only" footer vs CPA partnership |
| Geographic launch scope | ✓ Full US (8 metros full, rest partial) | |
| Rentcast API tier | Open | Upgrade to $50/mo Starter at first paying user |
| Email provider | Open | Resend vs SendGrid for magic links |
| PR / influencer partnerships | Open | BiggerPockets Podcast, On the Market Podcast |

---

## Supporting Documents

| File | Contents |
|------|---------|
| [PROJECT_PLAN.md](PROJECT_PLAN.md) | Sprint roadmap, tech stack, sprint tasks, design system |
| [AUTH_STRATEGY.md](AUTH_STRATEGY.md) | OAuth setup, session management, RLS, security rules |
| [DATA_MODEL.md](DATA_MODEL.md) | Full Supabase schema, indexes, RLS policies, jsonb shapes |
| [DATA_SOURCES.md](DATA_SOURCES.md) | Per-API analysis: endpoints, cost, coverage, rate limits, caching |
| [../ux/mockup-results.html](../ux/mockup-results.html) | Interactive results page mockup |

---

*Estimate only — consult a CPA for tax advice. PropPulse is not a tax advisor.*
