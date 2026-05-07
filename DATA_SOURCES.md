# PropPulse — Data Source Analysis

**Last updated**: 2026-05-06  
**Status**: Pre-build research. Verify API terms and pricing before integration.

---

## Summary Table

| Source | Category | Cost at MVP | Cost at Scale | Caching TTL | Risk |
|--------|----------|-------------|---------------|-------------|------|
| Rentcast | Property + Rent | Free (50/mo) | $50–200/mo | 7 days | Medium |
| Walk Score API | Walkability | Free (5K/day) | Free | 30 days | Low |
| GreatSchools | Schools | Free (approval) | Free | 30 days | Medium |
| CrimeGrade.org | Crime | Free scrape | NeighborhoodScout $99/mo | 30 days | High |
| Mapbox | Geocoding | Free (50K/mo) | $0.50/1K after | 90 days | Low |
| FRED API | Mortgage rates | Free | Free | 1 day | Low |
| OpenStreetMap | Map tiles | Free | Free | Static | Low |
| Socrata | Infrastructure | Free | Free | 7 days | High |
| FEMA NFHL | Flood zones | Free | Free | 90 days | Low |
| First Street | Fire + wind risk | Free (limited) | $49/mo | 90 days | Medium |
| AirNow (EPA) | Air quality | Free | Free | 1 day | Low |
| USGS | Earthquake | Free | Free | 90 days | Low |

---

## 1. Rentcast

**What it provides**: Property details (beds, baths, sqft, year built, lot size, last sale), rent estimates (point estimate + range), comparable rentals, AVM (automated valuation).

**Endpoint pattern**:
```
GET https://api.rentcast.io/v1/properties?address=...
GET https://api.rentcast.io/v1/avm/rent/long-term?address=...
```

**Auth**: API key in header `X-Api-Key`.

**Cost**:
| Tier | Price | Calls/mo |
|------|-------|----------|
| Free | $0 | 50 |
| Starter | $50/mo | 1,000 |
| Growth | $200/mo | 5,000 |
| Enterprise | Custom | Unlimited |

At 3 free analyses/user and ~3 Rentcast calls/analysis (property + rent + comps), 50 free calls = ~16 new free-tier users/mo before upgrade is required.

**Coverage**: Strong in major metros (top 100 MSAs). Thin in rural markets and smaller cities. Rent estimates degrade outside top 50 metros.

**Rate limits**: None documented beyond monthly call cap. Requests are synchronous; p99 ~800ms.

**Caching strategy**: Cache full property response + rent estimate in Supabase by normalized address. TTL 7 days. Use cached data for all scenario recalcs — only re-hit API on new address submission.

**Limitations**:
- Free tier burns fast at scale; budget $50/mo from first paying user
- Rent estimates have ±15% error band in thin markets — surface confidence interval in UI
- AVM can lag recent price drops in fast-moving markets

**Fallback**: If Rentcast returns no data, prompt user for manual entry. Flag estimate as "user-supplied" in output.

---

## 2. Walk Score API

**What it provides**: Walk Score (0–100), Transit Score, Bike Score for any US address.

**Endpoint**:
```
GET https://api.walkscore.com/score?format=json&address=...&lat=...&lon=...&wsapikey=...
```

**Auth**: API key in query param.

**Cost**: Free for up to 5,000 calls/day with branding requirement ("Walk Score" attribution in UI). Commercial license required if removing attribution (~$500/mo).

**Coverage**: All US addresses. Quality varies — suburban/rural scores are less meaningful.

**Caching strategy**: Cache by lat/lng (rounded to 4 decimal places ≈ 11m grid). TTL 30 days. Scores change rarely.

**Limitations**:
- Must display Walk Score logo + link per terms of service
- Transit Score not available for all cities
- Score doesn't account for recent infrastructure changes

---

## 3. GreatSchools API

**What it provides**: School ratings (1–10 summary rating), school name, grades served, distance from address.

**Access**: Requires free API key via application at greatschools.org/gk/api. Approval typically 1–3 business days.

