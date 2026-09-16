import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { registerHooks } from 'node:module'
import ts from 'typescript'
import { dictionary } from 'cmu-pronouncing-dictionary'

const moduleHooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^@kabelsalat\/(web|core|lib)$/.test(specifier)) return nextResolve(`${specifier}/dist/index.mjs`, context)
    return nextResolve(specifier, context)
  },
})
const core = await import('@strudel/core')
const mini = await import('@strudel/mini')
const { evaluate } = await import('@strudel/transpiler')
moduleHooks.deregister()

const context = { exports: {} }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/music-library.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
let cyclesPerSecond
await core.evalScope(core, mini, { setcps: value => { cyclesPerSecond = value } })

test('Strudel exposes timed source locations through rests and loop repeats', async () => {
  const { pattern } = await evaluate('note("c4 e4 ~ g4").s("sine").ribbon(0,96)')
  const locationsAt = time => pattern.queryArc(time, time + .001).flatMap(event => event.context.locations ?? [])
  const first = locationsAt(.125)
  const second = locationsAt(.375)
  assert.ok(first.length > 0, 'Sounding notes retain source locations')
  assert.ok(second.length > 0, 'The next note retains source locations')
  assert.notDeepEqual(first, second, 'The highlight follows the active note')
  assert.deepEqual(locationsAt(.625), [], 'Rests do not leave notes highlighted')
  assert.deepEqual(locationsAt(96.125), first, 'Looped notes retain original source locations')
})

function cycleEvents(pattern, cycle) {
  return pattern.queryArc(cycle, cycle + 1).filter(event => event.hasOnset()).map(event => ({
    begin: Number((event.whole.begin.valueOf() - cycle).toFixed(7)),
    duration: Number(event.whole.duration.valueOf().toFixed(7)),
    value: Object.fromEntries(Object.entries(event.value).sort(([first], [second]) => first.localeCompare(second)).map(([key, value]) => [
      key, typeof value === 'number' ? Number(value.toFixed(7)) : value,
    ])),
  })).sort((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second)))
}

for (const song of context.exports.builtInSongs) {
  const length = 96
  test(`${song.name}: complete, varied ${length}-cycle arrangement with a repeatable boundary`, async () => {
    const { pattern } = await evaluate(song.code)
    assert.ok(cyclesPerSecond > 0 && cyclesPerSecond < 1)
    const cycles = Array.from({ length }, (_, cycle) => cycleEvents(pattern, cycle))
    assert.ok(cycles.every(events => events.length > 0), 'No accidental silent cycles')
    assert.ok(cycles.every(events => events.length < 300), 'Bounded event density')
    assert.ok(new Set(cycles.map(events => events.length)).size >= 3, 'Arrangement changes its event density')
    for (const events of cycles) {
      for (const event of events) {
        assert.ok(event.duration > 0)
        for (const value of Object.values(event.value)) {
          if (typeof value === 'number') assert.ok(Number.isFinite(value), 'Finite audio parameters')
        }
        assert.ok(event.value.gain >= 0 && event.value.gain <= .5, 'Conservative individual voice gain')
      }
    }
    assert.notDeepEqual(cycles[0], cycles[8], 'The second section develops the opening')
    assert.notDeepEqual(cycles[8], cycles[16], 'The third section changes the texture')
    assert.notDeepEqual(cycles[0], cycles[32], 'The longer form does not repeat after 32 cycles')
    assert.notDeepEqual(cycles[0], cycles[64], 'The reprise is not a copy of the opening')
    const gains = cycles.map(events => events.reduce((sum, event) => sum + event.value.gain, 0))
    assert.ok(Math.max(...gains) > Math.min(...gains) * 1.5, 'Audible section-level dynamic contrast')
    const pans = cycles.flatMap(events => events.map(event => event.value.pan))
    assert.ok(pans.every(pan => Number.isFinite(pan) && pan >= 0 && pan <= 1), 'Valid stereo placement')
    assert.ok(Math.max(...pans) - Math.min(...pans) >= .45, 'Deliberate stereo spread')
    for (const cycle of [0, 15, 16, 31, 32, 47, 48, 63, 64, 79, 80, length - 1]) {
      assert.deepEqual(cycleEvents(pattern, cycle + length), cycles[cycle], `Repeat at cycle ${cycle + length}`)
    }
  })
}

test('Soft Return keeps its melody, counterlines and bass inside the current minor-key harmony', async () => {
  const song = context.exports.builtInSongs.find(song => song.id === 'soft-return')
  const { pattern } = await evaluate(song.code)
  assert.equal(cyclesPerSecond * 240, 74)
  const harmony = [[2, 5, 9], [0, 5, 9], [0, 4, 7], [10, 2, 5], [7, 10, 2], [2, 5, 9], [9, 0, 4], [2, 5, 9]]
  for (let cycle = 0; cycle < 96; cycle++) {
    const allowed = harmony[Math.floor(cycle / 2) % harmony.length]
    for (const event of cycleEvents(pattern, cycle)) {
      if (event.value.note === undefined) continue
      assert.ok(allowed.includes(Number(event.value.note) % 12), `Non-chord tone ${event.value.note} in cycle ${cycle}`)
    }
  }
})

