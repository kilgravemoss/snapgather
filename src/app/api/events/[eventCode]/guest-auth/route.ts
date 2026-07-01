import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { createGuestToken, setGuestCookie, getGuestSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventCode: string }> }
) {
  const { eventCode } = await params
  const event = await prisma.event.findUnique({
    where: { eventCode: eventCode.toUpperCase() },
    select: { id: true, guestPasswordHash: true },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!event.guestPasswordHash) return NextResponse.json({ authenticated: true })

  const session = await getGuestSession(event.id)
  return NextResponse.json({ authenticated: !!session })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventCode: string }> }
) {
  const { eventCode } = await params
  const { password } = await req.json()

  const event = await prisma.event.findUnique({
    where: { eventCode: eventCode.toUpperCase() },
    select: { id: true, guestPasswordHash: true },
  })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!event.guestPasswordHash) return NextResponse.json({ ok: true })

  const valid = await compare(password, event.guestPasswordHash)
  if (!valid) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })

  const token = await createGuestToken(event.id)
  const res = NextResponse.json({ ok: true })
  setGuestCookie(res as any, event.id, token)
  return res
}
