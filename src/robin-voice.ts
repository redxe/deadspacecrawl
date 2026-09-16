interface VocalPattern {
  slow: (factor: number) => VocalPattern
}

export interface VocalEngine {
  registerSound: (name: string, trigger: (time: number, value: Record<string, unknown>, ended: () => void) => { node: GainNode; stop: (time: number) => void }, options: Record<string, unknown>) => void
  evalScope: (scope: Record<string, unknown>) => Promise<unknown>
  pure: (value: Record<string, unknown>) => VocalPattern
  timeCat: (...parts: [number, VocalPattern][]) => VocalPattern
  slowcat: (...patterns: VocalPattern[]) => VocalPattern
  silence: VocalPattern
}

export function installRobinVoice(audio: BaseAudioContext, engine: VocalEngine, dictionary: Record<string, string>) {
  const vowels: Record<string, number[]> = {
    AA: [850, 1220, 2810], AE: [860, 1850, 2800], AH: [700, 1350, 2700], AO: [620, 920, 2650],
    EH: [650, 1850, 2850], ER: [480, 1350, 1750], IH: [430, 2100, 2900], IY: [310, 2450, 3250],
    UH: [460, 1200, 2650], UW: [340, 880, 2450], EY: [590, 1900, 2900], AY: [800, 1350, 2800],
    AW: [780, 1350, 2750], OW: [530, 1000, 2600], OY: [610, 980, 2700],
  }
  const diphthongs: Record<string, string> = { EY: 'IY', AY: 'IY', AW: 'UW', OW: 'UW', OY: 'IY' }
  const sonorants: Record<string, number[]> = { M: [250, 1100, 2200], N: [300, 1500, 2400], NG: [300, 1800, 2600], L: [400, 1300, 2550], R: [430, 1200, 1600], W: [310, 800, 2250], Y: [300, 2250, 3100] }
  const fricatives: Record<string, number[]> = { S: [7800, .18], Z: [6500, .13], SH: [3900, .17], ZH: [3500, .13], F: [6000, .12], V: [5200, .1], TH: [6200, .1], DH: [4500, .08], HH: [1700, .07], CH: [4200, .2], JH: [3600, .16] }
  const stops: Record<string, number[]> = { P: [1100, .16], B: [800, .12], T: [5500, .17], D: [3200, .13], K: [2400, .18], G: [1800, .13] }
  const voiced = new Set(['B', 'D', 'G', 'V', 'Z', 'ZH', 'DH', 'JH'])
  const noise = audio.createBuffer(1, Math.ceil(audio.sampleRate * .5), audio.sampleRate)
  const samples = noise.getChannelData(0)
  let seed = 314159
  for (let index = 0; index < samples.length; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    samples[index] = seed / 2147483648 - 1
  }
  const harmonics = new Float32Array(49)
  for (let harmonic = 1; harmonic < harmonics.length; harmonic++) harmonics[harmonic] = Math.pow(harmonic, -1.18) * Math.exp(-harmonic / 32)
  const glottis = audio.createPeriodicWave(new Float32Array(harmonics.length), harmonics)

  function pronunciation(word: string, overrides: Record<string, string>): string[] {
    const key = word.toLowerCase()
    const entry = overrides[key] ?? dictionary[key]
    if (!entry) throw new Error('No pronunciation for "' + word + '". Add it to pronunciation using ARPABET, for example robin: "R AA1 B IH0 N".')
    const phones = entry.trim().split(/\s+/)
    if (!phones.length || phones.some(phone => { const plain = phone.replace(/[012]/g, ''); return !vowels[plain] && !sonorants[plain] && !fricatives[plain] && !stops[plain] })) throw new Error('Invalid pronunciation for "' + word + '".')
    return phones
  }

  function syllables(phones: string[]): string[][] {
    const nuclei = phones.flatMap((phone, index) => vowels[phone.replace(/[012]/g, '')] ? [index] : [])
    if (!nuclei.length) throw new Error('Each word needs at least one vowel.')
    let start = 0
    return nuclei.map((nucleus, index) => {
      const next = nuclei[index + 1]
      const end = next === undefined ? phones.length : Math.max(nucleus + 1, next - 1)
      const syllable = phones.slice(start, end); start = end
      return syllable
    })
  }

  function robinVoice(lines: string[], melodies: number[][], options: { barsPerLine?: number; pronunciation?: Record<string, string>; harmony?: number; formant?: number } = {}) {
    if (!Array.isArray(lines) || !lines.length || lines.length > 32 || !Array.isArray(melodies) || !melodies.length) throw new Error('Use 1 to 32 lyric lines and at least one melody.')
    const bars = options.barsPerLine ?? 2
    const formant = options.formant ?? 1.08
    if (!Number.isFinite(bars) || bars < 1 || bars > 8 || !Number.isFinite(formant) || formant < .8 || formant > 1.3) throw new Error('Invalid vocal timing or formant setting.')
    return engine.slowcat(...lines.map((line, lineIndex) => {
      if (typeof line !== 'string' || line.length > 240) throw new Error('Keep lyric lines below 240 characters.')
      const words = line.toLowerCase().match(/[a-z]+(?:'[a-z]+)*|~/g) ?? []
      const pitches = melodies[lineIndex % melodies.length]!
      if (!pitches.length || pitches.some(pitch => !Number.isFinite(pitch) || pitch < 48 || pitch > 90)) throw new Error('Use MIDI melody notes between 48 and 90.')
      let syllableIndex = 0
      const parts: [number, VocalPattern][] = []
      words.forEach((word, wordIndex) => {
        if (word === '~') { parts.push([.8, engine.silence]); return }
        syllables(pronunciation(word, options.pronunciation ?? {})).forEach((phones, phoneIndex, all) => {
          const final = wordIndex === words.length - 1 && phoneIndex === all.length - 1
          const stress = phones.some(phone => phone.includes('1'))
          const pitch = pitches[syllableIndex++ % pitches.length]! + (options.harmony ?? 0)
          const weight = final ? 2.15 : stress ? 1.15 : .85
          parts.push([weight, engine.pure({ s: 'robin-formant', note: pitch, phonemes: phones.join(' '), lyric: word, lyricLine: words.filter(value => value !== '~').join(' '), lyricWord: words.slice(0, wordIndex).filter(value => value !== '~').length, lyricPart: phoneIndex, lyricParts: all.length, formant, velocity: stress ? 1 : .87 })])
        })
      })
      if (!parts.length) return engine.silence
      parts.push([1.05, engine.silence])
      return engine.timeCat(...parts)
    })).slow(bars)
  }

  engine.registerSound('robin-formant', (time, value, ended) => {
    const duration = Math.min(4, Math.max(.08, Number(value.duration) || .25))
    const pitch = Math.min(96, Math.max(36, Number(value.note) || 72))
    const frequency = 440 * Math.pow(2, (pitch - 69) / 12)
    const formant = Math.min(1.3, Math.max(.8, Number(value.formant) || 1.08))
    const phones = String(value.phonemes ?? 'AH').split(/\s+/).map(phone => phone.replace(/[012]/g, ''))
    const output = audio.createGain()
    const tone = audio.createBiquadFilter(); tone.type = 'highshelf'; tone.frequency.value = 3200; tone.gain.value = -4
    const air = audio.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 7600; air.Q.value = .5
    tone.connect(air); air.connect(output)
    const carrier = audio.createOscillator(); carrier.setPeriodicWave(glottis)
    carrier.frequency.setValueAtTime(frequency * .987, time)
    carrier.frequency.exponentialRampToValueAtTime(frequency, time + Math.min(.07, duration * .2))
    const voicedGain = audio.createGain(); voicedGain.gain.value = 0; carrier.connect(voicedGain)
    const filters = [0, 1, 2].map(index => {
      const filter = audio.createBiquadFilter(); filter.type = 'bandpass'
      const level = audio.createGain(); level.gain.value = [3.1, 2, .8][index]!
      voicedGain.connect(filter); filter.connect(level); level.connect(tone)
      return { filter, level }
    })
    const breath = audio.createBufferSource(); breath.buffer = noise; breath.loop = true
    const noiseFilter = audio.createBiquadFilter(); noiseFilter.type = 'bandpass'; noiseFilter.Q.value = .85
    const noiseGain = audio.createGain(); noiseGain.gain.value = 0
    breath.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(tone)
    const vibrato = audio.createOscillator(); vibrato.frequency.value = 5.3
    const vibratoDepth = audio.createGain(); vibratoDepth.gain.setValueAtTime(0, time)
    vibratoDepth.gain.linearRampToValueAtTime(9, time + Math.min(.32, duration * .65))
    vibrato.connect(vibratoDepth); vibratoDepth.connect(carrier.detune)
    output.gain.setValueAtTime(0, time); output.gain.linearRampToValueAtTime(.5, time + .025)
    output.gain.setValueAtTime(.5, time + duration * .88); output.gain.linearRampToValueAtTime(0, time + duration + .035)
    const weight = (phone: string) => vowels[phone] ? 1 : stops[phone] ? .12 : fricatives[phone] ? .22 : .18
    const total = phones.reduce((sum, phone) => sum + weight(phone), 0)
    let cursor = time
    phones.forEach(phone => {
      const length = duration * weight(phone) / total
      const vowel = vowels[phone]
      const frequencies = vowel ?? sonorants[phone] ?? [500, 1500, 2600]
      filters.forEach(({ filter }, index) => {
        filter.frequency.setTargetAtTime(frequencies[index]! * formant, cursor, .012)
        filter.Q.setTargetAtTime(frequencies[index]! * formant / [130, 180, 260][index]!, cursor, .012)
        if (diphthongs[phone]) filter.frequency.setTargetAtTime(vowels[diphthongs[phone]!]![index]! * formant, cursor + length * .6, Math.max(.012, length * .12))
      })
      voicedGain.gain.setTargetAtTime(vowel ? .3 : sonorants[phone] ? .17 : voiced.has(phone) ? .07 : 0, cursor, .008)
      const unvoiced = fricatives[phone] ?? stops[phone]
      noiseFilter.frequency.setTargetAtTime(unvoiced?.[0] ?? 2200, cursor, .003)
      noiseGain.gain.setTargetAtTime(unvoiced?.[1] ?? (vowel ? .006 : .003), cursor + (stops[phone] ? length * .45 : 0), .004)
      if (stops[phone]) noiseGain.gain.setTargetAtTime(0, cursor + length * .85, .004)
      cursor += length
    })
    const sources = [carrier, breath, vibrato]
    let finished = false
    carrier.onended = () => {
      if (finished) return
      finished = true
      sources.forEach(source => source.disconnect())
      ;[voicedGain, noiseFilter, noiseGain, vibratoDepth, tone, air, output, ...filters.flatMap(({ filter, level }) => [filter, level])].forEach(node => node.disconnect())
      ended()
    }
    sources.forEach(source => { source.start(time); source.stop(time + duration + .06) })
    return { node: output, stop: end => { sources.forEach(source => { try { source.stop(end) } catch {} }) } }
  }, { type: 'synth', prebake: false })
  return engine.evalScope({ robinVoice })
}