// FEMA National Flood Hazard Layer — public ArcGIS REST API
// No API key required

export interface FloodData {
  flood_zone: string | null        // 'X', 'AE', 'VE', 'AO', 'X500'
  flood_risk_level: 'minimal' | 'moderate' | 'high' | 'coastal' | null
  flood_insurance_required: boolean | null
  raw_zone: string | null
}

export async function fetchFloodZone(lat: number, lng: number): Promise<FloodData> {
  const url = `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY,DFIRM_ID&f=json&inSR=4326`

  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) return nullFlood()

  let data: { features?: Array<{ attributes?: { FLD_ZONE?: string; ZONE_SUBTY?: string } }> }
  try {
    data = await res.json()
  } catch {
    return nullFlood()
  }

  const zone = data.features?.[0]?.attributes?.FLD_ZONE ?? null
  const subtype = data.features?.[0]?.attributes?.ZONE_SUBTY ?? null

  if (!zone) return { flood_zone: 'X', flood_risk_level: 'minimal', flood_insurance_required: false, raw_zone: null }

  // Normalize zone
  let normalizedZone = zone
  if (zone === 'X' && subtype?.includes('0.2 PCT')) normalizedZone = 'X500'

  const riskLevel = floodRiskLevel(zone)
  const insuranceRequired = ['AE', 'VE', 'AO', 'AH', 'A', 'A99'].includes(zone)

  return {
    flood_zone: normalizedZone,
    flood_risk_level: riskLevel,
    flood_insurance_required: insuranceRequired,
    raw_zone: zone,
  }
}

function floodRiskLevel(zone: string): 'minimal' | 'moderate' | 'high' | 'coastal' {
  if (zone === 'VE' || zone === 'V') return 'coastal'
  if (['AE', 'AO', 'AH', 'A', 'A99'].includes(zone)) return 'high'
  if (zone === 'X' || zone === 'B') return 'minimal'  // X shaded is still minimal per product decision
  return 'moderate'
}

function nullFlood(): FloodData {
  return { flood_zone: null, flood_risk_level: null, flood_insurance_required: null, raw_zone: null }
}
