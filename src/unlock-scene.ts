import * as THREE from 'three'

export function createUnlockScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
  renderer.setClearColor(0x000000, 0)
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x02090b, 0.024)
  const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 180)
  camera.position.z = 10
  const aperture = new THREE.Group()
  scene.add(aperture)
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const teal = new THREE.MeshBasicMaterial({ color: 0x80ffe1, transparent: true, opacity: 0.8 })
  const gold = new THREE.MeshBasicMaterial({ color: 0xffd189, transparent: true, opacity: 0.8 })
  const white = new THREE.MeshBasicMaterial({ color: 0xeafff9, transparent: true, opacity: 0.6 })
  const rings: THREE.Group[] = []
  for (let depth = 0; depth < 18; depth += 1) {
    const ring = new THREE.Group()
    ring.position.z = -depth * 4
    for (let segment = 0; segment < 12; segment += 1) {
      const angle = segment / 12 * Math.PI * 2
      const beam = new THREE.Mesh(geometry, depth % 3 === 0 ? gold : teal)
      beam.position.set(Math.cos(angle) * 4.8, Math.sin(angle) * 4.8, 0)
      beam.scale.set(0.055, 1.6, 0.1)
      beam.rotation.z = angle
      ring.add(beam)
      const brace = new THREE.Mesh(geometry, white)
      brace.position.set(Math.cos(angle) * 5.25, Math.sin(angle) * 5.25, 0)
      brace.scale.set(0.8, 0.025, 0.03)
      brace.rotation.z = angle
      ring.add(brace)
    }
    rings.push(ring)
    aperture.add(ring)
  }
  const shardCount = 180
  const shards = new THREE.InstancedMesh(geometry, teal, shardCount)
  const matrix = new THREE.Object3D()
  scene.add(shards)
  const resize = (): void => {
    renderer.setSize(innerWidth, innerHeight, false)
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)
  resize()
  return {
    render(progress: number): void {
      const opening = THREE.MathUtils.smoothstep(progress, 0.04, 0.5)
      const travel = THREE.MathUtils.smoothstep(progress, 0.35, 1)
      camera.position.z = 10 - travel * 36
      aperture.rotation.z = opening * 0.42 + progress * 0.16
      rings.forEach((ring, index) => {
        const scale = 0.35 + opening * 0.65 + Math.sin(progress * 4 - index * 0.12) * 0.025
        ring.scale.setScalar(scale)
        ring.rotation.z = index * 0.06 + progress * (index % 2 ? 0.12 : -0.12)
      })
      for (let index = 0; index < shardCount; index += 1) {
        const angle = index * 2.399963
        const radius = 3.8 + (index % 11) * 0.3 + opening * 2.8
        matrix.position.set(Math.cos(angle + progress * 0.12) * radius, Math.sin(angle + progress * 0.12) * radius, -((index * 3.73 - travel * 70 + 140) % 90))
        matrix.rotation.set(0, 0, angle)
        matrix.scale.set(0.025, 0.025, 0.2 + travel * 2.4)
        matrix.updateMatrix()
        shards.setMatrixAt(index, matrix.matrix)
      }
      shards.instanceMatrix.needsUpdate = true
      teal.opacity = 0.45 + opening * 0.4
      renderer.render(scene, camera)
    },
    destroy(): void {
      window.removeEventListener('resize', resize)
      geometry.dispose()
      teal.dispose()
      gold.dispose()
      white.dispose()
      shards.dispose()
      renderer.dispose()
    },
  }
}