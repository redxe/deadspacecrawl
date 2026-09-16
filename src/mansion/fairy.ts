import * as THREE from 'three'
import seedrandom from 'seedrandom'
import { ArrowRight, createElement } from 'lucide'
import { loadGlyphAtlas, renderGlyphText } from '../glyphs'
import type { GlyphAtlas } from '../glyphs'
import { fairyMessages, fairyRoute } from './fairy-route'
import './fairy.css'

export function createFairySequence(root: HTMLElement, world: THREE.Scene, worldCamera: THREE.PerspectiveCamera, reducedMotion: boolean, onDone: () => void) {
  const random = seedrandom(crypto.randomUUID())
  const introduction = new THREE.Scene(); introduction.background = new THREE.Color('#000000')
  const portraitCamera = new THREE.PerspectiveCamera(48, 1, .05, 40); portraitCamera.position.set(0, 0, 5)
  const body = new THREE.Group(); introduction.add(body)
  const orbMaterial = new THREE.MeshBasicMaterial({ color: '#fffce0' })
  body.add(new THREE.Mesh(new THREE.SphereGeometry(.14, 20, 16), orbMaterial))
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 128
  const glowContext = glowCanvas.getContext('2d')!
  const glowGradient = glowContext.createRadialGradient(64, 64, 3, 64, 64, 64)
  glowGradient.addColorStop(0, '#ffffee'); glowGradient.addColorStop(.22, '#cefcdac0'); glowGradient.addColorStop(.5, '#81e9b83a'); glowGradient.addColorStop(1, '#81e9b800')
  glowContext.fillStyle = glowGradient; glowContext.fillRect(0, 0, 128, 128)
  const glowTexture = new THREE.CanvasTexture(glowCanvas)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
  glow.scale.setScalar(.95); body.add(glow)
  const wingCanvas = document.createElement('canvas'); wingCanvas.width = 128; wingCanvas.height = 256
  const wingContext = wingCanvas.getContext('2d')!
  wingContext.fillStyle = '#cff9f14f'; wingContext.strokeStyle = '#e9fff0ad'; wingContext.lineWidth = 2
  wingContext.beginPath(); wingContext.ellipse(64, 128, 53, 117, 0, 0, Math.PI * 2); wingContext.fill(); wingContext.stroke()
  wingContext.lineWidth = 1
  for (let index = 0; index < 7; index++) {
    wingContext.beginPath(); wingContext.moveTo(64, 238); wingContext.quadraticCurveTo(35 + index * 9, 135, 22 + index * 14, 45 + Math.abs(index - 3) * 15); wingContext.stroke()
  }
  const wingTexture = new THREE.CanvasTexture(wingCanvas)
  const wingMaterial = new THREE.MeshBasicMaterial({ map: wingTexture, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false })
  const wings: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group(); body.add(hinge); wings.push(hinge)
    for (const [index, size] of [1, .65].entries()) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(.34 * size, .8 * size), wingMaterial)
      wing.position.set(side * .3, index ? -.12 : .2, -.04); wing.rotation.z = side * (index ? -1 : -.6); hinge.add(wing)
    }
  }
  const light = new THREE.PointLight('#b9f7d5', 3, 4, 2); body.add(light)
  const particleCount = 180
  const positions = new Float32Array(particleCount * 3)
  const colors = new Float32Array(particleCount * 3)
  const ages = new Float32Array(particleCount).fill(10)
  const velocities = Float32Array.from({ length: particleCount * 3 }, () => (random() - .5) * .16)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const particleMaterial = new THREE.PointsMaterial({ map: glowTexture, size: .1, transparent: true, vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending })
  const particles = new THREE.Points(geometry, particleMaterial); particles.frustumCulled = false; introduction.add(particles)
  const dialogue = document.createElement('section'); dialogue.className = 'fairy-dialogue'; dialogue.hidden = true
  const speech = document.createElement('div'); speech.className = 'fairy-speech'; speech.setAttribute('role', 'status'); speech.setAttribute('aria-live', 'polite')
  const next = document.createElement('button'); next.type = 'button'; next.className = 'mansion-button fairy-next'; next.title = 'Continue'; next.setAttribute('aria-label', 'Continue'); next.append(createElement(ArrowRight))
  dialogue.append(speech, next); root.append(dialogue)
  const veil = document.createElement('div'); veil.className = 'fairy-veil'; root.append(veil)
  root.classList.add('mansion-world--intro', 'mansion-world--guided')
  root.classList.remove('mansion-world--entering')
  let atlas: GlyphAtlas | undefined
  let disposed = false
  let phase: 'black' | 'greeting' | 'invitation' | 'reveal' | 'flight' | 'done' = 'black'
  let elapsed = 0
  let clock = 0
  let wanderTime = 0
  let particleCursor = 0
  let emission = 0
  let speechIndex = 0
  const route = fairyRoute(random)
  const flightDuration = route.getLength() / 2.7
  const target = new THREE.Vector3(0, .6, 0)
  const flightPoint = new THREE.Vector3()
  body.position.set(-1.6, 1.4, -.8)
  body.visible = false
  const drawSpeech = () => {
    const text = fairyMessages[speechIndex]!
    speech.setAttribute('aria-label', text)
    if (!atlas) { speech.textContent = text; return }
    speech.replaceChildren()
    for (const word of text.split(' ')) {
      const element = document.createElement('span'); element.className = 'fairy-word'; element.setAttribute('aria-hidden', 'true'); renderGlyphText(element, word, atlas); speech.append(element)
    }
  }
  void loadGlyphAtlas(`${import.meta.env.BASE_URL}assets/characters.png`).then(value => { if (!disposed) { atlas = value; drawSpeech() } }).catch(() => {})
  next.addEventListener('click', () => {
    if (phase === 'greeting') { phase = 'invitation'; speechIndex = 1; drawSpeech() }
    else if (phase === 'invitation') { phase = 'reveal'; elapsed = 0; dialogue.hidden = true; veil.style.opacity = '1'; root.focus() }
  })
  function finish() {
    if (phase === 'done') return
    phase = 'done'; body.visible = false; particles.visible = false
    root.classList.remove('mansion-world--guided', 'mansion-world--intro')
    root.dataset.fairyPhase = 'done'
    dialogue.remove(); veil.remove(); onDone()
  }
  return {
    get active() { return phase !== 'done' },
    get blocking() { return phase !== 'flight' && phase !== 'done' },
    get scene() { return phase === 'flight' || phase === 'done' ? world : introduction },
    get camera() { return phase === 'flight' || phase === 'done' ? worldCamera : portraitCamera },
    update(delta: number) {
      if (disposed || phase === 'done') return
      reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
      elapsed += delta; clock += delta
      portraitCamera.aspect = worldCamera.aspect; portraitCamera.updateProjectionMatrix()
      root.dataset.fairyPhase = phase
      if (phase === 'black' && elapsed > (reducedMotion ? .15 : 1.2)) {
        phase = 'greeting'; elapsed = 0; body.visible = true; dialogue.hidden = false; drawSpeech(); next.focus()
      }
      if (phase === 'greeting' || phase === 'invitation') {
        wanderTime -= delta
        if (wanderTime <= 0) { target.set((random() - .5) * .7, .5 + random() * .35, (random() - .5) * .5); wanderTime = .7 + random() * 1.8 }
        body.position.lerp(target, 1 - Math.exp(-delta * (reducedMotion ? 7 : 2.2)))
        if (!reducedMotion) body.position.y += Math.sin(clock * 4.1) * delta * .1
      }
      if (phase === 'reveal' && elapsed > (reducedMotion ? .15 : .75)) {
        phase = 'flight'; elapsed = 0; root.classList.remove('mansion-world--intro', 'mansion-world--guided')
        world.add(body, particles); ages.fill(10); body.position.copy(route.getPointAt(0)); veil.style.opacity = '0'
      }
      if (phase === 'flight') {
        if (reducedMotion) {
          if (elapsed > 1.5) finish()
        } else {
          const progress = Math.min(1, elapsed / flightDuration)
          route.getPointAt(progress, flightPoint); body.position.copy(flightPoint)
          if (progress === 1 && elapsed > flightDuration + 1.2) finish()
        }
      }
      wings.forEach((wing, index) => { wing.rotation.y = (index ? -1 : 1) * (reducedMotion ? .35 : .35 + Math.sin(clock * 25) * .7) })
      glow.scale.setScalar(.92 + (reducedMotion ? 0 : Math.sin(clock * 3.5) * .055))
      emission += delta * 85
      while (emission >= 1) {
        emission--
        const index = particleCursor++ % particleCount
        ages[index] = 0
        positions.set([body.position.x + (random() - .5) * .13, body.position.y, body.position.z], index * 3)
      }
      for (let index = 0; index < particleCount; index++) {
        ages[index] += delta
        const brightness = body.visible ? Math.max(0, 1 - ages[index]! / 1.5) ** 2 : 0
        for (let axis = 0; axis < 3; axis++) positions[index * 3 + axis] += velocities[index * 3 + axis]! * delta
        colors.set([brightness * .65, brightness, brightness * .8], index * 3)
      }
      geometry.getAttribute('position').needsUpdate = true; geometry.getAttribute('color').needsUpdate = true
    },
    destroy() {
      disposed = true; dialogue.remove(); veil.remove(); body.removeFromParent(); particles.removeFromParent()
      const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>()
      body.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); materials.add(object.material as THREE.Material) } })
      geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); glow.material.dispose(); geometry.dispose(); particleMaterial.dispose(); glowTexture.dispose(); wingTexture.dispose()
    },
  }
}