import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as THREE from 'three'

const load = (file, modules = {}) => {
  const context = { exports: {}, require: name => modules[name] }
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
const layout = load('../src/mansion/layout.ts')
const state = load('../src/mansion/robin-state.ts')

test('wallpaper waves amplify quiet music without amplifying silence or exceeding the strip', () => {
  const { waveformResponse } = load('../src/mansion/music-response.ts')
  const quiet = waveformResponse([-1/128, 1/128])
  assert.equal(quiet.length, 64)
  assert.equal(quiet[0], -.3125)
  assert.equal(quiet[1], .3125)
  assert.ok(quiet.slice(2).every(value => value === 0))
  assert.ok(waveformResponse([]).every(value => value === 0))
  assert.ok(waveformResponse([0, NaN, Infinity]).every(value => value === 0))
  const loud = waveformResponse([-2, .5, 2])
  assert.equal(loud[0], -1)
  assert.equal(loud[1], .5)
  assert.equal(loud[2], 1)
})

test('fountain rises inside the collision boundary, shows progress and settles for reduced motion', () => {
  const scene = new THREE.Scene()
  let updates = 0; let destroyed = false
  const { createRobinFountain } = load('../src/mansion/robin-fountain.ts', {
    three: THREE, './layout': layout, './robin-state': state,
    './fountain-water': { createFountainWater: () => ({ mesh: new THREE.Group(), update() { updates++ }, destroy() { destroyed = true } }) },
  })
  const show = createRobinFountain(scene, {})
  show.setGlyph(new THREE.Texture())
  show.update(.016, 97, false, false, 0, false, true, [])
  const countdown = scene.getObjectByName('robin-ballroom-countdown')
  const fountain = scene.getObjectByName('robin-fountain')
  assert.equal(countdown.userData.progress, .5)
  assert.equal(fountain.visible, false)
  show.update(.05, 194, true, false, 0, false, true, [])
  assert.equal(scene.getObjectByName('robin-ready-glyph').visible, true)
  assert.ok(scene.getObjectByName('robin-ready-glyph').material.uniforms.reveal.value > 0)
  show.update(.05, 194, true, true, 4, false, true, [.6,.4,.2])
  assert.equal(scene.getObjectByName('robin-ready-glyph').visible, false)
  assert.equal(countdown.visible, false)
  assert.equal(fountain.scale.y, 1)
  assert.equal(scene.getObjectByName('robin-fountain-jets').geometry.attributes.position.count, 2400)
  assert.equal(scene.getObjectByName('robin-spectrum-splashes').geometry.attributes.position.count, 960)
  assert.equal(scene.getObjectByName('robin-violet-flames').count, 24)
  const flames = scene.getObjectByName('robin-violet-flames')
  const matrix = new THREE.Matrix4(); const position = new THREE.Vector3()
  for (let index = 0; index < flames.count; index++) {
    flames.getMatrixAt(index, matrix); position.setFromMatrixPosition(matrix)
    assert.ok(Math.hypot(position.x,position.z)+.275 < layout.fountainClearance)
  }
  show.update(.05, 194, true, true, 56, true, false, [1,1,1])
  assert.equal(flames.material.uniforms.clock.value, 2)
  assert.equal(flames.material.uniforms.strength.value, .45)
  assert.equal(updates, 2)
  show.update(.05, 0, false, false, 0, false, true, [])
  assert.equal(fountain.visible, false)
  assert.equal(countdown.visible, true)
  assert.equal(countdown.userData.progress, 0)
  show.destroy()
  assert.equal(destroyed, true)
  assert.equal(scene.getObjectByName('robin-performance'), undefined)
})

test('fountain beat response deduplicates cues, fades softly and clears on replay or reduced motion', () => {
  const { createFountainResponse } = load('../src/mansion/fountain-response.ts')
  const response = createFountainResponse()
  const beat = { cycle: 12, strength: 1 }
  assert.equal(response.update(12, true, true, beat).impact, 1)
  const held = response.update(12.05, true, true, beat)
  assert.equal(held.pulses.length, 1)
  assert.ok(held.impact < 1 && held.impact > 0)
  assert.equal(response.update(12.1, true, false, beat).pulses.length, 0)
  response.update(13, true, true, { cycle: 13, strength: .6 })
  assert.equal(response.update(0, true, true).pulses.length, 0)
  response.update(1, true, true, { cycle: 1, strength: 1 })
  assert.equal(response.update(3, true, true).pulses.length, 0)
  assert.equal(response.update(3, false, true, { cycle: 3, strength: 1 }).impact, 0)
})

test('water computes bounded fixed steps and releases its GPU targets', () => {
  let backend
  class Compute {
    steps = 0
    texture = new THREE.DataTexture(new Float32Array(64*64*4),64,64,THREE.RGBAFormat,THREE.FloatType)
    constructor(width,height) { assert.equal(width,64); assert.equal(height,64); backend = this }
    setDataType(type) { assert.equal(type,THREE.HalfFloatType) }
    createTexture() { return this.texture }
    addVariable(name, shader) { assert.match(shader,/laplacian/); assert.match(shader,/120\.0/); this.variable = { material: { uniforms:{} } }; return this.variable }
    setVariableDependencies(variable, dependencies) { assert.equal(variable,dependencies[0]) }
    init() { return null }
    compute() { this.steps++ }
    getCurrentRenderTarget() { return { texture:this.texture } }
    dispose() { this.disposed = true; this.texture.dispose() }
  }
  const { createFountainWater } = load('../src/mansion/fountain-water.ts', { three:THREE, 'three/addons/misc/GPUComputationRenderer.js': { GPUComputationRenderer:Compute } })
  const water = createFountainWater({})
  water.update(10,.5,true)
  assert.ok(backend.steps >= 5 && backend.steps <= 6, 'A delayed frame cannot cause an unbounded simulation catch-up')
  assert.equal(backend.variable.material.uniforms.force.value,.5)
  assert.equal(water.mesh.userData.fluidBackend,'gpu-shallow-water')
  const steps = backend.steps
  water.update(.05,1,false)
  assert.equal(backend.steps,steps)
  water.destroy()
  assert.equal(backend.disposed,true)
})