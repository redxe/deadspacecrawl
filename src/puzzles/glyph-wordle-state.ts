import { diffWords } from '@socnik/wordle-engine'

export const glyphWord = 'ROBIN'
export const roundLimit = 6
export interface GlyphWordleState { guesses: string[]; rounds: number; solved: boolean }
export type TileState = 'right' | 'almost' | 'wrong'
export const freshWordle = (): GlyphWordleState => ({ guesses: [], rounds: 1, solved: false })

export function scoreGuess(guess: string): TileState[] {
  if (!/^[A-Z]{5}$/.test(guess)) throw new Error('Enter exactly five letters.')
  const result = diffWords(guess, glyphWord) as TileState[]
  const remaining = new Map<string, number>()
  for (let index = 0; index < glyphWord.length; index++) {
    if (result[index] !== 'right') remaining.set(glyphWord[index]!, (remaining.get(glyphWord[index]!) ?? 0) + 1)
  }
  return result.map((state, index) => {
    if (state === 'right') return state
    const available = remaining.get(guess[index]!) ?? 0
    if (!available) return 'wrong'
    remaining.set(guess[index]!, available - 1)
    return 'almost'
  })
}

export function restoreWordle(raw: string | null): GlyphWordleState {
  try {
    const value = JSON.parse(raw ?? 'null')
    if (!value || !Array.isArray(value.guesses) || value.guesses.length > roundLimit || !value.guesses.every((guess: unknown) => typeof guess === 'string' && /^[A-Z]{5}$/.test(guess))) return freshWordle()
    const solved = value.guesses.includes(glyphWord)
    if (solved && value.guesses.at(-1) !== glyphWord) return freshWordle()
    return { guesses: value.guesses, rounds: Number.isSafeInteger(value.rounds) && value.rounds > 0 ? value.rounds : 1, solved }
  } catch { return freshWordle() }
}

export function submitGuess(state: GlyphWordleState, value: string): GlyphWordleState {
  if (state.solved) return state
  if (state.guesses.length >= roundLimit) throw new Error('Start another round to keep decoding.')
  const guess = value.trim().toUpperCase()
  scoreGuess(guess)
  return { ...state, guesses: [...state.guesses, guess], solved: guess === glyphWord }
}

export function retryWordle(state: GlyphWordleState): GlyphWordleState {
  return state.solved ? state : { guesses: [], rounds: state.rounds + 1, solved: false }
}