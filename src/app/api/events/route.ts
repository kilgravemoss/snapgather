import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { generateEventCode } from '@/lib/utils'
import { createAdminToken, setAdminCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { name, description, password, guestPassword } = await req.json()

    if (!name?.trim()) return NextResponse.json({ error: 'Event name is required' }, { status: 400 })
    if (!password || password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    if (guestPassword && guestPassword.length < 4) return NextResponse.json({ error: 'Guest password must be at least 4 characters' }, { status: 400 })

    const passwordHash = await hash(password, 12)
    const guestPasswordHash = guestPassword ? await hash(guestPassword, 10) : null

    let event = null
    for (let i = 0; i < 5; i++) {
      const eventCode = generateEventCode()
      try {
        event = await prisma.event.create({
          data: {
            name: name.trim(),
            description: description?.trim() || null,
            eventCode,
            passwordHash,
            guestPasswordHash,
          },
        })
        break
      } catch (e: any) {
        if (e.code !== 'P2002') throw e
      }
    }

    if (!event) return NextResponse.json({ error: 'Could not generate unique event code' }, { status: 500 })

    const token = await createAdminToken(event.id)
    const res = NextResponse.json({ eventCode: event.eventCode, eventId: event.id }, { status: 201 })
    setAdminCookie(res as any, event.id, token)
    return res
  } catch (e) {
    console.error('[POST /api/events]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
