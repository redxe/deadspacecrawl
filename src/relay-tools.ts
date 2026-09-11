export const relayToolDefinitions = [
  { name: 'relay', title: 'Inverse Function', description: 'Exact forward and inverse evaluation' },
  { name: 'bits', title: 'Bit Slots', description: 'Pack and unpack ordered 6-bit groups' },
  { name: 'glyphs', title: 'Glyph Chart', description: 'Indexed symbols and character lookup' },
] as const

export function createRelayTools(characters: readonly string[]) {
  function integer(value: string | number | bigint): bigint {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Use an integer string or BigInt for large values.')
    if (typeof value === 'string' && !/^(?:\d+|0b[01]+|0x[\da-f]+)$/i.test(value.trim())) throw new Error('Enter a nonnegative integer without separators.')
    if (!['string', 'number', 'bigint'].includes(typeof value)) throw new Error('Enter an integer, integer string, or BigInt.')
    const result = BigInt(value)
    if (result < 0n || result.toString(2).length > 256) throw new Error('Use a nonnegative integer of at most 256 bits.')
    return result
  }

  function pack(indices: number[]): bigint {
    if (!Array.isArray(indices) || indices.length < 1 || indices.length > 32 || !indices.every(index => Number.isInteger(index) && index >= 0 && index < characters.length)) {
      throw new Error(`Provide 1 to 32 glyph indices from 0 to ${characters.length - 1}.`)
    }
    return indices.reduce((value, index) => (value << 6n) | BigInt(index), 0n)
  }

  function unpack(value: string | number | bigint, count = 5): number[] {
    if (!Number.isInteger(count) || count < 1 || count > 32) throw new Error('Slot count must be an integer from 1 to 32.')
    let remaining = integer(value)
    if (remaining >= (1n << BigInt(count * 6))) throw new Error('The integer does not fit in that many 6-bit slots.')
    const indices = Array<number>(count).fill(0)
    for (let position = count - 1; position >= 0; position -= 1) {
      indices[position] = Number(remaining & 63n)
      remaining >>= 6n
    }
    return indices
  }

  function relay(value: string | number | bigint, reverse = false): bigint {
    const number = integer(value)
    if (typeof reverse !== 'boolean') throw new Error('The reverse flag must be true or false.')
    if (!reverse) return (number + 37n) ** 2n + 19n
    if (number < 1388n) throw new Error('The encoded value is below F(0).')
    const square = number - 19n
    let low = 0n
    let high = square + 1n
    while (high - low > 1n) {
      const middle = (low + high) >> 1n
      if (middle * middle <= square) low = middle
      else high = middle
    }
    if (low * low !== square) throw new Error('The encoded value does not have an exact integer inverse.')
    return low - 37n
  }

  function glyphs(indices?: number[]): string | Array<{ index: number; character: string }> {
    if (indices === undefined) return characters.map((character, index) => ({ index, character }))
    pack(indices)
    return indices.map(index => characters[index]).join('')
  }

  function bits(value: string | number | bigint, count = 5) {
    const indices = unpack(value, count)
    return { decimal: integer(value).toString(), binary: indices.map(index => index.toString(2).padStart(6, '0')).join(' '), indices }
  }

  return { pack, unpack, relay, glyphs, bits }
}