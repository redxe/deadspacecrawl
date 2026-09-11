import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const context = {}
runInNewContext(readFileSync(new URL('../src/prime-engine.js', import.meta.url), 'utf8'), context)
const lookup = context.lookupPrime

test('exact prime indices through ten billion', () => {
  for (const [index, expected] of [
    [1, 2], [2, 3], [17, 59], [10000, 104729], [100000, 1299709],
    [1000000, 15485863], [10000000, 179424673], [100000000, 2038074743],
    [1000000000, 22801763489], [10000000000, 252097800623],
  ]) {
    const result = lookup(index)
    assert.equal(result.value, expected, `p_${index}`)
    assert.equal(result.index, index)
    assert.ok(Object.isFrozen(result))
    if (index === 1) assert.equal(result.previous, null)
    else assert.ok(result.previous < result.value)
    assert.ok(result.next > result.value)
  }
})

test('reject invalid single indices', () => {
  for (const index of [0, -1, 1.5, '2', NaN, Infinity, 10000000001]) {
    assert.throws(() => lookup(index), /1 to 10,000,000,000/)
  }
})

test('neighbors and exact adjacent large indices', () => {
  const result = lookup(10000000000)
  assert.equal(lookup(9999999999).value, result.previous)
  assert.equal(lookup(100000).next, lookup(100001).value)
  assert.equal(lookup(100000).previous, lookup(99999).value)
  assert.equal(lookup(1).next, 3)
  assert.equal(lookup(2).previous, 2)
})

test('matches an independent sieve across the counting transition', () => {
  const limit = 2000000
  const composite = new Uint8Array(limit + 1)
  const reference = []
  for (let candidate = 2; candidate <= limit; candidate += 1) {
    if (composite[candidate]) continue
    reference.push(candidate)
    for (let multiple = candidate * candidate; multiple <= limit; multiple += candidate) {
      composite[multiple] = 1
    }
  }
  for (const index of [78498, 78499, 78500, 80001, 99991, 100003, 125000, 148000]) {
    const result = lookup(index)
    assert.equal(result.value, reference[index - 1])
    assert.equal(result.previous, reference[index - 2])
    assert.equal(result.next, reference[index])
  }
})