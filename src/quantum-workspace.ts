import { Check, Copy, Eraser, KeyRound, LockKeyhole, RotateCcw, Undo2, Redo2, createElement } from 'lucide'
import type { GlyphAtlas } from './glyphs'
import { initializeAmplitudeGrid } from './amplitude-grid'
import { circuitColumns, circuitError, emptyCircuit, isCircuit, simulateCircuit, verifyTeleportation, type Circuit, type CircuitCell } from './quantum'
import { decryptQuantumMessage, encryptedMessage, messageIv, recoveredAesKey } from './quantum-message'
import './quantum.css'

const storageKey = 'signal-archive.quantum-work.v1'
type Selection = { cell: Exclude<CircuitCell, null> | 'erase'; from?: [number, number] }

export function initializeQuantumWorkspace(atlas: Promise<GlyphAtlas>, onReady: (ready: boolean) => void, persistenceKey: string | null = storageKey) {
  const element = document.createElement('section')
  element.className = 'quantum-workspace'
  element.setAttribute('aria-label', 'Quantum teleportation workbench')
  let circuit = emptyCircuit()
  let verified = false
  let restoredDecryption = false
  let plaintext = ''
  let disposed = false
  let generation = 0
  let selection: Selection | null = null
  let theta = 73
  let phi = 51
  let through = circuitColumns
  const undo: Circuit[] = []
  const redo: Circuit[] = []
  let preview: HTMLElement | undefined
  try {
    const saved = JSON.parse((persistenceKey ? localStorage.getItem(persistenceKey) : null) ?? 'null')
    if (isCircuit(saved?.circuit)) {
      circuit = saved.circuit
      verified = saved.verified === true && verifyTeleportation(circuit).valid
      restoredDecryption = verified && saved.decrypted === true
    }
  } catch {}

  element.innerHTML = `
    <div class="quantum-goal"><span>INPUT <strong>|x00&gt;</strong></span><span aria-hidden="true">&#8594;</span><span>TARGET <strong>|00x&gt;</strong></span></div>
    <p class="quantum-intro">Qubit 1 is the top wire and the leftmost ket bit. The unknown state is |x&gt; = a|0&gt; + b|1&gt;. Transfer both amplitudes and their relative phase to qubit 3; leave qubits 1 and 2 in zero. No measurements.</p>
    <details class="quantum-manual"><summary>Field manual / coherent teleportation</summary>
      <p>H creates or removes equal superpositions. X swaps |0&gt; and |1&gt;. Z changes the sign of |1&gt;. A control dot in the same column applies X or Z on the other wire only in the control's |1&gt; branch. This is a coherent quantum operation, not a measurement.</p>
      <ol><li>Prepare an entangled resource between the two initially empty wires.</li><li>Couple the unknown state into that resource, using the sender's two wires to carry the correction information.</li><li>Use controlled corrections on the receiving wire. Preserve phase as well as bit values.</li><li>Uncompute the sending wires. H maps |+&gt; to |0&gt;; simply discarding those wires does not meet the target.</li></ol>
      <p>The usual teleportation protocol measures two classical bits. Here those bits remain quantum controls until they are disentangled. This circuit is a coherent state-transfer exercise, not communication without a physical connection or faster-than-light signaling.</p>
      <p>Run left to right. A column can hold independent single-qubit gates, or one X/Z target paired with one control on another wire. Empty columns do nothing. Probabilities are the squared magnitudes of complex amplitudes.</p>
      <p><a href="https://en.wikipedia.org/wiki/Quantum_teleportation" target="_blank" rel="noopener noreferrer">Teleportation reference</a> / <a href="https://davidbkemp.github.io/jsqubits/jsqubitsManual.html" target="_blank" rel="noopener noreferrer">Simulator reference</a></p>
    </details>
    <h3>01 / Build the circuit</h3>
    <p>Drag gates or control dots onto the wires. On touch or keyboard, select a tool and then a cell. Drag a placed gate to move or swap it. Delete clears a focused cell; Escape cancels selection.</p>
    <div class="quantum-toolbar"><div class="quantum-palette" role="group" aria-label="Circuit gates" data-palette></div><div class="quantum-history"><button class="icon-button" type="button" title="Undo circuit edit" aria-label="Undo circuit edit" data-undo></button><button class="icon-button" type="button" title="Redo circuit edit" aria-label="Redo circuit edit" data-redo></button><button class="icon-button" type="button" title="Clear circuit" aria-label="Clear circuit" data-clear></button></div></div>
    <div class="quantum-circuit-scroll" tabindex="0" role="region" aria-label="Three-qubit circuit, columns run left to right"><div class="quantum-circuit"><div class="quantum-wire-labels"><span>QUBIT</span><span>1 / |x&gt;</span><span>2 / |0&gt;</span><span>3 / |0&gt;</span></div><div class="quantum-columns" data-columns></div></div></div>
    <p class="quantum-status" role="status" data-edit-status>Choose a gate or control dot.</p>
    <div class="quantum-preview-controls"><label>Input state<select data-preset><option value="custom">Custom state</option><option value="0">|0&gt;</option><option value="1">|1&gt;</option><option value="+">|+&gt;</option><option value="-">|-&gt;</option><option value="i">|+i&gt;</option></select></label><label>Theta / degrees<input type="number" min="0" max="180" step="1" value="73" data-theta></label><label>Phi / degrees<input type="number" min="0" max="360" step="1" value="51" data-phi></label></div>
    <p class="quantum-state-formula">a = cos(theta/2), b = exp(i phi) sin(theta/2)</p>
    <label class="quantum-step">Circuit preview <output data-step-label>After column 12</output><input type="range" min="0" max="12" value="12" step="1" aria-label="Preview through column" data-step></label>
    <div class="quantum-amplitudes" data-amplitudes></div>
    <p class="quantum-status" data-fidelity></p>
    <button type="button" class="icon-text-button" data-verify>Verify all input states</button><p class="quantum-status" role="status" data-verify-status></p>
    <section class="quantum-aes"><h3>02 / Recover the transmission</h3>
      <p>A verified circuit releases a 256-bit AES key. Use it below to decrypt the authenticated payload into glyphs, then enter the decoded sentence in the transmission field.</p>
      <div data-key-reward hidden><label>Recovered AES key / hex<input readonly spellcheck="false" aria-label="Recovered AES key" data-key-output></label><button type="button" class="icon-button" title="Copy AES key" aria-label="Copy AES key" data-copy-key></button></div>
      <label>Ciphertext / Base64, authentication tag appended<textarea readonly spellcheck="false" rows="3" data-ciphertext></textarea></label>
      <div class="quantum-aes-meta"><span>AES-256-GCM / 128-bit tag / no AAD</span><label>IV / hex<input readonly data-iv></label></div>
      <fieldset data-aes-controls><legend>Decryption</legend><label>AES key / 64 hex characters<input type="text" maxlength="64" autocomplete="off" spellcheck="false" data-key-input></label><div class="quantum-aes-actions"><button type="button" class="icon-text-button" data-use-key>Use recovered key</button><button type="button" class="icon-text-button" data-decrypt>Decrypt glyphs</button></div></fieldset>
      <p class="quantum-status" role="status" data-aes-status></p><div class="quantum-glyphs" data-message></div>
    </section>`

  const find = <ElementType extends HTMLElement>(selector: string) => element.querySelector<ElementType>(selector)!
  const columns = find('[data-columns]')
  const editStatus = find('[data-edit-status]')
  const verificationStatus = find('[data-verify-status]')
  const aesStatus = find('[data-aes-status]')
  const keyInput = find<HTMLInputElement>('[data-key-input]')
  const message = find('[data-message]')
  const amplitudeGrid = initializeAmplitudeGrid(find('[data-amplitudes]'))
  find<HTMLTextAreaElement>('[data-ciphertext]').value = encryptedMessage
  find<HTMLInputElement>('[data-iv]').value = messageIv
  const clone = (value: Circuit): Circuit => value.map(column => [...column])
  const persist = () => {
    try { if (persistenceKey) localStorage.setItem(persistenceKey, JSON.stringify({ circuit, verified, decrypted: !!plaintext })) } catch {}
  }
  function clearMessage() {
    generation++
    plaintext = ''
    message.replaceChildren()
    aesStatus.textContent = ''
    find<HTMLButtonElement>('[data-decrypt]').disabled = false
    onReady(false)
  }
  function updateReward() {
    find('[data-key-reward]').hidden = !verified
    find<HTMLInputElement>('[data-key-output]').value = verified ? recoveredAesKey : ''
    find<HTMLFieldSetElement>('[data-aes-controls]').disabled = !verified
    if (!verified) keyInput.value = ''
  }
  function commit(next: Circuit, remember = true) {
    if (JSON.stringify(next) === JSON.stringify(circuit)) return
    if (remember) { undo.push(clone(circuit)); if (undo.length > 50) undo.shift(); redo.length = 0 }
    circuit = next
    verified = false
    selection = null
    through = circuitColumns
    find<HTMLInputElement>('[data-step]').value = String(through)
    clearMessage()
    verificationStatus.textContent = 'Circuit changed. Verify again to recover the key.'
    persist()
    render()
  }
  const name = (cell: CircuitCell) => cell === 'control' ? 'Control dot' : cell || 'Empty'
  function drop(tool: Selection, column: number, wire: number) {
    const next = clone(circuit)
    const replaced = next[column]![wire]!
    next[column]![wire] = tool.cell === 'erase' ? null : tool.cell
    if (tool.from && (tool.from[0] !== column || tool.from[1] !== wire)) next[tool.from[0]]![tool.from[1]] = replaced
    commit(next)
    editStatus.textContent = `${name(next[column]![wire]!)} / qubit ${wire + 1}, column ${column + 1}.`
    find<HTMLButtonElement>(`[data-column="${column}"][data-wire="${wire}"]`).focus({ preventScroll: true })
  }
  function markSelection(tool: Selection | null) {
    selection = tool
    element.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tool === tool?.cell && !tool?.from)))
    editStatus.textContent = tool ? `${tool.cell === 'erase' ? 'Eraser' : name(tool.cell)} selected. Choose a circuit cell.` : 'Selection cancelled.'
  }
  function draggable(button: HTMLButtonElement, getTool: () => Selection | null, onClick: () => void) {
    let origin: { x: number; y: number; tool: Selection } | undefined
    let ignoreClick = false
    button.draggable = true
    button.addEventListener('dragstart', event => event.preventDefault())
    button.addEventListener('pointerdown', event => {
      const tool = getTool()
      if (!tool || !event.isPrimary || event.button !== 0) return
      origin = { x: event.clientX, y: event.clientY, tool }
      button.setPointerCapture(event.pointerId)
    })
    button.addEventListener('pointermove', event => {
      if (!origin || Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 8) return
      if (!preview) {
        preview = document.createElement('div')
        preview.className = 'quantum-drag-preview'
        preview.setAttribute('aria-hidden', 'true')
        preview.textContent = origin.tool.cell === 'control' ? '\u25cf' : origin.tool.cell === 'erase' ? '\u00d7' : origin.tool.cell
        document.body.append(preview)
      }
      preview.style.left = `${event.clientX}px`
      preview.style.top = `${event.clientY}px`
    })
    button.addEventListener('pointerup', event => {
      if (!origin) return
      const start = origin
      origin = undefined
      preview?.remove(); preview = undefined
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8) return
      ignoreClick = true
      const destination = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-column][data-wire]')
      if (destination && element.contains(destination)) drop(start.tool, Number(destination.dataset.column), Number(destination.dataset.wire))
    })
    button.addEventListener('pointercancel', () => { origin = undefined; preview?.remove(); preview = undefined })
    button.addEventListener('keydown', event => {
      if (event.key === 'Escape') { origin = undefined; preview?.remove(); preview = undefined; markSelection(null) }
    })
    button.addEventListener('click', () => { if (ignoreClick) { ignoreClick = false; return } onClick() })
  }
  for (const cell of ['H', 'X', 'Z', 'control', 'erase'] as const) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'quantum-tool'
    button.dataset.tool = cell
    button.setAttribute('aria-label', cell === 'erase' ? 'Eraser' : cell === 'control' ? 'Control dot' : `${cell} gate`)
    button.title = button.getAttribute('aria-label')!
    button.setAttribute('aria-pressed', 'false')
    if (cell === 'erase') button.append(createElement(Eraser))
    else if (cell === 'control') button.innerHTML = '<span class="quantum-control-dot" aria-hidden="true"></span>'
    else button.textContent = cell
    draggable(button, () => ({ cell }), () => markSelection({ cell }))
    find('[data-palette]').append(button)
  }
  function renderAmplitudes() {
    find('[data-step-label]').textContent = through === 0 ? 'Input' : `After column ${through}`
    const error = circuitError(circuit)
    if (error) { amplitudeGrid.clear(); find('[data-fidelity]').textContent = error; return }
    const state = simulateCircuit(circuit, theta, phi, through)
    amplitudeGrid.update(state)
    const input = simulateCircuit(emptyCircuit(), theta, phi, 0)
    let overlapReal = 0
    let overlapImaginary = 0
    for (const [outputIndex, inputIndex] of [[0, 0], [1, 4]]) {
      const actual = state[outputIndex!]!, expected = input[inputIndex!]!
      overlapReal += expected.real * actual.real + expected.imaginary * actual.imaginary
      overlapImaginary += expected.real * actual.imaginary - expected.imaginary * actual.real
    }
    find('[data-fidelity]').textContent = `Preview fidelity with |00x>: ${(Math.min(1, overlapReal ** 2 + overlapImaginary ** 2) * 100).toFixed(2)}%. Verify all input states to prove the transfer.`
  }
  function render() {
    const previousScroll = find('.quantum-circuit-scroll').scrollLeft
    columns.replaceChildren()
    circuit.forEach((column, columnIndex) => {
      const host = document.createElement('div')
      host.className = 'quantum-column'
      const label = document.createElement('span')
      label.textContent = String(columnIndex + 1).padStart(2, '0')
      host.append(label)
      const occupied = column.flatMap((cell, index) => cell ? [index] : [])
      if (column.includes('control') && occupied.length === 2) {
        const connector = document.createElement('span')
        connector.className = 'quantum-connector'
        connector.style.top = `${28 + Math.min(...occupied) * 58 + 29}px`
        connector.style.height = `${(Math.max(...occupied) - Math.min(...occupied)) * 58}px`
        host.append(connector)
      }
      column.forEach((cell, wire) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = `quantum-cell${cell ? ' quantum-cell--occupied' : ''}`
        button.dataset.column = String(columnIndex)
        button.dataset.wire = String(wire)
        button.dataset.gate = cell ?? ''
        button.setAttribute('aria-label', `Qubit ${wire + 1}, column ${columnIndex + 1}: ${name(cell)}`)
        button.title = button.getAttribute('aria-label')!
        if (cell === 'control') button.innerHTML = '<span class="quantum-control-dot" aria-hidden="true"></span>'
        else if (cell) { const gate = document.createElement('span'); gate.className = 'quantum-gate-symbol'; gate.textContent = cell; button.append(gate) }
        draggable(button, () => cell ? { cell, from: [columnIndex, wire] } : null, () => {
          if (selection) { const tool = selection; markSelection(null); drop(tool, columnIndex, wire) }
          else if (cell) markSelection({ cell, from: [columnIndex, wire] })
          else editStatus.textContent = 'Select a gate or control dot first.'
        })
        button.addEventListener('keydown', event => {
          if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); drop({ cell: 'erase' }, columnIndex, wire) }
        })
        host.append(button)
      })
      columns.append(host)
    })
    find('.quantum-circuit-scroll').scrollLeft = previousScroll
    find<HTMLButtonElement>('[data-undo]').disabled = !undo.length
    find<HTMLButtonElement>('[data-redo]').disabled = !redo.length
    element.querySelectorAll('[data-tool]').forEach(button => button.setAttribute('aria-pressed', 'false'))
    updateReward()
    renderAmplitudes()
  }
  const icons = { '[data-undo]': Undo2, '[data-redo]': Redo2, '[data-clear]': RotateCcw, '[data-verify]': Check, '[data-copy-key]': Copy, '[data-use-key]': KeyRound, '[data-decrypt]': LockKeyhole }
  for (const [selector, icon] of Object.entries(icons)) find(selector).prepend(createElement(icon))
  find('[data-undo]').addEventListener('click', () => { const next = undo.pop(); if (next) { redo.push(clone(circuit)); commit(next, false) } })
  find('[data-redo]').addEventListener('click', () => { const next = redo.pop(); if (next) { undo.push(clone(circuit)); commit(next, false) } })
  find('[data-clear]').addEventListener('click', () => { if (window.confirm('Clear the circuit and lock its AES key again?')) commit(emptyCircuit()) })
  find('[data-step]').addEventListener('input', event => { through = Number((event.target as HTMLInputElement).value); renderAmplitudes() })
  for (const field of ['theta', 'phi']) find(`[data-${field}]`).addEventListener('input', event => {
    const input = event.target as HTMLInputElement
    if (!input.validity.valid || input.value === '') return
    if (field === 'theta') theta = input.valueAsNumber
    else phi = input.valueAsNumber
    find<HTMLSelectElement>('[data-preset]').value = 'custom'
    renderAmplitudes()
  })
  find('[data-preset]').addEventListener('change', event => {
    const presets: Record<string, [number, number]> = { '0': [0, 0], '1': [180, 0], '+': [90, 0], '-': [90, 180], i: [90, 90] }
    const values = presets[(event.target as HTMLSelectElement).value]
    if (!values) return
    ;[theta, phi] = values
    find<HTMLInputElement>('[data-theta]').value = String(theta)
    find<HTMLInputElement>('[data-phi]').value = String(phi)
    renderAmplitudes()
  })
  find('[data-verify]').addEventListener('click', () => {
    const result = verifyTeleportation(circuit)
    verified = result.valid
    verificationStatus.textContent = result.detail
    verificationStatus.dataset.verified = String(verified)
    updateReward()
    persist()
  })
  find('[data-use-key]').addEventListener('click', () => { if (verified) { keyInput.value = recoveredAesKey; keyInput.focus() } })
  find('[data-copy-key]').addEventListener('click', async () => {
    if (!verified) return
    try { await navigator.clipboard.writeText(recoveredAesKey); if (!disposed) aesStatus.textContent = 'Key copied.' }
    catch { if (!disposed) { find<HTMLInputElement>('[data-key-output]').select(); aesStatus.textContent = 'Key selected. Copy it with your keyboard.' } }
  })
  async function decrypt() {
    if (!verified) return
    clearMessage()
    const request = generation
    find<HTMLButtonElement>('[data-decrypt]').disabled = true
    aesStatus.textContent = 'Authenticating ciphertext...'
    try {
      const result = await decryptQuantumMessage(keyInput.value)
      const glyphs = await atlas
      if (disposed || request !== generation || !verified) return
      plaintext = result
      result.toUpperCase().split(' ').forEach(word => {
        const group = document.createElement('span')
        group.className = 'quantum-glyph-word'
        for (const letter of word.replace(/[^A-Z0-9?!]/g, '')) {
          const image = document.createElement('img')
          image.className = 'glyph'
          image.alt = ''
          image.draggable = false
          image.src = glyphs.get(letter as 'A') ?? ''
          group.append(image)
        }
        message.append(group)
      })
      aesStatus.textContent = 'Authenticated. Decode the recovered glyphs into the transmission field.'
      onReady(true)
      persist()
    } catch (error) {
      if (!disposed && request === generation) { aesStatus.textContent = error instanceof Error ? error.message : 'Decryption failed.'; persist() }
    } finally { if (!disposed && request === generation) find<HTMLButtonElement>('[data-decrypt]').disabled = false }
  }
  find('[data-decrypt]').addEventListener('click', () => { void decrypt() })
  render()
  onReady(false)
  if (verified) verificationStatus.textContent = verifyTeleportation(circuit).detail
  if (restoredDecryption) { keyInput.value = recoveredAesKey; void decrypt() }
  return {
    element,
    get ready() { return !!plaintext },
    getFeedbackTargets: () => plaintext ? [{ element: message, text: '', letters: [...plaintext.toUpperCase().replace(/[^A-Z0-9?!]/g, '')] }] : [],
    destroy: () => { disposed = true; generation++; preview?.remove(); amplitudeGrid.destroy(); element.remove() },
  }
}