import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const context = { exports: {} }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/mansion/robin-state.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const { createRobinSequence, ballroomWait, returnHold, nightFade, returnOrigin } = context.exports
const ballroom = { x: 0, z: -56 }

test('night requires 194 continuous visible seconds in the ballroom', () => {
  const sequence = createRobinSequence()
  assert.equal(sequence.update(193.99, ballroom).awakened, false)
  assert.equal(sequence.update(100, ballroom, false).awakened, false)
  assert.equal(sequence.update(1, returnOrigin).ballroomTime, 0)
  assert.equal(sequence.update(ballroomWait, ballroom).phase, 'fading')
  assert.equal(sequence.update(nightFade, ballroom).phase, 'return')
})

test('entrance charge resets on leaving, pauses while inactive and unlocks only after 3.14 seconds', () => {
  const sequence = createRobinSequence()
  sequence.update(ballroomWait, ballroom)
  sequence.update(nightFade, ballroom)
  assert.equal(sequence.update(3, returnOrigin).unlocked, false)
  assert.equal(sequence.update(50, returnOrigin, false).unlocked, false)
  assert.equal(sequence.update(.01, { x: .71, z: 1.3 }).charge, 0)
  assert.equal(sequence.update(3, returnOrigin).unlocked, false)
  const charged = sequence.update(returnHold - 3 + .000001, returnOrigin)
  assert.equal(charged.phase, 'pulse')
  assert.equal(charged.pulse, 0)
  assert.equal(sequence.update(5, ballroom).phase, 'complete')
  assert.equal(sequence.update(0, returnOrigin).unlocked, true)
})

test('invalid time and pre-night visits cannot unlock Robin', () => {
  const sequence = createRobinSequence()
  for (const delta of [NaN, Infinity, -10]) assert.equal(sequence.update(delta, ballroom).ballroomTime, 0)
  assert.equal(sequence.update(500, returnOrigin).unlocked, false)
})

test('standing at home during the fade does not count as charging', () => {
  const sequence = createRobinSequence()
  sequence.update(ballroomWait, ballroom)
  assert.equal(sequence.update(nightFade, returnOrigin).charge, 0)
  assert.equal(sequence.update(3, returnOrigin).unlocked, false)
  assert.equal(sequence.update(.141, returnOrigin).unlocked, true)
})