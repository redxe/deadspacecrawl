import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { authoringServer, isLocalAuthoringRequest } from '../tooling/authoring-server.mjs'

test('authoring rejects remote clients, foreign origins and hostile host headers', () => {
  const request = (headers = {}, remoteAddress = '127.0.0.1') => ({ socket: { remoteAddress }, headers: { host: 'localhost:5173', ...headers } })
  assert.equal(isLocalAuthoringRequest(request()), true)
  assert.equal(isLocalAuthoringRequest(request({ origin: 'http://localhost:5173', 'sec-fetch-site': 'same-origin' })), true)
  assert.equal(isLocalAuthoringRequest(request({}, '192.168.1.20')), false)
  assert.equal(isLocalAuthoringRequest(request({ host: 'malicious.example:5173' })), false)
  assert.equal(isLocalAuthoringRequest(request({ origin: 'https://malicious.example' })), false)
  assert.equal(isLocalAuthoringRequest(request({ 'sec-fetch-site': 'cross-site' })), false)
})

test('publish requires a token and current revision and writes only validated catalogs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'puzzle-authoring-'))
  await mkdir(join(root, 'src/puzzles'), { recursive: true })
  const file = join(root, 'src/puzzles/catalog.json')
  const original = { version: 1, puzzles: [], order: [], hidden: [] }
  await writeFile(file, JSON.stringify(original))
  const plugin = authoringServer(value => { if (value.version !== 1) throw new Error('Invalid version'); return value })
  plugin.configResolved({ root })
  await plugin.buildStart()
  await writeFile(file, JSON.stringify({ version: 2 }))
  await assert.rejects(() => plugin.buildStart(), /Invalid version/)
  await writeFile(file, JSON.stringify(original))
  let middleware
  plugin.configureServer({ middlewares: { use(handler) { middleware = handler } } })
  const server = createServer((request, response) => void middleware(request, response, () => { response.statusCode = 404; response.end() }))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}/__authoring/catalog`
  try {
    const initial = await (await fetch(url)).json()
    const put = (catalog, revision = initial.revision, token = initial.token) => fetch(url, {
      method: 'PUT', headers: { 'content-type': 'application/json', 'x-authoring-token': token }, body: JSON.stringify({ catalog, revision }),
    })
    assert.equal((await put(original, initial.revision, 'wrong')).status, 403)
    assert.equal((await put(original, initial.revision, '\u00e9'.repeat(64))).status, 403)
    assert.equal((await put({ version: 2 })).status, 400)
    assert.equal((await put(original, 'outdated')).status, 409)
    const edited = { ...original, order: ['new-puzzle'] }
    const result = await put(edited)
    assert.equal(result.status, 200)
    assert.notEqual((await result.json()).revision, initial.revision)
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), edited)
    assert.equal((await put(original)).status, 409)
  } finally {
    await new Promise(resolve => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  }
})