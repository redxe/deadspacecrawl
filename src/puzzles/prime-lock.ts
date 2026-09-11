import type { Puzzle } from './types'

const puzzle: Puzzle = {
  id: 'prime-lock',
  sequence: '02',
  kind: 'math',
  title: 'The Prime Lock',
  summary: 'A navigation seal accepts one integer and no retries from the ship.',
  objective: 'Evaluate the prime-index expression and submit the value of n.',
  blocks: [
    { type: 'divider', label: 'Navigation seal' },
    {
      type: 'formula',
      latex: String.raw`\begin{aligned}
        \mathbb{P} &=(p_k)_{k\geq1}=(2,3,5,7,\ldots),\\
        n &= \mathbb{P}\left[\binom{6}{2}+2\right]
        \times \mathbb{P}\left[(3!-4)
        \left(\prod_{i=0}^{2}\mathbb{P}[3^i]\right)
        \mathbb{P}\left[6+\sum_{j=0}^{2}3^j\right]
        \mathbb{P}\left[2(3!+20)\right]\right].
      \end{aligned}`,
    },
  ],
  answer: {
    accepted: ['129769481'],
    label: 'Value of n',
    placeholder: 'Enter an integer',
    mode: 'number',
  },
  hints: [
    'The notation P[k] means the kth prime, counting 2 as the first.',
    'Evaluate every index before looking up its prime.',
    'Use primes(k).value for the kth prime, or primes(start, end) for an inclusive range of prime indices.',
  ],
  consoleData: {
    expectedDigits: 9,
  },
}

export default puzzle