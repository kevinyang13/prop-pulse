# PropPulse — Compliance & Privacy

**Last updated**: 2026-05-06  
**Jurisdiction**: United States (primary); California (CCPA)  
**Status**: Pre-launch — implement before public release

> This document is an internal reference for building compliant features, not a substitute for legal counsel. Retain a privacy attorney before publishing a live Privacy Policy or Terms of Service.

---

## Table of Contents

1. [Regulatory Landscape](#1-regulatory-landscape)
2. [Data Inventory](#2-data-inventory)
3. [CCPA Compliance](#3-ccpa-compliance)
4. [Privacy Policy Requirements](#4-privacy-policy-requirements)
5. [Terms of Service Requirements](#5-terms-of-service-requirements)
6. [Financial & Tax Disclaimer](#6-financial--tax-disclaimer)
7. [Email Compliance (CAN-SPAM / Transactional)](#7-email-compliance-can-spam--transactional)
8. [Cookie & Tracking Policy](#8-cookie--tracking-policy)
9. [Data Retention & Deletion](#9-data-retention--deletion)
10. [User Rights Implementation](#10-user-rights-implementation)
11. [Third-Party Subprocessors](#11-third-party-subprocessors)
12. [Security Baseline](#12-security-baseline)
13. [Breach Response Plan](#13-breach-response-plan)
14. [GDPR Considerations](#14-gdpr-considerations)
15. [Implementation Checklist](#15-implementation-checklist)

---

## 1. Regulatory Landscape

### Applicable Laws

| Law | Applies When | Penalty |
|-----|-------------|---------|
| **CCPA / CPRA** | Any user is a California resident | Up to $7,500/intentional violation |
| **CAN-SPAM** | Sending commercial email to US users | Up to $51,744/email |
| **COPPA** | Users under 13 | Up to $51,744/violation |
| **FTC Act § 5** | Unfair or deceptive practices (all US) | FTC enforcement action |
| **GDPR** | EU/EEA residents access the service | Up to €20M or 4% global revenue |
| **State privacy laws** | VA, CO, CT, TX, OR, MT, DE, NH, NJ, IN, IA, TN (2024–2026) | Varies |

### PropPulse Risk Assessment

| Risk | Level | Reason |
|------|-------|--------|
| CCPA | **High** | 6 of 8 launch metros are CA cities; majority of users likely CA residents |
| CAN-SPAM | Medium | Magic link emails + marketing emails must comply |
| Financial advice liability | **High** | Tax math outputs could be construed as tax advice |
| GDPR | Low (Phase 1) | US-only launch; no EU marketing |
| COPPA | Low | Target user is 30–50 yr old W2 professional; add age gate if needed |

---

## 2. Data Inventory

### Personal Data Collected

| Category | Data Elements | Source | Purpose | Stored In |
|----------|--------------|--------|---------|-----------|
| **Identity** | Full name, email address | User (Google OAuth / Magic Link) | Auth, account management | Supabase `auth.users`, `user_profiles` |
| **Financial profile** | W2 income, tax bracket, filing status, liquid cash, down payment % | User (onboarding) | Personalized analysis | Supabase `user_profiles` |
| **Property search history** | Addresses searched, analysis results | User action | Saved analyses, history | Supabase `property_searches`, `saved_analyses` |
| **Payment data** | Subscription status, billing period | Stripe (never raw card data) | Pro tier enforcement | Supabase `subscriptions` (Stripe manages PCI data) |
| **Usage data** | Analyses run count, login timestamps | System | Free tier enforcement, fraud prevention | Supabase `user_profiles.analyses_used` |
| **Auth tokens** | Google OAuth tokens, refresh tokens | Google / Supabase Auth | Session management | HttpOnly cookies (never localStorage) |
| **IP address** | Request IP | Vercel edge | Security, rate limiting | Vercel logs (not stored in DB) |

### Data NOT Collected

- Social Security Number
- Bank account or routing numbers
- Credit card numbers (Stripe handles; PropPulse never sees raw PAN)
- Government ID
- Health or medical data
- Precise geolocation beyond property address entered by user
- Biometric data

### Sensitive Data Classification (CCPA)

Under CCPA, **financial information** (income, assets) is "sensitive personal information" requiring:
- Explicit disclosure in Privacy Policy
- Opt-in consent before collecting (implement as onboarding consent checkbox)
- Right to limit use to stated purpose only (analysis — not sold, not used for marketing profiling)

---

## 3. CCPA Compliance

### Applicability

CCPA applies to businesses that meet **any one** of:
- $25M+ gross annual revenue, OR
- Buy/sell/share personal data of 100K+ consumers/year, OR
- Derive 50%+ of revenue from selling personal data

PropPulse at MVP: likely below all thresholds. However:
- 6 of 8 launch metros are in California
- Voluntary CCPA compliance signals trust to early users
- CPRA (2023 amendment) lowered thresholds and added sensitive data rules
- **Build compliant from day 1** — retrofitting is harder

### Consumer Rights Required Under CCPA

| Right | Description | PropPulse Implementation |
|-------|-------------|--------------------------|
| **Right to Know** | What personal data collected, used, shared | Privacy Policy + in-app "Your Data" page |
| **Right to Delete** | Delete personal data on request | Account deletion flow (see §10) |
| **Right to Correct** | Correct inaccurate personal data | Profile settings page |
| **Right to Opt-Out of Sale** | Cannot sell personal data without opt-out mechanism | PropPulse does NOT sell data; state this explicitly |
| **Right to Limit Sensitive Data Use** | Limit use of financial profile data | Financial data used only for analysis; not shared |
| **Right to Non-Discrimination** | Cannot deny service for exercising rights | Do not downgrade Pro users who request data deletion |
| **Right to Data Portability** | Provide data in portable format | Export endpoint (see §10) |

### "Do Not Sell or Share My Personal Information"

PropPulse does not sell or share personal data with third parties for cross-context behavioral advertising. State this explicitly in the Privacy Policy and footer link. Required footer link text: **"Do Not Sell or Share My Personal Information"** — even if answer is "we don't" — links to a page confirming this.

### Response Timeframes

| Request Type | Required Response Time |
|-------------|------------------------|
| Right to Know / Delete / Correct | 45 days (extendable 45 more with notice) |
| Right to Opt-Out | 15 business days |

### Verification

Before processing a deletion/access request, verify identity:
- Authenticated users: session verification sufficient
- Unauthenticated requests: require email confirmation matching account
- Do not require excessive documentation

### Privacy Notice at Collection (CCPA §1798.100(b))

At the point of collecting personal data (onboarding, sign-up), display:
> "We collect [income, filing status, available cash] to personalize your property analysis. This information is not sold or shared with third parties. [Privacy Policy link]"

---

## 4. Privacy Policy Requirements

### Must-Have Sections

**1. Information We Collect**
- Identity: name, email (from Google OAuth or email entry)
- Financial profile: income, filing status, cash (user-provided, onboarding)
- Property searches: addresses, analysis inputs and results
- Usage: analyses run, login activity
- Technical: IP address (Vercel logs), browser type (standard server logs)

**2. How We Use Your Information**
- Provide personalized property analysis
- Enforce free tier limits (analyses_used counter)
- Process subscription payments (via Stripe)
- Send transactional emails (magic links, receipts) via Resend
- Security, fraud prevention, debugging

**3. How We Share Your Information**

| Recipient | Data Shared | Purpose | Legal Basis |
|-----------|------------|---------|-------------|
| Supabase | All user data | Database hosting | Data processing agreement |
| Stripe | Email, subscription status | Payment processing | Contractual necessity |
| Resend | Email address | Transactional email | Contractual necessity |
| Vercel | IP, request metadata | Hosting / edge CDN | Legitimate interest |
| Google (OAuth) | Auth tokens only | Single sign-on | User consent |
| Rentcast | Property address (no PII) | Rent/property data | Legitimate interest |
| US Census API | ZIP code only | Demographics lookup | Legitimate interest |

**We do not sell personal data. We do not share personal data for advertising purposes.**

**4. Your Rights** — list all CCPA rights + how to exercise (see §10)

**5. Data Retention** — see §9

**6. Security** — summary of security practices (see §12)

**7. Children's Privacy** — service not directed at children under 13; no COPPA-covered data collected

**8. Changes to This Policy** — 30-day notice before material changes; email notice to registered users

**9. Contact Information**
- Email: privacy@proppulse.com
- Mailing address: required for CCPA (use registered agent address if no office)
- Response time: 45 days for rights requests

### Tone & Readability

- Plain English, no legalese
- Reading level: 8th grade or below
- Use tables and bullet points
- Under 2,000 words (CCPA does not require long policies — clear is better)

---

## 5. Terms of Service Requirements

### Must-Have Sections

**1. Acceptance of Terms**
- Must affirmatively accept (checkbox at signup, not "by using you agree")
- Record acceptance timestamp in `user_profiles.tos_accepted_at`

**2. Service Description**
- Describe what PropPulse does (analysis tool, not financial advisor)
- Explicit statement: PropPulse is NOT a licensed real estate broker, investment advisor, or tax advisor

**3. User Responsibilities**
- Accurate information: user represents that income/financial data entered is accurate for analysis purposes
- No misuse: no scraping, no reselling analysis output, no reverse engineering

**4. Free Tier and Paid Subscription**
- Free tier: 3 analyses, no credit card required, no expiry
- Pro: $7.99/month or $59/year, recurring until cancelled
- Cancellation: cancel anytime; access continues through end of billing period
- No refunds for partial periods (state this clearly)
- Price change: 30-day notice before price increase

**5. CRITICAL — Financial / Tax Disclaimer (see §6)**

**6. Intellectual Property**
- PropPulse owns the platform, algorithms, and design
- User retains ownership of data they input
- Analysis results: user may use for personal investment decisions; may not republish as a competing service

**7. Limitation of Liability**
- Cap liability at amount paid in last 12 months (standard SaaS)
- Exclude consequential damages (investment losses, tax penalties)
- No warranty on accuracy of third-party data (Rentcast, Census, Walk Score, FEMA)

**8. Indemnification**
- User indemnifies PropPulse for misuse of the service

**9. Governing Law**
- California law; San Diego County courts (or AAA arbitration — legal counsel recommended on this choice)

**10. Termination**
- PropPulse may terminate accounts for ToS violations
- 30-day notice for service discontinuation

---

## 6. Financial & Tax Disclaimer

### Why This Is Critical

PropPulse computes depreciation, PAL eligibility, Schedule E deductions, and tax-adjusted COC. These outputs could be construed as **tax advice** if not clearly disclaimed. Tax advice from an unlicensed party is a federal and state regulatory issue.

### Required Disclosures

**Page-level disclaimer** (every analysis results page, below the fold is insufficient):
> *All calculations are estimates for informational purposes only and do not constitute tax, legal, financial, or investment advice. Tax outcomes depend on individual circumstances that PropPulse cannot fully assess. Consult a licensed CPA or tax attorney before making investment decisions.*

**In-line disclaimer** (Tax Impact panel):
> *Depreciation and passive activity loss estimates are illustrative. Actual deductibility depends on your AGI, filing status, and existing passive activities. Consult a CPA.*

**PAL-specific warning** (when PAL suspended, AGI > $150K):
> *At your income level, passive losses are suspended and cannot offset ordinary income — they carry forward to the property's sale. Your effective tax benefit is deferred, not eliminated. Consult a CPA.*

**ToS language**:
> PropPulse is an analysis tool, not a licensed tax advisor, investment advisor, or real estate broker. No information provided by PropPulse constitutes financial, tax, or legal advice. Investment in real estate involves substantial risk including total loss of capital.

### Risk Mitigation Options (Phase 2)

| Option | Description | Cost |
|--------|-------------|------|
| CPA review badge | Partner with a CPA to review and certify methodology | $2K–$5K one-time |
| CPA referral integration | "Connect with a CPA" → partner referral fee | Revenue share |
| Insurance | Errors & Omissions (E&O) insurance | ~$500–$2K/yr for small software |

---

## 7. Email Compliance (CAN-SPAM / Transactional)

### Transactional Emails (exempt from most CAN-SPAM requirements)

| Email Type | Classification | Requirements |
|-----------|---------------|-------------|
| Magic link (sign-in) | Transactional | No unsubscribe required |
| Password-less OTP | Transactional | No unsubscribe required |
| Purchase receipt | Transactional | No unsubscribe required |
| Analysis complete notification | Transactional | No unsubscribe required |

### Commercial Emails (must comply with CAN-SPAM)

| Email Type | Requirements |
|-----------|-------------|
| Feature announcements | Must have unsubscribe link, physical address, "from" name |
| Upgrade prompts / upsell | Must have unsubscribe link |
| Referral program emails | Must have unsubscribe link |
| Newsletters / investor tips | Must have unsubscribe link |

### CAN-SPAM Requirements for Commercial Emails

1. Accurate "From", "To", "Reply-To" fields
2. Non-deceptive subject line
3. Identify as advertisement (if first contact)
4. Physical postal address in email body
5. Clear unsubscribe mechanism (honor within 10 business days)
6. Do not send to opted-out addresses

### Implementation (Resend)

```typescript
// Always set list-unsubscribe header for commercial emails
headers: {
  'List-Unsubscribe': '<https://proppulse.com/unsubscribe?token={token}>',
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
}
```

Store unsubscribe preferences in `user_profiles.marketing_emails_opt_in` (default `true`; set `false` on unsubscribe). Never send commercial email to `opt_in = false` users.

---

## 8. Cookie & Tracking Policy

### Cookies Used

| Cookie | Type | Purpose | Duration | Consent Required? |
|--------|------|---------|----------|-------------------|
| `sb-*` (Supabase auth) | Strictly necessary | Session authentication | 7 days (refresh token) | No |
| `__vercel_*` | Strictly necessary | Load balancing, edge routing | Session | No |
| Analytics (if added) | Non-essential | Product analytics (Posthog / Mixpanel) | 1 year | **Yes** |
| Marketing pixel (if added) | Non-essential | Ad conversion tracking | 90 days | **Yes** |

### Cookie Consent

Phase 1 MVP: auth cookies only (strictly necessary) — no banner required.

Before adding analytics or marketing cookies:
1. Add cookie consent banner on first visit
2. Default: strictly necessary only
3. User must affirmatively opt in to analytics/marketing
4. Record consent with timestamp in `user_profiles.analytics_consent_at`
5. Honor consent choice immediately; do not load analytics scripts until accepted

### Do Not Track (DNT)

Respect `DNT: 1` header — do not load analytics or tracking scripts when set.

---

## 9. Data Retention & Deletion

### Retention Schedule

| Data Category | Retention Period | Basis |
|--------------|----------------|-------|
| Active user account | Until account deleted | Service provision |
| Financial profile (income, bracket) | Until account deleted or user updates | Service provision |
| Saved analyses | Until account deleted or user deletes | Service provision |
| Property search history | 2 years from last activity, then purge | Minimum necessary |
| Subscription records | 7 years from last transaction | Tax/accounting compliance (IRS) |
| Payment logs (Stripe) | 7 years | Tax/accounting compliance |
| Auth logs (login events) | 90 days rolling | Security / fraud detection |
| API cache (`data_cache` table) | Per TTL, max 1 year | Performance |
| Vercel access logs | 30 days (Vercel default) | Security |

### Automatic Purge Jobs

```sql
-- Nightly cron: delete expired cache rows
DELETE FROM data_cache WHERE fetched_at + (ttl_days * interval '1 day') < now();

-- Monthly cron: purge search history older than 2 years for inactive users
DELETE FROM property_searches
WHERE created_at < now() - interval '2 years'
AND user_id NOT IN (SELECT id FROM user_profiles WHERE last_active_at > now() - interval '2 years');
```

---

## 10. User Rights Implementation

### Account Deletion ("Right to Delete")

User initiates: Settings → Delete Account → Confirm

```typescript
// server-side: cascade delete via FK ON DELETE CASCADE
// but subscription data retained 7 years (financial compliance)
async function deleteAccount(userId: string) {
  // 1. Cancel Stripe subscription
  await stripe.subscriptions.cancel(stripeSubId)

  // 2. Anonymize subscription record (retain for tax compliance)
  await supabase.from('subscriptions')
    .update({ stripe_customer_id: null, stripe_subscription_id: null })
    .eq('user_id', userId)

  // 3. Delete auth.users row — cascades to all user_profiles, saved_analyses,
  //    property_searches, subscriptions via FK ON DELETE CASCADE
  await supabase.auth.admin.deleteUser(userId)

  // Note: Supabase Auth admin API required (service role key, server-side only)
}
```

**30-day soft delete**: before permanent deletion, soft-delete for 30 days (set `user_profiles.deleted_at`) to allow recovery. Purge on day 30.

### Data Export ("Right to Portability")

User initiates: Settings → Export My Data → Download JSON

Export package includes:
```json
{
  "profile": { "email", "name", "income", "filing_status", "state", "created_at" },
  "analyses": [ { "address", "verdict", "assumptions", "results", "created_at" } ],
  "searches": [ { "query", "resolved_address", "created_at" } ]
}
```

Exclude: internal IDs, system flags, auth tokens, cached third-party data.

Generate as downloadable JSON. Email download link valid for 24 hours.

### Data Correction ("Right to Correct")

User initiates: Settings → Edit Profile (income, filing status, state, cash)

All profile fields editable in self-service. No support ticket required.

### Rights Request Intake

Email: privacy@proppulse.com  
Log all requests in internal tracker with:
- Date received
- Request type (delete / export / correct / know)
- User identity verified (Y/N)
- Date responded
- Action taken

Respond within **45 days**. Send confirmation email on receipt.

---

## 11. Third-Party Subprocessors

Maintain a public subprocessor list (required by GDPR; good practice under CCPA).

| Subprocessor | Category | Data Shared | Location | DPA Available |
|-------------|----------|------------|----------|---------------|
| **Supabase** | Database hosting | All user data, property data | US (AWS us-east-1) | Yes |
| **Vercel** | Hosting / CDN | IP address, request metadata | US + edge nodes globally | Yes |
| **Stripe** | Payment processing | Email, billing info, subscription data | US | Yes (PCI-DSS Level 1) |
| **Resend** | Transactional email | Email address, email content | US | Yes |
| **Google** (OAuth) | Authentication | OAuth tokens, email | US | Yes (Google Cloud DPA) |
| **Rentcast** | Property data API | Property address (no PII) | US | No — no PII shared |
| **Mapbox** | Geocoding | Property address | US | No — no PII shared |
| **US Census API** | Demographics | ZIP code only | US (federal) | N/A — US gov |
| **Walk Score** | Walkability | Lat/lng | US | No — no PII shared |
| **FEMA / USGS** | Environmental data | Lat/lng | US (federal) | N/A |
| **First Street** | Fire/wind risk | Address hash | US | Check ToS |

**Key principle**: Rentcast, Mapbox, Census, Walk Score, FEMA, USGS receive only property address / coordinates — no user PII. Verify that API terms permit this use case.

### Data Processing Agreements

Before launch, sign DPAs with:
- [x] Supabase (in dashboard)
- [x] Stripe (in Stripe dashboard — "Data Processing Agreement")
- [ ] Vercel (request at vercel.com/legal/dpa)
- [ ] Resend (check dashboard or email support)
- [ ] Google (Google Cloud DPA covers OAuth)

---

## 12. Security Baseline

### Authentication Security

- JWT access tokens in memory only (never `localStorage`)
- Refresh tokens in HttpOnly, SameSite=Strict cookies via `@supabase/auth-helpers-nextjs`
- PKCE flow for all OAuth — prevents CSRF
- Redirect URI allowlist: no wildcards in production
- Magic link TTL: 1 hour (Supabase default)
- Rate limit: 1 magic link/60s per email address

### Database Security

- RLS (Row Level Security) enabled on all user-scoped tables
- Service role key: server-side only, never in `NEXT_PUBLIC_` env vars
- Anon key: public-safe, RLS prevents cross-user data access
- All connections over TLS (Supabase enforces)

### Application Security

- All API routes validate session before querying user data
- Free tier counter enforced server-side; never trust client
- Input validation on all user-supplied fields (address, income, etc.)
- No raw SQL string interpolation — use Supabase query builder (parameterized)
- Content Security Policy headers via `next.config.js`
- HTTPS only (Vercel enforces; set HSTS header)

### Stripe PCI Compliance

- PropPulse never handles raw card data
- Stripe Elements or Stripe Checkout for all payment flows (PCI scope reduction)
- Stripe webhook signature verification on every webhook event:

```typescript
const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
```

### Environment Variables

```bash
# Server-only — NEVER prefix NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
RENTCAST_API_KEY=...
FIRST_STREET_API_KEY=...
CENSUS_API_KEY=...
RESEND_API_KEY=...
FRED_API_KEY=...

# Client-safe
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_MAPBOX_TOKEN=...    # scope to geocoding only, restricted to proppulse.com domain
```

### Security Headers (`next.config.js`)

```javascript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",   // tighten after eval removal
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://*.tile.openstreetmap.org",
      "connect-src 'self' https://*.supabase.co https://api.mapbox.com",
      "frame-ancestors 'none'",
    ].join('; ')
  },
]
```

---

## 13. Breach Response Plan

### Definition

A security breach includes: unauthorized access to user personal data, accidental exposure of user data, loss of encrypted data where key is compromised.

### Response Procedure

**Hour 0–1: Contain**
1. Identify scope — which tables / users affected
2. Revoke compromised credentials (rotate Supabase service role key, Stripe keys)
3. Suspend affected user sessions if needed (`supabase.auth.admin.signOutUser(userId)`)
4. Preserve logs for forensics

**Hour 1–24: Assess**
1. Determine data types exposed (PII? financial profile? payment data?)
2. Determine number of users affected
3. Document timeline

**Day 1–3: Notify**

| Notification | Timeline | Trigger |
|-------------|----------|---------|
| Users affected | Within 72 hours of discovery | Any PII exposure |
| California AG (if 500+ CA residents) | Per CCPA — "expedient time" | PII breach |
| Stripe (if payment-related) | Immediately | Any payment system breach |
| Supabase | Per their incident process | Infrastructure breach |

User notification email must include:
- What happened (plain English)
- What data was involved
- What PropPulse is doing about it
- What users should do (change password on linked accounts if any)
- Contact for questions (privacy@proppulse.com)

---

## 14. GDPR Considerations

### Phase 1 Stance

Phase 1 is US-only launch. Do not geo-block EU users, but do not actively market to them. If EU users sign up organically: serve them, apply GDPR protections.

### GDPR vs CCPA Differences

| Requirement | CCPA | GDPR |
|-------------|------|------|
| Lawful basis required | No | Yes (consent / contract / legitimate interest) |
| Data Protection Officer | No | Required if processing at scale |
| Privacy by Design | Not explicit | Required |
| Right to be Forgotten | Delete within 45 days | Delete without undue delay |
| Data transfers outside EU | N/A | Standard Contractual Clauses required |
| Breach notification | "Expedient time" | 72 hours to supervisory authority |

### If EU Users Reach Meaningful Scale (Phase 2)

- Add EU data residency option (Supabase supports EU regions)
- Update Privacy Policy with GDPR legal bases
- Add cookie consent banner (ePrivacy Directive)
- Sign Standard Contractual Clauses with subprocessors that process EU data
- Appoint EU representative (if no EU establishment)

---

## 15. Implementation Checklist

### Before Beta / Soft Launch

- [ ] Draft Privacy Policy (attorney review recommended)
- [ ] Draft Terms of Service (attorney review recommended)
- [ ] Add ToS acceptance checkbox at signup (record `tos_accepted_at` + `tos_version`)
- [ ] Add privacy notice at data collection (onboarding step 1)
- [ ] Implement "Do Not Sell or Share My Personal Information" page + footer link
- [ ] Set up privacy@proppulse.com email address
- [ ] Sign DPAs with Supabase, Stripe, Vercel, Resend
- [ ] Add tax/financial disclaimer to every results page
- [ ] Add PAL suspension warning at appropriate income thresholds
- [ ] Implement account deletion flow (30-day soft delete → permanent)
- [ ] Implement data export endpoint (JSON download)
- [ ] Add `marketing_emails_opt_in` column to `user_profiles`
- [ ] Add unsubscribe link to all commercial emails
- [ ] Add `tos_accepted_at`, `tos_version`, `marketing_emails_opt_in`, `analytics_consent_at` to `user_profiles`
- [ ] Configure security headers in `next.config.js`
- [ ] Verify Stripe webhook signature on every webhook
- [ ] Audit all env vars — confirm none in `NEXT_PUBLIC_` that should be server-only

### Before Public Launch

- [ ] Publish Privacy Policy at proppulse.com/privacy
- [ ] Publish Terms of Service at proppulse.com/terms
- [ ] Publish Cookie Policy at proppulse.com/cookies (or section within Privacy Policy)
- [ ] Add footer links: Privacy Policy · Terms of Service · Do Not Sell My Info
- [ ] Add physical mailing address to footer (required by CAN-SPAM + CCPA)
- [ ] Pen test auth flows (or use a checklist from OWASP)
- [ ] Enable Supabase audit logging
- [ ] Set up breach response contacts list
- [ ] Obtain E&O insurance quote (optional but recommended given tax math features)

### Schema Additions Required

```sql
ALTER TABLE user_profiles
  ADD COLUMN tos_accepted_at    timestamptz,
  ADD COLUMN tos_version        text DEFAULT '1.0',
  ADD COLUMN marketing_emails_opt_in  boolean DEFAULT true,
  ADD COLUMN analytics_consent_at    timestamptz,
  ADD COLUMN deleted_at         timestamptz;   -- soft delete
```

---

## Supporting Documents

| File | Contents |
|------|---------|
| [AUTH_STRATEGY.md](AUTH_STRATEGY.md) | OAuth setup, session management, security rules |
| [DATA_MODEL.md](DATA_MODEL.md) | Database schema including user_profiles fields |
| [PROJECT_PLAN.md](PROJECT_PLAN.md) | Sprint roadmap |

---

*This document is an internal engineering and product reference. It is not a substitute for legal advice. Consult a privacy attorney licensed in California before publishing live Privacy Policy and Terms of Service documents.*
