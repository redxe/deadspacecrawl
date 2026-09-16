export type PuzzleKind = 'cipher' | 'logic' | 'math'

export type PuzzleBlock =
  | { type: 'custom'; plugin: string; config: Record<string, string | number | boolean> }
  | { type: 'fourier' }
  | { type: 'quantum' }
  | { type: 'playfair' }
  | { type: 'text'; text: string }
  | { type: 'cipher'; text: string }
  | { type: 'formula'; latex: string }
  | { type: 'code'; code: string }
  | { type: 'divider'; label: string }

export type AnswerMode = 'text' | 'number'

export interface PuzzleAnswer {
  accepted: string[]
  label: string
  placeholder: string
  mode?: AnswerMode
}

export interface Puzzle {
  id: string
  sequence: string
  kind: PuzzleKind
  title: string
  summary: string
  objective: string
  blocks: PuzzleBlock[]
  answer: PuzzleAnswer
  hints: string[]
  consoleData?: Record<string, string | number | boolean | number[] | string[]>
}

export function normalizeAnswer(value: string, mode: AnswerMode = 'text'): string {
  const normalized = value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')

  if (mode === 'number') {
    return normalized.replace(/[,_\s]/g, '')
  }

  return normalized.replace(/[.,;:!?]+$/g, '')
}

export function answerMatches(puzzle: Puzzle, value: string): boolean {
  const submitted = normalizeAnswer(value, puzzle.answer.mode)

  return puzzle.answer.accepted.some(
    (answer) => normalizeAnswer(answer, puzzle.answer.mode) === submitted,
  )
}