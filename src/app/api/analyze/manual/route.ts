import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { computeFinancials } from '@/lib/financial-model'
import { autoScenarioName } from '@/lib/scenario-name'
import type { Assumptions } from '@/types/analysis'

const DEFAULT_ASSUMPTIONS = {
  down_payment_pct: 20,
  interest_rate: 7.0,
  loan_term_years: 30,
  vacancy_pct: 5,
  maintenance_pct_annual: 1.0,
  property_mgmt_pct: 8.0,
  closing_cost_pct: 1.8,
  house_hack: false,
  house_hack_owner_pct: null,
  unit_rents: null,
}

interface ManualProperty {
  list_price: number
  monthly_rent: number
  property_tax_annual: number
  hoa_monthly: number
  beds: number | null
  baths: number | null
  sqft: number | null
  year_built: number | null
  property_type: string
}

export async function POST(request: Request) {
  let auth
  try {
    auth = await requireAuth()
  } catch (res) {
    return res as Response
  }

  const { user, supabase, profile } = auth

  // Free tier gate
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('user_id', user.id)
    .single() as { data: { tier: string } | null, error: unknown }

  const analyses_used = (profile as { analyses_used?: number })?.analyses_used ?? 0

  if (sub?.tier !== 'pro' && analyses_used >= 3) {
    return NextResponse.json({ error: 'free_limit_reached' }, { status: 402 })
  }

  let body: { address: string; property: ManualProperty; scenario_name?: string; assumptions?: Partial<Assumptions> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'validation_error', message: 'Invalid JSON body' }, { status: 400 })
  }

  const { address, property, scenario_name, assumptions: userAssumptions } = body

  if (!address?.trim()) {
    return NextResponse.json({ error: 'validation_error', message: 'address is required' }, { status: 400 })
  }
  if (!property?.list_price || !property?.monthly_rent) {
    return NextResponse.json({ error: 'validation_error', message: 'list_price and monthly_rent are required' }, { status: 400 })
  }

  // Get latest mortgage rate
  let mortgageRate = DEFAULT_ASSUMPTIONS.interest_rate
  try {
    const { data: rate } = await supabase
      .from('mortgage_rates')
      .select('rate_30yr_fixed')
      .order('effective_date', { ascending: false })
      .limit(1)
      .single() as { data: { rate_30yr_fixed: number } | null, error: unknown }
    if (rate?.rate_30yr_fixed) mortgageRate = rate.rate_30yr_fixed
  } catch { /* use default */ }

  const property_tax_monthly = Math.round(property.property_tax_annual / 12)
  const insurance_monthly = Math.round(property.list_price * 0.004 / 12)

  const assumptions: Assumptions = {
    ...DEFAULT_ASSUMPTIONS,
    ...userAssumptions,
    purchase_price: property.list_price,
    monthly_rent: property.monthly_rent,
    property_tax_monthly,
    insurance_monthly,
    hoa_monthly: property.hoa_monthly ?? 0,
    interest_rate: mortgageRate,
  }

  // Get user tax profile
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

  // Persist property
  const addressKey = address.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-')

  const propertyPayload = {
    address_key: addressKey,
    full_address: address,
    street: null,
    city: null,
    state: null,
    zip: null,
    lat: null,
    lng: null,
    property_type: property.property_type ?? 'sfh',
    beds: property.beds,
    baths: property.baths,
    sqft: property.sqft,
    year_built: property.year_built,
    list_price: property.list_price,
    last_sold_price: null,
    last_sold_date: null,
    avm: null,
    rent_estimate_mid: property.monthly_rent,
    hoa_monthly: property.hoa_monthly ?? 0,
    property_tax_annual: property.property_tax_annual,
    unit_count: 1,
    data_source: 'manual',
    fetched_at: new Date().toISOString(),
  }

  const { data: savedProperty, error: propertyError } = await supabase
    .from('properties')
    .upsert(propertyPayload, { onConflict: 'address_key' })
    .select('id')
    .single() as { data: { id: string } | null, error: unknown }

  if (propertyError || !savedProperty) {
    console.error('Property persist failed:', propertyError)
    return NextResponse.json({ error: 'internal', message: 'Failed to save property' }, { status: 500 })
  }

  // Persist analysis
  const finalScenarioName = scenario_name?.trim() || autoScenarioName(assumptions)
  const verdictReason = buildVerdictReason(results.verdict, results)

  const { data: analysis, error: analysisError } = await supabase
    .from('saved_analyses')
    .insert({
      user_id: user.id,
      property_id: savedProperty.id,
      property_type: property.property_type ?? 'sfh',
      scenario_name: finalScenarioName,
      verdict: results.verdict,
      verdict_reason: verdictReason,
      assumptions,
      results,
    })
    .select('id')
    .single() as { data: { id: string } | null, error: unknown }

  if (analysisError || !analysis) {
    console.error('Analysis persist failed:', analysisError)
    return NextResponse.json({ error: 'internal', message: 'Failed to save analysis' }, { status: 500 })
  }

  // Increment free tier counter
  if (sub?.tier !== 'pro') {
    await supabase
      .from('user_profiles')
      .update({ analyses_used: analyses_used + 1 })
      .eq('id', user.id)
  }

  return NextResponse.json({
    analysis_id: analysis.id,
    verdict: results.verdict,
    verdict_reason: verdictReason,
    scenario_name: finalScenarioName,
    results,
  })
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
