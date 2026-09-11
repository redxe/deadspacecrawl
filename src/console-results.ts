import { ArrowLeft, ChevronRight, CornerDownLeft, ExternalLink, Play, createElement } from 'lucide'
import type { IconNode } from 'lucide'
import { commandHelp } from './console-help'
import { highlightCommand } from './console-editor'
import { relayToolDefinitions } from './relay-tools'

export interface ConsoleValue {
  type: 'number' | 'boolean' | 'string' | 'null' | 'undefined' | 'array' | 'object' | 'function' | 'prime' | 'help' | 'tools'
  command?: string
  text?: string
  items?: ConsoleValue[]
  entries?: Array<[string, ConsoleValue]>
  label?: string
  layout?: 'factors' | 'sequence'
  omitted?: number
  startIndex?: number
  endIndex?: number
  prime?: { index: number; value: number; previous: number | null; next: number }
}

function actionIcon(icon: IconNode): SVGElement {
  const element = createElement(icon)
  element.setAttribute('aria-hidden', 'true')
  element.setAttribute('width', '14')
  element.setAttribute('height', '14')
  return element
}

function actionButton(label: string, code: string, mode: 'run' | 'insert', icon?: IconNode): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'console-output-action'
  button.title = label
  button.setAttribute('aria-label', label)
  if (mode === 'run') button.dataset.consoleRunCommand = code
  else button.dataset.consoleInsert = code
  if (icon) button.append(actionIcon(icon))
  return button
}

function popoutButton(name: string, title: string): HTMLButtonElement {
  const button = actionButton(`Pop out ${title}`, '', 'insert', ExternalLink)
  delete button.dataset.consoleInsert
  button.dataset.consolePopout = name
  return button
}

function renderHelp(command?: string): HTMLElement {
  const view = document.createElement('section')
  view.className = 'console-help'
  const reference = commandHelp.find(entry => entry.name === command)
  view.setAttribute('aria-label', reference ? `${reference.name} command reference` : 'Command directory')
  const header = document.createElement('header')
  header.className = 'console-help-heading'
  const title = document.createElement('h3')
  title.textContent = reference?.name ?? 'Command Reference'
  header.append(title)
  const popout = relayToolDefinitions.find(tool => tool.name === reference?.name || (tool.name === 'bits' && ['pack', 'unpack'].includes(reference?.name ?? '')))
  if (popout) header.append(popoutButton(popout.name, popout.title))
  if (reference) header.prepend(actionButton('All commands', 'help()', 'run', ArrowLeft))
  else {
    const count = document.createElement('span')
    count.className = 'console-result-label'
    count.textContent = `${commandHelp.length} COMMANDS`
    header.append(count)
  }
  view.append(header)
  if (!reference) {
    const list = document.createElement('div')
    list.className = 'console-help-directory'
    for (const entry of commandHelp) {
      const button = actionButton(`Help for ${entry.name}`, `help(${JSON.stringify(entry.name)})`, 'run')
      button.classList.add('console-help-entry')
      const name = document.createElement('code')
      name.textContent = entry.name
      const summary = document.createElement('span')
      summary.textContent = entry.summary
      button.append(name, summary, actionIcon(ChevronRight))
      list.append(button)
    }
    view.append(list)
    return view
  }

  const summary = document.createElement('p')
  summary.className = 'console-help-summary'
  summary.textContent = reference.summary
  const signatures = document.createElement('div')
  signatures.className = 'console-help-signatures'
  for (const signature of reference.signatures) {
    const code = document.createElement('code')
    code.innerHTML = highlightCommand(signature)
    signatures.append(code)
  }
  view.append(summary, signatures)

  const section = (label: string): HTMLElement => {
    const block = document.createElement('section')
    block.className = 'console-help-section'
    const heading = document.createElement('h4')
    heading.textContent = label
    block.append(heading)
    view.append(block)
    return block
  }
  if (reference.parameters.length) {
    const parameters = document.createElement('dl')
    parameters.className = 'console-help-parameters'
    for (const [name, description] of reference.parameters) {
      const term = document.createElement('dt')
      term.textContent = name
      const definition = document.createElement('dd')
      definition.textContent = description
      parameters.append(term, definition)
    }
    section('Arguments').append(parameters)
  }
  const returns = document.createElement('p')
  returns.textContent = reference.returns
  section('Returns').append(returns)
  if (reference.name === 'primes') section('Notation').append(primeDefinition())

  const examples = section('Examples')
  for (const example of reference.examples) {
    const row = document.createElement('div')
    row.className = 'console-help-example'
    const content = document.createElement('div')
    const code = document.createElement('code')
    code.innerHTML = highlightCommand(example.code)
    const expected = document.createElement('span')
    expected.textContent = example.result
    content.append(code, expected)
    const actions = document.createElement('div')
    actions.className = 'console-help-example-actions'
    actions.append(actionButton(`Insert ${example.code}`, example.code, 'insert', CornerDownLeft))
    if (example.runnable !== false) actions.append(actionButton(`Run ${example.code}`, example.code, 'run', Play))
    row.append(content, actions)
    examples.append(row)
  }
  const notes = document.createElement('ul')
  for (const detail of reference.details) {
    const item = document.createElement('li')
    item.textContent = detail
    notes.append(item)
  }
  section('Details').append(notes)
  return view
}

