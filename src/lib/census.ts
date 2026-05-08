// US Census Bureau ACS 5-year estimates
// Free API key: api.census.gov/data/key_signup.html

export interface CensusData {
  zip_code: string
  census_vintage: number
  population_total: number | null
  median_household_income: number | null
  median_age: number | null
  owner_occupied_units: number | null
  renter_occupied_units: number | null
  renter_ratio: number | null
  vacant_units: number | null
  total_housing_units: number | null
  vacancy_rate: number | null
  unemployed_count: number | null
  labor_force_count: number | null
  unemployment_rate: number | null
  college_educated_count: number | null
  college_educated_pct: number | null
  median_gross_rent: number | null
  median_home_value: number | null
  price_to_rent_ratio: number | null
  renter_demand_signal: 'strong' | 'mixed' | 'owner_dominated'
}

const VINTAGE = 2023  // Latest ACS 5-year release

// ACS variable codes:
// B01003_001E = total population
// B19013_001E = median household income
// B01002_001E = median age
// B25003_002E = owner-occupied units
// B25003_003E = renter-occupied units
// B25002_003E = vacant units
// B25002_001E = total housing units
// B23025_005E = unemployed
// B23025_003E = labor force
// B15003_022E = bachelor's degree (25+)
// B15003_001E = total population 25+
// B25064_001E = median gross rent
// B25077_001E = median home value

const VARS = [
  'B01003_001E', 'B19013_001E', 'B01002_001E',
  'B25003_002E', 'B25003_003E', 'B25002_003E', 'B25002_001E',
  'B23025_005E', 'B23025_003E',
  'B15003_022E', 'B15003_001E',
  'B25064_001E', 'B25077_001E',
].join(',')

export async function fetchCensus(zipCode: string): Promise<CensusData | null> {
  const key = process.env.CENSUS_API_KEY
  if (!key) return null

  const url = `https://api.census.gov/data/${VINTAGE}/acs/acs5?get=${VARS}&for=zip%20code%20tabulation%20area:${zipCode}&key=${key}`

  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) return null

  let rows: string[][]
  try {
    rows = await res.json()
  } catch {
    return null
  }

  if (!rows || rows.length < 2) return null

  const [header, values] = rows
  const get = (name: string): number | null => {
    const idx = header.indexOf(name)
    if (idx === -1) return null
    const v = Number(values[idx])
    return isNaN(v) || v < 0 ? null : v
  }

  const population = get('B01003_001E')
  const medianIncome = get('B19013_001E')
  const medianAge = get('B01002_001E')
  const ownerUnits = get('B25003_002E')
  const renterUnits = get('B25003_003E')
  const vacantUnits = get('B25002_003E')
  const totalHousingUnits = get('B25002_001E')
  const unemployed = get('B23025_005E')
  const laborForce = get('B23025_003E')
  const collegeDegree = get('B15003_022E')
  const pop25Plus = get('B15003_001E')
  const medianRent = get('B25064_001E')
  const medianHomeValue = get('B25077_001E')

  const totalOccupied = (ownerUnits ?? 0) + (renterUnits ?? 0)
  const renterRatio = totalOccupied > 0 && renterUnits != null ? renterUnits / totalOccupied : null
  const vacancyRate = totalHousingUnits != null && totalHousingUnits > 0 && vacantUnits != null ? vacantUnits / totalHousingUnits : null
  const unemploymentRate = laborForce != null && laborForce > 0 && unemployed != null ? unemployed / laborForce : null
  const collegePct = pop25Plus != null && pop25Plus > 0 && collegeDegree != null ? collegeDegree / pop25Plus : null
  const priceToRentRatio = medianHomeValue != null && medianRent != null && medianRent > 0 ? medianHomeValue / (medianRent * 12) : null

  let renterDemandSignal: 'strong' | 'mixed' | 'owner_dominated' = 'mixed'
  if (renterRatio != null && medianAge != null) {
    if (renterRatio > 0.40 && medianAge >= 26 && medianAge <= 46) renterDemandSignal = 'strong'
    else if (renterRatio < 0.25) renterDemandSignal = 'owner_dominated'
  }

  return {
    zip_code: zipCode,
    census_vintage: VINTAGE,
    population_total: population,
    median_household_income: medianIncome,
    median_age: medianAge,
    owner_occupied_units: ownerUnits,
    renter_occupied_units: renterUnits,
    renter_ratio: renterRatio,
    vacant_units: vacantUnits,
    total_housing_units: totalHousingUnits,
    vacancy_rate: vacancyRate,
    unemployed_count: unemployed,
    labor_force_count: laborForce,
    unemployment_rate: unemploymentRate,
    college_educated_count: collegeDegree,
    college_educated_pct: collegePct,
    median_gross_rent: medianRent,
    median_home_value: medianHomeValue,
    price_to_rent_ratio: priceToRentRatio,
    renter_demand_signal: renterDemandSignal,
  }
}
