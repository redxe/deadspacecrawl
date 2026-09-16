import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function loadExtensions() {
  const elements = []
  const document = {
    createElement(tag) {
      const listeners = new Map()
      const element = {
        tag, children: [], value: '', valueAsNumber: NaN, removed: false,
        append(...children) { this.children.push(...children) },
        setAttribute() {},
        addEventListener(name, handler) { listeners.set(name, handler) },
        removeEventListener(name, handler) { if (listeners.get(name) === handler) listeners.delete(name) },
        dispatch(name) { listeners.get(name)?.() },
        remove() { this.removed = true },
      }
      elements.push(element)
      return element
    },
  }
  const schemaContext = { exports: {} }
  runInNewContext(ts.transpileModule(readFileSync(new URL('../src/puzzles/extension-schema.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, schemaContext)
  const context = { exports: {}, document, require: () => schemaContext.exports }
  runInNewContext(ts.transpileModule(readFileSync(new URL('../src/puzzles/extensions.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return { ...context.exports, elements }
}

test('registered settings reject unknown plugins, bad types and out-of-range targets', () => {
  const { validateExtensions } = loadExtensions()
  const puzzle = (plugin, config) => ({ title: 'Test', blocks: [{ type: 'custom', plugin, config }] })
  validateExtensions(puzzle('number-lock', { label: 'Frequency', target: 42 }))
  assert.throws(() => validateExtensions(puzzle('unknown', {})), /not registered/)
  assert.throws(() => validateExtensions(puzzle('number-lock', { label: 'Frequency', target: '42' })), /invalid/)
  assert.throws(() => validateExtensions(puzzle('number-lock', { label: 'Frequency', target: -1 })), /invalid/)
})

test('frequency lock starts blocked, verifies exact values, relocks and cleans up', () => {
  const { puzzleExtensions, elements } = loadExtensions()
  const readiness = []
  const workspace = puzzleExtensions.find(extension => extension.id === 'number-lock').mount({ label: 'Frequency', target: 42 }, { puzzle: { id: 'test' }, preview: true, setReady: ready => readiness.push(ready) })
  const input = elements.find(element => element.tag === 'input')
  assert.deepEqual(readiness, [false])
  input.value = '42'
  input.valueAsNumber = 42
  input.dispatch('input')
  assert.deepEqual(readiness, [false, true])
  input.value = '41'
  input.valueAsNumber = 41
  input.dispatch('input')
  assert.deepEqual(readiness, [false, true, false])
  workspace.destroy()
  input.dispatch('input')
  assert.equal(readiness.length, 3)
  assert.equal(workspace.element.removed, true)
})