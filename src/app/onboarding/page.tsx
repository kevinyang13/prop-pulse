'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STATE_TAX_RATES: Record<string, number> = {
  AL: 5.0, AK: 0, AZ: 2.5, AR: 4.7, CA: 9.3, CO: 4.4, CT: 6.99, DE: 6.6,
  FL: 0, GA: 5.49, HI: 11.0, ID: 5.8, IL: 4.95, IN: 3.15, IA: 6.0, KS: 5.7,
  KY: 4.5, LA: 3.0, ME: 7.15, MD: 5.75, MA: 5.0, MI: 4.25, MN: 9.85,
  MS: 5.0, MO: 4.95, MT: 6.75, NE: 6.84, NV: 0, NH: 0, NJ: 10.75,
  NM: 5.9, NY: 10.9, NC: 4.75, ND: 2.5, OH: 3.99, OK: 4.75, OR: 9.9,
  PA: 3.07, RI: 5.99, SC: 7.0, SD: 0, TN: 0, TX: 0, UT: 4.65, VT: 8.75,
  VA: 5.75, WA: 0, WV: 6.5, WI: 7.65, WY: 0,
}

const STATES = Object.keys(STATE_TAX_RATES).sort()

function taxBracket(income: number, filing: string): number {
  // 2024 federal brackets (simplified — single vs MFJ)
  const mfj = filing === 'married_joint'
  if (mfj) {
    if (income <= 23200) return 10
    if (income <= 94300) return 12
    if (income <= 201050) return 22
    if (income <= 383900) return 24
    if (income <= 487450) return 32
    if (income <= 731200) return 35
    return 37
  }
  if (income <= 11600) return 10
  if (income <= 47150) return 12
  if (income <= 100525) return 22
  if (income <= 191950) return 24
  if (income <= 243725) return 32
  if (income <= 609350) return 35
  return 37
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1
  const [income, setIncome] = useState('')
  const [filing, setFiling] = useState('single')

  // Step 2
  const [state, setState] = useState('CA')

  // Step 3
  const [cash, setCash] = useState('')
  const [downPct, setDownPct] = useState('20')

  const bracket = income ? taxBracket(Number(income.replace(/,/g, '')), filing) : null
  const stateTax = STATE_TAX_RATES[state] ?? 0

  async function handleSubmit() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    await supabase.from('user_profiles').update({
      w2_income: income ? Number(income.replace(/,/g, '')) : null,
      filing_status: filing,
      tax_bracket: bracket ? bracket / 100 : 0.22,
      state,
      state_tax_rate: stateTax / 100,
      liquid_cash: cash ? Number(cash.replace(/,/g, '')) : null,
      default_down_pct: Number(downPct),
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)

    router.push('/dashboard')
  }

  async function handleSkip() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_profiles').update({ onboarding_complete: true }).eq('id', user.id)
    }
    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Logo */}
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 40 }}>
        PROP<span style={{ color: 'var(--accent)' }}>PULSE</span>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{
            width: s <= step ? 24 : 8,
            height: 8,
            borderRadius: 4,
            background: s === step ? 'var(--text)' : s < step ? 'var(--accent)' : 'var(--border)',
            transition: 'all 0.2s',
          }} />
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: 36 }}>

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Step 1 of 3</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Income & Filing</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>Powers your personalized tax math on every analysis.</div>

            <label style={labelStyle}>Annual W2 income</label>
            <input
              type="text"
              value={income}
              onChange={e => setIncome(e.target.value)}
              placeholder="$185,000"
              style={inputStyle}
            />
            {bracket && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -8, marginBottom: 20 }}>
                Federal bracket: <strong style={{ color: 'var(--text)' }}>{bracket}%</strong>
              </div>
            )}

            <label style={labelStyle}>Filing status</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
              {[
                ['single', 'Single'],
                ['married_joint', 'Married Filing Jointly'],
                ['married_separate', 'Married Filing Separately'],
                ['head_of_household', 'Head of Household'],
              ].map(([val, label]) => (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer' }}>
                  <input type="radio" name="filing" value={val} checked={filing === val} onChange={() => setFiling(val)} />
                  {label}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setStep(2)} style={primaryBtn}>Continue →</button>
              <button onClick={handleSkip} style={ghostBtn}>Skip for now</button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Step 2 of 3</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>State of Residence</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>Used to calculate your state income tax deduction.</div>

            <label style={labelStyle}>State</label>
            <select value={state} onChange={e => setState(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <div style={{ padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 4, marginBottom: 28, fontSize: 13 }}>
              State income tax rate: <strong>{stateTax}%</strong>
              {stateTax === 0 && <span style={{ color: 'var(--green)', marginLeft: 8 }}>No state income tax ✓</span>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep(1)} style={ghostBtn}>← Back</button>
                <button onClick={() => setStep(3)} style={primaryBtn}>Continue →</button>
              </div>
              <button onClick={handleSkip} style={ghostBtn}>Skip</button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Step 3 of 3</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Cash Available</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>Used to calculate cash-on-cash return and down payment affordability.</div>

            <label style={labelStyle}>Liquid cash for investing</label>
            <input
              type="text"
              value={cash}
              onChange={e => setCash(e.target.value)}
              placeholder="$200,000"
              style={inputStyle}
            />

            <label style={labelStyle}>Default down payment</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
              {['10', '15', '20', '25', '30'].map(pct => (
                <button
                  key={pct}
                  onClick={() => setDownPct(pct)}
                  style={{
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    border: '1.5px solid',
                    borderColor: downPct === pct ? 'var(--text)' : 'var(--border)',
                    background: downPct === pct ? 'var(--text)' : 'transparent',
                    color: downPct === pct ? 'var(--bg)' : 'var(--text)',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  {pct}%
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep(2)} style={ghostBtn}>← Back</button>
                <button onClick={handleSubmit} disabled={saving} style={primaryBtn}>
                  {saving ? 'Saving…' : 'Complete Setup →'}
                </button>
              </div>
              <button onClick={handleSkip} style={ghostBtn}>Skip</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
        Analysis uses 22% default bracket if profile is incomplete.<br />You can update this anytime in Settings.
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: 8,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  fontSize: 14,
  border: '1.5px solid var(--border)',
  borderRadius: 4,
  background: 'var(--bg)',
  color: 'var(--text)',
  marginBottom: 20,
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
}

const primaryBtn: React.CSSProperties = {
  background: 'var(--text)',
  color: 'var(--bg)',
  border: 'none',
  padding: '10px 24px',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  borderRadius: 4,
}

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1.5px solid var(--border)',
  padding: '9px 16px',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.06em',
  cursor: 'pointer',
  borderRadius: 4,
}
