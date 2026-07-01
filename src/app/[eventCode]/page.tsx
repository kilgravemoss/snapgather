'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import CameraView, { CaptureResult } from '@/components/CameraView'
import { ArrowLeftIcon, CheckIcon, GalleryIcon, LockIcon, SpinnerIcon } from '@/components/Icons'
import { formatBytes, formatDate } from '@/lib/utils'

const MAX_PHOTOS = 10
const MAX_VIDEOS = 3
const FIVE_HOURS = 5 * 60 * 60 * 1000

type Phase = 'loading' | 'guest-auth' | 'camera' | 'preview' | 'uploading' | 'success' | 'gallery'

interface Upload {
  id: string
  fileType: string
  url: string
  note: string | null
  fileSize: number
  createdAt: string
}

interface Event {
  name: string
  description: string | null
  eventCode: string
  hasGuestPassword: boolean
}

function uploadToR2(url: string, blob: Blob, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', blob.type)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(blob)
  })
}

function getOrCreateSessionId(): string {
  let id = localStorage.getItem('sg_session')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('sg_session', id) }
  return id
}

function saveLastEvent(eventCode: string, name: string) {
  localStorage.setItem('sg_last_event', JSON.stringify({ eventCode, name, ts: Date.now() }))
}

export default function GuestPage() {
  const { eventCode } = useParams<{ eventCode: string }>()
  const code = eventCode.toUpperCase()

  const [event,       setEvent]       = useState<Event | null>(null)
  const [notFound,    setNotFound]    = useState(false)
  const [phase,       setPhase]       = useState<Phase>('loading')
  const [capture,     setCapture]     = useState<CaptureResult | null>(null)
  const [note,        setNote]        = useState('')
  const [progress,    setProgress]    = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [myUploads,   setMyUploads]   = useState<Upload[]>([])
  const [galleryLoading,  setGalleryLoading]  = useState(false)
  const [lightbox,        setLightbox]        = useState<Upload | null>(null)
  const [photosUsed,      setPhotosUsed]      = useState(0)
  const [videosUsed,      setVideosUsed]      = useState(0)
  const [guestPassword,   setGuestPassword]   = useState('')
  const [guestAuthError,  setGuestAuthError]  = useState('')
  const [guestAuthLoading, setGuestAuthLoading] = useState(false)
  const sessionRef = useRef<string>('')

  useEffect(() => {
    sessionRef.current = getOrCreateSessionId()
    fetch(`/api/events/${code}`)
      .then((r) => r.ok ? r.json() : null)
      .then(async (data) => {
        if (!data) { setNotFound(true); return }
        setEvent(data)
        saveLastEvent(data.eventCode, data.name)

        if (data.hasGuestPassword) {
          const authRes = await fetch(`/api/events/${code}/guest-auth`)
          if (authRes.ok) {
            const { authenticated } = await authRes.json()
            if (!authenticated) { setPhase('guest-auth'); return }
          } else {
            setPhase('guest-auth'); return
          }
        }

        await loadUsageCounts()
        setPhase('camera')
      })
  }, [code])

  async function loadUsageCounts() {
    const res = await fetch(`/api/events/${code}/uploads?sessionId=${sessionRef.current}`)
    if (res.ok) {
      const { uploads } = await res.json()
      setPhotosUsed(uploads.filter((u: Upload) => u.fileType === 'photo').length)
      setVideosUsed(uploads.filter((u: Upload) => u.fileType === 'video').length)
    }
  }

  async function handleGuestAuth(e: React.FormEvent) {
    e.preventDefault()
    setGuestAuthError('')
    setGuestAuthLoading(true)
    const res = await fetch(`/api/events/${code}/guest-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: guestPassword }),
    })
    if (res.ok) {
      await loadUsageCounts()
      setPhase('camera')
    } else {
      const d = await res.json()
      setGuestAuthError(d.error || 'Incorrect password')
    }
    setGuestAuthLoading(false)
  }

  async function handleCapture(result: CaptureResult) {
    setCapture(result)
    setNote('')
    setUploadError('')
    setPhase('preview')
  }

  async function handleUpload() {
    if (!capture) return
    setUploadError('')
    setProgress(0)
    setPhase('uploading')

    try {
      const presignRes = await fetch(`/api/events/${code}/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: capture.fileName,
          mimeType: capture.mimeType,
          fileSize: capture.blob.size,
          sessionId: sessionRef.current,
        }),
      })
      if (!presignRes.ok) {
        const d = await presignRes.json()
        throw new Error(d.error || 'Could not get upload URL')
      }
      const { uploadUrl, key } = await presignRes.json()

      await uploadToR2(uploadUrl, capture.blob, setProgress)

      const confirmRes = await fetch(`/api/events/${code}/uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          fileName: capture.fileName,
          fileType: capture.type,
          mimeType: capture.mimeType,
          fileSize: capture.blob.size,
          note: note.trim() || null,
          sessionId: sessionRef.current,
        }),
      })
      if (!confirmRes.ok) throw new Error('Failed to confirm upload')

      // Update local counts
      if (capture.type === 'photo') setPhotosUsed((p) => p + 1)
      else setVideosUsed((v) => v + 1)

      URL.revokeObjectURL(capture.url)
      setPhase('success')
      setTimeout(() => { setCapture(null); setPhase('camera') }, 2200)
    } catch (e: any) {
      setUploadError(e.message || 'Upload failed. Please try again.')
      setPhase('preview')
    }
  }

  async function loadMyPhotos() {
    setGalleryLoading(true)
    setPhase('gallery')
    const res = await fetch(`/api/events/${code}/uploads?sessionId=${sessionRef.current}`)
    if (res.ok) {
      const data = await res.json()
      setMyUploads(data.uploads)
    }
    setGalleryLoading(false)
  }

  const photosLeft = Math.max(0, MAX_PHOTOS - photosUsed)
  const videosLeft = Math.max(0, MAX_VIDEOS - videosUsed)

  if (notFound) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-5 text-center gap-5">
        <div style={{ fontSize: 44 }}>🔍</div>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Event not found</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Check the event code and try again.</p>
        <a href="/" className="btn-pill btn-pill-purple">Go home</a>
      </main>
    )
  }

  if (phase === 'loading') {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="spin" style={{ width: 28, height: 28, border: '2.5px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', borderRadius: '50%' }} />
      </main>
    )
  }

  if (phase === 'guest-auth') {
    return (
      <main className="relative flex flex-col items-center justify-center min-h-screen px-5">
        <div className="orb" style={{ width: 350, height: 350, background: '#fff', top: '-10%', right: '-20%', opacity: 0.1 }} />
        <div className="relative z-10 w-full max-w-sm flex flex-col gap-6 fade-up">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="btn-circle" style={{ width: 64, height: 64, fontSize: 28, cursor: 'default' }}>
              <LockIcon size={26} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700 }}>{event?.name || 'Private event'}</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Enter the guest password to join</p>
            </div>
          </div>

          <form onSubmit={handleGuestAuth} className="glass p-6 flex flex-col gap-4">
            <input
              className="input-glass"
              type="password"
              placeholder="Guest password"
              value={guestPassword}
              onChange={(e) => { setGuestPassword(e.target.value); setGuestAuthError('') }}
              autoFocus
            />
            {guestAuthError && (
              <p style={{ color: 'var(--text-2)', fontSize: 13, textAlign: 'center' }}>{guestAuthError}</p>
            )}
            <button
              type="submit"
              disabled={guestAuthLoading || !guestPassword}
              className="btn-pill btn-pill-purple w-full"
              style={{ justifyContent: 'center' }}
            >
              {guestAuthLoading ? 'Verifying…' : 'Join event'}
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
    <main className="relative flex flex-col min-h-screen px-4 py-5" style={{ paddingBottom: 32 }}>
      <div className="orb" style={{ width: 300, height: 300, background: '#fff', top: '-10%', right: '-20%' }} />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-4">
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px' }}>{event?.name}</h1>
          {event?.description && <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{event.description}</p>}
        </div>
        {phase !== 'gallery' && (
          <button onClick={loadMyPhotos} className="btn-circle" style={{ width: 40, height: 40 }} title="My photos">
            <GalleryIcon size={17} />
          </button>
        )}
        {phase === 'gallery' && (
          <button onClick={() => setPhase('camera')} className="btn-circle" style={{ width: 40, height: 40 }}>
            <ArrowLeftIcon size={17} />
          </button>
        )}
      </div>

      {/* Camera */}
      {phase === 'camera' && (
        <div className="relative z-10 flex-1">
          <CameraView
            onCapture={handleCapture}
            photosLeft={photosLeft}
            videosLeft={videosLeft}
          />
        </div>
      )}

      {/* Preview */}
      {(phase === 'preview' || phase === 'uploading') && capture && (
        <div className="relative z-10 flex-1 flex flex-col gap-3 fade-up">
          <div style={{ borderRadius: 24, overflow: 'hidden', aspectRatio: '3/4', background: '#000' }}>
            {capture.type === 'photo' ? (
              <img src={capture.url} alt="Preview" className="w-full h-full" style={{ objectFit: 'cover' }} />
            ) : (
              <video src={capture.url} controls className="w-full h-full" style={{ objectFit: 'cover' }} />
            )}
          </div>

          <textarea
            className="input-glass"
            placeholder="Add a note… (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={300}
            disabled={phase === 'uploading'}
          />

          {uploadError && <p style={{ color: 'var(--danger)', fontSize: 13, textAlign: 'center' }}>{uploadError}</p>}

          {phase === 'uploading' && (
            <div className="glass" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-2)' }}>
                <span>Uploading…</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{progress}%</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, background: 'rgba(255,255,255,0.9)', width: `${progress}%`, transition: 'width 0.2s ease' }} />
              </div>
            </div>
          )}

          {phase === 'preview' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { URL.revokeObjectURL(capture.url); setCapture(null); setPhase('camera') }} className="btn-pill" style={{ flex: 1, justifyContent: 'center' }}>
                Retake
              </button>
              <button onClick={handleUpload} className="btn-pill btn-pill-purple" style={{ flex: 1, justifyContent: 'center' }}>
                Upload
              </button>
            </div>
          )}
        </div>
      )}

      {/* Success */}
      {phase === 'success' && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-4 fade-up text-center">
          <div className="btn-circle" style={{ width: 72, height: 72, background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.25)', cursor: 'default', color: 'var(--text)' }}>
            <CheckIcon size={32} />
          </div>
          <div>
            <p style={{ fontSize: 20, fontWeight: 700 }}>Uploaded</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              {photosLeft} photo{photosLeft !== 1 ? 's' : ''} · {videosLeft} video{videosLeft !== 1 ? 's' : ''} remaining
            </p>
          </div>
        </div>
      )}

      {/* My Gallery */}
      {phase === 'gallery' && (
        <div className="relative z-10 flex-1 fade-up">
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, letterSpacing: '-0.2px' }}>My uploads</p>
          {galleryLoading ? (
            <div className="flex justify-center py-16">
              <div className="spin" style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', borderRadius: '50%' }} />
            </div>
          ) : myUploads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div style={{ fontSize: 38 }}>📷</div>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No uploads yet</p>
              <button onClick={() => setPhase('camera')} className="btn-pill btn-pill-purple">Open camera</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {myUploads.map((u) => (
                <button key={u.id} onClick={() => setLightbox(u)} className="glass"
                  style={{ padding: 0, overflow: 'hidden', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 16 }}>
                  <div style={{ aspectRatio: '1', background: '#111', position: 'relative' }}>
                    {u.fileType === 'photo' ? (
                      <img src={u.url} alt="" className="w-full h-full" style={{ objectFit: 'cover' }} />
                    ) : (
                      <>
                        <video src={u.url} muted preload="metadata" className="w-full h-full" style={{ objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '2px 7px', fontSize: 10, color: '#fff', fontWeight: 600 }}>VIDEO</div>
                      </>
                    )}
                  </div>
                  {u.note && (
                    <div style={{ padding: '7px 9px', fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                      {u.note}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 }}>
          {lightbox.fileType === 'photo' ? (
            <img src={lightbox.url} alt="" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 14, objectFit: 'contain' }} onClick={(e) => e.stopPropagation()} />
          ) : (
            <video src={lightbox.url} controls style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 14 }} onClick={(e) => e.stopPropagation()} />
          )}
          {lightbox.note && (
            <div className="glass" style={{ padding: '10px 16px', maxWidth: '100%', borderRadius: 14 }} onClick={(e) => e.stopPropagation()}>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-2)' }}>{lightbox.note}</p>
            </div>
          )}
          <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{formatDate(lightbox.createdAt)} · {formatBytes(lightbox.fileSize)}</p>
        </div>
      )}
    </main>
  )
}
