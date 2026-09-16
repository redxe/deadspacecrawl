import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as THREE from 'three'
import seedrandom from 'seedrandom'

const load = (file, modules = {}) => {
  const context = { exports: {}, require: name => modules[name] }
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
const state = load('../src/mansion/robin-state.ts')
const layout = load('../src/mansion/layout.ts', { seedrandom })
const { createRobinNight } = load('../src/mansion/robin-night.ts', { three: THREE, seedrandom, './layout': layout, './robin-state': state })

test('night reveals a bounded sky and homeward trail, supports reduced motion and restores render targets', () => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#c8dce1'); scene.fog = new THREE.Fog('#c8dce1', 38, 140)
  const sun = new THREE.Object3D(); sun.name = 'mansion-sun'; scene.add(sun)
  const cloud = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.ShaderMaterial({ uniforms: { cloudNightFade: { value: 1 } } })); cloud.name = 'music-cloud'; scene.add(cloud)
  const camera = new THREE.PerspectiveCamera(68, 1, .08, 180)
  const previous = { name: 'previous' }; let current = previous; let passes = 0
  const renderer = { getRenderTarget: () => current, setRenderTarget: value => { current = value }, getDrawingBufferSize: size => size.set(390, 844), render: pass => { passes++; assert.equal(current, previous); assert.match(pass.children[0].material.fragmentShader, /inverseProjection/); assert.match(pass.children[0].material.fragmentShader, /distanceHome/) } }
  const night = createRobinNight(scene, renderer, camera)
  const sequence = state.createRobinSequence()
  let draws = 0
  night.render(() => draws++)
  assert.equal(passes, 0)
  sequence.update(194, { x: 0, z: -56 })
  const frame = sequence.update(12, { x: 0, z: -56 })
  night.update(frame, true)
  assert.equal(sun.visible, false)
  assert.equal(cloud.visible, false)
  assert.equal(cloud.material.uniforms.cloudNightFade.value, 0)
  assert.equal(scene.getObjectByName('robin-stars').geometry.attributes.position.count, 1800)
  assert.equal(scene.getObjectByName('robin-homeward-trail').geometry.attributes.position.count, 360)
  night.render(() => { draws++; assert.equal(current.width, 390); assert.ok(current.depthTexture) })
  assert.equal(current, previous); assert.equal(passes, 1); assert.equal(draws, 2)
  assert.throws(() => night.render(() => { throw Error('failed') }), /failed/)
  assert.equal(current, previous)
  night.update(frame, false)
  assert.equal(scene.getObjectByName('robin-stars').material.uniforms.clock.value, 0)
  night.update(sequence.update(3.14, state.returnOrigin), true)
  assert.equal(scene.getObjectByName('robin-return-aura').visible, false)
  night.destroy()
  assert.equal(scene.getObjectByName('robin-night'), undefined)
  cloud.geometry.dispose(); cloud.material.dispose()
})