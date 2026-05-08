'use client'

import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { computeFinancials } from '@/lib/financial-model'
import type { Assumptions, Results, UnitRent } from '@/types/analysis'

const PropertyMap = lazy(() => import('@/components/map/PropertyMap'))

interface TaxProfile {
  w2_income: number | null
  tax_bracket: number | null
  filing_status: string | null
  state_tax_rate: number | null
}

interface NeighborhoodData {
  walk_score: number | null
  walk_score_label: string | null
  transit_score: number | null
  bike_score: number | null
  school_rating: number | null
  crime_index: number | null
  crime_grade: string | null
  crime_vs_city_avg: string | null
  infra_project_count_2mi: number | null
}

interface EnvironmentalData {
  flood_zone: string | null
  flood_risk_level: string | null
  flood_insurance_required: boolean | null
  aqi_annual_avg: number | null
  aqi_category: string | null
  aqi_monitoring_station: string | null
  earthquake_pga: number | null
  earthquake_risk_level: string | null
  fire_risk_level: string | null
  fire_zone_label: string | null
  fire_insurance_impact_monthly: number | null
  wind_zone: string | null
  wind_risk_level: string | null
  wind_design_speed_mph: number | null
  insurance_total_impact_monthly: number | null
}

interface InfraProject {
  id: string
  name: string
  description: string | null
  investment_usd: number | null
  impact_level: 'high' | 'medium' | 'low'
  status: 'planned' | 'under_construction' | 'completed'
  est_completion: string | null
}

interface EquityData {
  metro: string
  is_national: boolean
  fred_series: string
  appreciation_1yr: number | null
  appreciation_5yr: number | null
  infra_projects: InfraProject[]
}

interface DemographicsData {
  zip_code: string | null
  census_vintage: number | null
  population_total: number | null
  median_household_income: number | null
  median_age: number | null
  renter_occupied_units: number | null
  owner_occupied_units: number | null
  renter_ratio: number | null
  vacant_units: number | null
  total_housing_units: number | null
  vacancy_rate: number | null
  unemployment_rate: number | null
  college_educated_pct: number | null
  median_gross_rent: number | null
  median_home_value: number | null
  price_to_rent_ratio: number | null
  renter_demand_signal: string | null
}

interface PropertyData {
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
  lat: number | null
  lng: number | null
}

interface Props {
  analysisId: string
  propertyId: string
  initialScenarioName: string | null
  initialPropertyType: string
  initialAssumptions: Assumptions
  initialResults: Results
  prop: PropertyData | null
  taxProfile: TaxProfile
}

const PROPERTY_TYPES = ['sfh', 'condo', 'townhouse', 'duplex', 'triplex', 'fourplex'] as const
const UNIT_COUNTS: Record<string, number> = { duplex: 2, triplex: 3, fourplex: 4 }
const MULTI_UNIT_TYPES = new Set(['duplex', 'triplex', 'fourplex'])

