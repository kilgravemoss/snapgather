'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, CopyIcon, CheckIcon } from '@/components/Icons'

export default function CreateEvent() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ eventCode: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); return }
      setCreated(data)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function copy() {
    if (!created) return
    const url = `${window.location.origin}/${created.eventCode}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (created) {
    return (
      <main className="relative flex flex-col items-center justify-center min-h-screen px-5">
        <div className="orb" style={{ width: 500, height: 500, background: 'var(--purple)', top: '-10%', right: '-15%', opacity: 0.12 }} />
        <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-6 fade-up text-center">
          <div style={{ fontSize: 56 }}>🎉</div>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700 }}>Event created!</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>Share this code with your guests</p>
          </div>

          <div className="glass w-full p-6 flex flex-col gap-5">
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>EVENT CODE</p>
              <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '0.15em', color: 'var(--purple)' }}>
                {created.eventCode}
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>GUEST LINK</p>
              <p style={{ fontSize: 14, wordBreak: 'break-all', color: 'var(--text-muted)' }}>
                {typeof window !== 'undefined' ? window.location.origin : ''}/{created.eventCode}
              </p>
            </div>

            <button onClick={copy} className="btn-pill w-full" style={{ justifyContent: 'center', gap: 8 }}>
              {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
              {copied ? 'Copied!' : 'Copy guest link'}
            </button>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <button onClick={() => router.push(`/${created.eventCode}/admin`)} className="btn-pill btn-pill-purple w-full" style={{ justifyContent: 'center' }}>
              Go to admin panel
            </button>
            <button onClick={() => router.push(`/${created.eventCode}`)} className="btn-pill w-full" style={{ justifyContent: 'center' }}>
              Preview guest view
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen px-5 py-10">
      <div className="orb" style={{ width: 400, height: 400, background: 'var(--purple)', top: '-10%', left: '-10%', opacity: 0.1 }} />

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-6 fade-up">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')} className="btn-circle" style={{ width: 40, height: 40 }}>
            <ArrowLeftIcon size={18} />
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Create event</h1>
        </div>

        <form onSubmit={submit} className="glass p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Event name *</label>
            <input
              className="input-glass"
              placeholder="Sarah & Mike's Wedding"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Description (optional)</label>
            <textarea
              className="input-glass"
              placeholder="June 23, 2026 · Grand Ballroom"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          <div className="flex flex-col gap-2">
            <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Admin password *</label>
            <input
              className="input-glass"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Confirm password *</label>
            <input
              className="input-glass"
              type="password"
              placeholder="Repeat password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim() || !password || !confirm}
            className="btn-pill btn-pill-purple w-full"
            style={{ justifyContent: 'center', marginTop: 4 }}
          >
            {loading ? 'Creating...' : 'Create event'}
          </button>
        </form>

        <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
          A unique 6-character code will be generated for your guests to join.
        </p>
      </div>
    </main>
  )
}
