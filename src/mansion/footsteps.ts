import { Howl } from 'howler'
import seedrandom from 'seedrandom'

export const footstepDistance = .775
const sampleRate = 22050

function waveUrl(data: Float32Array): string {
  const samples = data.length
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  const write = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)))
  write(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); write(8, 'WAVE'); write(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples * 2, true)
  for (let index = 0; index < samples; index++) {
    view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, data[index]!)) * 24000, true)
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

export function createFootsteps() {
  const random = seedrandom('gallery-taps')
  const tap = Float32Array.from({ length: sampleRate * .16 }, (_, index) => {
    const time = index / sampleRate
    const body = Math.sin(time * Math.PI * 2 * 430) * .34 + Math.sin(time * Math.PI * 2 * 760) * .08
    return (body * Math.exp(-time * 65) + (random() * 2 - 1) * .07 * Math.exp(-time * 140)) * Math.min(1, time * 420)
  })
  const urls = [waveUrl(tap)]
  const makeSound = (url: string) => new Howl({ src: [url], format: ['wav'], volume: .12, preload: true })
  const sound = makeSound(urls[0]!)
  const rooms: Howl[] = []
  let disposed = false
  async function renderRoom(decay: number, index: number) {
    if (typeof OfflineAudioContext === 'undefined') return
    const context = new OfflineAudioContext(1, Math.ceil(sampleRate * (decay + .2)), sampleRate)
    const buffer = context.createBuffer(1, tap.length, sampleRate)
    buffer.copyToChannel(tap, 0)
    const source = context.createBufferSource(); source.buffer = buffer
    const impulse = context.createBuffer(1, Math.ceil(sampleRate * decay), sampleRate)
    const response = impulse.getChannelData(0)
    const noise = seedrandom(`gallery-room-${decay}`)
    for (let sample = Math.ceil(sampleRate * .018); sample < response.length; sample++) response[sample] = (noise() * 2 - 1) * Math.exp(-sample / response.length * 7)
    const reverb = context.createConvolver(); reverb.buffer = impulse
    source.connect(reverb); reverb.connect(context.destination); source.start()
    const rendered = await context.startRendering()
    if (disposed) return
    const url = waveUrl(rendered.getChannelData(0)); urls.push(url); rooms[index] = makeSound(url)
  }
  void Promise.all([renderRoom(.5, 0), renderRoom(1.8, 1)]).catch(() => {})
  let left = false
  return {
    step(quiet: boolean, room = 0) {
      if (disposed || quiet || document.hidden || sound.state() !== 'loaded') return
      const id = sound.play()
      left = !left
      const rate = left ? .98 : 1.025
      sound.rate(rate, id)
      sound.stereo(left ? -.1 : .1, id)
      const blend = Math.max(0, Math.min(1, room))
      rooms.forEach((echo, index) => {
        if (echo.state() !== 'loaded') return
        const volume = index ? blend * .1 : (1 - blend) * .045
        if (!volume) return
        const voice = echo.play(); echo.volume(volume, voice); echo.rate(rate, voice)
      })
    },
    stop() { sound.stop(); rooms.forEach(room => room.stop()) },
    destroy() { disposed = true; sound.unload(); rooms.forEach(room => room.unload()); urls.forEach(url => URL.revokeObjectURL(url)) },
  }
}