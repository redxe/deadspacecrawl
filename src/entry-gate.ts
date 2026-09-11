import { CHARACTER_KEYS } from './glyphs'
import { createRelayTools } from './relay-tools'
import type { Puzzle } from './puzzles/types'

const tools = createRelayTools(CHARACTER_KEYS)
const password = 'PESTO'
const indices = [...password].map(character => CHARACTER_KEYS.indexOf(character as typeof CHARACTER_KEYS[number]))
const packed = tools.pack(indices)
const encoded = tools.relay(packed)
const storageKey = 'signal-archive.entry.v1'

export function createEntryGate() {
  let stage = 0
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (saved && Number.isInteger(saved.stage) && saved.stage >= 0 && saved.stage <= 3) stage = saved.stage
  } catch {}

  const puzzles: Puzzle[] = [
    {
      id: 'entry-math', sequence: '01 / 03', kind: 'math', title: 'Restore the Integer',
      summary: 'Private relay. Three seals stand between this channel and the archive.',
      objective: 'Recover the nonnegative integer N from the recorded function value.',
      blocks: [
        { type: 'divider', label: 'Seal 01 / Inverse function' },
        { type: 'formula', latex: String.raw`F(N)=(N+37)^2+19,\qquad N\in\mathbb{Z}_{\geq0}` },
        { type: 'formula', latex: `F(N)=${encoded}` },
      ],
      answer: { accepted: [String(packed)], label: 'Recovered integer N', placeholder: 'Integer', mode: 'number' },
      hints: [
        'Undo the outermost operation first: subtract 19, then take the nonnegative square root.',
        'Subtract 37 after taking the square root. Keep every digit: this recorded value exceeds JavaScript Number precision.',
        'Open the Inverse function popout from tools(), or inspect help("relay"). Pass puzzle.data.encoded as a string to relay(value, true).',
      ],
      consoleData: { encoded: String(encoded), slots: 5, slotWidth: 6 },
    },
    {
      id: 'entry-bits', sequence: '02 / 03', kind: 'logic', title: 'Separate the Signal',
      summary: 'The recovered integer contains five ordered glyph indices.',
      objective: 'Extract the five 6-bit indices, left to right. Submit them as a comma-separated list.',
      blocks: [
        { type: 'divider', label: 'Seal 02 / Bitwise packing' },
        { type: 'formula', latex: `N=${packed}` },
        { type: 'formula', latex: String.raw`N=\sum_{j=0}^{4} c_j\,2^{6(4-j)},\qquad 0\leq c_j<41` },
        { type: 'code', code: 'N = (c0 << 24) | (c1 << 18) | (c2 << 12) | (c3 << 6) | c4' },
      ],
      answer: { accepted: [indices.join(',')], label: 'Five glyph indices', placeholder: 'c0, c1, c2, c3, c4' },
      hints: [
        'Each slot has six bits. A mask of 63 (binary 111111) isolates one slot.',
        'The last index is Number(BigInt(puzzle.data.packed) & 63n). Shift right by 6n to reveal the next slot; read the final list left to right.',
        'The Bit slots popout shows all five groups. In the console, bits(puzzle.data.packed) or unpack(puzzle.data.packed, 5) extracts them exactly.',
      ],
      consoleData: { packed: String(packed), slots: 5, slotWidth: 6 },
    },
    {
      id: 'entry-glyphs', sequence: '03 / 03', kind: 'cipher', title: 'Name the Key',
      summary: 'Five recovered symbols form the access word.',
      objective: 'Match each symbol to the glyph chart and enter the five-letter password.',
      blocks: [
        { type: 'divider', label: 'Seal 03 / Character mapping' },
        { type: 'cipher', text: password },
        { type: 'code', code: `Glyph indices: ${indices.join(', ')}` },
        { type: 'text', text: 'Chart positions start at zero: A = 0, B = 1, ... . Keep the recovered order.' },
      ],
      answer: { accepted: [password], label: 'Access password', placeholder: 'Five letters' },
      hints: [
        'These are positions in the character chart, not prime indices. Character positions are zero-based.',
        'Open the Glyph chart popout from tools(). Match each index and symbol to its letter.',
        'glyphs(puzzle.data.indices) resolves the five positions into the access word. Letter case does not matter.',
      ],
      consoleData: { indices, slots: 5, slotWidth: 6 },
    },
  ]

  return {
    get locked() { return stage < 3 },
    get puzzle() { return puzzles[stage] },
    get path() {
      return puzzles.map((puzzle, index) => ({ id: puzzle.id, title: puzzle.title, completed: index < stage, configured: true }))
    },
    submit(value: string): boolean {
      let correct = false
      if (stage === 0) correct = /^\d+$/.test(value.trim()) && BigInt(value.trim()) === packed
      if (stage === 1) {
        try {
          const input = value.trim()
          const parsed: unknown = JSON.parse(input.startsWith('[') ? input : `[${input}]`)
          correct = Array.isArray(parsed) && parsed.length === 5 && parsed.every((item, index) => item === indices[index])
        } catch {}
      }
      if (stage === 2) correct = value.trim().toUpperCase() === password
      if (correct) {
        stage += 1
        try { localStorage.setItem(storageKey, JSON.stringify({ stage })) } catch {}
      }
      return correct
    },
  }
}