import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/layout/Nav'
import type { Results, Assumptions } from '@/types/analysis'

interface Props {
  searchParams: Promise<{ ids?: string }>
}

export default async function ComparePage({ searchParams }: Props) {
  const { ids } = await searchParams
  const idList = (ids ?? '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3)

  if (idList.length < 2) redirect('/dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rows } = await supabase
    .from('saved_analyses')
    .select(`
      id, scenario_name, verdict, verdict_reason, property_type,
      assumptions, results,
      properties ( full_address, city, state, list_price, beds, baths, sqft, year_built )
    `)
    .in('id', idList)
    .eq('user_id', user.id) as { data: RawRow[] | null, error: unknown }

  if (!rows || rows.length < 2) notFound()

  // Preserve URL order
  const analyses = idList
    .map(id => rows.find(r => r.id === id))
    .filter((r): r is RawRow => !!r)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav variant="post-auth" />
      <CompareTable analyses={analyses} />
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawRow {
  id: string
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
  list_price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  year_built: number | null
}

// ── Compare Table (server component) ──────────────────────────────────────────

function CompareTable({ analyses }: { analyses: RawRow[] }) {
  const count = analyses.length
  const cols = `220px repeat(${count}, 1fr)`

  type Results = {
    monthly_cashflow: number
    annual_cashflow: number
    cash_on_cash_return: number
    tax_adjusted_coc: number
    cap_rate: number
    noi: number
    break_even_occupancy: number
    annual_depreciation: number
    tax_savings_annual: number
    tax_bracket_used: number
    passive_loss_status: string
    stress_scenarios: Array<{ outcome: string }>
    verdict: string
    verdict_reason?: string
  }

  type Assumptions = {
    purchase_price: number
    down_payment_pct: number
    closing_cost_pct: number
    interest_rate: number
    loan_term_years: number
    monthly_rent: number
  }

  const results: Results[] = analyses.map(a => a.results as Results)
  const assumptions: Assumptions[] = analyses.map(a => a.assumptions as Assumptions)
  const properties: (PropertyRow | null)[] = analyses.map(a => a.properties as PropertyRow | null)

  // Helper: index of best value (higher = better unless invert=true)
  function bestIdx(vals: (number | null)[], invert = false): number {
    let best = -1
    let bestVal = invert ? Infinity : -Infinity
    vals.forEach((v, i) => {
      if (v == null) return
      if (invert ? v < bestVal : v > bestVal) { bestVal = v; best = i }
    })
    return best
  }

  function palRank(s: string) {
    return s === 'full' ? 2 : s === 'phase_out' ? 1 : 0
  }

  function palLabel(s: string) {
    return s === 'full' ? 'Full deduction' : s === 'phase_out' ? 'Phase-out' : 'Suspended'
  }

  const verdictColors: Record<string, string> = { GO: '#4ADE80', CAUTION: '#FCD34D', PASS: '#9CA3AF' }

  // Section winner: returns index of best-performing analysis in a section (by sum of wins)
  function sectionWinner(idxList: number[]): number {
    const counts = analyses.map((_, i) => idxList.filter(x => x === i).length)
    return counts.indexOf(Math.max(...counts))
  }

  // ── Row render helpers ─────────────────────────────────────────────────────

  function LabelCell({ label, sub }: { label: string; sub?: string }) {
    return (
      <div style={{ background: 'var(--surface-2)', padding: '14px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: sub ? 2 : 0 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
    )
  }

  function ValCell({ value, sub, winnerIdx, colIdx, fmt }: {
    value: string; sub?: string; winnerIdx: number; colIdx: number; fmt?: 'pos' | 'neg' | 'neu'
  }) {
    const isWinner = winnerIdx === colIdx
    const color = fmt === 'pos' ? 'var(--green)' : fmt === 'neg' ? 'var(--red)' : 'var(--text)'
    return (
      <div style={{ background: isWinner ? '#F5FBF7' : 'var(--bg)', padding: '14px 16px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
        {isWinner && <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: 'var(--green)' }} />}
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em', color, marginBottom: sub ? 2 : 0 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{sub}</div>}
      </div>
    )
  }

  function SectionHeader({ label, winnerIdx }: { label: string; winnerIdx: number }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: cols, background: 'var(--border)', gap: 0 }}>
        <div style={{ background: 'var(--text)', padding: '12px 20px', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--bg)' }}>{label}</span>
        </div>
        {analyses.map((_, i) => (
          <div key={i} style={{ background: 'rgba(26,26,26,0.92)', padding: '12px 16px', display: 'flex', alignItems: 'center' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '3px 10px', borderRadius: 2,
              background: winnerIdx === i ? '#4ADE80' : 'rgba(255,255,255,0.1)',
              color: winnerIdx === i ? '#1A1A1A' : 'rgba(250,250,248,0.45)',
            }}>
              {winnerIdx === i ? '✓ Best' : '—'}
            </span>
          </div>
        ))}
      </div>
    )
  }

  function Row({ label, sub, vals, invert = false, fmt }: {
    label: string; sub?: string
    vals: Array<{ display: string; sub?: string; raw: number | null }>
    invert?: boolean
    fmt?: (raw: number | null, isWinner: boolean) => 'pos' | 'neg' | 'neu'
  }) {
    const winner = bestIdx(vals.map(v => v.raw), invert)
    return (
      <div style={{ display: 'grid', gridTemplateColumns: cols, background: 'var(--border)', gap: 0 }}>
        <LabelCell label={label} sub={sub} />
        {vals.map((v, i) => (
          <ValCell
            key={i}
            value={v.display}
            sub={v.sub}
            winnerIdx={winner}
            colIdx={i}
            fmt={fmt ? fmt(v.raw, winner === i) : 'neu'}
          />
        ))}
      </div>
    )
  }

  // ── Compute section winners ────────────────────────────────────────────────

  const cfWinners = [bestIdx(results.map(r => r.monthly_cashflow))]
  const cocWinners = [bestIdx(results.map(r => r.cash_on_cash_return))]
  const capWinners = [bestIdx(results.map(r => r.cap_rate))]
  const beWinners = [bestIdx(results.map(r => r.break_even_occupancy), true)]
  const finWinner = sectionWinner([...cfWinners, ...cocWinners, ...capWinners, ...beWinners])

  const taxWinners = [bestIdx(results.map(r => r.tax_savings_annual))]
  const tacWinners = [bestIdx(results.map(r => r.tax_adjusted_coc))]
  const palWinners = [bestIdx(results.map(r => palRank(r.passive_loss_status)))]
  const taxWinner = sectionWinner([...taxWinners, ...tacWinners, ...palWinners])

  const stressCounts = results.map(r => {
    const nonBase = r.stress_scenarios.filter(s => s.outcome !== 'base')
    return nonBase.filter(s => s.outcome === 'positive').length
  })
  const resWinner = bestIdx(stressCounts)

  const totalCashIn = assumptions.map(a =>
    a.purchase_price * (a.down_payment_pct / 100) + a.purchase_price * (a.closing_cost_pct / 100)
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Link href="/dashboard" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          ← My Analyses
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', marginTop: 12, marginBottom: 6 }}>Analysis Comparison</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Side-by-side · green border marks the best value in each row.</p>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>

        {/* Property selector bar */}
        <div style={{ display: 'grid', gridTemplateColumns: cols, background: 'var(--border)', gap: 0 }}>
          <div style={{ background: 'var(--surface-2)', padding: '16px 20px', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Properties</span>
          </div>
          {analyses.map((a, i) => {
            const prop = properties[i]
            return (
              <div key={a.id} style={{ background: 'var(--surface)', padding: '14px 16px', borderTop: finWinner === i ? '3px solid #4ADE80' : '3px solid transparent' }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                  <span style={{ padding: '3px 8px', borderRadius: 2, background: verdictColors[a.verdict] ?? '#9CA3AF', color: '#1A1A1A' }}>
                    {a.verdict}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, marginBottom: 3 }}>
                  {prop?.full_address ?? 'Unknown'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {[prop?.city, prop?.state].filter(Boolean).join(', ')}
                  {a.property_type && ` · ${a.property_type.toUpperCase()}`}
                </div>
                {a.scenario_name && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', padding: '2px 7px', borderRadius: 3 }}>
                      {a.scenario_name}
                    </span>
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <Link href={`/results/${a.id}`} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text)', textDecoration: 'none', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 3 }}>
                    View full →
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Section: Financial Metrics ── */}
        <SectionHeader label="Financial Metrics" winnerIdx={finWinner} />

        <Row
          label="Monthly Cashflow"
          vals={results.map(r => ({
            display: `${r.monthly_cashflow >= 0 ? '+' : ''}$${r.monthly_cashflow.toLocaleString()}`,
            sub: `$${r.annual_cashflow.toLocaleString()}/yr`,
            raw: r.monthly_cashflow,
          }))}
          fmt={(raw, isWinner) => raw == null ? 'neu' : raw >= 0 ? 'pos' : 'neg'}
        />
        <Row
          label="Cash-on-Cash Return"
          vals={results.map(r => ({ display: `${r.cash_on_cash_return.toFixed(1)}%`, raw: r.cash_on_cash_return }))}
          fmt={(raw) => raw == null ? 'neu' : raw >= 6 ? 'pos' : raw >= 3 ? 'neu' : 'neg'}
        />
        <Row
          label="Cap Rate"
          sub="NOI / purchase price"
          vals={results.map((r, i) => ({ display: `${r.cap_rate.toFixed(1)}%`, sub: `NOI $${r.noi.toLocaleString()}/yr`, raw: r.cap_rate }))}
          fmt={(raw) => raw == null ? 'neu' : raw >= 6 ? 'pos' : 'neu'}
        />
        <Row
          label="Break-Even Occupancy"
          sub="Lower is better"
          vals={results.map(r => ({ display: `${r.break_even_occupancy.toFixed(0)}%`, raw: r.break_even_occupancy }))}
          invert
          fmt={(raw) => raw == null ? 'neu' : raw <= 80 ? 'pos' : raw <= 90 ? 'neu' : 'neg'}
        />
        <Row
          label="Total Cash Required"
          sub="Down + closing costs"
          vals={totalCashIn.map((v, i) => ({
            display: `$${v.toLocaleString()}`,
            sub: `${assumptions[i].down_payment_pct}% down · ${assumptions[i].closing_cost_pct}% closing`,
            raw: -v,
          }))}
          invert
        />

        {/* ── Section: Tax Impact ── */}
        <SectionHeader label="Tax Impact" winnerIdx={taxWinner} />

        <Row
          label="Annual Tax Savings"
          vals={results.map(r => ({ display: `$${(r.tax_savings_annual ?? 0).toLocaleString()}`, raw: r.tax_savings_annual ?? 0 }))}
          fmt={(raw) => raw == null ? 'neu' : raw > 0 ? 'pos' : 'neu'}
        />
        <Row
          label="Annual Depreciation"
          vals={results.map(r => ({ display: `$${r.annual_depreciation.toLocaleString()}`, raw: r.annual_depreciation }))}
        />
        <Row
          label="Tax-Adjusted COC"
          vals={results.map(r => ({ display: `${r.tax_adjusted_coc.toFixed(1)}%`, raw: r.tax_adjusted_coc }))}
          fmt={(raw) => raw == null ? 'neu' : raw >= 6 ? 'pos' : 'neu'}
        />
        <Row
          label="Passive Loss Status"
          vals={results.map(r => ({ display: palLabel(r.passive_loss_status), raw: palRank(r.passive_loss_status) }))}
        />

        {/* ── Section: Downside Resilience ── */}
        <SectionHeader label="Downside Resilience" winnerIdx={resWinner} />

        <Row
          label="Stress Scenarios Positive"
          sub="Of non-base scenarios"
          vals={results.map((r, i) => {
            const nonBase = r.stress_scenarios.filter(s => s.outcome !== 'base')
            const pos = nonBase.filter(s => s.outcome === 'positive').length
            return { display: `${pos} of ${nonBase.length}`, raw: pos }
          })}
          fmt={(raw) => raw == null ? 'neu' : raw >= 2 ? 'pos' : raw === 1 ? 'neu' : 'neg'}
        />
        <Row
          label="Interest Rate"
          vals={assumptions.map(a => ({ display: `${a.interest_rate}%`, sub: `${a.loan_term_years}yr fixed`, raw: -a.interest_rate }))}
          invert
        />
        <Row
          label="Monthly Rent"
          vals={assumptions.map(a => ({ display: `$${a.monthly_rent.toLocaleString()}`, raw: a.monthly_rent }))}
        />

        {/* ── Overall Verdict row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: cols, background: 'var(--border)', gap: 0 }}>
          <div style={{ background: 'var(--text)', padding: '24px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--bg)', marginBottom: 4 }}>PropPulse Verdict</div>
            <div style={{ fontSize: 11, color: 'rgba(250,250,248,0.5)' }}>Overall recommendation</div>
          </div>
          {analyses.map((a, i) => (
            <div key={i} style={{ background: 'var(--text)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: 2, width: 'fit-content', background: verdictColors[a.verdict] ?? '#9CA3AF', color: '#1A1A1A' }}>
                {a.verdict}
              </span>
              {a.verdict_reason && (
                <div style={{ fontSize: 12, color: 'rgba(250,250,248,0.6)', lineHeight: 1.6 }}>
                  {a.verdict_reason}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div style={{ display: 'grid', gridTemplateColumns: cols, background: 'var(--border)', gap: 0 }}>
          <div style={{ background: 'var(--surface-2)', padding: '20px' }} />
          {analyses.map((a, i) => (
            <div key={i} style={{ background: 'var(--bg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href={`/results/${a.id}`} style={{ background: 'var(--text)', color: 'var(--bg)', border: 'none', padding: '10px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 4, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                View Full Analysis
              </Link>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
