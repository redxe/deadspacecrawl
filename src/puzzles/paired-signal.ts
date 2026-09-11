import type { Puzzle } from './types'

const puzzle: Puzzle = {
  id: 'paired-signal', sequence: '02', kind: 'cipher', title: 'A Light Between Pairs',
  summary: 'A second transmission is hidden in a keyed square of familiar symbols.',
  objective: 'Recover the square, decipher the glyph pairs, then restore the original sentence.',
  blocks: [{ type: 'playfair' }],
  answer: {
    accepted: ['ferry tales really do come true dont they?'],
    label: 'Restored transmission', placeholder: 'Complete the pair worksheet first',
  },
  hints: [
    'The beginnings of the seven log lines carry the key. Read down, not across.',
    'Keep each key letter only the first time it appears. Continue with the unused alphabet, omitting J, left to right across the square.',
    'Decrypt pairs: move left in a shared row, up in a shared column, or exchange columns for a rectangle. Wrap at the edges.',
    'An X between repeated letters can be a separator. Do not remove genuine letters; restore spaces and punctuation after all pairs are verified.',
  ],
  consoleData: { cipher: 'Playfair', squareSize: 5, pairCount: 18, mergedLetters: 'I/J', separator: 'X', finalPadding: 'Z' },
}

export default puzzle