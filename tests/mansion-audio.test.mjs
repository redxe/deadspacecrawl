import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText

test('environment response separates bands and bounds corrupt or excessive spectrum values', () => {
  const context = { exports: {} }
  runInNewContext(compile('../src/mansion/music-response.ts'), context)
  const response = context.exports.musicResponse
  assert.deepEqual(Array.from(response([])), [0, 0, 0])
  assert.deepEqual(Array.from(response(Array(48).fill(1))), [1, 1, 1])
  assert.deepEqual(Array.from(response(Array(48).fill(NaN))), [0, 0, 0])
  const bands = [...Array(12).fill(.4), ...Array(36).fill(0)]
  assert.ok(response(bands)[0] > .6)
  assert.deepEqual(Array.from(response(bands)).slice(1), [0, 0])
})

test('taps alternate feet at double cadence and blend room convolution with cleanup', async () => {
  const sounds = []
  const contexts = []
  const revoked = []
  const buffer = length => ({ data: new Float32Array(length), copyToChannel(data) { this.data.set(data) }, getChannelData() { return this.data } })
  class OfflineAudioContext {
    constructor(channels, length, rate) { this.length = length; this.rate = rate; contexts.push(this) }
    createBuffer(channels, length) { return buffer(length) }
    createBufferSource() { return { connect() {}, start() {} } }
    createConvolver() { this.convolver = { connect() {} }; return this.convolver }
    async startRendering() { return buffer(this.length) }
  }
  class Howl {
    plays = 0; rates = []; pans = []; volumes = []
    constructor() { sounds.push(this) }
    state() { return 'loaded' }
    play() { return ++this.plays }
    rate(value) { this.rates.push(value) }
    stereo(value) { this.pans.push(value) }
    volume(value) { this.volumes.push(value) }
    stop() { this.stopped = true }
    unload() { this.unloaded = true }
  }
  const document = { hidden: false }
  const context = { exports: {}, document, OfflineAudioContext, Blob, URL: { createObjectURL: () => `blob:${sounds.length}`, revokeObjectURL: url => revoked.push(url) }, require: name => name === 'howler' ? { Howl } : require(name) }
  runInNewContext(compile('../src/mansion/footsteps.ts'), context)
  const footsteps = context.exports.createFootsteps()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(context.exports.footstepDistance * 2, 1.55)
  assert.equal(sounds.length, 3)
  assert.ok(contexts[1].length > contexts[0].length * 2)
  assert.ok(contexts.every(room => room.convolver.buffer.data.some(value => value !== 0)))
  footsteps.step(false, 0)
  footsteps.step(false, 1)
  assert.deepEqual(sounds[0].pans, [-.1, .1])
  assert.deepEqual(sounds[0].rates, [.98, 1.025])
  assert.deepEqual(sounds[1].volumes, [.045])
  assert.deepEqual(sounds[2].volumes, [.1])
  footsteps.step(true, 1)
  document.hidden = true; footsteps.step(false, 1)
  assert.equal(sounds[0].plays, 2)
  footsteps.stop(); assert.ok(sounds.every(sound => sound.stopped))
  footsteps.destroy(); assert.ok(sounds.every(sound => sound.unloaded))
  assert.equal(revoked.length, 3)
})