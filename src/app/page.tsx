'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const FIVE_HOURS = 5 * 60 * 60 * 1000

function getLastEvent(): { eventCode: string; name: string } | null {
  try {
    const raw = localStorage.getItem('sg_last_event')
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() - data.ts > FIVE_HOURS) { localStorage.removeItem('sg_last_event'); return null }
    return data
  } catch { return null }
}

export default function Home() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastEvent, setLastEvent] = useState<{ eventCode: string; name: string } | null>(null)

  useEffect(() => {
    setLastEvent(getLastEvent())
  }, [])

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
      <div className="orb" style={{ width: 500, height: 500, background: '#fff', top: '-10%', right: '-15%' }} />
      <div className="orb" style={{ width: 400, height: 400, background: '#fff', bottom: '-10%', left: '-15%' }} />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-8 fade-up">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div style={{ width: 104, height: 76, cursor: 'default' }}>
            <img src="/logo.svg" alt="SnapGather" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px' }}>SnapGather</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Capture every moment, together</p>
        </div>

        {/* Continue card — only shows within 5 hours of last visit */}
        {lastEvent && (
          <button
            onClick={() => router.push(`/${lastEvent.eventCode}`)}
            className="glass w-full fade-up"
            style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', textAlign: 'left' }}
          >
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 3 }}>CONTINUE</p>
              <p style={{ fontSize: 15, fontWeight: 600 }}>{lastEvent.name}</p>
            </div>
            <span style={{ fontSize: 20 }}>→</span>
          </button>
        )}

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
