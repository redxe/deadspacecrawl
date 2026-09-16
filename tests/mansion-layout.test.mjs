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

test('the raised fountain excludes its basin and flames without blocking the route around it', () => {
  const { fountainClearance } = context.exports
  assert.equal(walkable({ x: 0, z: -56 }), true, 'The dormant circle remains walkable')
  assert.equal(walkable({ x: 0, z: -56 }, true), false)
  for (let index = 0; index < 16; index++) {
    const angle = index / 16 * Math.PI * 2
    const start = { x: Math.cos(angle) * 5, z: -56 + Math.sin(angle) * 5 }
    const end = movePosition(start, -Math.cos(angle) * 20, -Math.sin(angle) * 20, true)
    assert.ok(Math.hypot(end.x, end.z + 56) >= fountainClearance)
    assert.ok(walkable(end, true))
  }
  const rescued = movePosition({ x: 0, z: -56 }, 0, 0, true)
  assert.ok(walkable(rescued, true))
  let position = { x: 5, z: -48 }
  for (let index = 0; index < 120; index++) position = movePosition(position, 0, -.1, true)
  assert.ok(position.z < -59)
})

test('varied picture surrounds clear doors, sconces, pillars, rails and neighboring frames', () => {
  const { hallLampDepths, ballroomLampDepths, ballroomPillarDepths } = context.exports
  for (const frame of pictureFrames) {
    const horizontal = frame.width / 2 + .11
    const vertical = frame.height / 2 + .11
    const hall = frame.id.startsWith('gallery-')
    assert.ok(frame.y - vertical > (hall ? 1.105 : -1.535) + .1, `${frame.id} above chair rail`)
    assert.ok(frame.y + vertical < 3.97, `${frame.id} below cornice and wallpaper`)
    if (hall) {
      for (const door of [-9, -28]) assert.ok(Math.abs(frame.z - door) > horizontal + .8 + .15, `${frame.id} clears door ${door}`)
      for (const lamp of hallLampDepths) assert.ok(Math.abs(frame.z - lamp) > horizontal + .33 + .15, `${frame.id} clears lamp ${lamp}`)
    } else if (frame.rotation !== 0) {
      for (const pillar of ballroomPillarDepths) assert.ok(Math.abs(frame.z - pillar) > horizontal + .31 + .15, `${frame.id} clears pillar ${pillar}`)
      for (const lamp of ballroomLampDepths) assert.ok(Math.abs(frame.z - lamp) > horizontal + .33 + .15, `${frame.id} clears lamp ${lamp}`)
    } else assert.ok(Math.abs(frame.x) + horizontal < 9.4, `${frame.id} clears corner columns`)
    for (const other of pictureFrames.filter(other => other.id !== frame.id && other.rotation === frame.rotation && (frame.rotation === 0 || other.x === frame.x))) {
      const distance = frame.rotation === 0 ? Math.abs(frame.x - other.x) : Math.abs(frame.z - other.z)
      assert.ok(distance > horizontal + other.width / 2 + .11 + .15, `${frame.id} clears ${other.id}`)
    }
  }
  assert.equal(new Set(pictureFrames.map(frame => frame.finish)).size, 3)
  assert.ok(pictureFrames.some(frame => frame.width > frame.height * 3))
  assert.ok(pictureFrames.some(frame => frame.height > frame.width * 1.7))
})