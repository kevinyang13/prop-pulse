'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteButton({ analysisId }: { analysisId: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm('Delete this analysis? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/analyses/${analysisId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      router.refresh()
    } catch {
      alert('Delete failed. Try again.')
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      title="Delete analysis"
      style={{
        padding: '7px 10px',
        fontSize: 14,
        lineHeight: 1,
        background: 'transparent',
        color: 'var(--text-muted)',
        border: '1.5px solid var(--border)',
        borderRadius: 4,
        cursor: deleting ? 'wait' : 'pointer',
        opacity: deleting ? 0.5 : 1,
        transition: 'color 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        const t = e.currentTarget
        t.style.color = 'var(--red)'
        t.style.borderColor = 'var(--red)'
      }}
      onMouseLeave={e => {
        const t = e.currentTarget
        t.style.color = 'var(--text-muted)'
        t.style.borderColor = 'var(--border)'
      }}
    >
      {deleting ? '…' : '×'}
    </button>
  )
}
