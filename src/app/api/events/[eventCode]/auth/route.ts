import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { createAdminToken, setAdminCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { eventCode: string } }
) {
  const { password } = await req.json()

  const event = await prisma.event.findUnique({
    where: { eventCode: params.eventCode.toUpperCase() },
  })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const valid = await compare(password, event.passwordHash)
  if (!valid) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })

  const token = await createAdminToken(event.id)
  const res = NextResponse.json({ ok: true })
  setAdminCookie(res as any, event.id, token)
  return res
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { eventCode: string } }
) {
  const event = await prisma.event.findUnique({
    where: { eventCode: params.eventCode.toUpperCase() },
    select: { id: true },
  })
  const res = NextResponse.json({ ok: true })
  if (event) res.cookies.delete(`admin_${event.id}`)
  return res
}
