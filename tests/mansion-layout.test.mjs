import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const context = { exports: {} }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/mansion/layout.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const { floorHeight, walkable, movePosition, spatialMusic, pictureFrames } = context.exports

test('gallery descends smoothly to the ballroom and returns by the same stairs', () => {
  assert.equal(floorHeight(-30), 0)
  assert.equal(floorHeight(-40.5), -1.5)
  assert.equal(floorHeight(-50), -3)
  let position = { x: 0, z: 1 }
  for (let index = 0; index < 600; index++) position = movePosition(position, 0, -.1)
  assert.ok(position.z < -58 && floorHeight(position.z) === -3)
  for (let index = 0; index < 600; index++) position = movePosition(position, 0, .1)
  assert.ok(Math.abs(position.z - 1) < 1e-8)
})

test('walls, closed doors and stair shoulders cannot be crossed', () => {
  assert.equal(walkable({ x: 3, z: -10 }), false)
  assert.equal(walkable({ x: 8, z: -55 }), true)
  assert.equal(walkable({ x: 8, z: -40 }), false)
  const position = movePosition({ x: 8, z: -46 }, 0, 5)
  assert.ok(position.z <= -45.5)
  assert.ok(movePosition({ x: 0, z: 0 }, 50, 0).x < 2.5)
})

test('ballroom music attenuates with distance and pans with the listener heading', () => {
  assert.ok(spatialMusic({ x: 0, z: -55 }, 0).gain > spatialMusic({ x: 0, z: 0 }, 0).gain * 5)
  assert.equal(spatialMusic({ x: 0, z: -56 }, 0).pan, 0)
  assert.ok(spatialMusic({ x: 0, z: 0 }, Math.PI / 2).pan > .99)
  assert.ok(spatialMusic({ x: 0, z: 0 }, -Math.PI / 2).pan < -.99)
  assert.equal(new Set(pictureFrames.map(frame => frame.id)).size, pictureFrames.length)
})