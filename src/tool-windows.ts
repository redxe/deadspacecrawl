import { Check, Copy, GripHorizontal, Minus, Play, X, createElement } from 'lucide'
import type { IconNode } from 'lucide'
import { CHARACTER_KEYS, loadGlyphAtlas } from './glyphs'
import { createRelayTools, relayToolDefinitions } from './relay-tools'
import type { Puzzle } from './puzzles/types'

export function initializeToolWindows(getPuzzle: () => Puzzle) {
  const tools = createRelayTools(CHARACTER_KEYS)
  const windows = new Map<string, HTMLElement>()
  let topLayer = 60
  let atlas: ReturnType<typeof loadGlyphAtlas> | undefined

  const iconButton = (label: string, icon: IconNode): HTMLButtonElement => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'icon-button'
    button.title = label
    button.setAttribute('aria-label', label)
    const svg = createElement(icon)
    svg.setAttribute('aria-hidden', 'true')
    button.append(svg)
    return button
  }
  const clamp = (panel: HTMLElement, left: number, top: number): void => {
    const bounds = panel.getBoundingClientRect()
    panel.style.left = `${Math.max(8, Math.min(left, innerWidth - bounds.width - 8))}px`
    panel.style.top = `${Math.max(8, Math.min(top, innerHeight - bounds.height - 8))}px`
  }
  window.addEventListener('resize', () => windows.forEach(panel => {
    const bounds = panel.getBoundingClientRect()
    clamp(panel, bounds.left, bounds.top)
  }))

  return (name: string): void => {
    const alias = name === 'pack' || name === 'unpack' ? 'bits' : name
    const definition = relayToolDefinitions.find(tool => tool.name === alias)
    if (!definition) return
    const existing = windows.get(alias)
    if (existing) {
      existing.style.zIndex = String(++topLayer)
      if (existing.querySelector<HTMLElement>('.tool-window-body')?.hidden) {
        existing.querySelector<HTMLButtonElement>('[aria-expanded="false"]')?.click()
      }
      existing.querySelector<HTMLButtonElement>('[data-drag]')?.focus()
      return
    }
    const panel = document.createElement('section')
    panel.className = 'tool-window'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', definition.title)
    panel.style.zIndex = String(++topLayer)
    const header = document.createElement('header')
    header.className = 'tool-window-header'
    const drag = iconButton(`Move ${definition.title}`, GripHorizontal)
    drag.dataset.drag = ''
    drag.setAttribute('aria-description', 'Drag to move. Arrow keys move the window; Shift moves in larger steps.')
    const title = document.createElement('strong')
    title.textContent = definition.title
    drag.append(title)
    const minimize = iconButton(`Minimize ${definition.title}`, Minus)
    minimize.setAttribute('aria-expanded', 'true')
    const close = iconButton(`Close ${definition.title}`, X)
    header.append(drag, minimize, close)
    const body = document.createElement('div')
    body.className = 'tool-window-body'
    panel.append(header, body)
    document.body.append(panel)
    windows.set(alias, panel)
    clamp(panel, innerWidth - 440 - windows.size * 16, 80 + windows.size * 24)
    const observer = new ResizeObserver(() => {
      const bounds = panel.getBoundingClientRect()
      clamp(panel, bounds.left, bounds.top)
    })
    observer.observe(panel)
    panel.addEventListener('pointerdown', () => { panel.style.zIndex = String(++topLayer) })
    const remove = (): void => {
      observer.disconnect()
      panel.remove()
      windows.delete(alias)
      document.querySelector<HTMLTextAreaElement>('[data-console-input]')?.focus()
    }
    close.addEventListener('click', remove)
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.stopPropagation(); remove() }
    })
    minimize.addEventListener('click', () => {
      body.hidden = !body.hidden
      minimize.setAttribute('aria-expanded', String(!body.hidden))
      const label = `${body.hidden ? 'Restore' : 'Minimize'} ${definition.title}`
      minimize.title = label
      minimize.setAttribute('aria-label', label)
      const bounds = panel.getBoundingClientRect()
      clamp(panel, bounds.left, bounds.top)
    })
    let origin: { pointer: number; x: number; y: number; left: number; top: number } | undefined
    drag.addEventListener('pointerdown', event => {
      if (event.button !== 0) return
      const bounds = panel.getBoundingClientRect()
      origin = { pointer: event.pointerId, x: event.clientX, y: event.clientY, left: bounds.left, top: bounds.top }
      drag.setPointerCapture(event.pointerId)
    })
    drag.addEventListener('pointermove', event => {
      if (origin?.pointer === event.pointerId) clamp(panel, origin.left + event.clientX - origin.x, origin.top + event.clientY - origin.y)
    })
    drag.addEventListener('lostpointercapture', () => { origin = undefined })
    drag.addEventListener('pointerup', () => { origin = undefined })
    drag.addEventListener('pointercancel', () => { origin = undefined })
    drag.addEventListener('keydown', event => {
      const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      const delta = directions[event.key]
      if (!delta) return
      event.preventDefault()
      const bounds = panel.getBoundingClientRect()
      const step = event.shiftKey ? 40 : 10
      clamp(panel, bounds.left + delta[0] * step, bounds.top + delta[1] * step)
    })

    const form = document.createElement('form')
    form.className = 'tool-form'
    const modeLabel = document.createElement('label')
    const mode = document.createElement('select')
    mode.setAttribute('aria-label', `${definition.title} mode`)
    if (alias !== 'glyphs') {
      modeLabel.textContent = 'Operation'
      const options = alias === 'relay'
        ? [['inverse', 'Inverse F(N) to N'], ['forward', 'Forward N to F(N)']]
        : [['unpack', 'Integer to slots'], ['pack', 'Indices to integer']]
      for (const [value, label] of options) {
        const option = document.createElement('option')
        option.value = value!
        option.textContent = label!
        mode.append(option)
      }
      modeLabel.append(mode)
      form.append(modeLabel)
    }
    const valueLabel = document.createElement('label')
    const valueText = document.createElement('span')
    valueText.textContent = alias === 'glyphs' ? 'Glyph indices' : 'Integer value'
    const input = document.createElement('input')
    input.type = 'text'
    input.autocomplete = 'off'
    input.spellcheck = false
    input.setAttribute('aria-label', `${definition.title} value`)
    const data = getPuzzle().consoleData ?? {}
    input.value = String(alias === 'relay' ? data.encoded ?? '' : alias === 'bits' ? data.packed ?? '' : Array.isArray(data.indices) ? data.indices.join(', ') : '')
    valueLabel.append(valueText, input)
    form.append(valueLabel)
    const slotLabel = document.createElement('label')
    slotLabel.textContent = 'Slots'
    const slots = document.createElement('input')
    slots.type = 'number'
    slots.min = '1'
    slots.max = '32'
    slots.step = '1'
    slots.value = '5'
    slots.setAttribute('aria-label', 'Bit slot count')
    slotLabel.append(slots)
    if (alias === 'bits') form.append(slotLabel)
    const run = iconButton(`Calculate ${definition.title}`, Play)
    run.type = 'submit'
    run.classList.add('tool-calculate')
    form.append(run)
    const result = document.createElement('div')
    result.className = 'tool-result'
    result.setAttribute('role', 'status')
    const copy = iconButton(`Copy ${definition.title} result`, Copy)
    copy.hidden = true
    let copyValue = ''
    copy.addEventListener('click', () => {
      void navigator.clipboard.writeText(copyValue).then(() => {
        copy.replaceChildren(createElement(Check))
        copy.title = 'Copied'
        copy.setAttribute('aria-label', 'Copied')
      }).catch(() => {
        copy.title = 'Copy unavailable; select the result text'
        copy.setAttribute('aria-label', copy.title)
      })
    })
    const readIndices = (): number[] => {
      const value = input.value.trim()
      const parsed: unknown = JSON.parse(value.startsWith('[') ? value : `[${value}]`)
      if (!Array.isArray(parsed)) throw new Error('Enter an index list.')
      return parsed as number[]
    }
    form.addEventListener('submit', event => {
      event.preventDefault()
      result.replaceChildren()
      result.classList.remove('tool-result--error')
      copy.hidden = true
      try {
        if (alias === 'relay') {
          copyValue = String(tools.relay(input.value.trim(), mode.value === 'inverse'))
          result.textContent = copyValue
        } else if (alias === 'bits') {
          const packed = mode.value === 'pack' ? tools.pack(readIndices()) : input.value.trim()
          const count = mode.value === 'pack' ? readIndices().length : Number(slots.value)
          const detail = tools.bits(packed, count)
          const decimal = document.createElement('p')
          decimal.textContent = detail.decimal
          const groups = document.createElement('div')
          groups.className = 'tool-bit-groups'
          detail.indices.forEach((index, position) => {
            const slot = document.createElement('div')
            const label = document.createElement('small')
            label.textContent = `c${position}`
            const binary = document.createElement('code')
            binary.textContent = index.toString(2).padStart(6, '0')
            const value = document.createElement('strong')
            value.textContent = String(index)
            slot.append(label, binary, value)
            groups.append(slot)
          })
          result.append(decimal, groups)
          copyValue = mode.value === 'pack' ? detail.decimal : detail.indices.join(', ')
        } else {
          copyValue = String(tools.glyphs(readIndices()))
          result.textContent = copyValue
        }
        copy.hidden = false
        copy.replaceChildren(createElement(Copy))
        copy.title = `Copy ${definition.title} result`
        copy.setAttribute('aria-label', copy.title)
      } catch (error) {
        result.classList.add('tool-result--error')
        result.textContent = error instanceof Error ? error.message : 'Enter valid integer values.'
      }
      const bounds = panel.getBoundingClientRect()
      clamp(panel, bounds.left, bounds.top)
    })
    mode.addEventListener('change', () => {
      valueText.textContent = mode.value === 'pack' ? 'Glyph indices' : 'Integer value'
      slotLabel.hidden = mode.value === 'pack'
      result.replaceChildren()
      copy.hidden = true
    })
    if (alias === 'relay') {
      const formula = document.createElement('div')
      formula.className = 'tool-formula'
      formula.textContent = 'F(N) = (N + 37)^2 + 19'
      body.append(formula)
      void import('./console-math').then(({ renderMath }) => renderMath(formula, String.raw`F(N)=(N+37)^2+19`)).catch(() => {})
    }
    body.append(form, result, copy)
    if (alias === 'glyphs') {
      const chart = document.createElement('div')
      chart.className = 'tool-glyph-chart'
      body.append(chart)
      atlas ??= loadGlyphAtlas(`${import.meta.env.BASE_URL}assets/characters.png`)
      void atlas.then(glyphs => {
        for (const [index, character] of CHARACTER_KEYS.entries()) {
          const cell = document.createElement('button')
          cell.type = 'button'
          cell.title = `Append ${character}, index ${index}`
          cell.setAttribute('aria-label', cell.title)
          const image = document.createElement('img')
          image.src = glyphs.get(character)!
          image.alt = ''
          image.draggable = false
          const label = document.createElement('span')
          label.textContent = `${index} / ${character}`
          cell.append(image, label)
          cell.addEventListener('click', () => {
            input.value = input.value.trim() ? `${input.value.replace(/\]$/, '').replace(/^\[/, '')}, ${index}` : String(index)
            input.focus()
          })
          chart.append(cell)
        }
      }).catch(() => { chart.textContent = 'Glyph chart unavailable. Console glyphs() still lists character positions.' })
    }
    input.focus()
  }
}