export default function ResultsClient({
  analysisId,
  propertyId,
  initialScenarioName,
  initialPropertyType,
  initialAssumptions,
  initialResults,
  prop,
  taxProfile,
}: Props) {
  const router = useRouter()
  const [assumptions, setAssumptions] = useState<Assumptions>(initialAssumptions)
  const [propertyType, setPropertyType] = useState(initialPropertyType)
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [assumptionsOpen, setAssumptionsOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [neighborhood, setNeighborhood] = useState<NeighborhoodData | null>(null)
  const [envData, setEnvData] = useState<EnvironmentalData | null>(null)
  const [demographics, setDemographics] = useState<DemographicsData | null>(null)
  const [equityData, setEquityData] = useState<EquityData | null>(null)
  const [loadingNbh, setLoadingNbh] = useState(true)
  const [loadingEnv, setLoadingEnv] = useState(true)
  const [loadingDemo, setLoadingDemo] = useState(true)
  const [loadingEquity, setLoadingEquity] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/properties/${propertyId}/neighborhood`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/properties/${propertyId}/environmental`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/properties/${propertyId}/demographics`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/properties/${propertyId}/equity`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([nbh, env, demo, equity]) => {
      setNeighborhood(nbh)
      setEnvData(env)
      setDemographics(demo)
      setEquityData(equity)
      setLoadingNbh(false)
      setLoadingEnv(false)
      setLoadingDemo(false)
      setLoadingEquity(false)
    })
  }, [propertyId])

  const results: Results = useMemo(
    () => computeFinancials(assumptions, taxProfile),
    [assumptions, taxProfile]
  )

  const isMultiUnit = MULTI_UNIT_TYPES.has(propertyType)
  const unitCount = UNIT_COUNTS[propertyType] ?? 1

  // Unit rent strings (controlled inputs)
  const [unitRentInputs, setUnitRentInputs] = useState<string[]>(() => {
    if (initialAssumptions.unit_rents && initialAssumptions.unit_rents.length > 0) {
      return initialAssumptions.unit_rents.map(u => String(u.monthly_rent))
    }
    return Array(4).fill('')
  })

  function markDirty() {
    setIsDirty(true)
    setSaveStatus('idle')
  }

  const updateAssumption = useCallback(<K extends keyof Assumptions>(key: K, value: Assumptions[K]) => {
    setAssumptions(prev => ({ ...prev, [key]: value }))
    markDirty()
  }, [])

  function handlePropertyTypeChange(newType: string) {
    setPropertyType(newType)
    markDirty()

    const newUnitCount = UNIT_COUNTS[newType] ?? 1
    if (newUnitCount > 1) {
      // Split current monthly_rent evenly across units as default
      const perUnit = Math.round(assumptions.monthly_rent / newUnitCount)
      const newUnitRents: UnitRent[] = Array.from({ length: newUnitCount }, (_, i) => ({
        unit: `Unit ${i + 1}`,
        monthly_rent: perUnit,
        status: 'occupied' as const,
      }))
      setUnitRentInputs(prev => {
        const merged = newUnitRents.map((u, i) => ({ ...u, monthly_rent: Number(prev[i]) || perUnit }))
        return merged.map(u => String(u.monthly_rent))
      })
      setAssumptions(prev => ({
        ...prev,
        unit_rents: newUnitRents,
        monthly_rent: newUnitRents.reduce((s, u) => s + u.monthly_rent, 0),
      }))
      // keep newInputs consistent
      setUnitRentInputs(Array.from({ length: newUnitCount }, (_, i) => {
        const existing = Number(unitRentInputs[i])
        return String(existing || perUnit)
      }))
    } else {
      // Clear unit rents, keep current monthly_rent
      setAssumptions(prev => ({ ...prev, unit_rents: null }))
    }
  }

  function handleUnitRentChange(index: number, raw: string) {
    setUnitRentInputs(prev => {
      const next = [...prev]
      next[index] = raw
      return next
    })
    markDirty()

    const newUnitRents: UnitRent[] = Array.from({ length: unitCount }, (_, i) => ({
      unit: assumptions.unit_rents?.[i]?.unit ?? `Unit ${i + 1}`,
      monthly_rent: i === index ? (Number(raw) || 0) : (Number(unitRentInputs[i]) || 0),
      status: assumptions.unit_rents?.[i]?.status ?? ('occupied' as const),
    }))
    const total = newUnitRents.reduce((s, u) => s + u.monthly_rent, 0)
    setAssumptions(prev => ({ ...prev, unit_rents: newUnitRents, monthly_rent: total }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveStatus('idle')
    try {
      const res = await fetch(`/api/analyses/${analysisId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assumptions, property_type: propertyType }),
      })
      if (!res.ok) throw new Error('save failed')
      setSaveStatus('saved')
      setIsDirty(false)
      setAssumptionsOpen(false)
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this analysis? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/analyses/${analysisId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      router.push('/dashboard')
    } catch {
      alert('Delete failed. Try again.')
      setDeleting(false)
    }
  }

  const cf = results.monthly_cashflow
  const coc = results.cash_on_cash_return
  const taxSavings = results.tax_savings_annual ?? 0
  const bracketUsed = results.tax_bracket_used ?? 0.22
  const scheduleENet = results.schedule_e_net_income ?? 0
  const mortgageInterest = results.mortgage_interest_annual ?? 0

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 80px' }}>

      {/* Property header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
              {[prop?.city, prop?.state].filter(Boolean).join(', ')}
              {propertyType ? ` · ${propertyType.toUpperCase()}` : ''}
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 8 }}>
              {prop?.full_address ?? 'Property Analysis'}
            </h1>
            <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', padding: '3px 10px', borderRadius: 3 }}>
              {assumptions.down_payment_pct}% down · {assumptions.interest_rate}% · ${Math.round(computeMortgage(assumptions)).toLocaleString()}/mo
            </span>
          </div>
          <VerdictBadge verdict={results.verdict} />
        </div>
      </div>

      {/* House hack banner */}
      {assumptions.house_hack && assumptions.house_hack_owner_pct != null && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--text)', borderRadius: 4, padding: '12px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>House Hack Mode</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Owner occupies {assumptions.house_hack_owner_pct}% — depreciation and Schedule E scaled to {100 - assumptions.house_hack_owner_pct}% rental use.
          </div>
        </div>
      )}

      {/* ── ASSUMPTIONS EDITOR ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, marginBottom: 24, overflow: 'hidden' }}>
        {/* Clickable header row */}
        <div
          onClick={() => setAssumptionsOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '16px 24px', borderBottom: assumptionsOpen ? '1px solid var(--border)' : 'none' }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, opacity: 0.6, transform: assumptionsOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
            Assumptions
            {isDirty && <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 600 }}>● unsaved</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            {saveStatus === 'saved' && (
              <span style={{ fontSize: 11, color: 'var(--green)' }}>Saved</span>
            )}
            {saveStatus === 'error' && (
              <span style={{ fontSize: 11, color: 'var(--red)' }}>Save failed</span>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              style={{
                padding: '6px 14px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: isDirty ? 'var(--text)' : 'var(--surface-2)',
                color: isDirty ? 'var(--bg)' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 3,
                cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Collapsed summary */}
        {!assumptionsOpen && (
          <div style={{ padding: '20px 24px' }}>
            <AssumptionsSummary assumptions={assumptions} />
          </div>
        )}

        {assumptionsOpen && <div style={{ padding: '20px 24px' }}>
        {/* Row 1: property type + purchase price + down payment */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <EditField label="Property type">
            <select
              value={propertyType}
              onChange={e => handlePropertyTypeChange(e.target.value)}
              style={selectStyle}
            >
              {PROPERTY_TYPES.map(t => (
                <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </EditField>
          <EditField label="Purchase price ($)">
            <input
              type="number" min="0" style={inputStyle}
              value={assumptions.purchase_price}
              onChange={e => updateAssumption('purchase_price', Number(e.target.value) || 0)}
            />
          </EditField>
          <EditField label="Down payment (%)">
            <input
              type="number" min="0" max="100" step="0.5" style={inputStyle}
              value={assumptions.down_payment_pct}
              onChange={e => updateAssumption('down_payment_pct', Number(e.target.value) || 0)}
            />
          </EditField>
        </div>

        {/* Row 2: interest rate + loan term + closing costs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <EditField label="Interest rate (%)">
            <input
              type="number" min="0" max="20" step="0.1" style={inputStyle}
              value={assumptions.interest_rate}
              onChange={e => updateAssumption('interest_rate', Number(e.target.value) || 0)}
            />
          </EditField>
          <EditField label="Loan term (yrs)">
            <select
              value={assumptions.loan_term_years}
              onChange={e => updateAssumption('loan_term_years', Number(e.target.value))}
              style={selectStyle}
            >
              <option value={15}>15 yr</option>
              <option value={20}>20 yr</option>
              <option value={30}>30 yr</option>
            </select>
          </EditField>
          <EditField label="Closing costs (%)">
            <input
              type="number" min="0" max="10" step="0.1" style={inputStyle}
              value={assumptions.closing_cost_pct}
              onChange={e => updateAssumption('closing_cost_pct', Number(e.target.value) || 0)}
            />
          </EditField>
        </div>

        {/* Row 3: rent / vacancy / mgmt */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          {!isMultiUnit ? (
            <EditField label="Monthly rent ($)">
              <input
                type="number" min="0" style={inputStyle}
                value={assumptions.monthly_rent}
                onChange={e => updateAssumption('monthly_rent', Number(e.target.value) || 0)}
              />
            </EditField>
          ) : (
            <EditField label={`Rent — ${unitCount} units`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Array.from({ length: unitCount }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 40, flexShrink: 0 }}>
                      U{i + 1}
                    </span>
                    <input
                      type="number" min="0" style={{ ...inputStyle, marginBottom: 0 }}
                      value={unitRentInputs[i] ?? ''}
                      placeholder="0"
                      onChange={e => handleUnitRentChange(i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </EditField>
          )}
          <EditField label="Vacancy (%)">
            <input
              type="number" min="0" max="100" step="0.5" style={inputStyle}
              value={assumptions.vacancy_pct}
              onChange={e => updateAssumption('vacancy_pct', Number(e.target.value) || 0)}
            />
          </EditField>
          <EditField label="Property mgmt (%)">
            <input
              type="number" min="0" max="30" step="0.5" style={inputStyle}
              value={assumptions.property_mgmt_pct}
              onChange={e => updateAssumption('property_mgmt_pct', Number(e.target.value) || 0)}
            />
          </EditField>
        </div>

        {/* Row 4: expenses */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <EditField label="Property tax ($/mo)">
            <input
              type="number" min="0" style={inputStyle}
              value={assumptions.property_tax_monthly}
              onChange={e => updateAssumption('property_tax_monthly', Number(e.target.value) || 0)}
            />
          </EditField>
          <EditField label="Insurance ($/mo)">
            <input
              type="number" min="0" style={inputStyle}
              value={assumptions.insurance_monthly}
              onChange={e => updateAssumption('insurance_monthly', Number(e.target.value) || 0)}
            />
          </EditField>
          <EditField label="HOA ($/mo)">
            <input
              type="number" min="0" style={inputStyle}
              value={assumptions.hoa_monthly}
              onChange={e => updateAssumption('hoa_monthly', Number(e.target.value) || 0)}
            />
          </EditField>
        </div>

        {/* Row 5: maintenance + house hack */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <EditField label="Maintenance (%/yr)">
            <input
              type="number" min="0" max="5" step="0.1" style={inputStyle}
              value={assumptions.maintenance_pct_annual}
              onChange={e => updateAssumption('maintenance_pct_annual', Number(e.target.value) || 0)}
            />
          </EditField>
          <EditField label="House hack">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
              <ToggleSwitch
                checked={assumptions.house_hack}
                onChange={v => {
                  updateAssumption('house_hack', v)
                  if (!v) updateAssumption('house_hack_owner_pct', null)
                }}
              />
              {assumptions.house_hack && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  owner %:
                </span>
              )}
              {assumptions.house_hack && (
                <input
                  type="number" min="1" max="99" style={{ ...inputStyle, width: 60 }}
                  value={assumptions.house_hack_owner_pct ?? ''}
                  placeholder="50"
                  onChange={e => updateAssumption('house_hack_owner_pct', Number(e.target.value) || null)}
                />
              )}
            </div>
          </EditField>
        </div>
        </div>}
      </div>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <MetricCard
          label="Monthly Cashflow"
          value={`${cf >= 0 ? '+' : ''}$${cf.toLocaleString()}`}
          sub={`$${results.annual_cashflow.toLocaleString()}/yr`}
          color={cf >= 0 ? 'var(--green)' : 'var(--red)'}
        />
        <MetricCard
          label="Cash-on-Cash"
          value={`${coc.toFixed(1)}%`}
          sub={`Tax-adj: ${results.tax_adjusted_coc.toFixed(1)}%`}
          color={coc >= 6 ? 'var(--green)' : coc >= 3 ? 'var(--amber)' : 'var(--red)'}
        />
        <MetricCard
          label="Cap Rate"
          value={`${results.cap_rate.toFixed(1)}%`}
          sub={`NOI: $${results.noi.toLocaleString()}/yr`}
          color="var(--text)"
        />
        {isMultiUnit && results.price_per_unit ? (
          <MetricCard
            label="Price Per Unit"
            value={`$${results.price_per_unit.toLocaleString()}`}
            sub={results.expense_ratio != null ? `${results.expense_ratio.toFixed(1)}% expense ratio` : 'Multi-unit'}
            color="var(--text)"
          />
        ) : (
          <MetricCard
            label="Break-even"
            value={`${results.break_even_occupancy.toFixed(0)}%`}
            sub="Occupancy needed"
            color={results.break_even_occupancy <= 85 ? 'var(--green)' : 'var(--amber)'}
          />
        )}
      </div>

      {/* Cashflow breakdown + Tax */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Section title="Cashflow Breakdown">
          <Row label="Gross rent" value={`$${assumptions.monthly_rent.toLocaleString()}/mo`} />
          <Row label={`Vacancy (${assumptions.vacancy_pct}%)`} value={`−$${Math.round(assumptions.monthly_rent * assumptions.vacancy_pct / 100).toLocaleString()}/mo`} muted />
          <Divider />
          <Row label="Effective gross income" value={`$${Math.round(assumptions.monthly_rent * (1 - assumptions.vacancy_pct / 100)).toLocaleString()}/mo`} bold />
          <Divider />
          <Row label="Mortgage (P+I)" value={`−$${Math.round(computeMortgage(assumptions)).toLocaleString()}/mo`} muted />
          <Row label="Property tax" value={`−$${assumptions.property_tax_monthly.toLocaleString()}/mo`} muted />
          <Row label="Insurance" value={`−$${assumptions.insurance_monthly.toLocaleString()}/mo`} muted />
          {assumptions.hoa_monthly > 0 && (
            <Row label="HOA" value={`−$${assumptions.hoa_monthly.toLocaleString()}/mo`} muted />
          )}
          <Row label={`Maintenance (${assumptions.maintenance_pct_annual}%)`} value={`−$${Math.round(assumptions.purchase_price * assumptions.maintenance_pct_annual / 100 / 12).toLocaleString()}/mo`} muted />
          <Row label={`Mgmt (${assumptions.property_mgmt_pct}%)`} value={`−$${Math.round(assumptions.monthly_rent * assumptions.property_mgmt_pct / 100).toLocaleString()}/mo`} muted />
          <Divider />
          <Row
            label="Net cashflow"
            value={`${cf >= 0 ? '+' : ''}$${cf.toLocaleString()}/mo`}
            bold
            color={cf >= 0 ? 'var(--green)' : 'var(--red)'}
          />
        </Section>

        <Section title="Tax Impact (Your Profile)">
          <div style={{ background: 'var(--text)', color: 'var(--bg)', borderRadius: 4, padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>Annual Tax Savings</div>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em' }}>
                {taxSavings >= 0 ? `$${taxSavings.toLocaleString()}` : `−$${Math.abs(taxSavings).toLocaleString()}`}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, opacity: 0.55 }}>
              <div>= ${Math.round(Math.abs(taxSavings) / 12).toLocaleString()}/mo</div>
              <div>effective benefit</div>
            </div>
          </div>
          <Row label="Annual Depreciation" value={`$${results.annual_depreciation.toLocaleString()}`} />
          {isMultiUnit && (
            <Row label="Per-Unit Depreciation" value={`$${Math.round(results.annual_depreciation / unitCount).toLocaleString()}/unit`} />
          )}
          <Row label="Mortgage Interest (yr 1)" value={`$${mortgageInterest.toLocaleString()}`} muted />
          <Row label="Schedule E Deductions" value={`$${(results.schedule_e_deductions_annual ?? 0).toLocaleString()}`} muted />
          <Row
            label="Schedule E Net"
            value={scheduleENet <= 0 ? `−$${Math.abs(scheduleENet).toLocaleString()} paper loss` : `+$${scheduleENet.toLocaleString()} taxable`}
            muted
          />
          <Divider />
          <Row label="Tax Bracket" value={`${Math.round(bracketUsed * 100)}%`} />
          <Row label="Passive Loss Status" value={palLabel(results.passive_loss_status)} />
          <Row label="Tax-Adjusted COC" value={`${results.tax_adjusted_coc.toFixed(1)}%`} bold color={results.tax_adjusted_coc >= 6 ? 'var(--green)' : 'var(--text)'} />
          <Row label="Break-Even Occupancy" value={`${results.break_even_occupancy.toFixed(0)}%`} />
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Passive losses carry forward. Estimate only — consult your CPA.
          </div>
        </Section>
      </div>

      {/* Multi-unit breakdown */}
      {isMultiUnit && assumptions.unit_rents && assumptions.unit_rents.length > 0 && (
        <Section title="Unit Breakdown" style={{ marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border)' }}>
                <th style={thStyle}>Unit</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Monthly Rent</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {assumptions.unit_rents.map((u, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 0', fontWeight: 600 }}>{u.unit}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>${u.monthly_rent.toLocaleString()}/mo</td>
                  <td style={{ padding: '10px 0', textAlign: 'center' }}>
                    <StatusBadge status={u.status} />
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '10px 0', fontWeight: 700 }}>Total</td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700 }}>
                  ${assumptions.unit_rents.reduce((s, u) => s + u.monthly_rent, 0).toLocaleString()}/mo
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </Section>
      )}

      {/* Stress scenarios */}
      <Section title="Stress Scenarios">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid var(--border)' }}>
              <th style={thStyle}>Scenario</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Monthly Cashflow</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>COC Return</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {results.stress_scenarios.map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: stressRowBg(s.outcome) }}>
                <td style={{ padding: '12px 0', fontWeight: s.outcome === 'base' ? 700 : 400 }}>{s.label}</td>
                <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700, color: s.cashflow >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {s.cashflow >= 0 ? '+' : ''}${s.cashflow.toLocaleString()}/mo
                </td>
                <td style={{ padding: '12px 0', textAlign: 'right', color: s.coc >= 5 ? 'var(--green)' : s.coc >= 0 ? 'var(--amber)' : 'var(--red)' }}>
                  {s.coc.toFixed(1)}%
                </td>
                <td style={{ padding: '12px 0', textAlign: 'center' }}>
                  <OutcomeBadge outcome={s.outcome} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Location Map */}
      {prop?.lat != null && prop?.lng != null && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
            Location
          </div>
          <Suspense fallback={<LoadingSkeleton height={320} />}>
            <PropertyMap lat={prop.lat} lng={prop.lng} address={prop.full_address} />
          </Suspense>
        </div>
      )}

      {/* Neighborhood Signals */}
      <NeighborhoodSection data={neighborhood} loading={loadingNbh} style={{ marginTop: 16 }} />

      {/* Location Demographics */}
      <DemographicsSection data={demographics} loading={loadingDemo} style={{ marginTop: 16 }} />

      {/* Environmental Risk */}
      <EnvironmentalRiskSection data={envData} loading={loadingEnv} style={{ marginTop: 16 }} />

      {/* Equity Outlook */}
      <EquitySection data={equityData} loading={loadingEquity} style={{ marginTop: 16 }} />

      {/* PropPulse Verdict — Recommendation Panel */}
      <RecommendationPanel results={results} taxProfile={taxProfile} envData={envData} demographics={demographics} equityData={equityData} style={{ marginTop: 16 }} />

      {/* Property details */}
      <Section title="Property Details" style={{ marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 24px' }}>
          <Detail label="List price" value={prop?.list_price ? `$${prop.list_price.toLocaleString()}` : '—'} />
          <Detail label="Beds / Baths" value={prop?.beds && prop?.baths ? `${prop.beds} bd / ${prop.baths} ba` : '—'} />
          <Detail label="Sqft" value={prop?.sqft ? `${prop.sqft.toLocaleString()} sqft` : '—'} />
          <Detail label="Year built" value={prop?.year_built ? String(prop.year_built) : '—'} />
          <Detail label="Rent estimate" value={prop?.rent_estimate_mid ? `$${prop.rent_estimate_mid.toLocaleString()}/mo` : '—'} />
          <Detail label="HOA" value={`$${(prop?.hoa_monthly ?? 0).toLocaleString()}/mo`} />
        </div>
      </Section>

      {/* Actions */}
      <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Link href="/analyze" style={btnPrimary}>+ Analyze Another</Link>
        <Link href="/dashboard" style={btnGhost}>← My Analyses</Link>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{ marginLeft: 'auto', padding: '9px 16px', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'transparent', color: 'var(--red)', border: '1.5px solid var(--red)', borderRadius: 4, cursor: deleting ? 'wait' : 'pointer', opacity: deleting ? 0.6 : 1 }}
        >
          {deleting ? 'Deleting…' : 'Delete Analysis'}
        </button>
      </div>
    </div>
  )
}

// ── Helpers ──

function computeMortgage(a: Assumptions): number {
  const loanAmount = a.purchase_price * (1 - a.down_payment_pct / 100)
  const mr = a.interest_rate / 100 / 12
  const n = a.loan_term_years * 12
  if (mr === 0) return loanAmount / n
  return (loanAmount * (mr * Math.pow(1 + mr, n))) / (Math.pow(1 + mr, n) - 1)
}


function AssumptionsSummary({ assumptions: a }: { assumptions: Assumptions }) {
  const loanAmount = a.purchase_price * (1 - a.down_payment_pct / 100)
  const downAmount = a.purchase_price * a.down_payment_pct / 100
  const closingCosts = a.purchase_price * a.closing_cost_pct / 100
  const totalCashIn = downAmount + closingCosts

  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${n.toLocaleString()}`

  const items = [
    { label: 'Purchase Price', value: fmt(a.purchase_price) },
    { label: `Down (${a.down_payment_pct}%)`, value: fmt(downAmount) },
    { label: 'Loan Amount', value: fmt(loanAmount) },
    { label: 'Interest Rate', value: `${a.interest_rate}% / ${a.loan_term_years}yr` },
    { label: 'Total Cash In', value: fmt(totalCashIn) },
  ]

  return (
    <div style={{ display: 'flex' }}>
      {items.map((item, i) => (
        <div
          key={item.label}
          style={{
            flex: 1,
            paddingLeft: i === 0 ? 0 : 20,
            paddingRight: 20,
            borderRight: i < items.length - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
            {item.label}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{item.value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Sub-components ──

function VerdictBadge({ verdict }: { verdict: string }) {
  const dotColor: Record<string, string> = { GO: '#4ADE80', CAUTION: '#FCD34D', PASS: '#9CA3AF' }
  const prefix = verdict === 'PASS' ? '✗' : '✓'
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      padding: '14px 20px', borderRadius: 4,
      background: 'var(--text)', color: 'var(--bg)',
    }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 2 }}>
          PropPulse Verdict
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {prefix}&nbsp;&nbsp;{verdict}
        </div>
      </div>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor[verdict] ?? '#9CA3AF', flexShrink: 0 }} />
    </div>
  )
}

function RecommendationPanel({ results, taxProfile, envData, demographics, equityData, style }: { results: Results; taxProfile: TaxProfile; envData: EnvironmentalData | null; demographics: DemographicsData | null; equityData: EquityData | null; style?: React.CSSProperties }) {
  const cf = results.monthly_cashflow
  const coc = results.cash_on_cash_return
  const taxSavings = results.tax_savings_annual ?? 0
  const bracket = results.tax_bracket_used ?? (taxProfile.tax_bracket ?? 0.22)
  const depreciation = results.annual_depreciation
  const pal = results.passive_loss_status
  const verdict = results.verdict

  // Scorecard signals
  const cfSignal = cf > 100 ? 'sig-pos' : cf >= 0 ? 'sig-warn' : 'sig-neg'
  const cfSignalLabel = cf > 100 ? 'Positive' : cf >= 0 ? 'Marginal' : 'Negative'
  const taxSignal = taxSavings > 0 ? 'sig-pos' : 'sig-neu'
  const taxSignalLabel = taxSavings > 0 ? 'Beneficial' : 'Neutral'

  // Downside resilience: count non-base positive scenarios
  const nonBaseScenarios = results.stress_scenarios.filter(s => s.outcome !== 'base')
  const positiveCount = nonBaseScenarios.filter(s => s.outcome === 'positive').length
  const totalNonBase = nonBaseScenarios.length
  const resilienceSignal = positiveCount >= Math.ceil(totalNonBase * 0.6) ? 'sig-pos' : positiveCount >= Math.ceil(totalNonBase * 0.4) ? 'sig-warn' : 'sig-neg'
  const resilienceLabel = positiveCount >= Math.ceil(totalNonBase * 0.6) ? 'Resilient' : positiveCount >= Math.ceil(totalNonBase * 0.4) ? 'Mixed' : 'Fragile'

  // Key flags
  const flags: Array<{ cls: 'good' | 'watch' | 'risk'; text: string }> = []
  const rateSensitiveScenario = results.stress_scenarios.find(s => s.label.includes('8%') || s.label.includes('8.0%'))
  if (rateSensitiveScenario && rateSensitiveScenario.cashflow < 0) {
    flags.push({ cls: 'watch', text: '⚡ Rate sensitivity — cashflow turns negative above 8%' })
  }
  if (coc >= 8) {
    flags.push({ cls: 'good', text: `✓ Strong ${coc.toFixed(1)}% COC — above 8% target` })
  }
  if (pal === 'full') {
    flags.push({ cls: 'good', text: '✓ PAL fully deductible at your AGI' })
  } else if (pal === 'phase_out') {
    flags.push({ cls: 'watch', text: '⚡ PAL partial — AGI in $100K–$150K phase-out range' })
  } else {
    flags.push({ cls: 'risk', text: '✗ PAL suspended — AGI exceeds $150K threshold' })
  }
  if (results.break_even_occupancy > 90) {
    flags.push({ cls: 'risk', text: `⚠ Break-even at ${results.break_even_occupancy.toFixed(0)}% — very little cushion` })
  } else if (results.break_even_occupancy > 80) {
    flags.push({ cls: 'watch', text: `⚡ Break-even at ${results.break_even_occupancy.toFixed(0)}% — watch vacancy rate` })
  } else {
    flags.push({ cls: 'good', text: `✓ Breaks even at ${results.break_even_occupancy.toFixed(0)}% occupancy — strong cushion` })
  }

  // Rec title + body
  const recTitles: Record<string, string> = {
    GO: 'Strong investment at your profile.',
    CAUTION: 'Proceed with caution.',
    PASS: 'Does not pencil — pass.',
  }
  const palDesc = pal === 'full' ? 'PAL fully deductible' : pal === 'phase_out' ? 'PAL partially deductible' : 'PAL suspended'
  const recBody: Record<string, string> = {
    GO: `Numbers work on cashflow and tax dimensions. Monthly cashflow at ${cf >= 0 ? '+' : ''}$${cf.toLocaleString()}/mo, ${coc.toFixed(1)}% COC, with $${taxSavings.toLocaleString()} in annual tax savings at your ${Math.round(bracket * 100)}% bracket. ${palDesc}.`,
    CAUTION: `Marginal cashflow at ${cf >= 0 ? '+' : ''}$${cf.toLocaleString()}/mo. COC of ${coc.toFixed(1)}% is below the 6% target — evaluate closely before committing. Tax savings of $${taxSavings.toLocaleString()}/yr at your ${Math.round(bracket * 100)}% bracket provide some offset. ${palDesc}.`,
    PASS: `Negative cashflow at $${cf.toLocaleString()}/mo. Does not pencil at current assumptions. Consider negotiating a lower purchase price, increasing rents, or adjusting financing terms before proceeding.`,
  }

  const recBadgeColor: Record<string, string> = { GO: '#4ADE80', CAUTION: '#FCD34D', PASS: '#9CA3AF' }

  const dimStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    padding: '16px 18px',
  }

  function Signal({ cls, label }: { cls: string; label: string }) {
    const sigStyles: Record<string, React.CSSProperties> = {
      'sig-pos': { background: 'rgba(74,222,128,0.25)', color: '#4ADE80' },
      'sig-warn': { background: 'rgba(252,211,77,0.25)', color: '#FCD34D' },
      'sig-neg': { background: 'rgba(252,165,165,0.25)', color: '#FCA5A5' },
      'sig-neu': { background: 'rgba(255,255,255,0.1)', color: 'rgba(250,250,248,0.6)' },
    }
    return (
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 2, ...sigStyles[cls] }}>
        {label}
      </span>
    )
  }

  function DimHeader({ label, sigCls, sigLabel }: { label: string; sigCls: string; sigLabel: string }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.5 }}>{label}</span>
        <Signal cls={sigCls} label={sigLabel} />
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--text)', color: 'var(--bg)', borderRadius: 4, padding: 32, ...style }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase',
          padding: '6px 14px', borderRadius: 2,
          background: recBadgeColor[verdict] ?? '#9CA3AF', color: '#1A1A1A',
        }}>
          {verdict}
        </span>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>
          {recTitles[verdict] ?? 'Analysis complete.'}
        </span>
      </div>

      {/* Body */}
      <p style={{ fontSize: 14, lineHeight: 1.8, color: 'rgba(250,250,248,0.75)', maxWidth: 700, marginBottom: 28 }}>
        {recBody[verdict] ?? ''}
      </p>

      {/* 6-dimension scorecard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 24 }}>
        {/* Cashflow */}
        <div style={dimStyle}>
          <DimHeader label="Cashflow" sigCls={cfSignal} sigLabel={cfSignalLabel} />
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 3 }}>
            {cf >= 0 ? '+' : ''}${cf.toLocaleString()}/mo
          </div>
          <div style={{ fontSize: 11, color: 'rgba(250,250,248,0.45)', lineHeight: 1.4 }}>
            {coc.toFixed(1)}% COC · {results.cap_rate.toFixed(1)}% cap rate · breaks even at {results.break_even_occupancy.toFixed(0)}% occupancy
          </div>
        </div>

        {/* Tax Impact */}
        <div style={dimStyle}>
          <DimHeader label="Tax Impact" sigCls={taxSignal} sigLabel={taxSignalLabel} />
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 3 }}>
            +${Math.round(Math.abs(taxSavings) / 12).toLocaleString()}/mo
          </div>
          <div style={{ fontSize: 11, color: 'rgba(250,250,248,0.45)', lineHeight: 1.4 }}>
            ${depreciation.toLocaleString()}/yr depreciation · ${taxSavings.toLocaleString()} savings at {Math.round(bracket * 100)}% · {palDesc}
          </div>
        </div>

        {/* Equity Outlook */}
        {(() => {
          const apr1 = equityData?.appreciation_1yr
          const apr5 = equityData?.appreciation_5yr
          const equitySigCls = !equityData ? 'sig-neu'
            : apr1 == null ? 'sig-neu'
            : apr1 >= 5 ? 'sig-pos'
            : apr1 >= 0 ? 'sig-warn'
            : 'sig-neg'
          const equitySigLabel = !equityData ? 'Loading'
            : apr1 == null ? 'No data'
            : apr1 >= 5 ? 'Appreciating'
            : apr1 >= 0 ? 'Flat'
            : 'Declining'
          const apr1Str = apr1 != null ? `${apr1 >= 0 ? '+' : ''}${apr1.toFixed(1)}%` : '—'
          const equitySub = equityData
            ? [
                apr5 != null ? `5yr: ${apr5 >= 0 ? '+' : ''}${apr5.toFixed(1)}%` : null,
                equityData.is_national ? 'National (Case-Shiller)' : `${equityData.metro} metro`,
                equityData.infra_projects.length > 0 ? `${equityData.infra_projects.length} infra projects nearby` : null,
              ].filter(Boolean).join(' · ')
            : 'Loading appreciation data…'
          return (
            <div style={dimStyle}>
              <DimHeader label="Equity Outlook" sigCls={equitySigCls} sigLabel={equitySigLabel} />
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 3, opacity: equityData ? 1 : 0.35 }}>{apr1Str} <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.6 }}>1yr</span></div>
              <div style={{ fontSize: 11, color: 'rgba(250,250,248,0.45)', lineHeight: 1.4 }}>{equitySub}</div>
            </div>
          )
        })()}

        {/* Environmental Risk */}
        {(() => {
          const elevated = envData && (['high','severe','coastal'].includes(envData.fire_risk_level ?? '') || ['high','coastal'].includes(envData.flood_risk_level ?? ''))
          const envSigCls = !envData ? 'sig-neu' : elevated ? 'sig-warn' : 'sig-pos'
          const envSigLabel = !envData ? 'Loading' : elevated ? 'Elevated' : 'Low Risk'
          const topRisk = envData?.fire_risk_level === 'high' || envData?.fire_risk_level === 'severe'
            ? 'Fire HIGH'
            : envData?.flood_risk_level === 'high' || envData?.flood_risk_level === 'coastal'
              ? `Flood ${envData.flood_zone ?? 'AE'}`
              : envData?.earthquake_risk_level === 'very_high'
                ? `Quake ${envData.earthquake_pga?.toFixed(2) ?? '—'}g`
                : envData
                  ? 'All Clear'
                  : '—'
          const envSub = envData
            ? [envData.flood_zone ? `Flood Zone ${envData.flood_zone}` : null, envData.aqi_annual_avg ? `AQI ${envData.aqi_annual_avg}` : null, envData.earthquake_risk_level ? `Seismic ${envData.earthquake_risk_level.replace('_',' ')}` : null].filter(Boolean).join(' · ')
            : 'Loading environmental data…'
          return (
            <div style={dimStyle}>
              <DimHeader label="Environmental Risk" sigCls={envSigCls} sigLabel={envSigLabel} />
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 3, opacity: envData ? 1 : 0.35 }}>{topRisk}</div>
              <div style={{ fontSize: 11, color: 'rgba(250,250,248,0.45)', lineHeight: 1.4 }}>{envSub}</div>
            </div>
          )
        })()}

        {/* Location Demographics */}
        {(() => {
          const signal = demographics?.renter_demand_signal
          const demoSigCls = !demographics ? 'sig-neu' : signal === 'strong' ? 'sig-pos' : signal === 'owner_dominated' ? 'sig-neu' : 'sig-warn'
          const demoSigLabel = !demographics ? 'Loading' : signal === 'strong' ? 'Strong' : signal === 'owner_dominated' ? 'Low Demand' : 'Mixed'
          const renterPct = demographics?.renter_ratio != null ? `${Math.round(demographics.renter_ratio * 100)}% renters` : '—'
          const demoSub = demographics
            ? [demographics.median_household_income ? `Median income $${(demographics.median_household_income / 1000).toFixed(0)}K` : null, demographics.unemployment_rate ? `${(demographics.unemployment_rate * 100).toFixed(1)}% unemployment` : null, demographics.price_to_rent_ratio ? `P/R ${demographics.price_to_rent_ratio.toFixed(1)}×` : null].filter(Boolean).join(' · ')
            : 'Loading census data…'
          return (
            <div style={dimStyle}>
              <DimHeader label="Location Demographics" sigCls={demoSigCls} sigLabel={demoSigLabel} />
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 3, opacity: demographics ? 1 : 0.35 }}>{renterPct}</div>
              <div style={{ fontSize: 11, color: 'rgba(250,250,248,0.45)', lineHeight: 1.4 }}>{demoSub}</div>
            </div>
          )
        })()}

        {/* Downside Resilience */}
        <div style={dimStyle}>
          <DimHeader label="Downside Resilience" sigCls={resilienceSignal} sigLabel={resilienceLabel} />
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 3 }}>
            {positiveCount} of {totalNonBase}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(250,250,248,0.45)', lineHeight: 1.4 }}>
            Stress scenarios cash-flow positive
          </div>
        </div>
      </div>

      {/* Key flags */}
      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0 0 20px' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {flags.map((f, i) => {
          const flagStyles: Record<string, React.CSSProperties> = {
            good: { background: 'rgba(74,222,128,0.15)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.2)' },
            watch: { background: 'rgba(252,211,77,0.18)', color: '#FCD34D', border: '1px solid rgba(252,211,77,0.25)' },
            risk: { background: 'rgba(252,165,165,0.18)', color: '#FCA5A5', border: '1px solid rgba(252,165,165,0.25)' },
          }
          return (
            <span key={i} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, ...flagStyles[f.cls] }}>
              {f.text}
            </span>
          )
        })}
      </div>

      {/* Disclaimer */}
      <p style={{ fontSize: 11, color: 'rgba(250,250,248,0.35)', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>
        PropPulse provides estimates for informational purposes only. Tax calculations are approximations based on stated income and bracket — consult a CPA before making investment decisions. Rent estimates may not reflect actual market conditions.
      </p>
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? 'var(--text)' : 'var(--border)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2,
        left: checked ? 18 : 2,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: checked ? 'var(--bg)' : 'var(--text-muted)',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    positive: { bg: 'var(--green-lt)', color: 'var(--green-dk)', label: 'Positive' },
    marginal: { bg: 'var(--amber-lt)', color: 'var(--amber-dk)', label: 'Marginal' },
    negative: { bg: 'var(--red-lt)', color: 'var(--red-dk)', label: 'Negative' },
    base: { bg: 'var(--surface-2)', color: 'var(--text-muted)', label: 'Current' },
  }
  const s = styles[outcome] ?? styles.base
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 3, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 3,
      background: status === 'occupied' ? 'var(--green-lt)' : 'var(--red-lt)',
      color: status === 'occupied' ? 'var(--green-dk)' : 'var(--red-dk)',
    }}>
      {status === 'occupied' ? 'Occupied' : 'Vacant'}
    </span>
  )
}

