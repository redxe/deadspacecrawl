import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function compile(name) {
  const source = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
}

function createRuntime() {
  const helpModule = { exports: {} }
  runInNewContext(compile('console-help.ts'), helpModule)
  const relayModule = { exports: {} }
  runInNewContext(compile('relay-tools.ts'), relayModule)
  const glyphModule = { exports: {} }
  runInNewContext(compile('glyphs.ts'), glyphModule)
  const panelModule = {
    exports: {},
    require(name) {
      if (name === './console-help') return helpModule.exports
      if (name === './relay-tools') return relayModule.exports
      if (name === './glyphs') return glyphModule.exports
      if (name === './prime-engine.js?raw') {
        return { default: readFileSync(new URL('../src/prime-engine.js', import.meta.url), 'utf8') }
      }
      return {}
    },
  }
  runInNewContext(compile('console-panel.ts'), panelModule)
  const html = panelModule.createSandboxSource()
  let workerSource
  runInNewContext(html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>')), {
    Blob: class { constructor(parts) { this.source = parts.join('') } },
    URL: { createObjectURL(blob) { workerSource = blob.source; return 'blob:test' }, revokeObjectURL() {} },
    Worker: class {},
    addEventListener() {},
  })
  let onMessage
  const messages = []
  const runtime = {
    postMessage(message) { messages.push(message) },
    addEventListener(type, listener) { if (type === 'message') onMessage = listener },
    structuredClone,
    performance,
    console: { log() {}, info() {}, warn() {}, error() {} },
  }
  runInNewContext(workerSource, runtime)
  const send = data => onMessage({ data: { channel: 'signal-archive-console', ...data } })
  return { runtime, messages, send }
}

test('directory, string signatures, function references, and unknown names', async () => {
  const { runtime, send } = createRuntime()
  await send({ type: 'init', puzzle: { id: 'test', data: {} } })
  const names = Object.keys(runtime.help())
  assert.equal(names.length, 14)
  for (const name of names) {
    assert.equal(runtime.help(name).name, name)
    assert.equal(runtime.help(` ${name.toUpperCase()}(value) `).name, name)
    assert.equal(runtime.help(runtime[name]).name, name)
    assert.ok(runtime.help(name).returns.length > 20)
    assert.ok(runtime.help(name).examples.length > 0)
  }
  for (const invalid of ['unknown', '<img onerror=alert(1)>', null, 42]) {
    assert.throws(() => runtime.help(invalid), /Unknown command. Available:/)
  }
})

test('help results and logs retain interactive metadata through worker serialization', async () => {
  const { send, messages } = createRuntime()
  await send({ type: 'run', id: 1, code: 'help()' })
  assert.equal(messages.at(-1).result.type, 'help')
  assert.equal(messages.at(-1).result.command, undefined)
  await send({ type: 'run', id: 2, code: 'console.log(help(factor)); help("primes")' })
  assert.equal(messages.at(-1).result.command, 'primes')
  assert.equal(messages.at(-1).logs[0].values[0].command, 'factor')
  await send({ type: 'run', id: 3, code: 'help("unknown")' })
  assert.match(messages.at(-1).error, /Unknown command/)
})

test('large single lookups and unchanged range boundaries survive the worker bridge', async () => {
  const { send, messages, runtime } = createRuntime()
  await send({ type: 'run', id: 1, code: 'primes(10000000000)' })
  assert.equal(messages.at(-1).result.prime.value, 252097800623)
  assert.equal(runtime.primes(10001).value, 104743)
  assert.equal(JSON.stringify(runtime.primes(9999, 10000)), '[104723,104729]')
  for (const args of [[1, 10001], [10001, 10001], [10000000001]]) {
    assert.throws(() => runtime.primes(...args), /prime ind/i)
  }
  await send({ type: 'run', id: 2, code: 'globalThis.saved = 17; Promise.resolve(primes(saved).value * 2)' })
  assert.equal(messages.at(-1).result.text, '118')
  assert.equal(runtime.saved, 17)
})

test('state-changing examples cannot be run directly from help', () => {
  const { runtime } = createRuntime()
  for (const name of ['answer', 'clear']) {
    assert.ok(runtime.help(name).examples.every(example => example.runnable === false))
  }
})

test('relay helpers and tool requests survive worker serialization', async () => {
  const { runtime, send, messages } = createRuntime()
  assert.equal(runtime.relay('6260', true), 42n)
  assert.equal(runtime.pack([0, 1, 2]), 66n)
  assert.equal(runtime.glyphs([0, 1, 2]), 'ABC')
  await send({ type: 'run', id: 1, code: 'tools()' })
  assert.equal(messages.at(-1).result.type, 'tools')
  await send({ type: 'run', id: 2, code: 'tools("bits")' })
  assert.ok(messages.some(message => message.type === 'popout' && message.tool === 'bits'))
  assert.throws(() => runtime.tools('unknown'), /Choose relay/)
})