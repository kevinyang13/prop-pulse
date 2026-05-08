import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/layout/Nav'
import ResultsClient from './ResultsClient'
import type { Results, Assumptions } from '@/types/analysis'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ResultsPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: analysis } = await supabase
    .from('saved_analyses')
    .select(`
      id, property_id, scenario_name, verdict, verdict_reason, property_type, assumptions, results,
      properties ( full_address, city, state, beds, baths, sqft, year_built,
                   list_price, rent_estimate_mid, hoa_monthly, property_tax_annual, unit_count )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single() as { data: AnalysisRow | null, error: unknown }

  if (!analysis) notFound()

  const { data: taxProfile } = await supabase
    .from('user_profiles')
    .select('w2_income, tax_bracket, filing_status, state_tax_rate')
    .eq('id', user.id)
    .single() as { data: TaxProfileRow | null, error: unknown }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav variant="post-auth" />
      <ResultsClient
        analysisId={analysis.id}
        propertyId={analysis.property_id}
        initialScenarioName={analysis.scenario_name}
        initialPropertyType={analysis.property_type ?? 'sfh'}
        initialAssumptions={analysis.assumptions as Assumptions}
        initialResults={analysis.results as Results}
        prop={analysis.properties as PropertyRow | null}
        taxProfile={{
          w2_income: taxProfile?.w2_income ?? null,
          tax_bracket: taxProfile?.tax_bracket ?? null,
          filing_status: taxProfile?.filing_status ?? null,
          state_tax_rate: taxProfile?.state_tax_rate ?? null,
        }}
      />
    </div>
  )
}

interface AnalysisRow {
  id: string
  property_id: string
  scenario_name: string | null
  verdict: string
  verdict_reason: string | null
  property_type: string | null
  assumptions: unknown
  results: unknown
  properties: unknown
}

interface PropertyRow {
  full_address: string
  city: string | null
  state: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  year_built: number | null
  list_price: number | null
  rent_estimate_mid: number | null
  hoa_monthly: number | null
  property_tax_annual: number | null
  unit_count: number | null
}

interface TaxProfileRow {
  w2_income: number | null
  tax_bracket: number | null
  filing_status: string | null
  state_tax_rate: number | null
}
