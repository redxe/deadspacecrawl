import { Check, RotateCcw, createElement } from 'lucide'
import type { GlyphAtlas } from './glyphs'
import { getLetterFeedback } from './glyph-feedback'
import { decryptPlayfair, playfairAlphabet, playfairCiphertext, playfairKey, playfairPairsMatch, playfairSquareMatches } from './playfair'
import './playfair.css'

const storageKey = 'signal-archive.playfair-work.v1'

export function initializePlayfairWorkspace(atlas: Promise<GlyphAtlas>, onReady: (ready: boolean) => void) {
  const element = document.createElement('section')
  element.className = 'playfair-workspace'
  element.setAttribute('aria-label', 'Playfair workbench')
  let square = [...playfairAlphabet]
  let answers = Array<string>(36).fill('')
  let squareVerified = false
  let pairsVerified = false
  let selected: HTMLButtonElement | null = null
  let glyphs: GlyphAtlas | undefined
  let disposed = false
  let touchStart: { x: number; y: number } | undefined
  let dragPreview: HTMLElement | undefined
  const expectedPairs = decryptPlayfair(playfairCiphertext, playfairKey)
  const restoredLetters = [...expectedPairs].map((letter, index) => letter === 'X' && expectedPairs[index - 1] === expectedPairs[index + 1] ? '' : letter)
  restoredLetters.push('?')
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (Array.isArray(saved?.square) && saved.square.length === 25 && [...saved.square].sort().join('') === playfairAlphabet) square = saved.square
    if (Array.isArray(saved?.answers) && saved.answers.length === 36 && saved.answers.every((value: unknown) => typeof value === 'string' && (value === '' || playfairAlphabet.includes(value) && value.length === 1))) answers = saved.answers
    squareVerified = saved?.squareVerified === true && playfairSquareMatches(square)
    pairsVerified = squareVerified && saved?.pairsVerified === true && playfairPairsMatch(pairAnswers())
  } catch {}

  element.innerHTML = `
    <details class="playfair-reference">
      <summary>Field manual / Playfair &amp; glyph reference</summary>
      <p>Playfair hides two letters at a time in a 5 by 5 square. Here, every tile is one letter: I also represents J. TH, SS, and double-letter shorthand are not used.</p>
      <ol>
        <li>Recover the keyword from the log. Keep its first occurrence of each letter, then append unused letters alphabetically, omitting J. Fill rows from left to right.</li>
        <li>Read the intercepted glyphs in the fixed pairs shown. Find each pair in your square.</li>
        <li>Same row: take the glyph immediately LEFT of each, wrapping to the row's end.</li>
        <li>Same column: take the glyph immediately ABOVE each, wrapping to the bottom.</li>
        <li>Different rows and columns: form a rectangle. Keep each glyph's row, but use the other glyph's column. Keep pair order.</li>
      </ol>
      <p>Before encryption, spaces and punctuation were removed. Repeated letters within a pair were split with X. A final unpaired letter would receive Z. Keep these letters in your worksheet; decide which are padding only when restoring the sentence.</p>
      <details><summary>Worked practice / a different key</summary>
        <p>This practice square uses PLAYFAIR EXAMPLE, not the transmission's key.</p>
        <pre class="playfair-example">P L A Y F\nI R E X M\nB C D G H\nK N O Q S\nT U V W Z</pre>
        <p>BM becomes HI (rectangle). OD becomes DE (move up). LA becomes PL (move left). Each letter keeps its original place in the pair.</p>
      </details>
      <details><summary>Glyph chart / one tile per letter</summary><div class="playfair-chart" data-chart></div></details>
      <p><a href="https://en.wikipedia.org/wiki/Playfair_cipher" target="_blank" rel="noopener noreferrer">Playfair history and rules</a></p>
    </details>
    <section class="playfair-stage">
      <h3>01 / Recover the key square</h3>
      <div class="playfair-key-layout"><div>
      <p>The log's beginnings carry a light through the dark:</p>
      <blockquote class="playfair-log">Low power. Keep the relay awake.<br>A signal crosses the empty deck.<br>No voice accompanies it.<br>The first marks remain intact.<br>Each line preserves its beginning.<br>Read what the silence leaves.<br>Nothing else is needed for the key.</blockquote>
      <p>Drag glyphs onto other cells to swap them. On touch screens, drag a tile or tap a source and destination. Keyboard: focus a tile, press Enter to select it, then Enter on its destination. Escape cancels selection.</p>
      </div><div>
      <div class="playfair-square" role="group" aria-label="Draggable 5 by 5 key square" data-square></div>
      <div class="playfair-actions"><button type="button" class="icon-text-button" data-check-square>Check square</button><button type="button" class="icon-button" title="Reset Playfair work" aria-label="Reset Playfair work" data-reset></button></div>
      <p class="playfair-status" role="status" data-square-status></p>
      </div></div>
    </section>
    <fieldset class="playfair-stage" data-pair-stage>
      <legend>02 / Decipher the pairs</legend>
      <p>Drag or select a glyph from the reusable tray, then place it in a recovered slot. Work through the pairs in order. Select a pair to mark its two encrypted positions in the square; the marks do not indicate the answer. Double-click a recovered slot, or press Delete there, to clear it.</p>
      <div class="playfair-decoding-layout"><aside class="playfair-tools">
      <details class="playfair-square-reference" open><summary>Your verified square</summary><div class="playfair-reference-square" role="group" aria-label="Verified key square reference" data-reference-square></div></details>
      <div class="playfair-tray" role="group" aria-label="Reusable glyph tray" data-tray></div>
      </aside><div>
      <div class="playfair-pairs" data-pairs></div>
      <button type="button" class="icon-text-button" data-check-pairs>Check pairs</button>
      <p class="playfair-status" role="status" data-pairs-status></p>
      </div></div>
    </fieldset>
    <section class="playfair-stage" data-restore>
      <h3>03 / Restore the transmission</h3>
      <p data-restore-status>Locked / Verify the square and all recovered pairs.</p>
      <div class="playfair-recovered" aria-label="Your verified recovered glyphs" data-recovered></div>
    </section>
    <p class="playfair-status" role="status" data-drag-status></p>`

  const find = <ElementType extends HTMLElement>(selector: string) => element.querySelector<ElementType>(selector)!
  const squareHost = find('[data-square]')
  const tray = find('[data-tray]')
  const pairHost = find('[data-pairs]')
  const pairStage = find<HTMLFieldSetElement>('[data-pair-stage]')
  const squareStatus = find('[data-square-status]')
  const pairsStatus = find('[data-pairs-status]')
  const dragStatus = find('[data-drag-status]')
  if (window.matchMedia('(max-width: 420px)').matches) find<HTMLDetailsElement>('.playfair-square-reference').open = false

  function pairAnswers() { return Array.from({ length: 18 }, (_, index) => answers.slice(index * 2, index * 2 + 2).join('')) }
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify({ square, answers, squareVerified, pairsVerified })) } catch {}
  }
  function drawGlyph(target: HTMLElement, letter: string) {
    target.replaceChildren()
    if (!letter) return
    const source = glyphs?.get(letter as 'A')
    if (source) {
      const image = document.createElement('img')
      image.src = source
      image.alt = ''
      image.draggable = false
      target.append(image)
    } else target.textContent = glyphs ? '?' : '...'
  }
  function cancelSelection() {
    selected?.classList.remove('playfair-tile--selected')
    selected?.setAttribute('aria-pressed', 'false')
    selected = null
  }
  function select(tile: HTMLButtonElement) {
    cancelSelection()
    selected = tile
    tile.classList.add('playfair-tile--selected')
    tile.setAttribute('aria-pressed', 'true')
    dragStatus.textContent = `${tile.getAttribute('aria-label')} selected. Choose a destination.`
  }
  function place(source: HTMLButtonElement, target: HTMLButtonElement) {
    const sourceKind = source.dataset.kind
    const targetKind = target.dataset.kind
    if (source === target) { cancelSelection(); return }
    if (sourceKind === 'square' && targetKind === 'square' && !squareVerified) {
      const from = Number(source.dataset.index)
      const to = Number(target.dataset.index)
      ;[square[from], square[to]] = [square[to]!, square[from]!]
      squareStatus.textContent = 'Square changed. Check it when all rows are arranged.'
    } else if ((sourceKind === 'tray' || sourceKind === 'answer') && targetKind === 'answer' && squareVerified && !pairsVerified) {
      const letter = sourceKind === 'tray' ? source.dataset.letter! : answers[Number(source.dataset.index)]!
      if (!letter) return
      answers[Number(target.dataset.index)] = letter
      pairsStatus.textContent = ''
    } else { select(target); return }
    cancelSelection()
    persist()
    render()
    dragStatus.textContent = 'Glyph placed.'
    const replacement = element.querySelector<HTMLButtonElement>(`[data-kind="${targetKind}"][data-index="${target.dataset.index}"]`)
    replacement?.focus({ preventScroll: true })
  }
  function tile(letter: string, kind: string, index: number) {
    let ignoreClick = false
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'playfair-tile'
    button.dataset.kind = kind
    button.dataset.index = String(index)
    button.dataset.letter = letter
    button.draggable = !!letter && !(kind === 'square' && squareVerified) && !pairsVerified
    button.setAttribute('aria-pressed', 'false')
    button.setAttribute('aria-label', kind === 'square' ? `Row ${Math.floor(index / 5) + 1}, column ${index % 5 + 1}: ${letter === 'I' ? 'I or J' : letter}` : kind === 'answer' ? `Pair ${Math.floor(index / 2) + 1}, recovered glyph ${index % 2 + 1}: ${letter || 'empty'}` : `Glyph ${letter === 'I' ? 'I or J' : letter}`)
    button.title = button.getAttribute('aria-label')!
    drawGlyph(button, letter)
    if (kind === 'answer') {
      const feedback = getLetterFeedback([expectedPairs[index]!], letter)[0]!
      button.dataset.feedback = feedback.state
      button.setAttribute('aria-invalid', String(feedback.state === 'incorrect'))
      const image = button.querySelector('img')
      if (image) { image.className = 'glyph'; image.dataset.feedback = feedback.state }
    }
    button.addEventListener('click', () => {
      if (ignoreClick) { ignoreClick = false; return }
      if (kind === 'square' && squareVerified || pairsVerified && kind !== 'square') return
      if (selected) place(selected, button)
      else select(button)
    })
    button.addEventListener('dragstart', event => event.preventDefault())
    button.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || !button.draggable) return
      touchStart = { x: event.clientX, y: event.clientY }
      button.setPointerCapture(event.pointerId)
    })
    button.addEventListener('pointermove', event => {
      if (!touchStart || Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) <= 8) return
      if (!dragPreview) {
        dragPreview = document.createElement('div')
        dragPreview.className = 'playfair-drag-preview'
        dragPreview.setAttribute('aria-hidden', 'true')
        drawGlyph(dragPreview, letter)
        document.body.append(dragPreview)
      }
      dragPreview.style.left = `${event.clientX}px`
      dragPreview.style.top = `${event.clientY}px`
    })
    button.addEventListener('pointerup', event => {
      if (!touchStart) return
      const moved = Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) > 8
      touchStart = undefined
      dragPreview?.remove()
      dragPreview = undefined
      if (!moved) return
      ignoreClick = true
      const destination = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>('.playfair-tile')
      if (destination && element.contains(destination)) place(button, destination)
    })
    button.addEventListener('pointercancel', () => { touchStart = undefined; dragPreview?.remove(); dragPreview = undefined })
    const clear = () => {
      if (kind !== 'answer' || pairsVerified) return
      answers[index] = ''
      cancelSelection()
      persist()
      render()
      find<HTMLButtonElement>(`[data-kind="answer"][data-index="${index}"]`).focus({ preventScroll: true })
    }
    button.addEventListener('dblclick', clear)
    button.addEventListener('keydown', event => {
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); clear() }
    })
    return button
  }
  function render() {
    squareHost.replaceChildren(...square.map((letter, index) => tile(letter, 'square', index)))
    const reference = find('[data-reference-square]')
    reference.replaceChildren()
    if (squareVerified) square.forEach((letter, index) => {
      const glyph = document.createElement('span')
      glyph.dataset.letter = letter
      glyph.setAttribute('role', 'img')
      glyph.setAttribute('aria-label', `Row ${Math.floor(index / 5) + 1}, column ${index % 5 + 1}: ${letter}`)
      drawGlyph(glyph, letter)
      reference.append(glyph)
    })
    tray.replaceChildren(...[...playfairAlphabet].map((letter, index) => tile(letter, 'tray', index)))
    pairHost.replaceChildren()
    playfairCiphertext.split(' ').forEach((pair, index) => {
      const group = document.createElement('div')
      group.className = 'playfair-pair'
      const inspect = document.createElement('button')
      inspect.type = 'button'
      inspect.className = 'playfair-pair-source'
      inspect.setAttribute('aria-label', `Inspect encrypted pair ${index + 1}: ${pair.split('').join(', ')}`)
      const number = document.createElement('span')
      number.textContent = String(index + 1).padStart(2, '0')
      inspect.append(number)
      for (const letter of pair) {
        const glyph = document.createElement('span')
        drawGlyph(glyph, letter)
        inspect.append(glyph)
      }
      inspect.addEventListener('click', () => {
        squareHost.querySelectorAll<HTMLElement>('.playfair-tile').forEach(cell => cell.classList.toggle('playfair-tile--source', pair.includes(cell.dataset.letter!)))
        reference.querySelectorAll<HTMLElement>('[data-letter]').forEach(cell => cell.classList.toggle('playfair-tile--source', pair.includes(cell.dataset.letter!)))
        dragStatus.textContent = `Pair ${index + 1} marked in the square. Compare its rows and columns.`
      })
      const slots = document.createElement('div')
      slots.className = 'playfair-pair-slots'
      slots.append(tile(answers[index * 2]!, 'answer', index * 2), tile(answers[index * 2 + 1]!, 'answer', index * 2 + 1))
      group.append(inspect, slots)
      pairHost.append(group)
    })
    pairStage.disabled = !squareVerified
    find<HTMLButtonElement>('[data-check-square]').disabled = squareVerified
    find<HTMLButtonElement>('[data-check-pairs]').disabled = pairsVerified
    squareStatus.textContent = squareVerified ? 'Square verified. Pair worksheet unlocked.' : squareStatus.textContent
    pairsStatus.textContent = pairsVerified ? 'All pairs verified. Restore the sentence below.' : pairsStatus.textContent
    find('[data-restore-status]').textContent = pairsVerified ? 'Read your recovered glyphs below. Remove only inserted separators or final padding; restore word boundaries and the question mark. Submit the sentence in the transmission field.' : 'Locked / Verify the square and all recovered pairs.'
    const recovered = find('[data-recovered]')
    recovered.replaceChildren()
    if (pairsVerified) [...answers, '?'].forEach(letter => {
      const glyph = document.createElement('span')
      glyph.setAttribute('role', 'img')
      glyph.setAttribute('aria-label', letter)
      drawGlyph(glyph, letter)
      glyph.querySelector('img')?.classList.add('glyph')
      recovered.append(glyph)
    })
    onReady(pairsVerified)
  }
  find('[data-check-square]').prepend(createElement(Check))
  find('[data-check-pairs]').prepend(createElement(Check))
  find('[data-reset]').append(createElement(RotateCcw))
  find('[data-check-square]').addEventListener('click', () => {
    squareVerified = playfairSquareMatches(square)
    squareStatus.textContent = squareVerified ? 'Square verified.' : 'Square not verified. Recheck the key, duplicate removal, I/J, and left-to-right fill order.'
    cancelSelection()
    persist()
    render()
  })
  find('[data-check-pairs]').addEventListener('click', () => {
    pairsVerified = playfairPairsMatch(pairAnswers())
    pairsStatus.textContent = pairsVerified ? 'Pairs verified.' : answers.includes('') ? 'Some recovered slots are empty.' : 'Worksheet not verified. Recheck pair order, direction, wrapping, and rectangle columns. Keep filler letters for now.'
    cancelSelection()
    persist()
    render()
  })
  find('[data-reset]').addEventListener('click', () => {
    if (!window.confirm('Reset the key square and recovered pairs? Saved final solutions will not be erased.')) return
    square = [...playfairAlphabet]
    answers = Array<string>(36).fill('')
    squareVerified = pairsVerified = false
    cancelSelection()
    squareStatus.textContent = pairsStatus.textContent = dragStatus.textContent = ''
    persist()
    render()
  })
  element.addEventListener('keydown', event => {
    if (event.key === 'Escape') { cancelSelection(); touchStart = undefined; dragPreview?.remove(); dragPreview = undefined; dragStatus.textContent = 'Selection cancelled.' }
  })
  render()
  void atlas.then(loaded => {
    if (disposed) return
    glyphs = loaded
    const chart = find('[data-chart]')
    for (const letter of playfairAlphabet) {
      const entry = document.createElement('div')
      const glyph = document.createElement('span')
      drawGlyph(glyph, letter)
      const label = document.createElement('span')
      label.textContent = letter === 'I' ? 'I/J' : letter
      entry.append(glyph, label)
      chart.append(entry)
    }
    render()
  }).catch(() => { if (!disposed) dragStatus.textContent = 'Glyph chart unavailable. Reload to retry; accessible tile labels remain available.' })
  return {
    element,
    get ready() { return pairsVerified },
    getFeedbackTargets: () => pairsVerified ? [{ element: find('[data-recovered]'), text: '', letters: restoredLetters }] : [],
    destroy: () => { disposed = true; cancelSelection(); dragPreview?.remove(); element.remove() },
  }
}