**Endpoint**:
```
GET https://api.greatschools.org/schools/nearby?key=...&state=CA&lat=...&lon=...&radius=2
```

**Cost**: Free for non-commercial / limited commercial use. Contact for high-volume.

**Coverage**: All US public schools. Private school data partial.

**Caching strategy**: Cache schools list by lat/lng grid cell. TTL 30 days. School ratings update annually in fall.

**Limitations**:
- Rating methodology has faced criticism for socioeconomic bias — display as one signal, not a primary verdict driver
- API occasionally returns stale data mid-year
- No API for private schools

**Alternatives**: Niche.com (scrape, fragile) — GreatSchools is most reliable free option.

---

## 4. Crime Data

**What it provides**: Crime index score or raw incident counts by address/zip.

**Options**:

| Source | Method | Cost | Quality |
|--------|--------|------|---------|
| CrimeGrade.org | HTML scrape | Free | Good |
| NeighborhoodScout | API | $99/mo | Excellent |
| SpotCrime | API | Free (limited) | Basic |
| FBI UCR / NIBRS | Direct download | Free | Raw — needs ETL |

**MVP approach**: Scrape CrimeGrade.org by zip code. Parse the letter grade (A–F) and index score. Scrapes are fragile — wrap in try/catch; show "data unavailable" gracefully.

**Post-revenue**: Migrate to NeighborhoodScout API for reliability and ToS compliance.

**Caching strategy**: Cache by zip code. TTL 30 days.

**Risk**: HIGH. CrimeGrade scraping violates ToS if they add one. Site structure changes break scraper silently. Mitigate by caching aggressively and monitoring for null returns.

**Fallback**: If crime data unavailable, omit card; do not fail the analysis.

---

## 5. Mapbox (Geocoding)

**What it provides**: Address → lat/lng, address normalization, autocomplete.

**Endpoint**:
```
GET https://api.mapbox.com/geocoding/v5/mapbox.places/{address}.json?access_token=...
```

**Cost**:
- Free: 50,000 geocoding calls/mo
- After: $0.50 per 1,000 calls

At 1 geocode per analysis, 50K free = 50K analyses/mo before any cost. Not a near-term concern.

**Alternatives**: Google Maps Geocoding ($5/1K), Nominatim/OSM (free, lower accuracy). Mapbox is best price/quality tradeoff.

