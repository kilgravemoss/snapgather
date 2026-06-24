'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { FlipCameraIcon, CameraIcon, VideoIcon } from './Icons'
import { formatTime } from '@/lib/utils'

export type CaptureResult = {
  blob: Blob
  url: string
  type: 'photo' | 'video'
  mimeType: string
  fileName: string
}

type Mode = 'photo' | 'video'
type Facing = 'environment' | 'user'

interface Filter {
  id: string
  label: string
  css: string
  grain: number
}

const FILTERS: Filter[] = [
  { id: 'none',       label: 'Original',   css: 'none',                                                                         grain: 0  },
  { id: 'disposable', label: 'Disposable', css: 'sepia(0.28) saturate(1.55) brightness(1.14) contrast(1.08)',                   grain: 42 },
  { id: 'digicam',    label: 'Digicam',    css: 'saturate(1.35) contrast(1.22) brightness(0.94) hue-rotate(-12deg)',            grain: 14 },
  { id: 'vintage',    label: 'Vintage',    css: 'sepia(0.52) saturate(0.88) brightness(1.1) contrast(0.88)',                    grain: 28 },
  { id: 'noir',       label: 'Noir',       css: 'grayscale(1) contrast(1.3) brightness(0.86)',                                  grain: 22 },
]

function applyGrain(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number) {
  if (intensity === 0) return
  const imageData = ctx.getImageData(0, 0, w, h)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * intensity
    d[i]     = Math.min(255, Math.max(0, d[i] + n))
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n))
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n))
  }
  ctx.putImageData(imageData, 0, 0)
}

interface Props {
  onCapture: (r: CaptureResult) => void
  photosLeft: number
  videosLeft: number
}

