import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const compiled = ts.transpileModule(readFileSync(new URL('../src/music-player.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText + '\nexports.testRuntime = playerRuntime'
const flush = () => new Promise(resolve => setImmediate(resolve))

function setup(fail = false, initialVolume = .25, autoplay = false) {
  const events = new Map()
  const messages = []
  const attributes = new Map()
  const parent = { postMessage: message => messages.push(message) }
  const label = { textContent: '' }
  let stops = 0
  let gain = 1
  const gainChanges = []
  const resumeGains = []
  let options
  let audio
  let cycle = 0
  let haps = []
  let queryError = false
  let nextFrame = 0
  const frames = new Map()
  const queries = []
  const button = { disabled: true, innerHTML: '', setAttribute: (key, value) => attributes.set(key, value), addEventListener: (name, handler) => events.set(`button-${name}`, handler) }
  const window = {
    addEventListener: (name, handler) => events.set(name, handler),
    initStrudel: async next => {
      options = next
      return {
        stop: () => { stops++ }, scheduler: { now: () => cycle, cps: .5 },
        state: { pattern: { queryArc: (...args) => { queries.push(args); if (queryError) throw Error('Visual query failed'); return haps } } },
      }
    },
    evaluate: async () => { window.hush = () => { throw Error('Mutable global must not control transport') }; if (fail) options.onEvalError(new Error('Bad score')) },
    getSuperdoughAudioController: () => ({ output: { destinationGain: { gain: {
      cancelScheduledValues: () => gainChanges.push({ type: 'cancel' }),
      setValueAtTime: value => { gain = value; gainChanges.push({ type: 'immediate', value }) },
      setTargetAtTime: value => { gain = value; gainChanges.push({ type: 'smooth', value }) },
    } } } }),
  }
  const context = { exports: {}, window, parent, document: { querySelector: selector => selector === 'button' ? button : label },
    require: () => ({ default: 'strudel.js', createElement: () => ({ outerHTML: '<svg></svg>' }) }),
    setTimeout: callback => { callback(); return 0 },
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame },
    cancelAnimationFrame: id => frames.delete(id),
    AudioContext: class {
      state = 'suspended'
      currentTime = 0
      constructor() { audio = this }
      async resume() { resumeGains.push(gain); this.state = 'running' }
      async suspend() { this.state = 'suspended' }
      async close() { this.state = 'closed' }
    },
  }
  runInNewContext(compiled, context)
  context.exports.testRuntime('note("c4 e4 ~ g4").s("sine")', initialVolume, autoplay, '<svg>play</svg>', '<svg>pause</svg>')
  return {
    events, messages, parent, attributes, frames, queries, gainChanges, resumeGains,
    get audio() { return audio }, get stops() { return stops }, get gain() { return gain },
    setHaps: next => { haps = next }, failQuery: () => { queryError = true },
    draw: time => { cycle = time; events.get('message')({ source: parent, data: { type: 'signal-music-control', action: 'draw' } }) },
  }
}

test('manual play and pause use the retained REPL and report persistence intent', async () => {
  const player = setup()
  await flush()
  assert.equal(player.messages.at(-1).status, 'ready')
  player.events.get('button-click')()
  await flush()
  assert.equal(player.audio.state, 'running')
  assert.equal(player.messages.at(-1).status, 'playing')
  assert.equal(player.messages.at(-1).manual, true)
  assert.equal(player.gain, .15)
  player.events.get('button-click')()
  assert.equal(player.stops, 1)
  assert.equal(player.audio.state, 'suspended')
  assert.equal(player.messages.at(-1).status, 'paused')
  assert.equal(player.messages.at(-1).manual, true)
  player.events.get('pagehide')()
  assert.equal(player.audio.state, 'closed')
})

test('a muted player sets gain to zero before audio resumes instead of fading down from full volume', async () => {
  const player = setup(false, 0, true)
  await flush()
  assert.deepEqual(player.resumeGains, [0])
  assert.deepEqual(player.gainChanges.slice(0, 2), [{ type: 'cancel' }, { type: 'immediate', value: 0 }])
  assert.equal(player.messages.at(-1).status, 'playing')
  assert.equal(player.gain, 0)
  player.events.get('message')({ source: player.parent, data: { type: 'signal-music-control', action: 'volume', volume: .4 } })
  assert.deepEqual(player.gainChanges.at(-1), { type: 'smooth', value: .24 })
})

test('evaluation errors stop transport and retain a visible error', async () => {
  const player = setup(true)
  await flush()
  player.events.get('button-click')()
  await flush()
  assert.equal(player.messages.at(-1).status, 'error')
  assert.equal(player.messages.at(-1).detail, 'Bad score')
  assert.equal(player.audio.state, 'suspended')
  assert.equal(player.stops, 1)
})

test('volume messages require the parent source and reject nonfinite values', async () => {
  const player = setup()
  await flush()
  const send = (source, volume) => player.events.get('message')({ source, data: { type: 'signal-music-control', action: 'volume', volume } })
  send({}, 1)
  assert.equal(player.gain, .15)
  send(player.parent, NaN)
  assert.equal(player.gain, .15)
  send(player.parent, 2)
  assert.equal(player.gain, .6)
  send(player.parent, 0)
  assert.equal(player.gain, 0)
})

test('live ranges follow the scheduler, deduplicate locations, and clear on rests and pause', async () => {
  const player = setup()
  await flush()
  player.events.get('button-click')()
  await flush()
  assert.equal(player.frames.size, 0, 'Closed editors do not query playback')
  const control = source => player.events.get('message')({ source, data: { type: 'signal-music-control', action: 'highlight', enabled: true } })
  control({})
  assert.equal(player.frames.size, 0, 'Unrelated frames cannot enable highlighting')
  control(player.parent)
  assert.equal(player.frames.size, 0, 'Drawing never depends on an offscreen iframe animation clock')
  player.events.get('message')({ source: {}, data: { type: 'signal-music-control', action: 'draw' } })
  assert.equal(player.queries.length, 0, 'Only the parent can request a visual query')
  player.setHaps([{ context: { locations: [{ start: 6, end: 8 }, { start: 6, end: 8 }, { start: -1, end: 2 }, { start: 0, end: 999 }, { start: NaN, end: 4 }] } }])
  player.draw(.125)
  const highlights = () => player.messages.filter(message => message.type === 'signal-music-highlight')
  assert.deepEqual(Array.from(highlights().at(-1).ranges, range => [range.from, range.to]), [[6, 8]])
  assert.equal(player.queries[0][0], .125)
  assert.equal(player.queries[0][2]._cps, .5)
  player.draw(.25)
  assert.equal(highlights().length, 1, 'Unchanged ranges are not resent')
  player.setHaps([])
  player.draw(.625)
  assert.equal(highlights().at(-1).ranges.length, 0, 'Rests clear the last note')
  player.setHaps([{ context: { locations: [{ start: 9, end: 11 }] } }])
  player.draw(.875)
  assert.deepEqual(Array.from(highlights().at(-1).ranges, range => [range.from, range.to]), [[9, 11]])
  player.events.get('button-click')()
  assert.equal(player.frames.size, 0)
  assert.equal(highlights().at(-1).ranges.length, 0)
  assert.equal(player.messages.at(-1).status, 'paused')
})

test('closing the editor and visual query failures leave audio playback running', async () => {
  const player = setup()
  await flush()
  player.events.get('button-click')()
  await flush()
  const enable = enabled => player.events.get('message')({ source: player.parent, data: { type: 'signal-music-control', action: 'highlight', enabled } })
  enable(true)
  player.setHaps([{ context: { locations: [{ start: 6, end: 8 }] } }])
  player.draw(.125)
  enable(false)
  assert.equal(player.frames.size, 0)
  assert.equal(player.messages.at(-1).ranges.length, 0)
  assert.equal(player.audio.state, 'running')
  enable(true)
  player.failQuery()
  player.draw(.25)
  const queries = player.queries.length
  player.draw(.5)
  assert.equal(player.queries.length, queries, 'A failed visual query is not retried on every frame')
  assert.equal(player.frames.size, 0)
  assert.equal(player.stops, 0)
  assert.equal(player.audio.state, 'running')
})

test('the host drives offscreen-frame highlights at 30fps, filters ranges, and cancels its clock on pause or destroy', () => {
  const events = new Map()
  const received = []
  const sent = []
  const frames = new Map()
  let nextFrame = 0
  const frame = { contentWindow: { postMessage: message => sent.push(message) }, setAttribute() {}, remove() {} }
  const context = {
    exports: {}, document: { createElement: () => frame }, location: { href: 'https://example.test/' }, URL,
    window: { addEventListener: (name, handler) => events.set(name, handler), removeEventListener: name => events.delete(name) },
    require: () => ({ default: 'strudel.js', createElement: () => ({ outerHTML: '<svg></svg>' }) }),
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame },
    cancelAnimationFrame: id => frames.delete(id),
  }
  runInNewContext(compiled, context)
  const player = context.exports.createMusicPlayer('note("c4")', .25, false, () => {}, ranges => received.push(ranges))
  const send = (source, ranges) => events.get('message')({ source, data: { type: 'signal-music-highlight', ranges } })
  const state = status => events.get('message')({ source: frame.contentWindow, data: { type: 'signal-music-state', status } })
  const draw = timestamp => { const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(timestamp) }
  send(frame.contentWindow, [{ from: 6, to: 8 }])
  assert.equal(received.length, 0, 'Inactive editors ignore late highlight messages')
  player.setHighlighting(true)
  assert.equal(sent.at(-1).action, 'highlight')
  assert.equal(sent.at(-1).enabled, true)
  assert.equal(frames.size, 0, 'No animation runs before playback')
  state('playing')
  assert.equal(frames.size, 1)
  draw(0)
  draw(10)
  assert.equal(sent.filter(message => message.action === 'draw').length, 1)
  draw(40)
  assert.equal(sent.filter(message => message.action === 'draw').length, 2)
  received.length = 0
  send({}, [{ from: 6, to: 8 }])
  send(frame.contentWindow, 'bad')
  send(frame.contentWindow, Array.from({ length: 513 }, () => ({ from: 6, to: 8 })))
  assert.equal(received.length, 0)
  send(frame.contentWindow, [null, { from: 6, to: 8 }, { from: -1, to: 8 }, { from: 0, to: 99 }, { from: NaN, to: 8 }, { from: 8, to: 6 }])
  assert.deepEqual(Array.from(received[0], range => [range.from, range.to]), [[6, 8]])
  state('paused')
  assert.equal(frames.size, 0)
  assert.equal(received.at(-1).length, 0)
  state('playing')
  assert.equal(frames.size, 1)
  player.setHighlighting(false)
  assert.equal(frames.size, 0)
  send(frame.contentWindow, [{ from: 6, to: 8 }])
  assert.equal(received.at(-1).length, 0, 'Closing the editor rejects queued highlight messages')
  player.setHighlighting(true)
  assert.equal(frames.size, 1)
  player.destroy()
  assert.equal(frames.size, 0)
  assert.equal(received.at(-1).length, 0)
  assert.equal(events.has('message'), false)
})

test('spatial volume is source checked, bounded and restored independently of user volume', async () => {
  const player = setup(false, .5)
  await flush()
  const send = (source, gain, pan) => player.events.get('message')({ source, data: { type: 'signal-music-control', action: 'spatial', gain, pan } })
  send({}, .1, 0)
  assert.equal(player.gain, .3)
  send(player.parent, .2, .5)
  assert.ok(Math.abs(player.gain - .06) < 1e-8)
  send(player.parent, NaN, 0)
  assert.ok(Math.abs(player.gain - .06) < 1e-8)
  send(player.parent, 1, 0)
  assert.equal(player.gain, .3)
})