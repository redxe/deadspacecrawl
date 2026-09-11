import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const context = { exports: {} }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/puzzle-path-state.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const { getPuzzlePath } = context.exports
const puzzles = Array.from({ length: 8 }, (_, index) => ({ id: String(index), title: `Puzzle ${index}`, completed: false, configured: index < 4 }))
const statuses = entries => Array.from(getPuzzlePath(entries), entry => entry.status)

test('only the first unfinished configured puzzle is available', () => {
  assert.deepEqual(statuses(puzzles), ['available', ...Array(7).fill('locked')])
  const progress = puzzles.map((puzzle, index) => ({ ...puzzle, completed: index < 3 }))
  assert.deepEqual(statuses(progress), ['completed', 'completed', 'completed', 'available', ...Array(4).fill('locked')])
  assert.equal(getPuzzlePath(progress)[4].prerequisite, 'Puzzle 3')
})
test('placeholder content cannot unlock later puzzles or be completed', () => {
  const progress = puzzles.map((puzzle, index) => ({ ...puzzle, completed: index < 4 }))
  assert.deepEqual(statuses(progress), [...Array(4).fill('completed'), 'pending', ...Array(3).fill('locked')])
  assert.equal(puzzles[0].completed, false)
  progress[4].completed = true
  assert.deepEqual(statuses(progress), [...Array(4).fill('completed'), 'pending', ...Array(3).fill('locked')])
})
test('erased or out-of-order completion cannot bypass prerequisites', () => {
  const progress = puzzles.map((puzzle, index) => ({ ...puzzle, completed: index === 3 }))
  assert.deepEqual(statuses(progress), ['available', ...Array(7).fill('locked')])
})