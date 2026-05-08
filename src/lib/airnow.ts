// AirNow EPA API — https://docs.airnowapi.org/
// No attribution required, free

export interface AirNowData {
  aqi: number | null
  category: string | null   // 'Good', 'Moderate', etc.
  reporting_area: string | null
}

export async function fetchAirNow(zipCode: string): Promise<AirNowData> {
  const key = process.env.AIRNOW_API_KEY
  if (!key) return { aqi: null, category: null, reporting_area: null }

  const url = `https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=${zipCode}&distance=25&API_KEY=${key}`

  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) return { aqi: null, category: null, reporting_area: null }

  const data: Array<{ AQI: number; Category: { Name: string }; ReportingArea: string }> = await res.json()
  if (!data || data.length === 0) return { aqi: null, category: null, reporting_area: null }

  // Use highest AQI reading across pollutants
  const worst = data.reduce((max, obs) => obs.AQI > max.AQI ? obs : max, data[0])

  return {
    aqi: worst.AQI,
    category: worst.Category.Name,
    reporting_area: worst.ReportingArea,
  }
}
