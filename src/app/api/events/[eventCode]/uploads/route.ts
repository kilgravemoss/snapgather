import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { prisma } from '@/lib/db'
import { r2, BUCKET } from '@/lib/r2'
import { getAdminSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventCode: string }> }
) {
  const { eventCode } = await params
  const event = await prisma.event.findUnique({
    where: { eventCode: eventCode.toUpperCase() },
    select: { id: true },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const adminSession = await getAdminSession(event.id)
  const sessionId = req.nextUrl.searchParams.get('sessionId')

  let where: object | null = null
  if (adminSession) {
    where = { eventId: event.id }
  } else if (sessionId) {
    where = { eventId: event.id, sessionId }
  }

  if (!where) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uploads = await prisma.upload.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  const withUrls = await Promise.all(
    uploads.map(async (u) => ({
      ...u,
      url: await getSignedUrl(
        r2,
        new GetObjectCommand({ Bucket: BUCKET, Key: u.storageKey }),
        { expiresIn: 3600 }
      ),
    }))
  )

  return NextResponse.json({ uploads: withUrls, isAdmin: !!adminSession })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventCode: string }> }
) {
  try {
    const { eventCode } = await params
    const { key, fileName, fileType, mimeType, fileSize, note, sessionId } = await req.json()

    if (!key || !fileName || !fileType || !mimeType || !fileSize || !sessionId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { eventCode: eventCode.toUpperCase() },
      select: { id: true },
    })
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    if (!key.startsWith(`events/${event.id}/`)) {
      return NextResponse.json({ error: 'Invalid storage key' }, { status: 400 })
    }

    const upload = await prisma.upload.create({
      data: {
        eventId: event.id,
        sessionId,
        storageKey: key,
        fileName,
        fileType,
        mimeType,
        fileSize,
        note: note?.trim() || null,
      },
    })

    return NextResponse.json(upload, { status: 201 })
  } catch (e) {
    console.error('[POST /uploads]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
