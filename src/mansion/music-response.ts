export function musicResponse(bands: readonly number[]) {
  const energy = (start: number, end: number) => {
    let sum = 0
    for (let index = start; index < end; index++) {
      const value = bands[index] ?? 0
      sum += Number.isFinite(value) ? Math.max(0, Math.min(1, value)) ** 2 : 0
    }
    return Math.min(1, Math.sqrt(sum / (end - start)) * 1.7)
  }
  return [energy(0, 12), energy(12, 32), energy(32, 48)]
}

export function waveformResponse(waveform: readonly number[]) {
  const values = Array.from({ length: 64 }, (_value, index) => {
    const value = waveform[index] ?? 0
    return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0
  })
  const peak = Math.max(.025, ...values.map(Math.abs))
  return values.map(value => value / peak)
}