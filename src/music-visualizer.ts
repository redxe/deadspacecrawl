import type { MusicSpectrum } from './music-player'
import './music-visualizer.css'

export function initializeMusicVisualizer(app: HTMLElement) {
  const canvas = document.createElement('canvas')
  canvas.className = 'music-visualizer'
  canvas.setAttribute('aria-hidden', 'true')
  app.prepend(canvas)
  const context = canvas.getContext('2d')
  const levels = new Float32Array(48)
  let current: MusicSpectrum | null = null
  let width = 0
  let height = 0

  const render = (): void => {
    if (!context) return
    context.clearRect(0, 0, width, height)
    if (!current) return
    const energy = levels.reduce((sum, value) => sum + value, 0) / levels.length
    if (energy < .004) return
    const mobile = width < 640
    const inset = mobile ? 18 : 38
    const baseline = height - (mobile ? 36 : 42)
    const span = width - inset * 2
    const step = span / levels.length
    const maxHeight = Math.min(height * .23, 190)
    const barWidth = Math.max(2, step * .5)
    context.lineWidth = 1
    context.strokeStyle = 'rgba(127,241,224,.2)'
    context.beginPath()
    context.moveTo(inset, baseline)
    context.lineTo(width - inset, baseline)
    context.stroke()

    for (let index = 0; index < levels.length; index++) {
      const level = levels[index]!
      const barHeight = Math.pow(level, 1.35) * maxHeight
      const position = inset + index * step + (step - barWidth) / 2
      context.fillStyle = `rgba(91,239,204,${.2 + level * .55})`
      for (let segment = 0; segment < barHeight; segment += 7) {
        context.fillRect(position, baseline - segment - 4, barWidth, 3)
      }
      if (barHeight > 5) {
        context.fillStyle = `rgba(230,197,122,${.3 + level * .5})`
        context.fillRect(position, baseline - barHeight - 5, barWidth, 2)
      }
      const sideY = height * .18 + index / levels.length * height * .6
      const sideLength = level * Math.min(width * .12, 150)
      context.fillStyle = `rgba(127,241,224,${.15 + level * .5})`
      context.fillRect(inset / 2, sideY, sideLength, 2)
      context.fillRect(width - inset / 2 - sideLength, sideY, sideLength, 2)
    }

    context.strokeStyle = `rgba(171,255,223,${.3 + energy * .6})`
    context.lineWidth = 1.5
    context.shadowBlur = 7
    context.shadowColor = '#7ff1e0'
    context.beginPath()
    current.waveform.forEach((value, index) => {
      const position = inset + index / (current!.waveform.length - 1) * span
      const amplitude = Math.tanh(value * 18) * maxHeight * .35
      const vertical = baseline - 14 - amplitude
      if (index === 0) context.moveTo(position, vertical)
      else context.lineTo(position, vertical)
    })
    context.stroke()
    context.shadowBlur = 0
  }
  const resize = (): void => {
    width = window.innerWidth
    height = window.innerHeight
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    context?.setTransform(ratio, 0, 0, ratio, 0, 0)
    render()
  }
  const update = (spectrum: MusicSpectrum | null): void => {
    current = spectrum
    if (!spectrum) levels.fill(0)
    else spectrum.bands.forEach((value, index) => { levels[index] = levels[index]! * .35 + value * .65 })
    render()
  }
  window.addEventListener('resize', resize)
  resize()
  return {
    update,
    destroy: () => { window.removeEventListener('resize', resize); canvas.remove() },
  }
}