test('Robin electronic arrangement sings complete lyrics, uses G C F Am and loops after 56 bars', async () => {
  const voiceContext = { exports: {} }
  runInNewContext(ts.transpileModule(readFileSync(new URL('../src/robin-voice.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, voiceContext)
  const audio = { sampleRate: 22050, createBuffer: () => ({ getChannelData: () => new Float32Array(11025) }), createPeriodicWave() {} }
  await voiceContext.exports.installRobinVoice(audio, { ...core, registerSound() {} }, dictionary)
  const { pattern } = await evaluate(context.exports.robinSong.code)
  assert.equal(cyclesPerSecond * 240, 104)
  const events = pattern.queryArc(0, 56).filter(event => event.hasOnset())
  assert.ok(events.length > 1000 && events.length < 3500)
  assert.ok(events.every(event => ['sine', 'triangle', 'sawtooth', 'pink', 'white', 'robin-formant'].includes(event.value.s)))
  for (const event of events) assert.ok(event.value.gain > 0 && event.value.gain <= .54 + 1e-9, `Invalid mix gain: ${JSON.stringify(event.value)}`)
  assert.ok(events.every(event => event.value.note === undefined || Number.isFinite(Number(event.value.note))), 'Generated note sequences must be numeric Strudel patterns, not literal space-separated strings')
  for (const cycle of [0, 4, 12, 40, 44]) {
    const notes = cycleEvents(pattern, cycle)
    assert.equal(notes.filter(event => event.value.s === 'sine' && Number(event.value.note) < 36).length, 3, 'Rounded sub-bass under the electronic rhythm')
    assert.equal(notes.filter(event => event.value.s === 'sine' && event.value.attack === .008).length, 8, 'Eight soft arpeggio notes per bar')
    const wobble = notes.filter(event => event.value.robinBeat === 'bass')
    assert.ok(wobble.length >= 4 && wobble.every(event => event.value.cutoff >= 150 && event.value.cutoff <= 850))
    assert.ok(notes.some(event => event.value.robinBeat === 'kick'))
    assert.equal(notes.filter(event => event.value.robinBeat === 'snare').length, 1)
  }
  const singers = events.filter(event => event.value.s === 'robin-formant')
  assert.ok(singers.length > 200 && singers.length < 600)
  assert.ok(singers.every(event => /[AEIOU]/.test(event.value.phonemes) && event.value.note >= 64 && event.value.note <= 79))
  const opening = singers.filter(event => event.whole.begin.valueOf() >= 4 && event.whole.begin.valueOf() < 6).map(event => event.value.lyric)
  assert.equal(opening.join(' '), 'a door swung wide and there you were')
  const hook = singers.filter(event => event.whole.begin.valueOf() >= 12 && event.whole.begin.valueOf() < 14)
  assert.equal(hook.map(event => event.value.lyric).join(' '), 'robin robin you keep robbing robbing my heart')
  assert.deepEqual(hook.filter(event => event.value.lyric === 'robin').map(event => event.value.phonemes), hook.filter(event => event.value.lyric === 'robbing').map(event => event.value.phonemes))
  for (const start of [4, 6, 8, 10, 12, 14, 16, 18, 24, 26, 28, 30, 40, 42]) {
    const line = singers.filter(event => event.whole.begin.valueOf() >= start && event.whole.begin.valueOf() < start + 2)
    assert.equal(line.length, 8, `Eight syllables per phrase at bar ${start}`)
    assert.ok(line.at(-1).whole.end.valueOf() < start + 1.875, 'A breath before the instrumental answer')
    assert.ok(line.every(event => event.value.room <= .12 && event.value.formant === 1.04))
  }
  const bassGainAt = cycle => cycleEvents(pattern, cycle).find(event => event.value.s === 'sine' && event.value.note < 36).value.gain
  assert.ok(bassGainAt(4) < bassGainAt(0) * .85, 'Backing leaves room for the vocal entrance')
  assert.ok(bassGainAt(40) < bassGainAt(12), 'Bridge stays intimate')
  assert.ok(bassGainAt(44) < bassGainAt(12) * 1.05, 'Final harmony does not trigger a large backing jump')
  const finalVocals = singers.filter(event => event.whole.begin.valueOf() >= 44 && event.whole.begin.valueOf() < 52)
  assert.ok(finalVocals.filter(event => event.value.pan !== .5).every(event => event.value.gain <= .1), 'Harmony remains behind the lead')
  const fills = events.filter(event => event.value.s === 'sine' && event.value.attack === .1 && event.whole.begin.valueOf() < 52)
  assert.ok(fills.length > 0 && fills.every(event => Math.abs(event.whole.begin.valueOf() % 2 - 1.875) < .03), 'Fills answer at the end of each two-bar phrase')
  for (let cycle = 0; cycle < 56; cycle++) {
    assert.ok(cycleEvents(pattern, cycle).length > 0)
    assert.deepEqual(cycleEvents(pattern, cycle), cycleEvents(pattern, cycle + 56))
  }
  const chordTones = [[7, 11, 2], [0, 4, 7], [5, 9, 0], [9, 0, 4]]
  for (let cycle = 4; cycle < 12; cycle++) {
    const allowed = chordTones[Math.floor((cycle - 4) / 2)]
    const accompaniment = cycleEvents(pattern, cycle).filter(event => event.value.s === 'sawtooth')
    assert.ok(accompaniment.length > 0)
    assert.ok(accompaniment.every(event => allowed.includes(event.value.note % 12)))
  }
  assert.ok(cycleEvents(pattern,55).filter(event => event.value.s === 'sawtooth').every(event => [7,11,2].includes(event.value.note % 12)))
})