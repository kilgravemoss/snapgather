import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/lib/db'
import { r2, BUCKET } from '@/lib/r2'
import { getOwnerSession } from '@/lib/auth'
import { Readable, PassThrough } from 'stream'
import archiver from 'archiver'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getOwnerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, name: true },
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const uploads = await prisma.upload.findMany({
    where: { eventId: id },
    orderBy: { createdAt: 'asc' },
  })

  const pass = new PassThrough()
  const archive = archiver('zip', { zlib: { level: 1 } })
  archive.pipe(pass)

  const webStream = Readable.toWeb(pass) as ReadableStream

  const appendAll = async () => {
    for (let i = 0; i < uploads.length; i++) {
      const u = uploads[i]
      try {
        const obj = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: u.storageKey }))
        if (obj.Body) {
          const nodeStream = Readable.fromWeb(obj.Body.transformToWebStream() as any)
          const prefix = String(i + 1).padStart(4, '0')
          archive.append(nodeStream, { name: `${prefix}_${u.fileName}` })
          await new Promise<void>((resolve, reject) => {
            nodeStream.on('end', resolve)
            nodeStream.on('error', reject)
          })
        }
      } catch (e) {
        console.error(`Skipping ${u.storageKey}:`, e)
      }
    }
    archive.finalize()
  }

  appendAll().catch((e) => {
    console.error('[owner download]', e)
    pass.destroy(e)
  })

  const safeName = event.name.replace(/[^a-z0-9\-]/gi, '_')
  return new Response(webStream as any, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName}_photos.zip"`,
    },
  })
}
