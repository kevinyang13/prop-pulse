# PropPulse — Data Model

**Database**: Supabase (PostgreSQL 15)  
**Last updated**: 2026-05-06

---

## Entity Relationship Overview

```
auth.users (Supabase managed)
    └── user_profiles          (1:1)
    └── saved_analyses         (1:many)
    └── property_searches      (1:many)
    └── subscriptions          (1:1)

properties
    └── property_units         (1:many, MFU only)
    └── neighborhood_signals   (1:1)
    └── environmental_risks    (1:1)
    └── saved_analyses         (1:many)

infrastructure_projects        (standalone, geo-queried by distance)
data_cache                     (standalone, keyed by source+address)
mortgage_rates                 (standalone, time series)
```

---

## Table Definitions

### `user_profiles`

Extends `auth.users`. Created on first sign-in via trigger.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, FK → `auth.users.id` ON DELETE CASCADE | |
| `email` | `text` | NOT NULL | Denormalized for convenience |
| `full_name` | `text` | | |
| `w2_income` | `integer` | | Annual gross W2 income in dollars |
| `tax_bracket` | `numeric(4,2)` | CHECK IN (0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37) | Federal marginal rate as decimal |
| `filing_status` | `text` | CHECK IN ('single','married_joint','married_separate','head_of_household') | |
| `state` | `char(2)` | | Two-letter state code |
| `state_tax_rate` | `numeric(4,2)` | | Marginal state income tax rate |
| `liquid_cash` | `integer` | | Available cash for down payment + reserves |
| `default_down_pct` | `numeric(4,1)` | DEFAULT 20.0 | Default down payment % shown in assumptions |
| `analyses_used` | `integer` | NOT NULL DEFAULT 0 | Free tier counter (max 3) |
| `onboarding_complete` | `boolean` | NOT NULL DEFAULT false | |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() | |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT now() | |

**Indexes**: PK on `id`.

**Notes**:
- PAL rule tier derived at query time from `w2_income`: <$100K = full deduction, $100K–$150K = phase-out, >$150K = suspended.
- `state_tax_rate` is user-supplied or pre-filled from state lookup table. Not a full bracket table — single marginal rate is sufficient for Schedule E estimate.

---

### `properties`

Cached property data from Rentcast + geocoding. One row per unique normalized address.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `address_key` | `text` | UNIQUE NOT NULL | Normalized: lowercase, no punctuation, e.g. `4821-oakwood-dr-san-diego-ca-92115` |
| `full_address` | `text` | NOT NULL | Display string |
| `street` | `text` | | |
| `city` | `text` | | |
| `state` | `char(2)` | | |
| `zip` | `char(5)` | | |
| `lat` | `numeric(9,6)` | | |
| `lng` | `numeric(9,6)` | | |
| `property_type` | `text` | CHECK IN ('sfh','duplex','triplex','fourplex','condo','townhouse') | |
| `beds` | `smallint` | | |
| `baths` | `numeric(3,1)` | | |
| `sqft` | `integer` | | Interior living area |
| `lot_size_sqft` | `integer` | | |
| `year_built` | `smallint` | | |
| `garage` | `text` | | e.g. `2-car attached`, `none` |
| `parking` | `text` | | Multi-unit: `3 covered spots` |
| `list_price` | `integer` | | Current listing price |
| `last_sold_price` | `integer` | | |
| `last_sold_date` | `date` | | |
| `avm` | `integer` | | Rentcast automated valuation |
| `rent_estimate_low` | `integer` | | Monthly rent, low bound |
| `rent_estimate_mid` | `integer` | | Monthly rent, point estimate |
| `rent_estimate_high` | `integer` | | Monthly rent, high bound |
| `rent_estimate_confidence` | `text` | CHECK IN ('high','medium','low') | Rentcast confidence |
| `hoa_monthly` | `integer` | DEFAULT 0 | |
| `property_tax_annual` | `integer` | | |
| `unit_count` | `smallint` | DEFAULT 1 | 1 = SFH, 2–4 = MFU |
| `laundry` | `text` | | `in-unit`, `shared`, `none` |
| `rentcast_id` | `text` | | Rentcast internal property ID for future re-fetch |
| `data_source` | `text` | NOT NULL DEFAULT 'rentcast' | |
| `fetched_at` | `timestamptz` | NOT NULL DEFAULT now() | |
| `stale_at` | `timestamptz` | | Computed: fetched_at + 7 days |

