'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function join(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/events/${trimmed}`)
    if (res.ok) {
      router.push(`/${trimmed}`)
    } else {
      setError('Event not found. Check the code and try again.')
      setLoading(false)
    }
  }

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen px-5">
      {/* Background orbs */}
      <div className="orb" style={{ width: 500, height: 500, background: 'var(--purple)', top: '-10%', right: '-15%', opacity: 0.12 }} />
      <div className="orb" style={{ width: 400, height: 400, background: 'var(--cyan)', bottom: '-10%', left: '-15%', opacity: 0.10 }} />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-8 fade-up">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="btn-circle"
            style={{ width: 72, height: 72, background: 'linear-gradient(145deg, rgba(139,92,246,0.5), rgba(6,182,212,0.3))', cursor: 'default', fontSize: 32 }}
          >
            📷
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px' }}>SnapGather</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Capture every moment, together</p>
        </div>

        {/* Join card */}
        <div className="glass w-full p-6 flex flex-col gap-4">
          <p style={{ fontWeight: 600, fontSize: 15 }}>Join an event</p>
          <form onSubmit={join} className="flex flex-col gap-3">
            <input
              className="input-glass"
              placeholder="Enter event code (e.g. ABC123)"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError('') }}
              maxLength={6}
              style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontSize: 18, textAlign: 'center' }}
            />
            {error && <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="btn-pill btn-pill-purple w-full"
              style={{ justifyContent: 'center' }}
            >
              {loading ? 'Joining...' : 'Join Event'}
            </button>
          </form>
        </div>

        <div className="flex items-center gap-4 w-full">
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <a href="/create" className="btn-pill w-full" style={{ justifyContent: 'center' }}>
          Host a new event
        </a>

        <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
          Guests scan a QR code to instantly upload photos and videos to your event gallery.
        </p>
      </div>

      <a
        href="/owner"
        style={{ position: 'fixed', bottom: 20, right: 20, fontSize: 11, color: 'rgba(240,240,255,0.2)', textDecoration: 'none', zIndex: 10 }}
      >
        owner
      </a>
    </main>
  )
}
