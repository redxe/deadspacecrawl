export function createNightChimes() {
  let context: AudioContext | undefined
  let master: GainNode | undefined
  let remaining = 0
  let noteIndex = 0
  let lastLevel = -1
  let disposed = false
  const voices = new Set<OscillatorNode>()
  const notes = [783.99, 1046.5, 659.25, 987.77, 523.25, 1318.51]
  function resume() {
    if (disposed) return
    try {
      if (!context) {
        context = new AudioContext()
        master = context.createGain(); master.gain.value = 0; master.connect(context.destination)
      }
      if (context.state === 'suspended') void context.resume().catch(() => {})
    } catch {}
  }
  function stopVoices() {
    for (const voice of voices) { try { voice.stop() } catch {} }
    voices.clear()
  }
  return {
    resume,
    update(delta: number, amount: number, muted: boolean) {
      if (disposed || !context || !master) return
      const level = muted ? 0 : Math.max(0, Math.min(1, amount)) * .045
      if (Math.abs(lastLevel - level) > .0001) {
        master.gain.cancelScheduledValues(context.currentTime)
        if (!level) master.gain.setValueAtTime(0, context.currentTime)
        else master.gain.setTargetAtTime(level, context.currentTime, .3)
        lastLevel = level
      }
      if (!level || context.state !== 'running') return
      remaining -= delta
      if (remaining > 0) return
      remaining = 2.7 + noteIndex % 3 * .65
      const frequency = notes[noteIndex % notes.length]!
      const pan = context.createStereoPanner(); pan.pan.value = Math.sin(noteIndex * 2.4) * .6; pan.connect(master)
      let sounding = 2
      for (const harmonic of [1, 2.01]) {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = 'sine'; oscillator.frequency.value = frequency * harmonic
        const now = context.currentTime
        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(harmonic === 1 ? .35 : .045, now + .025)
        gain.gain.exponentialRampToValueAtTime(.0001, now + 3.6)
        oscillator.connect(gain); gain.connect(pan); voices.add(oscillator)
        oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); if (--sounding === 0) pan.disconnect() }
        oscillator.start(now); oscillator.stop(now + 3.7)
      }
      noteIndex++
    },
    suspend() {
      stopVoices(); remaining = 0
      if (context && master) {
        master.gain.cancelScheduledValues(context.currentTime); master.gain.setValueAtTime(0, context.currentTime); lastLevel = 0
        void context.suspend().catch(() => {})
      }
    },
    destroy() { disposed = true; stopVoices(); master?.disconnect(); if (context) void context.close().catch(() => {}) },
  }
}