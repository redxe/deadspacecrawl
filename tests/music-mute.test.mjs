import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const panelCode = compile('../src/music-panel.ts')
const typingCode = compile('../src/typing-sounds.ts')

class Element {
  children = []
  selectors = new Map()
  events = new Map()
  attributes = new Map()
  dataset = {}
  classList = { add() {}, toggle() {} }
  value = ''
  open = false
  append(...children) { this.children.push(...children) }
  replaceChildren(...children) { this.children = children }
  querySelector(selector) {
    if (!this.selectors.has(selector)) this.selectors.set(selector, new Element())
    return this.selectors.get(selector)
  }
  setAttribute(key, value) { this.attributes.set(key, value) }
  addEventListener(name, callback) {
    const previous = this.events.get(name)
    this.events.set(name, previous ? event => { previous(event); callback(event) } : callback)
  }
  removeEventListener(name) { this.events.delete(name) }
  click() { this.events.get('click')?.() }
  remove() { this.removed = true }
}

function setup(volume = .42, unlocked = true) {
  const state = { songs: [], selected: 'first', volume, enabled: true }
  const songs = [
    { id: 'first', name: 'First', detail: '', code: 'note("c4")' },
    { id: 'second', name: 'Second', detail: '', code: 'note("d4")' },
  ]
  const players = []
  const saved = []
  const app = new Element()
  const document = new Element()
  document.hidden = false
  document.createElement = () => new Element()
  const window = new Element()
  const icons = { createElement: () => new Element() }
  const modules = {
    lucide: icons,
    './music-library': { builtInSongs: songs, loadMusicState: () => state, saveMusicState: next => { saved.push(JSON.parse(JSON.stringify(next))); return true } },
    './music-editor': { initializeMusicEditor: () => ({ refresh() {}, setPlayback() {}, destroy() {} }) },
    './music-visualizer': { initializeMusicVisualizer: () => ({ update() {}, destroy() {} }) },
    './music-player': { createMusicPlayer: (code, initialVolume, autoplay, onState) => {
      const player = { frame: new Element(), code, initialVolume, autoplay, volumes: [], spatial: [], plays: 0, pauses: 0, onState, play() { this.plays++ }, pause() { this.pauses++ }, setSpatial(gain, pan) { this.spatial.push({ gain, pan }) }, setVolume(next) { this.volumes.push(next) }, setHighlighting() {}, setVisualizing() {}, destroy() { this.destroyed = true } }
      players.push(player)
      return player
    } },
  }
  const context = { exports: {}, document, window, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), require: name => modules[name] ?? {}, setTimeout: () => 1, clearTimeout() {} }
  runInNewContext(panelCode, context)
  const music = context.exports.initializeMusic(app, unlocked)
  const typingContext = { ...context, exports: {} }
  runInNewContext(typingCode, typingContext)
  const typing = typingContext.exports.initializeTypingSounds(app, music)
  const dialog = app.children[0]
  const topMute = app.querySelector('.system-actions').children.at(-1)
  const panelMute = dialog.querySelector('.music-volume').children[0]
  const slider = dialog.querySelector('#music-volume')
  return { state, players, saved, music, typing, dialog, topMute, panelMute, slider, document }
}

test('top-right mute changes the active player and restores volume without replacing or pausing it', () => {
  const view = setup()
  const player = view.players[0]
  player.onState({ status: 'ready' })
  assert.equal(player.volumes.at(-1), .42)
  assert.equal(view.topMute.attributes.get('aria-pressed'), 'false')
  view.topMute.click()
  assert.equal(player.volumes.at(-1), 0)
  assert.equal(view.state.volume, 0)
  assert.equal(view.saved.at(-1).volume, 0)
  assert.equal(view.state.enabled, true, 'Muting does not change playback intent')
  assert.equal(view.topMute.attributes.get('aria-label'), 'Unmute music and typing sounds')
  assert.equal(view.panelMute.attributes.get('aria-label'), 'Unmute music')
  assert.equal(view.slider.value, '0')
  view.topMute.click()
  assert.equal(player.volumes.at(-1), .42)
  assert.equal(view.slider.value, '42')
  assert.equal(view.players.length, 1)
  assert.equal(player.destroyed, undefined)
})