**Indexes**:
```sql
CREATE UNIQUE INDEX ON properties (address_key);
CREATE INDEX ON properties (zip);
CREATE INDEX ON properties (lat, lng);
CREATE INDEX ON properties (fetched_at);
```

---

### `property_units`

One row per unit for multi-unit (2–4) properties.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `property_id` | `uuid` | NOT NULL FK → `properties.id` ON DELETE CASCADE | |
| `unit_label` | `text` | NOT NULL | `Unit 1`, `Unit A`, `2B`, etc. |
| `beds` | `smallint` | | |
| `baths` | `numeric(3,1)` | | |
| `sqft` | `integer` | | |
| `status` | `text` | CHECK IN ('occupied','vacant') DEFAULT 'occupied' | |
| `monthly_rent_actual` | `integer` | | Current lease rent |
| `monthly_rent_market` | `integer` | | Rentcast estimate for this unit |
| `under_market` | `boolean` | GENERATED ALWAYS AS (monthly_rent_actual < monthly_rent_market) STORED | |
| `lease_end_date` | `date` | | |

**Indexes**: `CREATE INDEX ON property_units (property_id);`

---

### `neighborhood_signals`

One row per property. Cached neighborhood-level scores.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `property_id` | `uuid` | UNIQUE NOT NULL FK → `properties.id` ON DELETE CASCADE | |
| `walk_score` | `smallint` | CHECK (walk_score BETWEEN 0 AND 100) | |
| `walk_score_label` | `text` | | `Walker's Paradise`, `Very Walkable`, etc. |
| `transit_score` | `smallint` | CHECK (transit_score BETWEEN 0 AND 100) | Null if city not supported |
| `transit_score_label` | `text` | | |
| `bike_score` | `smallint` | CHECK (bike_score BETWEEN 0 AND 100) | |
| `school_rating` | `numeric(3,1)` | CHECK (school_rating BETWEEN 1 AND 10) | GreatSchools summary rating |
| `school_name` | `text` | | Nearest rated school |
| `school_distance_mi` | `numeric(4,2)` | | |
| `crime_index` | `smallint` | | 0–100, lower = less crime |
| `crime_grade` | `char(2)` | | `A`, `A-`, `B+`, etc. |
| `crime_vs_city_avg` | `text` | CHECK IN ('above','below','at') | |
| `infra_project_count_2mi` | `smallint` | DEFAULT 0 | Count of projects within 2 miles |
| `walk_score_fetched_at` | `timestamptz` | | |
| `schools_fetched_at` | `timestamptz` | | |
| `crime_fetched_at` | `timestamptz` | | |

**Indexes**: `CREATE UNIQUE INDEX ON neighborhood_signals (property_id);`

---

### `environmental_risks`

One row per property. All environmental hazard data.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `property_id` | `uuid` | UNIQUE NOT NULL FK → `properties.id` ON DELETE CASCADE | |
| `fire_risk_score` | `smallint` | CHECK (fire_risk_score BETWEEN 1 AND 100) | First Street 1–100 |
| `fire_risk_level` | `text` | CHECK IN ('minimal','low','moderate','high','severe') | |
| `fire_zone_label` | `text` | | `VHFHSZ`, `HFHSZ`, `MFHSZ`, `Non-FHSZ` (CA) |
| `fire_data_source` | `text` | CHECK IN ('calfire','first_street') | |
| `fire_insurance_impact_monthly` | `integer` | | Estimated $ premium delta |
| `flood_zone` | `text` | | FEMA zone code: `X`, `AE`, `VE`, `AO`, `X500` |
| `flood_risk_level` | `text` | CHECK IN ('minimal','moderate','high','coastal') | |
| `flood_insurance_required` | `boolean` | | True for AE, VE, AO |
| `flood_firm_date` | `date` | | FEMA FIRM map effective date |
| `aqi_annual_avg` | `smallint` | | EPA annual average AQI |
| `aqi_category` | `text` | CHECK IN ('good','moderate','unhealthy_sensitive','unhealthy','very_unhealthy','hazardous') | |
| `aqi_monitoring_station` | `text` | | Nearest station name |
| `wind_zone` | `text` | | FEMA wind zone: `I`, `II`, `III`, `IV` |
| `wind_risk_level` | `text` | CHECK IN ('low','moderate','high','hurricane') | |
| `wind_design_speed_mph` | `smallint` | | |
| `earthquake_pga` | `numeric(4,3)` | | USGS PGA in %g (2% in 50yr) |
| `earthquake_risk_level` | `text` | CHECK IN ('low','moderate','high','very_high') | |
| `earthquake_near_fault` | `boolean` | | |
| `insurance_total_impact_monthly` | `integer` | | Sum of all elevated-risk insurance estimates |
| `fetched_at` | `timestamptz` | NOT NULL DEFAULT now() | |

