import { Check, Download, RotateCcw, Delete, Calculator, KeyRound, LockKeyhole, createElement } from 'lucide'
import { CHARACTER_KEYS, type GlyphAtlas, renderGlyphText } from './glyphs'
import { receivedStatevector, transformStatevector, validateStatevector, packGlyphIndices, matchesSignal, signalIndices } from './qft-engine'
import { rsaModulus, rsaExponent, rsaCiphertext, parseInteger, factorPackedInteger, deriveRsaKey, decryptRsa } from './fourier-rsa'
import { initializeAmplitudeGrid } from './amplitude-grid'
import './fourier.css'

export const fourierStorageKey = 'signal-archive.fourier-work.v1'

export function initializeFourierWorkspace(atlasPromise: Promise<GlyphAtlas>, onReady: (ready: boolean) => void) {
  const element = document.createElement('section')
  element.className = 'fourier-workspace'
  element.setAttribute('aria-label', 'Fourier and RSA workbench')
  let disposed = false
  let atlas: GlyphAtlas | undefined
  let selected = Array<number>(6).fill(-1)
  let cursor = 0
  let glyphsVerified = false
  let plaintext = ''
  let prime = ''
  let exponent = ''
  let restoreDecryption = false
  let vector = receivedStatevector()
  try {
    const saved = JSON.parse(localStorage.getItem(fourierStorageKey) ?? 'null')
    if (Array.isArray(saved?.selected) && saved.selected.length === 6 && saved.selected.every((index: unknown) => Number.isInteger(index) && Number(index) >= -1 && Number(index) < 26)) selected = saved.selected
    glyphsVerified = saved?.verified === true && matchesSignal(selected)
    if (glyphsVerified && typeof saved?.prime === 'string' && typeof saved?.exponent === 'string') {
      prime = saved.prime.slice(0, 16)
      exponent = saved.exponent.slice(0, 16)
      restoreDecryption = saved.decrypted === true
    }
  } catch {}
  element.innerHTML = `
    <details class="fourier-manual"><summary>Field manual / Fourier phases and RSA</summary>
      <p>A normalized eight-qubit state has 256 complex amplitudes in ascending basis order |00000000&gt; through |11111111&gt;. The received signal is QFT(|word&gt;), using positive phase: F[j,k] = exp(2 pi i j k / 256) / 16. Its inverse uses the negative sign. Probabilities alone lose the phase information; these are simulator amplitudes, not measurements of one physical specimen.</p>
      <p>The original state has six equally weighted occupied basis states. Split each eight-bit basis label as PPP GGGGG: position 0-5 in the high three bits, alphabet index A=0 to Z=25 in the low five. Sort by position. Example: |01000011&gt; means position 2, glyph index 3 (D). Enter the six recovered characters with the glyph keypad.</p>
      <p>Then repack the six indices into SIX-bit slots, first glyph highest: N = sum(index[position] * 64^(5-position)). This packing differs from the statevector's five-bit alphabet field. For an unrelated two-letter example, B D gives (1 * 64) + 3 = 67.</p>
      <p>The largest prime factor of N is RSA prime p. The public key supplies n and e. Find q=n/p, phi(n)=(p-1)(q-1), d=e^(-1) mod phi(n), and decode each c as c^d mod n. Each result is one UTF-8 byte. This deliberately small, unpadded textbook RSA exposes repeated bytes and is not secure for real messages.</p>
      <p><a href="https://en.wikipedia.org/wiki/Quantum_Fourier_transform" target="_blank" rel="noopener noreferrer">QFT reference</a> / <a href="https://en.wikipedia.org/wiki/RSA_cryptosystem#Operation" target="_blank" rel="noopener noreferrer">RSA reference</a> / <a href="https://davidbkemp.github.io/jsqubits/jsqubitsManual.html" target="_blank" rel="noopener noreferrer">Simulator reference</a></p>
    </details>
    <h3>01 / Recover the phase-encoded word</h3>
    <details><summary>Received statevector / JSON</summary><label>256 amplitudes, ascending basis order<textarea rows="7" spellcheck="false" data-vector></textarea></label><div class="fourier-actions"><button type="button" class="icon-text-button" data-load>Load edited vector</button><button type="button" class="icon-button" title="Download received statevector" aria-label="Download received statevector" data-download></button><button type="button" class="icon-button" title="Restore received statevector" aria-label="Restore received statevector" data-vector-reset></button></div></details>
    <div class="fourier-actions"><label>Transform<select data-transform><option value="forward">Forward QFT</option><option value="inverse">Inverse QFT</option></select></label><button type="button" class="icon-text-button" data-run>Apply transform</button></div>
    <p class="fourier-status" role="status" data-vector-status>Received state / 8 qubits / total probability 1</p>
    <div data-state-amplitudes></div>
    <div class="fourier-slots" role="group" aria-label="Six recovered glyphs" data-slots></div>
    <div class="fourier-keypad" role="group" aria-label="Alphabet glyph keypad" data-keypad></div>
    <div class="fourier-actions"><button type="button" class="icon-text-button" data-check-glyphs>Verify glyph word</button><button type="button" class="icon-button" title="Erase selected glyph" aria-label="Erase selected glyph" data-erase></button></div><p class="fourier-status" role="status" data-glyph-status></p>
    <h3>02 / Pack and factor</h3><fieldset data-number-stage><legend>Recovered glyph indices</legend><output class="fourier-packed" data-packed></output><label>Integer to factor<input inputmode="numeric" maxlength="16" data-factor-input></label><button type="button" class="icon-text-button" data-factor>Factor integer</button><output class="fourier-packed" data-factors></output></fieldset>
    <h3>03 / Open the RSA transmission</h3><div class="fourier-key-values"><label>Public modulus n<input readonly value="${rsaModulus}"></label><label>Public exponent e<input readonly value="${rsaExponent}"></label></div><details><summary>Ciphertext / decimal byte blocks</summary><textarea readonly rows="5" aria-label="RSA ciphertext" data-rsa-cipher></textarea></details>
    <fieldset data-rsa-stage><legend>Private key worksheet</legend><label>p / largest prime factor<input inputmode="numeric" maxlength="16" data-prime></label><button type="button" class="icon-text-button" data-derive>Derive private key</button><output class="fourier-packed" data-key-math></output><label>Private exponent d<input inputmode="numeric" maxlength="16" data-exponent></label><button type="button" class="icon-text-button" data-decrypt-rsa>Decrypt transmission</button></fieldset><p class="fourier-status" role="status" data-rsa-status></p><div class="fourier-message" aria-label="Decrypted glyph transmission" data-rsa-message></div>`
  const find = <ElementType extends HTMLElement>(selector: string) => element.querySelector<ElementType>(selector)!
  const vectorInput = find<HTMLTextAreaElement>('[data-vector]')
  const primeInput = find<HTMLInputElement>('[data-prime]')
  const exponentInput = find<HTMLInputElement>('[data-exponent]')
  const message = find('[data-rsa-message]')
  const amplitudeGrid = initializeAmplitudeGrid(find('[data-state-amplitudes]'))
  vectorInput.value = JSON.stringify(vector, null, 2)
  find<HTMLTextAreaElement>('[data-rsa-cipher]').value = rsaCiphertext.join('\n')
  primeInput.value = prime
  exponentInput.value = exponent
  for (const [selector, icon] of [['[data-download]', Download], ['[data-vector-reset]', RotateCcw], ['[data-erase]', Delete], ['[data-check-glyphs]', Check], ['[data-factor]', Calculator], ['[data-derive]', KeyRound], ['[data-decrypt-rsa]', LockKeyhole]] as const) find(selector).prepend(createElement(icon))
  const persist = () => {
    try { localStorage.setItem(fourierStorageKey, JSON.stringify({ selected, verified: glyphsVerified, prime: primeInput.value, exponent: exponentInput.value, decrypted: !!plaintext })) } catch {}
  }
  function clearDecryption() { plaintext = ''; message.replaceChildren(); find('[data-rsa-status]').textContent = ''; onReady(false) }
  function lockDownstream() {
    glyphsVerified = false
    primeInput.value = ''; exponentInput.value = ''
    find('[data-key-math]').textContent = ''; find('[data-factors]').textContent = ''
    clearDecryption(); updateStages()
  }
  function updateStages() {
    find<HTMLFieldSetElement>('[data-number-stage]').disabled = !glyphsVerified
    find<HTMLFieldSetElement>('[data-rsa-stage]').disabled = !glyphsVerified
    find('[data-packed]').textContent = glyphsVerified ? `Indices: ${selected.join(' / ')}\nBits: ${selected.map(index => index.toString(2).padStart(6, '0')).join(' ')}\nN = ${packGlyphIndices(selected)}` : 'Locked / Verify the six glyphs.'
    find<HTMLInputElement>('[data-factor-input]').value = glyphsVerified ? String(packGlyphIndices(selected)) : ''
    find('[data-glyph-status]').textContent = glyphsVerified ? 'Glyph word verified. Integer and RSA tools unlocked.' : 'Six positions / A=0 through Z=25'
  }
  function renderSlots() {
    find('[data-slots]').replaceChildren()
    selected.forEach((index, position) => {
      const button = document.createElement('button')
      button.type = 'button'; button.className = 'fourier-slot'; button.dataset.position = String(position)
      button.setAttribute('aria-label', `Glyph position ${position + 1}${index < 0 ? ', empty' : `, index ${index}`}`)
      button.setAttribute('aria-pressed', String(cursor === position))
      const label = document.createElement('span'); label.textContent = String(position + 1); button.append(label)
      if (index >= 0 && atlas) {
        const image = document.createElement('img'); image.src = atlas.get(CHARACTER_KEYS[index]!)!; image.alt = ''; image.className = 'glyph'; image.dataset.feedback = index === signalIndices[position] ? 'correct' : 'incorrect'; button.append(image)
      }
      button.addEventListener('click', () => { cursor = position; renderSlots(); find<HTMLButtonElement>(`[data-position="${position}"]`).focus() })
      button.addEventListener('keydown', event => {
        if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); place(-1) }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); cursor = (cursor + (event.key === 'ArrowLeft' ? 5 : 1)) % 6; renderSlots(); find<HTMLButtonElement>(`[data-position="${cursor}"]`).focus() }
      })
      find('[data-slots]').append(button)
    })
  }
  function place(index: number) {
    selected[cursor] = index
    if (index >= 0) cursor = Math.min(5, cursor + 1)
    lockDownstream(); renderSlots(); persist()
  }
  function renderVector() {
    amplitudeGrid.update(vector)
  }
  find('[data-run]').addEventListener('click', () => {
    try {
      const input: unknown = JSON.parse(vectorInput.value); validateStatevector(input)
      const inverse = find<HTMLSelectElement>('[data-transform]').value === 'inverse'
      vector = transformStatevector(input, inverse); renderVector()
      find('[data-vector-status]').textContent = `${inverse ? 'Inverse' : 'Forward'} QFT of received/input vector / total probability ${vector.reduce((sum, value) => sum + value.real ** 2 + value.imaginary ** 2, 0).toFixed(6)}`
    } catch (error) { find('[data-vector-status]').textContent = error instanceof Error ? error.message : 'Invalid statevector.' }
  })
  find('[data-load]').addEventListener('click', () => {
    try { const input: unknown = JSON.parse(vectorInput.value); validateStatevector(input); vector = input; renderVector(); find('[data-vector-status]').textContent = 'Loaded vector / no transform applied.' } catch (error) { find('[data-vector-status]').textContent = String(error) }
  })
  find('[data-vector-reset]').addEventListener('click', () => { vector = receivedStatevector(); vectorInput.value = JSON.stringify(vector, null, 2); renderVector(); find('[data-vector-status]').textContent = 'Received state restored.' })
  find('[data-download]').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(receivedStatevector(), null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'received-statevector.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  })
  find('[data-erase]').addEventListener('click', () => place(-1))
  find('[data-check-glyphs]').addEventListener('click', () => {
    glyphsVerified = matchesSignal(selected); updateStages(); persist()
    if (!glyphsVerified) find('[data-glyph-status]').textContent = 'Glyph word mismatch. Recheck positions and alphabet indices.'
  })
  find('[data-factor]').addEventListener('click', () => {
    if (!glyphsVerified) return
    try { find('[data-factors]').textContent = factorPackedInteger(parseInteger(find<HTMLInputElement>('[data-factor-input]').value)).join(' x ') } catch (error) { find('[data-factors]').textContent = String(error) }
  })
  function derive() {
    if (!glyphsVerified) return
    clearDecryption()
    try { const key = deriveRsaKey(parseInteger(primeInput.value)); find('[data-key-math]').textContent = `q = ${key.otherPrime}\nphi(n) = ${key.totient}\nd = ${key.privateExponent}`; exponentInput.value = String(key.privateExponent) } catch (error) { find('[data-key-math]').textContent = ''; exponentInput.value = ''; find('[data-rsa-status]').textContent = String(error) }
    persist()
  }
  function decrypt() {
    if (!glyphsVerified || !atlas || disposed) return
    clearDecryption()
    try {
      deriveRsaKey(parseInteger(primeInput.value))
      plaintext = decryptRsa(parseInteger(exponentInput.value))
      renderGlyphText(message, plaintext, atlas)
      find('[data-rsa-status]').textContent = 'RSA decoded / transmission ready.'
      onReady(true)
    } catch (error) { find('[data-rsa-status]').textContent = String(error) }
    persist()
  }
  find('[data-derive]').addEventListener('click', derive)
  find('[data-decrypt-rsa]').addEventListener('click', decrypt)
  for (const input of [primeInput, exponentInput]) input.addEventListener('input', () => { clearDecryption(); find('[data-key-math]').textContent = ''; persist() })
  updateStages(); renderVector(); renderSlots(); onReady(false)
  void atlasPromise.then(glyphs => {
    if (disposed) return
    atlas = glyphs
    CHARACTER_KEYS.slice(0, 26).forEach((letter, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'fourier-key'; button.dataset.glyphIndex = String(index); button.title = `${letter} / index ${index}`; button.setAttribute('aria-label', `${letter}, glyph index ${index}`)
      const image = document.createElement('img'); image.src = glyphs.get(letter)!; image.alt = ''
      const label = document.createElement('span'); label.textContent = `${letter} / ${index}`
      button.append(image, label); button.addEventListener('click', () => place(index)); find('[data-keypad]').append(button)
    })
    renderSlots()
    if (restoreDecryption) decrypt()
  }).catch(() => { if (!disposed) find('[data-glyph-status]').textContent = 'Glyph chart could not load. Reload to retry.' })
  return { element, get ready() { return !!plaintext }, getFeedbackTargets: () => plaintext ? [{ element: message, text: plaintext }] : [], destroy: () => { disposed = true; amplitudeGrid.destroy(); element.remove() } }
}