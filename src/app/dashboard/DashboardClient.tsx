'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DeleteButton from './DeleteButton'

export interface AnalysisCard {
  id: string
  scenario_name: string | null
  verdict: string
  verdict_reason: string | null
  property_type: string | null
  created_at: string
  assumptions: {
    down_payment_pct?: number
    interest_rate?: number
    purchase_price?: number
    loan_term_years?: number
    property_type?: string
  } | null
  results: {
    monthly_cashflow?: number
    cash_on_cash_return?: number
    tax_adjusted_coc?: number
  } | null
  property: {
    full_address: string
    city: string | null
    state: string | null
    property_type: string | null
    list_price: number | null
  } | null
}

interface Props {
  analyses: AnalysisCard[]
  analysesUsed: number
  hasIncompleteProfile: boolean
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  sfh: 'Single Family', condo: 'Condo', townhouse: 'Townhouse', mfu: 'Multi Family',
  duplex: 'Multi Family', triplex: 'Multi Family', fourplex: 'Multi Family',
}

export default function DashboardClient({ analyses, analysesUsed, hasIncompleteProfile }: Props) {
  const router = useRouter()
  const [compareMode, setCompareMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const total = analyses.length

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 3) {
        next.add(id)
      }
      return next
    })
  }

  function handleCompare() {
    const ids = Array.from(selected).join(',')
    router.push(`/compare?ids=${ids}`)
  }

  function exitCompare() {
    setCompareMode(false)
    setSelected(new Set())
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 80px' }}>

      {/* Incomplete profile banner */}
      {hasIncompleteProfile && (
        <div style={{ marginBottom: 24, padding: '14px 20px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 4, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠ Tax profile incomplete — analyses use 22% default bracket.</span>
          <Link href="/settings" style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'underline', fontSize: 13 }}>
            Complete profile →
          </Link>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 6 }}>My Analyses</h1>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {total} {total === 1 ? 'analysis' : 'analyses'} saved
            {analysesUsed < 3 && (
              <span style={{ marginLeft: 12, color: analysesUsed >= 2 ? 'var(--amber)' : 'var(--text-muted)' }}>
                · Free tier: {analysesUsed} of 3 used
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {total >= 2 && !compareMode && (
            <button
              onClick={() => setCompareMode(true)}
              style={{ padding: '9px 18px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'transparent', color: 'var(--text)', border: '1.5px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
            >
              Compare
            </button>
          )}
          {compareMode && (
            <>
              <button
                onClick={exitCompare}
                style={{ padding: '9px 18px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'transparent', color: 'var(--text-muted)', border: '1.5px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCompare}
                disabled={selected.size < 2}
                style={{ padding: '9px 18px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: selected.size >= 2 ? 'var(--text)' : 'var(--surface-2)', color: selected.size >= 2 ? 'var(--bg)' : 'var(--text-muted)', border: 'none', borderRadius: 4, cursor: selected.size >= 2 ? 'pointer' : 'not-allowed' }}
              >
                Compare {selected.size >= 2 ? `(${selected.size})` : ''}
              </button>
            </>
          )}
          <Link href="/analyze" style={{ background: 'var(--text)', color: 'var(--bg)', padding: '10px 24px', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', borderRadius: 4 }}>
            + New Analysis
          </Link>
        </div>
      </div>

      {/* Compare hint */}
      {compareMode && (
        <div style={{ marginBottom: 20, padding: '12px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13, color: 'var(--text-muted)' }}>
          Select 2 or 3 analyses to compare side by side.
        </div>
      )}

      {/* Free tier warning */}
      {analysesUsed >= 3 && (
        <div style={{ marginBottom: 24, padding: '14px 20px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>You&apos;ve used all 3 free analyses.</span>
          <Link href="/upgrade" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textDecoration: 'none', background: 'var(--accent)', padding: '6px 16px', borderRadius: 4 }}>
            Upgrade to Pro →
          </Link>
        </div>
      )}

      {/* Empty state */}
      {total === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 24px', border: '1.5px dashed var(--border)', borderRadius: 4 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🏠</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No analyses yet.</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>Enter an address to run your first analysis. Free — up to 3 properties, no credit card.</div>
          <Link href="/analyze" style={{ background: 'var(--text)', color: 'var(--bg)', padding: '12px 28px', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', borderRadius: 4 }}>
            Analyze a property →
          </Link>
        </div>
      )}

      {/* Analysis cards */}
      {analyses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {analyses.map((a) => {
            const cf = a.results?.monthly_cashflow ?? 0
            const coc = a.results?.cash_on_cash_return ?? 0
            const isSelected = selected.has(a.id)
            const maxReached = selected.size >= 3 && !isSelected

            return (
              <div
                key={a.id}
                className="dash-card"
                onClick={compareMode && !maxReached ? () => toggleSelect(a.id) : undefined}
                style={{
                  background: 'var(--surface)',
                  border: isSelected ? '2px solid var(--text)' : '1px solid var(--border)',
                  borderRadius: 4,
                  padding: isSelected ? '19px 23px' : '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                  cursor: compareMode ? (maxReached ? 'not-allowed' : 'pointer') : 'default',
                  opacity: maxReached ? 0.5 : 1,
                  transition: 'border 0.1s, opacity 0.1s',
                }}
              >
                {/* Compare checkbox */}
                {compareMode && (
                  <div style={{
                    width: 20, height: 20, borderRadius: 3, flexShrink: 0,
                    border: `2px solid ${isSelected ? 'var(--text)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--text)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && <span style={{ color: 'var(--bg)', fontSize: 12, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </div>
                )}

                {/* Verdict badge */}
                <VerdictBadge verdict={a.verdict} />

                {/* Property info + metrics grouped — metrics move under address on mobile */}
                <div className="dash-card-body" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', width: '100%' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.property?.full_address ?? 'Unknown address'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                      {[a.property?.city, a.property?.state].filter(Boolean).join(', ')}
                      {(a.property_type || a.property?.property_type)
                        ? ` · ${PROPERTY_TYPE_LABELS[a.property_type ?? a.property?.property_type ?? ''] ?? (a.property_type ?? '').toUpperCase()}`
                        : ''}
                      {a.assumptions?.purchase_price
                        ? ` · $${(a.assumptions.purchase_price / 1000).toFixed(0)}K`
                        : a.property?.list_price
                          ? ` · $${(a.property.list_price / 1000).toFixed(0)}K`
                          : ''}
                    </div>
                    {a.assumptions && (
                      <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 3, display: 'inline-block' }}>
                        {a.assumptions.down_payment_pct}% down · {a.assumptions.interest_rate}% · ${computeMortgagePayment(a.assumptions).toLocaleString()}/mo
                      </span>
                    )}
                    {/* Metrics shown here on mobile (below address) */}
                    <div className="dash-card-metrics-mobile" style={{ display: 'none', gap: 20, marginTop: 10 }}>
                      <Metric label="Monthly CF" value={`${cf >= 0 ? '+' : ''}$${cf.toLocaleString()}`} positive={cf >= 0} />
                      <Metric label="COC Return" value={`${coc.toFixed(1)}%`} positive={coc >= 5} />
                    </div>
                  </div>

                  {/* Metrics shown here on desktop (right side) */}
                  <div className="dash-card-metrics-desktop" style={{ display: 'flex', gap: 32, flexShrink: 0 }}>
                    <Metric label="Monthly CF" value={`${cf >= 0 ? '+' : ''}$${cf.toLocaleString()}`} positive={cf >= 0} />
                    <Metric label="COC Return" value={`${coc.toFixed(1)}%`} positive={coc >= 5} />
                  </div>
                </div>

                {/* Actions — hidden in compare mode */}
                {!compareMode && (
                  <div className="dash-card-actions" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Link
                      href={`/results/${a.id}`}
                      onClick={e => e.stopPropagation()}
                      style={{ padding: '7px 16px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--text)', color: 'var(--bg)', textDecoration: 'none', borderRadius: 4 }}
                    >
                      View
                    </Link>
                    <DeleteButton analysisId={a.id} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function computeMortgagePayment(a: { purchase_price?: number; down_payment_pct?: number; interest_rate?: number; loan_term_years?: number }): number {
  const price = a.purchase_price ?? 0
  const loan = price * (1 - (a.down_payment_pct ?? 20) / 100)
  const mr = (a.interest_rate ?? 7) / 100 / 12
  const n = (a.loan_term_years ?? 30) * 12
  if (mr === 0) return Math.round(loan / n)
  return Math.round((loan * (mr * Math.pow(1 + mr, n))) / (Math.pow(1 + mr, n) - 1))
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, React.CSSProperties> = {
    GO: { background: '#4ADE80', color: '#1A1A1A' },
    CAUTION: { background: '#FCD34D', color: '#1A1A1A' },
    PASS: { background: '#9CA3AF', color: '#1A1A1A' },
  }
  return (
    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 3, flexShrink: 0, ...(styles[verdict] ?? styles.PASS) }}>
      {verdict}
    </span>
  )
}

function Metric({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: positive ? 'var(--green)' : 'var(--red)' }}>{value}</div>
    </div>
  )
}
