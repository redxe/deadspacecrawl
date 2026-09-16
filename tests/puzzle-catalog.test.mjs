import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const context = { exports: {}, structuredClone }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/puzzles/catalog.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const { parseCatalog, resolveCatalog, compactCatalog, emptyCatalog, validatePuzzle } = context.exports
const puzzle = (id = 'test-puzzle') => ({ id, sequence: '01', kind: 'logic', title: 'Test', summary: 'Summary', objective: 'Find it', blocks: [{ type: 'text', text: 'Clue' }], answer: { accepted: ['42'], label: 'Answer', placeholder: '', mode: 'number' }, hints: [] })

test('empty catalog preserves built-in puzzles without mutating them', () => {
  const original = [puzzle()]
  const resolved = resolveCatalog(original, parseCatalog(emptyCatalog()))
  assert.deepEqual(Array.from(resolved), original)
  resolved[0].title = 'Changed'
  assert.equal(original[0].title, 'Test')
})

test('catalog edits, additions, ordering and hidden state control the archive', () => {
  const edited = { ...puzzle(), title: 'Edited' }
  const catalog = parseCatalog({ version: 1, puzzles: [edited, puzzle('new-puzzle')], order: ['new-puzzle', 'test-puzzle'], hidden: ['test-puzzle'] })
  assert.deepEqual(Array.from(resolveCatalog([puzzle()], catalog), item => item.id), ['new-puzzle'])
  assert.equal(resolveCatalog([puzzle()], catalog, true)[1].title, 'Edited')
})

test('invalid catalogs and reserved IDs fail before publishing', () => {
  assert.throws(() => parseCatalog({ ...emptyCatalog(), version: 2 }), /version 1/)
  assert.throws(() => parseCatalog({ ...emptyCatalog(), puzzles: [puzzle(), puzzle()] }), /Duplicate/)
  assert.throws(() => validatePuzzle(puzzle('entry-math')), /reserved/)
  assert.throws(() => validatePuzzle({ ...puzzle(), answer: { accepted: [] } }), /accepted answer/)
  assert.throws(() => validatePuzzle({ ...puzzle(), blocks: [{ type: 'script', code: 'alert(1)' }] }), /Unknown/)
  assert.throws(() => validatePuzzle({ ...puzzle(), blocks: [{ type: 'playfair' }, { type: 'quantum' }] }), /one built-in/)
  assert.throws(() => validatePuzzle({ ...puzzle(), kind: ['logic'] }), /invalid puzzle kind/)
  assert.throws(() => validatePuzzle({ ...puzzle(), blocks: [{ type: ['fourier'] }] }), /Block type/)
})

test('custom blocks accept data but never executable configuration', () => {
  validatePuzzle({ ...puzzle(), blocks: [{ type: 'custom', plugin: 'number-lock', config: { target: 42, enabled: true } }] })
  assert.throws(() => validatePuzzle({ ...puzzle(), blocks: [{ type: 'custom', plugin: 'number-lock', config: { run: () => {} } }] }), /settings/)
})

test('incomplete drafts can be saved but cannot be published', () => {
  const catalog = { ...emptyCatalog(), puzzles: [{ ...puzzle(), title: '', blocks: [], answer: { accepted: [], label: '', placeholder: '' } }] }
  assert.equal(parseCatalog(catalog, true).puzzles[0].title, '')
  assert.throws(() => parseCatalog(catalog), /nonempty/)
  const draft = puzzle()
  draft.answer.accepted = ['']
  draft.hints = ['']
  validatePuzzle(draft, true)
  assert.throws(() => validatePuzzle(draft), /nonempty/)
})

test('multiline accepted answers remain intact through catalog round trips', () => {
  const multiline = puzzle()
  multiline.answer.accepted = ['FIRST LINE\nSECOND LINE', 'ALTERNATE']
  const catalog = parseCatalog(JSON.parse(JSON.stringify({ ...emptyCatalog(), puzzles: [multiline] })))
  assert.deepEqual(catalog.puzzles[0].answer.accepted, multiline.answer.accepted)
})

test('publishing keeps only edited overrides so unchanged source puzzles remain programmable', () => {
  const builtin = puzzle()
  const catalog = { ...emptyCatalog(), puzzles: [structuredClone(builtin), puzzle('new-puzzle')], order: ['new-puzzle', builtin.id] }
  const compact = compactCatalog([builtin], catalog)
  assert.equal(compact.puzzles.length, 1)
  assert.equal(compact.puzzles[0].id, 'new-puzzle')
  assert.equal(resolveCatalog([{ ...builtin, title: 'Later code edit' }], compact)[1].title, 'Later code edit')
})