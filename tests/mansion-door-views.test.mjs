import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as THREE from 'three'
import * as CameraUtils from 'three/addons/utils/CameraUtils.js'
import seedrandom from 'seedrandom'
import ts from 'typescript'

const shadowContext = { exports: {}, require: () => THREE }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/mansion/player-shadow.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, shadowContext)
const roomContext = { exports: {}, require: name => name === 'three' ? THREE : shadowContext.exports }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/mansion/room-light.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, roomContext)
const context = { exports: {}, require: name => name === 'three' ? THREE : name === 'seedrandom' ? seedrandom : name === './player-shadow' ? shadowContext.exports : name === './room-light' ? roomContext.exports : CameraUtils }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/mansion/door-views.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, context)
const { createDoorView } = context.exports

const fixture = (kind = 'study', rotation = 0, lighting) => {
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(.86, 1.075), new THREE.MeshBasicMaterial())
  const group = new THREE.Group(); group.position.set(2, -3, -4); group.rotation.y = rotation; group.add(surface)
  surface.position.set(0, 2, .083); group.updateMatrixWorld(true)
  const viewer = new THREE.PerspectiveCamera(68, 1.6, .08, 180)
  const move = (horizontal = 0, vertical = -.35, depth = 2) => {
    viewer.position.copy(surface.localToWorld(new THREE.Vector3(horizontal, vertical, depth)))
    viewer.lookAt(surface.getWorldPosition(new THREE.Vector3())); viewer.updateMatrixWorld(true)
  }
  move()
  const view = createDoorView(kind, surface, lighting)
  const previous = { name: 'previous-target' }
  let current = previous
  let calls = 0
  let disposedGeometry = 0
  let disposedMaterial = 0
  let targetDisposed = false
  const geometries = new Set()
  const materials = new Set()
  view.scene.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); materials.add(object.material) } })
  geometries.forEach(geometry => geometry.addEventListener('dispose', () => disposedGeometry++))
  materials.forEach(material => material.addEventListener('dispose', () => disposedMaterial++))
  view.target.addEventListener('dispose', () => { targetDisposed = true })
  return {
    view, viewer, move,
    renderer: {
      getRenderTarget: () => current,
      setRenderTarget: target => { current = target },
      render: () => { calls++ },
    },
    verify(expectedCalls) {
      assert.equal(current, previous)
      assert.equal(calls, expectedCalls)
      view.destroy(); view.destroy()
      assert.equal(view.scene.children.length, 0)
      assert.equal(disposedGeometry, geometries.size)
      assert.equal(disposedMaterial, materials.size)
      assert.equal(targetDisposed, true)
      surface.geometry.dispose(); surface.material.dispose()
    },
  }
}

for (const kind of ['porch', 'study', 'conservatory', 'music-room', 'tea-room']) test(`${kind} is an instanced 3D view with independent lighting and bounded resources`, () => {
  const { view, viewer, renderer, verify } = fixture(kind)
  let meshes = 0
  let triangles = 0
  view.scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    meshes++; triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3 * (object.isInstancedMesh ? object.count : 1)
  })
  assert.ok(meshes > 5 && meshes < 35)
  assert.ok(triangles < 25000)
  const lights = view.scene.children.filter(object => object.isLight)
  assert.ok(lights.every(light => kind === 'porch' ? light.intensity > 2 : light.intensity <= .2))
  if (kind !== 'porch') view.scene.traverse(object => {
    if (object instanceof THREE.Mesh) assert.ok(object.material instanceof THREE.MeshStandardMaterial && !object.material.transparent, 'Window light must land on room surfaces, not translucent light sheets')
  })
  if (kind === 'porch') assert.equal(view.scene.children.filter(object => object.name === 'chair').length, 2)
  assert.equal(view.target.width, 512)
  assert.equal(view.target.height, 640)
  assert.equal(view.update(renderer, viewer), true)
  assert.equal(view.update(renderer, viewer), false, 'An unchanged view must reuse its texture')
  verify(1)
})

test('off-axis projection stays attached to the glass and preserves depth parallax for every door orientation', () => {
  for (const rotation of [0, Math.PI, -Math.PI / 2]) {
    const { view, viewer, renderer, move, verify } = fixture('study', rotation)
    view.update(renderer, viewer)
    const foreground = new THREE.Vector3(0, 2, 0).project(view.camera).x
    const background = new THREE.Vector3(0, 2, -4).project(view.camera).x
    move(.7, -.1, 1.2); view.update(renderer, viewer)
    assert.ok(Math.abs(view.camera.position.x - .7) < .00001)
    assert.ok(Math.abs(view.camera.position.y - 1.9) < .00001)
    for (const [horizontal, vertical, expectedX, expectedY] of [[-.43, 1.4625, -1, -1], [.43, 1.4625, 1, -1], [-.43, 2.5375, -1, 1]]) {
      const projected = new THREE.Vector3(horizontal, vertical, 2.5).project(view.camera)
      assert.ok(Math.abs(projected.x - expectedX) < .00001)
      assert.ok(Math.abs(projected.y - expectedY) < .00001)
    }
    const nearShift = new THREE.Vector3(0, 2, 0).project(view.camera).x - foreground
    const farShift = new THREE.Vector3(0, 2, -4).project(view.camera).x - background
    assert.ok(Math.abs(nearShift - farShift) > .1, 'Furniture and back walls must shift by different amounts')
    verify(2)
  }
})

