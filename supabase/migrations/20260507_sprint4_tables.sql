-- Sprint 4 migration: neighborhood_signals, environmental_risks,
-- location_demographics, infrastructure_projects
-- Run in Supabase SQL Editor as a one-time migration.

-- ============================================================
-- neighborhood_signals
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
-- environmental_risks
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
-- location_demographics
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
-- infrastructure_projects
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
