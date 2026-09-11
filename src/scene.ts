import * as THREE from 'three'

export interface SceneController {
  destroy: () => void
}

export function initializeScene(canvas: HTMLCanvasElement): SceneController {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.72
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x020708)
  scene.fog = new THREE.FogExp2(0x020708, 0.105)

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80)
  camera.position.set(0, 0.08, 6.2)

  const backgroundGeometry = new THREE.PlaneGeometry(1, 1)
  const backgroundMaterial = new THREE.MeshBasicMaterial({ color: 0x506469 })
  const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial)
  background.position.z = -5
  scene.add(background)

  const texture = new THREE.TextureLoader().load(
    `${import.meta.env.BASE_URL}assets/background.jpg`,
    (loadedTexture) => {
      loadedTexture.colorSpace = THREE.SRGBColorSpace
      backgroundMaterial.map = loadedTexture
      backgroundMaterial.needsUpdate = true
      resize()
    },
  )

  const ambient = new THREE.AmbientLight(0x8bcac2, 0.55)
  scene.add(ambient)

  const cyanLight = new THREE.PointLight(0x68f4df, 13, 16, 2)
  cyanLight.position.set(-3.4, 1.2, 2.1)
  scene.add(cyanLight)

  const redLight = new THREE.PointLight(0xf0524f, 11, 13, 2)
  redLight.position.set(3.2, -1.5, 1.4)
  scene.add(redLight)

  const structure = new THREE.Group()
  scene.add(structure)

  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x101719,
    emissive: 0x06191a,
    emissiveIntensity: 0.8,
    metalness: 0.9,
    roughness: 0.43,
  })

  const railGeometry = new THREE.BoxGeometry(0.24, 8.5, 0.34)
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railGeometry, metalMaterial)
    rail.position.set(side * 4.25, 0, 0.25)
    rail.rotation.z = side * -0.055
    structure.add(rail)

    for (let segment = -3; segment <= 3; segment += 1) {
      const brace = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.1, 0.23),
        metalMaterial,
      )
      brace.position.set(side * 3.9, segment * 1.08, 0.18)
      brace.rotation.z = side * 0.33
      structure.add(brace)
    }
  }

  const ringGroup = new THREE.Group()
  ringGroup.position.set(0, 0.1, -1.7)
  scene.add(ringGroup)

  const ringGeometry = new THREE.TorusGeometry(2.5, 0.014, 8, 160)
  const cyanRing = new THREE.Mesh(
    ringGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x77f5e1,
      transparent: true,
      opacity: 0.52,
    }),
  )
  cyanRing.rotation.x = 0.24
  cyanRing.rotation.y = -0.16
  ringGroup.add(cyanRing)

  const redRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.62, 0.007, 6, 120, Math.PI * 1.46),
    new THREE.MeshBasicMaterial({
      color: 0xef5b57,
      transparent: true,
      opacity: 0.44,
    }),
  )
  redRing.rotation.set(-0.18, 0.1, 0.7)
  ringGroup.add(redRing)

  const particleCount = 650
  const particlePositions = new Float32Array(particleCount * 3)
  for (let index = 0; index < particleCount; index += 1) {
    const offset = index * 3
    particlePositions[offset] = (Math.random() - 0.5) * 12
    particlePositions[offset + 1] = (Math.random() - 0.5) * 8
    particlePositions[offset + 2] = -1 - Math.random() * 9
  }

  const particleGeometry = new THREE.BufferGeometry()
  particleGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(particlePositions, 3),
  )
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: 0xb9fff4,
      size: 0.018,
      transparent: true,
      opacity: 0.48,
      sizeAttenuation: true,
    }),
  )
  scene.add(particles)

  const floor = new THREE.GridHelper(15, 42, 0x1e8c82, 0x143638)
  floor.position.set(0, -2.7, -1.1)
  floor.rotation.x = Math.PI / 2
  const floorMaterials = Array.isArray(floor.material) ? floor.material : [floor.material]
  floorMaterials.forEach((material) => {
    material.transparent = true
    material.opacity = 0.2
  })
  scene.add(floor)

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let targetX = 0
  let targetY = 0
  let currentX = 0
  let currentY = 0
  let frame = 0

  const onPointerMove = (event: PointerEvent): void => {
    if (reducedMotion.matches || event.pointerType === 'touch') {
      return
    }

    targetX = THREE.MathUtils.clamp((event.clientX / window.innerWidth - 0.5) * 2, -1, 1)
    targetY = THREE.MathUtils.clamp((event.clientY / window.innerHeight - 0.5) * 2, -1, 1)
  }

  const onPointerLeave = (): void => {
    targetX = 0
    targetY = 0
  }

  function resize(): void {
    const width = Math.max(1, canvas.clientWidth)
    const height = Math.max(1, canvas.clientHeight)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()

    const distance = camera.position.z - background.position.z
    const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance
    const viewWidth = viewHeight * camera.aspect
    const image = texture.image as HTMLImageElement | undefined
    const imageAspect = image?.naturalWidth && image.naturalHeight
      ? image.naturalWidth / image.naturalHeight
      : 0.56

    if (viewWidth / viewHeight > imageAspect) {
      background.scale.set(viewWidth, viewWidth / imageAspect, 1)
    } else {
      background.scale.set(viewHeight * imageAspect, viewHeight, 1)
    }
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  document.documentElement.addEventListener('pointerleave', onPointerLeave)

  const clock = new THREE.Clock()
  const render = (): void => {
    const elapsed = clock.getElapsedTime()
    const interpolation = reducedMotion.matches ? 1 : 0.028
    currentX = THREE.MathUtils.lerp(currentX, targetX, interpolation)
    currentY = THREE.MathUtils.lerp(currentY, targetY, interpolation)

    camera.position.x = currentX * 0.13
    camera.position.y = 0.08 - currentY * 0.055
    camera.lookAt(currentX * 0.31, -currentY * 0.1, -3.4)

    if (!reducedMotion.matches) {
      ringGroup.rotation.z = Math.sin(elapsed * 0.17) * 0.025
      cyanRing.material.opacity = 0.48 + Math.sin(elapsed * 1.8) * 0.06
      particles.rotation.z = elapsed * 0.0025
      structure.position.x = currentX * -0.045
    }

    renderer.render(scene, camera)
    frame = window.requestAnimationFrame(render)
  }

  resize()
  render()

  return {
    destroy: () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
      backgroundGeometry.dispose()
      backgroundMaterial.dispose()
      texture.dispose()
      railGeometry.dispose()
      metalMaterial.dispose()
      ringGeometry.dispose()
      cyanRing.material.dispose()
      redRing.geometry.dispose()
      redRing.material.dispose()
      particleGeometry.dispose()
      particles.material.dispose()
      floor.geometry.dispose()
      floorMaterials.forEach((material) => material.dispose())
      renderer.dispose()
    },
  }
}