test('panel mute and slider synchronize the top toggle and remember the last nonzero level', () => {
  const view = setup()
  view.slider.value = '67'
  view.slider.events.get('input')()
  view.panelMute.click()
  assert.equal(view.topMute.attributes.get('aria-pressed'), 'true')
  view.topMute.click()
  assert.equal(view.state.volume, .67)
  view.slider.value = '0'
  view.slider.events.get('input')()
  assert.equal(view.topMute.attributes.get('aria-label'), 'Unmute music and typing sounds')
  view.topMute.click()
  assert.equal(view.state.volume, .67)
  view.typing.destroy()
  assert.equal(view.topMute.removed, true)
  const previousLabel = view.topMute.attributes.get('aria-label')
  view.panelMute.click()
  assert.equal(view.topMute.attributes.get('aria-label'), previousLabel, 'Destroyed controls unsubscribe')
  view.music.destroy()
})

test('mute applies on engine readiness and follows track switches and persisted zero volume', () => {
  const view = setup()
  const first = view.players[0]
  view.topMute.click()
  first.onState({ status: 'ready' })
  assert.equal(first.volumes.at(-1), 0, 'A loading iframe receives the latest volume once ready')
  const secondRadio = view.dialog.querySelector('[data-song-list]').children[1].children[0]
  secondRadio.events.get('change')()
  assert.equal(view.players[1].initialVolume, 0)
  assert.equal(view.players[1].code, 'note("d4")')
  view.topMute.click()
  assert.equal(view.players[1].volumes.at(-1), .42)
  const restored = setup(0, false)
  assert.equal(restored.topMute.attributes.get('aria-label'), 'Unmute music and typing sounds')
  restored.music.unlock()
  assert.equal(restored.players[0].initialVolume, 0)
  restored.topMute.click()
  assert.equal(restored.players[0].volumes.at(-1), .25)
})

test('gallery distance locks volume, respects mute and restores the original level on exit', () => {
  const view = setup()
  const player = view.players[0]
  player.onState({ status: 'ready' })
  view.music.setSpatial({ gain: .2, pan: -.8 })
  assert.equal(view.slider.disabled, true)
  assert.equal(player.volumes.at(-1), 1)
  assert.equal(view.state.volume, .42)
  assert.deepEqual(player.spatial.at(-1), { gain: .2, pan: -.8 })
  view.music.toggleMute()
  assert.equal(player.volumes.at(-1), 0)
  view.music.toggleMute()
  assert.equal(player.volumes.at(-1), 1)
  view.music.setSpatial(null)
  assert.equal(view.slider.disabled, false)
  assert.equal(player.volumes.at(-1), .42)
  assert.deepEqual(player.spatial.at(-1), { gain: 1, pan: 0 })
})

test('gallery playback resumes after hiding without rewriting the normal playback preference', () => {
  const view = setup()
  const player = view.players[0]
  view.state.enabled = false
  player.onState({ status: 'paused' })
  view.music.setSpatial({ gain: .1, pan: 0 })
  view.music.resume()
  assert.equal(player.plays, 1)
  player.onState({ status: 'playing' })
  view.music.resume()
  assert.equal(player.plays, 1, 'Repeated walking gestures must not restart the song')
  view.document.hidden = true
  view.document.events.get('visibilitychange')()
  assert.equal(player.pauses, 1)
  player.onState({ status: 'paused' })
  view.document.hidden = false
  view.document.events.get('visibilitychange')()
  assert.equal(player.plays, 2)
  assert.equal(view.state.enabled, false)
})