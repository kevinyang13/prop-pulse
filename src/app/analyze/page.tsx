'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/layout/Nav'

export default function AnalyzePage() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!address.trim()) return
    setLoading(true)
    // Pass address to loading page via search params
    const params = new URLSearchParams({ address: address.trim() })
    router.push(`/analyze/loading?${params}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav variant="post-auth" />
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 8 }}>
            Analyze a property.
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-muted)' }}>
            Enter an address and get your personalized go/no-go in under 30 seconds.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="4821 Oakwood Dr, San Diego, CA 92115"
              required
              autoFocus
              style={{
                flex: 1,
                padding: '14px 18px',
                fontSize: 15,
                border: '1.5px solid var(--border)',
                borderRadius: 4,
                background: 'var(--surface)',
                color: 'var(--text)',
                outline: 'none',
                fontFamily: 'Inter, sans-serif',
              }}
            />
            <button
              type="submit"
              disabled={loading || !address.trim()}
              style={{
                padding: '14px 28px',
                background: 'var(--text)',
                color: 'var(--bg)',
                border: 'none',
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: loading ? 'wait' : 'pointer',
                opacity: !address.trim() ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? 'Starting…' : 'Analyze →'}
            </button>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            Tip: Include city, state, and zip for best results.
          </div>
          <div style={{ marginTop: 16, fontSize: 13 }}>
            <Link
              href="/analyze/manual"
              style={{ color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              Multi-unit property (duplex/triplex/fourplex)? Enter manually →
            </Link>
          </div>
        </form>

        {/* Assumptions preview */}
        <div style={{ marginTop: 48, padding: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
            Analysis assumptions (from your profile)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: 13 }}>
            <AssumptionRow label="Down payment" value="20%" />
            <AssumptionRow label="Interest rate" value="Pre-filled from FRED" />
            <AssumptionRow label="Vacancy" value="5%" />
            <AssumptionRow label="Management fee" value="8%" />
            <AssumptionRow label="Maintenance" value="1% / yr" />
            <AssumptionRow label="Closing costs" value="1.8%" />
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            All assumptions are editable on the results page.
          </div>
        </div>
      </div>
    </div>
  )
}

function AssumptionRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  )
}
