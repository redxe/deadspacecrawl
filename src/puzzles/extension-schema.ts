import type { Puzzle } from './types'

export interface PuzzleSetting {
  key: string
  label: string
  type: 'text' | 'number' | 'boolean'
  default: string | number | boolean
  min?: number
  max?: number
}

export const extensionDefinitions: Array<{ id: string; title: string; fields: PuzzleSetting[] }> = [
  { id: 'glyph-wordle', title: 'Five-glyph signal', fields: [] },
  {
    id: 'number-lock', title: 'Frequency lock',
    fields: [
      { key: 'label', label: 'Prompt', type: 'text', default: 'Set the receiver frequency' },
      { key: 'target', label: 'Target frequency', type: 'number', default: 42, min: 0, max: 999999 },
    ],
  },
]

export function validateExtensions(puzzle: Puzzle): void {
  for (const block of puzzle.blocks) {
    if (block.type !== 'custom') continue
    const extension = extensionDefinitions.find(candidate => candidate.id === block.plugin)
    if (!extension) throw new Error(`${puzzle.title}: plugin "${block.plugin}" is not registered.`)
    for (const field of extension.fields) {
      const value = block.config[field.key]
      const expectedType = field.type === 'text' ? 'string' : field.type
      if (typeof value !== expectedType || (typeof value === 'number' && (!Number.isFinite(value) || value < (field.min ?? -Infinity) || value > (field.max ?? Infinity)))) {
        throw new Error(`${puzzle.title}: invalid ${extension.title} setting "${field.label}".`)
      }
    }
  }
}