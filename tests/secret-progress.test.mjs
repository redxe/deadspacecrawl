import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const source = ts.transpileModule(readFileSync(new URL('../src/secret-progress.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
function load(storage) {
  const context = { exports: {}, localStorage: storage }
  runInNewContext(source, context)
  return context.exports
}
function memoryStorage() {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values }
}

test('partial and complete entries persist across instances and stay scoped to a message revision', () => {
  const storage = memoryStorage()
  load(storage).saveSecretProgress('first', 'revision-1', ['TH', '', 'X'])
  const nextVisit = load(storage)
  assert.equal(JSON.stringify(nextVisit.readSecretProgress('first', 'revision-1')), '["TH","","X"]')
  assert.equal(nextVisit.readSecretProgress('second', 'revision-1').length, 0)
  assert.equal(nextVisit.readSecretProgress('first', 'revision-2').length, 0)
  nextVisit.saveSecretProgress('first', 'revision-1', ['TH', 'E', '!'])
  assert.equal(JSON.stringify(load(storage).readSecretProgress('first', 'revision-1')), '["TH","E","!"]')
  nextVisit.saveSecretProgress('first', 'revision-1', ['', '', ''])
  assert.equal(storage.values.size, 0)
})
test('corrupt, oversized and malformed saved data is ignored', () => {
  const storage = memoryStorage(), progress = load(storage)
  for (const value of ['{', 'x'.repeat(25001), JSON.stringify({ revision: 'r', values: [42] }), JSON.stringify({ revision: 'r', values: ['TOOLONG'] }), JSON.stringify({ revision: 'r', values: Array(4001).fill('') })]) {
    storage.setItem('signal-archive.secret-progress.v1.first', value)
    assert.equal(progress.readSecretProgress('first', 'r').length, 0)
  }
})
test('unavailable storage never interrupts decoding', () => {
  const progress = load({ getItem() { throw Error('blocked') }, setItem() { throw Error('quota') }, removeItem() { throw Error('blocked') } })
  assert.equal(progress.readSecretProgress('first', 'r').length, 0)
  assert.doesNotThrow(() => progress.saveSecretProgress('first', 'r', ['A']))
  assert.doesNotThrow(() => progress.saveSecretProgress('first', 'r', ['']))
})