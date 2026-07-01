import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getOwnerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'SG-'
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function GET() {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tokens = await prisma.creationToken.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ tokens })
}

export async function POST(req: NextRequest) {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const note = body.note?.trim() || null

  // ensure uniqueness
  let token: string = ''
  for (let i = 0; i < 5; i++) {
    const candidate = generateToken()
    const existing = await prisma.creationToken.findUnique({ where: { token: candidate } })
    if (!existing) { token = candidate; break }
  }
  if (!token) return NextResponse.json({ error: 'Could not generate token' }, { status: 500 })

  const created = await prisma.creationToken.create({ data: { token, note } })
  return NextResponse.json(created, { status: 201 })
}
