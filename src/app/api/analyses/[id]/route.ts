import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { computeFinancials } from '@/lib/financial-model'
import type { Assumptions } from '@/types/analysis'

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params

  let auth
  try {
    auth = await requireAuth()
  } catch (res) {
    return res as Response
  }

  const { user, supabase } = auth

  let body: { assumptions: Assumptions; scenario_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { assumptions, scenario_name } = body

  // Verify ownership
  const { data: existing } = await supabase
    .from('saved_analyses')
    .select('id, property_type')
    .eq('id', id)
    .eq('user_id', user.id)
    .single() as { data: { id: string; property_type: string } | null, error: unknown }

  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Recompute with latest model + user's current tax profile
  const { data: taxProfile } = await supabase
    .from('user_profiles')
    .select('w2_income, tax_bracket, filing_status, state_tax_rate')
    .eq('id', user.id)
    .single() as { data: { w2_income: number | null; tax_bracket: number | null; filing_status: string | null; state_tax_rate: number | null } | null, error: unknown }

  const results = computeFinancials(assumptions, {
    w2_income: taxProfile?.w2_income ?? null,
    tax_bracket: taxProfile?.tax_bracket ?? null,
    filing_status: taxProfile?.filing_status ?? null,
    state_tax_rate: taxProfile?.state_tax_rate ?? null,
  })

  const verdictReason = buildVerdictReason(results.verdict, results)

  const { error } = await supabase
    .from('saved_analyses')
    .update({
      assumptions,
      results,
      verdict: results.verdict,
      verdict_reason: verdictReason,
      ...(scenario_name != null ? { scenario_name } : {}),
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Analysis update failed:', error)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  return NextResponse.json({ verdict: results.verdict, verdict_reason: verdictReason, results })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params

  let auth
  try {
    auth = await requireAuth()
  } catch (res) {
    return res as Response
  }

  const { user, supabase } = auth

  const { error } = await supabase
    .from('saved_analyses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Analysis delete failed:', error)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}

function buildVerdictReason(verdict: string, results: ReturnType<typeof computeFinancials>): string {
  const coc = results.cash_on_cash_return
  const cf = results.monthly_cashflow
  const pal = results.passive_loss_status
  if (verdict === 'GO') {
    return `${coc.toFixed(1)}% COC with $${cf.toLocaleString()}/mo cashflow. ${pal === 'full' ? 'Full PAL deduction boosts tax-adjusted return to ' + results.tax_adjusted_coc.toFixed(1) + '%.' : ''}`
  }
  if (verdict === 'CAUTION') {
    return `Marginal cashflow ($${cf.toLocaleString()}/mo). ${coc.toFixed(1)}% COC is below the 6% target. Evaluate closely before committing.`
  }
  return `Negative cashflow ($${cf.toLocaleString()}/mo). Does not pencil at current assumptions.`
}
