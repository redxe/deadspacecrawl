import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const modules = new Map()
const saved = new Map()
let storageBlocked = false
function load(name) {
  if (modules.has(name)) return modules.get(name)
  const context = { exports: {}, require: load, localStorage: {
    getItem: key => { if (storageBlocked) throw new Error('Blocked'); return saved.get(key) ?? null },
    setItem: (key, value) => { if (storageBlocked) throw new Error('Blocked'); saved.set(key, value) },
  } }
  const code = ts.transpileModule(readFileSync(new URL(`../src/${name.replace('./', '')}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  runInNewContext(code, context)
  modules.set(name, context.exports)
  return context.exports
}
const { CHARACTER_KEYS } = load('./glyphs')
const tools = load('./relay-tools').createRelayTools(CHARACTER_KEYS)
const { createEntryGate } = load('./entry-gate')

test('password maps to ordered glyphs, exact bit slots, and invertible math', () => {
  const indices = [15, 4, 18, 19, 14]
  const packed = tools.pack(indices)
  assert.equal(tools.glyphs(indices), 'PESTO')
  assert.equal(tools.relay(tools.relay(packed), true), packed)
  assert.equal(JSON.stringify(tools.unpack(packed)), JSON.stringify(indices))
  assert.equal(tools.bits(packed).binary.split(' ').length, 5)
  assert.throws(() => tools.relay(Number(tools.relay(packed)), true), /integer string/)
  assert.throws(() => tools.relay('1389', true), /exact integer/)
  assert.throws(() => tools.pack([41]), /glyph indices/)
  assert.throws(() => tools.unpack(-1), /nonnegative/)
  assert.throws(() => tools.unpack(64, 1), /does not fit/)
})

test('three sequential seals persist and reject bypass answers', () => {
  saved.clear()
  let gate = createEntryGate()
  assert.equal(gate.locked, true)
  assert.equal(gate.submit('PESTO'), false)
  assert.equal(gate.submit(String(tools.relay(gate.puzzle.consoleData.encoded, true))), true)
  gate = createEntryGate()
  assert.equal(gate.puzzle.id, 'entry-bits')
  assert.equal(gate.submit('15,4,18,19'), false)
  assert.equal(gate.submit('15, 4, 18, 19, 14'), true)
  assert.equal(gate.puzzle.id, 'entry-glyphs')
  assert.equal(gate.submit('pesto '), true)
  assert.equal(createEntryGate().locked, false)
  saved.clear()
})

test('malformed storage fails closed and blocked storage permits in-page completion', () => {
  for (const value of ['invalid', '{"stage":-1}', '{"stage":4}', '{"stage":"3"}', '{"stage":1.5}']) {
    saved.set('signal-archive.entry.v1', value)
    assert.equal(createEntryGate().puzzle.id, 'entry-math')
  }
  saved.clear()
  storageBlocked = true
  try {
    const gate = createEntryGate()
    assert.equal(gate.submit(String(tools.relay(gate.puzzle.consoleData.encoded, true))), true)
    assert.equal(gate.submit('[15,4,18,19,14]'), true)
    assert.equal(gate.submit('PESTO'), true)
    assert.equal(gate.locked, false)
    assert.equal(createEntryGate().locked, true)
  } finally { storageBlocked = false }
})