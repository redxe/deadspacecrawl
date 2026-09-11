import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const context = { exports: {} }
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/amplitude-grid-state.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const { getAmplitudeGridState } = context.exports
const empty = count => Array.from({ length: count }, () => ({ real: 0, imaginary: 0 }))

test('eight qubits use the leading half for rows and trailing half for columns', () => {
  const state = getAmplitudeGridState(empty(256))
  assert.equal(state.rows, 16)
  assert.equal(state.columns, 16)
  for (const cell of state.cells) {
    assert.equal(cell.basis, cell.row.toString(2).padStart(4, '0') + cell.column.toString(2).padStart(4, '0'))
    assert.equal(cell.index, cell.row * 16 + cell.column)
  }
  assert.equal(state.cells[171].row, 10)
  assert.equal(state.cells[171].column, 11)
})
test('odd qubit counts put the extra bit on the horizontal axis', () => {
  const state = getAmplitudeGridState(empty(8))
  assert.equal(state.rowBits, 1)
  assert.equal(state.columnBits, 2)
  assert.equal(state.rows, 2)
  assert.equal(state.columns, 4)
  assert.equal(state.cells[5].basis, '101')
  assert.equal(state.cells[5].row, 1)
  assert.equal(state.cells[5].column, 1)
})
test('phase and common magnitude scale preserve the complex state', () => {
  const state = getAmplitudeGridState([
    { real: .5, imaginary: 0 }, { real: 0, imaginary: .5 },
    { real: -.5, imaginary: 0 }, { real: 0, imaginary: -.5 },
    { real: 0, imaginary: 0 }, { real: .25, imaginary: 0 },
    { real: 1e-16, imaginary: -1e-16 }, { real: .3, imaginary: .4 },
  ])
  assert.equal(state.radiusScale, 2)
  for (const [index, phase] of [0, Math.PI / 2, Math.PI, -Math.PI / 2].entries()) assert.equal(state.cells[index].phase, phase)
  assert.equal(state.cells[4].phase, null)
  assert.equal(state.cells[6].phase, null)
  assert.equal(state.cells[5].magnitude * state.radiusScale, .5)
  assert.equal(state.cells[7].probability, .25)
  assert.ok(Math.abs(state.cells[7].phase - Math.atan2(.4, .3)) < 1e-12)
  assert.equal(getAmplitudeGridState(empty(2)).radiusScale, 1)
})
test('invalid dimensions and nonfinite or oversized amplitudes are rejected', () => {
  for (const count of [0,1,3,512]) assert.throws(() => getAmplitudeGridState(empty(count)))
  for (const real of [NaN, Infinity, 2]) assert.throws(() => getAmplitudeGridState([{ real, imaginary: 0 }, { real: 0, imaginary: 0 }]))
})