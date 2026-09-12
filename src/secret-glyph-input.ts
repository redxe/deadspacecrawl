import { tokenizeGlyphText, type GlyphAtlas, CHARACTER_KEYS } from './glyphs'
import { celebrateSecretMessage } from './secret-celebration'

export function secretGlyphWords(text: string) {
  return tokenizeGlyphText(text).map(line => {
    const words: { token: string; expected: string }[][] = [[]]
    let previousLetter = ''
    for (const token of line) {
      if (token === ' ') { words.push([]); previousLetter = ''; continue }
      const expected = token === 'dbl-letter' ? previousLetter : token.toUpperCase()
      words.at(-1)!.push({ token, expected })
      previousLetter = expected.slice(-1)
    }
    return words.filter(word => word.length)
  })
}

export function initializeSecretGlyphInput(host: HTMLElement, text: string, atlas: GlyphAtlas, saved: string[], onChange: (values: string[]) => void) {
  const inputs: HTMLInputElement[] = []
  const expected: string[] = []
  const tiles: HTMLElement[] = []
  const letters: HTMLElement[] = []
  let stopParticles = () => {}
  const status = document.createElement('p')
  status.className = 'secret-decode-status'; status.setAttribute('role', 'status')
  let initialized = false
  let celebrated = false
  delete host.dataset.celebrating
  delete host.dataset.decoded
  const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9?!]/g, '')
  function refresh() {
    let correct = 0, incorrect = 0
    inputs.forEach((input, index) => {
      const value = input.value
      const state = !value ? 'unanswered' : expected[index] === value ? 'correct' : expected[index]!.startsWith(value) ? 'partial' : 'incorrect'
      tiles[index]!.dataset.feedback = state
      letters[index]!.textContent = value
      input.setAttribute('aria-invalid', String(state === 'incorrect'))
      if (state === 'correct') correct++
      if (state === 'incorrect') incorrect++
    })
    const decoded = correct === inputs.length && inputs.length > 0
    host.dataset.decoded = String(decoded)
    if (decoded && !celebrated) {
      celebrated = true
      if (initialized) { host.dataset.celebrating = 'true'; stopParticles = celebrateSecretMessage(host) }
    }
    if (!decoded) { delete host.dataset.celebrating; stopParticles() }
    initialized = true
    status.textContent = decoded ? 'Transmission decoded.' : `${correct} / ${inputs.length} decoded${incorrect ? ` / ${incorrect} incorrect` : ''}`
    onChange(inputs.map(input => input.value))
  }
  function enter(index: number, value: string) {
    let remaining = normalize(value)
    let current = index
    while (current < inputs.length) {
      const length = expected[current]!.length
      inputs[current]!.value = remaining.slice(0, length)
      remaining = remaining.slice(length)
      if (inputs[current]!.value.length < length || current === inputs.length - 1) break
      current++
      if (!remaining) break
    }
    refresh()
    if (current !== index) { inputs[current]!.focus(); inputs[current]!.select() }
    else inputs[current]!.setSelectionRange(inputs[current]!.value.length, inputs[current]!.value.length)
  }
  for (const words of secretGlyphWords(text)) {
    const line = document.createElement('div'); line.className = 'secret-decode-line'
    for (const word of words) {
      const group = document.createElement('span'); group.className = 'secret-decode-word'
      for (const glyph of word) {
        const index = inputs.length
        const tile = document.createElement('span'); tile.className = 'secret-decode-tile'
        const image = document.createElement('img'); image.className = 'glyph'; image.alt = ''; image.src = atlas.get(glyph.token as typeof CHARACTER_KEYS[number])!
        const letter = document.createElement('span'); letter.className = 'secret-decoded-letter'; letter.setAttribute('aria-hidden', 'true')
        letter.style.setProperty('--iridescent-delay', `${-(index % 32) * .35}s`)
        const input = document.createElement('input'); input.type = 'text'; input.className = 'secret-glyph-input'; input.value = normalize(saved[index] ?? '').slice(0, glyph.expected.length)
        input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('autocapitalize', 'characters'); input.setAttribute('autocorrect', 'off')
        input.setAttribute('aria-label', `Glyph ${index + 1}, ${glyph.expected.length} character${glyph.expected.length === 1 ? '' : 's'}`)
        input.addEventListener('focus', () => input.select())
        input.addEventListener('input', event => { if (!(event as InputEvent).isComposing) enter(index, input.value) })
        input.addEventListener('compositionend', () => enter(index, input.value))
        input.addEventListener('paste', event => { event.preventDefault(); enter(index, event.clipboardData?.getData('text') ?? '') })
        input.addEventListener('keydown', event => {
          if (event.isComposing) return
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault(); inputs[Math.max(0, Math.min(inputs.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)))]!.focus()
          } else if (event.key === 'Backspace' && !input.value && index > 0) {
            event.preventDefault(); inputs[index - 1]!.value = ''; inputs[index - 1]!.focus(); refresh()
          } else if (event.key === 'Enter') { event.preventDefault(); inputs[Math.min(inputs.length - 1, index + 1)]!.focus() }
        })
        inputs.push(input); expected.push(glyph.expected); tiles.push(tile); letters.push(letter)
        tile.append(image, letter, input); group.append(tile)
      }
      line.append(group)
    }
    host.append(line)
  }
  host.append(status); refresh()
  return { destroy: () => { stopParticles() } }
}