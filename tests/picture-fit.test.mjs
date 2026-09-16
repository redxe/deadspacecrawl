import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const context = { exports: {} }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/mansion/picture-fit.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const { fitFramePicture } = context.exports

test('portrait, landscape, square and panoramic images fit varied frame canvases without cropping or distortion', () => {
  for (const [imageWidth, imageHeight] of [[3000, 4000], [3840, 2160], [640, 640], [670, 140]]) {
    for (const [frameWidth, frameHeight] of [[1.48, 1.98], [3.15, 1.78], [2.35, 2.2], [3.3, .9]]) {
      const fit = fitFramePicture(imageWidth, imageHeight, frameWidth, frameHeight)
      assert.ok(Math.abs(fit.canvasWidth / fit.canvasHeight - frameWidth / frameHeight) < .005)
      assert.ok(Math.abs(fit.width / fit.height - imageWidth / imageHeight) < 1e-10)
      assert.ok(fit.x > 0 && fit.y > 0)
      assert.ok(fit.x + fit.width < fit.canvasWidth && fit.y + fit.height < fit.canvasHeight)
      assert.equal(Math.max(fit.canvasWidth, fit.canvasHeight), 1200)
    }
  }
  assert.throws(() => fitFramePicture(0, 100, 2, 3))
})