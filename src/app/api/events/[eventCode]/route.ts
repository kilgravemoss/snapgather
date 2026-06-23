import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { eventCode: string } }
) {
  const event = await prisma.event.findUnique({
    where: { eventCode: params.eventCode.toUpperCase() },
    select: { id: true, name: true, description: true, eventCode: true, createdAt: true },
  })

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  return NextResponse.json(event)
}
