import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import engine from 'crypto-classic-playfair'
import ts from 'typescript'

function load(file) {
  const context = { exports: {}, require: () => ({ default: engine }) }
  runInNewContext(ts.transpileModule(readFileSync(new URL(`../src/${file}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports
}
const cipher = load('playfair')
const puzzle = load('puzzles/paired-signal').default
const { answerMatches } = load('puzzles/types')

test('engine matches the published Playfair example including its repeated-letter separator', () => {
  assert.equal(cipher.decryptPlayfair('BMODZBXDNABEKUDMUIXMMOUVIF', 'playfair example'), 'HIDETHEGOLDINTHETREXESTUMP')
  assert.equal(cipher.decryptPlayfair('BM', 'playfair example'), 'HI')
  assert.equal(cipher.decryptPlayfair('OD', 'playfair example'), 'DE')
  assert.equal(cipher.decryptPlayfair('LA', 'playfair example'), 'PL')
})
test('fixed glyph payload encodes the exact requested sentence without losing repeated letters', () => {
  const plaintext = puzzle.answer.accepted[0].replace(/[^a-z]/g, '')
  assert.equal(engine.encipher(plaintext, cipher.playfairKey.toLowerCase()).toUpperCase(), cipher.playfairCiphertext)
  const prepared = cipher.decryptPlayfair(cipher.playfairCiphertext, cipher.playfairKey)
  assert.equal(prepared, 'FERXRYTALESREALXLYDOCOMETRUEDONTTHEY')
  assert.equal(prepared.replace(/X/g, '').toLowerCase(), plaintext)
  assert.equal(puzzle.answer.accepted[0], 'ferry tales really do come true dont they?')
  assert.ok(answerMatches(puzzle, 'Ferry tales really do come true dont they?'))
  assert.equal(answerMatches(puzzle, prepared), false)
})
test('square and worksheet validation enforce complete ordered work', () => {
  const square = cipher.buildPlayfairSquare(cipher.playfairKey)
  assert.equal(square, 'LANTERBCDFGHIKMOPQSUVWXYZ')
  assert.equal(new Set(square).size, 25)
  assert.ok(cipher.playfairSquareMatches([...square]))
  assert.equal(cipher.playfairSquareMatches([...cipher.playfairAlphabet]), false)
  const pairs = cipher.decryptPlayfair(cipher.playfairCiphertext, cipher.playfairKey).match(/../g)
  assert.ok(cipher.playfairPairsMatch(pairs))
  assert.equal(cipher.playfairPairsMatch(pairs.slice(1)), false)
  assert.equal(cipher.playfairPairsMatch(Array(18).fill('AA')), false)
  assert.throws(() => cipher.decryptPlayfair('ABC', 'key'))
  assert.throws(() => cipher.decryptPlayfair('AJ', 'key'))
})

test('teaching payload contains no answer-bearing cipher blocks or console data', () => {
  assert.deepEqual(Array.from(puzzle.blocks, block => block.type), ['playfair'])
  const exposed = JSON.stringify({ hints: puzzle.hints, consoleData: puzzle.consoleData }).toLowerCase()
  assert.equal(exposed.includes('ferry'), false)
  assert.equal(exposed.includes('lantern'), false)
})