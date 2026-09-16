import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import seedrandom from 'seedrandom'

const require = createRequire(import.meta.url)
const load = (file, imports = {}) => {
  const context = { exports: {}, require: name => imports[name] ?? require(name) }
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports
}
const layout = load('../src/mansion/layout.ts')
const { fairyRoute, fairyMessages } = load('../src/mansion/fairy-route.ts', { './layout': layout })

test('fairy messages retain the requested text and order', () => {
  assert.deepEqual(Array.from(fairyMessages), ["Hi! I'm Fairy! It's nice to finally meet you", 'Violet has another present for you! Come with me!'])
})

test('random fairy routes remain inside the hall, stairs and ballroom and end by the side wall', () => {
  const signatures = new Set()
  for (let seed = 0; seed < 20; seed++) {
    const curve = fairyRoute(seedrandom(`flight-${seed}`))
    signatures.add(curve.points[1].x)
    for (let step = 0; step <= 500; step++) {
      const point = curve.getPointAt(step / 500)
      assert.ok(layout.walkable(point), `Route ${seed} crosses a wall: ${JSON.stringify(point)}`)
      assert.ok(point.y > layout.floorHeight(point.z) + .35)
      assert.ok(point.y < 4.1)
    }
    const end = curve.getPointAt(1)
    assert.ok(end.z > -48 && end.x > 8, 'Final point must be in the ballroom side alcove')
  }
  assert.equal(signatures.size, 20)
})

test('lamps and ballroom pillars clear picture edges including their frames', () => {
  for (const frame of layout.pictureFrames) {
    if (frame.id.startsWith('gallery-')) {
      for (const depth of layout.hallLampDepths) assert.ok(Math.abs(frame.z - depth) > (frame.width + .22) / 2 + .34)
    } else if (!frame.id.startsWith('ballroom-north')) {
      for (const depth of layout.ballroomLampDepths) assert.ok(Math.abs(frame.z - depth) > (frame.width + .22) / 2 + .34)
      for (const depth of layout.ballroomPillarDepths) assert.ok(Math.abs(frame.z - depth) > (frame.width + .22) / 2 + .2)
    }
  }
})