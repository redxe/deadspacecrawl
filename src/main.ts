import '@fontsource/rajdhani/500.css'
import '@fontsource/rajdhani/600.css'
import '@fontsource/share-tech-mono/400.css'
import 'katex/dist/katex.min.css'
import './styles.css'
import './entry-experience.css'

import katex from 'katex'
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Lightbulb,
  Radio,
  RotateCcw,
  Send,
  TerminalSquare,
  Trash2,
  Wrench,
  X,
  createIcons,
} from 'lucide'
import { initializeConsole } from './console-panel'
import { loadGlyphAtlas, renderGlyphText } from './glyphs'
import { initializeGlyphFeedback } from './glyph-feedback'
import { publishedPuzzles } from './puzzles/library'
import { validatePuzzle } from './puzzles/catalog'
import { puzzleExtensions, validateExtensions } from './puzzles/extensions'
import { createEntryGate } from './entry-gate'
import { initializeEntryExperience } from './entry-experience'
import { initializeMusic } from './music-panel'
import { initializeTypingSounds } from './typing-sounds'
import { initializePuzzlePath } from './puzzle-path'
import { initializePlayfairWorkspace } from './playfair-workspace'
import { initializeQuantumWorkspace } from './quantum-workspace'
import { initializeFourierWorkspace, fourierStorageKey } from './fourier-workspace'
import { initializeSecretMessages } from './secret-messages'
import type { Puzzle, PuzzleBlock } from './puzzles/types'
import { answerMatches } from './puzzles/types'
import { initializeScene } from './scene'
import {
  clearPuzzleRecords,
  getPuzzleRecord,
  getPuzzleRecords,
  saveAttempt,
} from './storage'

const appRoot = document.querySelector<HTMLDivElement>('#app')

if (!appRoot) {
  throw new Error('Application root was not found.')
}

const app = appRoot
let previewPuzzle: Puzzle | undefined
if (import.meta.env.DEV && new URLSearchParams(location.search).has('preview')) {
  try {
    const candidate: unknown = JSON.parse(sessionStorage.getItem('signal-archive.authoring-preview.v1') ?? 'null')
    validatePuzzle(candidate)
    validateExtensions(candidate)
    previewPuzzle = candidate
  } catch {
    app.textContent = 'Preview unavailable. Return to the puzzle editor and launch a new preview.'
    throw new Error('Invalid authoring preview.')
  }
}
const entryGate = previewPuzzle ? { locked: false, puzzle: undefined, path: [], submit: (_value: string) => false } : createEntryGate()
const archivePuzzles = previewPuzzle ? [previewPuzzle] : publishedPuzzles
const archivePuzzle = archivePuzzles[0]
if (!archivePuzzle) throw new Error('The puzzle catalog must contain at least one visible puzzle.')
const completedThisVisit = new Set<string>()
const isCompleted = (id: string): boolean => completedThisVisit.has(id) || getPuzzleRecord(id)?.solved === true
const canOpenPuzzle = (id: string): boolean => {
  const index = archivePuzzles.findIndex(puzzle => puzzle.id === id)
  return !entryGate.locked && index >= 0 && archivePuzzles.slice(0, index).every(puzzle => isCompleted(puzzle.id))
}
let activePuzzle = entryGate.puzzle ?? archivePuzzle
try {
  const selected = localStorage.getItem('signal-archive.selected-puzzle.v1')
  if (!previewPuzzle && selected && canOpenPuzzle(selected)) activePuzzle = archivePuzzles.find(puzzle => puzzle.id === selected)!
} catch {}

document.title = `${activePuzzle.sequence} // ${activePuzzle.title}`
const escapeMarkup = (value: string): string => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

