import { getAmplitudeGridState, type ComplexAmplitude } from './amplitude-grid-state'
import './amplitude-grid.css'

let nextTooltipId = 0

export function initializeAmplitudeGrid(host: HTMLElement) {
  const element = document.createElement('section')
  element.className = 'amplitude-view'
  element.setAttribute('aria-label', 'State amplitudes')
  element.innerHTML = `<div class="amplitude-heading"><span>State amplitudes</span><span class="amplitude-scale"></span></div><div class="amplitude-axis-titles"><span data-row-title></span><span data-column-title></span></div><div class="amplitude-scroll"><div class="amplitude-matrix" role="grid" aria-label="Statevector amplitudes"></div></div>`
  host.append(element)
  const matrix = element.querySelector<HTMLElement>('.amplitude-matrix')!
  const tooltip = document.createElement('div')
  tooltip.className = 'amplitude-tooltip'
  tooltip.id = `amplitude-tooltip-${++nextTooltipId}`
  tooltip.setAttribute('role', 'tooltip')
  tooltip.hidden = true
  document.body.append(tooltip)
  const events = new AbortController()
  let state: ReturnType<typeof getAmplitudeGridState> | undefined
  let buttons: HTMLButtonElement[] = []
  let activeIndex = -1
  let focusIndex = 0
  let pinned = false
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  const format = (value: number) => Math.abs(value) < 1e-12 ? '0' : Math.abs(value) < .000001 ? value.toExponential(6) : Number(value.toPrecision(8)).toString()
  const cancelHide = () => { clearTimeout(hideTimer); hideTimer = undefined }
  function hide() {
    cancelHide()
    if (buttons[activeIndex]) {
      buttons[activeIndex]!.classList.remove('amplitude-cell--active')
      buttons[activeIndex]!.removeAttribute('aria-describedby')
    }
    activeIndex = -1; pinned = false; tooltip.hidden = true
  }
  function positionTooltip(button: HTMLElement) {
    const anchor = button.getBoundingClientRect()
    const bounds = tooltip.getBoundingClientRect()
    tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - bounds.width - 8, anchor.left + (anchor.width - bounds.width) / 2))}px`
    const below = anchor.bottom + 8
    const top = below + bounds.height <= window.innerHeight - 8 ? below : anchor.top - bounds.height - 8
    tooltip.style.top = `${Math.max(8, Math.min(window.innerHeight - bounds.height - 8, top))}px`
  }
  function show(index: number) {
    const cell = state?.cells[index], button = buttons[index]
    if (!cell || !button) return
    cancelHide()
    if (activeIndex !== index) hide()
    activeIndex = index
    button.classList.add('amplitude-cell--active')
    button.setAttribute('aria-describedby', tooltip.id)
    const heading = document.createElement('strong')
    heading.textContent = `|${cell.basis}> / index ${cell.index}`
    const values = document.createElement('dl')
    const phase = cell.phase === null ? 'Undefined (zero amplitude)' : `${format(cell.phase * 180 / Math.PI)} deg`
    for (const [name, value] of [
      ['Amplitude', `${format(cell.real)} ${cell.imaginary < 0 ? '-' : '+'} ${format(Math.abs(cell.imaginary))}i`],
      ['Magnitude', format(cell.magnitude)], ['Probability', `${format(cell.probability * 100)}%`], ['Phase', phase],
    ]) {
      const term = document.createElement('dt'), detail = document.createElement('dd')
      term.textContent = name!; detail.textContent = value!; values.append(term, detail)
    }
    tooltip.replaceChildren(heading, values)
    tooltip.hidden = false
    positionTooltip(button)
  }
  function delayHide() { if (!pinned) { cancelHide(); hideTimer = setTimeout(hide, 140) } }
  function setFocus(index: number) {
    if (buttons[focusIndex]) buttons[focusIndex]!.tabIndex = -1
    focusIndex = index
    buttons[index]!.tabIndex = 0
  }
  function build() {
    if (!state) return
    matrix.replaceChildren(); buttons = []
    matrix.style.setProperty('--amplitude-columns', String(state.columns))
    element.style.setProperty('--amplitude-width', `${Math.max(310, 56 + state.columns * 38)}px`)
    element.dataset.qubits = String(state.qubits)
    matrix.setAttribute('aria-rowcount', String(state.rows + 1))
    matrix.setAttribute('aria-colcount', String(state.columns + 1))
    element.querySelector('[data-row-title]')!.textContent = `Y / first ${state.rowBits} bit${state.rowBits === 1 ? '' : 's'}`
    element.querySelector('[data-column-title]')!.textContent = `X / last ${state.columnBits} bit${state.columnBits === 1 ? '' : 's'}`
    const header = document.createElement('div'); header.className = 'amplitude-row'; header.setAttribute('role', 'row')
    const corner = document.createElement('span'); corner.className = 'amplitude-axis-corner'; corner.textContent = 'Y / X'; corner.setAttribute('role', 'columnheader'); header.append(corner)
    for (let column = 0; column < state.columns; column++) {
      const label = document.createElement('span'); label.className = 'amplitude-column-label'; label.setAttribute('role', 'columnheader'); label.textContent = column.toString(2).padStart(state.columnBits, '0'); label.dataset.column = String(column); header.append(label)
    }
    matrix.append(header)
    for (let row = 0; row < state.rows; row++) {
      const rowElement = document.createElement('div'); rowElement.className = 'amplitude-row'; rowElement.setAttribute('role', 'row')
      const label = document.createElement('span'); label.className = 'amplitude-row-label'; label.setAttribute('role', 'rowheader'); label.textContent = state.rowBits ? row.toString(2).padStart(state.rowBits, '0') : '-'; label.dataset.row = String(row); rowElement.append(label)
      for (let column = 0; column < state.columns; column++) {
        const index = row * state.columns + column
        const wrapper = document.createElement('div'); wrapper.setAttribute('role', 'gridcell'); wrapper.className = 'amplitude-grid-cell'
        const button = document.createElement('button'); button.type = 'button'; button.className = 'amplitude-cell'; button.dataset.index = String(index); button.dataset.basis = state.cells[index]!.basis; button.tabIndex = index === focusIndex ? 0 : -1
        button.innerHTML = '<span class="amplitude-orbit" aria-hidden="true"><span class="amplitude-disc"><span class="amplitude-phase"></span></span></span>'
        button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse' || event.pointerType === 'pen') show(index) })
        button.addEventListener('pointerleave', delayHide)
        button.addEventListener('focus', () => { setFocus(index); show(index) })
        button.addEventListener('blur', hide)
        button.addEventListener('click', () => { show(index); pinned = true })
        button.addEventListener('keydown', event => {
          if (!state) return
          let next = index
          if (event.key === 'ArrowLeft') next = row * state.columns + Math.max(0, column - 1)
          else if (event.key === 'ArrowRight') next = row * state.columns + Math.min(state.columns - 1, column + 1)
          else if (event.key === 'ArrowUp') next = Math.max(0, row - 1) * state.columns + column
          else if (event.key === 'ArrowDown') next = Math.min(state.rows - 1, row + 1) * state.columns + column
          else if (event.key === 'Home') next = event.ctrlKey ? 0 : row * state.columns
          else if (event.key === 'End') next = event.ctrlKey ? state.cells.length - 1 : (row + 1) * state.columns - 1
          else return
          event.preventDefault(); setFocus(next); buttons[next]!.focus()
        })
        buttons.push(button); wrapper.append(button); rowElement.append(wrapper)
      }
      matrix.append(rowElement)
    }
  }
  function update(amplitudes: readonly ComplexAmplitude[]) {
    const next = getAmplitudeGridState(amplitudes)
    const rebuild = next.qubits !== state?.qubits
    hide(); state = next
    if (rebuild) { focusIndex = 0; build() }
    element.querySelector('.amplitude-scale')!.textContent = `Radius |a| x ${format(state.radiusScale)}`
    state.cells.forEach((cell, index) => {
      const button = buttons[index]!
      button.style.setProperty('--amplitude-radius', String(cell.phase === null ? 0 : cell.magnitude * state!.radiusScale))
      button.style.setProperty('--amplitude-angle', `${cell.phase === null ? 0 : -cell.phase * 180 / Math.PI}deg`)
      button.dataset.zero = String(cell.phase === null)
      button.setAttribute('aria-label', `State |${cell.basis}>, index ${index}, probability ${format(cell.probability * 100)}%, phase ${cell.phase === null ? 'undefined' : `${format(cell.phase * 180 / Math.PI)} degrees`}`)
    })
    element.hidden = false
  }
  tooltip.addEventListener('pointerenter', cancelHide)
  tooltip.addEventListener('pointerleave', delayHide)
  document.addEventListener('pointerdown', event => { if (!element.contains(event.target as Node) && !tooltip.contains(event.target as Node)) hide() }, { signal: events.signal })
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && activeIndex >= 0) { event.preventDefault(); hide() } }, { signal: events.signal })
  window.addEventListener('scroll', () => {
    const button = buttons[activeIndex]
    if (!button) return
    if (document.activeElement !== button && !pinned) { hide(); return }
    const bounds = button.getBoundingClientRect()
    const viewport = element.querySelector('.amplitude-scroll')!.getBoundingClientRect()
    const visible = bounds.bottom > Math.max(0, viewport.top + 28)
      && bounds.top < Math.min(window.innerHeight, viewport.bottom)
      && bounds.right > Math.max(0, viewport.left + 48)
      && bounds.left < Math.min(window.innerWidth, viewport.right)
    if (visible) positionTooltip(button)
    else hide()
  }, { capture: true, passive: true, signal: events.signal })
  window.addEventListener('resize', hide, { signal: events.signal })
  return { update, clear: () => { hide(); element.hidden = true }, destroy: () => { hide(); events.abort(); tooltip.remove(); element.remove() } }
}