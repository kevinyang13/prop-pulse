import Link from 'next/link'
import Nav from '@/components/layout/Nav'

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav variant="pre-auth" />

      {/* Hero */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '100px 24px 80px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          background: 'var(--surface-2)',
          padding: '5px 14px',
          borderRadius: 3,
          marginBottom: 28,
        }}>
          Rental property analysis · Free
        </div>

        <h1 style={{
          fontSize: 56,
          fontWeight: 900,
          letterSpacing: '-0.03em',
          lineHeight: 1.05,
          marginBottom: 24,
          color: 'var(--text)',
        }}>
          Is this rental a<br />
          <span style={{ color: 'var(--accent)' }}>good investment?</span>
        </h1>

        <p style={{
          fontSize: 18,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          maxWidth: 520,
          margin: '0 auto 40px',
        }}>
          Enter an address. Get cashflow, cap rate, COC return, and a personalized
          go/no-go — including your tax impact — in under 30 seconds.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login" style={{
            background: 'var(--text)',
            color: 'var(--bg)',
            padding: '14px 32px',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            borderRadius: 4,
          }}>
            Start free — no card needed →
          </Link>
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          3 analyses free · Takes 30 seconds
        </div>
      </div>

      {/* Feature grid */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 100px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '24px 28px',
            }}>
              <div style={{ fontSize: 22, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '24px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
        PropPulse · Built for real estate investors
      </div>
    </div>
  )
}

const FEATURES = [
  {
    icon: '⚡',
    title: 'Instant analysis',
    desc: 'Geocoding, property data, rent estimates, and financial model — all in under 30 seconds.',
  },
  {
    icon: '🧾',
    title: 'Your tax impact',
    desc: 'Depreciation, PAL rules, and bracket-aware tax savings based on your actual W2 income.',
  },
  {
    icon: '📉',
    title: 'Stress scenarios',
    desc: 'See how the deal holds up if rent drops 10%, vacancy spikes, or rates rise.',
  },
  {
    icon: '🏘️',
    title: 'Multi-scenario',
    desc: 'Fork any analysis — compare 20% down vs house hack vs higher rent assumption.',
  },
  {
    icon: '📊',
    title: 'Full breakdown',
    desc: 'Cashflow, NOI, cap rate, GRM, break-even occupancy — every number explained.',
  },
  {
    icon: '🔒',
    title: 'Private by default',
    desc: 'Your analyses and tax profile are only visible to you. No sharing, no ads.',
  },
]
