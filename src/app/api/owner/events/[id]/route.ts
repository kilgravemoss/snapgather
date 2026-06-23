import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/lib/db'
import { r2, BUCKET } from '@/lib/r2'
import { getOwnerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const event = await prisma.event.findUnique({
    where: { id },
    include: { uploads: { select: { id: true, storageKey: true } } },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete all files from R2
  await Promise.allSettled(
    event.uploads.map((u) =>
      r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: u.storageKey }))
    )
  )

  // Delete event from DB (cascades to uploads)
  await prisma.event.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
