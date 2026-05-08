-- PropPulse schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- user_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id                      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                   text NOT NULL,
  full_name               text,
  w2_income               integer,
  tax_bracket             numeric(4,2) CHECK (tax_bracket IN (0.10,0.12,0.22,0.24,0.32,0.35,0.37)),
  filing_status           text CHECK (filing_status IN ('single','married_joint','married_separate','head_of_household')),
  state                   char(2),
  state_tax_rate          numeric(4,2),
  liquid_cash             integer,
  default_down_pct        numeric(4,1) DEFAULT 20.0,
  analyses_used           integer NOT NULL DEFAULT 0,
  onboarding_complete     boolean NOT NULL DEFAULT false,
  tos_accepted_at         timestamptz,
  tos_version             text DEFAULT '1.0',
  marketing_emails_opt_in boolean NOT NULL DEFAULT true,
  analytics_consent_at    timestamptz,
  deleted_at              timestamptz,
  last_active_at          timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- properties
-- ============================================================
CREATE TABLE IF NOT EXISTS properties (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_key           text UNIQUE NOT NULL,
  full_address          text NOT NULL,
  street                text,
  city                  text,
  state                 char(2),
  zip                   char(5),
  lat                   numeric(9,6),
  lng                   numeric(9,6),
  property_type         text CHECK (property_type IN ('sfh','duplex','triplex','fourplex','condo','townhouse')),
  beds                  smallint,
  baths                 numeric(3,1),
  sqft                  integer,
  lot_size_sqft         integer,
  year_built            smallint,
  garage                text,
  parking               text,
  list_price            integer,
  last_sold_price       integer,
  last_sold_date        date,
  avm                   integer,
  rent_estimate_low     integer,
  rent_estimate_mid     integer,
  rent_estimate_high    integer,
  rent_estimate_confidence text CHECK (rent_estimate_confidence IN ('high','medium','low')),
  hoa_monthly           integer DEFAULT 0,
  property_tax_annual   integer,
  unit_count            smallint DEFAULT 1,
  laundry               text,
  rentcast_id           text,
  data_source           text NOT NULL DEFAULT 'rentcast',
  fetched_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS properties_zip_idx ON properties (zip);
CREATE INDEX IF NOT EXISTS properties_latlng_idx ON properties (lat, lng);
CREATE INDEX IF NOT EXISTS properties_fetched_at_idx ON properties (fetched_at);

-- ============================================================
-- saved_analyses
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_analyses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id     uuid NOT NULL REFERENCES properties(id),
  property_type   text NOT NULL CHECK (property_type IN ('sfh','mfu')),
  scenario_name   text,
  verdict         text NOT NULL CHECK (verdict IN ('GO','CAUTION','PASS')),
  verdict_reason  text,
  assumptions     jsonb NOT NULL,
  results         jsonb NOT NULL,
  notes           text,
  is_starred      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_analyses_user_id_idx ON saved_analyses (user_id);
CREATE INDEX IF NOT EXISTS saved_analyses_property_id_idx ON saved_analyses (property_id);
CREATE INDEX IF NOT EXISTS saved_analyses_user_created_idx ON saved_analyses (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS saved_analyses_starred_idx ON saved_analyses (user_id) WHERE is_starred = true;

-- ============================================================
-- subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier                    text NOT NULL CHECK (tier IN ('free','pro')) DEFAULT 'free',
  stripe_customer_id      text UNIQUE,
  stripe_subscription_id  text UNIQUE,
  stripe_price_id         text,
  status                  text CHECK (status IN ('active','canceled','past_due','trialing','incomplete')),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Trigger: auto-create free subscription on signup
CREATE OR REPLACE FUNCTION handle_new_subscription()
RETURNS trigger AS $$
BEGIN
  INSERT INTO subscriptions (user_id, tier)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_sub ON auth.users;
CREATE TRIGGER on_auth_user_created_sub
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_subscription();

-- ============================================================
-- property_searches
-- ============================================================
CREATE TABLE IF NOT EXISTS property_searches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_query         text NOT NULL,
  resolved_address  text,
  property_id       uuid REFERENCES properties(id),
  resolved          boolean NOT NULL DEFAULT false,
  searched_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_searches_user_idx ON property_searches (user_id, searched_at DESC);

-- ============================================================
-- data_cache
-- ============================================================
CREATE TABLE IF NOT EXISTS data_cache (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key   text UNIQUE NOT NULL,
  source      text NOT NULL,
  payload     jsonb NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  ttl_days    smallint NOT NULL,
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS data_cache_expires_at_idx ON data_cache (expires_at);
CREATE INDEX IF NOT EXISTS data_cache_source_idx ON data_cache (source, fetched_at);

-- ============================================================
-- mortgage_rates
-- ============================================================
CREATE TABLE IF NOT EXISTS mortgage_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_30yr_fixed numeric(4,2) NOT NULL,
  rate_15yr_fixed numeric(4,2),
  effective_date  date UNIQUE NOT NULL,
  fetched_at      timestamptz NOT NULL DEFAULT now()
);

-- Seed one rate so the API doesn't fall back to hardcoded default
INSERT INTO mortgage_rates (rate_30yr_fixed, rate_15yr_fixed, effective_date)
VALUES (7.0, 6.5, CURRENT_DATE)
ON CONFLICT (effective_date) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own profile"   ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- saved_analyses
ALTER TABLE saved_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users CRUD own analyses"  ON saved_analyses FOR ALL USING (auth.uid() = user_id);

-- property_searches
ALTER TABLE property_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users CRUD own searches" ON property_searches FOR ALL USING (auth.uid() = user_id);

-- subscriptions (read only; writes via service_role)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- properties: public read, service_role write
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read properties" ON properties FOR SELECT USING (true);
CREATE POLICY "service role write properties" ON properties FOR ALL USING (auth.role() = 'service_role');

-- data_cache: service_role only
ALTER TABLE data_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only cache" ON data_cache FOR ALL USING (auth.role() = 'service_role');

-- mortgage_rates: public read
ALTER TABLE mortgage_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read rates" ON mortgage_rates FOR SELECT USING (true);

-- ============================================================
-- SPRINT 4: neighborhood_signals
-- ============================================================
CREATE TABLE IF NOT EXISTS neighborhood_signals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id             uuid UNIQUE NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  walk_score              smallint CHECK (walk_score BETWEEN 0 AND 100),
  walk_score_label        text,
  transit_score           smallint CHECK (transit_score BETWEEN 0 AND 100),
  transit_score_label     text,
  bike_score              smallint CHECK (bike_score BETWEEN 0 AND 100),
  school_rating           numeric(3,1),
  school_name             text,
  school_distance_mi      numeric(4,2),
  crime_index             smallint,
  crime_grade             char(2),
  crime_vs_city_avg       text CHECK (crime_vs_city_avg IN ('above','below','at')),
  infra_project_count_2mi smallint DEFAULT 0,
  walk_score_fetched_at   timestamptz,
  schools_fetched_at      timestamptz,
  crime_fetched_at        timestamptz,
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS neighborhood_signals_property_idx ON neighborhood_signals (property_id);
ALTER TABLE neighborhood_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read neighborhood" ON neighborhood_signals FOR SELECT USING (true);
CREATE POLICY "service role write neighborhood" ON neighborhood_signals FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service role update neighborhood" ON neighborhood_signals FOR UPDATE USING (auth.role() = 'service_role');

-- ============================================================
-- SPRINT 4: environmental_risks
-- ============================================================
CREATE TABLE IF NOT EXISTS environmental_risks (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id                     uuid UNIQUE NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  fire_risk_score                 smallint,
  fire_risk_level                 text CHECK (fire_risk_level IN ('minimal','low','moderate','high','severe')),
  fire_zone_label                 text,
  fire_data_source                text CHECK (fire_data_source IN ('calfire','first_street','none')),
  fire_insurance_impact_monthly   integer,
  flood_zone                      text,
  flood_risk_level                text CHECK (flood_risk_level IN ('minimal','moderate','high','coastal')),
  flood_insurance_required        boolean,
  flood_firm_date                 date,
  aqi_annual_avg                  smallint,
  aqi_category                    text CHECK (aqi_category IN ('good','moderate','unhealthy_sensitive','unhealthy','very_unhealthy','hazardous')),
  aqi_monitoring_station          text,
  wind_zone                       text,
  wind_risk_level                 text CHECK (wind_risk_level IN ('low','moderate','high','hurricane')),
  wind_design_speed_mph           smallint,
  earthquake_pga                  numeric(5,3),
  earthquake_risk_level           text CHECK (earthquake_risk_level IN ('low','moderate','high','very_high')),
  insurance_total_impact_monthly  integer,
  fetched_at                      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS environmental_risks_property_idx ON environmental_risks (property_id);
ALTER TABLE environmental_risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read env" ON environmental_risks FOR SELECT USING (true);
CREATE POLICY "service role write env" ON environmental_risks FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service role update env" ON environmental_risks FOR UPDATE USING (auth.role() = 'service_role');

-- ============================================================
-- SPRINT 4: location_demographics
-- ============================================================
CREATE TABLE IF NOT EXISTS location_demographics (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id             uuid UNIQUE NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  zip_code                char(5) NOT NULL,
  census_vintage          smallint NOT NULL,
  population_total        integer,
  median_household_income integer,
  median_age              numeric(4,1),
  owner_occupied_units    integer,
  renter_occupied_units   integer,
  renter_ratio            numeric(5,4),
  vacant_units            integer,
  total_housing_units     integer,
  vacancy_rate            numeric(5,4),
  unemployed_count        integer,
  labor_force_count       integer,
  unemployment_rate       numeric(5,4),
  college_educated_count  integer,
  college_educated_pct    numeric(5,4),
  median_gross_rent       integer,
  median_home_value       integer,
  price_to_rent_ratio     numeric(6,2),
  renter_demand_signal    text CHECK (renter_demand_signal IN ('strong','mixed','owner_dominated')),
  fetched_at              timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS location_demographics_property_idx ON location_demographics (property_id);
CREATE INDEX IF NOT EXISTS location_demographics_zip_idx ON location_demographics (zip_code);
ALTER TABLE location_demographics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read demo" ON location_demographics FOR SELECT USING (true);
CREATE POLICY "service role write demo" ON location_demographics FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service role update demo" ON location_demographics FOR UPDATE USING (auth.role() = 'service_role');

-- ============================================================
-- SPRINT 4: infrastructure_projects
-- ============================================================
CREATE TABLE IF NOT EXISTS infrastructure_projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metro           text NOT NULL,
  name            text NOT NULL,
  description     text,
  lat             numeric(9,6) NOT NULL,
  lng             numeric(9,6) NOT NULL,
  investment_usd  bigint,
  impact_level    text CHECK (impact_level IN ('high','medium','low')) DEFAULT 'medium',
  status          text CHECK (status IN ('planned','under_construction','completed')) DEFAULT 'planned',
  est_completion  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS infra_projects_metro_idx ON infrastructure_projects (metro);
ALTER TABLE infrastructure_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read infra" ON infrastructure_projects FOR SELECT USING (true);
CREATE POLICY "service role write infra" ON infrastructure_projects FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
