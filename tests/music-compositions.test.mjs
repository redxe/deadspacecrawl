import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { registerHooks } from 'node:module'
import ts from 'typescript'

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