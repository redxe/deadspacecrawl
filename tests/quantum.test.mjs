import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { jsqubits } from 'jsqubits'
import ts from 'typescript'

function load(file) {
  const context = { exports: {}, require: () => ({jsqubits}), crypto: globalThis.crypto, Uint8Array, TextDecoder, atob }
  runInNewContext(ts.transpileModule(readFileSync(new URL(`../src/${file}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports
}
const { emptyCircuit, simulateCircuit, verifyTeleportation, circuitError, isCircuit } = load('quantum')
const aes = load('quantum-message')
const puzzle = load('puzzles/quantum-relay').default
const solution = () => {
  const circuit = emptyCircuit()
  circuit.splice(0, 8, [null,'H',null], [null,'control','X'], ['control','X',null], ['H',null,null], [null,'control','X'], ['control',null,'Z'], ['H',null,null], [null,'H',null])
  return circuit
}
test('coherent teleportation restores |00x> for basis, complex and asymmetric states without measurement', () => {
  assert.ok(verifyTeleportation(solution()).valid)
  for (const [theta, phi] of [[0,0],[180,0],[90,0],[90,90],[90,180],[73,51],[129,287]]) {
    const output = simulateCircuit(solution(), theta, phi)
    const input = simulateCircuit(emptyCircuit(), theta, phi)
    for (const [destination, source] of [[0,0],[1,4]]) {
      assert.ok(Math.abs(output[destination].real-input[source].real)<1e-10)
      assert.ok(Math.abs(output[destination].imaginary-input[source].imaginary)<1e-10)
    }
    assert.ok(output.slice(2).every(value=>value.probability<1e-10))
    assert.ok(Math.abs(output.reduce((sum,value)=>sum+value.probability,0)-1)<1e-10)
  }
})
test('verification rejects identity, dirty senders, phase errors and malformed controls', () => {
  assert.equal(verifyTeleportation(emptyCircuit()).valid,false)
  const dirty=solution(); dirty[6]=[null,null,null]; dirty[7]=[null,null,null]
  assert.equal(verifyTeleportation(dirty).valid,false)
  const phase=solution(); phase[8]=[null,null,'Z']
  assert.equal(verifyTeleportation(phase).valid,false)
  assert.match(verifyTeleportation(phase).detail,/phase/)
  const malformed=emptyCircuit(); malformed[0]=['control',null,null]
  assert.ok(circuitError(malformed))
  assert.equal(verifyTeleportation(malformed).valid,false)
  assert.equal(isCircuit([['measure']]),false)
  assert.equal(isCircuit(Array(12).fill(['H','H',null])),true)
  assert.equal(circuitError(Array(12).fill(['H','H',null])),null)
  assert.ok(circuitError(Array(12).fill(['control','X','Z'])))
})
test('independent cleanup Hadamards can share the final column', () => {
  const parallel=solution()
  parallel[6]=['H','H',null]
  parallel[7]=[null,null,null]
  assert.ok(verifyTeleportation(parallel).valid)
})
test('step preview respects wire order and does not mutate the circuit', () => {
  const circuit=solution(), before=JSON.stringify(circuit)
  const initial=simulateCircuit(circuit,180,0,0)
  assert.ok(initial[4].probability>.999999)
  const bell=simulateCircuit(circuit,0,0,2)
  assert.ok(Math.abs(bell[0].probability-.5)<1e-10 && Math.abs(bell[3].probability-.5)<1e-10)
  assert.equal(JSON.stringify(circuit),before)
})
test('AES fixture decrypts the exact requested message and rejects wrong keys or altered ciphertext', async () => {
  assert.equal(await aes.decryptQuantumMessage(aes.recoveredAesKey),puzzle.answer.accepted[0])
  await assert.rejects(aes.decryptQuantumMessage('00'.repeat(32)),/Authentication failed/)
  await assert.rejects(aes.decryptQuantumMessage(aes.recoveredAesKey,'AAAA'+aes.encryptedMessage.slice(4)),/Authentication failed/)
  await assert.rejects(aes.decryptQuantumMessage('abc'),/64-character/)
  await assert.rejects(aes.decryptQuantumMessage(aes.recoveredAesKey,aes.encryptedMessage,'00'),/IV/)
})