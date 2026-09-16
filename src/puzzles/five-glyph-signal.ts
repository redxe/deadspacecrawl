import type { Puzzle } from './types'

const puzzle: Puzzle = {
  id: 'five-glyph-signal', sequence: '05', kind: 'logic', title: 'An Echo in Five',
  summary: 'One last word is caught in the receiver. Five positions. One familiar alphabet.',
  objective: 'Recover the five-letter word. Each round holds six guesses; retry as often as needed.',
  blocks: [{ type: 'custom', plugin: 'glyph-wordle', config: {} }],
  answer: { accepted: ['ROBIN'], label: 'Recovered word', placeholder: 'Five letters' },
  hints: [
    'Green marks the correct position. Gold marks a letter elsewhere in the word.',
    'The same letter cannot be matched more times than it occurs in the word.',
    'Think of a small visitor with a red breast, often seen in a garden.',
  ],
}

export default puzzle