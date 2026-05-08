'use client'

import Link from 'next/link'
import { signOut } from '@/lib/auth-client'

interface NavProps {
  variant?: 'pre-auth' | 'post-auth' | 'minimal'
}

export default function Nav({ variant = 'pre-auth' }: NavProps) {
  return (
    <nav className="nav-root" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 40px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Link href="/" style={{ textDecoration: 'none' }}>
        <span style={{
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text)',
        }}>
          PROP<span style={{ color: 'var(--accent)' }}>PULSE</span>
        </span>
      </Link>

      {variant === 'post-auth' && (
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          <div className="nav-links" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <Link href="/dashboard" style={{ textDecoration: 'none', color: 'inherit' }}>My Analyses</Link>
            <Link href="/compare" style={{ textDecoration: 'none', color: 'inherit' }}>Compare</Link>
            <Link href="/settings" style={{ textDecoration: 'none', color: 'inherit' }}>Settings</Link>
            <button
              onClick={signOut}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}
            >
              Sign out
            </button>
          </div>
          <Link href="/analyze" className="nav-mobile-cta" style={{
            background: 'var(--text)',
            color: 'var(--bg)',
            padding: '8px 20px',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            borderRadius: 4,
          }}>
            + Analyze
          </Link>
        </div>
      )}

      {variant === 'pre-auth' && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Link href="/login" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>
            Log in
          </Link>
          <Link href="/login" style={{
            background: 'var(--text)',
            color: 'var(--bg)',
            padding: '8px 20px',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            borderRadius: 4,
          }}>
            Try free
          </Link>
        </div>
      )}
    </nav>
  )
}
