import { jsqubits } from 'jsqubits'

export type CircuitCell = 'H' | 'X' | 'Z' | 'control' | null
export type Circuit = CircuitCell[][]
export const circuitColumns = 12
export const emptyCircuit = (): Circuit => Array.from({ length: circuitColumns }, () => [null, null, null])

export function isCircuit(value: unknown): value is Circuit {
  return Array.isArray(value) && value.length === circuitColumns && value.every(column => Array.isArray(column) && column.length === 3 && column.every(cell => [null, 'H', 'X', 'Z', 'control'].includes(cell)))
}

export function circuitError(circuit: Circuit): string | null {
  if (!isCircuit(circuit)) return 'Invalid circuit dimensions.'
  for (const [index, column] of circuit.entries()) {
    const targets = column.filter(cell => cell && cell !== 'control')
    const controls = column.filter(cell => cell === 'control')
    if (controls.length && targets.length > 1) return `Column ${index + 1}: a controlled operation needs exactly one target.`
    if (controls.length > 1) return `Column ${index + 1}: use one control dot.`
    if (controls.length && (targets.length !== 1 || !['X', 'Z'].includes(targets[0]!))) return `Column ${index + 1}: pair the control dot with X or Z on another qubit.`
  }
  return null
}

export function simulateCircuit(circuit: Circuit, theta = 73, phi = 51, through = circuitColumns) {
  const error = circuitError(circuit)
  if (error) throw new Error(error)
  if (!Number.isFinite(theta) || !Number.isFinite(phi)) throw new Error('Input angles must be finite.')
  const polar = theta * Math.PI / 360
  const phase = phi * Math.PI / 180
  let state = jsqubits('000').multiply(Math.cos(polar)).add(jsqubits('100').multiply(jsqubits.complex(Math.sin(polar) * Math.cos(phase), Math.sin(polar) * Math.sin(phase))))
  for (const column of circuit.slice(0, Math.max(0, Math.min(circuitColumns, through)))) {
    const control = column.indexOf('control')
    for (const [wire, gate] of column.entries()) {
      if (!gate || gate === 'control') continue
      const targetBit = 2 - wire
      if (gate === 'H') state = state.hadamard(targetBit)
      else if (gate === 'X') state = control < 0 ? state.x(targetBit) : state.cnot(2 - control, targetBit)
      else state = control < 0 ? state.z(targetBit) : state.controlledZ(2 - control, targetBit)
    }
  }
  return Array.from({ length: 8 }, (_, index) => {
    const amplitude = state.amplitude(index)
    return { basis: index.toString(2).padStart(3, '0'), real: amplitude.real, imaginary: amplitude.imaginary, probability: amplitude.real ** 2 + amplitude.imaginary ** 2 }
  })
}

export function verifyTeleportation(circuit: Circuit): { valid: boolean; detail: string } {
  const error = circuitError(circuit)
  if (error) return { valid: false, detail: error }
  const zero = simulateCircuit(circuit, 0, 0)
  const one = simulateCircuit(circuit, 180, 0)
  const leakage = zero.reduce((total, value, index) => total + (index === 0 ? 0 : value.probability), 0)
    + one.reduce((total, value, index) => total + (index === 1 ? 0 : value.probability), 0)
  if (leakage > 1e-9) return { valid: false, detail: 'Not verified. Transfer both basis states to qubit 3 and return qubits 1 and 2 to |00>.' }
  if (Math.hypot(zero[0]!.real - one[1]!.real, zero[0]!.imaginary - one[1]!.imaginary) > 1e-9) return { valid: false, detail: 'Basis probabilities match, but the relative phase changed. Superpositions would not survive.' }
  return { valid: true, detail: 'Verified for every input state, up to one common global phase: |x00> becomes |00x>.' }
}