app.innerHTML = `
  <canvas class="void-scene" data-scene aria-hidden="true"></canvas>
  <div class="atmosphere" aria-hidden="true">
    <div class="atmosphere__scanlines"></div>
    <div class="atmosphere__vignette"></div>
  </div>

  <div class="app-shell">
    <header class="system-bar">
      <div class="system-brand">
        <span class="system-brand__mark"><i data-lucide="radio"></i></span>
        <span class="system-brand__name">SIGNAL ARCHIVE</span>
        <span class="system-brand__channel">PRIVATE RELAY / ${escapeMarkup(activePuzzle.sequence)}</span>
      </div>

      <div class="system-actions">
        <span class="link-state"><span class="link-state__pulse"></span>LINK STABLE</span>
        <button class="icon-text-button" type="button" data-open-archive ${entryGate.locked || previewPuzzle ? 'hidden disabled' : ''}>
          <i data-lucide="archive"></i>
          <span>Archive</span>
          <span class="archive-count" data-archive-count>0</span>
        </button>
      </div>
    </header>

    <main class="workspace">
      <aside class="mission-index" aria-label="Puzzle status">
        <span class="mission-index__eyebrow">ACTIVE SIGNAL</span>
        <strong class="mission-index__number">${escapeMarkup(activePuzzle.sequence.split(' / ')[0]!)}</strong>
        <span class="mission-index__kind">${escapeMarkup(activePuzzle.kind)}</span>
        <div class="mission-index__rule"></div>
        <span class="mission-index__status" data-mission-status>UNRESOLVED</span>
      </aside>

      <article class="puzzle-panel" data-puzzle-panel>
        <span class="corner corner--top-left" aria-hidden="true"></span>
        <span class="corner corner--top-right" aria-hidden="true"></span>
        <span class="corner corner--bottom-left" aria-hidden="true"></span>
        <span class="corner corner--bottom-right" aria-hidden="true"></span>

        <header class="puzzle-header">
          <div>
            <span class="puzzle-header__category">${activePuzzle.kind.toUpperCase()} PROTOCOL</span>
            <h1>${escapeMarkup(activePuzzle.title)}</h1>
            <p>${escapeMarkup(activePuzzle.summary)}</p>
          </div>
          <div class="signal-meter" aria-label="Signal strength: stable">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </header>

        <section class="objective-strip">
          <span>OBJECTIVE</span>
          <p>${escapeMarkup(activePuzzle.objective)}</p>
        </section>

        <section class="puzzle-content" data-puzzle-content></section>

        <form class="answer-form" data-answer-form novalidate>
          <label for="answer-input">${escapeMarkup(activePuzzle.answer.label)}</label>
          <div class="answer-control">
            <span class="answer-control__prompt" aria-hidden="true">&gt;</span>
            <input
              id="answer-input"
              name="answer"
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="${escapeMarkup(activePuzzle.answer.placeholder)}"
              data-answer-input
            />
            <button class="submit-button" type="submit">
              <i data-lucide="send"></i>
              <span>Transmit</span>
            </button>
          </div>
          <div class="answer-meta">
            <p class="answer-feedback" data-answer-feedback aria-live="polite"></p>
            <span data-attempt-count>0 ATTEMPTS</span>
          </div>
        </form>

        <div class="hint-dock">
          <button class="hint-button" type="button" data-hint-button>
            <i data-lucide="lightbulb"></i>
            <span>Decrypt hint</span>
          </button>
          <p class="hint-text" data-hint-text aria-live="polite"></p>
        </div>
      </article>
    </main>

    <footer class="system-footer">
      <span>CEC RELAY 7</span>
      <span>LOCAL RECORDING ENABLED</span>
      <span data-footer-clock>--:--:--</span>
    </footer>
  </div>

  <section class="console-panel console-panel--collapsed" data-console-panel aria-label="JavaScript console">
    <header class="console-header">
      <div><i data-lucide="terminal-square"></i><span>JAVASCRIPT CONSOLE</span></div>
      <button class="icon-button" type="button" title="Console tools" aria-label="Console tools" data-console-tools><i data-lucide="wrench"></i></button>
      <button
        class="icon-button"
        type="button"
        title="Expand console"
        aria-label="Expand console"
        aria-expanded="false"
        data-console-toggle
      >
        <i data-lucide="chevron-down"></i>
      </button>
    </header>
    <div class="console-output" data-console-output role="log" aria-live="polite"></div>
    <div class="console-input-row">
      <span aria-hidden="true">&gt;</span>
      <textarea
        rows="1"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        aria-label="JavaScript command"
        data-console-input
      ></textarea>
      <button class="icon-button console-run" type="button" title="Run command" aria-label="Run command" data-console-run>
        <i data-lucide="send"></i>
      </button>
    </div>
  </section>

  <dialog class="archive-dialog" data-archive-dialog>
    <div class="archive-dialog__shell">
      <header class="archive-dialog__header">
        <div>
          <span>SOLUTION RECORD</span>
          <h2>Signal Archive</h2>
        </div>
        <button class="icon-button" type="button" title="Close archive" aria-label="Close archive" data-close-archive>
          <i data-lucide="x"></i>
        </button>
      </header>
      <div class="archive-list" data-archive-list></div>
      <footer class="archive-dialog__footer">
        <button class="danger-button" type="button" data-clear-archive>
          <i data-lucide="trash-2"></i>
          <span>Erase local archive</span>
        </button>
      </footer>
    </div>
  </dialog>
`

