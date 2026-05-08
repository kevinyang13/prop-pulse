import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/layout/Nav'
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
      id, scenario_name, verdict, verdict_reason, created_at, assumptions, results,
      properties ( full_address, city, state, property_type, beds, baths, sqft, year_built,
                   list_price, rent_estimate_mid, hoa_monthly, property_tax_annual, unit_count )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single() as { data: AnalysisRow | null, error: unknown }

  if (!analysis) notFound()

  const prop = analysis.properties as PropertyRow | null
  const results = analysis.results as Results
  const assumptions = analysis.assumptions as Assumptions

  const cf = results.monthly_cashflow
  const coc = results.cash_on_cash_return
  const isMultiUnit = (assumptions.unit_rents?.length ?? 0) >= 2

  // Fallbacks for older stored results that predate Sprint 2 fields
  const taxSavings = results.tax_savings_annual ?? 0
  const bracketUsed = results.tax_bracket_used ?? 0.22
  const scheduleENet = results.schedule_e_net_income ?? 0
  const mortgageInterest = results.mortgage_interest_annual ?? 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav variant="post-auth" />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Property header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                {[prop?.city, prop?.state].filter(Boolean).join(', ')}
                {prop?.property_type ? ` · ${prop.property_type.toUpperCase()}` : ''}
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 8 }}>
                {prop?.full_address ?? 'Property Analysis'}
              </h1>
              {analysis.scenario_name && (
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  padding: '3px 10px',
                  borderRadius: 3,
                }}>
                  {analysis.scenario_name}
                </span>
              )}
            </div>
            <VerdictBadge verdict={analysis.verdict} reason={analysis.verdict_reason} />
          </div>
        </div>

        {/* House hack banner */}
        {assumptions.house_hack && assumptions.house_hack_owner_pct != null && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--text)',
            borderRadius: 4,
            padding: '12px 20px',
            marginBottom: 20,
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
                House Hack Mode — Owner Occupied
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Owner occupies {assumptions.house_hack_owner_pct}% of property. Depreciation and Schedule E deductions reduced to rental portion ({100 - assumptions.house_hack_owner_pct}%) only.
              </div>
            </div>
          </div>
        )}

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
            <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
            <Row label="Effective gross income" value={`$${Math.round(assumptions.monthly_rent * (1 - assumptions.vacancy_pct / 100)).toLocaleString()}/mo`} bold />
            <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
            <Row label="Mortgage (P+I)" value={`−$${Math.round(results.total_cash_invested > 0 ? computeMortgage(assumptions) : 0).toLocaleString()}/mo`} muted />
            <Row label="Property tax" value={`−$${assumptions.property_tax_monthly.toLocaleString()}/mo`} muted />
            <Row label="Insurance" value={`−$${assumptions.insurance_monthly.toLocaleString()}/mo`} muted />
            {assumptions.hoa_monthly > 0 && (
              <Row label="HOA" value={`−$${assumptions.hoa_monthly.toLocaleString()}/mo`} muted />
            )}
            <Row label={`Maintenance (${assumptions.maintenance_pct_annual}%)`} value={`−$${Math.round(assumptions.purchase_price * assumptions.maintenance_pct_annual / 100 / 12).toLocaleString()}/mo`} muted />
            <Row label={`Mgmt (${assumptions.property_mgmt_pct}%)`} value={`−$${Math.round(assumptions.monthly_rent * assumptions.property_mgmt_pct / 100).toLocaleString()}/mo`} muted />
            <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
            <Row
              label="Net cashflow"
              value={`${cf >= 0 ? '+' : ''}$${cf.toLocaleString()}/mo`}
              bold
              color={cf >= 0 ? 'var(--green)' : 'var(--red)'}
            />
          </Section>

          <Section title="Tax Impact (Your Profile)">
            {/* Tax savings highlight */}
            <div style={{
              background: 'var(--text)',
              color: 'var(--bg)',
              borderRadius: 4,
              padding: '14px 18px',
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>
                  Annual Tax Savings
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em' }}>
                  {taxSavings >= 0
                    ? `$${taxSavings.toLocaleString()}`
                    : `−$${Math.abs(taxSavings).toLocaleString()}`}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, opacity: 0.55 }}>
                <div>= ${Math.round(Math.abs(taxSavings) / 12).toLocaleString()}/mo</div>
                <div>effective benefit</div>
              </div>
            </div>

            <Row label="Annual Depreciation" value={`$${results.annual_depreciation.toLocaleString()}`} />
            {isMultiUnit && (
              <Row
                label="Per-Unit Depreciation"
                value={`$${Math.round(results.annual_depreciation / (assumptions.unit_rents?.length ?? 1)).toLocaleString()}/unit`}
              />
            )}
            <Row label="Mortgage Interest (yr 1)" value={`$${mortgageInterest.toLocaleString()}`} muted />
            <Row label="Schedule E Deductions" value={`$${(results.schedule_e_deductions_annual ?? 0).toLocaleString()}`} muted />
            <Row
              label="Schedule E Net"
              value={scheduleENet <= 0
                ? `−$${Math.abs(scheduleENet).toLocaleString()} paper loss`
                : `+$${scheduleENet.toLocaleString()} taxable`}
              muted
            />
            <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
            <Row label="Tax Bracket" value={`${Math.round(bracketUsed * 100)}%`} />
            <Row label="Passive Loss Status" value={palLabel(results.passive_loss_status)} />
            <Row label="Tax-Adjusted COC" value={`${results.tax_adjusted_coc.toFixed(1)}%`} bold color={results.tax_adjusted_coc >= 6 ? 'var(--green)' : 'var(--text)'} />
            <Row label="Break-Even Occupancy" value={`${results.break_even_occupancy.toFixed(0)}%`} />
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Passive losses carry forward. Offset gain at sale or if REP status applies. Estimate only — consult your CPA.
            </div>
          </Section>
        </div>

        {/* Multi-unit: unit breakdown */}
        {isMultiUnit && assumptions.unit_rents && assumptions.unit_rents.length > 0 && (
          <Section title="Unit Breakdown" style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
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
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 3,
                          background: u.status === 'occupied' ? 'var(--green-lt)' : 'var(--red-lt)',
                          color: u.status === 'occupied' ? 'var(--green-dk)' : 'var(--red-dk)',
                        }}>
                          {u.status === 'occupied' ? 'Occupied' : 'Vacant'}
                        </span>
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
            </div>
          </Section>
        )}

        {/* Stress scenarios */}
        <Section title="Stress Scenarios">
          <div style={{ overflowX: 'auto' }}>
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
          </div>
        </Section>

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
        <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/analyze" style={btnPrimary}>+ Fork Scenario</Link>
          <Link href="/compare" style={btnGhost}>Compare Analyses</Link>
          <Link href="/dashboard" style={btnGhost}>← My Analyses</Link>
        </div>
      </div>
    </div>
  )
}

