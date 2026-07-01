import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { generateEventCode } from '@/lib/utils'
import { createAdminToken, setAdminCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { name, description, password, guestPassword, creationToken } = await req.json()

    if (!creationToken?.trim()) {
      return NextResponse.json({ error: 'A creation code is required to create an event' }, { status: 403 })
    }

    // Validate token before doing any work
    const tokenRecord = await prisma.creationToken.findUnique({
      where: { token: creationToken.trim().toUpperCase() },
    })
    if (!tokenRecord) {
      return NextResponse.json({ error: 'Invalid creation code' }, { status: 403 })
    }
    if (tokenRecord.used) {
      return NextResponse.json({ error: 'This creation code has already been used' }, { status: 403 })
    }

    if (!name?.trim()) return NextResponse.json({ error: 'Event name is required' }, { status: 400 })
    if (!password || password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    if (guestPassword && guestPassword.length < 4) return NextResponse.json({ error: 'Guest password must be at least 4 characters' }, { status: 400 })

    const passwordHash = await hash(password, 12)
    const guestPasswordHash = guestPassword ? await hash(guestPassword, 10) : null

    // Create event + consume token atomically
    let event = null
    for (let i = 0; i < 5; i++) {
      const eventCode = generateEventCode()
      try {
        const result = await prisma.$transaction([
          prisma.event.create({
            data: {
              name: name.trim(),
              description: description?.trim() || null,
              eventCode,
              passwordHash,
              guestPasswordHash,
            },
          }),
          prisma.creationToken.update({
            where: { id: tokenRecord.id },
            data: { used: true, usedAt: new Date() },
          }),
        ])
        event = result[0]
        break
      } catch (e: any) {
        if (e.code !== 'P2002') throw e
      }
    }

    if (!event) return NextResponse.json({ error: 'Could not generate unique event code' }, { status: 500 })

    const adminToken = await createAdminToken(event.id)
    const res = NextResponse.json({ eventCode: event.eventCode, eventId: event.id }, { status: 201 })
    setAdminCookie(res as any, event.id, adminToken)
    return res
  } catch (e) {
    console.error('[POST /api/events]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