export default function CameraView({ onCapture, photosLeft, videosLeft }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const chunksRef  = useRef<Blob[]>([])

  const [mode,      setMode]      = useState<Mode>('photo')
  const [facing,    setFacing]    = useState<Facing>('environment')
  const [recording, setRecording] = useState(false)
  const [elapsed,   setElapsed]   = useState(0)
  const [ready,     setReady]     = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [filter,    setFilter]    = useState<Filter>(FILTERS[0])

  const MAX_SECS = 30

  const startCamera = useCallback(async () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    setReady(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: mode === 'video',
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setReady(true)
      setError(null)
    } catch (e: any) {
      setError(
        e.name === 'NotAllowedError'
          ? 'Camera access denied. Please allow camera access in your browser settings and reload.'
          : 'Could not start camera. Please try again.'
      )
    }
  }, [facing, mode])

  useEffect(() => {
    startCamera()
    return () => streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [startCamera])

  useEffect(() => {
    if (!recording) { setElapsed(0); return }
    const id = setInterval(() => {
      setElapsed((s) => {
        if (s >= MAX_SECS - 1) { stopRecording(); return 0 }
        return s + 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [recording])

  const capturePhoto = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    if (filter.css !== 'none') ctx.filter = filter.css
    ctx.drawImage(video, 0, 0)
    ctx.filter = 'none'
    applyGrain(ctx, canvas.width, canvas.height, filter.grain)
    canvas.toBlob((blob) => {
      if (!blob) return
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      onCapture({ blob, url: URL.createObjectURL(blob), type: 'photo', mimeType: 'image/jpeg', fileName: `photo_${ts}.jpg` })
    }, 'image/jpeg', 0.92)
  }, [onCapture, filter])

  const startRecording = useCallback(() => {
    if (!streamRef.current) return
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      .find((m) => MediaRecorder.isTypeSupported(m)) || ''
    chunksRef.current = []
    const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : {})
    recorderRef.current = rec
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = () => {
      const actualMime = rec.mimeType || 'video/webm'
      const ext  = actualMime.includes('mp4') ? 'mp4' : 'webm'
      const blob = new Blob(chunksRef.current, { type: actualMime })
      const ts   = new Date().toISOString().replace(/[:.]/g, '-')
      onCapture({ blob, url: URL.createObjectURL(blob), type: 'video', mimeType: actualMime, fileName: `video_${ts}.${ext}` })
    }
    rec.start(100)
    setRecording(true)
  }, [onCapture])

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    setRecording(false)
  }, [])

  const handleCapture = () => {
    if (mode === 'photo') {
      if (photosLeft <= 0) return
      capturePhoto()
    } else {
      if (recording) stopRecording()
      else { if (videosLeft <= 0) return; startRecording() }
    }
  }

  const toggleMode = () => {
    if (recording) stopRecording()
    setMode((m) => (m === 'photo' ? 'video' : 'photo'))
  }

  const isPhotoMode  = mode === 'photo'
  const canCapture   = isPhotoMode ? photosLeft > 0 : (recording || videosLeft > 0)
  const remaining    = isPhotoMode ? photosLeft : videosLeft
  const limitLabel   = isPhotoMode
    ? `${photosLeft} photo${photosLeft !== 1 ? 's' : ''} left`
    : `${videosLeft} video${videosLeft !== 1 ? 's' : ''} left`

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 p-8 text-center" style={{ minHeight: '55vh' }}>
        <div style={{ fontSize: 44 }}>📷</div>
        <p style={{ color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 280, fontSize: 14 }}>{error}</p>
        <button onClick={startCamera} className="btn-pill btn-pill-purple">Try Again</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 w-full fade-up">
      {/* Camera viewport */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', borderRadius: 28, overflow: 'hidden', background: '#000' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transform: facing === 'user' ? 'scaleX(-1)' : 'none',
            filter: filter.css === 'none' ? undefined : filter.css,
          }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Loading overlay */}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="spin" style={{ width: 32, height: 32, border: '2.5px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', borderRadius: '50%' }} />
          </div>
        )}

        {/* Recording timer */}
        {recording && (
          <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)', borderRadius: 99, padding: '5px 13px' }}>
            <div className="blink" style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffffff' }} />
            <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#fff' }}>
              {formatTime(elapsed)} / {formatTime(MAX_SECS)}
            </span>
          </div>
        )}

        {/* Remaining counter */}
        <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)', borderRadius: 99, padding: '5px 13px' }}>
          <span style={{ fontSize: 12, fontWeight: remaining <= 1 ? 700 : 500, color: 'rgba(255,255,255,0.85)' }}>
            {limitLabel}
          </span>
        </div>

        {/* Bottom controls overlay */}
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 32px 28px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
          }}
        >
          {/* Flip */}
          <button
            onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            className="btn-circle"
            style={{ width: 48, height: 48 }}
          >
            <FlipCameraIcon size={20} />
          </button>

          {/* Shutter */}
          <button
            onClick={handleCapture}
            disabled={!ready || !canCapture}
            className={`btn-shutter ${mode === 'video' ? 'video-mode' : ''} ${recording ? 'recording pulse-record' : ''}`}
            style={{ width: 76, height: 76 }}
          />

          {/* Mode toggle */}
          <button
            onClick={toggleMode}
            className="btn-circle"
            style={{ width: 48, height: 48 }}
          >
            {mode === 'photo' ? <VideoIcon size={19} /> : <CameraIcon size={19} />}
          </button>
        </div>
      </div>

      {/* Filter strip */}
      <div style={{ overflowX: 'auto', display: 'flex', gap: 8, paddingBottom: 4, scrollbarWidth: 'none' }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f)}
            className={`filter-chip ${filter.id === f.id ? 'active' : ''}`}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10, overflow: 'hidden', background: '#111',
              filter: f.css === 'none' ? undefined : f.css,
              border: filter.id === f.id ? '2px solid rgba(255,255,255,0.6)' : '2px solid transparent',
              flexShrink: 0,
            }}>
              {/* Placeholder gradient to show filter color cast */}
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #4a3728 0%, #8b7355 40%, #c4a882 100%)' }} />
            </div>
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* Limit reached message */}
      {!canCapture && (
        <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--danger)', fontSize: 13, fontWeight: 500 }}>
          {isPhotoMode ? 'Photo limit reached (10 max)' : 'Video limit reached (3 max)'}
        </div>
      )}
    </div>
  )
}
