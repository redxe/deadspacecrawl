import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as THREE from 'three'
import ts from 'typescript'

const context = { exports: {}, require: () => THREE }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/mansion/player-shadow.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const { createPlayerShadow } = context.exports

test('shadow state follows the player without constructing a visible body and caches unchanged sources', () => {
  const shadow = createPlayerShadow()
  const feet = new THREE.Vector3(1, -3, -52)
  const sun = new THREE.Vector3(-1, 1, 0).normalize()
  const lamp = new THREE.Vector3(2, 3, -50)
  shadow.update(feet, sun, lamp, .2, .35)
  const revision = shadow.revision
  assert.deepEqual(shadow.uniforms.shadowPlayerFeet.value.toArray(), feet.toArray())
  shadow.update(feet, sun, lamp, .2, .35)
  assert.equal(shadow.revision, revision)
  feet.x += .5; shadow.update(feet, sun, lamp, .2, .35)
  assert.ok(shadow.revision > revision)
  assert.equal(shadow.uniforms.shadowPlayerFeet.value.x, 1.5)
  assert.ok(!Object.values(shadow).some(value => value instanceof THREE.Object3D))
  shadow.update(feet, sun, lamp, 5, -2)
  assert.equal(shadow.uniforms.shadowSunStrength.value, .6)
  assert.equal(shadow.uniforms.shadowLampStrength.value, 0)
})

test('shadow receivers preserve existing shaders and support instanced walls and basic light patches', () => {
  const shadow = createPlayerShadow()
  for (const material of [new THREE.MeshStandardMaterial(), new THREE.MeshBasicMaterial()]) {
    let originalCalled = 0
    material.onBeforeCompile = () => originalCalled++
    material.customProgramCacheKey = () => 'existing-effect'
    shadow.attach(material); shadow.attach(material)
    const shader = { uniforms: {}, vertexShader: '#include <worldpos_vertex>', fragmentShader: '#include <opaque_fragment>' }
    material.onBeforeCompile(shader, {})
    assert.equal(originalCalled, 1)
    assert.match(shader.vertexShader, /instanceMatrix \* playerShadowPosition/)
    assert.match(shader.fragmentShader, /outgoingLight \*= playerShadowVisibility/)
    assert.equal(shader.uniforms.shadowPlayerFeet, shadow.uniforms.shadowPlayerFeet)
    assert.match(material.customProgramCacheKey(), /existing-effect\|player-shadow/)
    material.dispose()
  }
})