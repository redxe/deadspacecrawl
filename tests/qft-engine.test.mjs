import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { jsqubits } from 'jsqubits'
import ts from 'typescript'

const context = { exports: {}, require: () => ({ jsqubits }) }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/qft-engine.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const engine = context.exports

test('QFT uses positive Fourier phase and inverse recovers position/glyph pairs', () => {
  const basis = Array.from({ length: 256 }, (_, index) => ({ real: index === 3 ? 1 : 0, imaginary: 0 }))
  const fourier = engine.transformStatevector(basis, false)
  for (const [index, amplitude] of fourier.entries()) {
    assert.ok(Math.abs(amplitude.real - Math.cos(2 * Math.PI * 3 * index / 256) / 16) < 1e-10)
    assert.ok(Math.abs(amplitude.imaginary - Math.sin(2 * Math.PI * 3 * index / 256) / 16) < 1e-10)
  }
  const recovered = engine.transformStatevector(engine.receivedStatevector(), true)
  const occupied = Array.from(recovered.entries()).filter(([, amplitude]) => amplitude.real ** 2 + amplitude.imaginary ** 2 > 1e-8)
  assert.deepEqual(occupied.map(([index]) => [Math.floor(index / 32), index % 32]), [[0,21],[1,8],[2,14],[3,11],[4,4],[5,19]])
  assert.ok(occupied.every(([, amplitude]) => Math.abs(amplitude.real - 1 / Math.sqrt(6)) < 1e-10 && Math.abs(amplitude.imaginary) < 1e-10))
})
test('statevector validation rejects bad shape, nonfinite values and nonunit norm', () => {
  assert.throws(() => engine.transformStatevector([], true), /256/)
  const invalid = Array.from({ length: 256 }, () => ({ real: 0, imaginary: 0 }))
  assert.throws(() => engine.transformStatevector(invalid, true), /probability/)
  invalid[0].real = Infinity
  assert.throws(() => engine.transformStatevector(invalid, true), /finite/)
})
test('glyph entry is exact and six-bit packing preserves zero-based indices and order', () => {
  assert.ok(engine.matchesSignal([21,8,14,11,4,19]))
  assert.equal(engine.matchesSignal([21,8,14,11,4]), false)
  assert.equal(engine.matchesSignal([19,4,11,14,8,21]), false)
  assert.equal(engine.packGlyphIndices([21,8,14,11,4,19]), BigInt('0b010101001000001110001011000100010011'))
  assert.throws(() => engine.packGlyphIndices([0,1,2,3,4,26]))
})