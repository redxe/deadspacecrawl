import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const context = { exports: {}, require: createRequire(import.meta.url) }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/puzzles/glyph-wordle-state.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const { scoreGuess, submitGuess, freshWordle, retryWordle, restoreWordle } = context.exports

test('glyph Wordle scores positions and duplicate letters using the game engine', () => {
  assert.deepEqual(Array.from(scoreGuess('ROBIN')), Array(5).fill('right'))
  assert.deepEqual(Array.from(scoreGuess('ROOOR')), ['right', 'right', 'wrong', 'wrong', 'wrong'])
  assert.deepEqual(Array.from(scoreGuess('BRINK')), ['almost', 'almost', 'almost', 'almost', 'wrong'])
})

test('six unsuccessful guesses allow unlimited retry rounds without revealing the solution', () => {
  let state = freshWordle()
  for (let round = 0; round < 12; round++) {
    for (let guess = 0; guess < 6; guess++) state = submitGuess(state, 'aaaaa')
    assert.throws(() => submitGuess(state, 'ROBIN'), /another round/)
    state = retryWordle(state)
  }
  assert.equal(state.rounds, 13)
  state = submitGuess(state, 'robin')
  assert.equal(state.solved, true)
  assert.equal(retryWordle(state), state)
})

test('reload preserves real wins and incomplete guesses but rejects malformed storage', () => {
  assert.equal(restoreWordle(JSON.stringify(submitGuess(freshWordle(), 'ROBIN'))).solved, true)
  assert.equal(restoreWordle('{"guesses":[],"solved":true}').solved, false)
  assert.equal(restoreWordle('{broken').guesses.length, 0)
  assert.throws(() => submitGuess(freshWordle(), 'BIRD'), /five letters/)
})