import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Check soft delete
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('deleted_at, analyses_used')
    .eq('id', user.id)
    .single() as { data: { deleted_at: string | null; analyses_used: number } | null, error: unknown }

  if (profile?.deleted_at) {
    throw NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  return { user, supabase, profile }
}