test('hidden, distant and rear-facing door views do not render', () => {
  const { view, viewer, renderer, move, verify } = fixture()
  move(0, 0, -2); assert.equal(view.update(renderer, viewer), false)
  move(0, 0, 25); assert.equal(view.update(renderer, viewer), false)
  move(); viewer.rotateY(Math.PI); assert.equal(view.update(renderer, viewer), false)
  verify(0)
})

test('a failed view render restores the target and can be retried before cleanup', () => {
  const { view, viewer, renderer, verify } = fixture()
  const failing = { ...renderer, render() { throw new Error('Render failed') } }
  assert.throws(() => view.update(failing, viewer), /Render failed/)
  assert.equal(view.update(renderer, viewer), true)
  verify(1)
})

test('close porch views have continuous ground, clear paths, fuller trees and a roof reaching the building', () => {
  const { view, verify } = fixture('porch')
  view.scene.updateMatrixWorld(true)
  const lawn = view.scene.getObjectByName('porch-ground')
  const bounds = new THREE.Box3().setFromObject(lawn)
  assert.ok(bounds.min.x <= -250 && bounds.max.x >= 250)
  assert.ok(bounds.max.z >= 2.5 && bounds.min.z < -30)
  for (const horizontal of [-20, -5, 5, 20]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(horizontal, 1.65, 1), new THREE.Vector3(0, -1, -.25).normalize())
    assert.equal(ray.intersectObject(lawn).length, 1, 'Ground beside the porch must not expose the background below it')
  }
  assert.ok(view.scene.fog.far < 30)
  const roof = new THREE.Box3().setFromObject(view.scene.getObjectByName('porch-roof'))
  assert.ok(roof.min.z <= -2.5 && roof.max.z >= 2.5)
  for (const side of [-1, 1]) for (const depth of [0, 1.8]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(0, .93, depth), new THREE.Vector3(side, 0, 0))
    const hit = ray.intersectObjects(view.scene.children, true)[0]
    assert.ok(hit && Math.abs(Math.abs(hit.point.x) - 2.5) < .05, 'Porch side rails must continue back toward the building')
  }
  assert.equal(view.scene.children.filter(object => object.name === 'porch-tree').length, 12)
  const crowns = view.scene.children.filter(object => object.geometry?.name === 'porch-tree-canopy')
  assert.equal(crowns.reduce((count, object) => count + object.count, 0), 60)
  const grass = view.scene.getObjectByName('porch-grass')
  assert.equal(grass.count, 2800)
  const matrix = new THREE.Matrix4()
  const point = new THREE.Vector3()
  for (let index = 0; index < grass.count; index++) {
    grass.getMatrixAt(index, matrix); point.setFromMatrixPosition(matrix)
    assert.ok(Math.abs(point.x) > .75)
    assert.ok(Math.abs(point.x) >= 3.6 || point.z <= -4.6)
  }
  verify(0)
})

test('window glass is transparent, leaves depth untouched and reflects the viewing direction', () => {
  const glassContext = { exports: {}, require: name => name === 'three' ? THREE : shadowContext.exports }
  runInNewContext(ts.transpileModule(readFileSync(new URL('../src/mansion/window-glass.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, glassContext)
  const glass = glassContext.exports.createWindowGlass()
  assert.equal(glass.transparent, true)
  assert.equal(glass.depthWrite, false)
  assert.equal(glass.side, THREE.DoubleSide)
  assert.match(glass.fragmentShader, /cameraPosition - glassPosition/)
  assert.match(glass.fragmentShader, /reflect\(-viewDirection, surfaceNormal\)/)
  assert.match(glass.fragmentShader, /fresnel/)
  assert.match(glass.fragmentShader, /visibility \* visibility \* visibility/)
  glass.dispose()
})

test('door views transform real light sources and player shadows and refresh when lighting changes', () => {
  const lighting = shadowContext.exports.createPlayerShadow()
  const feet = new THREE.Vector3(2, -3, -1.917)
  const sun = new THREE.Vector3(-.4, .7, .6).normalize()
  const lamp = new THREE.Vector3(2, .8, 1)
  lighting.update(feet, sun, lamp, .2, .3)
  const { view, viewer, renderer, verify } = fixture('study', 0, lighting)
  assert.equal(view.update(renderer, viewer), true)
  const player = view.shadow.uniforms.shadowPlayerFeet.value
  assert.ok(Math.abs(player.x) < .00001 && Math.abs(player.y) < .00001 && Math.abs(player.z - 4.5) < .00001)
  assert.equal(view.update(renderer, viewer), false)
  lamp.x += .5; lighting.update(feet, sun, lamp, .25, .35)
  assert.equal(view.update(renderer, viewer), true)
  assert.ok(Math.abs(view.shadow.uniforms.shadowLampPosition.value.x - .5) < .00001)
  const receiver = view.scene.children.find(object => object.material instanceof THREE.MeshStandardMaterial)
  const shader = { uniforms: {}, vertexShader: '#include <worldpos_vertex>', fragmentShader: '#include <common>\n#include <opaque_fragment>' }
  receiver.material.onBeforeCompile(shader, {})
  assert.match(shader.fragmentShader, /diffuseColor.rgb \* roomWindowRadiance\(playerShadowWorld/)
  assert.match(shader.fragmentShader, /roomAperture/)
  assert.match(shader.fragmentShader, /dot\(normal, windowOffset/)
  assert.equal(shader.uniforms.shadowPlayerFeet, view.shadow.uniforms.shadowPlayerFeet)
  verify(2)
})