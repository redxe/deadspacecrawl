import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'

const endpoint = '/__authoring/catalog'
const digest = value => createHash('sha256').update(value).digest('hex')
const loopback = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)

export function isLocalAuthoringRequest(request) {
  if (!loopback(request.socket.remoteAddress)) return false
  try {
    const host = new URL(`http://${request.headers.host}`)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(host.hostname)) return false
    const origin = request.headers.origin
    if (origin && new URL(origin).host !== host.host) return false
    if (origin && !['http:', 'https:'].includes(new URL(origin).protocol)) return false
    return !request.headers['sec-fetch-site'] || ['same-origin', 'none'].includes(request.headers['sec-fetch-site'])
  } catch { return false }
}

export function authoringServer(validate) {
  const token = randomBytes(32).toString('hex')
  let writing = false
  let file
  return {
    name: 'local-puzzle-authoring',
    configResolved(config) { file = resolve(config.root, 'src/puzzles/catalog.json') },
    async buildStart() { validate(JSON.parse(await readFile(file, 'utf8'))) },
    handleHotUpdate(context) {
      if (resolve(context.file) === file) return []
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== endpoint) return next()
        const send = (status, value) => {
          response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
          response.end(JSON.stringify(value))
        }
        if (!isLocalAuthoringRequest(request)) return send(403, { error: 'Authoring is available only from the local machine and same origin.' })
        if (request.method === 'GET') {
          try {
            const source = await readFile(file, 'utf8')
            send(200, { catalog: JSON.parse(source), revision: digest(source), token })
          } catch { send(500, { error: 'Cannot read the published catalog. Check the local catalog file.' }) }
          return
        }
        if (request.method !== 'PUT') return send(405, { error: 'Method not allowed.' })
        const supplied = request.headers['x-authoring-token']
        if (typeof supplied !== 'string' || Buffer.byteLength(supplied) !== Buffer.byteLength(token) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) return send(403, { error: 'Invalid authoring session. Reload the editor.' })
        if (!request.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Expected JSON.' })
        if (writing) return send(409, { error: 'Another publish is in progress. Try again.' })
        writing = true
        const temporary = `${file}.${randomBytes(8).toString('hex')}.tmp`
        try {
          const chunks = []
          let size = 0
          for await (const chunk of request) {
            size += chunk.length
            if (size > 2_000_000) { send(413, { error: 'Catalog exceeds the 2 MB limit.' }); return }
            chunks.push(chunk)
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          const current = await readFile(file, 'utf8')
          if (body.revision !== digest(current)) return send(409, { error: 'The published catalog changed. Export your draft, then reload the published catalog before merging.' })
          const catalog = validate(body.catalog)
          const source = `${JSON.stringify(catalog, null, 2)}\n`
          await writeFile(temporary, source, { flag: 'wx' })
          if (digest(await readFile(file, 'utf8')) !== body.revision) return send(409, { error: 'The catalog changed during publish. Reload before merging.' })
          await rename(temporary, file)
          send(200, { revision: digest(source) })
        } catch (error) {
          send(400, { error: error instanceof Error ? error.message : 'Could not publish catalog.' })
        } finally {
          writing = false
          await unlink(temporary).catch(() => {})
        }
      })
    },
  }
}