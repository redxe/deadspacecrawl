import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

let value = null
let blocked = false
const context = { exports: {}, localStorage: {
  getItem: () => { if (blocked) throw Error('Blocked'); return value },
  setItem: (_, next) => { if (blocked) throw Error('Blocked'); value = next },
} }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/music-library.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const { builtInSongs, loadMusicState, saveMusicState, validateSong } = context.exports

test('built-in songs are unique and valid without external samples', () => {
  assert.equal(new Set(builtInSongs.map(song => song.id)).size, 5)
  for (const song of builtInSongs) {
    assert.equal(validateSong(song.name, song.code), undefined)
    assert.match(song.code, /setcps\(/)
    assert.doesNotMatch(song.code, /samples\(|https?:/)
  }
})

test('custom songs, selection, volume and playback preference round-trip', () => {
  const state = loadMusicState()
  state.songs.push({ id: 'custom-test', name: 'My Track', code: 'note("c4").s("sine")', detail: 'LOCAL COMPOSITION' })
  state.selected = 'custom-test'
  state.volume = .42
  state.enabled = false
  assert.equal(saveMusicState(state), true)
  assert.equal(JSON.stringify(loadMusicState()), JSON.stringify(state))
})

test('malformed and blocked storage fail gracefully', () => {
  value = '{broken'
  assert.equal(loadMusicState().songs.length, 0)
  value = JSON.stringify({ selected: 'missing', volume: 8, songs: [null, { id: 'orbital' }, { id: 'custom-bad', name: '', code: 'x' }] })
  assert.equal(loadMusicState().selected, 'orbital')
  assert.equal(loadMusicState().volume, 1)
  assert.equal(loadMusicState().songs.length, 0)
  blocked = true
  assert.equal(loadMusicState().volume, .25)
  assert.equal(saveMusicState(loadMusicState()), false)
  blocked = false
  value = null
  assert.ok(validateSong('', 'note(1)'))
  assert.ok(validateSong('Name', 'x'.repeat(20001)))
})

test('Robin stays hidden until unlocked, persists independently and remains available with blocked storage', () => {
  const storage = new Map()
  const load = (blocked = false) => {
    const isolated = { exports: {}, localStorage: {
      getItem: key => { if (blocked) throw Error('Blocked'); return storage.get(key) ?? null },
      setItem: (key, value) => { if (blocked) throw Error('Blocked'); storage.set(key, value) },
    } }
    runInNewContext(ts.transpileModule(readFileSync(new URL('../src/music-library.ts', import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, isolated)
    return isolated.exports
  }
  const library = load()
  assert.equal(library.availableSongs().some(song => song.id === 'robin'), false)
  assert.equal(library.unlockRobinSong(), true)
  assert.equal(load().availableSongs().filter(song => song.id === 'robin').length, 1)
  const state = library.loadMusicState(); state.selected = 'robin'; library.saveMusicState(state)
  assert.equal(load().loadMusicState().selected, 'robin')
  const temporary = load(true)
  assert.equal(temporary.unlockRobinSong(), false)
  assert.equal(temporary.availableSongs().filter(song => song.id === 'robin').length, 1)
  assert.equal(validateSong(library.robinSong.name, library.robinSong.code), undefined)
})