import strudelUrl from '@strudel/web/dist/index.js?url'
import { Play, Pause, createElement } from 'lucide'
import { installRobinVoice } from './robin-voice'
import type { VocalEngine } from './robin-voice'

export type MusicStatus = 'loading' | 'ready' | 'playing' | 'paused' | 'gesture' | 'error' | 'ended'
export interface PlayerState { status: MusicStatus; detail?: string; manual?: boolean }
export interface MusicRange { from: number; to: number }
export interface MusicSpectrum { bands: number[]; waveform: number[] }
export interface MusicCue {
  lyric: { text: string; word: number; progress: number } | null
  beat: { cycle: number; strength: number } | null
}
export interface MusicPlayback { cycles: number; onProgress: (cycle: number) => void; onCue?: (cue: MusicCue | null) => void }

function playerRuntime(code: string, initialVolume: number, autoplay: boolean, playIcon: string, pauseIcon: string, installVoice?: typeof installRobinVoice, cycleLimit = 0): void {
  type Repl = {
    stop: () => void
    pause: () => void
    start: () => Promise<void>
    scheduler: { now: () => number; cps: number; latency?: number }
    state: { pattern?: { queryArc: (begin: number, end: number, state: { _cps: number }) => { context: { locations?: { start: number; end: number }[] }; value?: Record<string, unknown>; whole?: { begin: number; end: number } }[] } }
  }
  type Engine = VocalEngine & {
    initStrudel: (options: Record<string, unknown>) => Promise<Repl>
    evaluate: (source: string) => Promise<unknown>
    hush: () => void
    getSuperdoughAudioController: () => { output: { destinationGain: GainNode } }
  }
  const engine = window as unknown as Engine
  const button = document.querySelector<HTMLButtonElement>('button')!
  const label = document.querySelector<HTMLElement>('[data-status]')!
  let audio: AudioContext
  let repl: Repl | undefined
  let volume = initialVolume
  let spatialGain = 1
  let spatialPan = 0
  let panner: StereoPannerNode | undefined
  let playing = false
  let holding = false
  let pending = false
  let terminated = false
  let evaluationError = ''
  let generation = 0
  let receiveLexicon: ((dictionary: Record<string, string>) => void) | undefined
  let rejectLexicon: ((error: Error) => void) | undefined
  let highlighting = false
  let lastRanges = '[]'
  let analyser: AnalyserNode | undefined
  let spectrumSource: GainNode | undefined
  const frequencyData = new Uint8Array(512)
  const waveData = new Uint8Array(1024)
  const sampleSpectrum = (): void => {
    if (!playing || !volume || !audio || audio.state !== 'running') return
    try {
      if (!analyser) {
        spectrumSource = engine.getSuperdoughAudioController().output.destinationGain
        analyser = audio.createAnalyser()
        analyser.fftSize = 1024
        analyser.minDecibels = -100
        analyser.maxDecibels = -25
        analyser.smoothingTimeConstant = .75
        spectrumSource.connect(analyser)
      }
      analyser.getByteFrequencyData(frequencyData)
      analyser.getByteTimeDomainData(waveData)
      const bands = Array.from({ length: 48 }, (_, index) => {
        const start = Math.floor(Math.pow(512, index / 48)) - 1
        const end = Math.max(start + 1, Math.floor(Math.pow(512, (index + 1) / 48)))
        let peak = 0
        for (let bin = start; bin < end; bin++) peak = Math.max(peak, frequencyData[bin] ?? 0)
        return peak / 255
      })
      const waveform = Array.from({ length: 64 }, (_, index) => ((waveData[index * 16] ?? 128) - 128) / 128)
      parent.postMessage({ type: 'signal-music-spectrum', bands, waveform }, '*')
    } catch {
      analyser?.disconnect()
      if (analyser) spectrumSource?.disconnect(analyser)
      analyser = undefined
    }
  }
  const publishRanges = (ranges: MusicRange[]): void => {
    const signature = JSON.stringify(ranges)
    if (signature === lastRanges) return
    lastRanges = signature
    parent.postMessage({ type: 'signal-music-highlight', ranges }, '*')
  }
  const draw = (): void => {
    if (!playing || !highlighting || !repl) return
    try {
      const cycle = repl.scheduler.now()
      const ranges = new Map<string, MusicRange>()
      const events = Number.isFinite(cycle) && cycle >= 0
        ? repl.state.pattern?.queryArc(cycle, cycle + .000001, { _cps: repl.scheduler.cps }) ?? [] : []
      for (const event of events) {
        for (const { start, end } of event.context.locations ?? []) {
          if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && start < end && end <= code.length) {
            ranges.set(`${start}:${end}`, { from: start, to: end })
          }
          if (ranges.size >= 512) break
        }
        if (ranges.size >= 512) break
      }
      publishRanges([...ranges.values()].sort((first, second) => first.from - second.from || first.to - second.to))
    } catch {
      highlighting = false
      publishRanges([])
    }
  }
  const updateDrawing = (): void => {
    if (!playing || !highlighting) publishRanges([])
  }
  const report = (status: MusicStatus, detail?: string, manual = false): void => {
    if (terminated) return
    label.textContent = detail ?? ({ loading: 'Loading Strudel', ready: 'Ready', playing: 'Playing', paused: 'Paused', gesture: 'Audio needs a click', error: 'Playback error', ended: 'Finished' })[status]
    button.innerHTML = playing ? pauseIcon : playIcon
    button.setAttribute('aria-label', playing ? 'Pause music' : 'Play music')
    button.title = playing ? 'Pause music' : 'Play music'
    parent.postMessage({ type: 'signal-music-state', status, detail, manual }, '*')
  }
  const applyVolume = (immediate = false): void => {
    const gain = engine.getSuperdoughAudioController().output.destinationGain.gain
    if (immediate || audio.state !== 'running') {
      gain.cancelScheduledValues(audio.currentTime)
      gain.setValueAtTime(volume * spatialGain * 0.6, audio.currentTime)
    } else gain.setTargetAtTime(volume * spatialGain * 0.6, audio.currentTime, 0.08)
  }
  const applySpatial = (): void => {
    if (!audio) return
    if (!panner && typeof audio.createStereoPanner === 'function') {
      const output = engine.getSuperdoughAudioController().output.destinationGain
      panner = audio.createStereoPanner()
      panner.connect(audio.destination)
      output.disconnect(audio.destination)
      output.connect(panner)
    }
    panner?.pan.setTargetAtTime(spatialPan, audio.currentTime, .08)
    applyVolume()
  }
  const stop = (manual = false): void => {
    generation += 1
    playing = false
    holding = false
    updateDrawing()
    repl?.stop()
    if (audio && audio.state !== 'closed') void audio.suspend().catch(() => {})
    report('paused', undefined, manual)
  }
  const pause = (manual = false): void => {
    if (!cycleLimit || !playing) { if (!holding) stop(manual); return }
    generation += 1
    playing = false
    holding = true
    updateDrawing()
    repl?.pause()
    void audio.suspend().catch(() => {})
    report('paused', undefined, manual)
  }
  const transport = (): void => {
    if (!cycleLimit || !playing || !repl) return
    const cycle = repl.scheduler.now()
    if (!Number.isFinite(cycle) || cycle < 0) return
    const cue: MusicCue = { lyric: null, beat: null }
    if (volume > 0) {
      try {
        const heard = Math.max(0, cycle - (repl.scheduler.latency ?? .1) * repl.scheduler.cps)
        const events = repl.state.pattern?.queryArc(Math.max(0, heard - .15), heard + .000001, { _cps: repl.scheduler.cps }) ?? []
        let leadGain = 0
        for (const event of events) {
          const value = event.value
          const begin = Number(event.whole?.begin); const end = Number(event.whole?.end)
          if (!value || !Number.isFinite(begin) || !Number.isFinite(end)) continue
          if (value.s === 'robin-formant' && typeof value.lyricLine === 'string' && begin <= heard && end > heard && Number(value.gain) > leadGain) {
            leadGain = Number(value.gain)
            cue.lyric = { text: value.lyricLine, word: Number(value.lyricWord), progress: (Number(value.lyricPart) + Math.max(0, Math.min(1, (heard - begin) / (end - begin)))) / Number(value.lyricParts) }
          }
          const strength = value.robinBeat === 'kick' ? 1 : value.robinBeat === 'snare' ? .6 : value.robinBeat === 'bass' ? .3 : 0
          if (strength && begin <= heard && begin > heard - .15 && (!cue.beat || begin > cue.beat.cycle || begin === cue.beat.cycle && strength > cue.beat.strength)) cue.beat = { cycle: begin, strength }
        }
      } catch {}
    }
    parent.postMessage({ type: 'signal-music-progress', cycle: Math.min(cycle, cycleLimit), cue }, '*')
    if (cycle >= cycleLimit + repl.scheduler.cps * .75) { stop(); report('ended') }
  }
  const play = async (manual = false): Promise<void> => {
    if (pending || terminated) return
    pending = true
    const current = ++generation
    button.disabled = true
    try {
      await Promise.race([audio.resume(), new Promise(resolve => setTimeout(resolve, 1200))])
      if (current !== generation) return
      if (audio.state !== 'running') { report('gesture'); return }
      evaluationError = ''
      applyVolume()
      if (holding) await repl?.start()
      else await engine.evaluate(cycleLimit ? code + '\n.filterWhen(time => time < ' + cycleLimit + ')' : code)
      holding = false
      if (current !== generation) { repl?.stop(); return }
      if (evaluationError) throw new Error(evaluationError)
      playing = true
      updateDrawing()
      report('playing', undefined, manual)
    } catch (error) {
      stop()
      report('error', error instanceof Error ? error.message.slice(0, 240) : 'Unable to play this song.')
    } finally {
      pending = false
      button.disabled = false
    }
  }
  const shutdown = (): void => {
    if (terminated) return
    terminated = true; generation += 1; playing = false; holding = false
    updateDrawing()
    repl?.stop()
    rejectLexicon?.(new Error('Player closed.'))
    if (analyser) spectrumSource?.disconnect(analyser)
    analyser?.disconnect()
    panner?.disconnect()
    if (audio && audio.state !== 'closed') void audio.close().catch(() => {})
  }
  button.addEventListener('click', () => { if (playing) pause(true); else void play(true) })
  window.addEventListener('message', event => {
    if (event.source === parent && event.data?.type === 'signal-music-lexicon') {
      if (event.data.dictionary && typeof event.data.dictionary === 'object') receiveLexicon?.(event.data.dictionary)
      else rejectLexicon?.(new Error('Lyric pronunciations could not load. Restart the player to retry.'))
      return
    }
    if (event.source !== parent || event.data?.type !== 'signal-music-control') return
    if (event.data.action === 'dispose') { shutdown(); return }
    if (terminated) return
    if (event.data.action === 'volume' && typeof event.data.volume === 'number' && Number.isFinite(event.data.volume)) {
      volume = Math.min(1, Math.max(0, event.data.volume))
      if (audio) applyVolume()
    }
    if (event.data.action === 'pause') pause()
    if (event.data.action === 'transport') transport()
    if (event.data.action === 'spatial' && typeof event.data.gain === 'number' && Number.isFinite(event.data.gain) && typeof event.data.pan === 'number' && Number.isFinite(event.data.pan)) {
      spatialGain = Math.max(0, Math.min(1, event.data.gain))
      spatialPan = Math.max(-1, Math.min(1, event.data.pan))
      applySpatial()
    }
    if (event.data.action === 'play' && audio) void play()
    if (event.data.action === 'highlight') {
      highlighting = event.data.enabled === true
      updateDrawing()
    }
    if (event.data.action === 'draw') draw()
    if (event.data.action === 'spectrum') sampleSpectrum()
  })
  window.addEventListener('pagehide', shutdown)
  const initialize = async (): Promise<void> => {
    try {
      audio = new AudioContext()
      repl = await engine.initStrudel({
        audioContext: audio,
        onEvalError: (error: Error) => { evaluationError = error.message },
        onUpdateState: (state: { schedulerError?: Error }) => {
          if (state.schedulerError) { stop(); report('error', String(state.schedulerError).slice(0, 240)) }
        },
      })
      if (terminated) { repl.stop(); return }
      if (/\brobinVoice\s*\(/.test(code) && installVoice) {
        const dictionary = await new Promise<Record<string, string>>((resolve, reject) => {
          receiveLexicon = resolve; rejectLexicon = reject
          parent.postMessage({ type: 'signal-music-lexicon-request' }, '*')
        })
        receiveLexicon = undefined; rejectLexicon = undefined
        await installVoice(audio, engine, dictionary)
      }
      if (terminated) return
      applyVolume(true)
      button.disabled = false
      report('ready')
      if (autoplay) void play()
    } catch (error) {
      report('error', error instanceof Error ? error.message.slice(0, 240) : 'Strudel could not load.')
    }
  }
  report('loading')
  void initialize()
}

