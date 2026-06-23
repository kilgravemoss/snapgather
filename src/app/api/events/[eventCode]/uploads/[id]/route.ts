import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/lib/db'
import { r2, BUCKET } from '@/lib/r2'
import { getAdminSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventCode: string; id: string }> }
) {
  const { eventCode, id } = await params
  const event = await prisma.event.findUnique({
    where: { eventCode: eventCode.toUpperCase() },
    select: { id: true },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const session = await getAdminSession(event.id)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const upload = await prisma.upload.findUnique({ where: { id } })
  if (!upload || upload.eventId !== event.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await Promise.all([
    r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: upload.storageKey })),
    prisma.upload.delete({ where: { id } }),
  ])

  return NextResponse.json({ ok: true })
}
