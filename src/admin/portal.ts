import '@fontsource/rajdhani/500.css'
import '@fontsource/rajdhani/600.css'
import '@fontsource/share-tech-mono/400.css'
import './portal.css'
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, Download, Eye, Plus, Radio, RotateCcw, Save, Trash2, Upload, createElement } from 'lucide'
import { builtinPuzzles } from '../puzzles/library'
import { compactCatalog, emptyCatalog, makeBlock, parseCatalog, resolveCatalog, validatePuzzle } from '../puzzles/catalog'
import type { PuzzleCatalog } from '../puzzles/catalog'
import { puzzleExtensions, validateExtensions } from '../puzzles/extensions'
import type { Puzzle, PuzzleBlock } from '../puzzles/types'

const draftKey = 'signal-archive.authoring-draft.v1'
const endpoint = `${import.meta.env.BASE_URL}__authoring/catalog`
type Icon = Parameters<typeof createElement>[0]
type Tab = 'Details' | 'Blocks' | 'Answers' | 'Console data'
const blockNames: Record<PuzzleBlock['type'], string> = { text: 'Text', cipher: 'Glyph transmission', formula: 'Formula', code: 'Code display', divider: 'Divider', playfair: 'Playfair preset', quantum: 'Quantum preset', fourier: 'Fourier / RSA preset', custom: 'Custom block' }

