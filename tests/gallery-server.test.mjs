import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { galleryServer, validFrameId, decodeGalleryImage } from '../tooling/gallery-server.mjs'

const image = `data:image/png;base64,${Buffer.from([137,80,78,71,13,10,26,10,...Array(24).fill(0)]).toString('base64')}`
test('gallery allows only known frames and raster image signatures', () => {
  assert.equal(validFrameId('gallery-1'), true)
  assert.equal(validFrameId('../../outside'), false)
  assert.equal(validFrameId('gallery-8'), false)
  assert.throws(() => decodeGalleryImage('data:image/svg+xml;base64,AAA='), /JPEG/)
  assert.throws(() => decodeGalleryImage('data:image/png;base64,AAAA'), /Invalid/)
  assert.equal(decodeGalleryImage(image).extension, 'png')
})

test('local picture uploads persist deployable assets and reject stale writes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mansion-gallery-'))
  await mkdir(join(root, 'public'))
  await writeFile(join(root, 'public/mansion-gallery.json'), JSON.stringify({ version: 1, images: {} }))
  const plugin = galleryServer()
  plugin.configResolved({ root })
  let middleware
  plugin.configureServer({ middlewares: { use(handler) { middleware = handler } } })
  const server = createServer((request, response) => void middleware(request, response, () => response.end()))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const url = `http://127.0.0.1:${server.address().port}/__authoring/gallery`
    const session = await (await fetch(url)).json()
    const put = (frame, token = session.token) => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Gallery-Token': token }, body: JSON.stringify({ frame, image, revision: session.revision }) })
    assert.equal((await put('gallery-1', 'invalid')).status, 403)
    assert.equal((await put('../escape')).status, 400)
    const response = await put('gallery-1')
    assert.equal(response.status, 200)
    const saved = await response.json()
    assert.ok((await readFile(join(root, 'public', saved.gallery.images['gallery-1']))).length > 0)
    assert.equal((await put('gallery-2')).status, 409)
  } finally { await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true }) }
})