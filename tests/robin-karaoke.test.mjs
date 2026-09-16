import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

test('glyph karaoke follows word progress, reuses its line and hides outside singing', () => {
  class Element {
    children = []
    attributes = new Map()
    properties = new Map()
    classList = { toggle() {} }
    style = { setProperty: (name, value) => this.properties.set(name, value) }
    append(...children) { this.children.push(...children) }
    replaceChildren(...children) { this.children = children }
    setAttribute(name, value) { this.attributes.set(name, value) }
    remove() { this.removed = true }
  }
  const rendered = []
  const context = { exports: {}, document: { createElement: () => new Element() }, require: () => ({ renderGlyphText: (_target, text) => rendered.push(text) }) }
  runInNewContext(ts.transpileModule(readFileSync(new URL('../src/mansion/robin-karaoke.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  const parent = new Element()
  const karaoke = context.exports.createRobinKaraoke(parent)
  const root = parent.children[0]
  karaoke.update({ text: 'robin you', word: 0, progress: .25 })
  assert.equal(root.hidden, true)
  karaoke.setAtlas(new Map())
  assert.equal(root.hidden, false)
  assert.equal(root.attributes.get('aria-label'), 'robin you')
  assert.deepEqual(rendered, ['robin', 'robin', 'you', 'you'])
  assert.equal(root.children[0].properties.get('--lyric-fill'), '75%')
  karaoke.update({ text: 'robin you', word: 1, progress: .5 })
  assert.equal(rendered.length, 4)
  assert.equal(root.children[0].properties.get('--lyric-fill'), '0%')
  assert.equal(root.children[1].properties.get('--lyric-fill'), '50%')
  assert.equal(root.children[1].attributes.get('aria-current'), 'true')
  karaoke.update(null)
  assert.equal(root.hidden, true)
  karaoke.destroy()
  assert.equal(root.removed, true)
})