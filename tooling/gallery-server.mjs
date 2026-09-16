import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { isLocalAuthoringRequest } from './authoring-server.mjs'

export const validFrameId = value => /^(gallery-[1-7]|ballroom-north-[1-4]|ballroom-(east|west)-[1-3])$/.test(value)
const hash = value => createHash('sha256').update(value).digest('hex')

export function decodeGalleryImage(value) {
  if (typeof value !== 'string' || value.length > 4_000_000) throw new Error('Image must be smaller than 3 MB after resizing.')
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/.exec(value)
  if (!match) throw new Error('Choose a JPEG, PNG or WebP image.')
  const bytes = Buffer.from(match[2], 'base64')
  const valid = match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  if (!valid || bytes.length < 16) throw new Error('Invalid raster image.')
  return { bytes, extension: match[1] === 'jpeg' ? 'jpg' : match[1] }
}

export function galleryServer() {
  const token = randomBytes(32).toString('hex')
  let root
  let busy = false
  return {
    name: 'local-mansion-gallery',
    configResolved(config) { root = config.root },
    handleHotUpdate(context) {
      if (context.file.replaceAll('\\', '/').includes('/public/mansion-')) return []
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== '/__authoring/gallery') return next()
        const send = (status, value) => {
          response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
          response.end(JSON.stringify(value))
        }
        if (!isLocalAuthoringRequest(request)) return send(403, { error: 'Gallery editing is local only.' })
        const file = resolve(root, 'public/mansion-gallery.json')
        if (request.method === 'GET') {
          try {
            const source = await readFile(file, 'utf8')
            return send(200, { gallery: JSON.parse(source), revision: hash(source), token })
          } catch { return send(500, { error: 'Cannot read the gallery manifest.' }) }
        }
        if (request.method !== 'PUT') return send(405, { error: 'Method not allowed.' })
        if (request.headers['x-gallery-token'] !== token) return send(403, { error: 'Reload the gallery editor before saving.' })
        if (!request.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Expected JSON.' })
        if (busy) return send(409, { error: 'Another frame is being saved. Try again.' })
        busy = true
        const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`
        try {
          let size = 0
          const chunks = []
          for await (const chunk of request) {
            size += chunk.length
            if (size > 4_100_000) return send(413, { error: 'Image is too large.' })
            chunks.push(chunk)
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          if (typeof body.frame !== 'string' || !validFrameId(body.frame)) throw new Error('Unknown picture frame.')
          const source = await readFile(file, 'utf8')
          if (body.revision !== hash(source)) return send(409, { error: 'Gallery changed. Toggle editing off and on, then retry.' })
          const gallery = JSON.parse(source)
          if (gallery.version !== 1 || !gallery.images || Array.isArray(gallery.images)) throw new Error('Invalid gallery manifest.')
          if (body.image === null) delete gallery.images[body.frame]
          else {
            const { bytes, extension } = decodeGalleryImage(body.image)
            const name = `${body.frame}-${hash(bytes).slice(0, 16)}.${extension}`
            const directory = resolve(root, 'public/mansion-images')
            await mkdir(directory, { recursive: true })
            await writeFile(resolve(directory, name), bytes)
            gallery.images[body.frame] = `mansion-images/${name}`
          }
          const output = `${JSON.stringify(gallery, null, 2)}\n`
          await writeFile(temporary, output, { flag: 'wx' })
          if (hash(await readFile(file, 'utf8')) !== body.revision) return send(409, { error: 'Gallery changed during save. Reload before retrying.' })
          await rename(temporary, file)
          send(200, { gallery, revision: hash(output) })
        } catch (error) { send(400, { error: error instanceof Error ? error.message : 'Could not save image.' }) }
        finally { busy = false; await unlink(temporary).catch(() => {}) }
      })
    },
  }
}