import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Footprints, ImagePlus, Maximize, Minimize, MousePointer2, Volume2, VolumeX, X, createElement } from 'lucide'
import type { IconNode } from 'lucide'
import { createScenery } from './scenery'
import { createFootsteps, footstepDistance } from './footsteps'
import { createFairySequence } from './fairy'
import { floorHeight, movePosition, spatialMusic } from './layout'
import { loadGallery, openGalleryEditor, resizePicture } from './pictures'
import type { Gallery } from './pictures'
import './world.css'

export interface MansionAudio {
  setSpatial: (state: { gain: number; pan: number } | null) => void
  resume: () => void
  muted: () => boolean
  toggleMute: () => void
  spectrum?: () => { bands: readonly number[] } | null
}

export function openMansion(audio: MansionAudio, onClose: () => void, introduction?: { onComplete: () => void }) {
  const root = document.createElement('section')
  root.className = 'mansion-world mansion-world--entering'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-label', 'The gallery')
  root.tabIndex = -1
  root.innerHTML = `<canvas class="mansion-canvas" tabindex="0" aria-label="Mansion. Arrow keys or WASD to walk. Drag or lock the mouse to look."></canvas><header class="mansion-hud"><div class="mansion-location"><span>THE GALLERY</span><strong data-room>East Hall</strong></div><div class="mansion-actions"></div></header><div class="mansion-reticle" aria-hidden="true"></div><p class="mansion-status" role="status" aria-live="polite"></p><div class="mansion-touch" aria-label="Walking controls"></div><input type="file" accept="image/jpeg,image/png,image/webp" hidden><div class="mansion-transition" aria-hidden="true"></div>`
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!
  canvas.setAttribute('aria-label', 'Mansion. Arrow keys or WASD to walk. Click to capture mouse look; Escape releases it. Drag to look on touch screens.')
  const actions = root.querySelector<HTMLElement>('.mansion-actions')!
  const status = root.querySelector<HTMLElement>('.mansion-status')!
  const fileInput = root.querySelector<HTMLInputElement>('input')!
  const app = document.querySelector<HTMLElement>('#app')!
  const previousFocus = document.activeElement as HTMLElement | null
  const previousInert = app.inert
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)')
  let motion = !motionPreference.matches
  let disposed = false
  let editor: Awaited<ReturnType<typeof openGalleryEditor>> | undefined
  let editing = false
  let uploading = false
  let frameId = ''
  let dragging: { x: number; y: number; moved: boolean } | undefined
  let position = { x: 0, z: 1.3 }
  let stride = 0
  let sinceStep = 0
  let previousTime = 0
  let renderTime = 0
  let audioTime = 0
  let animation = 0
  let transitionTimer: ReturnType<typeof setTimeout> | undefined
  let fairy: ReturnType<typeof createFairySequence> | undefined
  const pressed = new Set<string>()
  const cleanup: Array<() => void> = []
  const loadedTextures = new Set<THREE.Texture>()
  const imageVersions = new Map<string, number>()
  let gallery: Gallery = { version: 1, images: {} }
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#c8dce1')
  scene.fog = new THREE.Fog('#c8dce1', 38, 140)
  const camera = new THREE.PerspectiveCamera(68, 1, .08, 180)
  camera.rotation.order = 'YXZ'
  camera.position.set(position.x, 1.65, position.z)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  const hemisphere = new THREE.HemisphereLight('#e5f2ff', '#696457', 1.1)
  scene.add(hemisphere)
  const sun = new THREE.DirectionalLight('#fff0d5', 2.6); sun.position.set(-24, 32, 15); scene.add(sun)
  const scenery = createScenery(scene, sun, renderer)
  const footsteps = createFootsteps()
  const controls = new PointerLockControls(camera, canvas)
  controls.minPolarAngle = .3
  controls.maxPolarAngle = Math.PI - .3
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const orientation = new THREE.Euler(0, 0, 0, 'YXZ')
  const notify = (message: string) => { status.textContent = message }
  const button = (label: string, icon: IconNode, action: () => void): HTMLButtonElement => {
    const element = document.createElement('button')
    element.type = 'button'
    element.className = 'mansion-button'
    element.title = label
    element.setAttribute('aria-label', label)
    element.append(createElement(icon))
    element.addEventListener('click', action)
    actions.append(element)
    return element
  }
  const clearMovement = () => { pressed.clear(); dragging = undefined; footsteps.stop() }
  const restorePointer = () => { if (controls.isLocked) controls.unlock(); clearMovement() }
  const exit = () => {
    if (disposed) return
    disposed = true
    restorePointer()
    cancelAnimationFrame(animation)
    clearTimeout(transitionTimer)
    if (document.fullscreenElement === root) void document.exitFullscreen().catch(() => {})
    cleanup.forEach(dispose => dispose())
    controls.dispose()
    footsteps.destroy()
    fairy?.destroy()
    scenery.destroy()
    loadedTextures.forEach(texture => texture.dispose())
    renderer.dispose()
    renderer.forceContextLoss()
    audio.setSpatial(null)
    app.inert = previousInert
    document.documentElement.classList.remove('mansion-open')
    root.remove()
    previousFocus?.focus()
    onClose()
  }
  const fullscreen = button('Enter fullscreen', Maximize, () => {
    const request = document.fullscreenElement === root ? document.exitFullscreen() : root.requestFullscreen()
    void request.catch(() => notify('Fullscreen is unavailable in this browser.'))
  })
  fullscreen.disabled = !document.fullscreenEnabled
  const onFullscreen = () => {
    const active = document.fullscreenElement === root
    fullscreen.replaceChildren(createElement(active ? Minimize : Maximize))
    fullscreen.title = active ? 'Exit fullscreen' : 'Enter fullscreen'
    fullscreen.setAttribute('aria-label', fullscreen.title)
  }
  document.addEventListener('fullscreenchange', onFullscreen)
  cleanup.push(() => document.removeEventListener('fullscreenchange', onFullscreen))
  const mouseLockSupported = typeof canvas.requestPointerLock === 'function'
  const lockFailed = () => { if (!disposed) notify('Mouse capture is unavailable. Drag the view to look around.') }
  const captureMouse = () => {
    if (controls.isLocked) return
    try { const result = canvas.requestPointerLock(); if (result) void result.catch(lockFailed) } catch { lockFailed() }
  }
  document.addEventListener('pointerlockerror', lockFailed)
  cleanup.push(() => document.removeEventListener('pointerlockerror', lockFailed))
  const look = button('Lock mouse look', MousePointer2, () => {
    if (fairy?.blocking) return
    if (controls.isLocked) controls.unlock()
    else {
      editing = false; updateEditing()
      captureMouse()
    }
  })
  look.setAttribute('aria-pressed', 'false')
  const onLock = () => { look.setAttribute('aria-pressed', String(controls.isLocked)); clearMovement(); if (controls.isLocked) notify('') }
  controls.addEventListener('lock', onLock); controls.addEventListener('unlock', onLock)
  const bounce = button('Walking motion', Footprints, () => { motion = !motion; bounce.setAttribute('aria-pressed', String(motion)) })
  bounce.setAttribute('aria-pressed', String(motion))
  const onMotionPreference = () => { motion = !motionPreference.matches; bounce.setAttribute('aria-pressed', String(motion)) }
  motionPreference.addEventListener('change', onMotionPreference)
  cleanup.push(() => motionPreference.removeEventListener('change', onMotionPreference))
  const mute = button('Mute audio', Volume2, () => { audio.toggleMute(); updateMute() })
  function updateMute() {
    mute.replaceChildren(createElement(audio.muted() ? VolumeX : Volume2))
    mute.setAttribute('aria-label', audio.muted() ? 'Unmute audio' : 'Mute audio')
    mute.title = audio.muted() ? 'Unmute audio' : 'Mute audio'
    if (audio.muted()) footsteps.stop()
  }
  updateMute()
  let editButton: HTMLButtonElement | undefined
  if (import.meta.env.DEV) {
    editButton = button('Edit pictures', ImagePlus, () => { void toggleEditing() })
    editButton.setAttribute('aria-pressed', 'false')
  }
  button('Return to puzzle', X, exit)
  function updateEditing() {
    editButton?.setAttribute('aria-pressed', String(editing))
    root.classList.toggle('mansion-world--editing', editing)
    if (editing) restorePointer()
    notify('')
  }
  async function toggleEditing() {
    if (uploading || fairy?.blocking) return
    if (editing) { editing = false; updateEditing(); return }
    restorePointer()
    try {
      editor = await openGalleryEditor()
      if (disposed) return
      gallery = editor.gallery
      applyGallery(gallery)
      editing = true; updateEditing()
    } catch (error) { notify(error instanceof Error ? error.message : 'Picture editor unavailable.') }
  }
  function applyGallery(next: Gallery) {
    for (const surface of scenery.surfaces) {
      const source = next.images[surface.id]
      const version = (imageVersions.get(surface.id) ?? 0) + 1
      imageVersions.set(surface.id, version)
      const replace = (texture: THREE.Texture) => {
        if (disposed || imageVersions.get(surface.id) !== version) { if (texture !== surface.placeholder) texture.dispose(); return }
        const previous = surface.mesh.material.map
        surface.mesh.material.map = texture
        surface.mesh.material.needsUpdate = true
        if (previous && previous !== surface.placeholder) { previous.dispose(); loadedTextures.delete(previous) }
        if (texture !== surface.placeholder) loadedTextures.add(texture)
      }
      if (!source) { replace(surface.placeholder); continue }
      new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}${source}`, texture => {
        const image = texture.image as HTMLImageElement
        const target = document.createElement('canvas'); target.width = 768; target.height = 960
        const context = target.getContext('2d')!
        context.fillStyle = '#e0e2db'; context.fillRect(0, 0, target.width, target.height)
        const scale = Math.min((target.width - 50) / image.width, (target.height - 50) / image.height)
        context.drawImage(image, (target.width - image.width * scale) / 2, (target.height - image.height * scale) / 2, image.width * scale, image.height * scale)
        texture.dispose()
        const fitted = new THREE.CanvasTexture(target); fitted.colorSpace = THREE.SRGBColorSpace; fitted.anisotropy = 4
        replace(fitted)
      }, undefined, () => { if (!disposed) notify(`Picture unavailable: ${surface.id}`) })
    }
  }
  void loadGallery().then(next => { if (!disposed) { gallery = next; applyGallery(next) } }).catch(error => { if (!disposed) notify(error.message) })
  const pickFrame = (clientX: number, clientY: number) => {
    if (!editing || uploading) return
    const rect = canvas.getBoundingClientRect()
    pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(scenery.surfaces.map(surface => surface.mesh), false)[0]
    if (!hit || hit.distance > 12) return
    frameId = hit.object.userData.frameId as string
    clearMovement()
    fileInput.click()
  }
  fileInput.addEventListener('change', () => { void upload() })
  async function upload() {
    const file = fileInput.files?.[0]
    if (!file || !editor || uploading) return
    uploading = true; clearMovement(); notify('Saving picture...')
    try {
      const data = await resizePicture(file)
      if (disposed) return
      gallery = await editor.save(frameId, data)
      if (disposed) return
      applyGallery(gallery)
      notify('Picture saved to source.')
    } catch (error) { if (!disposed) notify(error instanceof Error ? error.message : 'Could not save picture.') }
    finally { uploading = false; fileInput.value = '' }
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || fairy?.blocking) return
    audio.resume()
    canvas.focus()
    dragging = { x: event.clientX, y: event.clientY, moved: false }
    if (event.pointerType === 'mouse' && !editing && mouseLockSupported) { captureMouse(); return }
    canvas.setPointerCapture(event.pointerId)
  })
  canvas.addEventListener('pointermove', event => {
    if (controls.isLocked || !dragging) return
    const horizontal = event.clientX - dragging.x
    const vertical = event.clientY - dragging.y
    if (Math.abs(horizontal) + Math.abs(vertical) > 2) dragging.moved = true
    orientation.setFromQuaternion(camera.quaternion)
    orientation.y -= horizontal * .003
    orientation.x = Math.max(-1.25, Math.min(1.25, orientation.x - vertical * .003))
    camera.quaternion.setFromEuler(orientation)
    dragging.x = event.clientX; dragging.y = event.clientY
  })
  canvas.addEventListener('pointerup', event => {
    const clicked = dragging && !dragging.moved
    dragging = undefined
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (clicked) pickFrame(event.clientX, event.clientY)
  })
  canvas.addEventListener('pointercancel', clearMovement)
  const keys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'])
  const keydown = (event: KeyboardEvent) => {
    if (keys.has(event.code)) { event.preventDefault(); if (!uploading && !fairy?.blocking) pressed.add(event.code) }
    if (event.code === 'Escape') { restorePointer(); if (editing) { editing = false; updateEditing() } }
    if (event.code === 'Tab') {
      const elements = [...root.querySelectorAll<HTMLElement>('button:not(:disabled),canvas')].filter(element => element.getClientRects().length)
      if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1)?.focus() }
      if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0]?.focus() }
    }
  }
  const keyup = (event: KeyboardEvent) => pressed.delete(event.code)
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', clearMovement)
  cleanup.push(() => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', clearMovement) })
  const touch = root.querySelector<HTMLElement>('.mansion-touch')!
  for (const [key, label, icon] of [['ArrowUp', 'Walk forward', ArrowUp], ['ArrowLeft', 'Walk left', ArrowLeft], ['ArrowDown', 'Walk backward', ArrowDown], ['ArrowRight', 'Walk right', ArrowRight]] as const) {
    const element = document.createElement('button'); element.type = 'button'; element.className = 'mansion-button'; element.dataset.direction = key; element.setAttribute('aria-label', label); element.title = label; element.append(createElement(icon)); touch.append(element)
    element.addEventListener('pointerdown', event => { event.preventDefault(); if (uploading || fairy?.blocking) return; audio.resume(); pressed.add(key); element.setPointerCapture(event.pointerId) })
    element.addEventListener('pointerup', () => pressed.delete(key)); element.addEventListener('pointercancel', () => pressed.delete(key)); element.addEventListener('lostpointercapture', () => pressed.delete(key))
  }
  const resize = () => {
    const width = root.clientWidth
    const height = root.clientHeight
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize); observer.observe(root); cleanup.push(() => observer.disconnect())
  const onVisibility = () => {
    clearMovement(); previousTime = 0
    if (document.hidden) { cancelAnimationFrame(animation); animation = 0 }
    else if (!animation) animation = requestAnimationFrame(tick)
  }
  document.addEventListener('visibilitychange', onVisibility); cleanup.push(() => document.removeEventListener('visibilitychange', onVisibility))
  const contextLost = (event: Event) => { event.preventDefault(); notify('The graphics context was lost. Return to the puzzle and reopen the gallery.'); clearMovement(); cancelAnimationFrame(animation) }
  canvas.addEventListener('webglcontextlost', contextLost); cleanup.push(() => canvas.removeEventListener('webglcontextlost', contextLost))
  function tick(timestamp: number) {
    if (disposed) return
    animation = requestAnimationFrame(tick)
    const delta = Math.min(.05, previousTime ? (timestamp - previousTime) / 1000 : 0)
    previousTime = timestamp
    fairy?.update(delta)
    if (fairy?.blocking) {
      scenery.animate(timestamp / 1000, motion, audio.spectrum?.()?.bands ?? [])
      audio.setSpatial(spatialMusic({ x: camera.position.x, z: camera.position.z }, camera.rotation.y))
      root.querySelector('[data-room]')!.textContent = camera.position.z < -45 ? 'The Ballroom' : camera.position.z < -36 ? 'Grand Stair' : 'East Hall'
      if (timestamp - renderTime >= 1000 / 45) { renderer.render(fairy.scene, fairy.camera); renderTime = timestamp }
      return
    }
    let forward = Number(pressed.has('ArrowUp') || pressed.has('KeyW')) - Number(pressed.has('ArrowDown') || pressed.has('KeyS'))
    let sideways = Number(pressed.has('ArrowRight') || pressed.has('KeyD')) - Number(pressed.has('ArrowLeft') || pressed.has('KeyA'))
    const length = Math.hypot(forward, sideways)
    if (length) { forward /= length; sideways /= length }
    orientation.setFromQuaternion(camera.quaternion)
    const yaw = orientation.y
    const distance = delta * 3.3
    const next = movePosition(position, (sideways * Math.cos(yaw) - forward * Math.sin(yaw)) * distance, (-forward * Math.cos(yaw) - sideways * Math.sin(yaw)) * distance)
    const travelled = Math.hypot(next.x - position.x, next.z - position.z)
    position = next
    if (travelled > .0001) {
      stride += travelled * 8
      sinceStep += travelled
      if (sinceStep >= footstepDistance) { sinceStep %= footstepDistance; footsteps.step(audio.muted(), -floorHeight(position.z) / 3) }
    }
    const bob = motion && travelled > .0001 ? Math.sin(stride) * .035 : 0
    camera.position.x = position.x
    camera.position.z = position.z
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, floorHeight(position.z) + 1.65 + bob, 1 - Math.exp(-delta * 18))
    if (!controls.isLocked) camera.rotation.z = motion && travelled > .0001 ? Math.cos(stride / 2) * .003 : 0
    root.querySelector('[data-room]')!.textContent = position.z < -45 ? 'The Ballroom' : position.z < -36 ? 'Grand Stair' : 'East Hall'
    scenery.animate(timestamp / 1000, motion, audio.spectrum?.()?.bands ?? [])
    if (timestamp - audioTime > 80) {
      audioTime = timestamp; const spatial = spatialMusic(position, yaw); audio.setSpatial(spatial)
      root.dataset.x = position.x.toFixed(2); root.dataset.z = position.z.toFixed(2); root.dataset.yaw = yaw.toFixed(3); root.dataset.gain = spatial.gain.toFixed(3); root.dataset.pan = spatial.pan.toFixed(3)
    }
    if (timestamp - renderTime >= 1000 / 45) { scenery.render(camera); renderTime = timestamp }
  }
  document.body.append(root)
  app.inert = true
  document.documentElement.classList.add('mansion-open')
  root.focus()
  audio.setSpatial(spatialMusic(position, 0))
  audio.resume()
  resize()
  if (introduction) fairy = createFairySequence(root, scene, camera, !motion, introduction.onComplete)
  if (fairy?.blocking) renderer.render(fairy.scene, fairy.camera)
  else scenery.render(camera)
  if (!introduction) transitionTimer = setTimeout(() => root.classList.remove('mansion-world--entering'), motion ? 100 : 0)
  animation = requestAnimationFrame(tick)
  return { destroy: exit }
}