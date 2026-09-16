import type { MusicCue } from '../music-player'

export interface FountainPulse { age: number; strength: number }

export function createFountainResponse() {
  let previousCycle = 0
  let lastBeat = -Infinity
  let beats: { cycle: number; strength: number }[] = []
  return {
    update(cycle: number, playing: boolean, motion: boolean, beat?: MusicCue['beat']) {
      if (!playing || !motion || cycle < previousCycle) { beats = []; lastBeat = -Infinity }
      previousCycle = cycle
      if (!playing || !motion) return { pulses: [] as FountainPulse[], impact: 0 }
      if (beat && Number.isFinite(beat.cycle) && beat.cycle <= cycle && beat.cycle > lastBeat + .16 && cycle - beat.cycle < .2) {
        beats.push({ cycle: beat.cycle, strength: Math.max(0, Math.min(1, beat.strength)) })
        lastBeat = beat.cycle
      }
      beats = beats.filter(value => cycle - value.cycle < 1.04).slice(-3)
      const pulses = beats.map(value => ({ age: (cycle - value.cycle) * 240 / 104, strength: value.strength }))
      return { pulses, impact: Math.min(1, pulses.reduce((sum, value) => sum + value.strength * Math.exp(-value.age * 5), 0)) }
    },
  }
}