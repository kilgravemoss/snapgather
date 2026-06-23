'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { CameraIcon, VideoIcon, FlipCameraIcon, StopIcon, RecordIcon } from './Icons'
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

interface Props {
  onCapture: (r: CaptureResult) => void
}

export default function CameraView({ onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [mode, setMode] = useState<Mode>('photo')
  const [facing, setFacing] = useState<Facing>('environment')
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      onCapture({ blob, url: URL.createObjectURL(blob), type: 'photo', mimeType: 'image/jpeg', fileName: `photo_${ts}.jpg` })
    }, 'image/jpeg', 0.92)
  }, [onCapture])

  const startRecording = useCallback(() => {
    if (!streamRef.current) return
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) =>
      MediaRecorder.isTypeSupported(m)
    ) || ''
    chunksRef.current = []
    const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : {})
    recorderRef.current = rec
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = () => {
      const actualMime = rec.mimeType || 'video/webm'
      const ext = actualMime.includes('mp4') ? 'mp4' : 'webm'
      const blob = new Blob(chunksRef.current, { type: actualMime })
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
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
    if (mode === 'photo') capturePhoto()
    else if (recording) stopRecording()
    else startRecording()
  }

  const toggleMode = () => {
    if (recording) stopRecording()
    setMode((m) => (m === 'photo' ? 'video' : 'photo'))
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-8 text-center" style={{ minHeight: '60vh' }}>
        <div style={{ fontSize: 48 }}>📷</div>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 300 }}>{error}</p>
        <button onClick={startCamera} className="btn-pill btn-pill-purple">Try Again</button>
      </div>
    )
  }

  return (
    <div className="relative w-full fade-up" style={{ aspectRatio: '3/4', borderRadius: 28, overflow: 'hidden', background: '#000' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full"
        style={{ objectFit: 'cover', transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
      />
      <canvas ref={canvasRef} className="hidden" />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(8,8,16,0.8)' }}>
          <div className="spin" style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--purple)', borderRadius: '50%' }} />
        </div>
      )}

      {recording && (
        <div className="absolute top-5 left-5 flex items-center gap-2 glass" style={{ padding: '6px 14px', borderRadius: 99 }}>
          <div className="blink" style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444' }} />
          <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(elapsed)} / {formatTime(MAX_SECS)}
          </span>
        </div>
      )}

      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-around pb-7 pt-5"
        style={{ background: 'linear-gradient(to top, rgba(8,8,16,0.7) 0%, transparent 100%)' }}
      >
        <button
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          className="btn-circle"
          style={{ width: 52, height: 52 }}
          title="Flip camera"
        >
          <FlipCameraIcon size={22} />
        </button>

        <button
          onClick={handleCapture}
          disabled={!ready}
          className={`btn-circle ${recording ? 'btn-circle-record' : 'btn-circle-purple'} ${!recording && mode === 'photo' ? 'pulse-glow' : ''}`}
          style={{ width: 80, height: 80 }}
          title={mode === 'photo' ? 'Take photo' : recording ? 'Stop recording' : 'Start recording'}
        >
          {mode === 'photo' ? (
            <CameraIcon size={30} />
          ) : recording ? (
            <StopIcon size={26} />
          ) : (
            <RecordIcon size={22} />
          )}
        </button>

        <button
          onClick={toggleMode}
          className="btn-circle"
          style={{ width: 52, height: 52 }}
          title={mode === 'photo' ? 'Switch to video' : 'Switch to photo'}
        >
          {mode === 'photo' ? <VideoIcon size={20} /> : <CameraIcon size={20} />}
        </button>
      </div>
    </div>
  )
}
