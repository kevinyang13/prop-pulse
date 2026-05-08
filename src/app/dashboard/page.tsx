import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/layout/Nav'
import DeleteButton from './DeleteButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch analyses with property info
  const { data: analyses } = await supabase
    .from('saved_analyses')
    .select(`
      id, scenario_name, verdict, verdict_reason, created_at, is_starred, notes,
      results, assumptions,
      properties ( full_address, city, state, property_type, beds, baths, list_price )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as { data: AnalysisRow[] | null, error: unknown }

  // Fetch profile for free tier counter
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('analyses_used, onboarding_complete, w2_income')
    .eq('id', user.id)
    .single() as { data: { analyses_used: number; onboarding_complete: boolean; w2_income: number | null } | null, error: unknown }

  const analysesUsed = profile?.analyses_used ?? 0
  const total = analyses?.length ?? 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav variant="post-auth" />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Incomplete profile banner */}
        {!profile?.w2_income && (
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
          <Link href="/analyze" style={{
            background: 'var(--text)',
            color: 'var(--bg)',
            padding: '10px 24px',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            borderRadius: 4,
          }}>
            + New Analysis
          </Link>
        </div>

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
        {analyses && analyses.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {analyses.map((a) => {
              const prop = a.properties as PropertyRow | null
              const results = a.results as { monthly_cashflow?: number; cash_on_cash_return?: number; tax_adjusted_coc?: number } | null
              const cf = results?.monthly_cashflow ?? 0
              const coc = results?.cash_on_cash_return ?? 0

              return (
                <div key={a.id} style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                }}>
                  {/* Verdict badge */}
                  <VerdictBadge verdict={a.verdict} />

                  {/* Property info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>
                      {prop?.full_address ?? 'Unknown address'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                      {[prop?.city, prop?.state].filter(Boolean).join(', ')}
                      {prop?.property_type && ` · ${prop.property_type.toUpperCase()}`}
                      {prop?.list_price && ` · $${(prop.list_price / 1000).toFixed(0)}K`}
                    </div>
                    {/* Scenario chip */}
                    {a.scenario_name && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        background: 'var(--surface-2)',
                        color: 'var(--text-muted)',
                        padding: '2px 8px',
                        borderRadius: 3,
                        display: 'inline-block',
                      }}>
                        {a.scenario_name}
                      </span>
                    )}
                  </div>

                  {/* Metrics */}
                  <div style={{ display: 'flex', gap: 32, flexShrink: 0 }}>
                    <Metric
                      label="Monthly CF"
                      value={`${cf >= 0 ? '+' : ''}$${cf.toLocaleString()}`}
                      positive={cf >= 0}
                    />
                    <Metric
                      label="COC Return"
                      value={`${coc.toFixed(1)}%`}
                      positive={coc >= 5}
                    />
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Link href={`/results/${a.id}`} style={{
                      padding: '7px 16px',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      background: 'var(--text)',
                      color: 'var(--bg)',
                      textDecoration: 'none',
                      borderRadius: 4,
                    }}>
                      View
                    </Link>
                    <DeleteButton analysisId={a.id} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, React.CSSProperties> = {
    GO: { background: '#4ADE80', color: '#1A1A1A' },
    CAUTION: { background: '#FCD34D', color: '#1A1A1A' },
    PASS: { background: '#9CA3AF', color: '#1A1A1A' },
  }
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      padding: '4px 10px',
      borderRadius: 3,
      flexShrink: 0,
      ...styles[verdict] ?? styles.PASS,
    }}>
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

// Types for Supabase join result
interface AnalysisRow {
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

interface PropertyRow {
  full_address: string
  city: string | null
  state: string | null
  property_type: string | null
  beds: number | null
  baths: number | null
  list_price: number | null
}
