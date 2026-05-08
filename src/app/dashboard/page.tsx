import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/layout/Nav'
import DashboardClient from './DashboardClient'
import type { AnalysisCard } from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rows } = await supabase
    .from('saved_analyses')
    .select(`
      id, scenario_name, verdict, verdict_reason, created_at, is_starred, notes,
      results, assumptions,
      properties ( full_address, city, state, property_type, list_price )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as { data: RawRow[] | null, error: unknown }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('analyses_used, w2_income')
    .eq('id', user.id)
    .single() as { data: { analyses_used: number; w2_income: number | null } | null, error: unknown }

  const analyses: AnalysisCard[] = (rows ?? []).map(r => ({
    id: r.id,
    scenario_name: r.scenario_name,
    verdict: r.verdict,
    verdict_reason: r.verdict_reason,
    created_at: r.created_at,
    assumptions: r.assumptions as AnalysisCard['assumptions'],
    results: r.results as AnalysisCard['results'],
    property: r.properties as AnalysisCard['property'],
  }))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav variant="post-auth" />
      <DashboardClient
        analyses={analyses}
        analysesUsed={profile?.analyses_used ?? 0}
        hasIncompleteProfile={!profile?.w2_income}
      />
    </div>
  )
}

interface RawRow {
  id: string
  scenario_name: string | null
  verdict: string
  verdict_reason: string | null
  created_at: string
  is_starred: boolean
  notes: string | null
  results: unknown
  assumptions: unknown
  properties: unknown
}
