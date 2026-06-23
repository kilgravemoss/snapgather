import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getOwnerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const events = await prisma.event.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      uploads: { select: { fileSize: true, fileType: true } },
    },
  })

  const data = events.map((e) => ({
    id: e.id,
    name: e.name,
    eventCode: e.eventCode,
    description: e.description,
    createdAt: e.createdAt,
    uploadCount: e.uploads.length,
    photoCount: e.uploads.filter((u) => u.fileType === 'photo').length,
    videoCount: e.uploads.filter((u) => u.fileType === 'video').length,
    totalSize: e.uploads.reduce((sum, u) => sum + u.fileSize, 0),
  }))

  const totalSize = data.reduce((sum, e) => sum + e.totalSize, 0)

  return NextResponse.json({ events: data, totalSize })
}