export function createMusicPlayer(code: string, volume: number, autoplay: boolean, onState: (state: PlayerState) => void, onHighlight?: (ranges: MusicRange[]) => void, onSpectrum?: (spectrum: MusicSpectrum | null) => void, playback?: MusicPlayback) {
  const frame = document.createElement('iframe')
  frame.title = 'Strudel music playback'
  frame.className = 'music-player-frame'
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.setAttribute('allow', 'autoplay')
  frame.referrerPolicy = 'no-referrer'
  const serialized = JSON.stringify([code, volume, autoplay, createElement(Play).outerHTML, createElement(Pause).outerHTML]).replace(/</g, '\\u003c')
  const source = new URL(strudelUrl, location.href).href.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  const cycleLimit = playback && Number.isFinite(playback.cycles) && playback.cycles > 0 ? Math.min(4096, playback.cycles) : 0
  frame.srcdoc = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box}body{margin:0;background:#071113;color:#c4d9d2;font:13px monospace;display:flex;align-items:center;gap:12px;height:52px}button{display:grid;place-items:center;flex:0 0 42px;height:42px;border:1px solid #7ff1e055;background:#102423;color:#b9fff0;cursor:pointer}button:disabled{opacity:.4;cursor:wait}button:focus-visible{outline:2px solid #e6c57a;outline-offset:2px}svg{width:18px;height:18px}span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    </style></head><body><button type="button" aria-label="Play music" title="Play music" disabled>${createElement(Play).outerHTML}</button><span data-status role="status">Loading Strudel</span><script src="${source}"></script><script>(${playerRuntime.toString()})(...${serialized}, (${installRobinVoice.toString()}), ${cycleLimit})</script></body></html>`
  let disposed = false
  let lexiconRequested = false
  let playing = false
  let highlighting = false
  let visualizing = false
  let animation: number | undefined
  let lastDraw = -Infinity
  const control = (action: string, nextVolume?: number, enabled?: boolean): void => frame.contentWindow?.postMessage({ type: 'signal-music-control', action, volume: nextVolume, enabled }, '*')
  const draw = (timestamp: number): void => {
    animation = undefined
    if (!playing || (!highlighting && !visualizing && !cycleLimit)) return
    if (timestamp - lastDraw >= 1000 / 30) {
      lastDraw = timestamp
      if (highlighting) control('draw')
      if (visualizing) control('spectrum')
      if (cycleLimit) control('transport')
    }
    animation = requestAnimationFrame(draw)
  }
  const updateDrawing = (): void => {
    if (!playing || !highlighting) onHighlight?.([])
    if (!playing || !visualizing) onSpectrum?.(null)
    if (!playing) playback?.onCue?.(null)
    if (playing && (highlighting || visualizing || cycleLimit)) {
      if (animation === undefined) { lastDraw = -Infinity; animation = requestAnimationFrame(draw) }
    } else {
      if (animation !== undefined) cancelAnimationFrame(animation)
      animation = undefined
      onHighlight?.([])
    }
  }
  const receive = (event: MessageEvent): void => {
    if (disposed || event.source !== frame.contentWindow) return
    if (event.data?.type === 'signal-music-progress') {
      if (playing && cycleLimit && typeof event.data.cycle === 'number' && Number.isFinite(event.data.cycle) && event.data.cycle >= 0 && event.data.cycle <= cycleLimit) {
        playback?.onProgress(event.data.cycle)
        const { lyric, beat } = event.data.cue ?? {}
        const validLyric = lyric && typeof lyric.text === 'string' && lyric.text.length <= 240 && Number.isInteger(lyric.word) && lyric.word >= 0 && lyric.word < lyric.text.split(' ').length && typeof lyric.progress === 'number' && Number.isFinite(lyric.progress) && lyric.progress >= 0 && lyric.progress <= 1
        const validBeat = beat && typeof beat.cycle === 'number' && Number.isFinite(beat.cycle) && beat.cycle >= 0 && beat.cycle <= event.data.cycle && typeof beat.strength === 'number' && Number.isFinite(beat.strength) && beat.strength > 0 && beat.strength <= 1
        playback?.onCue?.({ lyric: validLyric ? { text: lyric.text, word: lyric.word, progress: lyric.progress } : null, beat: validBeat ? { cycle: beat.cycle, strength: beat.strength } : null })
      }
      return
    }
    if (event.data?.type === 'signal-music-lexicon-request' && /\brobinVoice\s*\(/.test(code) && !lexiconRequested) {
      lexiconRequested = true
      void import('cmu-pronouncing-dictionary').then(({ dictionary }) => {
        if (disposed) return
        const words = new Set(code.toLowerCase().match(/[a-z]+(?:'[a-z]+)*/g) ?? [])
        const pronunciations = Object.fromEntries([...words].filter(word => Object.hasOwn(dictionary, word)).map(word => [word, dictionary[word]]))
        frame.contentWindow?.postMessage({ type: 'signal-music-lexicon', dictionary: pronunciations }, '*')
      }).catch(() => { if (!disposed) frame.contentWindow?.postMessage({ type: 'signal-music-lexicon', error: true }, '*') })
      return
    }
    if (event.data?.type === 'signal-music-spectrum') {
      if (!playing || !visualizing) return
      const { bands, waveform } = event.data
      if (!Array.isArray(bands) || bands.length !== 48 || !bands.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)) return
      if (!Array.isArray(waveform) || waveform.length !== 64 || !waveform.every(value => typeof value === 'number' && Number.isFinite(value) && value >= -1 && value <= 1)) return
      onSpectrum?.({ bands, waveform })
      return
    }
    if (event.data?.type === 'signal-music-highlight') {
      if (!playing || !highlighting) return
      if (!Array.isArray(event.data.ranges) || event.data.ranges.length > 512) return
      onHighlight?.(event.data.ranges.filter((range: MusicRange | null) => range && Number.isInteger(range.from) && Number.isInteger(range.to) && range.from >= 0 && range.from < range.to && range.to <= code.length))
      return
    }
    if (event.data?.type !== 'signal-music-state') return
    if (!['loading', 'ready', 'playing', 'paused', 'gesture', 'error', 'ended'].includes(event.data.status)) return
    playing = event.data.status === 'playing'
    updateDrawing()
    onState({ status: event.data.status, detail: typeof event.data.detail === 'string' ? event.data.detail.slice(0, 240) : undefined, manual: event.data.manual === true })
  }
  window.addEventListener('message', receive)
  return {
    frame,
    setVolume: (next: number) => control('volume', next),
    setSpatial: (gain: number, pan: number) => frame.contentWindow?.postMessage({ type: 'signal-music-control', action: 'spatial', gain, pan }, '*'),
    setHighlighting: (enabled: boolean) => { highlighting = enabled; control('highlight', undefined, enabled); updateDrawing() },
    setVisualizing: (enabled: boolean) => { visualizing = enabled; updateDrawing() },
    play: () => control('play'),
    pause: () => control('pause'),
    destroy: () => { if (disposed) return; control('dispose'); disposed = true; playing = false; highlighting = false; visualizing = false; updateDrawing(); window.removeEventListener('message', receive); frame.remove() },
  }
}