function getRequiredElement<ElementType extends Element>(selector: string): ElementType {
  const element = app.querySelector<ElementType>(selector)
  if (!element) {
    throw new Error(`Required interface element is missing: ${selector}`)
  }
  return element
}

const puzzleContent = getRequiredElement<HTMLElement>('[data-puzzle-content]')
const answerForm = getRequiredElement<HTMLFormElement>('[data-answer-form]')
const answerInput = getRequiredElement<HTMLInputElement>('[data-answer-input]')
const answerFeedback = getRequiredElement<HTMLElement>('[data-answer-feedback]')
const attemptCount = getRequiredElement<HTMLElement>('[data-attempt-count]')
const missionStatus = getRequiredElement<HTMLElement>('[data-mission-status]')
const puzzlePanel = getRequiredElement<HTMLElement>('[data-puzzle-panel]')
const hintButton = getRequiredElement<HTMLButtonElement>('[data-hint-button]')
const hintText = getRequiredElement<HTMLElement>('[data-hint-text]')
const archiveDialog = getRequiredElement<HTMLDialogElement>('[data-archive-dialog]')
const archiveList = getRequiredElement<HTMLElement>('[data-archive-list]')
const archiveCount = getRequiredElement<HTMLElement>('[data-archive-count]')
const footerClock = getRequiredElement<HTMLElement>('[data-footer-clock]')
const consolePanel = getRequiredElement<HTMLElement>('[data-console-panel]')
const sceneCanvas = getRequiredElement<HTMLCanvasElement>('[data-scene]')

const cipherTargets: Array<{ element: HTMLElement; text: string }> = []
const glyphAtlas = loadGlyphAtlas(`${import.meta.env.BASE_URL}assets/characters.png`)
let playfairWorkspace: ReturnType<typeof initializePlayfairWorkspace> | undefined
let quantumWorkspace: ReturnType<typeof initializeQuantumWorkspace> | undefined
let fourierWorkspace: ReturnType<typeof initializeFourierWorkspace> | undefined
const customWorkspaces: Array<{ destroy: () => void }> = []
const blockReadiness = new Map<PuzzleBlock, boolean>()
function setBlockReady(block: PuzzleBlock, ready: boolean): void {
  blockReadiness.set(block, ready)
  const blocked = [...blockReadiness.values()].some(value => !value)
  answerInput.disabled = blocked
  getRequiredElement<HTMLButtonElement>('.submit-button').disabled = blocked
  answerInput.placeholder = blocked ? 'Complete the interactive blocks first' : activePuzzle.answer.placeholder
  glyphFeedback.refresh()
}
const glyphFeedback = initializeGlyphFeedback(
  answerInput,
  getRequiredElement<HTMLButtonElement>('.submit-button'),
  () => activePuzzle,
  () => [...cipherTargets, ...(playfairWorkspace?.getFeedbackTargets() ?? []), ...(quantumWorkspace?.getFeedbackTargets() ?? []), ...(fourierWorkspace?.getFeedbackTargets() ?? [])],
)