function primeMath(latex: string, readable: string, className = ''): HTMLElement {
  const element = document.createElement('div')
  element.className = `console-prime-math ${className}`
  element.setAttribute('role', 'math')
  element.setAttribute('aria-label', readable)
  element.textContent = readable
  void import('./console-math')
    .then(({ renderMath }) => renderMath(element, latex))
    .catch(() => { element.textContent = readable })
  return element
}

function primeDefinition(): HTMLElement {
  const definition = document.createElement('div')
  definition.className = 'console-prime-definition'
  definition.append(
    primeMath(String.raw`\mathbb{P}=(p_k)_{k\geq1}=(2,3,5,7,\ldots)`, 'P is the sequence of primes, indexed from 1: 2, 3, 5, 7, ...'),
    primeMath(String.raw`\mathbb{P}[k]=p_k,\quad \pi(p_k)=k`, 'P[k] is the kth prime; pi(p_k) equals k'),
  )
  return definition
}

export function renderConsoleValue(value: ConsoleValue, depth = 0): HTMLElement {
  const result = document.createElement('div')
  result.className = `console-value console-value--${value.type}`

  if (value.label) {
    const label = document.createElement('span')
    label.className = 'console-result-label'
    label.textContent = value.label
    result.append(label)
  }

  if (value.type === 'tools') {
    const directory = document.createElement('div')
    directory.className = 'console-tool-directory'
    for (const tool of relayToolDefinitions) {
      const row = document.createElement('div')
      const label = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = tool.title
      const description = document.createElement('span')
      description.textContent = tool.description
      label.append(title, description)
      row.append(label, popoutButton(tool.name, tool.title))
      directory.append(row)
    }
    result.append(directory)
  } else if (value.type === 'help') {
    result.append(renderHelp(value.command))
  } else if (value.type === 'prime' && value.prime) {
    const { index, value: prime, previous, next } = value.prime
    result.append(primeMath(
      String.raw`\mathbb{P}[${index}]=p_{${index}}=${prime}`,
      `P[${index}] = p_${index} = ${prime}`,
      'console-prime-identity',
    ))
    result.append(primeMath(
      String.raw`\pi(${prime})=${index}`,
      `pi(${prime}) = ${index}`,
    ))
    const neighbors = document.createElement('div')
    neighbors.className = 'console-prime-neighbors'
    if (previous !== null) neighbors.append(primeMath(
      String.raw`p_{${index - 1}}=${previous}`,
      `Previous prime: p_${index - 1} = ${previous}`,
    ))
    neighbors.append(primeMath(
      String.raw`p_{${index + 1}}=${next}`,
      `Next prime: p_${index + 1} = ${next}`,
    ))
    result.append(neighbors, primeDefinition())
  } else if (value.type === 'array') {
    const tiles = document.createElement('div')
    tiles.className = 'console-number-series'
    ;(value.items ?? []).forEach((item, index) => {
      if (value.layout === 'factors' && index > 0) {
        const operator = document.createElement('span')
        operator.className = 'console-result-operator'
        operator.textContent = '\u00d7'
        tiles.append(operator)
      }
      const primeIndex = (value.startIndex ?? 1) + index
      const numeric = item.type === 'number' && /^-?\d+(?:\.\d+)?n?$/.test(item.text ?? '')
      const tile = value.layout === 'sequence'
        ? actionButton(`Inspect prime ${primeIndex}`, `primes(${primeIndex})`, 'run')
        : numeric ? actionButton(`Insert ${item.text}`, item.text!, 'insert') : document.createElement('div')
      tile.classList.add('console-value-tile')
      if (value.layout === 'sequence') {
        const position = primeMath(String.raw`p_{${primeIndex}}`, `p_${primeIndex}`, 'console-prime-index')
        tile.append(position)
      }
      tile.append(renderConsoleValue(item, depth + 1))
      tiles.append(tile)
    })
    if (!value.items?.length) {
      tiles.textContent = value.layout === 'factors' ? 'No prime factors' : 'Empty sequence'
    }
    result.append(tiles)
    if (value.layout === 'sequence') result.append(primeDefinition())
  } else if (value.type === 'object' && depth < 5) {
    const rows = document.createElement('dl')
    rows.className = 'console-property-list'
    for (const [key, item] of value.entries ?? []) {
      const term = document.createElement('dt')
      term.textContent = key
      const description = document.createElement('dd')
      description.append(renderConsoleValue(item, depth + 1))
      rows.append(term, description)
    }
    if (!value.entries?.length) rows.textContent = 'Empty object'
    result.append(rows)
  } else {
    const text = document.createElement('span')
    text.className = 'console-value-text'
    text.textContent = value.text ?? value.type
    if (value.type === 'boolean') {
      text.classList.add(value.text === 'true' ? 'console-boolean--true' : 'console-boolean--false')
      text.textContent = value.text === 'true' ? 'TRUE' : 'FALSE'
    }
    result.append(text)
  }

  if (value.omitted) {
    const remainder = document.createElement('span')
    remainder.className = 'console-result-remainder'
    remainder.textContent = `+ ${value.omitted.toLocaleString()} more`
    result.append(remainder)
  }
  return result
}