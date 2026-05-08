'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const STEPS = [
  { label: 'Geocoding address', source: 'Mapbox' },
  { label: 'Fetching property data', source: 'Rentcast' },
  { label: 'Getting rent estimate', source: 'Rentcast' },
  { label: 'Checking neighborhood signals', source: 'Walk Score' },
  { label: 'Environmental risk lookup', source: 'FEMA · First Street' },
  { label: 'Census demographics', source: 'Census ACS' },
  { label: 'Computing your tax impact', source: '' },
  { label: 'Generating verdict', source: '' },
]

function LoadingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const address = searchParams.get('address') ?? ''
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!address) {
      router.push('/analyze')
      return
    }

    const controller = new AbortController()

    async function runAnalysis() {
      try {
        const stepInterval = setInterval(() => {
          setCurrentStep(s => Math.min(s + 1, STEPS.length - 1))
        }, 1200)

        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address }),
          signal: controller.signal,
        })

        clearInterval(stepInterval)
        setCurrentStep(STEPS.length)

        if (!res.ok) {
          const data = await res.json()
          if (data.error === 'free_limit_reached') {
            router.push('/upgrade?reason=limit')
            return
          }
          if (data.needs_manual_entry) {
            const params = new URLSearchParams({ address })
            router.push(`/analyze/manual?${params}`)
            return
          }
          throw new Error(data.message ?? 'Analysis failed')
        }

        const data = await res.json()
        router.push(`/results/${data.analysis_id}`)
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      }
    }

    runAnalysis()
    return () => controller.abort()
  }, [address, router])

  const pct = Math.round((currentStep / STEPS.length) * 100)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Address */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
            Analyzing
          </div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{address}</div>
        </div>

        {/* Progress bar */}
        <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, marginBottom: 32, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: 'var(--text)',
            borderRadius: 4,
            transition: 'width 0.4s ease',
          }} />
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {STEPS.map((step, i) => {
            const done = i < currentStep
            const active = i === currentStep
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: i > currentStep ? 0.35 : 1 }}>
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: done ? 'none' : active ? '2px solid var(--text)' : '2px solid var(--border)',
                  background: done ? 'var(--text)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 11,
                  color: 'var(--bg)',
                  fontWeight: 700,
                }}>
                  {done ? '✓' : active ? <Spinner /> : ''}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: done || active ? 600 : 400 }}>{step.label}</span>
                  {step.source && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{step.source}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 36, fontSize: 12, color: 'var(--text-muted)' }}>
          Usually takes 8–15 seconds
        </div>

        {error && (
          <div style={{ marginTop: 24, padding: '14px 18px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, fontSize: 14, color: 'var(--red)' }}>
            <strong>Error:</strong> {error}
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => router.push('/analyze')}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                ← Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{
      width: 10,
      height: 10,
      border: '2px solid var(--border)',
      borderTop: '2px solid var(--text)',
      borderRadius: '50%',
      animation: 'spin 0.6s linear infinite',
    }} />
  )
}

export default function LoadingPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <LoadingContent />
    </Suspense>
  )
}