function renderBlock(block: PuzzleBlock): HTMLElement {
  if (block.type === 'custom') {
    setBlockReady(block, false)
    let mounted = true
    try {
      validateExtensions({ ...activePuzzle, blocks: [block] })
      const extension = puzzleExtensions.find(candidate => candidate.id === block.plugin)!
      const workspace = extension.mount(block.config, {
        puzzle: activePuzzle, preview: !!previewPuzzle,
        setReady: ready => { if (mounted) setBlockReady(block, ready) },
        complete: answer => { if (mounted) submitAnswer(answer) },
        audio: {
          setSpatial: state => musicController.setSpatial(state),
          resume: () => musicController.resume(),
          muted: () => musicController.muted,
          toggleMute: () => musicController.toggleMute(),
        },
      })
      customWorkspaces.push({ destroy: () => { mounted = false; workspace.destroy() } })
      return workspace.element
    } catch (error) {
      mounted = false
      setBlockReady(block, false)
      const message = document.createElement('p')
      message.className = 'answer-feedback answer-feedback--error'
      message.textContent = `Custom block unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`
      return message
    }
  }
  if (block.type === 'fourier') {
    fourierWorkspace = initializeFourierWorkspace(glyphAtlas, ready => {
      setBlockReady(block, ready)
    }, previewPuzzle ? null : activePuzzle.id === 'fourier-signal' ? fourierStorageKey : `${fourierStorageKey}.${activePuzzle.id}`)
    return fourierWorkspace.element
  }
  if (block.type === 'quantum') {
    quantumWorkspace = initializeQuantumWorkspace(glyphAtlas, ready => {
      setBlockReady(block, ready)
    }, previewPuzzle ? null : `signal-archive.quantum-work.v1${activePuzzle.id === 'quantum-relay' ? '' : `.${activePuzzle.id}`}`)
    return quantumWorkspace.element
  }
  if (block.type === 'playfair') {
    playfairWorkspace = initializePlayfairWorkspace(glyphAtlas, ready => {
      setBlockReady(block, ready)
    }, previewPuzzle ? null : `signal-archive.playfair-work.v1${activePuzzle.id === 'paired-signal' ? '' : `.${activePuzzle.id}`}`)
    return playfairWorkspace.element
  }
  if (block.type === 'divider') {
    const divider = document.createElement('div')
    divider.className = 'content-divider'
    const label = document.createElement('span')
    label.textContent = block.label
    divider.append(label)
    return divider
  }

  if (block.type === 'text') {
    const paragraph = document.createElement('p')
    paragraph.className = 'content-copy'
    paragraph.textContent = block.text
    return paragraph
  }

  if (block.type === 'code') {
    const pre = document.createElement('pre')
    pre.className = 'code-block'
    const code = document.createElement('code')
    code.textContent = block.code
    pre.append(code)
    return pre
  }

  if (block.type === 'formula') {
    const formula = document.createElement('div')
    formula.className = 'formula-block'
    katex.render(block.latex, formula, {
      displayMode: true,
      throwOnError: false,
      strict: 'warn',
      trust: false,
    })
    return formula
  }

  const cipher = document.createElement('div')
  cipher.className = 'cipher-block cipher-block--loading'
  cipher.setAttribute('aria-label', 'Encoded transmission')
  cipher.innerHTML = '<span class="cipher-loading">CALIBRATING GLYPH ARRAY</span>'
  cipherTargets.push({ element: cipher, text: block.text })
  return cipher
}

activePuzzle.blocks.forEach((block) => puzzleContent.append(renderBlock(block)))
answerForm.hidden = activePuzzle.blocks.some(block => block.type === 'custom' && block.plugin === 'glyph-wordle')

glyphAtlas
  .then((glyphs) => {
    cipherTargets.forEach(({ element, text }) => {
      element.classList.remove('cipher-block--loading')
      renderGlyphText(element, text, glyphs)
    })
    glyphFeedback.refresh()
  })
  .catch(() => {
    cipherTargets.forEach(({ element }) => {
      element.classList.add('cipher-block--error')
      element.textContent = 'GLYPH ARRAY UNAVAILABLE'
    })
  })

