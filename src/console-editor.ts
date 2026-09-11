import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'

hljs.registerLanguage('javascript', javascript)

const EXAMPLES = ['factor(360)', 'primes(17)', 'primes(1, 12)', 'isPrime(97)', 'gcd(84, 126)', 'puzzle.data', 'help()', 'help("primes")']
const COMPLETIONS = [
  ...EXAMPLES, 'tools()', 'tools("relay")', 'relay(puzzle.data.encoded, true)', 'unpack(puzzle.data.packed)', 'bits(puzzle.data.packed)', 'glyphs()', 'pack([0, 1, 2])', 'answer("")', 'clear()', 'console.log()',
  'Math.sqrt()', 'Math.pow()', 'Math.PI', 'Math.round()',
  'const ', 'let ', 'function ', 'return ', 'Array.from()',
]

export function highlightCommand(code: string): string {
  return hljs.highlight(code, { language: 'javascript', ignoreIllegals: true }).value
}

export function initializeConsoleEditor(
  input: HTMLTextAreaElement,
  getHistory: () => string[],
): { refresh: () => void } {
  const editor = document.createElement('div')
  editor.className = 'console-editor'
  input.before(editor)

  const paint = document.createElement('pre')
  paint.className = 'console-editor__paint'
  paint.setAttribute('aria-hidden', 'true')
  const syntax = document.createElement('span')
  const ghost = document.createElement('span')
  ghost.className = 'console-editor__ghost'
  paint.append(syntax, ghost)
  editor.append(paint, input)
  input.setAttribute('aria-description', 'JavaScript input. Tab accepts a suggested completion. Shift Enter inserts a new line.')

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  let exampleIndex = 0
  let visibleLength = 0
  let pauseTicks = 0
  let deleting = false
  let suggestion = ''
  let dismissedValue: string | undefined
  let composing = false

  const syncScroll = (): void => {
    paint.scrollTop = input.scrollTop
    paint.scrollLeft = input.scrollLeft
  }

  const refresh = (): void => {
    syntax.innerHTML = highlightCommand(input.value)
    suggestion = ''
    if (input.value && dismissedValue !== input.value && !composing &&
      input.selectionStart === input.value.length && input.selectionEnd === input.value.length) {
      suggestion = [...getHistory().slice().reverse(), ...COMPLETIONS]
        .find((candidate) => candidate.startsWith(input.value) && candidate.length > input.value.length) ?? ''
    }

    const example = EXAMPLES[exampleIndex] ?? EXAMPLES[0]!
    ghost.textContent = input.value
      ? suggestion.slice(input.value.length)
      : (reducedMotion.matches ? example : example.slice(0, visibleLength))
    ghost.classList.toggle('console-editor__ghost--example', !input.value)
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 112)}px`
    syncScroll()
  }

  input.addEventListener('input', () => {
    dismissedValue = undefined
    refresh()
  })
  input.addEventListener('scroll', syncScroll)
  input.addEventListener('click', refresh)
  input.addEventListener('keyup', refresh)
  input.addEventListener('compositionstart', () => { composing = true; refresh() })
  input.addEventListener('compositionend', () => { composing = false; refresh() })
  input.addEventListener('keydown', (event) => {
    if (composing || event.isComposing) return
    if (event.key === 'Escape') {
      dismissedValue = input.value
      refresh()
    }
    if (event.key === 'Tab' && !event.shiftKey && suggestion) {
      event.preventDefault()
      input.value = suggestion
      input.setSelectionRange(input.value.length, input.value.length)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })

  const timer = window.setInterval(() => {
    if (!input.isConnected) {
      window.clearInterval(timer)
      return
    }
    if (input.value || document.hidden || input.closest('.console-panel--collapsed') || reducedMotion.matches) return
    if (pauseTicks > 0) { pauseTicks -= 1; return }
    const example = EXAMPLES[exampleIndex] ?? EXAMPLES[0]!
    visibleLength += deleting ? -1 : 1
    if (visibleLength >= example.length) { deleting = true; pauseTicks = 24 }
    if (visibleLength <= 0) {
      deleting = false
      exampleIndex = (exampleIndex + 1) % EXAMPLES.length
      pauseTicks = 6
    }
    refresh()
  }, 85)

  new ResizeObserver(refresh).observe(editor)
  reducedMotion.addEventListener('change', refresh)
  refresh()
  return { refresh }
}