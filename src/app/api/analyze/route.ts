import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { fetchWithCache } from '@/lib/cache'
import { computeFinancials } from '@/lib/financial-model'
import { autoScenarioName } from '@/lib/scenario-name'
import type { Assumptions } from '@/types/analysis'

const DEFAULT_ASSUMPTIONS: Omit<Assumptions, 'purchase_price' | 'monthly_rent' | 'property_tax_monthly' | 'insurance_monthly'> = {
  down_payment_pct: 20,
  interest_rate: 7.0,
  loan_term_years: 30,
  vacancy_pct: 5,
  hoa_monthly: 0,
  maintenance_pct_annual: 1.0,
  property_mgmt_pct: 8.0,
  closing_cost_pct: 1.8,
  house_hack: false,
  house_hack_owner_pct: null,
  unit_rents: null,
}

export async function POST(request: Request) {
  let auth
  try {
    auth = await requireAuth()
  } catch (res) {
    return res as Response
  }

  const { user, supabase, profile } = auth

  // --- Free tier gate ---
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('user_id', user.id)
    .single() as { data: { tier: string } | null, error: unknown }

  const analyses_used = (profile as { analyses_used?: number })?.analyses_used ?? 0

  if (sub?.tier !== 'pro' && analyses_used >= 3) {
    return NextResponse.json({ error: 'free_limit_reached' }, { status: 402 })
  }

  // --- Parse body ---
  let body: { address: string; scenario_name?: string; assumptions?: Partial<Assumptions> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'validation_error', message: 'Invalid JSON body' }, { status: 400 })
  }

  const { address, scenario_name, assumptions: userAssumptions } = body
  if (!address?.trim()) {
    return NextResponse.json({ error: 'validation_error', message: 'address is required' }, { status: 400 })
  }

  // --- Step 1: Geocode ---
  let geocode: { lat: number; lng: number; full_address: string } | null = null
  try {
    const addressKey = normalizeAddressKey(address)
    geocode = await fetchWithCache(`mapbox:${addressKey}`, 99999, async () => {
      const token = process.env.MAPBOX_SECRET_TOKEN
      if (!token) throw new Error('MAPBOX_SECRET_TOKEN not set')
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&country=US&types=address&limit=1`
      const res = await fetch(url)
      const data = await res.json()
      const feature = data.features?.[0]
      if (!feature) return null
      return {
        lat: feature.center[1],
        lng: feature.center[0],
        full_address: feature.place_name,
      }
    })
  } catch (err) {
    console.error('Geocoding failed:', err)
  }

  // --- Step 2: Rentcast property fetch ---
  let rentcastData: RentcastProperty | null = null
  try {
    if (geocode) {
      const addressKey = normalizeAddressKey(address)
      rentcastData = await fetchWithCache(`rentcast:${addressKey}`, 7, async () => {
        const apiKey = process.env.RENTCAST_API_KEY
        if (!apiKey) throw new Error('RENTCAST_API_KEY not set')
        const url = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}&limit=1`
        const res = await fetch(url, { headers: { 'X-Api-Key': apiKey } })
        if (!res.ok) return null
        const data = await res.json()
        return data?.[0] ?? null
      })
    }
  } catch (err) {
    console.error('Rentcast fetch failed:', err)
  }

  // Rentcast miss → manual entry
  if (!rentcastData) {
    return NextResponse.json({
      needs_manual_entry: true,
      geocode,
      message: 'Property not found in Rentcast. Please enter details manually.',
    }, { status: 200 })
  }

  // --- Step 3: Get latest mortgage rate ---
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

  // --- Step 4: Build assumptions ---
  const purchase_price = rentcastData.price ?? rentcastData.listPrice ?? 0
  const monthly_rent = rentcastData.rentZestimate ?? rentcastData.rentEstimate ?? 0
  const property_tax_monthly = Math.round((rentcastData.propertyTaxRate ?? 0.012) * purchase_price / 12)
  const insurance_monthly = Math.round(purchase_price * 0.004 / 12)

  const assumptions: Assumptions = {
    ...DEFAULT_ASSUMPTIONS,
    ...userAssumptions,
    purchase_price,
    monthly_rent,
    property_tax_monthly,
    insurance_monthly,
    interest_rate: mortgageRate,
    down_payment_pct: userAssumptions?.down_payment_pct ?? DEFAULT_ASSUMPTIONS.down_payment_pct,
  }

  // --- Step 5: Get user tax profile ---
  const { data: taxProfile } = await supabase
    .from('user_profiles')
    .select('w2_income, tax_bracket, filing_status, state_tax_rate')
    .eq('id', user.id)
    .single() as { data: { w2_income: number | null; tax_bracket: number | null; filing_status: string | null; state_tax_rate: number | null } | null, error: unknown }

  // --- Step 6: Compute financials ---
  const results = computeFinancials(assumptions, {
    w2_income: taxProfile?.w2_income ?? null,
    tax_bracket: taxProfile?.tax_bracket ?? null,
    filing_status: taxProfile?.filing_status ?? null,
    state_tax_rate: taxProfile?.state_tax_rate ?? null,
  })

  // --- Step 7: Persist property ---
  const addressKey = normalizeAddressKey(address)
  const propertyPayload = {
    address_key: addressKey,
    full_address: geocode?.full_address ?? address,
    street: rentcastData.addressLine1 ?? null,
    city: rentcastData.city ?? null,
    state: rentcastData.state ?? null,
    zip: rentcastData.zipCode ?? null,
    lat: geocode?.lat ?? null,
    lng: geocode?.lng ?? null,
    property_type: mapPropertyType(rentcastData.propertyType),
    beds: rentcastData.bedrooms ?? null,
    baths: rentcastData.bathrooms ?? null,
    sqft: rentcastData.squareFootage ?? null,
    year_built: rentcastData.yearBuilt ?? null,
    list_price: rentcastData.price ?? rentcastData.listPrice ?? null,
    last_sold_price: rentcastData.lastSalePrice ?? null,
    last_sold_date: rentcastData.lastSaleDate ?? null,
    avm: rentcastData.estimatedValue ?? null,
    rent_estimate_mid: rentcastData.rentZestimate ?? rentcastData.rentEstimate ?? null,
    hoa_monthly: rentcastData.hoaFee ?? 0,
    property_tax_annual: Math.round(property_tax_monthly * 12),
    unit_count: rentcastData.units ?? 1,
    data_source: 'rentcast',
    fetched_at: new Date().toISOString(),
  }

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .upsert(propertyPayload, { onConflict: 'address_key' })
    .select('id')
    .single() as { data: { id: string } | null, error: unknown }

  if (propertyError || !property) {
    console.error('Property persist failed:', propertyError)
    return NextResponse.json({ error: 'internal', message: 'Failed to save property' }, { status: 500 })
  }

  // --- Step 8: Persist analysis ---
  const finalScenarioName = scenario_name?.trim() || autoScenarioName(assumptions)
  const verdictReason = buildVerdictReason(results.verdict, results)

  const { data: analysis, error: analysisError } = await supabase
    .from('saved_analyses')
    .insert({
      user_id: user.id,
      property_id: property.id,
      property_type: 'sfh',
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

  // --- Step 9: Increment free tier counter ---
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
    property: propertyPayload,
    results,
  })
}

// --- Helpers ---

function normalizeAddressKey(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function mapPropertyType(type: string | undefined): string {
  if (!type) return 'sfh'
  const t = type.toLowerCase()
  if (t.includes('single') || t === 'sfr') return 'sfh'
  if (t.includes('duplex') || t === '2') return 'duplex'
  if (t.includes('triplex') || t === '3') return 'triplex'
  if (t.includes('fourplex') || t === '4') return 'fourplex'
  if (t.includes('condo')) return 'condo'
  if (t.includes('townhouse') || t.includes('townhome')) return 'townhouse'
  return 'sfh'
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

// Rentcast API response shape (partial)
interface RentcastProperty {
  addressLine1?: string
  city?: string
  state?: string
  zipCode?: string
  propertyType?: string
  bedrooms?: number
  bathrooms?: number
  squareFootage?: number
  yearBuilt?: number
  price?: number
  listPrice?: number
  lastSalePrice?: number
  lastSaleDate?: string
  estimatedValue?: number
  rentZestimate?: number
  rentEstimate?: number
  propertyTaxRate?: number
  hoaFee?: number
  units?: number
}
