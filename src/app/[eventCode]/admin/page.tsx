'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { TrashIcon, DownloadIcon, QrIcon, RefreshIcon, LogOutIcon, ArrowLeftIcon, SpinnerIcon, XIcon, CopyIcon, CheckIcon } from '@/components/Icons'
import { formatBytes, formatDate } from '@/lib/utils'

interface Event {
  id: string
  name: string
  description: string | null
  eventCode: string
}

interface Upload {
  id: string
  fileType: string
  url: string
  note: string | null
  fileSize: number
  mimeType: string
  createdAt: string
  sessionId: string
}

type AdminPhase = 'login' | 'gallery'

export default function AdminPage() {
  const { eventCode } = useParams<{ eventCode: string }>()
  const code = eventCode.toUpperCase()
  const router = useRouter()

  const [event, setEvent] = useState<Event | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [phase, setPhase] = useState<AdminPhase>('login')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [uploads, setUploads] = useState<Upload[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<Upload | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)

  const photoCount = uploads.filter((u) => u.fileType === 'photo').length
  const videoCount = uploads.filter((u) => u.fileType === 'video').length
  const guestCount = new Set(uploads.map((u) => u.sessionId)).size

  useEffect(() => {
    fetch(`/api/events/${code}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (!data) setNotFound(true); else setEvent(data) })
  }, [code])

  const loadGallery = useCallback(async () => {
    setGalleryLoading(true)
    const res = await fetch(`/api/events/${code}/uploads`)
    if (res.status === 401) { setPhase('login'); setGalleryLoading(false); return }
    if (res.ok) {
      const data = await res.json()
      setUploads(data.uploads)
      setPhase('gallery')
    }
    setGalleryLoading(false)
  }, [code])

  useEffect(() => {
    // Try to load gallery — if 401 the loadGallery will set phase to login
    loadGallery()
  }, [loadGallery])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    const res = await fetch(`/api/events/${code}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      setPhase('gallery')
      loadGallery()
    } else {
      const d = await res.json()
      setLoginError(d.error || 'Incorrect password')
    }
    setLoginLoading(false)
  }

  async function logout() {
    await fetch(`/api/events/${code}/auth`, { method: 'DELETE' })
    setPhase('login')
    setPassword('')
    setUploads([])
  }

  async function deleteUpload(id: string) {
    setDeletingId(id)
    const res = await fetch(`/api/events/${code}/uploads/${id}`, { method: 'DELETE' })
    if (res.ok) setUploads((prev) => prev.filter((u) => u.id !== id))
    setDeletingId(null)
    if (lightbox?.id === id) setLightbox(null)
  }

  function downloadAll() {
    const a = document.createElement('a')
    a.href = `/api/events/${code}/download`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function copyGuestLink() {
    navigator.clipboard.writeText(`${window.location.origin}/${code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (notFound) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-5 text-center px-5">
        <div style={{ fontSize: 48 }}>🔍</div>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Event not found</h2>
        <a href="/" className="btn-pill btn-pill-purple">Go home</a>
      </main>
    )
  }

  if (phase === 'login') {
    return (
      <main className="relative flex flex-col items-center justify-center min-h-screen px-5">
        <div className="orb" style={{ width: 400, height: 400, background: '#fff', top: '-10%', right: '-15%' }} />
        <div className="relative z-10 w-full max-w-sm flex flex-col gap-6 fade-up">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push(`/${code}`)} className="btn-circle" style={{ width: 40, height: 40 }}>
              <ArrowLeftIcon size={18} />
            </button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700 }}>{event?.name || 'Admin'}</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Admin access · Code: {code}</p>
            </div>
          </div>

          <form onSubmit={login} className="glass p-6 flex flex-col gap-4">
            <p style={{ fontWeight: 600 }}>Enter admin password</p>
            <input
              className="input-glass"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setLoginError('') }}
              autoFocus
            />
            {loginError && <p style={{ color: 'var(--text-2)', fontSize: 13 }}>{loginError}</p>}
            <button type="submit" disabled={loginLoading || !password} className="btn-pill btn-pill-purple w-full" style={{ justifyContent: 'center' }}>
              {loginLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="relative flex flex-col min-h-screen">
      <div className="orb" style={{ width: 400, height: 400, background: '#fff', top: '-10%', right: '-15%' }} />

      {/* Top bar */}
      <div className="relative z-10 glass" style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', padding: '16px 20px' }}>
        <div className="flex items-start justify-between gap-4">
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event?.name}</h1>
            <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {photoCount} photos · {videoCount} videos · {guestCount} guests
              </span>
              <button onClick={copyGuestLink} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                {code}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowQr(true)} className="btn-circle" style={{ width: 40, height: 40 }} title="Show QR code">
              <QrIcon size={18} />
            </button>
            <button onClick={loadGallery} disabled={galleryLoading} className="btn-circle" style={{ width: 40, height: 40 }} title="Refresh">
              {galleryLoading ? <SpinnerIcon size={16} /> : <RefreshIcon size={18} />}
            </button>
            <button onClick={downloadAll} disabled={uploads.length === 0} className="btn-circle" style={{ width: 40, height: 40 }} title="Download all">
              <DownloadIcon size={18} />
            </button>
            <button onClick={logout} className="btn-circle" style={{ width: 40, height: 40 }} title="Sign out">
              <LogOutIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div className="relative z-10 flex-1 p-4">
        {galleryLoading && uploads.length === 0 ? (
          <div className="flex justify-center py-20"><SpinnerIcon size={32} /></div>
        ) : uploads.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div style={{ fontSize: 48 }}>📭</div>
            <p style={{ fontSize: 18, fontWeight: 600 }}>No uploads yet</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Share the event code <strong>{code}</strong> with your guests</p>
            <button onClick={() => setShowQr(true)} className="btn-pill btn-pill-purple">Show QR code</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {uploads.map((u) => (
              <div key={u.id} className="glass fade-up" style={{ overflow: 'hidden', padding: 0 }}>
                <button
                  onClick={() => setLightbox(u)}
                  style={{ display: 'block', width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <div style={{ aspectRatio: '1', background: '#000', position: 'relative' }}>
                    {u.fileType === 'photo' ? (
                      <img src={u.url} alt="" className="w-full h-full" style={{ objectFit: 'cover' }} />
                    ) : (
                      <>
                        <video src={u.url} muted preload="metadata" className="w-full h-full" style={{ objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>🎥 video</div>
                      </>
                    )}
                  </div>
                </button>

                <div style={{ padding: '8px 10px 10px' }}>
                  {u.note && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                      {u.note}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(u.createdAt)}</span>
                    <button
                      onClick={() => deleteUpload(u.id)}
                      disabled={deletingId === u.id}
                      className="btn-circle btn-circle-danger"
                      style={{ width: 30, height: 30 }}
                      title="Delete"
                    >
                      {deletingId === u.id ? <SpinnerIcon size={12} /> : <TrashIcon size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.93)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 16 }}
        >
          <button onClick={() => setLightbox(null)} className="btn-circle" style={{ position: 'absolute', top: 20, right: 20, width: 44, height: 44 }}>
            <XIcon size={18} />
          </button>

          {lightbox.fileType === 'photo' ? (
            <img src={lightbox.url} alt="" style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: 16, objectFit: 'contain' }} />
          ) : (
            <video src={lightbox.url} controls style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: 16 }} />
          )}

          {lightbox.note && (
            <div className="glass" style={{ padding: '12px 18px', borderRadius: 16, maxWidth: 480 }}>
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>"{lightbox.note}"</p>
            </div>
          )}

          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
            {formatDate(lightbox.createdAt)} · {formatBytes(lightbox.fileSize)}
          </p>

          <button
            onClick={() => deleteUpload(lightbox.id)}
            disabled={deletingId === lightbox.id}
            className="btn-pill btn-pill-danger"
          >
            {deletingId === lightbox.id ? <SpinnerIcon size={16} /> : <TrashIcon size={16} />}
            Delete
          </button>
        </div>
      )}

      {/* QR Modal */}
      {showQr && (
        <div
          onClick={() => setShowQr(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 }}
        >
          <div
            className="glass"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: 32, borderRadius: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, maxWidth: 360, width: '100%' }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Guest QR Code</h2>
            <img
              src={`/api/events/${code}/qr`}
              alt="QR code"
              style={{ width: 220, height: 220, borderRadius: 16, background: 'var(--bg)' }}
            />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.15em', color: 'var(--purple)' }}>{code}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Guests scan this to join</p>
            </div>
            <div className="flex gap-3 w-full">
              <button onClick={copyGuestLink} className="btn-pill w-full" style={{ flex: 1, justifyContent: 'center' }}>
                {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              <button
                onClick={() => {
                  const a = document.createElement('a')
                  a.href = `/api/events/${code}/qr`
                  a.download = `${code}_qr.png`
                  a.click()
                }}
                className="btn-pill btn-pill-purple"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <DownloadIcon size={16} />
                Save QR
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
