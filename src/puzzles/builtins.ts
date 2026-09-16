import { activePuzzle as signal } from './active'
import paired from './paired-signal'
import quantum from './quantum-relay'
import fourier from './fourier-signal'
import fiveGlyph from './five-glyph-signal'

export const builtinPuzzles = [signal, paired, quantum, fourier, fiveGlyph]