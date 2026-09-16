import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { dictionary } from 'cmu-pronouncing-dictionary'

const context = { exports: {} }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/robin-voice.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)

async function fixture() {
  let helper
  let trigger
  const nodes = []
  const parameter = () => ({ events: [], setValueAtTime(value, time) { this.events.push([value, time]) }, linearRampToValueAtTime(value, time) { this.events.push([value, time]) }, exponentialRampToValueAtTime(value, time) { this.events.push([value, time]) }, setTargetAtTime(value, time) { this.events.push([value, time]) } })
  const node = (source = false) => {
    const result = { gain: parameter(), frequency: parameter(), detune: parameter(), Q: parameter(), connect() {}, disconnect() { this.disconnected = true }, setPeriodicWave() {}, start(time) { this.started = time }, stop(time) { this.stopped = time }, source }
    nodes.push(result); return result
  }
  const audio = { sampleRate: 22050, createBuffer: () => ({ getChannelData: () => new Float32Array(11025) }), createPeriodicWave() {}, createGain: () => node(), createBiquadFilter: () => node(), createOscillator: () => node(true), createBufferSource: () => node(true) }
  const pattern = value => ({ ...value, slow(factor) { return { ...this, factor } } })
  const engine = {
    registerSound: (name, callback) => { assert.equal(name, 'robin-formant'); trigger = callback },
    evalScope: async scope => { helper = scope.robinVoice },
    pure: value => pattern({ value }), silence: pattern({ silent: true }),
    timeCat: (...parts) => pattern({ parts }), slowcat: (...lines) => pattern({ lines }),
  }
  await context.exports.installRobinVoice(audio, engine, dictionary)
  return { helper, trigger, nodes }
}

test('plain lyric edits change phonemes, keep complete two-bar lines and reserve a breath', async () => {
  const { helper } = await fixture()
  const first = helper(['Robin comes home', 'Your light is gold'], [[74,71,67,72]])
  assert.equal(first.factor, 2)
  assert.equal(first.lines.length, 2)
  assert.equal(first.lines[0].parts.at(-1)[1].silent, true)
  const values = first.lines[0].parts.filter(([, part]) => part.value).map(([, part]) => part.value)
  assert.equal(values.map(value => value.lyric).join(' '), 'robin robin comes home')
  assert.ok(values.some(value => value.phonemes.includes('AA1')))
  const second = helper(['Violet comes home'], [[74,71,67,72]])
  assert.notEqual(JSON.stringify(second.lines[0].parts), JSON.stringify(first.lines[0].parts))
  const custom = helper(['Zzyra'], [[74]], { pronunciation: { zzyra: 'Z IY1 R AH0' } })
  assert.equal(custom.lines[0].parts.filter(([, part]) => part.value).length, 2)
  assert.throws(() => helper(['Zzyra'], [[74]]), /No pronunciation/)
  assert.throws(() => helper(['Zzyra'], [[74]], { pronunciation: { zzyra: 'INVALID' } }), /Invalid pronunciation/)
  assert.throws(() => helper(['Robin'], [[NaN]]), /MIDI melody/)
  assert.throws(() => helper(['Robin'], [[74]], { barsPerLine: Infinity }), /timing/)
})

test('synth schedules voiced vowels, noisy consonants, diphthongs and bounded stop cleanup', async () => {
  const { trigger, nodes } = await fixture()
  let ended = 0
  const handle = trigger(2, { duration: .6, note: 74, phonemes: 'S AY1 N', formant: 1.08 }, () => ended++)
  const sources = nodes.filter(node => node.source)
  assert.equal(sources.length, 3)
  assert.ok(sources.every(source => source.started === 2 && Math.abs(source.stopped - 2.66) < .00001))
  assert.ok(nodes.some(node => node.type === 'bandpass' && node.frequency.events.length >= 4), 'Diphthongs schedule a changing formant')
  assert.ok(nodes.some(node => node.gain.events.some(([value]) => value === .18)), 'Sibilance is reduced at the noise source, not removed')
  assert.ok(nodes.some(node => node.type === 'highshelf' && node.gain.value === -4 && node.frequency.value === 3200))
  assert.ok(nodes.some(node => node.type === 'lowpass' && node.frequency.value === 7600 && node.Q.value === .5))
  const envelope = [[0, 2], [.5, 2.025], [.5, 2.528], [0, 2.635]]
  assert.equal(handle.node.gain.events.length, envelope.length)
  assert.ok(handle.node.gain.events.every(([value, time], index) => value === envelope[index][0] && Math.abs(time - envelope[index][1]) < .00001))
  handle.stop(2.4)
  assert.ok(sources.every(source => source.stopped === 2.4))
  sources[0].onended(); sources[0].onended()
  assert.equal(ended, 1)
  assert.ok(nodes.every(node => node.disconnected))
})