**Indexes**: `CREATE UNIQUE INDEX ON environmental_risks (property_id);`

---

### `saved_analyses`

User's saved property analysis runs. Stores both inputs and outputs.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | NOT NULL FK → `auth.users.id` ON DELETE CASCADE | |
| `property_id` | `uuid` | NOT NULL FK → `properties.id` | |
| `property_type` | `text` | NOT NULL CHECK IN ('sfh','mfu') | Mode at time of analysis |
| `verdict` | `text` | NOT NULL CHECK IN ('GO','CAUTION','PASS') | |
| `verdict_reason` | `text` | | Short narrative, 1–2 sentences |
| `assumptions` | `jsonb` | NOT NULL | See assumptions schema below |
| `results` | `jsonb` | NOT NULL | See results schema below |
| `notes` | `text` | | User-written notes |
| `is_starred` | `boolean` | NOT NULL DEFAULT false | |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() | |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT now() | |

**Indexes**:
```sql
CREATE INDEX ON saved_analyses (user_id);
CREATE INDEX ON saved_analyses (property_id);
CREATE INDEX ON saved_analyses (user_id, created_at DESC);
CREATE INDEX ON saved_analyses (user_id) WHERE is_starred = true;
```

**`assumptions` jsonb schema** (SFH example):
```json
{
  "purchase_price": 625000,
  "down_payment_pct": 20.0,
  "interest_rate": 7.1,
  "loan_term_years": 30,
  "monthly_rent": 3000,
  "vacancy_pct": 5.0,
  "property_tax_monthly": 651,
  "insurance_monthly": 208,
  "hoa_monthly": 0,
  "maintenance_pct_annual": 1.0,
  "property_mgmt_pct": 8.0,
  "closing_cost_pct": 1.8,
  "house_hack": false,
  "house_hack_owner_pct": null,
  "unit_rents": null
}
```

**`unit_rents`** for MFU:
```json
[
  { "unit": "Unit 1", "monthly_rent": 2000, "status": "occupied" },
  { "unit": "Unit 2", "monthly_rent": 2200, "status": "occupied" },
  { "unit": "Unit 3", "monthly_rent": 1800, "status": "vacant" }
]
```

**`results` jsonb schema**:
```json
{
  "monthly_cashflow": 412,
  "annual_cashflow": 4944,
  "cash_on_cash_return": 6.8,
  "cap_rate": 5.1,
  "grm": 17.4,
  "noi": 31875,
  "break_even_occupancy": 86.0,
  "total_cash_invested": 126000,
  "annual_depreciation": 18182,
  "tax_savings_annual": 3720,
  "tax_adjusted_coc": 9.1,
  "passive_loss_status": "suspended",
  "price_per_unit": null,
  "expense_ratio": null,
  "blended_vacancy": null,
  "stress_scenarios": [
    { "label": "Rent +10%", "cashflow": 712, "coc": 8.2, "outcome": "positive" },
    { "label": "Base Case", "cashflow": 412, "coc": 6.8, "outcome": "base" },
    { "label": "Rent -10%", "cashflow": 112, "coc": 4.9, "outcome": "positive" },
    { "label": "Vacancy 15%", "cashflow": 187, "coc": 5.2, "outcome": "marginal" },
    { "label": "Rate 8.0%", "cashflow": -138, "coc": -1.2, "outcome": "negative" },
    { "label": "Rate 8% + Vacancy 15%", "cashflow": -488, "coc": -4.3, "outcome": "negative" }
  ]
}
```

