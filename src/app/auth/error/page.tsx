import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>⚠️</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Sign-in failed</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.6 }}>
          Something went wrong during authentication. The link may have expired or already been used.
        </p>
        <Link href="/login" style={{
          background: 'var(--text)',
          color: 'var(--bg)',
          padding: '10px 24px',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          borderRadius: 4,
          display: 'inline-block',
        }}>
          ← Try again
        </Link>
      </div>
    </div>
  )
}
