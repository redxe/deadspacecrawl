import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as arithmetic from 'bigint-crypto-utils'
import ts from 'typescript'

const context = { exports: {}, require: () => arithmetic, TextDecoder, Uint8Array }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/fourier-rsa.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const rsa = context.exports

test('largest factor of packed VIOLET recovers a valid RSA key and the exact message', async () => {
  const factors = Array.from(rsa.factorPackedInteger(22686511379n))
  assert.deepEqual(factors, [7n,3240930197n])
  const prime = factors.at(-1)
  const key = rsa.deriveRsaKey(prime)
  assert.ok(await arithmetic.isProbablyPrime(prime))
  assert.ok(await arithmetic.isProbablyPrime(key.otherPrime))
  assert.equal(prime * key.otherPrime, rsa.rsaModulus)
  assert.equal(rsa.rsaExponent * key.privateExponent % key.totient, 1n)
  assert.equal(rsa.decryptRsa(key.privateExponent), 'you never cease to impress me robert! you melt my heart and i have known for a while that i had to be yours')
})
test('RSA tools reject invalid values and wrong factors or exponents', () => {
  for (const invalid of ['-1','1.2','1e3','99999999999999999','']) assert.throws(() => rsa.parseInteger(invalid))
  assert.throws(() => rsa.factorPackedInteger(1n))
  assert.throws(() => rsa.factorPackedInteger(1n << 36n))
  assert.deepEqual(Array.from(rsa.factorPackedInteger(36n)), [2n,2n,3n,3n])
  assert.throws(() => rsa.deriveRsaKey(7n), /largest/)
  assert.throws(() => rsa.decryptRsa(1n), /exponent/)
  assert.throws(() => rsa.decryptRsa(rsa.deriveRsaKey(3240930197n).privateExponent, [String(rsa.rsaModulus)]), /smaller/)
})