---

### `property_searches`

Search history per user. Used for "Recent" list and analytics.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | NOT NULL FK → `auth.users.id` ON DELETE CASCADE | |
| `raw_query` | `text` | NOT NULL | Exactly what user typed |
| `resolved_address` | `text` | | Normalized address after geocoding |
| `property_id` | `uuid` | FK → `properties.id` | Null if geocoding failed |
| `resolved` | `boolean` | NOT NULL DEFAULT false | |
| `searched_at` | `timestamptz` | NOT NULL DEFAULT now() | |

**Indexes**:
```sql
CREATE INDEX ON property_searches (user_id, searched_at DESC);
```

---

### `infrastructure_projects`

Manually curated major city projects. Geo-queried at analysis time for proximity.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `name` | `text` | NOT NULL | |
| `city` | `text` | NOT NULL | |
| `state` | `char(2)` | NOT NULL | |
| `description` | `text` | | |
| `investment_amount` | `bigint` | | In dollars |
| `investment_display` | `text` | | `$1.2B`, `$480M` |
| `status` | `text` | NOT NULL CHECK IN ('planned','under_construction','completed') | |
| `impact_level` | `text` | NOT NULL CHECK IN ('high','medium','low') | |
| `lat` | `numeric(9,6)` | NOT NULL | Project centroid |
| `lng` | `numeric(9,6)` | NOT NULL | |
| `completion_year` | `smallint` | | |
| `data_source` | `text` | NOT NULL CHECK IN ('manual','socrata') | |
| `source_url` | `text` | | |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() | |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT now() | |

**Indexes**:
```sql
CREATE INDEX ON infrastructure_projects (state, city);
-- PostGIS for geo queries (optional at MVP; use Haversine formula query instead)
CREATE INDEX ON infrastructure_projects (lat, lng);
```

**Proximity query** (without PostGIS):
```sql
SELECT *, 
  (3959 * acos(cos(radians($lat)) * cos(radians(lat))
    * cos(radians(lng) - radians($lng))
    + sin(radians($lat)) * sin(radians(lat)))) AS distance_mi
FROM infrastructure_projects
WHERE state = $state
HAVING distance_mi < 10
ORDER BY distance_mi;
```

---

### `subscriptions`

User subscription state. Synced from Stripe via webhook.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | UNIQUE NOT NULL FK → `auth.users.id` ON DELETE CASCADE | |
| `tier` | `text` | NOT NULL CHECK IN ('free','pro') DEFAULT 'free' | |
| `stripe_customer_id` | `text` | UNIQUE | |
| `stripe_subscription_id` | `text` | UNIQUE | |
| `stripe_price_id` | `text` | | Monthly vs annual plan |
| `status` | `text` | CHECK IN ('active','canceled','past_due','trialing','incomplete') | |
| `current_period_start` | `timestamptz` | | |
| `current_period_end` | `timestamptz` | | |
| `cancel_at_period_end` | `boolean` | DEFAULT false | |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() | |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT now() | |

---

### `data_cache`

Raw API response cache. Prevents redundant external calls.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `cache_key` | `text` | UNIQUE NOT NULL | `{source}:{address_key}` e.g. `walkscore:4821-oakwood-dr-san-diego-ca-92115` |
| `source` | `text` | NOT NULL | `rentcast`, `walkscore`, `greatschools`, `crimegrades`, `fema_flood`, `first_street`, `airnow`, `usgs` |
| `payload` | `jsonb` | NOT NULL | Raw API response |
| `fetched_at` | `timestamptz` | NOT NULL DEFAULT now() | |
| `ttl_days` | `smallint` | NOT NULL | Source-specific TTL |
| `expires_at` | `timestamptz` | GENERATED ALWAYS AS (fetched_at + ttl_days * interval '1 day') STORED | |

