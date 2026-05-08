import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchWalkScore } from '@/lib/walk-score'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id: propertyId } = await params

  try { await requireAuth() } catch (res) { return res as Response }

  const supabase = createServiceClient()

  // 1. Check DB cache (30-day TTL)
  const { data: existing } = await supabase
    .from('neighborhood_signals')
    .select('*')
    .eq('property_id', propertyId)
    .single() as { data: Record<string, unknown> | null, error: unknown }

  const staleThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const isStale = !existing || (existing.walk_score_fetched_at && new Date(existing.walk_score_fetched_at as string) < staleThreshold)

  if (existing && !isStale) {
    return NextResponse.json(existing)
  }

  // 2. Fetch property for lat/lng/address
  const { data: property } = await supabase
    .from('properties')
    .select('full_address, lat, lng, zip')
    .eq('id', propertyId)
    .single() as { data: { full_address: string; lat: number | null; lng: number | null; zip: string | null } | null, error: unknown }

  if (!property || !property.lat || !property.lng) {
    return NextResponse.json(existing ?? { property_id: propertyId }, { status: 200 })
  }

  // 3. Fetch Walk Score
  const walkData = await fetchWalkScore(property.full_address, property.lat, property.lng)

  // 4. Upsert
  const record = {
    property_id: propertyId,
    walk_score: walkData.walk_score,
    walk_score_label: walkData.walk_score_label,
    transit_score: walkData.transit_score,
    transit_score_label: walkData.transit_score_label,
    bike_score: walkData.bike_score,
    walk_score_fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data: upserted } = await supabase
    .from('neighborhood_signals')
    .upsert(record, { onConflict: 'property_id' })
    .select()
    .single() as { data: Record<string, unknown> | null, error: unknown }

  return NextResponse.json(upserted ?? record)
}