try {
  initializeScene(sceneCanvas)
} catch {
  document.documentElement.classList.add('webgl-unavailable')
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function updateArchiveCount(): void {
  archiveCount.textContent = String(
    getPuzzleRecords().filter((record) => record.solved).length,
  )
}

function renderArchive(): void {
  const records = getPuzzleRecords()
  archiveList.replaceChildren()

  if (records.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'archive-empty'
    empty.innerHTML = '<span>NO RECORDS</span><p>Decoded transmissions will be retained on this device.</p>'
    archiveList.append(empty)
    return
  }

  records.forEach((record) => {
    const entry = document.createElement('article')
    entry.className = `archive-entry${record.solved ? ' archive-entry--solved' : ''}`

    const heading = document.createElement('div')
    heading.className = 'archive-entry__heading'
    const identity = document.createElement('div')
    const sequence = document.createElement('span')
    sequence.textContent = `${record.sequence} / ${record.kind.toUpperCase()}`
    const title = document.createElement('h3')
    title.textContent = record.title
    identity.append(sequence, title)

    const state = document.createElement('span')
    state.className = 'archive-entry__state'
    state.textContent = record.solved ? 'VERIFIED' : 'OPEN'
    heading.append(identity, state)
    entry.append(heading)

    if (record.solvedAnswer && record.solvedAt) {
      const solution = document.createElement('div')
      solution.className = 'archive-entry__solution'
      const solutionLabel = document.createElement('span')
      solutionLabel.textContent = `SOLUTION / ${formatTimestamp(record.solvedAt)}`
      const solutionValue = document.createElement('p')
      solutionValue.textContent = record.solvedAnswer
      solution.append(solutionLabel, solutionValue)
      entry.append(solution)
    }

    const attempts = document.createElement('details')
    const summary = document.createElement('summary')
    summary.textContent = `${record.attempts.length} recorded attempt${record.attempts.length === 1 ? '' : 's'}`
    const attemptList = document.createElement('ol')
    record.attempts.slice().reverse().forEach((attempt) => {
      const item = document.createElement('li')
      item.className = attempt.correct ? 'attempt--correct' : ''
      const value = document.createElement('span')
      value.textContent = attempt.answer
      const time = document.createElement('time')
      time.dateTime = attempt.submittedAt
      time.textContent = formatTimestamp(attempt.submittedAt)
      item.append(value, time)
      attemptList.append(item)
    })
    attempts.append(summary, attemptList)
    entry.append(attempts)
    archiveList.append(entry)
  })
}

function applyRecordState(): void {
  if (entryGate.locked || previewPuzzle) return
  const record = getPuzzleRecord(activePuzzle.id)
  const attempts = record?.attempts.length ?? 0
  attemptCount.textContent = `${attempts} ATTEMPT${attempts === 1 ? '' : 'S'}`

  if (record?.solved) {
    missionStatus.textContent = 'VERIFIED'
    missionStatus.classList.add('mission-index__status--verified')
    puzzlePanel.classList.add('puzzle-panel--solved')
    answerFeedback.className = 'answer-feedback answer-feedback--success'
    answerFeedback.textContent = 'Transmission verified. Solution stored locally.'
    if (!answerInput.value && record.solvedAnswer) answerInput.value = record.solvedAnswer
  }
  glyphFeedback.refresh()
}

function submitAnswer(value: string): void {
  if (entryExperience.busy) return
  if ([...blockReadiness.values()].some(ready => !ready)) {
    answerFeedback.className = 'answer-feedback answer-feedback--error'
    answerFeedback.textContent = 'Complete the interactive blocks before submitting.'
    return
  }
  const answer = value.trim()
  if (!answer) {
    answerFeedback.className = 'answer-feedback answer-feedback--error'
    answerFeedback.textContent = 'No transmission entered.'
    answerInput.focus()
    return
  }

  answerInput.value = answer
  glyphFeedback.refresh(true)
  if (entryGate.locked) {
    if (!entryGate.submit(answer)) {
      answerFeedback.className = 'answer-feedback answer-feedback--error'
      answerFeedback.textContent = 'Seal unchanged. Recheck the recovered value or request a hint.'
      return
    }
    const advance = (): void => {
      activePuzzle = entryGate.puzzle ?? archivePuzzle
      refreshPuzzle()
      consoleController.setPuzzle(activePuzzle)
    }
    if (!entryGate.locked) entryExperience.celebrate(advance, () => musicController.unlock())
    else advance()
    return
  }
  const correct = answerMatches(activePuzzle, answer)
  if (previewPuzzle) {
    answerFeedback.className = `answer-feedback answer-feedback--${correct ? 'success' : 'error'}`
    answerFeedback.textContent = correct ? 'Preview answer verified. Player progress unchanged.' : 'Checksum mismatch. Recheck the signal.'
    return
  }
  const record = saveAttempt(activePuzzle, answer, correct)
  attemptCount.textContent = `${record.attempts.length} ATTEMPT${record.attempts.length === 1 ? '' : 'S'}`

  if (correct) {
    completedThisVisit.add(activePuzzle.id)
    missionStatus.textContent = 'VERIFIED'
    missionStatus.classList.add('mission-index__status--verified')
    puzzlePanel.classList.remove('puzzle-panel--rejected')
    puzzlePanel.classList.add('puzzle-panel--solved')
    answerFeedback.className = 'answer-feedback answer-feedback--success'
    answerFeedback.textContent = 'Transmission verified. Solution stored locally.'
  } else {
    puzzlePanel.classList.remove('puzzle-panel--rejected')
    window.requestAnimationFrame(() => puzzlePanel.classList.add('puzzle-panel--rejected'))
    answerFeedback.className = 'answer-feedback answer-feedback--error'
    answerFeedback.textContent = 'Checksum mismatch. Recheck the signal.'
  }

  updateArchiveCount()
}

answerForm.addEventListener('submit', (event) => {
  event.preventDefault()
  submitAnswer(answerInput.value)
})

let hintIndex = 0
function refreshPuzzle(): void {
  customWorkspaces.splice(0).forEach(workspace => workspace.destroy())
  blockReadiness.clear()
  fourierWorkspace?.destroy()
  fourierWorkspace = undefined
  quantumWorkspace?.destroy()
  quantumWorkspace = undefined
  playfairWorkspace?.destroy()
  playfairWorkspace = undefined
  answerInput.disabled = false
  getRequiredElement<HTMLButtonElement>('.submit-button').disabled = false
  document.title = `${activePuzzle.sequence} // ${activePuzzle.title}`
  app.querySelector('.system-brand__channel')!.textContent = `PRIVATE RELAY / ${activePuzzle.sequence}`
  app.querySelector('.mission-index__number')!.textContent = activePuzzle.sequence.split(' / ')[0]!
  app.querySelector('.mission-index__kind')!.textContent = activePuzzle.kind
  app.querySelector('.puzzle-header__category')!.textContent = `${activePuzzle.kind.toUpperCase()} PROTOCOL`
  app.querySelector('.puzzle-header h1')!.textContent = activePuzzle.title
  app.querySelector('.puzzle-header p')!.textContent = activePuzzle.summary
  app.querySelector('.objective-strip p')!.textContent = activePuzzle.objective
  answerForm.querySelector('label')!.textContent = activePuzzle.answer.label
  answerInput.placeholder = activePuzzle.answer.placeholder
  answerInput.value = ''
  answerInput.type = activePuzzle.id === 'entry-glyphs' ? 'password' : 'text'
  hintIndex = 0
  hintText.textContent = ''
  hintButton.querySelector('span')!.textContent = 'Decrypt hint'
  answerFeedback.className = 'answer-feedback answer-feedback--success'
  answerFeedback.textContent = entryGate.locked ? 'Seal verified. Next challenge ready.' : ''
  missionStatus.textContent = 'UNRESOLVED'
  missionStatus.classList.remove('mission-index__status--verified')
  puzzlePanel.classList.remove('puzzle-panel--solved', 'puzzle-panel--rejected')
  cipherTargets.length = 0
  puzzleContent.replaceChildren()
  activePuzzle.blocks.forEach(block => puzzleContent.append(renderBlock(block)))
  answerForm.hidden = activePuzzle.blocks.some(block => block.type === 'custom' && block.plugin === 'glyph-wordle')
  void glyphAtlas.then(glyphs => {
    cipherTargets.forEach(({ element, text }) => {
      element.classList.remove('cipher-block--loading')
      renderGlyphText(element, text, glyphs)
    })
    glyphFeedback.refresh()
  }).catch(() => cipherTargets.forEach(({ element }) => { element.textContent = 'GLYPH ARRAY UNAVAILABLE' }))
  glyphFeedback.refresh()
  const archiveButton = getRequiredElement<HTMLButtonElement>('[data-open-archive]')
  archiveButton.hidden = entryGate.locked || !!previewPuzzle
  archiveButton.disabled = entryGate.locked || !!previewPuzzle
  attemptCount.textContent = entryGate.locked ? 'ACCESS SEAL' : '0 ATTEMPTS'
  applyRecordState()
  answerInput.focus()
}
hintButton.addEventListener('click', () => {
  const hint = activePuzzle.hints[hintIndex % activePuzzle.hints.length]
  hintIndex += 1
  hintText.textContent = hint ?? ''
  hintButton.querySelector('span')!.textContent = hintIndex < activePuzzle.hints.length
    ? 'Next hint'
    : 'Cycle hints'
})

app.querySelector('[data-open-archive]')?.addEventListener('click', () => {
  if (entryGate.locked || previewPuzzle) return
  renderArchive()
  archiveDialog.showModal()
})

app.querySelector('[data-close-archive]')?.addEventListener('click', () => {
  archiveDialog.close()
})

app.querySelector('[data-clear-archive]')?.addEventListener('click', () => {
  if (previewPuzzle) return
  if (!window.confirm('Erase every locally saved solution and attempt?')) {
    return
  }

  clearPuzzleRecords()
  completedThisVisit.clear()
  activePuzzle = archivePuzzle
  try { localStorage.removeItem(fourierStorageKey) } catch {}
  try { localStorage.removeItem('signal-archive.selected-puzzle.v1'); localStorage.removeItem('signal-archive.playfair-work.v1'); localStorage.removeItem('signal-archive.quantum-work.v1') } catch {}
  refreshPuzzle()
  consoleController.setPuzzle(activePuzzle)
  renderArchive()
  updateArchiveCount()
  missionStatus.textContent = 'UNRESOLVED'
  missionStatus.classList.remove('mission-index__status--verified')
  puzzlePanel.classList.remove('puzzle-panel--solved')
  answerFeedback.className = 'answer-feedback'
  answerFeedback.textContent = ''
  attemptCount.textContent = '0 ATTEMPTS'
})

archiveDialog.addEventListener('click', (event) => {
  if (event.target === archiveDialog) archiveDialog.close()
})

const consoleController = initializeConsole(consolePanel, {
  puzzle: activePuzzle,
  onSubmit: submitAnswer,
})
const entryExperience = initializeEntryExperience(app, entryGate.locked)
const musicController = initializeMusic(app, !entryGate.locked)
initializeTypingSounds(app, musicController)
initializePuzzlePath(app, () => [
  ...entryGate.path,
  ...archivePuzzles.map(puzzle => ({ id: puzzle.id, title: puzzle.title, completed: isCompleted(puzzle.id), configured: true, reviewable: true })),
  ...Array.from({ length: 1 }, (_, index) => ({
    id: `upcoming-${index + archivePuzzles.length + 1}`, title: `Puzzle ${String(index + archivePuzzles.length + 1).padStart(2, '0')}`,
    completed: false, configured: false,
  })),
], id => {
  if (entryExperience.busy) return
  if (id === entryGate.puzzle?.id) { answerInput.focus(); return }
  if (!canOpenPuzzle(id)) return
  activePuzzle = archivePuzzles.find(puzzle => puzzle.id === id)!
  try { if (!previewPuzzle) localStorage.setItem('signal-archive.selected-puzzle.v1', id) } catch {}
  refreshPuzzle()
  consoleController.setPuzzle(activePuzzle)
})

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (!previewPuzzle) initializeSecretMessages(app, glyphAtlas)
if (import.meta.env.DEV) {
  const editorLink = document.createElement('a')
  editorLink.className = 'icon-text-button'
  editorLink.href = '?admin'
  editorLink.textContent = previewPuzzle ? 'Back to editor' : 'Puzzle editor'
  app.querySelector('.system-actions')!.prepend(editorLink)
}
if (!reducedMotion) {
  window.addEventListener('pointermove', (event) => {
    const horizontal = (event.clientX / window.innerWidth - 0.5) * 1.2
    const vertical = (event.clientY / window.innerHeight - 0.5) * -0.7
    puzzlePanel.style.setProperty('--panel-rotate-y', `${horizontal}deg`)
    puzzlePanel.style.setProperty('--panel-rotate-x', `${vertical}deg`)
  }, { passive: true })
}

const updateClock = (): void => {
  footerClock.textContent = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
}

window.setInterval(updateClock, 1000)
updateClock()
updateArchiveCount()
applyRecordState()
if (entryGate.locked) {
  attemptCount.textContent = 'ACCESS SEAL'
  answerInput.type = activePuzzle.id === 'entry-glyphs' ? 'password' : 'text'
}

createIcons({
  icons: {
    Archive,
    CheckCircle2,
    ChevronDown,
    Lightbulb,
    Radio,
    RotateCcw,
    Send,
    TerminalSquare,
    Trash2,
    Wrench,
    X,
  },
  attrs: {
    'stroke-width': 1.6,
    'aria-hidden': 'true',
  },
})