function Section({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '20px 24px', ...style }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value, muted, bold, color }: { label: string; value: string; muted?: boolean; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
      <span style={{ color: muted ? 'var(--text-muted)' : 'var(--text)' }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 400, color: color ?? (muted ? 'var(--text-muted)' : 'var(--text)') }}>{value}</span>
    </div>
  )
}

function Divider() {
  return <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function palLabel(status: string): string {
  if (status === 'full') return 'Full deduction'
  if (status === 'phase_out') return 'Phase-out (AGI $100–$150K)'
  return 'Suspended (AGI >$150K)'
}

function stressRowBg(outcome: string): string {
  if (outcome === 'base') return 'var(--surface-2)'
  if (outcome === 'negative') return '#FEF2F2'
  if (outcome === 'marginal') return '#FEFCE8'
  return 'transparent'
}

// ── Sprint 4 Sections ──

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>{title}</span>
      {sub && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>{sub}</span>}
    </div>
  )
}

function LoadingSkeleton({ height = 120 }: { height?: number }) {
  return <div style={{ height, background: 'var(--surface-2)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
}

function NeighborhoodSection({ data, loading, style }: { data: NeighborhoodData | null; loading: boolean; style?: React.CSSProperties }) {
  const cards = [
    {
      label: 'Walk Score',
      score: data?.walk_score != null ? String(data.walk_score) : '—',
      sub: data?.walk_score_label ?? (loading ? 'Loading…' : 'No data'),
      available: data?.walk_score != null,
    },
    {
      label: 'School Rating',
      score: data?.school_rating != null ? `${data.school_rating}/10` : '—',
      sub: data?.school_rating != null ? 'GreatSchools' : (loading ? 'Loading…' : 'No data'),
      available: data?.school_rating != null,
    },
    {
      label: 'Crime Index',
      score: data?.crime_grade ?? (data?.crime_index != null ? String(data.crime_index) : '—'),
      sub: data?.crime_vs_city_avg === 'below' ? 'Below city avg' : data?.crime_vs_city_avg === 'above' ? 'Above city avg' : (loading ? 'Loading…' : 'No data'),
      available: data?.crime_grade != null || data?.crime_index != null,
    },
    {
      label: 'Infra Projects',
      score: data?.infra_project_count_2mi != null ? String(data.infra_project_count_2mi) : '—',
      sub: 'Nearby (2 mi)',
      available: data?.infra_project_count_2mi != null,
    },
  ]

  return (
    <div style={style}>
      <SectionHeader title="Neighborhood Signals" />
      {loading && !data
        ? <LoadingSkeleton height={100} />
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            {cards.map((c) => (
              <div key={c.label} style={{ background: 'var(--surface)', padding: '20px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>{c.label}</div>
                <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4, color: c.available ? 'var(--text)' : 'var(--text-muted)' }}>{c.score}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.sub}</div>
              </div>
            ))}
          </div>
        )}
      {data?.walk_score != null && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
          Walk Score® by Walk Score℠ · <a href="https://www.walkscore.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)' }}>walkscore.com</a>
        </div>
      )}
    </div>
  )
}

