import { CornerDownLeft, Delete, DoorOpen, RotateCcw, createElement } from 'lucide'
import { loadGlyphAtlas } from '../glyphs'
import type { GlyphAtlas, CHARACTER_KEYS } from '../glyphs'
import type { PuzzleExtensionContext } from './extensions'
import { freshWordle, glyphWord, restoreWordle, retryWordle, roundLimit, scoreGuess, submitGuess } from './glyph-wordle-state'
import type { TileState } from './glyph-wordle-state'
import '../glyph-wordle.css'

export function initializeGlyphWordle(element: HTMLElement, context: PuzzleExtensionContext) {
  const key = `signal-archive.glyph-wordle.v1.${context.puzzle.id}`
  let state = freshWordle()
  if (!context.preview) { try { state = restoreWordle(localStorage.getItem(key)) } catch {} }
  let atlas: GlyphAtlas | undefined
  let disposed = false
  let opening = false
  let world: { destroy: () => void } | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const noop = () => {}
  const audio = context.audio ?? { setSpatial: noop, resume: noop, muted: () => true, toggleMute: noop }
  element.className = 'glyph-wordle'
  element.innerHTML = `<div class="glyph-wordle-meta"><span data-round></span><div class="glyph-wordle-legend"><span data-state="right">Exact</span><span data-state="almost">Elsewhere</span><span data-state="wrong">Absent</span></div></div><div class="glyph-wordle-board" role="grid" aria-label="Five-glyph guesses"></div><form class="glyph-wordle-input"><label for="glyph-guess">Five-letter guess</label><div><input id="glyph-guess" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" pattern="[A-Za-z]{5}" aria-label="Five-letter guess"><button class="icon-button" type="submit" title="Submit guess" aria-label="Submit guess"></button></div></form><div class="glyph-wordle-keyboard" aria-label="Glyph keyboard"></div><p class="glyph-wordle-status" role="status" aria-live="polite"></p><div class="glyph-wordle-actions"></div>`
  const board = element.querySelector<HTMLElement>('.glyph-wordle-board')!
  const input = element.querySelector<HTMLInputElement>('input')!
  const form = element.querySelector<HTMLFormElement>('form')!
  const submit = form.querySelector<HTMLButtonElement>('button')!
  submit.append(createElement(CornerDownLeft))
  const keyboard = element.querySelector<HTMLElement>('.glyph-wordle-keyboard')!
  const status = element.querySelector<HTMLElement>('.glyph-wordle-status')!
  const actions = element.querySelector<HTMLElement>('.glyph-wordle-actions')!
  const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'icon-text-button'; retry.append(createElement(RotateCcw), document.createTextNode('Another round')); actions.append(retry)
  const revisit = document.createElement('button'); revisit.type = 'button'; revisit.className = 'icon-text-button'; revisit.append(createElement(DoorOpen), document.createTextNode('Return to the gallery')); actions.append(revisit)
  const cells: HTMLElement[][] = []
  for (let row = 0; row < roundLimit; row++) {
    const rowElement = document.createElement('div'); rowElement.className = 'glyph-wordle-row'; rowElement.setAttribute('role', 'row'); board.append(rowElement)
    cells.push(Array.from({ length: 5 }, () => {
      const cell = document.createElement('div'); cell.className = 'glyph-wordle-tile'; cell.setAttribute('role', 'gridcell'); rowElement.append(cell); return cell
    }))
  }
  const keyButtons = new Map<string, HTMLButtonElement>()
  const glyph = (target: HTMLElement, letter: string) => {
    target.replaceChildren()
    if (!letter) return
    const source = atlas?.get(letter as typeof CHARACTER_KEYS[number])
    if (source) { const image = document.createElement('img'); image.src = source; image.alt = ''; image.draggable = false; target.append(image) }
    else target.textContent = letter
  }
  for (const letters of ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']) {
    const row = document.createElement('div'); row.className = 'glyph-wordle-key-row'; keyboard.append(row)
    for (const letter of letters) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'glyph-wordle-key'; button.title = letter; button.setAttribute('aria-label', `Glyph ${letter}`); keyButtons.set(letter, button); row.append(button)
      button.addEventListener('click', () => { if (input.disabled || input.value.length >= 5) return; input.value += letter; render() })
    }
    if (letters === 'ZXCVBNM') {
      const erase = document.createElement('button'); erase.type = 'button'; erase.className = 'glyph-wordle-key'; erase.title = 'Delete letter'; erase.setAttribute('aria-label', 'Delete letter'); erase.append(createElement(Delete)); row.append(erase)
      erase.addEventListener('click', () => { input.value = input.value.slice(0, -1); render() })
    }
  }
  function persist() {
    if (context.preview) return
    try { localStorage.setItem(key, JSON.stringify(state)) } catch { status.textContent = 'Progress lasts for this visit only; browser storage is unavailable.' }
  }
  function render() {
    const best = new Map<string, TileState>()
    const ranks = { wrong: 1, almost: 2, right: 3 }
    cells.forEach((row, index) => {
      const guess = state.guesses[index] ?? (index === state.guesses.length ? input.value : '')
      const feedback = state.guesses[index] ? scoreGuess(guess) : undefined
      row.forEach((cell, column) => {
        const letter = guess[column] ?? ''
        const result = feedback?.[column]
        cell.dataset.state = result ?? 'empty'
        cell.setAttribute('aria-label', letter ? `${letter}: ${result === 'right' ? 'correct position' : result === 'almost' ? 'elsewhere' : result === 'wrong' ? 'absent' : 'unsubmitted'}` : 'Empty')
        glyph(cell, letter)
        if (letter && result && ranks[result] > (best.has(letter) ? ranks[best.get(letter)!] : 0)) best.set(letter, result)
      })
    })
    keyButtons.forEach((button, letter) => { glyph(button, letter); button.dataset.state = best.get(letter) ?? 'empty'; button.disabled = state.solved || state.guesses.length >= roundLimit })
    element.querySelector('[data-round]')!.textContent = `ROUND ${String(state.rounds).padStart(2, '0')} / ${state.guesses.length} OF 6`
    input.disabled = state.solved || state.guesses.length >= roundLimit
    submit.disabled = input.disabled || input.value.length !== 5
    retry.hidden = state.solved || state.guesses.length < roundLimit
    revisit.hidden = !state.solved
    revisit.disabled = opening
    form.hidden = state.solved
    keyboard.hidden = state.solved
  }
  async function enter() {
    if (!state.solved || opening || world) return
    opening = true; render(); status.textContent = 'Signal opening...'
    try {
      const module = await import('../mansion/world')
      if (disposed) return
      world = module.openMansion(audio, () => { world = undefined; status.textContent = 'Signal retained.'; input.focus() })
      status.textContent = 'Signal retained.'
    } catch { status.textContent = 'The gallery could not open. Check WebGL support, then retry.' }
    finally { opening = false; if (!disposed) render() }
  }
  form.addEventListener('submit', event => {
    event.preventDefault()
    try {
      state = submitGuess(state, input.value)
      input.value = ''
      status.textContent = state.solved ? 'Signal verified.' : state.guesses.length === roundLimit ? 'Signal unresolved. Another round is available.' : 'Guess recorded.'
      persist(); render()
      if (state.solved) {
        context.setReady(true)
        context.complete?.(glyphWord)
        element.classList.add('glyph-wordle--solved')
        timer = setTimeout(() => { void enter() }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900)
      }
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'Invalid guess.' }
  })
  input.addEventListener('input', () => { input.value = input.value.replace(/[^a-z]/gi, '').toUpperCase(); render() })
  retry.addEventListener('click', () => { state = retryWordle(state); input.value = ''; status.textContent = 'New round.'; persist(); render(); input.focus() })
  revisit.addEventListener('click', () => { context.complete?.(glyphWord); void enter() })
  context.setReady(state.solved)
  if (state.solved) status.textContent = 'Signal retained.'
  render()
  void loadGlyphAtlas(`${import.meta.env.BASE_URL}assets/characters.png`).then(value => { if (!disposed) { atlas = value; render() } }).catch(() => { if (!disposed) status.textContent = 'Glyph images unavailable. Letter input remains available.' })
  return { destroy() { disposed = true; clearTimeout(timer); world?.destroy(); element.replaceChildren() } }
}