import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const glyphs = { exports: {} }
runInNewContext(compile('../src/glyphs.ts'), glyphs)
const types = { exports: {} }
runInNewContext(compile('../src/puzzles/types.ts'), types)
const context = { exports: {}, require: path => path === './glyphs' ? glyphs.exports : types.exports }
runInNewContext(compile('../src/glyph-feedback.ts'), context)
const feedback = (texts, answer) => JSON.parse(JSON.stringify(context.exports.getGlyphFeedback(texts, answer)))

test('glyph feedback follows decoded letters across combined and doubled glyphs', () => {
  const result = feedback(['THIS DOOR\nIS A MESS'], 'THIZ DOXR')[0]
  assert.deepEqual(result.slice(0, 7).map(glyph => glyph.state), ['correct', 'correct', 'incorrect', 'correct', 'correct', 'incorrect', 'correct'])
  assert.deepEqual(result.slice(0, 7).map(glyph => glyph.entered), ['TH', 'I', 'Z', 'D', 'O', 'X', 'R'])
  assert.ok(result.slice(7).every(glyph => glyph.state === 'unanswered'))
  assert.ok(feedback(['THIS DOOR\nIS A MESS'], 'this door is a mess')[0].every(glyph => glyph.state === 'correct'))
})

test('partial combined glyphs match their entered prefix and recover after deletion', () => {
  assert.deepEqual(feedback(['TH SS'], 't')[0], [{ state: 'correct', entered: 'T' }, { state: 'unanswered', entered: '' }])
  assert.equal(feedback(['TH SS'], 'ta')[0][0].state, 'incorrect')
  assert.equal(feedback(['TH SS'], 'th s')[0][1].state, 'correct')
  assert.equal(feedback(['TH SS'], 'th sa')[0][1].state, 'incorrect')
  assert.ok(feedback(['TH SS'], '')[0].every(glyph => glyph.state === 'unanswered'))
})

test('multiple cipher blocks share one answer position and ignore case and whitespace', () => {
  const result = feedback(['A DOOR', 'AND THERE'], ' a  door\nAND th ')
  assert.equal(result[0].length, 5)
  assert.ok(result[0].every(glyph => glyph.state === 'correct'))
  assert.deepEqual(result[1].map(glyph => glyph.state), ['correct', 'correct', 'correct', 'correct', 'unanswered', 'unanswered', 'unanswered'])
})

test('double-letter aliases, digits, and punctuation keep the renderer mapping', () => {
  assert.ok(feedback(['LE[DBL LTER]T 12?!'], 'leet 12?!')[0].every(glyph => glyph.state === 'correct'))
  assert.deepEqual(feedback(['[DBLLTR] A'], 'A')[0], [{ state: 'unanswered', entered: '' }, { state: 'correct', entered: 'A' }])
})

test('extra decoded characters flag the final glyph and clear when removed', () => {
  const extra = feedback(['A DOOR'], 'A DOORX')[0]
  assert.equal(extra.at(-1).state, 'incorrect')
  assert.equal(extra.at(-1).entered, 'RX')
  assert.ok(feedback(['A DOOR'], 'A DOOR')[0].every(glyph => glyph.state === 'correct'))
  assert.deepEqual(feedback([], 'unrelated numeric answer'), [])
})

test('Transmit lights only for a complete accepted glyph answer, never partial or numeric input', () => {
  const puzzle = { blocks: [{ type: 'cipher', text: 'A DOOR\nTHERE' }], answer: { accepted: ['A DOOR THERE'] } }
  const ready = answer => context.exports.getTransmissionFeedback(puzzle, answer).ready
  assert.equal(ready('a door   there'), true)
  for (const answer of ['', 'A DOOR THER', 'A DOOR THXRE', 'A DOOR THEREX', 'ADOORTHERE']) assert.equal(ready(answer), false)
  const combined = { blocks: [{ type: 'cipher', text: 'TH' }], answer: { accepted: ['TH'] } }
  assert.equal(context.exports.getTransmissionFeedback(combined, 'T').ready, false)
  assert.equal(context.exports.getTransmissionFeedback({ ...puzzle, blocks: [] }, 'A DOOR THERE').ready, false)
  const numeric = { blocks: [{ type: 'cipher', text: '123' }], answer: { accepted: ['123'], mode: 'number' } }
  assert.equal(context.exports.getTransmissionFeedback(numeric, '123').ready, false)
})