function DemographicsSection({ data, loading, style }: { data: DemographicsData | null; loading: boolean; style?: React.CSSProperties }) {
  const fmt = (n: number | null | undefined, prefix = '', suffix = '') =>
    n != null ? `${prefix}${n.toLocaleString()}${suffix}` : '—'

  const cards = data ? [
    {
      label: 'Median Household Income',
      value: data.median_household_income ? `$${(data.median_household_income / 1000).toFixed(0)}K` : '—',
      sub: 'Annual household median',
      barPct: data.median_household_income ? Math.min(100, (data.median_household_income / 150000) * 100) : 0,
      badge: null,
    },
    {
      label: 'Renter Ratio',
      value: data.renter_ratio != null ? `${Math.round(data.renter_ratio * 100)}%` : '—',
      sub: 'Renter-occupied of all units',
      barPct: null,
      badge: data.renter_demand_signal === 'strong' ? { text: 'Strong Renter Market', cls: 'strong' }
        : data.renter_demand_signal === 'owner_dominated' ? { text: 'Owner-Dominated', cls: 'owner' }
        : { text: 'Mixed Market', cls: 'mixed' },
    },
    {
      label: 'Population',
      value: data.population_total ? data.population_total.toLocaleString() : '—',
      sub: data.zip_code ? `ZIP ${data.zip_code}${data.median_age ? ` · Median age ${data.median_age}` : ''}` : 'ZIP data',
      barPct: null,
      badge: null,
    },
    {
      label: 'Unemployment Rate',
      value: data.unemployment_rate != null ? `${(data.unemployment_rate * 100).toFixed(1)}%` : '—',
      sub: 'vs. ~4% national avg',
      barPct: data.unemployment_rate != null ? Math.min(100, data.unemployment_rate * 100 * 10) : 0,
      badge: null,
    },
    {
      label: 'College Educated',
      value: data.college_educated_pct != null ? `${Math.round(data.college_educated_pct * 100)}%` : '—',
      sub: "Bachelor's degree or higher (25+)",
      barPct: data.college_educated_pct != null ? data.college_educated_pct * 100 : 0,
      badge: null,
    },
    {
      label: 'Price-to-Rent Ratio',
      value: data.price_to_rent_ratio != null ? `${data.price_to_rent_ratio.toFixed(1)}×` : '—',
      sub: [data.median_home_value ? `Home $${(data.median_home_value / 1000).toFixed(0)}K` : null, data.median_gross_rent ? `Rent $${data.median_gross_rent.toLocaleString()}/mo` : null].filter(Boolean).join(' · '),
      barPct: null,
      badge: data.price_to_rent_ratio != null
        ? (data.price_to_rent_ratio > 20 ? { text: 'Renting Favored', cls: 'mixed' } : data.price_to_rent_ratio < 12 ? { text: 'Buying Favored', cls: 'strong' } : { text: 'Balanced', cls: 'mixed' })
        : null,
    },
  ] : []

  const badgeColors: Record<string, React.CSSProperties> = {
    strong: { background: 'rgba(45,122,79,0.12)', color: '#2D7A4F' },
    mixed: { background: 'rgba(196,181,165,0.3)', color: 'var(--text-muted)' },
    owner: { background: 'var(--surface-2)', color: 'var(--text-muted)' },
  }

  return (
    <div style={style}>
      <SectionHeader
        title="Location Demographics"
        sub={data?.zip_code && data?.census_vintage ? `${data.zip_code} · US Census ACS 5-Year (${data.census_vintage})` : undefined}
      />
      {loading && !data
        ? <LoadingSkeleton height={200} />
        : !data
          ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface)', borderRadius: 4 }}>Census data unavailable for this location.</div>
          : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                {cards.map((c) => (
                  <div key={c.label} style={{ background: 'var(--surface)', padding: '20px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>{c.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 4 }}>{c.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{c.sub}</div>
                    {c.barPct != null && (
                      <div style={{ height: 3, background: 'var(--border)', borderRadius: 2 }}>
                        <div style={{ height: 3, background: 'var(--text)', borderRadius: 2, width: `${c.barPct}%` }} />
                      </div>
                    )}
                    {c.badge && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 2, letterSpacing: '0.06em', textTransform: 'uppercase', ...badgeColors[c.badge.cls] }}>
                        {c.badge.text}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--surface)', borderRadius: 4, padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {data.vacancy_rate != null && <span>Housing vacancy: <strong style={{ color: 'var(--text)' }}>{(data.vacancy_rate * 100).toFixed(1)}%</strong></span>}
                {data.median_gross_rent != null && <span>Median gross rent: <strong style={{ color: 'var(--text)' }}>${data.median_gross_rent.toLocaleString()}/mo</strong></span>}
                {data.owner_occupied_units != null && <span>Owner-occ units: <strong style={{ color: 'var(--text)' }}>{fmt(data.owner_occupied_units)}</strong></span>}
                {data.renter_occupied_units != null && <span>Renter-occ units: <strong style={{ color: 'var(--text)' }}>{fmt(data.renter_occupied_units)}</strong></span>}
              </div>
            </>
          )}
    </div>
  )
}

function EnvironmentalRiskSection({ data, loading, style }: { data: EnvironmentalData | null; loading: boolean; style?: React.CSSProperties }) {
  type RiskLevel = 'minimal' | 'low' | 'moderate' | 'high' | 'severe' | 'coastal' | 'very_high' | null

  function riskBadge(level: RiskLevel) {
    const map: Record<string, { label: string; style: React.CSSProperties }> = {
      minimal: { label: 'Minimal', style: { background: 'rgba(45,122,79,0.1)', color: '#2D7A4F' } },
      low:     { label: 'Low',     style: { background: 'rgba(45,122,79,0.1)', color: '#2D7A4F' } },
      moderate:{ label: 'Moderate',style: { background: 'rgba(252,211,77,0.18)', color: '#B87333' } },
      high:    { label: 'High',    style: { background: 'rgba(192,90,26,0.12)', color: '#C05A1A' } },
      very_high:{ label: 'High',   style: { background: 'rgba(192,90,26,0.12)', color: '#C05A1A' } },
      severe:  { label: 'Severe',  style: { background: 'rgba(185,64,64,0.12)', color: '#B94040' } },
      coastal: { label: 'Coastal', style: { background: 'rgba(185,64,64,0.12)', color: '#B94040' } },
    }
    const s = level ? (map[level] ?? map.moderate) : map.minimal
    return <span style={{ fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 2, letterSpacing: '0.1em', textTransform: 'uppercase', ...s.style }}>{s.label}</span>
  }

  function scoreColor(level: RiskLevel): string {
    if (!level || level === 'minimal' || level === 'low') return 'var(--text)'
    if (level === 'moderate') return '#B87333'
    return '#C05A1A'
  }

  const aqiCategoryLabel: Record<string, string> = {
    good: 'Good', moderate: 'Moderate', unhealthy_sensitive: 'USG',
    unhealthy: 'Unhealthy', very_unhealthy: 'Very Unhealthy', hazardous: 'Hazardous',
  }
  const aqiRiskLevel = (cat: string | null): RiskLevel => {
    if (!cat || cat === 'good') return 'low'
    if (cat === 'moderate') return 'moderate'
    if (cat === 'unhealthy_sensitive') return 'moderate'
    if (cat === 'unhealthy') return 'high'
    return 'severe'
  }

  const floodLabel = data?.flood_zone ? `Zone ${data.flood_zone}` : '—'
  const aqiLabel = data?.aqi_annual_avg != null ? `${data.aqi_annual_avg} AQI` : '—'
  const quakeLabel = data?.earthquake_pga != null ? `${data.earthquake_pga.toFixed(2)}g PGA` : '—'

  const cards = [
    {
      icon: '🔥', label: 'Fire Risk',
      score: data?.fire_risk_level ? data.fire_risk_level.toUpperCase() : '—',
      level: (data?.fire_risk_level ?? null) as RiskLevel,
      sub: data?.fire_zone_label ?? (data?.fire_risk_level ? 'Fire hazard data' : 'No data available'),
      available: !!data?.fire_risk_level,
    },
    {
      icon: '🌊', label: 'Flood Zone',
      score: floodLabel,
      level: (data?.flood_risk_level ?? null) as RiskLevel,
      sub: data?.flood_insurance_required ? 'Flood insurance required' : data?.flood_zone ? 'No flood insurance required' : (loading ? 'Loading…' : 'No data'),
      available: !!data?.flood_zone,
    },
    {
      icon: '💨', label: 'Air Quality',
      score: aqiLabel,
      level: aqiRiskLevel(data?.aqi_category ?? null),
      sub: data?.aqi_category ? aqiCategoryLabel[data.aqi_category] ?? data.aqi_category : (loading ? 'Loading…' : 'No data'),
      available: data?.aqi_annual_avg != null,
    },
    {
      icon: '🌬️', label: 'Wind Risk',
      score: data?.wind_zone ? `Zone ${data.wind_zone}` : '—',
      level: (data?.wind_risk_level ?? null) as RiskLevel,
      sub: data?.wind_design_speed_mph ? `${data.wind_design_speed_mph} mph design wind` : (data?.wind_risk_level ?? (loading ? 'Loading…' : 'No data')),
      available: !!data?.wind_zone,
    },
    {
      icon: '🌍', label: 'Earthquake',
      score: quakeLabel,
      level: (data?.earthquake_risk_level?.replace('very_high', 'high') ?? null) as RiskLevel,
      sub: data?.earthquake_risk_level ? `${data.earthquake_risk_level.replace('_', ' ')} seismic hazard` : (loading ? 'Loading…' : 'No data'),
      available: data?.earthquake_pga != null,
    },
  ]

  const fireElevated = data?.fire_risk_level === 'high' || data?.fire_risk_level === 'severe'
  const floodElevated = data?.flood_risk_level === 'high' || data?.flood_risk_level === 'coastal'

  return (
    <div style={style}>
      <SectionHeader title="Environmental Risk" />
      {loading && !data
        ? <LoadingSkeleton height={140} />
        : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              {cards.map((c) => (
                <div key={c.label} style={{ background: 'var(--surface)', padding: '20px 16px' }}>
                  <div style={{ fontSize: 20, marginBottom: 10 }}>{c.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>{c.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.01em', marginBottom: 6, color: c.available ? scoreColor(c.level) : 'var(--text-muted)' }}>{c.score}</div>
                  <div style={{ marginBottom: 6 }}>{riskBadge(c.available ? c.level : null)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>{c.sub}</div>
                </div>
              ))}
            </div>
            {(fireElevated || floodElevated) && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid #C05A1A', borderRadius: 4, padding: '14px 20px', display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.6 }}>
                <span>⚠️</span>
                <div>
                  {fireElevated && <><strong>Elevated fire risk detected.</strong> {data?.fire_zone_label ?? 'Fire Hazard Severity Zone'} designation may affect insurability. Verify homeowner + fire insurance availability before proceeding — some carriers have withdrawn from high-risk zones. Factor any premium increase into cashflow assumptions.</>}
                  {!fireElevated && floodElevated && <><strong>Flood zone {data?.flood_zone} detected.</strong> Federal flood insurance (NFIP) is required for federally-backed mortgages in this zone. Obtain a flood insurance quote and add to your monthly expense assumptions.</>}
                </div>
              </div>
            )}
          </>
        )}
    </div>
  )
}

function EquitySection({ data, loading, style }: { data: EquityData | null; loading: boolean; style?: React.CSSProperties }) {
  const statusLabel: Record<string, string> = {
    planned: 'Planned',
    under_construction: 'Under Construction',
    completed: 'Completed',
  }
  const impactColor: Record<string, string> = {
    high: '#2D7A4F',
    medium: '#B87333',
    low: 'var(--text-muted)',
  }

  const formatInvestment = (n: number | null) => {
    if (!n) return null
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`
    return `$${n.toLocaleString()}`
  }

  return (
    <div style={style}>
      <SectionHeader
        title="Equity Outlook"
        sub={data ? (data.is_national ? 'National Case-Shiller · FRED' : `${data.metro} metro · FRED Case-Shiller`) : undefined}
      />
      {loading && !data
        ? <LoadingSkeleton height={160} />
        : !data
          ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface)', borderRadius: 4 }}>Appreciation data unavailable.</div>
          : (
            <>
              {/* Appreciation cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                {[
                  { label: '1-Year Appreciation', value: data.appreciation_1yr, periods: '12 months' },
                  { label: '5-Year Appreciation', value: data.appreciation_5yr, periods: '60 months' },
                ].map(({ label, value, periods }) => {
                  const color = value == null ? 'var(--text-muted)' : value >= 5 ? 'var(--green)' : value >= 0 ? 'var(--text)' : 'var(--red)'
                  return (
                    <div key={label} style={{ background: 'var(--surface)', padding: '24px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>{label}</div>
                      <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em', color, marginBottom: 4 }}>
                        {value != null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '—'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{periods} · {data.is_national ? 'National avg' : `${data.metro}`}</div>
                    </div>
                  )
                })}
              </div>

              {/* Infrastructure projects */}
              {data.infra_projects.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
                    Nearby Infrastructure Projects
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.infra_projects.map((p) => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 2, letterSpacing: '0.1em', textTransform: 'uppercase', background: `${impactColor[p.impact_level]}22`, color: impactColor[p.impact_level] }}>
                              {p.impact_level}
                            </span>
                          </div>
                          {p.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{p.description}</div>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {formatInvestment(p.investment_usd) && (
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{formatInvestment(p.investment_usd)}</div>
                          )}
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{statusLabel[p.status] ?? p.status}</div>
                          {p.est_completion && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.est_completion}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.infra_projects.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 0' }}>No infrastructure projects in database within 5 miles.</div>
              )}
            </>
          )}
    </div>
  )
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  sfh: 'Single Family',
  condo: 'Condo',
  townhouse: 'Townhouse',
  duplex: 'Duplex (2 units)',
  triplex: 'Triplex (3 units)',
  fourplex: 'Fourplex (4 units)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 13,
  border: '1.5px solid var(--border)',
  borderRadius: 4,
  background: 'var(--bg)',
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
  boxSizing: 'border-box',
  marginBottom: 0,
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 0',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

const btnPrimary: React.CSSProperties = {
  background: 'var(--text)', color: 'var(--bg)', padding: '10px 24px',
  fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
  textDecoration: 'none', borderRadius: 4, display: 'inline-block',
}

const btnGhost: React.CSSProperties = {
  background: 'transparent', color: 'var(--text-muted)', padding: '9px 20px',
  fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
  textDecoration: 'none', borderRadius: 4, border: '1.5px solid var(--border)', display: 'inline-block',
}
