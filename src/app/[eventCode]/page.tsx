'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import CameraView, { CaptureResult } from '@/components/CameraView'
import { ArrowLeftIcon, CheckIcon, GalleryIcon, SpinnerIcon } from '@/components/Icons'
import { formatBytes, formatDate } from '@/lib/utils'

type Phase = 'loading' | 'camera' | 'preview' | 'uploading' | 'success' | 'gallery'

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

export default function GuestPage() {
  const { eventCode } = useParams<{ eventCode: string }>()
  const code = eventCode.toUpperCase()

  const [event, setEvent] = useState<Event | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [phase, setPhase] = useState<Phase>('loading')
  const [capture, setCapture] = useState<CaptureResult | null>(null)
  const [note, setNote] = useState('')
  const [progress, setProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [myUploads, setMyUploads] = useState<Upload[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [lightbox, setLightbox] = useState<Upload | null>(null)
  const sessionRef = useRef<string>('')

  useEffect(() => {
    sessionRef.current = getOrCreateSessionId()
    fetch(`/api/events/${code}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) { setNotFound(true); return }
        setEvent(data)
        setPhase('camera')
      })
  }, [code])

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
      // 1. Get presigned URL
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

      // 2. Upload directly to R2
      await uploadToR2(uploadUrl, capture.blob, setProgress)

      // 3. Confirm with server
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

      URL.revokeObjectURL(capture.url)
      setPhase('success')
      setTimeout(() => { setCapture(null); setPhase('camera') }, 2500)
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

  if (notFound) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-5 text-center gap-5">
        <div style={{ fontSize: 48 }}>🔍</div>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Event not found</h2>
        <p style={{ color: 'var(--text-muted)' }}>Check the event code and try again.</p>
        <a href="/" className="btn-pill btn-pill-purple">Go home</a>
      </main>
    )
  }

  if (phase === 'loading') {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <SpinnerIcon size={32} />
      </main>
    )
  }

  return (
    <main className="relative flex flex-col min-h-screen px-4 py-5">
      <div className="orb" style={{ width: 350, height: 350, background: 'var(--purple)', top: '-15%', right: '-20%', opacity: 0.1 }} />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{event?.name}</h1>
          {event?.description && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>{event.description}</p>}
        </div>
        {phase !== 'gallery' && (
          <button onClick={loadMyPhotos} className="btn-circle" style={{ width: 42, height: 42 }} title="My photos">
            <GalleryIcon size={18} />
          </button>
        )}
        {phase === 'gallery' && (
          <button onClick={() => setPhase('camera')} className="btn-circle" style={{ width: 42, height: 42 }}>
            <ArrowLeftIcon size={18} />
          </button>
        )}
      </div>

      {/* Camera */}
      {phase === 'camera' && (
        <div className="relative z-10 flex-1">
          <CameraView onCapture={handleCapture} />
          <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 16 }}>
            Tap the camera button to take a photo · Hold for video
          </p>
        </div>
      )}

      {/* Preview */}
      {(phase === 'preview' || phase === 'uploading') && capture && (
        <div className="relative z-10 flex-1 flex flex-col gap-4 fade-up">
          <div style={{ borderRadius: 24, overflow: 'hidden', aspectRatio: '3/4', background: '#000' }}>
            {capture.type === 'photo' ? (
              <img src={capture.url} alt="Preview" className="w-full h-full" style={{ objectFit: 'cover' }} />
            ) : (
              <video src={capture.url} controls className="w-full h-full" style={{ objectFit: 'cover' }} />
            )}
          </div>

          <textarea
            className="input-glass"
            placeholder="Add a note... (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={300}
            disabled={phase === 'uploading'}
          />

          {uploadError && <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{uploadError}</p>}

          {phase === 'uploading' && (
            <div className="glass p-4 flex flex-col gap-3">
              <div className="flex justify-between" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                <span>Uploading {capture.type}…</span>
                <span>{progress}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, var(--purple), var(--cyan))', width: `${progress}%`, transition: 'width 0.2s ease' }}
                />
              </div>
            </div>
          )}

          {phase === 'preview' && (
            <div className="flex gap-3">
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
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-5 fade-up text-center">
          <div className="btn-circle" style={{ width: 80, height: 80, background: 'rgba(16,185,129,0.25)', borderColor: 'rgba(16,185,129,0.4)', cursor: 'default', color: 'var(--success)' }}>
            <CheckIcon size={36} />
          </div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700 }}>Uploaded!</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Returning to camera…</p>
          </div>
        </div>
      )}

      {/* My Gallery */}
      {phase === 'gallery' && (
        <div className="relative z-10 flex-1 fade-up">
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>My photos & videos</h2>
          {galleryLoading ? (
            <div className="flex justify-center py-16"><SpinnerIcon size={28} /></div>
          ) : myUploads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div style={{ fontSize: 40 }}>📷</div>
              <p style={{ color: 'var(--text-muted)' }}>No photos yet — take your first shot!</p>
              <button onClick={() => setPhase('camera')} className="btn-pill btn-pill-purple">Open camera</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {myUploads.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setLightbox(u)}
                  className="glass"
                  style={{ padding: 0, overflow: 'hidden', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ aspectRatio: '1', background: '#000', position: 'relative' }}>
                    {u.fileType === 'photo' ? (
                      <img src={u.url} alt="" className="w-full h-full" style={{ objectFit: 'cover' }} />
                    ) : (
                      <>
                        <video src={u.url} muted preload="metadata" className="w-full h-full" style={{ objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '2px 7px', fontSize: 11, color: '#fff' }}>🎥</div>
                      </>
                    )}
                  </div>
                  {u.note && (
                    <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
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
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 16 }}
        >
          {lightbox.fileType === 'photo' ? (
            <img src={lightbox.url} alt="" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 16, objectFit: 'contain' }} onClick={(e) => e.stopPropagation()} />
          ) : (
            <video src={lightbox.url} controls style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 16 }} onClick={(e) => e.stopPropagation()} />
          )}
          {lightbox.note && (
            <div className="glass" style={{ padding: '12px 18px', maxWidth: '100%', borderRadius: 16 }} onClick={(e) => e.stopPropagation()}>
              <p style={{ fontSize: 14, lineHeight: 1.5 }}>{lightbox.note}</p>
            </div>
          )}
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{formatDate(lightbox.createdAt)} · {formatBytes(lightbox.fileSize)}</p>
        </div>
      )}
    </main>
  )
}
