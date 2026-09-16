import type { Puzzle, PuzzleBlock } from './types'

export interface PuzzleCatalog {
  version: 1
  puzzles: Puzzle[]
  order: string[]
  hidden: string[]
}

export const emptyCatalog = (): PuzzleCatalog => ({ version: 1, puzzles: [], order: [], hidden: [] })

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, name: string, required = true): asserts value is string {
  if (typeof value !== 'string' || value.length > 50000 || (required && !value.trim())) {
    throw new Error(`${name} must be ${required ? 'nonempty ' : ''}text (maximum 50,000 characters).`)
  }
}

function strings(value: unknown, name: string, allowEmpty = false): asserts value is string[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error(`${name} must be a list of at most 500 items.`)
  value.forEach(item => text(item, name, !allowEmpty))
}

function identifier(value: unknown, name: string): asserts value is string {
  text(value, name)
  if (!/^[a-z][a-z0-9-]{0,79}$/.test(value) || value.startsWith('entry-') || value.startsWith('upcoming-')) {
    throw new Error(`${name} must use lowercase letters, numbers and hyphens, and cannot use a reserved prefix.`)
  }
}

function scalar(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
}

export function validatePuzzle(value: unknown, draft = false): asserts value is Puzzle {
  if (!object(value)) throw new Error('Puzzle must be an object.')
  identifier(value.id, 'Puzzle ID')
  for (const key of ['sequence', 'title', 'summary', 'objective']) text(value[key], `${value.id}: ${key}`, !draft)
  if (typeof value.kind !== 'string' || !['cipher', 'logic', 'math'].includes(value.kind)) throw new Error(`${value.id}: invalid puzzle kind.`)
  if (!object(value.answer)) throw new Error(`${value.id}: answer is required.`)
  strings(value.answer.accepted, `${value.id}: accepted answers`, draft)
  if (!draft && !value.answer.accepted.length) throw new Error(`${value.id}: at least one accepted answer is required.`)
  text(value.answer.label, 'Answer label', !draft)
  text(value.answer.placeholder, 'Answer placeholder', false)
  if (value.answer.mode !== undefined && (typeof value.answer.mode !== 'string' || !['text', 'number'].includes(value.answer.mode))) throw new Error('Invalid answer mode.')
  strings(value.hints, 'Hints', draft)
  if (!Array.isArray(value.blocks) || (!draft && !value.blocks.length) || value.blocks.length > 100) throw new Error(`${value.id}: use between 1 and 100 blocks.`)
  let workspaceCount = 0
  for (const block of value.blocks) {
    if (!object(block)) throw new Error('Block must be an object.')
    text(block.type, 'Block type')
    if (['fourier', 'quantum', 'playfair'].includes(block.type)) {
      workspaceCount += 1
    } else if (block.type === 'custom') {
      identifier(block.plugin, 'Plugin ID')
      if (!object(block.config) || !Object.values(block.config).every(scalar)) throw new Error('Custom block settings must contain text, numbers or booleans.')
    } else {
      const fields: Record<string, string> = { text: 'text', cipher: 'text', formula: 'latex', code: 'code', divider: 'label' }
      const field = Object.hasOwn(fields, block.type) ? fields[block.type] : undefined
      if (!field) throw new Error(`Unknown block type: ${String(block.type)}`)
      text(block[field], `${String(block.type)} content`, !draft)
    }
  }
  if (workspaceCount > 1) throw new Error('Use only one built-in interactive workspace per puzzle.')
  if (value.consoleData !== undefined) {
    if (!object(value.consoleData) || !Object.values(value.consoleData).every(item => scalar(item) || (
      Array.isArray(item) && (item.every(entry => typeof entry === 'string') || item.every(entry => typeof entry === 'number' && Number.isFinite(entry)))
    ))) throw new Error('Console data values must be scalars, string arrays or number arrays.')
  }
}

export function parseCatalog(value: unknown, draft = false): PuzzleCatalog {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.puzzles) || value.puzzles.length > 500) throw new Error('Expected a version 1 puzzle catalog.')
  value.puzzles.forEach(puzzle => validatePuzzle(puzzle, draft))
  strings(value.order, 'Puzzle order')
  strings(value.hidden, 'Hidden puzzles')
  for (const [name, items] of [['puzzles', value.puzzles.map(puzzle => puzzle.id)], ['order', value.order], ['hidden', value.hidden]] as const) {
    if (new Set(items).size !== items.length) throw new Error(`Duplicate IDs in ${name}.`)
  }
  return structuredClone(value) as unknown as PuzzleCatalog
}

export function resolveCatalog(builtins: Puzzle[], catalog: PuzzleCatalog, includeHidden = false): Puzzle[] {
  const puzzles = new Map(builtins.map(puzzle => [puzzle.id, puzzle]))
  catalog.puzzles.forEach(puzzle => puzzles.set(puzzle.id, puzzle))
  const ordered = [...new Set([...catalog.order, ...puzzles.keys()])]
  return ordered.flatMap(id => {
    const puzzle = puzzles.get(id)
    return puzzle && (includeHidden || !catalog.hidden.includes(id)) ? [structuredClone(puzzle)] : []
  })
}

export function compactCatalog(builtins: Puzzle[], catalog: PuzzleCatalog): PuzzleCatalog {
  return {
    ...catalog,
    puzzles: catalog.puzzles.filter(puzzle => {
      const original = builtins.find(entry => entry.id === puzzle.id)
      return !original || JSON.stringify(original) !== JSON.stringify(puzzle)
    }),
  }
}

export function makeBlock(type: PuzzleBlock['type']): PuzzleBlock {
  if (type === 'custom') return { type, plugin: 'number-lock', config: { target: 42, label: 'Set the receiver frequency' } }
  if (type === 'text' || type === 'cipher') return { type, text: '' }
  if (type === 'formula') return { type, latex: '' }
  if (type === 'code') return { type, code: '' }
  if (type === 'divider') return { type, label: '' }
  return { type }
}