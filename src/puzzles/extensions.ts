import type { Puzzle } from './types'
import { extensionDefinitions } from './extension-schema'
import type { PuzzleSetting } from './extension-schema'
export { validateExtensions } from './extension-schema'
export type { PuzzleSetting } from './extension-schema'

export interface PuzzleExtension {
  id: string
  title: string
  fields: PuzzleSetting[]
  mount: (
    config: Record<string, string | number | boolean>,
    context: PuzzleExtensionContext,
  ) => { element: HTMLElement; destroy: () => void }
}

export interface PuzzleExtensionContext {
  puzzle: Puzzle
  preview: boolean
  setReady: (ready: boolean) => void
  complete?: (answer: string) => void
  audio?: {
    setSpatial: (state: { gain: number; pan: number } | null) => void
    resume: () => void
    muted: () => boolean
    toggleMute: () => void
    spectrum?: () => { bands: readonly number[] } | null
  }
}

export const puzzleExtensions: PuzzleExtension[] = [
  {
    ...extensionDefinitions.find(extension => extension.id === 'glyph-wordle')!,
    mount(_config, context) {
      const element = document.createElement('section')
      element.textContent = 'Calibrating signal...'
      let disposed = false
      let workspace: { destroy: () => void } | undefined
      void import('./glyph-wordle').then(module => {
        if (disposed) return
        workspace = module.initializeGlyphWordle(element, context)
      }).catch(() => { if (!disposed) element.textContent = 'Signal unavailable. Reload to retry.' })
      return { element, destroy: () => { disposed = true; workspace?.destroy(); element.remove() } }
    },
  },
  {
    ...extensionDefinitions.find(extension => extension.id === 'number-lock')!,
    mount(config, context) {
      const element = document.createElement('section')
      element.className = 'tool-form'
      const label = document.createElement('label')
      label.textContent = String(config.label)
      const input = document.createElement('input')
      input.type = 'number'
      input.min = '0'
      input.max = '999999'
      input.step = 'any'
      const status = document.createElement('p')
      status.className = 'content-copy'
      status.setAttribute('aria-live', 'polite')
      const update = () => {
        const ready = input.value !== '' && input.valueAsNumber === config.target
        status.textContent = ready ? 'Frequency locked.' : 'Receiver unlocked.'
        context.setReady(ready)
      }
      input.addEventListener('input', update)
      label.append(input)
      element.append(label, status)
      update()
      return { element, destroy: () => { input.removeEventListener('input', update); element.remove() } }
    },
  },
]

