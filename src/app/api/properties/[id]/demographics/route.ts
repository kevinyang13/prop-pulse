import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchCensus } from '@/lib/census'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id: propertyId } = await params

  try { await requireAuth() } catch (res) { return res as Response }

  const supabase = createServiceClient()

  // Check DB cache (180-day TTL)
  const { data: existing } = await supabase
    .from('location_demographics')
    .select('*')
    .eq('property_id', propertyId)
    .single() as { data: Record<string, unknown> | null, error: unknown }

  const staleThreshold = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
  const isStale = !existing || new Date(existing.fetched_at as string) < staleThreshold

  if (existing && !isStale) {
    return NextResponse.json(existing)
  }

  const { data: property } = await supabase
    .from('properties')
    .select('zip')
    .eq('id', propertyId)
    .single() as { data: { zip: string | null } | null, error: unknown }

  if (!property?.zip) {
    return NextResponse.json(existing ?? { property_id: propertyId }, { status: 200 })
  }

  const census = await fetchCensus(property.zip)
  if (!census) {
    return NextResponse.json(existing ?? { property_id: propertyId }, { status: 200 })
  }

  const record = {
    property_id: propertyId,
    ...census,
    fetched_at: new Date().toISOString(),
  }

  const { data: upserted } = await supabase
    .from('location_demographics')
    .upsert(record, { onConflict: 'property_id' })
    .select()
    .single() as { data: Record<string, unknown> | null, error: unknown }

  return NextResponse.json(upserted ?? record)
}