**Indexes**:
```sql
CREATE UNIQUE INDEX ON data_cache (cache_key);
CREATE INDEX ON data_cache (expires_at);  -- for cleanup job
CREATE INDEX ON data_cache (source, fetched_at);
```

**Cache lookup**:
```sql
SELECT payload FROM data_cache
WHERE cache_key = $1 AND expires_at > now();
```

**Cleanup job** (run nightly via Supabase cron):
```sql
DELETE FROM data_cache WHERE expires_at < now();
```

---

### `mortgage_rates`

Weekly FRED mortgage rate history.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `rate_30yr_fixed` | `numeric(4,2)` | NOT NULL | e.g. `7.10` |
| `rate_15yr_fixed` | `numeric(4,2)` | | |
| `effective_date` | `date` | UNIQUE NOT NULL | FRED observation date |
| `fetched_at` | `timestamptz` | NOT NULL DEFAULT now() | |

**Indexes**: `CREATE UNIQUE INDEX ON mortgage_rates (effective_date);`

**Latest rate query**:
```sql
SELECT rate_30yr_fixed FROM mortgage_rates
ORDER BY effective_date DESC LIMIT 1;
```

---

## Row-Level Security (RLS)

All tables with `user_id` column require RLS. Enable per table:

```sql
-- user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can read own profile"
  ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users can update own profile"
  ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- saved_analyses
ALTER TABLE saved_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can CRUD own analyses"
  ON saved_analyses FOR ALL USING (auth.uid() = user_id);

-- property_searches
ALTER TABLE property_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can read own searches"
  ON property_searches FOR ALL USING (auth.uid() = user_id);

-- subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can read own subscription"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);
-- write only via service_role (Stripe webhook handler)
```

**Public read (no RLS restriction)**:
- `properties` — property data is not PII
- `neighborhood_signals` — public data
- `environmental_risks` — public data
- `infrastructure_projects` — public data
- `mortgage_rates` — public data
- `data_cache` — service_role only (never exposed to client)

---

## Key Derived Values (Computed at API Layer, Not Stored)

These are calculated per-request from stored assumptions + user profile. Do not store in DB.

| Value | Formula |
|-------|---------|
| Loan amount | `purchase_price × (1 − down_payment_pct/100)` |
| Monthly mortgage | Standard amortization formula |
| Total cash invested | `purchase_price × down_payment_pct/100 + purchase_price × closing_cost_pct/100` |
| Effective gross income | `monthly_rent × (1 − vacancy_pct/100)` |
| Monthly cashflow | `EGI − (mortgage + tax + insurance + HOA + maintenance + PM)` |
| NOI | `Annual EGI − annual operating expenses (ex-mortgage)` |
| Cap rate | `NOI / purchase_price` |
| COC | `Annual cashflow / total_cash_invested` |
| GRM | `purchase_price / (monthly_rent × 12)` |
| Annual depreciation | `purchase_price × 0.80 / 27.5` |
| Tax savings | `annual_depreciation × tax_bracket` (capped by PAL rules) |
| Tax-adjusted COC | `(annual_cashflow + tax_savings) / total_cash_invested` |
| Break-even occupancy | `monthly_fixed_costs / monthly_gross_rent` |
| PAL status | AGI < 100K → full; 100K–150K → phase-out; >150K → suspended |

---

## TTL Reference

| Data | TTL | Rationale |
|------|-----|-----------|
| Rentcast property | 7 days | Listing price / details can change |
| Rentcast rent estimate | 7 days | Rent market moves monthly |
| Walk Score | 30 days | Infrastructure changes slowly |
| GreatSchools rating | 30 days | Annual update in fall |
| Crime index | 30 days | Monthly data releases |
| FEMA flood zone | 90 days | FIRM maps updated rarely |
| First Street fire/wind | 90 days | Annual model updates |
| AirNow annual AQI | 365 days | Annual EPA summary data |
| USGS earthquake PGA | indefinite | Seismic model updates every 5–6 years |
| Mapbox geocode | indefinite | Addresses don't move |
| Mortgage rate | 1 day | Weekly FRED update |

---

*All types are PostgreSQL. UUIDs generated with `gen_random_uuid()` (pgcrypto). Timestamps are UTC.*
