// USGS National Seismic Hazard Model
// Free public API, no key required

export interface EarthquakeData {
  pga: number | null              // Peak ground acceleration (g), 2% in 50 years
  risk_level: 'low' | 'moderate' | 'high' | 'very_high' | null
}

export async function fetchEarthquakeHazard(lat: number, lng: number): Promise<EarthquakeData> {
  // USGS Design Maps API — ASCE 7-22 hazard values
  const url = `https://earthquake.usgs.gov/ws/designmaps/asce7-22.json?latitude=${lat}&longitude=${lng}&riskCategory=III&siteClass=D&title=PropPulse`

  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) return { pga: null, risk_level: null }

  let data: { output?: { data?: { pgauh?: number } } }
  try {
    data = await res.json()
  } catch {
    return { pga: null, risk_level: null }
  }

  const pga = data.output?.data?.pgauh ?? null
  if (pga == null) return { pga: null, risk_level: null }

  const risk_level = pgaToRiskLevel(pga)
  return { pga, risk_level }
}

function pgaToRiskLevel(pga: number): 'low' | 'moderate' | 'high' | 'very_high' {
  if (pga < 0.10) return 'low'
  if (pga < 0.25) return 'moderate'
  if (pga < 0.50) return 'high'
  return 'very_high'
}