// Helper: derive monthly mortgage from assumptions (mirrors financial-model math)
function computeMortgage(a: Assumptions): number {
  const loanAmount = a.purchase_price * (1 - a.down_payment_pct / 100)
  const mr = a.interest_rate / 100 / 12
  const n = a.loan_term_years * 12
  if (mr === 0) return loanAmount / n
  return (loanAmount * (mr * Math.pow(1 + mr, n))) / (Math.pow(1 + mr, n) - 1)
}

// --- Sub-components ---

function VerdictBadge({ verdict, reason }: { verdict: string; reason: string | null }) {
  const colors: Record<string, { color: string }> = {
    GO: { color: 'var(--green)' },
    CAUTION: { color: 'var(--amber)' },
    PASS: { color: 'var(--text-muted)' },
  }
  const c = colors[verdict] ?? colors.PASS
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', color: c.color, marginBottom: 8 }}>
        {verdict}
      </div>
      {reason && <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 280 }}>{reason}</div>}
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

function Section({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '20px 24px', ...style }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
        {title}
      </div>
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
  background: 'var(--text)',
  color: 'var(--bg)',
  padding: '10px 24px',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  borderRadius: 4,
  display: 'inline-block',
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text-muted)',
  padding: '9px 20px',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  borderRadius: 4,
  border: '1.5px solid var(--border)',
  display: 'inline-block',
}

// Types
interface AnalysisRow {
  id: string
  scenario_name: string | null
  verdict: string
  verdict_reason: string | null
  created_at: string
  assumptions: unknown
  results: unknown
  properties: unknown
}

interface PropertyRow {
  full_address: string
  city: string | null
  state: string | null
  property_type: string | null
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
