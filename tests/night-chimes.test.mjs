import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

test('chimes are quiet, bounded, muted immediately and disposed with their audio context', () => {
  const instances = []
  const parameter = () => ({ value: 0, cancelScheduledValues() {}, setValueAtTime(value) { this.value = value }, setTargetAtTime(value) { this.value = value }, linearRampToValueAtTime(value) { this.value = value }, exponentialRampToValueAtTime(value) { this.value = value } })
  const node = () => ({ connect() {}, disconnect() { this.disconnected = true } })
  class Context {
    currentTime = 0; state = 'running'; destination = {}; gains = []; oscillators = []
    constructor() { instances.push(this) }
    createGain() { const gain = { ...node(), gain: parameter() }; this.gains.push(gain); return gain }
    createStereoPanner() { return { ...node(), pan: parameter() } }
    createOscillator() { const oscillator = { ...node(), frequency: parameter(), start() {}, stop() {} }; this.oscillators.push(oscillator); return oscillator }
    async resume() { this.state = 'running' }
    async suspend() { this.state = 'suspended' }
    async close() { this.state = 'closed' }
  }
  const context = { exports: {}, AudioContext: Context }
  runInNewContext(ts.transpileModule(readFileSync(new URL('../src/mansion/night-chimes.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
  const chimes = context.exports.createNightChimes()
  chimes.resume(); chimes.resume()
  assert.equal(instances.length, 1)
  const audio = instances[0]
  chimes.update(1, 0, false)
  assert.equal(audio.oscillators.length, 0)
  chimes.update(1, 1, false)
  assert.equal(audio.oscillators.length, 2)
  assert.equal(audio.gains[0].gain.value, .045)
  chimes.update(10, 1, true)
  assert.equal(audio.gains[0].gain.value, 0)
  assert.equal(audio.oscillators.length, 2)
  chimes.suspend(); assert.equal(audio.state, 'suspended')
  chimes.resume(); chimes.update(1, 1, false)
  assert.equal(audio.oscillators.length, 4)
  chimes.destroy(); assert.equal(audio.state, 'closed')
  chimes.resume(); assert.equal(instances.length, 1)
})