**Caching strategy**: Cache normalized address → lat/lng indefinitely (addresses don't move).

**Note**: Mapbox token is public-side safe but should be scoped to geocoding only (no write permissions). Restrict token to your domain in Mapbox dashboard.

---

## 6. FRED API (Mortgage Rates)

**What it provides**: Current 30-year fixed mortgage rate (series `MORTGAGE30US`), updated weekly.

**Endpoint**:
```
GET https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&api_key=...&sort_order=desc&limit=1
```

**Auth**: Free API key, no approval required.

**Cost**: Free, no rate limits for reasonable use.

**Caching strategy**: Cache latest rate for 24 hours. Display "as of [date]" in UI. Pre-fill as default in assumptions panel — user can override.

**Limitations**: Weekly update cadence. Rate can lag real market by up to 7 days. Show disclaimer.

---

## 7. OpenStreetMap / Leaflet

**What it provides**: Map tiles, rendered map UI, POI data.

**Tile URL**: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`

**Cost**: Free. OSM tile servers have a [usage policy](https://operations.osmfoundation.org/policies/tiles/) — for production load, self-host tiles or use a tile CDN (Maptiler free tier: 100K tiles/mo).

**MVP**: Use OSM tiles directly. Switch to Maptiler or Mapbox tiles at scale for reliability and visual quality.

**Leaflet**: MIT license. Bundle with npm, not CDN, for production.

---

## 8. Socrata (City Infrastructure Projects)

**What it provides**: Building permits, infrastructure projects, zoning changes — city-issued open data.

**Access**: Each city has its own Socrata endpoint. No unified API — must query per city.

**Example endpoints**:
```
San Diego:  https://data.sandiegoca.gov/resource/...
LA:         https://data.lacity.org/resource/...
NYC:        https://data.cityofnewyork.us/resource/...
Chicago:    https://data.cityofchicago.org/resource/...
```

**Auth**: Anonymous read for most datasets. App token recommended to avoid throttling (free).

**Coverage**: ~200 US cities have Socrata portals. Data quality and schema vary wildly. Major projects (e.g., transit lines, stadiums) are often NOT in permit data — require manual curation.

**MVP strategy**: Manually curate top infrastructure projects for 8 launch metros (SD, LA, SF, NYC, Chicago, Seattle, Denver, Austin). Store in Supabase `infrastructure_projects` table with geo coordinates. Show as map pins + project cards. Do not attempt automated Socrata ingestion at MVP.

**Post-MVP**: Build Socrata ETL pipeline to auto-ingest large permits (>$1M value) as "potential projects" for analyst review.

**Risk**: HIGH for automated approach. Manual curation is slow but produces reliable, readable output.

---

## 9. FEMA National Flood Hazard Layer (NFHL)

**What it provides**: FEMA official flood zone designation (Zone X, AE, VE, etc.) for any US address.

**Endpoint**:
```
GET https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query
    ?geometry={lon},{lat}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects
    &outFields=FLD_ZONE,ZONE_SUBTY,DFIRM_ID&f=json
```

**Auth**: None required. Public ArcGIS REST service.

**Cost**: Free, no rate limits documented. Treat as public government API — add retry logic.

**Zone decoding**:
| Zone | Meaning | Flood insurance |
|------|---------|----------------|
| X | Minimal risk (outside 500-yr floodplain) | Not required |
| X (shaded) | Moderate risk (500-yr floodplain) | Not required but recommended |
| AE | High risk (100-yr floodplain, base flood elevation known) | **Required** for federally-backed mortgages |
| AO | High risk, shallow flooding | Required |
| VE | High risk, coastal wave action | Required + highest premiums |

**Caching strategy**: Cache by lat/lng (4 decimal places). TTL 90 days. FEMA updates FIRM maps infrequently (Letters of Map Amendment are rare).

**Limitations**: FIRM maps can lag real-world conditions by years. Some areas have outdated maps. Display source date in UI.

---

## 10. First Street Foundation — Fire & Wind Risk

**What it provides**: Fire Factor score (1–10), wildfire risk probability, wind risk score for US properties.

**Access**: Risk Factor API at riskfactor.com. Requires account + API key.

**Cost**:
| Tier | Price | Calls/mo |
|------|-------|----------|
| Free | $0 | 100/mo |
| Basic | $49/mo | 2,500 |
| Pro | $199/mo | 15,000 |

**Endpoint**:
```
GET https://api.riskfactor.com/v1/properties?address=...
```
Returns fire, flood, heat, wind risk scores in one call.

**Coverage**: All US addresses. Uses climate model projections + historical data.

**Caching strategy**: Cache by address hash. TTL 90 days. Risk scores are modeled annually.

**Limitations**:
- Modeled data — not the same as FEMA official designations
- Fire Factor correlates with Cal Fire VHFHSZ but is not equivalent
- Display "Modeled estimate" label; link to First Street methodology

**Alternative for fire (CA only)**: Cal Fire FHSZ viewer has a public WMS layer:
```
https://egis.fire.ca.gov/arcgis/rest/services/FRAP/fhsz/MapServer
```
Free, authoritative for CA but California only.

**MVP recommendation**: Use Cal Fire layer for CA properties (8 of 8 launch metros). Use First Street for non-CA metros. Long-term: standardize on First Street nationally.

---

## 11. AirNow API (EPA)

**What it provides**: Current and forecast AQI (Air Quality Index) by zip code or lat/lng. Annual average AQI by reporting area.

**Endpoint**:
```
GET https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=...&API_KEY=...
```

**Auth**: Free API key at airnow.gov. No approval needed.

**Cost**: Free. Rate limit: 500 calls/hour per key.

**AQI scale**:
| AQI | Category | Display |
|-----|----------|---------|
| 0–50 | Good | Green |
| 51–100 | Moderate | Yellow |
| 101–150 | Unhealthy for Sensitive Groups | Orange |
| 151–200 | Unhealthy | Red |
| 201–300 | Very Unhealthy | Purple |
| 301+ | Hazardous | Maroon |

**Caching strategy**: Current AQI cached 1 hour. For property analysis, use annual average — pull from EPA annual summary CSV (published yearly), store in Supabase by zip. This is more meaningful for investment decisions than a single day's reading.

**Limitations**: Monitoring station coverage gaps in rural areas. Wildfire smoke spikes are transient — annual avg may understate seasonal risk in CA/Pacific NW.

---

## 12. USGS Seismic Hazard

**What it provides**: Peak Ground Acceleration (PGA) and spectral acceleration values at any US lat/lng. Derived from the USGS National Seismic Hazard Model.

**Endpoint**:
```
GET https://earthquake.usgs.gov/ws/designmaps/asce7-16.json?latitude=...&longitude=...&riskCategory=II&siteClass=D&title=...
```

**Auth**: None. Public API.

**Cost**: Free.

**PGA risk tiers** (rough mapping):
| PGA (%g) | Risk tier | US regions |
|----------|-----------|-----------|
| < 0.10g | Low | Central/Eastern US |
| 0.10–0.30g | Moderate | Pacific NW inland, intermountain west |
| 0.30–0.60g | High | Pacific NW coast, CA inland |
| > 0.60g | Very High | Coastal CA, Seattle near faults |

**Caching strategy**: Cache by lat/lng (2 decimal places ≈ 1km grid). TTL indefinitely — seismic hazard maps update every 5–6 years.

**Limitations**: PGA is a probabilistic value (2% exceedance in 50 years), not a guarantee. Display as risk tier, not raw number, to avoid misinterpretation. Note: does NOT account for soil amplification (site class D assumed in query above — conservative).

---

## Caching Architecture

All external API responses stored in Supabase. Schema sketch:

```sql
CREATE TABLE data_cache (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key   text UNIQUE NOT NULL,   -- e.g. "rentcast:4821-oakwood-dr-san-diego-ca"
  source      text NOT NULL,          -- "rentcast" | "walkscore" | "fema_flood" | ...
  payload     jsonb NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  ttl_days    int NOT NULL
);

CREATE INDEX ON data_cache (cache_key);
CREATE INDEX ON data_cache (fetched_at);
```

Cache lookup: `WHERE cache_key = $1 AND fetched_at > now() - (ttl_days * interval '1 day')`.

Stale-while-revalidate: serve cached data immediately, trigger background refresh if age > 80% of TTL.

---

## Cost Projection by User Tier

Assumptions: 3 API calls per analysis (property, rent, neighborhood bundle), 30% of free users convert.

| Monthly Active Users | Rentcast | First Street | Other | Total |
|---------------------|----------|--------------|-------|-------|
| 0–50 (MVP) | $0 | $0 | $0 | $0 |
| 50–500 | $50 | $49 | $0 | ~$100 |
| 500–5K | $200 | $49 | $0 | ~$250 |
| 5K+ | $200–custom | $199 | ~$50 | ~$450+ |

At $7.99/mo with ~200 paying users, API costs are <10% of revenue. Primary cost risk is Rentcast at high volume.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| CrimeGrade scrape breaks | High | Medium | Graceful null; migrate to NeighborhoodScout early |
| Rentcast free tier burns fast | High | Low | Cache aggressively; upgrade to $50 tier early |
| First Street rate limit hit | Medium | Low | Cache 90 days; queue requests |
| FEMA API downtime | Low | Medium | Cache; show "data temporarily unavailable" |
| GreatSchools approval denied | Low | Low | Fall back to Niche.com scrape |
| Walk Score ToS violation | Low | Medium | Keep attribution visible; budget for commercial license |

---

*All API pricing and terms as of 2026-05-06. Verify before integration.*
