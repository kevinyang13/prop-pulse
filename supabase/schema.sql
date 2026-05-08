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
