import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const source = ts.transpileModule(readFileSync(new URL('../src/secret-celebration.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
function fixture(reduced = false) {
  const animations = [], listeners = new Set()
  const motion = { matches: reduced, addEventListener: (_, callback) => listeners.add(callback), removeEventListener: (_, callback) => listeners.delete(callback) }
  function element() {
    return {
      style: {}, children: [], attributes: {}, removed: false,
      append(child) { this.children.push(child) },
      remove() { this.removed = true },
      setAttribute(name, value) { this.attributes[name] = value },
      animate(frames, options) {
        let finish
        const finished = new Promise(resolve => { finish = resolve })
        const animation = { frames, options, finished, finish, cancelled: false, cancel() { this.cancelled = true } }
        animations.push(animation)
        return animation
      },
    }
  }
  const shell = { ...element(), clientWidth: 360, clientHeight: 500 }
  const context = { exports: {}, Promise, matchMedia: () => motion, document: { createElement: element } }
  runInNewContext(source, context)
  return { start: () => context.exports.celebrateSecretMessage({ closest: () => shell }), shell, animations, listeners, motion }
}

test('completion uses a bounded decorative burst and idempotent cleanup', () => {
  const scene = fixture(), stop = scene.start()
  const layer = scene.shell.children[0]
  assert.equal(layer.attributes['aria-hidden'], 'true')
  assert.equal(scene.animations.length, 40)
  assert.equal(layer.children.length, 40)
  assert.ok(scene.animations.every(animation => animation.options.duration + animation.options.delay < 4000))
  assert.equal(scene.listeners.size, 1)
  stop(); stop()
  assert.equal(layer.removed, true)
  assert.ok(scene.animations.every(animation => animation.cancelled))
  assert.equal(scene.listeners.size, 0)
})
test('finished particles remove their layer and media listener', async () => {
  const scene = fixture(); scene.start()
  scene.animations.forEach(animation => animation.finish())
  await Promise.all(scene.animations.map(animation => animation.finished))
  await Promise.resolve()
  assert.equal(scene.shell.children[0].removed, true)
  assert.equal(scene.listeners.size, 0)
})
test('reduced motion skips particles and changing the preference stops an active burst', () => {
  const quiet = fixture(true); quiet.start()()
  assert.equal(quiet.shell.children.length, 0)
  assert.equal(quiet.listeners.size, 0)
  const active = fixture(); active.start(); active.motion.matches = true
  for (const callback of active.listeners) callback()
  assert.equal(active.shell.children[0].removed, true)
  assert.ok(active.animations.every(animation => animation.cancelled))
})