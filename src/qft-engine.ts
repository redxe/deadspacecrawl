import { jsqubits } from 'jsqubits'

export interface StateAmplitude { real: number; imaginary: number }
export const qftSize = 256

export function validateStatevector(value: unknown): asserts value is StateAmplitude[] {
  if (!Array.isArray(value) || value.length !== qftSize || !value.every(amplitude => amplitude && Number.isFinite(amplitude.real) && Number.isFinite(amplitude.imaginary))) throw new Error('Expected 256 finite complex amplitudes as {real, imaginary} objects.')
  const norm = value.reduce((total, amplitude) => total + amplitude.real ** 2 + amplitude.imaginary ** 2, 0)
  if (Math.abs(norm - 1) > 1e-6) throw new Error('The statevector must have total probability 1 (tolerance 0.000001).')
}

export function transformStatevector(input: StateAmplitude[], inverse: boolean): StateAmplitude[] {
  validateStatevector(input)
  let state = jsqubits('00000000').multiply(0)
  input.forEach((amplitude, index) => {
    if (amplitude.real || amplitude.imaginary) state = state.add(jsqubits(index.toString(2).padStart(8, '0')).multiply(jsqubits.complex(amplitude.real, inverse ? -amplitude.imaginary : amplitude.imaginary)))
  })
  const transformed = state.qft(jsqubits.ALL)
  return Array.from({ length: qftSize }, (_, index) => {
    const amplitude = transformed.amplitude(index)
    return { real: amplitude.real, imaginary: inverse ? -amplitude.imaginary : amplitude.imaginary }
  })
}

export const signalIndices = [21, 8, 14, 11, 4, 19] as const
export function receivedStatevector(): StateAmplitude[] {
  const vector = Array.from({ length: qftSize }, () => ({ real: 0, imaginary: 0 }))
  signalIndices.forEach((glyph, position) => { vector[position * 32 + glyph] = { real: 1 / Math.sqrt(6), imaginary: 0 } })
  return transformStatevector(vector, false)
}

export function packGlyphIndices(indices: readonly number[]): bigint {
  if (indices.length !== 6 || !indices.every(index => Number.isInteger(index) && index >= 0 && index < 26)) throw new Error('Select six alphabet glyphs, with indices A=0 through Z=25.')
  return indices.reduce((value, index) => (value << 6n) | BigInt(index), 0n)
}

export function matchesSignal(indices: readonly number[]): boolean {
  return indices.length === signalIndices.length && indices.every((index, position) => index === signalIndices[position])
}