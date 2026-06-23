'use client'

import { useEffect, useState } from 'react'
import { TrashIcon, DownloadIcon, LogOutIcon, RefreshIcon, SpinnerIcon, XIcon } from '@/components/Icons'
import { formatBytes, formatDate } from '@/lib/utils'

interface EventStat {
  id: string
  name: string
  eventCode: string
  description: string | null
  createdAt: string
  uploadCount: number
  photoCount: number
  videoCount: number
  totalSize: number
}

type Phase = 'login' | 'dashboard'

export default function OwnerPage() {
  const [phase, setPhase] = useState<Phase>('login')
  const [secret, setSecret] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [events, setEvents] = useState<EventStat[]>([])
  const [totalSize, setTotalSize] = useState(0)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<EventStat | null>(null)

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    const res = await fetch('/api/owner/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret }),
    })
    if (res.ok) {
      setPhase('dashboard')
      loadEvents()
    } else {
      setLoginError('Invalid secret key')
    }
    setLoginLoading(false)
  }

  async function logout() {
    await fetch('/api/owner/auth', { method: 'DELETE' })
    setPhase('login')
    setSecret('')
    setEvents([])
  }

  async function loadEvents() {
    setLoading(true)
    const res = await fetch('/api/owner/events')
    if (res.status === 401) { setPhase('login'); setLoading(false); return }
    if (res.ok) {
      const data = await res.json()
      setEvents(data.events)
      setTotalSize(data.totalSize)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadEvents()
  }, [])

  async function deleteEvent(id: string) {
    setDeletingId(id)
    const res = await fetch(`/api/owner/events/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== id))
      setConfirmDelete(null)
    }
    setDeletingId(null)
  }

  function downloadEvent(id: string) {
    const a = document.createElement('a')
    a.href = `/api/owner/events/${id}/download`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (phase === 'login') {
    return (
      <main className="relative flex flex-col items-center justify-center min-h-screen px-5">
        <div className="orb" style={{ width: 400, height: 400, background: 'var(--purple)', top: '-10%', right: '-15%', opacity: 0.12 }} />
        <div className="relative z-10 w-full max-w-sm flex flex-col gap-6 fade-up">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="btn-circle" style={{ width: 64, height: 64, fontSize: 28, cursor: 'default', background: 'linear-gradient(145deg, rgba(139,92,246,0.5), rgba(6,182,212,0.3))' }}>
              🔑
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>Owner Dashboard</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Full access to all events and storage</p>
          </div>

          <form onSubmit={login} className="glass p-6 flex flex-col gap-4">
            <input
              className="input-glass"
              type="password"
              placeholder="Enter owner secret key"
              value={secret}
              onChange={(e) => { setSecret(e.target.value); setLoginError('') }}
              autoFocus
            />
            {loginError && <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{loginError}</p>}
            <button type="submit" disabled={loginLoading || !secret} className="btn-pill btn-pill-purple w-full" style={{ justifyContent: 'center' }}>
              {loginLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <a href="/" style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', textDecoration: 'none' }}>
            ← Back to home
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="relative flex flex-col min-h-screen">
      <div className="orb" style={{ width: 500, height: 500, background: 'var(--purple)', top: '-15%', right: '-20%', opacity: 0.08 }} />

      {/* Header */}
      <div className="relative z-10 glass" style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', padding: '18px 20px' }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Owner Dashboard</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
              {events.length} event{events.length !== 1 ? 's' : ''} · {formatBytes(totalSize)} total storage used
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadEvents} disabled={loading} className="btn-circle" style={{ width: 40, height: 40 }} title="Refresh">
              {loading ? <SpinnerIcon size={16} /> : <RefreshIcon size={18} />}
            </button>
            <button onClick={logout} className="btn-circle" style={{ width: 40, height: 40 }} title="Sign out">
              <LogOutIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Events list */}
      <div className="relative z-10 flex-1 p-4 flex flex-col gap-3">
        {loading && events.length === 0 ? (
          <div className="flex justify-center py-20"><SpinnerIcon size={32} /></div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div style={{ fontSize: 48 }}>📭</div>
            <p style={{ color: 'var(--text-muted)' }}>No events yet</p>
          </div>
        ) : (
          events.map((ev) => (
            <div key={ev.id} className="glass fade-up" style={{ padding: '18px 20px' }}>
              <div className="flex items-start justify-between gap-4">
                {/* Info */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ev.name}</h2>
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                      background: 'rgba(139,92,246,0.2)', color: 'var(--purple)',
                      borderRadius: 6, padding: '2px 8px'
                    }}>
                      {ev.eventCode}
                    </span>
                  </div>
                  {ev.description && (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>{ev.description}</p>
                  )}

                  {/* Stats row */}
                  <div className="flex flex-wrap gap-4" style={{ marginTop: 12 }}>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>PHOTOS</p>
                      <p style={{ fontSize: 18, fontWeight: 700 }}>{ev.photoCount}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>VIDEOS</p>
                      <p style={{ fontSize: 18, fontWeight: 700 }}>{ev.videoCount}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>TOTAL SIZE</p>
                      <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--cyan)' }}>{formatBytes(ev.totalSize)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>CREATED</p>
                      <p style={{ fontSize: 14, fontWeight: 500 }}>{formatDate(ev.createdAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => downloadEvent(ev.id)}
                    disabled={ev.uploadCount === 0}
                    className="btn-circle btn-circle-purple"
                    style={{ width: 40, height: 40 }}
                    title="Download all files"
                  >
                    <DownloadIcon size={17} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(ev)}
                    className="btn-circle btn-circle-danger"
                    style={{ width: 40, height: 40 }}
                    title="Delete event"
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          onClick={() => setConfirmDelete(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            className="glass"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: 28, borderRadius: 24, maxWidth: 360, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div className="flex items-start justify-between">
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>Delete event?</h2>
              <button onClick={() => setConfirmDelete(null)} className="btn-circle" style={{ width: 34, height: 34, flexShrink: 0 }}>
                <XIcon size={15} />
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
              This will permanently delete <strong style={{ color: 'var(--text)' }}>{confirmDelete.name}</strong> and all {confirmDelete.uploadCount} file{confirmDelete.uploadCount !== 1 ? 's' : ''} ({formatBytes(confirmDelete.totalSize)}) from storage. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-pill" style={{ flex: 1, justifyContent: 'center' }}>
                Cancel
              </button>
              <button
                onClick={() => deleteEvent(confirmDelete.id)}
                disabled={deletingId === confirmDelete.id}
                className="btn-pill btn-pill-danger"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {deletingId === confirmDelete.id ? <SpinnerIcon size={15} /> : <TrashIcon size={15} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
