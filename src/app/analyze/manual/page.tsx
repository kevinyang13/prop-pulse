'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Nav from '@/components/layout/Nav'

function ManualEntryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const address = searchParams.get('address') ?? ''

  const [form, setForm] = useState({
    list_price: '',
    monthly_rent: '',
    property_tax_annual: '',
    hoa_monthly: '0',
    beds: '',
    baths: '',
    sqft: '',
    year_built: '',
    property_type: 'sfh',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/analyze/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          property: {
            list_price: Number(form.list_price),
            monthly_rent: Number(form.monthly_rent),
            property_tax_annual: Number(form.property_tax_annual),
            hoa_monthly: Number(form.hoa_monthly),
            beds: form.beds ? Number(form.beds) : null,
            baths: form.baths ? Number(form.baths) : null,
            sqft: form.sqft ? Number(form.sqft) : null,
            year_built: form.year_built ? Number(form.year_built) : null,
            property_type: form.property_type,
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        if (data.error === 'free_limit_reached') {
          router.push('/upgrade?reason=limit')
          return
        }
        throw new Error(data.message ?? 'Analysis failed')
      }

      const data = await res.json()
      router.push(`/results/${data.analysis_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav variant="post-auth" />

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
            Manual entry
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Enter property details</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {address || 'Property not found in database — enter details manually.'}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Required fields */}
            <Section label="Required">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="List / purchase price ($)" value={form.list_price} onChange={set('list_price')} required placeholder="450000" />
                <Field label="Monthly rent estimate ($)" value={form.monthly_rent} onChange={set('monthly_rent')} required placeholder="2400" />
                <Field label="Annual property tax ($)" value={form.property_tax_annual} onChange={set('property_tax_annual')} required placeholder="5400" />
                <Field label="Monthly HOA ($)" value={form.hoa_monthly} onChange={set('hoa_monthly')} placeholder="0" />
              </div>
            </Section>

            {/* Property details */}
            <Section label="Property details (optional)">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Property type</label>
                  <select
                    value={form.property_type}
                    onChange={set('property_type')}
                    style={inputStyle}
                  >
                    <option value="sfh">Single Family</option>
                    <option value="condo">Condo</option>
                    <option value="townhouse">Townhouse</option>
                    <option value="duplex">Duplex</option>
                    <option value="triplex">Triplex</option>
                    <option value="fourplex">Fourplex</option>
                  </select>
                </div>
                <Field label="Year built" value={form.year_built} onChange={set('year_built')} placeholder="2005" />
                <Field label="Beds" value={form.beds} onChange={set('beds')} placeholder="3" />
                <Field label="Baths" value={form.baths} onChange={set('baths')} placeholder="2" />
                <Field label="Sq ft" value={form.sqft} onChange={set('sqft')} placeholder="1400" />
              </div>
            </Section>

            {error && (
              <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, fontSize: 13, color: 'var(--red)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '13px 28px',
                background: 'var(--text)',
                color: 'var(--bg)',
                border: 'none',
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Analyzing…' : 'Run Analysis →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '20px 24px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="number"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        min="0"
        style={inputStyle}
      />
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  display: 'block',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  fontSize: 14,
  border: '1.5px solid var(--border)',
  borderRadius: 4,
  background: 'var(--bg)',
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
  boxSizing: 'border-box',
}

export default function ManualEntryPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <ManualEntryContent />
    </Suspense>
  )
}
