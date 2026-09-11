import { Volume2, VolumeX, createElement } from 'lucide'

export function createTypingAudio() {
  let context: AudioContext | undefined
  let buffer: AudioBuffer | undefined
  let filter: BiquadFilterNode | undefined
  let master: GainNode | undefined
  let muted = false
  let disposed = false
  let pending = false
  let lastClick = -Infinity

  const prepare = (): AudioContext | undefined => {
    if (muted || disposed || document.hidden) return
    try {
      if (!context) {
        context = new AudioContext()
        buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .024), context.sampleRate)
        const samples = buffer.getChannelData(0)
        for (let index = 0; index < samples.length; index++) {
          samples[index] = (Math.random() * 2 - 1) * Math.exp(-index / (context.sampleRate * .0025))
        }
        filter = context.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 2200
        filter.Q.value = .7
        master = context.createGain()
        master.gain.value = .075
        filter.connect(master).connect(context.destination)
      }
      return context
    } catch { return }
  }
  const emit = (audio: AudioContext): void => {
    const source = audio.createBufferSource()
    source.buffer = buffer!
    source.playbackRate.value = .9 + Math.random() * .16
    source.connect(filter!)
    source.onended = () => source.disconnect()
    source.start(audio.currentTime)
  }
  const play = (): void => {
    const requested = performance.now()
    if (requested - lastClick < 28) return
    const audio = prepare()
    if (!audio || audio.state === 'closed') return
    lastClick = requested
    if (audio.state === 'running') { emit(audio); return }
    if (pending) return
    pending = true
    void audio.resume().then(() => {
      if (!muted && !disposed && !document.hidden && audio.state === 'running' && performance.now() - requested < 150) emit(audio)
    }).catch(() => {}).finally(() => { pending = false })
  }
  const suspend = (): void => {
    if (context?.state === 'running') void context.suspend().catch(() => {})
  }
  return {
    play,
    prime: () => { const audio = prepare(); if (audio?.state === 'suspended') void audio.resume().catch(() => {}) },
    suspend,
    setMuted: (next: boolean) => {
      muted = next
      if (context && master && context.state !== 'closed') master.gain.setTargetAtTime(muted ? 0 : .075, context.currentTime, .01)
      if (muted) suspend()
    },
    destroy: () => { disposed = true; if (context && context.state !== 'closed') void context.close().catch(() => {}) },
  }
}

export function initializeTypingSounds(app: HTMLElement, music: {
  toggleMute: () => void
  subscribeMute: (listener: (muted: boolean) => void) => () => void
}) {
  let muted = false
  const audio = createTypingAudio()
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'icon-button audio-mute-toggle'
  const update = (): void => {
    const label = muted ? 'Unmute music and typing sounds' : 'Mute music and typing sounds'
    button.title = label
    button.setAttribute('aria-label', label)
    button.setAttribute('aria-pressed', String(muted))
    const icon = createElement(muted ? VolumeX : Volume2)
    icon.setAttribute('aria-hidden', 'true')
    button.replaceChildren(icon)
  }
  const unsubscribe = music.subscribeMute(next => {
    muted = next
    audio.setMuted(muted)
    update()
  })
  button.addEventListener('click', music.toggleMute)
  app.querySelector('.system-actions')!.append(button)

  const isEditable = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false
    const field = target.closest('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]')
    if (field instanceof HTMLTextAreaElement) return !field.readOnly && !field.disabled
    if (field instanceof HTMLInputElement) return !field.readOnly && !field.disabled && ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(field.type)
    return field instanceof HTMLElement && field.isContentEditable
  }
  const prime = (event: Event): void => { if (event.isTrusted && isEditable(event.target)) audio.prime() }
  const onInput = (event: Event): void => { if (event.isTrusted && !(event as InputEvent).isComposing && isEditable(event.target)) audio.play() }
  const onVisibility = (): void => { if (document.hidden) audio.suspend() }
  const onPageHide = (event: PageTransitionEvent): void => { if (!event.persisted) destroy() }
  const destroy = (): void => {
    document.removeEventListener('pointerdown', prime, true)
    document.removeEventListener('keydown', prime, true)
    document.removeEventListener('input', onInput, true)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    unsubscribe()
    audio.destroy()
    button.remove()
  }
  document.addEventListener('pointerdown', prime, true)
  document.addEventListener('keydown', prime, true)
  document.addEventListener('input', onInput, true)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  return { destroy }
}