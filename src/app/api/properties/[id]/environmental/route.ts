import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchFloodZone } from '@/lib/fema-flood'
import { fetchEarthquakeHazard } from '@/lib/usgs-earthquake'
import { fetchAirNow } from '@/lib/airnow'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id: propertyId } = await params

  try { await requireAuth() } catch (res) { return res as Response }

  const supabase = createServiceClient()

  // Check DB cache (90-day TTL)
  const { data: existing } = await supabase
    .from('environmental_risks')
    .select('*')
    .eq('property_id', propertyId)
    .single() as { data: Record<string, unknown> | null, error: unknown }

  const staleThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const isStale = !existing || new Date(existing.fetched_at as string) < staleThreshold

  if (existing && !isStale) {
    return NextResponse.json(existing)
  }

  const { data: property } = await supabase
    .from('properties')
    .select('lat, lng, zip, state')
    .eq('id', propertyId)
    .single() as { data: { lat: number | null; lng: number | null; zip: string | null; state: string | null } | null, error: unknown }

  if (!property || !property.lat || !property.lng) {
    return NextResponse.json(existing ?? { property_id: propertyId }, { status: 200 })
  }

  // Parallel fetch all environmental data
  const [floodData, earthquakeData, airNowData] = await Promise.all([
    fetchFloodZone(property.lat, property.lng),
    fetchEarthquakeHazard(property.lat, property.lng),
    property.zip ? fetchAirNow(property.zip) : Promise.resolve({ aqi: null, category: null, reporting_area: null }),
  ])

  const aqiCategory = aqiCategoryFromName(airNowData.category)

  const record = {
    property_id: propertyId,
    flood_zone: floodData.flood_zone,
    flood_risk_level: floodData.flood_risk_level,
    flood_insurance_required: floodData.flood_insurance_required,
    aqi_annual_avg: airNowData.aqi,
    aqi_category: aqiCategory,
    aqi_monitoring_station: airNowData.reporting_area,
    earthquake_pga: earthquakeData.pga,
    earthquake_risk_level: earthquakeData.risk_level,
    fetched_at: new Date().toISOString(),
  }

  const { data: upserted } = await supabase
    .from('environmental_risks')
    .upsert(record, { onConflict: 'property_id' })
    .select()
    .single() as { data: Record<string, unknown> | null, error: unknown }

  return NextResponse.json(upserted ?? record)
}

function aqiCategoryFromName(name: string | null): string | null {
  if (!name) return null
  const map: Record<string, string> = {
    'Good': 'good',
    'Moderate': 'moderate',
    'Unhealthy for Sensitive Groups': 'unhealthy_sensitive',
    'Unhealthy': 'unhealthy',
    'Very Unhealthy': 'very_unhealthy',
    'Hazardous': 'hazardous',
  }
  return map[name] ?? 'moderate'
}
