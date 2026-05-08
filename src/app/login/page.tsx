'use client'

import { useState } from 'react'
import { signInWithGoogle, signInWithMagicLink } from '@/lib/auth-client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  async function handleGoogle() {
    try {
      await signInWithGoogle()
    } catch {
      setError('Sign-in failed. Try again or use email link.')
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email || cooldown > 0) return
    setLoading(true)
    setError(null)
    try {
      await signInWithMagicLink(email)
      setSent(true)
      // 60s cooldown
      let t = 60
      setCooldown(t)
      const iv = setInterval(() => {
        t -= 1
        setCooldown(t)
        if (t <= 0) clearInterval(iv)
      }, 1000)
    } catch {
      setError('Failed to send link. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Logo */}
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
          PROP<span style={{ color: 'var(--accent)' }}>PULSE</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Sign in to continue.</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Free · No credit card · 3 analyses</div>
      </div>

      <div style={{ width: '100%', maxWidth: 380, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: 32 }}>
        {/* Google */}
        <button
          onClick={handleGoogle}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '12px 20px',
            background: 'var(--text)',
            color: 'var(--bg)',
            border: 'none',
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.02em',
          }}
        >
          <GoogleIcon />
          Sign in with Google
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Magic link */}
        {!sent ? (
          <form onSubmit={handleMagicLink}>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: 14,
                border: '1.5px solid var(--border)',
                borderRadius: 4,
                background: 'var(--bg)',
                color: 'var(--text)',
                marginBottom: 12,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={loading || cooldown > 0}
              style={{
                width: '100%',
                padding: '10px 20px',
                background: 'transparent',
                color: 'var(--text)',
                border: '1.5px solid var(--border)',
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: loading || cooldown > 0 ? 'not-allowed' : 'pointer',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                opacity: loading || cooldown > 0 ? 0.5 : 1,
              }}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : loading ? 'Sending…' : 'Send me a sign-in link'}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>✉️</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Check your inbox.</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Link expires in 1 hour.</div>
            {cooldown > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
                Resend in {cooldown}s
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, fontSize: 13, color: 'var(--red)' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}
