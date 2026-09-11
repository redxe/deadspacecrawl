import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const compiled = ts.transpileModule(readFileSync(new URL('../src/typing-sounds.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const flush = () => new Promise(resolve => setImmediate(resolve))

function setup(delayed = false, unsupported = false) {
  let now = 0
  const contexts = []
  const sources = []
  const buffers = []
  const gains = []
  const resumes = []
  const document = { hidden: false }
  class AudioContext {
    state = 'suspended'
    sampleRate = 48000
    currentTime = 0
    destination = {}
    constructor() { if (unsupported) throw Error('Audio unavailable'); contexts.push(this) }
    createBuffer(channels, length, sampleRate) {
      const samples = new Float32Array(length)
      const buffer = { channels, length, sampleRate, getChannelData: () => samples }
      buffers.push(buffer)
      return buffer
    }
    createBiquadFilter() { return { frequency: { value: 0 }, Q: { value: 0 }, connect: destination => destination } }
    createGain() {
      const gain = { value: 0, setTargetAtTime(value) { this.value = value } }
      gains.push(gain)
      return { gain, connect: destination => destination }
    }
    createBufferSource() {
      const source = { playbackRate: { value: 0 }, connect() {}, disconnect() { this.disconnected = true }, start() { this.started = true } }
      sources.push(source)
      return source
    }
    resume() {
      if (delayed) return new Promise(resolve => resumes.push(() => { this.state = 'running'; resolve() }))
      this.state = 'running'
      return Promise.resolve()
    }
    async suspend() { this.state = 'suspended' }
    async close() { this.state = 'closed' }
  }
  const context = { exports: {}, require: () => ({}), AudioContext, document, performance: { now: () => now } }
  runInNewContext(compiled, context)
  return { audio: context.exports.createTypingAudio(), contexts, sources, buffers, gains, document, advance: value => { now = value }, resume: () => resumes.splice(0).forEach(resolve => resolve()) }
}

test('typing clicks use one quiet reusable audio context and a short decaying buffer', async () => {
  const player = setup()
  assert.equal(player.contexts.length, 0, 'Audio is lazy until an editing gesture')
  player.audio.play()
  await flush()
  assert.equal(player.sources.length, 1)
  assert.equal(player.gains[0].value, .075)
  assert.equal(player.buffers[0].length, 1152)
  const samples = player.buffers[0].getChannelData(0)
  assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) <= 1))
  assert.ok(Math.max(...samples.slice(-100).map(Math.abs)) < .001)
  player.advance(10)
  player.audio.play()
  assert.equal(player.sources.length, 1, 'Rapid bursts are bounded')
  player.advance(50)
  player.audio.play()
  assert.equal(player.sources.length, 2)
  assert.equal(player.contexts.length, 1)
  assert.equal(player.buffers.length, 1)
  assert.equal(player.sources[0].buffer, player.sources[1].buffer)
  player.sources[0].onended()
  assert.equal(player.sources[0].disconnected, true)
})

test('mute, hidden pages, and disposal suppress typing audio', async () => {
  const player = setup()
  player.audio.setMuted(true)
  player.audio.play()
  assert.equal(player.contexts.length, 0)
  player.audio.setMuted(false)
  player.audio.play()
  await flush()
  player.audio.setMuted(true)
  assert.equal(player.gains[0].value, 0)
  assert.equal(player.contexts[0].state, 'suspended')
  player.advance(100)
  player.audio.play()
  assert.equal(player.sources.length, 1)
  player.audio.setMuted(false)
  player.document.hidden = true
  player.audio.play()
  assert.equal(player.sources.length, 1)
  player.document.hidden = false
  player.audio.destroy()
  player.audio.play()
  assert.equal(player.contexts[0].state, 'closed')
  assert.equal(player.sources.length, 1)
})

test('delayed audio permission never replays old typing or a click muted while waiting', async () => {
  const delayed = setup(true)
  delayed.audio.play()
  delayed.advance(500)
  delayed.resume()
  await flush()
  assert.equal(delayed.sources.length, 0)
  const muted = setup(true)
  muted.audio.play()
  muted.audio.setMuted(true)
  muted.resume()
  await flush()
  assert.equal(muted.sources.length, 0)
})

test('unsupported audio never breaks typing', () => {
  const player = setup(false, true)
  assert.doesNotThrow(() => player.audio.prime())
  assert.doesNotThrow(() => player.audio.play())
  assert.doesNotThrow(() => player.audio.destroy())
})