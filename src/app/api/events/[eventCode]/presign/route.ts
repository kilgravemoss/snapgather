import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { prisma } from '@/lib/db'
import { r2, BUCKET } from '@/lib/r2'
import { getGuestSession } from '@/lib/auth'
import { v4 as uuid } from 'uuid'

export const dynamic = 'force-dynamic'

const MAX_PHOTO = 20 * 1024 * 1024
const MAX_VIDEO = 75 * 1024 * 1024
const MAX_PHOTOS_PER_SESSION = 10
const MAX_VIDEOS_PER_SESSION = 3
const ALLOWED_IMAGE = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'])
const ALLOWED_VIDEO = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/3gpp', 'video/3gpp2'])

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventCode: string }> }
) {
  try {
    const { eventCode } = await params
    const { fileName, mimeType, fileSize, sessionId } = await req.json()

    if (!fileName || !mimeType || !fileSize || !sessionId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const baseMime = mimeType.split(';')[0].trim().toLowerCase()
    const isImage = ALLOWED_IMAGE.has(baseMime)
    const isVideo = ALLOWED_VIDEO.has(baseMime)

    if (!isImage && !isVideo) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }
    if (isImage && fileSize > MAX_PHOTO) {
      return NextResponse.json({ error: 'Photo exceeds 20 MB limit' }, { status: 400 })
    }
    if (isVideo && fileSize > MAX_VIDEO) {
      return NextResponse.json({ error: 'Video exceeds 150 MB limit' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { eventCode: eventCode.toUpperCase() },
      select: { id: true, guestPasswordHash: true },
    })
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    if (event.guestPasswordHash) {
      const session = await getGuestSession(event.id)
      if (!session) return NextResponse.json({ error: 'Guest authentication required' }, { status: 401 })
    }

    // Enforce per-session limits
    const existingUploads = await prisma.upload.findMany({
      where: { eventId: event.id, sessionId },
      select: { fileType: true },
    })
    const sessionPhotos = existingUploads.filter((u) => u.fileType === 'photo').length
    const sessionVideos = existingUploads.filter((u) => u.fileType === 'video').length
    if (isImage && sessionPhotos >= MAX_PHOTOS_PER_SESSION) {
      return NextResponse.json({ error: `Photo limit reached (max ${MAX_PHOTOS_PER_SESSION})` }, { status: 429 })
    }
    if (isVideo && sessionVideos >= MAX_VIDEOS_PER_SESSION) {
      return NextResponse.json({ error: `Video limit reached (max ${MAX_VIDEOS_PER_SESSION})` }, { status: 429 })
    }

    const ext = fileName.split('.').pop()?.toLowerCase() || 'bin'
    const key = `events/${event.id}/${uuid()}.${ext}`

    const url = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: mimeType }),
      { expiresIn: 3600 }
    )

    return NextResponse.json({ uploadUrl: url, key })
  } catch (e) {
    console.error('[POST /presign]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
