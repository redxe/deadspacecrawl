import { tokenizeGlyphText } from './glyphs'
import { answerMatches } from './puzzles/types'
import type { Puzzle } from './puzzles/types'

export type GlyphMatch = 'unanswered' | 'correct' | 'incorrect'
export interface GlyphFeedback { state: GlyphMatch; entered: string }
export interface GlyphFeedbackTarget { element: HTMLElement; text: string; letters?: readonly string[] }

export function getLetterFeedback(letters: readonly string[], answer: string): GlyphFeedback[] {
  const enteredText = answer.toUpperCase().replace(/[^A-Z0-9?!]/g, '')
  let offset = 0
  const feedback = letters.map(expected => {
    const entered = enteredText.slice(offset, offset + expected.length)
    offset += expected.length
    return { state: !entered ? 'unanswered' : expected.startsWith(entered) ? 'correct' : 'incorrect', entered } as GlyphFeedback
  })
  const last = feedback.filter((_, index) => !!letters[index]).at(-1)
  if (last && offset < enteredText.length) {
    last.state = 'incorrect'
    last.entered += enteredText.slice(offset)
  }
  return feedback
}

export function getGlyphFeedback(texts: readonly string[], answer: string): GlyphFeedback[][] {
  const enteredText = answer.toUpperCase().replace(/[^A-Z0-9?!]/g, '')
  let offset = 0
  const blocks = texts.map(text => {
    const feedback: GlyphFeedback[] = []
    for (const line of tokenizeGlyphText(text)) {
      let previousLetter = ''
      for (const token of line) {
        if (token === ' ') { previousLetter = ''; continue }
        const expected = token === 'dbl-letter' ? previousLetter : token.toUpperCase()
        const entered = enteredText.slice(offset, offset + expected.length)
        offset += expected.length
        feedback.push({ state: !entered ? 'unanswered' : expected.startsWith(entered) ? 'correct' : 'incorrect', entered })
        previousLetter = /[A-Z]$/.test(expected) ? expected.slice(-1) : ''
      }
    }
    return feedback
  })
  const last = blocks.flat().at(-1)
  if (last && offset < enteredText.length) {
    last.state = 'incorrect'
    last.entered += enteredText.slice(offset)
  }
  return blocks
}

export function getTransmissionFeedback(puzzle: Puzzle, answer: string, renderedTexts?: readonly string[]) {
  const texts = puzzle.answer.mode === 'number' ? [] : renderedTexts ?? puzzle.blocks.flatMap(block => block.type === 'cipher' ? [block.text] : [])
  const blocks = getGlyphFeedback(texts, answer)
  const ready = blocks.some(block => block.length > 0)
    && blocks.every(block => block.every(glyph => glyph.state === 'correct'))
    && answerMatches(puzzle, answer)
  return { blocks, ready }
}

export function initializeGlyphFeedback(
  input: HTMLInputElement,
  transmit: HTMLButtonElement,
  getPuzzle: () => Puzzle,
  getTargets: () => readonly GlyphFeedbackTarget[],
) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  const previous = new WeakMap<HTMLImageElement, GlyphFeedback>()
  let composing = false

  const refresh = (animate = false): void => {
    const targets = getTargets()
    const blocks = targets.map(target => target.letters ? getLetterFeedback(target.letters, input.value) : getGlyphFeedback([target.text], input.value)[0]!)
    const result = targets.some(target => target.letters)
      ? { blocks, ready: !input.disabled && blocks.some(block => block.length > 0) && blocks.every(block => block.every(glyph => glyph.state !== 'incorrect')) && answerMatches(getPuzzle(), input.value) }
      : getTransmissionFeedback(getPuzzle(), input.value, targets.map(target => target.text))
    if (input.disabled) result.ready = false
    transmit.classList.toggle('submit-button--ready', result.ready)
    transmit.setAttribute('aria-label', result.ready ? 'Transmit matching text' : 'Transmit')
    transmit.title = result.ready ? 'Transmit matching text' : 'Transmit'
    const hasErrors = result.blocks.some(block => block.some(glyph => glyph.state === 'incorrect'))
    if (result.blocks.length) input.setAttribute('aria-invalid', String(hasErrors))
    else input.removeAttribute('aria-invalid')

    targets.forEach(({ element }, blockIndex) => {
      const feedback = result.blocks[blockIndex] ?? []
      element.querySelectorAll<HTMLImageElement>('.glyph').forEach((glyph, glyphIndex) => {
        const next = feedback[glyphIndex] ?? { state: 'unanswered', entered: '' }
        const last = previous.get(glyph)
        const changed = last?.state !== next.state || last?.entered !== next.entered
        glyph.dataset.feedback = next.state
        previous.set(glyph, next)
        if (changed || motion.matches) glyph.getAnimations().forEach(animation => animation.cancel())
        if (animate && changed && next.state !== 'unanswered' && !motion.matches) {
          glyph.animate([
            { opacity: .85, transform: 'scale(1)' },
            { opacity: 1, transform: 'scale(1.06)', offset: .35 },
            { opacity: 1, transform: 'scale(1)' },
          ], { duration: 460, easing: 'ease-out' })
        }
      })
      const correct = feedback.filter(glyph => glyph.state === 'correct').length
      const incorrect = feedback.filter(glyph => glyph.state === 'incorrect').length
      element.setAttribute('role', 'img')
      element.setAttribute('aria-label', `Encoded transmission. ${correct} matching glyphs, ${incorrect} mismatching glyphs.`)
    })
  }
  const onInput = (event: Event): void => { if (!composing && !(event as InputEvent).isComposing) refresh(true) }
  const onCompositionStart = (): void => { composing = true }
  const onCompositionEnd = (): void => { composing = false; refresh(true) }
  const onMotion = (): void => refresh()
  const onPageHide = (event: PageTransitionEvent): void => { if (!event.persisted) destroy() }
  const destroy = (): void => {
    input.removeEventListener('input', onInput)
    input.removeEventListener('compositionstart', onCompositionStart)
    input.removeEventListener('compositionend', onCompositionEnd)
    motion.removeEventListener('change', onMotion)
    window.removeEventListener('pagehide', onPageHide)
    getTargets().forEach(({ element }) => element.querySelectorAll('.glyph').forEach(glyph => glyph.getAnimations().forEach(animation => animation.cancel())))
  }
  input.addEventListener('input', onInput)
  input.addEventListener('compositionstart', onCompositionStart)
  input.addEventListener('compositionend', onCompositionEnd)
  motion.addEventListener('change', onMotion)
  window.addEventListener('pagehide', onPageHide)
  refresh()
  return { refresh, destroy }
}