import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

interface Params { params: Promise<{ id: string }> }

// FRED metro Case-Shiller series (CBSA-level)
const METRO_FRED_SERIES: Record<string, string> = {
  'Los Angeles':   'LXXRNSA',
  'San Francisco': 'SFXRNSA',
  'San Diego':     'SDXRNSA',
  'Seattle':       'SEXRNSA',
  'Denver':        'DNXRNSA',
  'Phoenix':       'PHXRNSA',
  'Miami':         'MIAXRNSA',
  'Tampa':         'TPAXRNSA',
  'Atlanta':       'ATXRNSA',
  'Dallas':        'DAXRNSA',
  'Houston':       'HOUX',
  'Austin':        'ATNHPIUS12420Q',
  'New York':      'NYXRNSA',
  'Chicago':       'CHXRNSA',
  'Boston':        'BOXRNSA',
  'Washington':    'WDXRNSA',
  'Minneapolis':   'MNXRNSA',
  'Portland':      'POXRNSA',
  'Las Vegas':     'LVXRNSA',
  'Charlotte':     'CRXRNSA',
}

async function fetchFredSeries(seriesId: string): Promise<number[] | null> {
  try {
    const res = await fetch(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`,
      { next: { revalidate: 86400 } }
    )
    if (!res.ok) return null
    const text = await res.text()
    const lines = text.trim().split('\n').filter(l => !l.startsWith('DATE') && !l.includes('.'))
    const values = lines
      .map(l => parseFloat(l.split(',')[1]))
      .filter(v => !isNaN(v))
    return values.length >= 2 ? values : null
  } catch {
    return null
  }
}

function pctChange(values: number[], periodsBack: number): number | null {
  if (values.length < periodsBack + 1) return null
  const latest = values[values.length - 1]
  const prior = values[values.length - 1 - periodsBack]
  if (!prior) return null
  return ((latest - prior) / prior) * 100
}

// Rough degree-per-mile conversion for Haversine bounding box
function degreesBoundingBox(lat: number, lng: number, radiusMi: number) {
  const latDelta = radiusMi / 69
  const lngDelta = radiusMi / (69 * Math.cos((lat * Math.PI) / 180))
  return { minLat: lat - latDelta, maxLat: lat + latDelta, minLng: lng - lngDelta, maxLng: lng + lngDelta }
}

export async function GET(_req: Request, { params }: Params) {
  const { id: propertyId } = await params

  try { await requireAuth() } catch (res) { return res as Response }

  const supabase = createServiceClient()

  const { data: property } = await supabase
    .from('properties')
    .select('city, state, lat, lng')
    .eq('id', propertyId)
    .single() as { data: { city: string | null; state: string | null; lat: number | null; lng: number | null } | null, error: unknown }

  if (!property) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // --- Metro appreciation via FRED ---
  const city = property.city ?? ''
  const metroKey = Object.keys(METRO_FRED_SERIES).find(k => city.toLowerCase().includes(k.toLowerCase()))
  const seriesId = metroKey ? METRO_FRED_SERIES[metroKey] : 'CSUSHPISA' // national fallback
  const isNational = !metroKey

  // FRED CS monthly: 12 = 1yr, 60 = 5yr
  const values = await fetchFredSeries(seriesId)
  const appreciation_1yr = values ? pctChange(values, 12) : null
  const appreciation_5yr = values ? pctChange(values, 60) : null

  // --- Infrastructure projects near property ---
  let infraProjects: unknown[] = []
  if (property.lat && property.lng) {
    const bbox = degreesBoundingBox(property.lat, property.lng, 5)
    const { data: projects } = await supabase
      .from('infrastructure_projects')
      .select('id, name, description, lat, lng, investment_usd, impact_level, status, est_completion')
      .gte('lat', bbox.minLat)
      .lte('lat', bbox.maxLat)
      .gte('lng', bbox.minLng)
      .lte('lng', bbox.maxLng)
      .order('impact_level', { ascending: true })
      .limit(10) as { data: unknown[] | null, error: unknown }
    infraProjects = projects ?? []
  }

  return NextResponse.json({
    metro: metroKey ?? 'National',
    is_national: isNational,
    fred_series: seriesId,
    appreciation_1yr,
    appreciation_5yr,
    infra_projects: infraProjects,
  })
}
