import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function createAdminToken(eventId: string) {
  return new SignJWT({ eventId, role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret)
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as { eventId: string; role: string }
  } catch {
    return null
  }
}

export async function getAdminSession(eventId: string) {
  const store = await cookies()
  const token = store.get(`admin_${eventId}`)?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.eventId !== eventId) return null
  return payload
}

export function setAdminCookie(
  res: { cookies: { set: Function } },
  eventId: string,
  token: string
) {
  res.cookies.set(`admin_${eventId}`, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}
