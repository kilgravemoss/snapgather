import { NextRequest, NextResponse } from 'next/server'
import { createOwnerToken, setOwnerCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { secret } = await req.json()
  if (!secret || secret !== process.env.OWNER_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }
  const token = await createOwnerToken()
  const res = NextResponse.json({ ok: true })
  setOwnerCookie(res as any, token)
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('owner_session')
  return res
}
