import { Music2, Plus, Save, Trash2, X, Volume2, VolumeX, RotateCcw, Play, createElement } from 'lucide'
import type { IconNode } from 'lucide'
import { builtInSongs, loadMusicState, saveMusicState, validateSong } from './music-library'
import type { Song } from './music-library'
import { createMusicPlayer } from './music-player'
import type { MusicStatus } from './music-player'
import { initializeMusicEditor } from './music-editor'
import { initializeMusicVisualizer } from './music-visualizer'
import './music.css'

export function initializeMusic(app: HTMLElement, initiallyUnlocked: boolean) {
  const state = loadMusicState()
  const visualizer = initializeMusicVisualizer(app)
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  let unlocked = false
  let player: ReturnType<typeof createMusicPlayer> | undefined
  let status: MusicStatus = 'ready'
  let editingId: string | undefined
  let originalName = ''
  let originalCode = ''
  let resumeOnVisible = state.enabled
  let timeout: ReturnType<typeof setTimeout> | undefined
  let previousVolume = state.volume || 0.25
  let playingCode = ''
  let spatial: { gain: number; pan: number } | null = null
  const muteListeners = new Set<(muted: boolean) => void>()

  const button = (label: string, icon: IconNode): HTMLButtonElement => {
    const element = document.createElement('button')
    element.type = 'button'
    element.className = 'icon-button'
    element.title = label
    element.setAttribute('aria-label', label)
    const image = createElement(icon)
    image.setAttribute('aria-hidden', 'true')
    element.append(image)
    return element
  }
  const trigger = button('Music', Music2)
  trigger.classList.add('music-trigger')
  trigger.dataset.openMusic = ''
  trigger.setAttribute('aria-haspopup', 'dialog')
  trigger.hidden = true
  app.querySelector('.system-actions')!.append(trigger)
  const dialog = document.createElement('dialog')
  dialog.className = 'music-dialog'
  dialog.setAttribute('aria-labelledby', 'music-title')
  dialog.innerHTML = `<header class="music-heading"><div><span>PRIVATE FREQUENCY / STRUDEL</span><h2 id="music-title">Music</h2></div></header>
    <div class="music-body"><fieldset class="music-songs"><legend>Tracks</legend><div data-song-list></div></fieldset>
    <div class="music-transport"><div data-player-host></div><div class="music-volume"><label for="music-volume">Volume</label><input id="music-volume" type="range" min="0" max="100" step="1"><output for="music-volume"></output></div></div>
    <p class="music-status" role="status" data-music-status></p>
    <details class="music-editor"><summary>Strudel score</summary><form><label for="music-name">Title</label><input id="music-name" maxlength="80" required autocomplete="off"><label for="music-code">Strudel code</label><textarea id="music-code" rows="9" maxlength="20000" spellcheck="false" autocapitalize="off" autocomplete="off" required></textarea><div class="music-editor-actions"></div></form></details></div>`
  app.append(dialog)
  const heading = dialog.querySelector<HTMLElement>('.music-heading')!
  const close = button('Close music', X)
  heading.append(close)
  const list = dialog.querySelector<HTMLElement>('[data-song-list]')!
  const host = dialog.querySelector<HTMLElement>('[data-player-host]')!
  const volumeInput = dialog.querySelector<HTMLInputElement>('#music-volume')!
  const volumeOutput = dialog.querySelector<HTMLOutputElement>('output')!
  const feedback = dialog.querySelector<HTMLElement>('[data-music-status]')!
  const editor = dialog.querySelector<HTMLDetailsElement>('details')!
  const form = dialog.querySelector<HTMLFormElement>('form')!
  const nameInput = dialog.querySelector<HTMLInputElement>('#music-name')!
  const codeInput = dialog.querySelector<HTMLTextAreaElement>('#music-code')!
  const scoreEditor = initializeMusicEditor(codeInput)
  const actions = dialog.querySelector<HTMLElement>('.music-editor-actions')!
  const add = button('New song', Plus)
  const preview = button('Play code', Play)
  const save = button('Save song', Save)
  save.type = 'submit'
  const remove = button('Delete song', Trash2)
  const retry = button('Restart player', RotateCcw)
  const mute = button('Mute music', Volume2)
  actions.append(add, preview, save, remove)
  dialog.querySelector('.music-volume')!.append(mute, retry)

  const songs = (): readonly Song[] => [...builtInSongs, ...state.songs]
  const selected = (): Song => songs().find(song => song.id === state.selected) ?? builtInSongs[0]!
  const updateHighlighting = (): void => {
    player?.setHighlighting(dialog.open && editor.open && !document.hidden && codeInput.value === playingCode)
  }
  const updateVisualization = (): void => {
    const enabled = !spatial && !document.hidden && !motion.matches && state.volume > 0
    player?.setVisualizing(enabled)
    if (!enabled) visualizer.update(null)
  }
  motion.addEventListener('change', updateVisualization)
  const notify = (message: string, error = false): void => {
    feedback.textContent = message
    feedback.classList.toggle('music-status--error', error)
  }
  const persist = (): boolean => {
    const saved = saveMusicState(state)
    if (!saved) notify('Browser storage is unavailable or full. Changes last only for this page.', true)
    return saved
  }
  const updateVolume = (): void => {
    if (state.volume) previousVolume = state.volume
    volumeInput.value = String(Math.round(state.volume * 100))
    volumeOutput.value = `${volumeInput.value}%`
    const label = state.volume ? 'Mute music' : 'Unmute music'
    mute.title = label
    mute.setAttribute('aria-label', label)
    mute.setAttribute('aria-pressed', String(state.volume === 0))
    mute.replaceChildren(createElement(state.volume ? Volume2 : VolumeX))
    player?.setVolume(spatial && state.volume > 0 ? 1 : state.volume)
    if (spatial) player?.setSpatial(spatial.gain, spatial.pan)
    updateVisualization()
    muteListeners.forEach(listener => listener(state.volume === 0))
  }
  const toggleMute = (): void => {
    state.volume = state.volume ? 0 : previousVolume
    updateVolume()
    persist()
  }
  const subscribeMute = (listener: (muted: boolean) => void): (() => void) => {
    muteListeners.add(listener)
    listener(state.volume === 0)
    return () => { muteListeners.delete(listener) }
  }
  const loadEditor = (song: Song): void => {
    editingId = song.id.startsWith('custom-') ? song.id : undefined
    originalName = song.name
    originalCode = song.code
    nameInput.value = song.name
    codeInput.value = song.code
    scoreEditor.refresh()
    updateHighlighting()
    remove.disabled = !editingId
    save.title = editingId ? 'Save song' : 'Save as new song'
    save.setAttribute('aria-label', save.title)
  }
  const canDiscard = (): boolean => (nameInput.value === originalName && codeInput.value === originalCode) || window.confirm('Discard unsaved song edits?')
  const mountPlayer = (code = selected().code, autoplay = state.enabled): void => {
    if (!unlocked) return
    clearTimeout(timeout)
    player?.destroy()
    playingCode = code
    scoreEditor.setPlayback(code, [])
    status = 'loading'
    trigger.dataset.playing = 'false'
    notify('Loading Strudel...')
    player = createMusicPlayer(code, state.volume, autoplay && !document.hidden, next => {
      status = next.status
      if (status !== 'loading') clearTimeout(timeout)
      if (status === 'ready') updateVolume()
      if (status !== 'playing') scoreEditor.setPlayback(code, [])
      if (status === 'ready' || status === 'playing') updateHighlighting()
      trigger.dataset.playing = String(status === 'playing')
      trigger.title = status === 'playing' ? `Music: ${selected().name}` : 'Music'
      if (next.manual) {
        state.enabled = status === 'playing'
        resumeOnVisible = state.enabled
      }
      const messages: Record<MusicStatus, string> = {
        loading: 'Loading Strudel...', ready: 'Ready', playing: selected().name,
        paused: 'Paused', gesture: 'Audio permission required. Press Play.', error: 'Unable to play this score.',
      }
      notify(next.detail ?? messages[status], status === 'error')
      if (next.manual) persist()
    }, ranges => scoreEditor.setPlayback(code, ranges), visualizer.update)
    updateVisualization()
    host.replaceChildren(player.frame)
    timeout = setTimeout(() => {
      if (status === 'loading') { player?.destroy(); notify('The music engine did not respond. Restart the player to retry.', true) }
    }, 15000)
  }
  const renderSongs = (): void => {
    list.replaceChildren()
    for (const song of songs()) {
      const row = document.createElement('label')
      row.className = 'music-song'
      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.name = 'music-song'
      radio.value = song.id
      radio.checked = song.id === state.selected
      const text = document.createElement('span')
      const title = document.createElement('strong')
      title.textContent = song.name
      const detail = document.createElement('small')
      detail.textContent = song.detail
      text.append(title, detail)
      row.append(radio, text)
      radio.addEventListener('change', () => {
        if (!canDiscard()) { renderSongs(); return }
        state.selected = song.id
        loadEditor(song)
        mountPlayer()
        persist()
      })
      list.append(row)
    }
  }
  trigger.addEventListener('click', () => { if (unlocked && !dialog.open) { dialog.showModal(); updateHighlighting() } })
  close.addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close() } })
  dialog.addEventListener('close', () => { updateHighlighting(); scoreEditor.setPlayback(playingCode, []); trigger.focus() })
  editor.addEventListener('toggle', updateHighlighting)
  codeInput.addEventListener('input', updateHighlighting)
  volumeInput.addEventListener('input', () => { if (spatial) return; state.volume = Number(volumeInput.value) / 100; updateVolume() })
  volumeInput.addEventListener('change', persist)
  mute.addEventListener('click', toggleMute)
  retry.addEventListener('click', () => mountPlayer())
  add.addEventListener('click', () => {
    if (!canDiscard()) return
    loadEditor({ id: '', name: '', detail: '', code: 'setcps(100/240)\nnote("c4 e4 g4 b4").s("triangle").release(.3).room(.3)' })
    editor.open = true
    nameInput.focus()
  })
  preview.addEventListener('click', () => {
    if (!codeInput.value.trim()) { notify('Enter a Strudel score first.', true); return }
    mountPlayer(codeInput.value, true)
  })
  form.addEventListener('submit', event => {
    event.preventDefault()
    const error = validateSong(nameInput.value, codeInput.value)
    if (error) { notify(error, true); return }
    if (!editingId && state.songs.length >= 30) { notify('The local library holds 30 songs. Delete a song before adding another.', true); return }
    const song: Song = { id: editingId ?? `custom-${crypto.randomUUID()}`, name: nameInput.value.trim(), code: codeInput.value, detail: 'LOCAL COMPOSITION' }
    const index = state.songs.findIndex(item => item.id === song.id)
    if (index < 0) state.songs.push(song)
    else state.songs[index] = song
    state.selected = song.id
    loadEditor(song)
    renderSongs()
    mountPlayer()
    if (persist()) notify('Song saved on this browser.')
  })
  remove.addEventListener('click', () => {
    if (!editingId || !window.confirm('Delete this locally saved song?')) return
    state.songs = state.songs.filter(song => song.id !== editingId)
    state.selected = builtInSongs[0]!.id
    loadEditor(selected())
    renderSongs()
    mountPlayer()
    persist()
  })
  const visibility = (): void => {
    if (!unlocked) return
    updateHighlighting()
    updateVisualization()
    if (document.hidden) {
      resumeOnVisible = status === 'playing' || (status === 'loading' && (state.enabled || !!spatial))
      player?.pause()
    } else if (resumeOnVisible && (state.enabled || spatial)) player?.play()
  }
  document.addEventListener('visibilitychange', visibility)
  const unlock = (): void => {
    if (unlocked) return
    unlocked = true
    trigger.hidden = false
    mountPlayer()
  }
  loadEditor(selected())
  renderSongs()
  updateVolume()
  if (initiallyUnlocked) unlock()
  const destroy = (): void => {
    clearTimeout(timeout)
    player?.destroy()
    scoreEditor.destroy()
    visualizer.destroy()
    motion.removeEventListener('change', updateVisualization)
    muteListeners.clear()
    document.removeEventListener('visibilitychange', visibility)
    trigger.remove()
    dialog.remove()
  }
  window.addEventListener('pagehide', event => { if (!event.persisted) destroy() })
  const setSpatial = (next: { gain: number; pan: number } | null): void => {
    const changingMode = !!next !== !!spatial
    spatial = next
    volumeInput.disabled = !!next
    if (changingMode) {
      player?.setVolume(next && state.volume > 0 ? 1 : state.volume)
      updateVisualization()
    }
    player?.setSpatial(next?.gain ?? 1, next?.pan ?? 0)
  }
  return { unlock, destroy, toggleMute, subscribeMute, setSpatial, resume: () => { if (status !== 'playing' && status !== 'loading') player?.play() }, get muted() { return state.volume === 0 } }
}