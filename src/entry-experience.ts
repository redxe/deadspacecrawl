import { ArrowRight, SkipForward, Volume2, VolumeX, createElement } from 'lucide'
import type { IconNode } from 'lucide'

const introKey = 'signal-archive.first-contact.v1'
const muteKey = 'signal-archive.radio-muted.v1'
const message = "If you are who I think you are, we're going to have a lot of fun together..."

function stored(key: string): boolean {
  try { return localStorage.getItem(key) === 'true' } catch { return false }
}

function remember(key: string, value: boolean): void {
  try { localStorage.setItem(key, String(value)) } catch {}
}

function iconButton(label: string, icon: IconNode): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'contact-icon'
  button.title = label
  button.setAttribute('aria-label', label)
  const image = createElement(icon)
  image.setAttribute('aria-hidden', 'true')
  button.append(image)
  return button
}

export function initializeEntryExperience(app: HTMLElement, locked: boolean) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  let muted = stored(muteKey)
  let active = locked
  let celebrating = false
  let context: AudioContext | undefined
  let master: GainNode | undefined
  let staticGain: GainNode | undefined
  let noise: AudioBufferSourceNode | undefined
  let modulation: OscillatorNode | undefined
  let overlay: HTMLElement | undefined
  let finishOverlay: (() => void) | undefined
  let cancelAnimation: (() => void) | undefined
  let disposed = false
  let audioStopped = false

  const sound = iconButton('Enable radio', Volume2)
  sound.classList.add('radio-control')
  sound.hidden = !locked
  document.body.append(sound)

  function updateSound(): void {
    const playing = !muted && context?.state === 'running'
    const label = playing ? 'Mute radio' : 'Enable radio'
    sound.title = label
    sound.setAttribute('aria-label', label)
    sound.setAttribute('aria-pressed', String(playing))
    const icon = createElement(playing ? Volume2 : VolumeX)
    icon.setAttribute('aria-hidden', 'true')
    sound.replaceChildren(icon)
    if (context && master && context.state !== 'closed') master.gain.setTargetAtTime(muted ? 0 : 0.2, context.currentTime, 0.15)
  }

  function startAudio(): void {
    if (disposed || !active || muted || document.hidden) return
    try {
      if (!context) {
        context = new AudioContext()
        master = context.createGain()
        master.gain.value = 0
        master.connect(context.destination)
        staticGain = context.createGain()
        staticGain.gain.value = celebrating ? 0 : 0.16
        const filter = context.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 1700
        filter.Q.value = 0.55
        const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate)
        const samples = buffer.getChannelData(0)
        let previous = 0
        for (let index = 0; index < samples.length; index += 1) {
          previous = previous * 0.55 + (Math.random() * 2 - 1) * 0.45
          samples[index] = previous
        }
        noise = context.createBufferSource()
        noise.buffer = buffer
        noise.loop = true
        noise.connect(filter).connect(staticGain).connect(master)
        modulation = context.createOscillator()
        modulation.frequency.value = 0.7
        const depth = context.createGain()
        depth.gain.value = 0.015
        modulation.connect(depth).connect(staticGain.gain)
        noise.start()
        modulation.start()
        context.onstatechange = updateSound
      }
      void context.resume().then(updateSound).catch(updateSound)
    } catch {
      muted = true
      updateSound()
    }
  }

  function gesture(event: Event): void {
    if (event.target instanceof Node && sound.contains(event.target)) return
    startAudio()
  }
  document.addEventListener('pointerdown', gesture, { passive: true })
  document.addEventListener('keydown', gesture)
  sound.addEventListener('click', () => {
    if (!context || context.state !== 'running') muted = false
    else muted = !muted
    remember(muteKey, muted)
    if (!muted) startAudio()
    updateSound()
  })
  const visibility = (): void => {
    if (!context || context.state === 'closed') return
    if (document.hidden) void context.suspend().catch(() => {})
    else if (active && !muted) void context.resume().catch(() => {})
  }
  document.addEventListener('visibilitychange', visibility)
  updateSound()

  const blocked = new Map<HTMLElement, boolean>()
  function showOverlay(kind: 'intro' | 'unlock'): HTMLElement {
    app.inert = true
    document.querySelectorAll<HTMLElement>('.tool-window').forEach(tool => {
      blocked.set(tool, tool.inert)
      tool.inert = true
    })
    document.body.classList.add('contact-active')
    const element = document.createElement('section')
    element.className = `contact-sequence contact-sequence--${kind}`
    element.setAttribute('role', 'dialog')
    element.setAttribute('aria-modal', 'true')
    element.setAttribute('aria-label', kind === 'intro' ? 'Incoming transmission' : 'Access granted')
    element.tabIndex = -1
    const skip = iconButton(kind === 'intro' ? 'Skip introduction' : 'Continue to puzzle', SkipForward)
    skip.classList.add('contact-skip')
    skip.addEventListener('click', () => finishOverlay?.())
    element.append(skip, sound)
    document.body.append(element)
    overlay = element
    element.addEventListener('keydown', trapFocus)
    skip.focus()
    return element
  }

  function trapFocus(event: KeyboardEvent): void {
    if (!overlay) return
    if (event.key === 'Escape') { event.preventDefault(); finishOverlay?.(); return }
    if (event.key !== 'Tab') return
    const focusable = [...overlay.querySelectorAll<HTMLButtonElement>('button:not([hidden])')]
    const index = focusable.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.shiftKey ? (index <= 0 ? focusable.length - 1 : index - 1) : (index + 1) % focusable.length
    event.preventDefault()
    focusable[next]?.focus()
  }

  function removeOverlay(): void {
    cancelAnimation?.()
    cancelAnimation = undefined
    document.body.append(sound)
    overlay?.remove()
    overlay = undefined
    finishOverlay = undefined
    app.inert = false
    blocked.forEach((inert, tool) => { tool.inert = inert })
    blocked.clear()
    document.body.classList.remove('contact-active')
    app.querySelector<HTMLInputElement>('[data-answer-input]')?.focus()
  }

  function intro(): void {
    const element = showOverlay('intro')
    const content = document.createElement('div')
    content.className = 'contact-transmission'
    content.innerHTML = '<div class="contact-channel"><span class="contact-carrier"></span> INCOMING / UNKNOWN CALLER</div><p class="contact-handshake" aria-hidden="true">carrier found<br>... is this reaching you?</p><h1 class="contact-message"></h1><div class="contact-tail" aria-hidden="true">PRIVATE LINE / NO RECORDING</div>'
    const line = content.querySelector<HTMLElement>('.contact-message')!
    line.setAttribute('aria-label', message)
    const typed = document.createElement('span')
    typed.setAttribute('aria-hidden', 'true')
    line.append(typed)
    const proceed = iconButton('Establish link', ArrowRight)
    proceed.classList.add('contact-proceed')
    const label = document.createElement('span')
    label.textContent = 'Establish link'
    proceed.prepend(label)
    proceed.hidden = true
    proceed.addEventListener('click', () => finishOverlay?.())
    content.append(proceed)
    element.append(content)
    finishOverlay = () => {
      remember(introKey, true)
      removeOverlay()
    }
    if (motion.matches) {
      typed.textContent = message
      proceed.hidden = false
      return
    }
    const prefix = "If you are who I think you are, we're going to have a lot of fun "
    const frames: Array<{ text: string; time: number }> = []
    let text = ''
    let time = 650
    const type = (value: string): void => {
      for (const character of value) {
        text += character
        time += character === ',' ? 360 : character === ' ' ? 38 : 32 + frames.length % 4 * 13
        frames.push({ text, time })
      }
    }
    type(prefix + 'togehter')
    time += 580
    for (let count = 0; count < 4; count += 1) {
      text = text.slice(0, -1)
      time += 90
      frames.push({ text, time })
    }
    time += 210
    type('ther...')
    let elapsed = 0
    let previousTime = performance.now()
    let index = 0
    let frame = 0
    const tick = (now: number): void => {
      if (!document.hidden) elapsed += Math.min(80, now - previousTime)
      previousTime = now
      while (index < frames.length && elapsed >= frames[index]!.time) typed.textContent = frames[index++]!.text
      if (index === frames.length) proceed.hidden = false
      if (elapsed > time + 3200) { finishOverlay?.(); return }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    cancelAnimation = () => cancelAnimationFrame(frame)
  }

  function stopAudio(): void {
    active = false
    sound.hidden = true
    if (!audioStopped) { noise?.stop(); modulation?.stop(); audioStopped = true }
    if (context && context.state !== 'closed') void context.close().catch(() => {})
    document.removeEventListener('pointerdown', gesture)
    document.removeEventListener('keydown', gesture)
    document.removeEventListener('visibilitychange', visibility)
  }

  function celebrate(reveal: () => void, onComplete?: () => void): void {
    if (celebrating || disposed) return
    celebrating = true
    startAudio()
    if (context && staticGain && master) {
      const now = context.currentTime
      staticGain.gain.cancelScheduledValues(now)
      staticGain.gain.setTargetAtTime(0, now, 0.65)
      modulation?.disconnect()
      for (const [index, frequency] of [130.81, 196, 261.63, 329.63, 392].entries()) {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(0.055, now + 1.2 + index * 0.16)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 6.8)
        oscillator.connect(gain).connect(master)
        oscillator.start()
        oscillator.stop(now + 7)
      }
    }
    const element = showOverlay('unlock')
    const canvas = document.createElement('canvas')
    canvas.className = 'contact-aperture'
    canvas.setAttribute('aria-hidden', 'true')
    element.prepend(canvas)
    const content = document.createElement('div')
    content.className = 'contact-success'
    content.innerHTML = '<span class="contact-channel">IDENTITY CONFIRMED / ALL THREE SEALS</span><h1>There you are.</h1><p>Congratulations. I knew it was you, Ferry &lt;3</p><div class="contact-access">ACCESS GRANTED</div>'
    element.append(content)
    let revealed = false
    let complete = false
    let scene: { render: (progress: number) => void; destroy: () => void } | undefined
    const revealOnce = (): void => {
      if (revealed) return
      revealed = true
      reveal()
    }
    finishOverlay = () => {
      if (complete) return
      complete = true
      scene?.destroy()
      stopAudio()
      revealOnce()
      removeOverlay()
      onComplete?.()
    }
    if (!motion.matches) {
      void import('./unlock-scene').then(({ createUnlockScene }) => {
        if (!complete) scene = createUnlockScene(canvas)
      }).catch(() => { canvas.hidden = true })
    } else canvas.hidden = true
    let elapsed = 0
    let previous = performance.now()
    let frame = 0
    const duration = motion.matches ? 2600 : 8600
    const tick = (now: number): void => {
      if (!document.hidden) elapsed += Math.min(now - previous, 80)
      previous = now
      const progress = Math.min(1, elapsed / duration)
      scene?.render(progress)
      if (progress >= 0.76) {
        revealOnce()
        element.classList.add('contact-sequence--departing')
      }
      if (progress >= 1) { finishOverlay?.(); return }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    cancelAnimation = () => cancelAnimationFrame(frame)
  }

  const onMotion = (): void => {
    if (motion.matches && overlay) finishOverlay?.()
  }
  motion.addEventListener('change', onMotion)
  if (locked && !stored(introKey)) intro()

  return {
    celebrate,
    get busy() { return !!overlay },
    destroy: () => {
      disposed = true
      finishOverlay?.()
      stopAudio()
      sound.remove()
      motion.removeEventListener('change', onMotion)
    },
  }
}