import strudelUrl from '@strudel/web/dist/index.js?url'
import { Play, Pause, createElement } from 'lucide'

export type MusicStatus = 'loading' | 'ready' | 'playing' | 'paused' | 'gesture' | 'error'
export interface PlayerState { status: MusicStatus; detail?: string; manual?: boolean }
export interface MusicRange { from: number; to: number }
export interface MusicSpectrum { bands: number[]; waveform: number[] }

function playerRuntime(code: string, initialVolume: number, autoplay: boolean, playIcon: string, pauseIcon: string): void {
  type Repl = {
    stop: () => void
    scheduler: { now: () => number; cps: number }
    state: { pattern?: { queryArc: (begin: number, end: number, state: { _cps: number }) => { context: { locations?: { start: number; end: number }[] } }[] } }
  }
  type Engine = {
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
  let playing = false
  let pending = false
  let evaluationError = ''
  let generation = 0
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
    label.textContent = detail ?? ({ loading: 'Loading Strudel', ready: 'Ready', playing: 'Playing', paused: 'Paused', gesture: 'Audio needs a click', error: 'Playback error' })[status]
    button.innerHTML = playing ? pauseIcon : playIcon
    button.setAttribute('aria-label', playing ? 'Pause music' : 'Play music')
    button.title = playing ? 'Pause music' : 'Play music'
    parent.postMessage({ type: 'signal-music-state', status, detail, manual }, '*')
  }
  const applyVolume = (immediate = false): void => {
    const gain = engine.getSuperdoughAudioController().output.destinationGain.gain
    if (immediate || audio.state !== 'running') {
      gain.cancelScheduledValues(audio.currentTime)
      gain.setValueAtTime(volume * 0.6, audio.currentTime)
    } else gain.setTargetAtTime(volume * 0.6, audio.currentTime, 0.08)
  }
  const stop = (manual = false): void => {
    generation += 1
    playing = false
    updateDrawing()
    repl?.stop()
    if (audio && audio.state !== 'closed') void audio.suspend().catch(() => {})
    report('paused', undefined, manual)
  }
  const play = async (manual = false): Promise<void> => {
    if (pending) return
    pending = true
    const current = ++generation
    button.disabled = true
    try {
      await Promise.race([audio.resume(), new Promise(resolve => setTimeout(resolve, 1200))])
      if (current !== generation) return
      if (audio.state !== 'running') { report('gesture'); return }
      evaluationError = ''
      applyVolume()
      await engine.evaluate(code)
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
  button.addEventListener('click', () => { if (playing) stop(true); else void play(true) })
  window.addEventListener('message', event => {
    if (event.source !== parent || event.data?.type !== 'signal-music-control') return
    if (event.data.action === 'volume' && typeof event.data.volume === 'number' && Number.isFinite(event.data.volume)) {
      volume = Math.min(1, Math.max(0, event.data.volume))
      if (audio) applyVolume()
    }
    if (event.data.action === 'pause') stop()
    if (event.data.action === 'play' && audio) void play()
    if (event.data.action === 'highlight') {
      highlighting = event.data.enabled === true
      updateDrawing()
    }
    if (event.data.action === 'draw') draw()
    if (event.data.action === 'spectrum') sampleSpectrum()
  })
  window.addEventListener('pagehide', () => {
    playing = false
    updateDrawing()
    repl?.stop()
    if (analyser) spectrumSource?.disconnect(analyser)
    analyser?.disconnect()
    if (audio && audio.state !== 'closed') void audio.close().catch(() => {})
  })
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

export function createMusicPlayer(code: string, volume: number, autoplay: boolean, onState: (state: PlayerState) => void, onHighlight?: (ranges: MusicRange[]) => void, onSpectrum?: (spectrum: MusicSpectrum | null) => void) {
  const frame = document.createElement('iframe')
  frame.title = 'Strudel music playback'
  frame.className = 'music-player-frame'
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.setAttribute('allow', 'autoplay')
  frame.referrerPolicy = 'no-referrer'
  const serialized = JSON.stringify([code, volume, autoplay, createElement(Play).outerHTML, createElement(Pause).outerHTML]).replace(/</g, '\\u003c')
  const source = new URL(strudelUrl, location.href).href.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  frame.srcdoc = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box}body{margin:0;background:#071113;color:#c4d9d2;font:13px monospace;display:flex;align-items:center;gap:12px;height:52px}button{display:grid;place-items:center;flex:0 0 42px;height:42px;border:1px solid #7ff1e055;background:#102423;color:#b9fff0;cursor:pointer}button:disabled{opacity:.4;cursor:wait}button:focus-visible{outline:2px solid #e6c57a;outline-offset:2px}svg{width:18px;height:18px}span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    </style></head><body><button type="button" aria-label="Play music" title="Play music" disabled>${createElement(Play).outerHTML}</button><span data-status role="status">Loading Strudel</span><script src="${source}"></script><script>(${playerRuntime.toString()})(...${serialized})</script></body></html>`
  let playing = false
  let highlighting = false
  let visualizing = false
  let animation: number | undefined
  let lastDraw = -Infinity
  const control = (action: string, nextVolume?: number, enabled?: boolean): void => frame.contentWindow?.postMessage({ type: 'signal-music-control', action, volume: nextVolume, enabled }, '*')
  const draw = (timestamp: number): void => {
    animation = undefined
    if (!playing || (!highlighting && !visualizing)) return
    if (timestamp - lastDraw >= 1000 / 30) {
      lastDraw = timestamp
      if (highlighting) control('draw')
      if (visualizing) control('spectrum')
    }
    animation = requestAnimationFrame(draw)
  }
  const updateDrawing = (): void => {
    if (!playing || !highlighting) onHighlight?.([])
    if (!playing || !visualizing) onSpectrum?.(null)
    if (playing && (highlighting || visualizing)) {
      if (animation === undefined) { lastDraw = -Infinity; animation = requestAnimationFrame(draw) }
    } else {
      if (animation !== undefined) cancelAnimationFrame(animation)
      animation = undefined
      onHighlight?.([])
    }
  }
  const receive = (event: MessageEvent): void => {
    if (event.source !== frame.contentWindow) return
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
    if (!['loading', 'ready', 'playing', 'paused', 'gesture', 'error'].includes(event.data.status)) return
    playing = event.data.status === 'playing'
    updateDrawing()
    onState({ status: event.data.status, detail: typeof event.data.detail === 'string' ? event.data.detail.slice(0, 240) : undefined, manual: event.data.manual === true })
  }
  window.addEventListener('message', receive)
  return {
    frame,
    setVolume: (next: number) => control('volume', next),
    setHighlighting: (enabled: boolean) => { highlighting = enabled; control('highlight', undefined, enabled); updateDrawing() },
    setVisualizing: (enabled: boolean) => { visualizing = enabled; updateDrawing() },
    play: () => control('play'),
    pause: () => control('pause'),
    destroy: () => { highlighting = false; visualizing = false; updateDrawing(); window.removeEventListener('message', receive); frame.remove() },
  }
}