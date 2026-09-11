import type { Puzzle } from './types'

const puzzle: Puzzle = {
  id: 'fourier-signal', sequence: '04', kind: 'math', title: 'What the Phases Remember',
  summary: 'A word scattered through phase. A private key hidden in its symbols.',
  objective: 'Recover six glyphs from the statevector, factor their packed integer, and decipher the RSA transmission.',
  blocks: [{ type: 'fourier' }],
  answer: {
    accepted: ['you never cease to impress me robert! you melt my heart and i have known for a while that i had to be yours'],
    label: 'Decoded transmission', placeholder: 'Recover the glyph word and decrypt RSA first',
  },
  hints: [
    'The received amplitudes were transformed with positive Fourier phase. Undo that with the inverse QFT, not a measurement.',
    'Split each occupied eight-bit basis label into three position bits and five letter-index bits. Order the letters by position, starting at zero.',
    'The alphabet chart is zero-based. After recovery, repack those six indices into six-bit slots, first glyph most significant; do not concatenate decimal digits.',
    'Use the largest prime factor of the packed integer as p. Compute q = n/p, phi = (p-1)(q-1), then d = inverse(e) modulo phi.',
  ],
  consoleData: { qubits: 8, amplitudes: 256, positionBits: 3, glyphBits: 5, packingBits: 6, rsaEncoding: 'textbook RSA, one UTF-8 byte per block' },
}
export default puzzle