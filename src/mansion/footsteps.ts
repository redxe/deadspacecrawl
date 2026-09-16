import { Howl } from 'howler'
import seedrandom from 'seedrandom'

function footstepUrl(): string {
  const sampleRate = 22050
  const samples = Math.round(sampleRate * .22)
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  const write = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)))
  write(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); write(8, 'WAVE'); write(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples * 2, true)
  const random = seedrandom('gallery-footsteps')
  let filtered = 0
  for (let index = 0; index < samples; index++) {
    const time = index / sampleRate
    filtered = filtered * .7 + (random() * 2 - 1) * .3
    const heel = Math.sin(time * Math.PI * 2 * (100 - time * 100)) * Math.exp(-time * 32)
    const sole = filtered * Math.exp(-time * 24) * .6
    const value = (heel * .5 + sole) * Math.min(1, time * 900)
    view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, value)) * 24000, true)
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

export function createFootsteps() {
  const url = footstepUrl()
  const sound = new Howl({ src: [url], format: ['wav'], volume: .22, preload: true })
  let left = false
  return {
    step(quiet: boolean) {
      if (quiet || document.hidden || sound.state() !== 'loaded') return
      const id = sound.play()
      left = !left
      sound.rate(left ? .94 : 1.04, id)
      sound.stereo(left ? -.12 : .12, id)
    },
    stop: () => sound.stop(),
    destroy() { sound.unload(); URL.revokeObjectURL(url) },
  }
}