function node<Tag extends keyof HTMLElementTagNameMap>(tag: Tag, className = '', text?: string): HTMLElementTagNameMap[Tag] {
  const element = document.createElement(tag)
  element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

function button(label: string, icon: Icon, action: () => void, compact = false): HTMLButtonElement {
  const element = node('button', compact ? 'studio-icon' : 'studio-button')
  element.type = 'button'
  element.title = label
  element.setAttribute('aria-label', label)
  element.append(createElement(icon))
  if (!compact) element.append(node('span', '', label))
  element.addEventListener('click', action)
  return element
}

function select(label: string, options: Array<[string, string]>, value: string, change: (value: string) => void): HTMLSelectElement {
  const element = node('select')
  element.setAttribute('aria-label', label)
  options.forEach(([key, title]) => element.add(new Option(title, key)))
  element.value = value
  element.addEventListener('change', () => change(element.value))
  return element
}

export async function initializePortal(): Promise<void> {
  document.title = 'Puzzle Editor // Signal Archive'
  const app = document.querySelector<HTMLElement>('#app')!
  app.className = 'studio'
  app.innerHTML = `
    <header class="studio-header"><a class="studio-brand" href="./" aria-label="Back to Signal Archive"></a><div class="studio-identity"><span>SIGNAL ARCHIVE / LOCAL AUTHORING</span><h1>Puzzle Editor</h1></div><a class="studio-back" href="./">Back to site</a></header>
    <div class="studio-toolbar" aria-label="Catalog actions"></div>
    <p class="studio-status" role="status" aria-live="polite">Loading published catalog...</p>
    <div class="studio-layout"><aside class="studio-library" aria-label="Puzzle library"><header><h2>Library</h2><span data-count></span></header><div class="studio-filters"></div><ol class="studio-list"></ol></aside>
    <main class="studio-editor"><header class="studio-editor-header"><div><span data-sequence></span><h2 data-title></h2></div><div class="studio-puzzle-actions"></div></header><nav class="studio-tabs" aria-label="Puzzle sections"></nav><form class="studio-form" novalidate></form></main></div>
    <input type="file" accept="application/json,.json" hidden data-import>
  `
  app.querySelector('.studio-brand')!.append(createElement(Radio))
  app.querySelector('.studio-back')!.prepend(createElement(ArrowLeft))
  const toolbar = app.querySelector<HTMLElement>('.studio-toolbar')!
  const status = app.querySelector<HTMLElement>('.studio-status')!
  const list = app.querySelector<HTMLOListElement>('.studio-list')!
  const form = app.querySelector<HTMLFormElement>('.studio-form')!
  const tabs = app.querySelector<HTMLElement>('.studio-tabs')!
  const puzzleActions = app.querySelector<HTMLElement>('.studio-puzzle-actions')!
  const fileInput = app.querySelector<HTMLInputElement>('[data-import]')!
  const layout = app.querySelector<HTMLElement>('.studio-layout')!
  let catalog = emptyCatalog()
  let revision = ''
  let token = ''
  let selectedId = ''
  let tab: Tab = 'Details'
  let search = ''
  let filter = 'all'
  let dirty = false
  let loaded = false
  let busy = false

  const tell = (message: string, error = false) => {
    status.textContent = message
    status.classList.toggle('studio-status--error', error)
  }
  const selected = () => catalog.puzzles.find(puzzle => puzzle.id === selectedId)
  const validForm = () => form.reportValidity()
  const run = (operation: () => void) => {
    try { if (validForm()) operation() } catch (error) { tell(error instanceof Error ? error.message : 'Operation failed.', true) }
  }
  const change = () => {
    dirty = true
    tell('Unsaved draft changes')
    renderList()
    app.querySelector('[data-title]')!.textContent = selected()?.title || 'Untitled puzzle'
  }
  const materialize = (source: PuzzleCatalog) => ({ ...source, puzzles: resolveCatalog(builtinPuzzles, source, true), order: resolveCatalog(builtinPuzzles, source, true).map(puzzle => puzzle.id) })

  function saveDraft(announce = true): void {
    parseCatalog(catalog, true)
    localStorage.setItem(draftKey, JSON.stringify({ catalog, revision, selectedId }))
    dirty = false
    if (announce) tell('Draft saved on this device. Published catalog unchanged.')
  }

  async function load(recover: boolean): Promise<void> {
    setBusy(true)
    try {
      const response = await fetch(endpoint, { cache: 'no-store' })
      if (!response.ok) throw new Error('The local authoring API is unavailable. Open this editor on localhost using npm run dev.')
      const result = await response.json()
      catalog = materialize(parseCatalog(result.catalog))
      revision = result.revision
      token = result.token
      tell('Published catalog loaded')
      if (recover) {
        let saved: string | null = null
        try { saved = localStorage.getItem(draftKey) } catch { tell('Browser storage is unavailable. Export drafts to keep a backup.', true) }
        if (saved) {
          try {
            const draft = JSON.parse(saved)
            catalog = materialize(parseCatalog(draft.catalog, true))
            selectedId = draft.selectedId
            if (draft.revision !== revision) tell('Recovered draft conflicts with the published catalog. Export it before reloading published content.', true)
            else tell('Saved local draft recovered')
            revision = draft.revision
          } catch { tell('Saved draft is invalid. Published catalog loaded; the stored draft has not been removed.', true) }
        }
      }
      if (!recover) {
        try { localStorage.removeItem(draftKey) } catch {}
      }
      selectedId = selected()?.id ?? catalog.puzzles[0]?.id ?? ''
      loaded = true
      dirty = false
      renderList()
      renderEditor()
    } catch (error) { tell(error instanceof Error ? error.message : 'Unable to load the catalog.', true) }
    finally { setBusy(false) }
  }

  function setBusy(value: boolean): void {
    busy = value
    layout.inert = busy || !loaded
    toolbar.querySelectorAll('button, select').forEach(element => { (element as HTMLButtonElement).disabled = busy || (!loaded && element !== reloadButton) })
  }

  function field(label: string, value: string, update: (value: string) => void, multiline = false): HTMLLabelElement {
    const wrapper = node('label', 'studio-field')
    wrapper.append(node('span', '', label))
    const control = multiline ? node('textarea') : node('input')
    control.value = value
    control.spellcheck = multiline
    if (control instanceof HTMLTextAreaElement) control.rows = 4
    control.addEventListener('input', () => { update(control.value); change() })
    wrapper.append(control)
    return wrapper
  }

  function renderList(): void {
    list.replaceChildren()
    app.querySelector('[data-count]')!.textContent = `${catalog.puzzles.filter(puzzle => !catalog.hidden.includes(puzzle.id)).length} on website`
    catalog.puzzles.forEach((puzzle, index) => {
      const hidden = catalog.hidden.includes(puzzle.id)
      if (filter === 'visible' && hidden || filter === 'hidden' && !hidden || !`${puzzle.title} ${puzzle.id} ${puzzle.kind}`.toLowerCase().includes(search.toLowerCase())) return
      const item = node('li', `studio-library-item${puzzle.id === selectedId ? ' is-selected' : ''}`)
      const open = node('button', 'studio-puzzle-link')
      open.type = 'button'
      open.setAttribute('aria-current', String(puzzle.id === selectedId))
      open.append(node('span', 'studio-list-sequence', String(index + 1).padStart(2, '0')), node('strong', '', puzzle.title || 'Untitled puzzle'), node('small', '', hidden ? 'Hidden' : puzzle.kind))
      open.addEventListener('click', () => run(() => { selectedId = puzzle.id; renderList(); renderEditor() }))
      const moves = node('div', 'studio-row-actions')
      for (const [offset, icon, name] of [[-1, ArrowUp, 'Move up'], [1, ArrowDown, 'Move down']] as const) {
        const move = button(`${name}: ${puzzle.title}`, icon, () => run(() => {
          const target = index + offset
          ;[catalog.puzzles[index], catalog.puzzles[target]] = [catalog.puzzles[target]!, puzzle]
          catalog.order = catalog.puzzles.map(entry => entry.id)
          change()
        }), true)
        move.disabled = index + offset < 0 || index + offset >= catalog.puzzles.length
        moves.append(move)
      }
      item.append(open, moves)
      list.append(item)
    })
    if (!list.childElementCount) list.append(node('li', 'studio-empty', 'No matching puzzles'))
  }

  function renderEditor(): void {
    const puzzle = selected()
    form.replaceChildren()
    tabs.replaceChildren()
    puzzleActions.replaceChildren()
    if (!puzzle) { form.append(node('p', 'studio-empty', 'No puzzle selected')); return }
    app.querySelector('[data-sequence]')!.textContent = puzzle.id
    app.querySelector('[data-title]')!.textContent = puzzle.title || 'Untitled puzzle'
    const visibility = node('label', 'studio-toggle')
    const checkbox = node('input')
    checkbox.type = 'checkbox'
    checkbox.checked = !catalog.hidden.includes(puzzle.id)
    checkbox.addEventListener('change', () => {
      catalog.hidden = catalog.hidden.filter(id => id !== puzzle.id)
      if (!checkbox.checked) catalog.hidden.push(puzzle.id)
      change()
    })
    visibility.append(checkbox, node('span', '', 'On website'))
    puzzleActions.append(visibility, button('Preview puzzle', Eye, () => run(preview)), button('Duplicate puzzle', Copy, () => run(() => addPuzzle(puzzle)), true), button('Delete puzzle', Trash2, () => run(() => {
      if (!confirm(`Delete "${puzzle.title}" from this draft?`)) return
      if (builtinPuzzles.some(entry => entry.id === puzzle.id)) {
        catalog.hidden = [...new Set([...catalog.hidden, puzzle.id])]
        tell('Built-in puzzle hidden. Its source remains available.')
      } else {
        catalog.puzzles = catalog.puzzles.filter(entry => entry.id !== puzzle.id)
        catalog.order = catalog.order.filter(id => id !== puzzle.id)
        catalog.hidden = catalog.hidden.filter(id => id !== puzzle.id)
        selectedId = catalog.puzzles[0]?.id ?? ''
      }
      change()
      renderEditor()
    }), true))
    const original = builtinPuzzles.find(entry => entry.id === puzzle.id)
    if (original) puzzleActions.append(button('Restore source definition', RotateCcw, () => run(() => {
      if (!confirm('Replace this puzzle draft with its TypeScript source definition?')) return
      catalog.puzzles[catalog.puzzles.indexOf(puzzle)] = structuredClone(original)
      change()
      renderEditor()
    }), true))
    for (const name of ['Details', 'Blocks', 'Answers', 'Console data'] as Tab[]) {
      const control = node('button', name === tab ? 'is-active' : '', name === 'Blocks' ? `Blocks (${puzzle.blocks.length})` : name)
      control.type = 'button'
      control.setAttribute('aria-pressed', String(name === tab))
      control.addEventListener('click', () => run(() => { tab = name; renderEditor() }))
      tabs.append(control)
    }
    if (tab === 'Details') {
      const details = node('div', 'studio-details-grid')
      details.append(field('Title', puzzle.title, value => { puzzle.title = value }), field('Sequence label', puzzle.sequence, value => { puzzle.sequence = value }))
      const kind = node('label', 'studio-field')
      kind.append(node('span', '', 'Category'), select('Category', [['cipher', 'Cipher'], ['logic', 'Logic'], ['math', 'Math']], puzzle.kind, value => { puzzle.kind = value as Puzzle['kind']; change() }))
      details.append(kind)
      form.append(details, field('Summary', puzzle.summary, value => { puzzle.summary = value }, true), field('Objective', puzzle.objective, value => { puzzle.objective = value }, true))
    } else if (tab === 'Blocks') {
      puzzle.blocks.forEach((block, index) => renderBlockEditor(puzzle, block, index))
      const add = node('div', 'studio-add-block')
      const options: Array<[string, string]> = Object.entries(blockNames).filter(([type]) => type !== 'custom').map(([type, name]) => [type, name])
      puzzleExtensions.forEach(extension => options.push([`custom:${extension.id}`, extension.title]))
      const types = select('Block type', options, 'text', () => {})
      add.append(types, button('Add block', Plus, () => run(() => {
        if (puzzle.blocks.length >= 100) throw new Error('A puzzle can contain at most 100 blocks.')
        if (['playfair', 'quantum', 'fourier'].includes(types.value) && puzzle.blocks.some(block => ['playfair', 'quantum', 'fourier'].includes(block.type))) throw new Error('Use only one built-in interactive workspace per puzzle.')
        if (types.value.startsWith('custom:')) {
          const extension = puzzleExtensions.find(entry => entry.id === types.value.slice(7))!
          puzzle.blocks.push({ type: 'custom', plugin: extension.id, config: Object.fromEntries(extension.fields.map(entry => [entry.key, entry.default])) })
        } else puzzle.blocks.push(makeBlock(types.value as PuzzleBlock['type']))
        change()
        renderEditor()
      })))
      form.append(add)
    } else if (tab === 'Answers') {
      const mode = node('label', 'studio-field')
      mode.append(node('span', '', 'Answer matching'), select('Answer matching', [['text', 'Text'], ['number', 'Number']], puzzle.answer.mode ?? 'text', value => { puzzle.answer.mode = value as 'text' | 'number'; change() }))
      form.append(mode, field('Input label', puzzle.answer.label, value => { puzzle.answer.label = value }), field('Input placeholder', puzzle.answer.placeholder, value => { puzzle.answer.placeholder = value }))
      const answers = node('section', 'studio-hints')
      answers.append(node('h3', '', 'Accepted answers'))
      puzzle.answer.accepted.forEach((answer, index) => {
        const row = node('div', 'studio-hint-row')
        row.append(field(`Accepted answer ${index + 1}`, answer, value => { puzzle.answer.accepted[index] = value }, true), button(`Delete answer ${index + 1}`, Trash2, () => { puzzle.answer.accepted.splice(index, 1); change(); renderEditor() }, true))
        answers.append(row)
      })
      answers.append(button('Add accepted answer', Plus, () => { puzzle.answer.accepted.push(''); change(); renderEditor() }))
      form.append(answers)
      const hints = node('section', 'studio-hints')
      hints.append(node('h3', '', 'Hints'))
      puzzle.hints.forEach((hint, index) => {
        const row = node('div', 'studio-hint-row')
        row.append(field(`Hint ${index + 1}`, hint, value => { puzzle.hints[index] = value }, true), button(`Delete hint ${index + 1}`, Trash2, () => { puzzle.hints.splice(index, 1); change(); renderEditor() }, true))
        hints.append(row)
      })
      hints.append(button('Add hint', Plus, () => { puzzle.hints.push(''); change(); renderEditor() }))
      form.append(hints)
    } else {
      const editor = field('Console data (JSON object)', JSON.stringify(puzzle.consoleData ?? {}, null, 2), () => {}, true)
      const input = editor.querySelector('textarea')!
      input.className = 'studio-json'
      input.rows = 16
      input.spellcheck = false
      input.addEventListener('input', () => {
        try {
          const data = JSON.parse(input.value)
          const candidate = { ...puzzle, consoleData: data }
          validatePuzzle(candidate, true)
          puzzle.consoleData = data
          input.setCustomValidity('')
        } catch (error) { input.setCustomValidity(error instanceof Error ? error.message : 'Invalid JSON object.') }
      })
      form.append(editor)
    }
  }

  function renderBlockEditor(puzzle: Puzzle, block: PuzzleBlock, index: number): void {
    const article = node('section', 'studio-block')
    const header = node('header', 'studio-block-header')
    header.append(node('h3', '', `${String(index + 1).padStart(2, '0')} / ${block.type === 'custom' ? puzzleExtensions.find(extension => extension.id === block.plugin)?.title ?? block.plugin : blockNames[block.type]}`))
    const actions = node('div', 'studio-row-actions')
    for (const [offset, icon, name] of [[-1, ArrowUp, 'Move block up'], [1, ArrowDown, 'Move block down']] as const) {
      const move = button(`${name} ${index + 1}`, icon, () => run(() => {
        ;[puzzle.blocks[index], puzzle.blocks[index + offset]] = [puzzle.blocks[index + offset]!, block]
        change(); renderEditor()
      }), true)
      move.disabled = index + offset < 0 || index + offset >= puzzle.blocks.length
      actions.append(move)
    }
    actions.append(button(`Delete block ${index + 1}`, Trash2, () => run(() => {
      if (!confirm(`Delete block ${index + 1}?`)) return
      puzzle.blocks.splice(index, 1); change(); renderEditor()
    }), true))
    header.append(actions)
    article.append(header)
    if (block.type === 'custom') {
      const extension = puzzleExtensions.find(entry => entry.id === block.plugin)
      if (!extension) article.append(node('p', 'studio-status--error', `Unregistered plugin: ${block.plugin}`))
      extension?.fields.forEach(setting => {
        const wrapper = node('label', setting.type === 'boolean' ? 'studio-toggle' : 'studio-field')
        const input = node('input')
        input.type = setting.type === 'boolean' ? 'checkbox' : setting.type
        if (setting.type === 'boolean') input.checked = block.config[setting.key] === true
        else input.value = String(block.config[setting.key] ?? setting.default)
        if (setting.type === 'number') {
          input.step = 'any'
          if (setting.min !== undefined) input.min = String(setting.min)
          if (setting.max !== undefined) input.max = String(setting.max)
        }
        input.addEventListener('input', () => {
          if (setting.type === 'number' && !Number.isFinite(input.valueAsNumber)) { input.setCustomValidity('Enter a number.'); return }
          input.setCustomValidity('')
          block.config[setting.key] = setting.type === 'boolean' ? input.checked : setting.type === 'number' ? input.valueAsNumber : input.value
          change()
        })
        wrapper.append(node('span', '', setting.label), input)
        article.append(wrapper)
      })
    } else if ('text' in block) article.append(field(block.type === 'cipher' ? 'Decoded glyph text' : 'Text', block.text, value => { block.text = value }, true))
    else if (block.type === 'formula') article.append(field('LaTeX', block.latex, value => { block.latex = value }, true))
    else if (block.type === 'code') article.append(field('Displayed code', block.code, value => { block.code = value }, true))
    else if (block.type === 'divider') article.append(field('Label', block.label, value => { block.label = value }))
    else {
      const source = node('a', 'studio-source', 'Open workspace source')
      source.href = `/__open-in-editor?file=${encodeURIComponent(`src/${block.type}-workspace.ts`)}`
      article.append(source)
    }
    form.append(article)
  }

  function addPuzzle(template?: Puzzle): void {
    const puzzle: Puzzle = template ? structuredClone(template) : {
      id: '', sequence: '', title: 'Untitled puzzle', kind: 'logic', summary: '', objective: '', blocks: [{ type: 'text', text: '' }], answer: { accepted: [], label: 'Answer', placeholder: 'Enter your answer', mode: 'text' }, hints: [],
    }
    puzzle.id = `puzzle-${crypto.randomUUID().slice(0, 8)}`
    puzzle.sequence = String(catalog.puzzles.length + 1).padStart(2, '0')
    if (template) puzzle.title = `${template.title} (copy)`
    catalog.puzzles.push(puzzle)
    catalog.order.push(puzzle.id)
    selectedId = puzzle.id
    tab = 'Details'
    change()
    renderEditor()
    form.querySelector('input')?.focus()
  }

  function preview(): void {
    const puzzle = selected()!
    validatePuzzle(puzzle)
    validateExtensions(puzzle)
    saveDraft(false)
    sessionStorage.setItem('signal-archive.authoring-preview.v1', JSON.stringify(puzzle))
    location.assign('?preview')
  }

  async function publish(): Promise<void> {
    if (busy || !validForm()) return
    try {
      const validated = parseCatalog(catalog)
      validated.puzzles.forEach(validateExtensions)
      if (!resolveCatalog(builtinPuzzles, validated).length) throw new Error('At least one puzzle must be on the website.')
      if (!confirm('Publish this catalog to the local website source? Deploy the site afterward to update the live website.')) return
      try { saveDraft(false) } catch { tell('Browser draft backup unavailable. Publishing to source...') }
      setBusy(true)
      const response = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Authoring-Token': token }, body: JSON.stringify({ catalog: compactCatalog(builtinPuzzles, validated), revision }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Publish failed.')
      revision = result.revision
      dirty = false
      try { localStorage.removeItem(draftKey) } catch {}
      tell('Published to local source. Deploy the website to make these changes live.')
    } catch (error) { tell(error instanceof Error ? error.message : 'Publish failed.', true) }
    finally { setBusy(false) }
  }

  const template = select('New puzzle template', [['blank', 'Blank puzzle'], ...builtinPuzzles.map(puzzle => [puzzle.id, puzzle.title] as [string, string])], 'blank', () => {})
  const reloadButton = button('Reload published', RotateCcw, () => {
    if (confirm('Replace this draft with the published catalog? Export any changes you need to keep first.')) void load(false)
  }, true)
  toolbar.append(template, button('New puzzle', Plus, () => run(() => addPuzzle(builtinPuzzles.find(puzzle => puzzle.id === template.value)))), button('Save draft', Save, () => run(() => saveDraft())), button('Import catalog', Upload, () => run(() => fileInput.click()), true), button('Export draft', Download, () => run(() => {
    parseCatalog(catalog, true)
    const url = URL.createObjectURL(new Blob([JSON.stringify(catalog, null, 2)], { type: 'application/json' }))
    const anchor = node('a')
    anchor.href = url
    anchor.download = 'puzzle-catalog.json'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }), true), reloadButton)
  const publishButton = button('Publish to source', Check, () => { void publish() })
  publishButton.classList.add('studio-primary')
  toolbar.append(publishButton)
  const filters = app.querySelector('.studio-filters')!
  const searchInput = node('input')
  searchInput.type = 'search'
  searchInput.placeholder = 'Search puzzles'
  searchInput.setAttribute('aria-label', 'Search puzzles')
  searchInput.addEventListener('input', () => { search = searchInput.value; renderList() })
  filters.append(searchInput, select('Publication filter', [['all', 'All puzzles'], ['visible', 'On website'], ['hidden', 'Hidden']], filter, value => { filter = value; renderList() }))
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    if (!file) return
    try {
      if (file.size > 2_000_000) throw new Error('Catalog exceeds the 2 MB limit.')
      const imported = parseCatalog(JSON.parse(await file.text()), true)
      if (!confirm('Replace the current draft with this imported catalog? Published content will not change.')) return
      catalog = materialize(imported)
      selectedId = catalog.puzzles[0]?.id ?? ''
      change()
      renderEditor()
      tell('Catalog imported as a draft. Nothing has been published.')
    } catch (error) { tell(error instanceof Error ? error.message : 'Import failed.', true) }
    finally { fileInput.value = '' }
  })
  form.addEventListener('submit', event => event.preventDefault())
  window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = '' } })
  await load(true)
}