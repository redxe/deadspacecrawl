import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const context = { exports: {}, crypto: globalThis.crypto, TextEncoder, TextDecoder, Uint8Array, atob, btoa }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/secret-database.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const database = context.exports
const message = { id: 'fixture-1', title: '<b>Private title</b>', text: 'HELLO ROBERT!\n123?', updatedAt: '2026-09-11T00:00:00.000Z' }

test('encrypted messages round-trip without plaintext and use a fresh nonce each save', async () => {
  const first = await database.encryptSecretMessages([message])
  const second = await database.encryptSecretMessages([message])
  assert.notEqual(first.iv, second.iv)
  assert.equal(JSON.stringify(first).includes(message.text), false)
  assert.equal(JSON.stringify(await database.decryptSecretMessages(first)), JSON.stringify([message]))
  assert.equal((await database.decryptSecretMessages(await database.encryptSecretMessages([]))).length, 0)
})
test('altered ciphertext, invalid envelopes and invalid message content are rejected', async () => {
  const envelope = await database.encryptSecretMessages([message])
  const changed = { ...envelope, ciphertext: (envelope.ciphertext[0] === 'A' ? 'B' : 'A') + envelope.ciphertext.slice(1) }
  await assert.rejects(database.decryptSecretMessages(changed), /authentication/)
  await assert.rejects(database.decryptSecretMessages({ ...envelope, version: 2 }))
  await assert.rejects(database.decryptSecretMessages({ ...envelope, iv: 'bad' }))
  await assert.rejects(database.encryptSecretMessages([{ ...message, text: "don't" }]), /only A-Z/)
  await assert.rejects(database.encryptSecretMessages([message, message]), /unique/)
  await assert.rejects(database.encryptSecretMessages([{ ...message, text: 'x'.repeat(4001) }]))
})