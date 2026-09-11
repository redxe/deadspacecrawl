import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const context = { exports: {}, require: () => ({}) }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/music-editor.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const merge = (ranges, length = 100) => Array.from(context.exports.mergeMusicRanges(ranges, length), range => ({ ...range }))

test('overlapping, nested and adjacent source ranges produce one stable playback mark', () => {
  const ranges = [{ from: 15, to: 20 }, { from: 6, to: 12 }, { from: 8, to: 10 }, { from: 10, to: 15 }, { from: 6, to: 12 }]
  const original = structuredClone(ranges)
  assert.deepEqual(merge(ranges), [{ from: 6, to: 20 }])
  assert.deepEqual(ranges, original, 'The source events are not mutated')
})

test('simultaneous nonadjacent notes retain separate highlights in source order', () => {
  assert.deepEqual(merge([{ from: 30, to: 32 }, { from: 6, to: 8 }]), [{ from: 6, to: 8 }, { from: 30, to: 32 }])
  assert.deepEqual(merge([]), [])
})

test('invalid offsets cannot highlight beyond the score', () => {
  assert.deepEqual(merge([
    { from: -1, to: 3 }, { from: 0, to: 101 }, { from: 4, to: 4 }, { from: 8, to: 6 },
    { from: NaN, to: 6 }, { from: 3.5, to: 6 }, { from: 0, to: Infinity }, { from: 98, to: 100 },
  ]), [{ from: 98, to: 100 }])
})