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