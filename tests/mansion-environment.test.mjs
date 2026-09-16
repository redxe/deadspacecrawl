import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as THREE from 'three'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const context2d = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}), set: (target, key, value) => { target[key] = value; return true } })
const document = { createElement: () => ({ width: 0, height: 0, getContext: () => context2d }) }
const load = (file, imports = {}) => {
  const context = { exports: {}, document, require: name => name === 'three' ? THREE : imports[name] ?? require(name) }
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
const layout = load('../src/mansion/layout.ts')
const response = load('../src/mansion/music-response.ts')
const clouds = load('../src/mansion/clouds.ts', { './layout': layout })
const { createEnvironment } = load('../src/mansion/environment.ts', { './layout': layout, './music-response': response, './clouds': clouds })
const setup = () => {
  const scene = new THREE.Scene()
  const sunlight = new THREE.DirectionalLight('#fff0d5', 2)
  const leaves = new THREE.MeshStandardMaterial()
  const environment = createEnvironment(scene, leaves, sunlight)
  return { scene, sunlight, environment }
}

test('instanced grass grows on both verges without growing through the road', () => {
  const { scene, environment } = setup()
  const grass = scene.children.find(object => object instanceof THREE.InstancedMesh)
  assert.equal(grass.count, 8400)
  const matrix = new THREE.Matrix4()
  const point = new THREE.Vector3()
  const counts = [0, 0]
  for (let index = 0; index < grass.count; index++) {
    grass.getMatrixAt(index, matrix); point.setFromMatrixPosition(matrix)
    const road = -18 + Math.sin(point.z / 21) * 2
    assert.ok(Math.abs(point.x - road) > 2.8)
    counts[point.x > road ? 0 : 1]++
  }
  assert.deepEqual(counts, [4200, 4200])
  environment.destroy()
})

test('wallpaper deforms and wall/exterior lighting responds to audio then settles for reduced motion', () => {
  const { scene, environment, sunlight } = setup()
  const borders = scene.children.filter(object => object instanceof THREE.Mesh && object.material.emissiveMap)
  assert.ok(borders.length > 20)
  for (const border of borders) {
    const coordinates = border.geometry.getAttribute('uv')
    const maximum = Math.max(...Array.from({ length: coordinates.count }, (_, index) => coordinates.getX(index)))
    const minimum = Math.min(...Array.from({ length: coordinates.count }, (_, index) => coordinates.getX(index)))
    assert.ok(Math.abs((maximum - minimum) / border.geometry.parameters.width - 1 / 4.875) < .00001, 'Wallpaper motifs must retain their physical size across differently sized strips')
  }
  assert.equal(new Set(borders.map(border => border.material)).size, 2, 'Each continuous wallpaper style uses one material without lighting seams')
  assert.equal(borders.filter(border => border.position.z > 2.9 && Math.abs(border.rotation.y - Math.PI) < .01).length, 3, 'The entrance wall has an upper strip and two lower strips beside its closed door')
  for (const [horizontal, thickness] of [[3.1, .25], [-3.08, .24]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(thickness, 4.7, 40), new THREE.MeshBasicMaterial())
    wall.position.set(horizontal, 2.35, -16); scene.add(wall); scene.updateMatrixWorld(true)
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 4.22, -2), new THREE.Vector3(Math.sign(horizontal), 0, 0))
    assert.ok(ray.intersectObjects([...borders, wall])[0].object.material.emissiveMap, 'Floral wallpaper must be visible in front of both hall walls')
    wall.removeFromParent(); wall.geometry.dispose(); wall.material.dispose()
  }
  for (const border of borders.filter(border => border.position.z > -46 && border.position.z < -45 && border.position.y < 0)) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3, 1.35, .12), new THREE.MeshBasicMaterial())
    panel.position.set(border.position.x, -2.32, -45.3); scene.add(panel); scene.updateMatrixWorld(true)
    const ray = new THREE.Raycaster(new THREE.Vector3(border.position.x, -2.55, -48), new THREE.Vector3(0, 0, 1))
    assert.equal(ray.intersectObjects([border, panel])[0].object, border, 'Ballroom wallpaper must sit in front of its paneling')
    panel.removeFromParent(); panel.geometry.dispose(); panel.material.dispose()
  }
  const shaders = new Set(borders.map(border => border.material))
  const compiled = [...shaders].map(material => {
    const shader = { uniforms: {}, fragmentShader: '#include <map_fragment>\n#include <emissivemap_fragment>' }
    material.onBeforeCompile(shader)
    assert.match(shader.fragmentShader, /patternUV\.x \+=/)
    assert.match(shader.fragmentShader, /patternUV\.y \+=/)
    assert.match(shader.fragmentShader, /edgeMask/)
    return shader
  })
  environment.animate(1, true, [])
  const baseline = sunlight.intensity
  const lamps = scene.children.filter(object => object instanceof THREE.PointLight && object.distance === 5)
  assert.equal(lamps.length, 8)
  const tint = lamps[0].color.getHex()
  for (let frame = 1; frame <= 100; frame++) environment.animate(1 + frame / 30, true, Array(48).fill(.7))
  assert.ok(sunlight.intensity > baseline + .5)
  assert.notEqual(lamps[0].color.getHex(), tint)
  assert.ok(lamps.every(light => light.intensity > 10))
  assert.ok(compiled.every(shader => shader.uniforms.wallpaperTime.value > 1 && shader.uniforms.wallpaperBass.value > .8))
  const cloudMeshes = scene.children.filter(object => object.name === 'music-cloud')
  assert.equal(cloudMeshes.length, 12)
  const initialDepth = cloudMeshes[0].position.z
  assert.ok(cloudMeshes[0].material.uniforms.cloudResponse.value > .8)
  environment.animate(4.5, true, Array(48).fill(.7))
  assert.notEqual(cloudMeshes[0].position.z, initialDepth)
  for (let frame = 101; frame <= 220; frame++) environment.animate(1 + frame / 30, false, Array(48).fill(1))
  assert.ok(environment.levels.every(level => level < .001))
  const frozenDepth = cloudMeshes[0].position.z
  environment.animate(12, false, Array(48).fill(1))
  assert.equal(cloudMeshes[0].position.z, frozenDepth)
  environment.destroy()
})