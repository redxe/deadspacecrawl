import type { Puzzle } from './types'

const puzzle: Puzzle = {
  id: 'signal-in-the-dark',
  sequence: '01',
  kind: 'cipher',
  title: 'A Door in the Dark',
  summary: 'An unscheduled transmission is repeating on a private channel.',
  objective: 'Decode the two-line transmission and enter it in plain English.',
  blocks: [
    { type: 'divider', label: 'Recovered transmission' },
    {
      type: 'cipher',
      text: 'A DOOR OPENED TO ME\nAND THERE YOU WERE',
    },
  ],
  answer: {
    accepted: [
      'A DOOR OPENED TO ME AND THERE YOU WERE',
      'A DOOR OPENED TO ME\nAND THERE YOU WERE',
    ],
    label: 'Decoded transmission',
    placeholder: 'Enter the recovered text',
  },
  hints: [
    'The first line contains six glyph groups: 1 / 4 / 6 / 2 / 2.',
    'Repeated letters use the vertical double-letter marker instead of drawing the letter twice.',
    'The crossed glyph represents TH as a single sound.',
  ],
  consoleData: {
    lineCount: 2,
    wordLengths: [1, 4, 6, 2, 2, 3, 5, 3, 4],
  },
}

export default puzzle