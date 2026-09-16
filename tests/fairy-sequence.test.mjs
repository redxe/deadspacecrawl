import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as THREE from 'three'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const context2d = new Proxy({}, { get: (_, key) => key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: () => true })
class Element {
  children = []
  events = {}
  dataset = {}
  style = {}
  classes = new Set()
  classList = { add: (...names) => names.forEach(name => this.classes.add(name)), remove: (...names) => names.forEach(name => this.classes.delete(name)) }
  append(...elements) { this.children.push(...elements) }
  setAttribute() {}
  getContext() { return context2d }
  addEventListener(name, action) { this.events[name] = action }
  focus() {}
  remove() {}
}
const load = (file, imports = {}, globals = {}) => {
  const context = { exports: {}, require: name => name === 'three' ? THREE : imports[name] ?? require(name), ...globals }
  const source = readFileSync(new URL(file, import.meta.url), 'utf8').replaceAll('import.meta.env.BASE_URL', "''")
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, context)
  return context.exports
}
const layout = load('../src/mansion/layout.ts')
const route = load('../src/mansion/fairy-route.ts', { './layout': layout })

for (const reducedMotion of [false, true]) test(`fairy releases controls and never changes the player camera (reduced motion: ${reducedMotion})`, () => {
  const { createFairySequence } = load('../src/mansion/fairy.ts', {
    './fairy-route': route, './fairy.css': {}, lucide: { ArrowRight: {}, createElement: () => new Element() },
    '../glyphs': { loadGlyphAtlas: () => new Promise(() => {}) },
  }, { document: { createElement: () => new Element() }, crypto: { randomUUID: () => 'sequence-test' }, matchMedia: () => ({ matches: reducedMotion }) })
  const root = new Element()
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(0, 1.65, 1.3)
  let complete = 0
  const sequence = createFairySequence(root, new THREE.Scene(), camera, reducedMotion, () => complete++)
  assert.equal(sequence.blocking, true)
  sequence.update(1.3)
  const next = root.children[0].children[1]
  next.events.click(); next.events.click(); sequence.update(.8)
  assert.equal(sequence.blocking, false)
  assert.equal(sequence.active, true)
  assert.equal(root.classes.has('mansion-world--guided'), false)
  assert.deepEqual(camera.position.toArray(), [0, 1.65, 1.3])
  camera.position.set(1, 1.65, -5)
  camera.rotation.set(.15, .7, 0)
  const orientation = camera.quaternion.toArray()
  for (let frame = 0; frame < 1800 && sequence.active; frame++) {
    sequence.update(1 / 30)
    assert.deepEqual(camera.position.toArray(), [1, 1.65, -5])
    assert.deepEqual(camera.quaternion.toArray(), orientation)
  }
  assert.equal(sequence.active, false)
  assert.equal(complete, 1)
  sequence.destroy()
})