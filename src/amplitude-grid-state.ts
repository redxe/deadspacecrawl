export interface ComplexAmplitude { real: number; imaginary: number }

export function getAmplitudeGridState(amplitudes: readonly ComplexAmplitude[]) {
  const qubits = Math.log2(amplitudes.length)
  if (!Number.isInteger(qubits) || qubits < 1 || qubits > 8) throw new Error('Amplitude grids support 1-8 qubits in ascending basis order.')
  const rowBits = Math.floor(qubits / 2)
  const columnBits = qubits - rowBits
  const columns = 2 ** columnBits
  const rows = 2 ** rowBits
  const cells = amplitudes.map((amplitude, index) => {
    if (!Number.isFinite(amplitude.real) || !Number.isFinite(amplitude.imaginary)) throw new Error('Amplitudes must be finite.')
    const magnitude = Math.hypot(amplitude.real, amplitude.imaginary)
    if (!Number.isFinite(magnitude) || magnitude > 1 + 1e-6) throw new Error('Amplitude magnitude exceeds one.')
    const phase = magnitude > 1e-12 ? Math.atan2(amplitude.imaginary, amplitude.real) : null
    return {
      index, basis: index.toString(2).padStart(qubits, '0'),
      row: Math.floor(index / columns), column: index % columns,
      real: amplitude.real, imaginary: amplitude.imaginary,
      magnitude, probability: magnitude ** 2, phase,
    }
  })
  const peak = Math.max(...cells.map(cell => cell.magnitude))
  return { qubits, rowBits, columnBits, rows, columns, cells, radiusScale: peak > 1e-12 ? 1 / peak : 1 }
}