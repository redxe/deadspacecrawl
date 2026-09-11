import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const compiled = ts.transpileModule(readFileSync(new URL('../src/music-player.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText + '\nexports.testRuntime = playerRuntime'
const flush = () => new Promise(resolve => setImmediate(resolve))

test('spectrum sampling taps the master output once and emits bounded real audio data only while audible', async () => {
  const events = new Map()
  const messages = []
  const connections = []
  const disconnects = []
  let analysers = 0
  let samples = 0
  const analyser = {
    getByteFrequencyData: values => { values.fill(128); samples++ },
    getByteTimeDomainData: values => { values.fill(192) },
    disconnect: () => disconnects.push('analyser'),
  }
  const source = {
    gain: { cancelScheduledValues() {}, setValueAtTime() {}, setTargetAtTime() {} },
    connect: target => connections.push(target),
    disconnect: target => disconnects.push(target),
  }
  const parent = { postMessage: message => messages.push(message) }
  const button = { setAttribute() {}, addEventListener: (name, callback) => events.set(`button-${name}`, callback) }
  const context = {
    exports: {}, parent,
    require: () => ({}), setTimeout: callback => { callback(); return 0 },
    document: { querySelector: selector => selector === 'button' ? button : {} },
    window: {
      addEventListener: (name, callback) => events.set(name, callback),
      initStrudel: async () => ({ stop() {} }), evaluate: async () => {},
      getSuperdoughAudioController: () => ({ output: { destinationGain: source } }),
    },
    AudioContext: class {
      state = 'suspended'
      currentTime = 0
      createAnalyser() { analysers++; return analyser }
      async resume() { this.state = 'running' }
      async suspend() { this.state = 'suspended' }
      async close() { this.state = 'closed' }
    },
  }
  runInNewContext(compiled, context)
  context.exports.testRuntime('note("c4")', .25, true, '', '')
  await flush()
  const send = (action, volume, sender = parent) => events.get('message')({ source: sender, data: { type: 'signal-music-control', action, volume } })
  send('spectrum', undefined, {})
  assert.equal(analysers, 0, 'Unrelated frames cannot request samples')
  send('spectrum')
  const spectrum = messages.at(-1)
  assert.equal(spectrum.type, 'signal-music-spectrum')
  assert.equal(spectrum.bands.length, 48)
  assert.ok(spectrum.bands.every(value => value === 128 / 255))
  assert.equal(spectrum.waveform.length, 64)
  assert.ok(spectrum.waveform.every(value => value === .5))
  assert.equal(connections[0], analyser)
  assert.equal(analyser.fftSize, 1024)
  send('spectrum')
  assert.equal(analysers, 1, 'The analyser is reused')
  assert.equal(samples, 2)
  send('volume', 0)
  send('spectrum')
  assert.equal(samples, 2, 'Muted audio is not sampled')
  send('volume', .25)
  send('pause')
  send('spectrum')
  assert.equal(samples, 2, 'Paused audio is not sampled')
  events.get('pagehide')()
  assert.deepEqual(disconnects, [analyser, 'analyser'])
})

test('visualizer uses the parent clock with the editor closed and rejects invalid spectrum messages', () => {
  const events = new Map()
  const frames = new Map()
  const sent = []
  const received = []
  let nextFrame = 0
  const frame = { contentWindow: { postMessage: message => sent.push(message) }, setAttribute() {}, remove() {} }
  const context = {
    exports: {}, document: { createElement: () => frame }, location: { href: 'https://example.test/' }, URL,
    window: { addEventListener: (name, callback) => events.set(name, callback), removeEventListener: name => events.delete(name) },
    require: () => ({ default: 'strudel.js', createElement: () => ({ outerHTML: '<svg></svg>' }) }),
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame },
    cancelAnimationFrame: id => frames.delete(id),
  }
  runInNewContext(compiled, context)
  const player = context.exports.createMusicPlayer('note("c4")', .25, true, () => {}, undefined, data => received.push(data))
  const state = status => events.get('message')({ source: frame.contentWindow, data: { type: 'signal-music-state', status } })
  const spectrum = { type: 'signal-music-spectrum', bands: Array(48).fill(.4), waveform: Array(64).fill(.1) }
  const send = (data = spectrum, source = frame.contentWindow) => events.get('message')({ source, data })
  player.setVisualizing(true)
  state('playing')
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach(callback => callback(0))
  assert.deepEqual(sent.map(message => message.action), ['spectrum'], 'No score queries are needed')
  received.length = 0
  send(spectrum, {})
  send({ ...spectrum, bands: Array(49).fill(.4) })
  send({ ...spectrum, bands: Array(48).fill(NaN) })
  send({ ...spectrum, waveform: Array(64).fill(2) })
  send({ ...spectrum, waveform: Array(64).fill('0') })
  assert.equal(received.length, 0)
  send()
  assert.equal(received.length, 1)
  state('paused')
  assert.equal(received.at(-1), null)
  assert.equal(frames.size, 0)
  state('playing')
  assert.equal(frames.size, 1)
  player.setVisualizing(false)
  assert.equal(received.at(-1), null)
  assert.equal(frames.size, 0)
  send()
  assert.equal(received.at(-1), null, 'Late packets cannot repaint a muted visualizer')
  player.destroy()
  assert.equal(events.has('message'), false)
})