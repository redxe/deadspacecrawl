import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

function load(path, dependencies = {}) {
  const context = { exports: {}, require: name => dependencies[name] }
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
  return context.exports
}
const glyphs = load('../src/glyphs.ts')
const { secretGlyphWords } = load('../src/secret-glyph-input.ts', { './glyphs': glyphs })

test('inline decoding preserves combined glyphs, repeated letters, words and lines', () => {
  const lines = secretGlyphWords('the ferry says ss!\nlook 123?')
  assert.equal(lines.length, 2)
  assert.equal(lines[0].length, 4)
  assert.equal(lines[0][0][0].token, 'th')
  assert.equal(lines[0][0][0].expected, 'TH')
  assert.equal(lines[0][1][3].token, 'dbl-letter')
  assert.equal(lines[0][1][3].expected, 'R')
  assert.equal(lines[0][3][0].expected, 'SS')
  assert.equal(lines[1].flat().map(glyph => glyph.expected).join(''), 'LOOK123?')
})