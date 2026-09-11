import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const context = { exports: {}, require: () => ({}) }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/glyph-feedback.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText, context)
const { getLetterFeedback } = context.exports
const states = (letters, answer) => Array.from(getLetterFeedback(letters, answer), item => item.state)

test('single-letter feedback preserves filler positions and handles correct, incorrect and deleted text', () => {
  assert.deepEqual(states(['F','E','R','','R','Y'], 'fer'), ['correct','correct','correct','unanswered','unanswered','unanswered'])
  assert.deepEqual(states(['F','E','R','','R','Y'], 'ferry'), ['correct','correct','correct','unanswered','correct','correct'])
  assert.deepEqual(states(['F','E','R','','R','Y'], 'fairy'), ['correct','incorrect','incorrect','unanswered','correct','correct'])
  assert.deepEqual(states(['F','E'], ''), ['unanswered','unanswered'])
  assert.deepEqual(states(['F','E'], 'fee'), ['correct','incorrect'])
})
test('punctuation and case do not shift apostrophes or spaces; cipher punctuation stays explicit', () => {
  assert.ok(states([...'DONT?'], "Don't?").every(state => state === 'correct'))
  assert.deepEqual(states(['A','!'], 'a?'), ['correct','incorrect'])
})