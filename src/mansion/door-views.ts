import * as THREE from 'three'
import { frameCorners } from 'three/addons/utils/CameraUtils.js'
import seedrandom from 'seedrandom'
import { createPlayerShadow } from './player-shadow'
import type { PlayerShadow } from './player-shadow'
import { addRoomLight } from './room-light'

export type DoorView = 'porch' | 'study' | 'conservatory' | 'music-room' | 'tea-room'

export function createDoorDiorama(kind: DoorView) {
  const scene = new THREE.Scene()
  const outside = kind === 'porch'
  scene.name = `door-room-${kind}`
  scene.background = new THREE.Color(outside ? '#c4e2ea' : '#05090e')
  const camera = new THREE.PerspectiveCamera(57, .8, .1, 30)
  camera.position.set(0, 1.65, 3.1); camera.lookAt(0, 1.15, -1.8)
  scene.add(new THREE.HemisphereLight(outside ? '#fff4df' : '#8496b0', outside ? '#617166' : '#080b12', outside ? 2.2 : .12))
  const sun = new THREE.DirectionalLight(outside ? '#fff1d1' : '#849fbd', outside ? 2.8 : .2); sun.position.set(-3, 6, 3); scene.add(sun)
  const materials = new Map<string, THREE.MeshStandardMaterial>()
  const material = (color: string) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .75 }))
    return materials.get(color)!
  }
  const cube = new THREE.BoxGeometry(1, 1, 1)
  const box = (width: number, height: number, depth: number, x: number, y: number, z: number, color: string) => {
    const mesh = new THREE.Mesh(cube, material(color)); mesh.scale.set(width, height, depth); mesh.position.set(x, y, z); scene.add(mesh); return mesh
  }
  const potGeometry = new THREE.CylinderGeometry(.23, .16, .38, 12)
  const leafGeometry = new THREE.SphereGeometry(.2, 10, 6)
  const pot = (x: number, z: number, flowers = false, base = 0) => {
    const vessel = new THREE.Mesh(potGeometry, material('#a66a57'))
    vessel.position.set(x, base + .19, z); scene.add(vessel)
    for (let index = 0; index < 7; index++) {
      const angle = index * 2.4
      const leaf = new THREE.Mesh(leafGeometry, material(flowers && index % 3 === 0 ? '#d48db1' : index % 2 ? '#648955' : '#89ad65'))
      leaf.scale.set(.65, 1.8, .6); leaf.rotation.z = Math.sin(angle) * .55
      leaf.position.set(x + Math.cos(angle) * .18, base + .55 + index % 3 * .12, z + Math.sin(angle) * .17); scene.add(leaf)
    }
  }
  const chair = (x: number, z: number, tint: string) => {
    const group = new THREE.Group(); group.name = 'chair'; scene.add(group)
    const parts = [box(.65, .12, .65, x, .55, z, tint), box(.66, .62, .11, x, .94, z - .29, tint)]
    for (const side of [-1, 1]) {
      parts.push(box(.07, .62, .07, x + side * .25, .28, z - .24, '#ded9c5'), box(.07, .62, .07, x + side * .25, .28, z + .24, '#ded9c5'))
      parts.push(box(.065, .08, .66, x + side * .36, .79, z, '#ded9c5'))
    }
    parts.forEach(part => group.attach(part))
  }
  const table = (x: number, z: number) => {
    box(.9, .1, .72, x, .72, z, '#d7c29c')
    for (const side of [-1, 1]) for (const end of [-1, 1]) box(.055, .7, .055, x + side * .35, .35, z + end * .27, '#696a5a')
  }
  if (kind === 'porch') {
    const random = seedrandom('porch-garden')
    scene.fog = new THREE.Fog('#c4e2ea', 18, 29)
    box(7, .1, 7, 0, -.12, -1, '#9b998b')
    for (let index = 0; index < 16; index++) box(.018, .006, 6.8, -3.3 + index * .44, -.065, -1, '#777d74')
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(600, 120), material('#719c60'))
    lawn.name = 'porch-ground'; lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, -.18, -30); scene.add(lawn)
    box(1.2, .015, 11, 0, -.16, -9, '#d2c9ad')
    for (const side of [-1, 1]) {
      box(.17, 3.3, .17, side * 1.45, 1.58, -2.5, '#e1e4d6')
      box(.17, .22, 5.15, side * 1.45, 3.13, .025, '#e1e4d6')
      box(.17, 3.3, .17, side * 1.45, 1.58, 2.48, '#e1e4d6')
      box(2, .09, .1, side * 1.55, .93, -2.5, '#e1e4d6')
      for (let index = 0; index < 6; index++) box(.04, .72, .045, side * (.65 + index * .33), .47, -2.5, '#e1e4d6')
      box(.1, .09, 5.05, side * 2.55, .93, .025, '#e1e4d6')
      box(.08, .07, 5.05, side * 2.55, .17, .025, '#e1e4d6')
      for (const depth of [-2.5, 0, 2.48]) box(.13, 1.1, .13, side * 2.55, .48, depth, '#e1e4d6')
      for (let index = 0; index < 14; index++) box(.045, .72, .045, side * 2.55, .53, -2.3 + index * .36, '#e1e4d6')
      chair(side * .83, -.7, side > 0 ? '#699999' : '#b78089')
      pot(side * 1.15, -2.15, true)
      for (let index = 0; index < 6; index++) pot(side * (1.2 + index % 2 * .7), -4.3 - index * 1.1, true, -.1)
    }
    box(3.2, .22, .3, 0, 3.13, -2.5, '#e1e4d6')
    box(3.2, .22, .18, 0, 3.13, 2.48, '#e1e4d6')
    const roof = box(3.5, .12, 5.4, 0, 3.35, .05, '#b3b9ac'); roof.name = 'porch-roof'
    for (let depth = -2.2; depth <= 2.4; depth += .65) box(3.2, .08, .065, 0, 3.25, depth, '#e1e4d6')
    table(0, -1.65); pot(0, -1.65, true, .79)
    const wood = new THREE.CylinderGeometry(.12, .23, 1, 8)
    const canopy = new THREE.IcosahedronGeometry(1, 1); canopy.name = 'porch-tree-canopy'
    const crownShapes = [[-.55, 2.95, 0, 1.05], [.5, 3.1, .2, 1.15], [0, 3.65, -.1, 1.08], [.15, 2.9, -.65, 1], [-.15, 3.05, .65, .9]] as const
    for (const side of [-1, 1]) for (const [horizontal, depth] of [[3.6, -7], [6.8, -11], [10.5, -15], [13, -5], [16, -19], [7.5, -23]] as const) {
      const tree = new THREE.Group(); tree.name = 'porch-tree'
      tree.position.set(side * horizontal, -.18, depth); tree.scale.setScalar(.85 + random() * .5); tree.rotation.y = random() * Math.PI; scene.add(tree)
      const trunk = new THREE.Mesh(wood, material('#6e6954')); trunk.scale.y = 3.2; trunk.position.y = 1.6; tree.add(trunk)
      for (const direction of [-1, 1]) {
        const branch = new THREE.Mesh(wood, material('#6e6954')); branch.scale.set(.45, 1.25, .45)
        branch.position.set(direction * .3, 2.5, 0); branch.rotation.z = -direction * .6; tree.add(branch)
      }
      for (const [index, [horizontal, vertical, depth, radius]] of crownShapes.entries()) {
        const foliage = material(['#547b60', '#689064', '#81995e'][index % 3]!)
        foliage.flatShading = true
        const crown = new THREE.Mesh(canopy, foliage)
        crown.position.set(horizontal, vertical, depth); crown.scale.set(radius, radius * (.85 + random() * .15), radius); tree.add(crown)
      }
    }
    const blade = new THREE.PlaneGeometry(.065, .45)
    blade.translate(0, .225, 0)
    const vertices = blade.getAttribute('position')
    for (let index = 0; index < vertices.count; index++) if (vertices.getY(index) > .4) vertices.setX(index, 0)
    const grassMaterial = material('#90ad65'); grassMaterial.side = THREE.DoubleSide; grassMaterial.roughness = 1
    const grass = new THREE.InstancedMesh(blade, grassMaterial, 2800); grass.name = 'porch-grass'
    const placement = new THREE.Object3D()
    const grassColor = new THREE.Color()
    for (let index = 0; index < grass.count; index++) {
      const depth = 2.4 - random() * 27
      let horizontal = (random() - .5) * 30
      if (Math.abs(horizontal) < 3.6 && depth > -4.6) horizontal = (horizontal >= 0 ? 1 : -1) * (3.8 + random() * 2)
      if (Math.abs(horizontal) < .75) horizontal += horizontal >= 0 ? .85 : -.85
      placement.position.set(horizontal, -.18, depth); placement.rotation.y = random() * Math.PI
      placement.scale.set(.65 + random(), .35 + random() * .6, 1); placement.updateMatrix(); grass.setMatrixAt(index, placement.matrix)
      grassColor.setHSL(.2 + random() * .08, .25 + random() * .2, .36 + random() * .15); grass.setColorAt(index, grassColor)
    }
    grass.computeBoundingSphere(); scene.add(grass)
  } else {
    const wall = kind === 'study' ? '#919db2' : kind === 'music-room' ? '#b1a0a6' : '#a6c2b1'
    box(6, .12, 8, 0, -.1, -1.5, '#977e67')
    box(6, .12, 8, 0, 3.4, -1.5, wall)
    box(6, 3.4, .12, 0, 1.65, -4.6, wall)
    for (const side of [-1, 1]) {
      box(.12, 3.4, 8, side * 3, 1.65, -1.5, wall)
      box(.14, .18, 8, side * 2.92, .05, -1.5, '#e6e2d4')
    }
    box(6, .16, .15, 0, 3.12, -4.48, '#e6e2d4')
    box(2.2, 1.4, .1, .65, 2, -4.48, '#e7ead9')
    box(2, 1.2, .05, .65, 2, -4.39, '#344657')
    box(.06, 1.3, .07, .65, 2, -4.33, '#f1f0df'); box(2.1, .06, .07, .65, 2, -4.33, '#f1f0df')
    box(2.6, .018, 2.8, 0, -.025, -1.8, kind === 'music-room' ? '#577b80' : '#9a6577')
    if (kind === 'study') {
      for (const side of [-1, 1]) {
        box(.85, 2.4, .35, side * 1.5, 1.2, -3.9, '#6f5b50')
        for (let shelf = 0; shelf < 4; shelf++) {
          box(.88, .055, .4, side * 1.5, .2 + shelf * .56, -3.86, '#c1ad89')
          for (let book = 0; book < 6; book++) box(.09, .25 + book % 3 * .06, .21, side * 1.5 - .3 + book * .12, .4 + shelf * .56, -3.75, ['#718c86', '#b98874', '#c8b57b'][book % 3]!)
        }
      }
      table(0, -1.3); chair(.8, -2, '#607f8d'); pot(-.26, -1.3, false, .79)
    } else if (kind === 'conservatory') {
      for (const side of [-1, 1]) for (let index = 0; index < 4; index++) pot(side * (1 + index % 2 * .4), -index * .9 - .5, index % 2 === 0)
      chair(0, -2, '#d2be92'); box(2, .12, .55, 0, .9, -3.75, '#c4bda3'); pot(-.65, -3.75, true, .97); pot(.65, -3.75, false, .97)
    } else if (kind === 'music-room') {
      box(1.8, 1.15, .48, -.2, .6, -2.7, '#293532'); box(1.85, .18, .7, -.2, .93, -2.3, '#293532')
      for (let key = 0; key < 22; key++) box(.074, .045, .24, -.99 + key * .075, 1.035, -2.11, '#eee7cf')
      for (let key = 0; key < 15; key++) if (key % 7 !== 2 && key % 7 !== 6) box(.046, .055, .14, -.94 + key * .107, 1.073, -2.15, '#172420')
      box(.75, .1, .38, -.2, .5, -1.5, '#45594f'); box(.6, .45, .24, -.2, .24, -1.5, '#293532'); pot(1.5, -3.1, true)
    } else {
      table(0, -1.8); chair(-.85, -2.1, '#a57b90'); chair(.85, -2.1, '#7896a2'); pot(0, -1.8, true, .79)
      box(1.5, .85, .45, -1.2, .43, -3.85, '#d2c3a3'); pot(-1.25, -3.8, false, .86)
    }
  }
  scene.updateMatrixWorld(true)
  const batches = new Map<THREE.BufferGeometry, Map<THREE.Material, THREE.Mesh[]>>()
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return
    const byMaterial = batches.get(object.geometry) ?? new Map<THREE.Material, THREE.Mesh[]>()
    const meshes = byMaterial.get(object.material) ?? []
    meshes.push(object); byMaterial.set(object.material, meshes); batches.set(object.geometry, byMaterial)
  })
  for (const [geometry, byMaterial] of batches) for (const [material, meshes] of byMaterial) {
    if (meshes.length < 2) continue
    const batch = new THREE.InstancedMesh(geometry, material, meshes.length)
    meshes.forEach((mesh, index) => { batch.setMatrixAt(index, mesh.matrixWorld); mesh.removeFromParent() })
    batch.computeBoundingSphere(); scene.add(batch)
  }
  return { scene, camera }
}

export function addSharedPorch(scene: THREE.Scene) {
  const porch = createDoorDiorama('porch').scene
  const group = new THREE.Group()
  group.name = 'shared-entrance-porch'
  group.rotation.y = Math.PI
  group.position.z = 5.397
  const lawn = porch.getObjectByName('porch-ground')!
  lawn.position.z = -57.5
  for (const object of [...porch.children]) {
    if (object instanceof THREE.Light) continue
    group.add(object)
  }
  scene.add(group)
  return group
}

export function createDoorView(kind: DoorView, surface: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>, worldShadow?: PlayerShadow) {
  const { scene, camera } = createDoorDiorama(kind)
  const shadow = createPlayerShadow()
  scene.traverse(object => { if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) shadow.attach(object.material) })
  if (kind !== 'porch') addRoomLight(scene, shadow)
  const target = new THREE.WebGLRenderTarget(512, 640)
  target.texture.name = `door-view-${kind}`
  surface.material.map = target.texture
  surface.material.needsUpdate = true
  const { width, height } = surface.geometry.parameters
  const bottomLeft = new THREE.Vector3(-width / 2, 2 - height / 2, 2.5)
  const bottomRight = new THREE.Vector3(width / 2, 2 - height / 2, 2.5)
  const topLeft = new THREE.Vector3(-width / 2, 2 + height / 2, 2.5)
  const eye = new THREE.Vector3()
  const lastEye = new THREE.Vector3(Infinity, Infinity, Infinity)
  const frustum = new THREE.Frustum()
  const projection = new THREE.Matrix4()
  const bounds = new THREE.Box3()
  const inverse = new THREE.Matrix4()
  const roomOffset = new THREE.Vector3(0, 2, 2.5)
  const feet = new THREE.Vector3()
  const sun = new THREE.Vector3()
  const lamp = new THREE.Vector3()
  let lastLightingRevision = -1
  let disposed = false
  return {
    scene, camera, target, shadow,
    update(renderer: THREE.WebGLRenderer, viewer: THREE.PerspectiveCamera) {
      if (disposed) return false
      viewer.updateMatrixWorld(true); surface.updateWorldMatrix(true, false)
      surface.worldToLocal(viewer.getWorldPosition(eye))
      if (eye.z <= .03 || eye.lengthSq() > 24 ** 2) return false
      frustum.setFromProjectionMatrix(projection.multiplyMatrices(viewer.projectionMatrix, viewer.matrixWorldInverse))
      if (!frustum.intersectsBox(bounds.setFromObject(surface))) return false
      const lightingRevision = worldShadow?.revision ?? 0
      if (eye.distanceToSquared(lastEye) < .00000001 && lastLightingRevision === lightingRevision) return false
      camera.position.set(eye.x, eye.y + 2, eye.z + 2.5)
      if (worldShadow) {
        inverse.copy(surface.matrixWorld).invert()
        feet.copy(worldShadow.uniforms.shadowPlayerFeet.value).applyMatrix4(inverse).add(roomOffset)
        sun.copy(worldShadow.uniforms.shadowSunDirection.value).transformDirection(inverse)
        lamp.copy(worldShadow.uniforms.shadowLampPosition.value).applyMatrix4(inverse).add(roomOffset)
        shadow.update(feet, sun, lamp, worldShadow.uniforms.shadowSunStrength.value, worldShadow.uniforms.shadowLampStrength.value)
      } else {
        feet.set(camera.position.x, camera.position.y - 1.65, camera.position.z)
        sun.set(-.4, .7, .6).normalize(); lamp.set(0, 3.8, 7)
        shadow.update(feet, sun, lamp, .2, .3)
      }
      camera.near = eye.z; camera.far = eye.z + 30
      frameCorners(camera, bottomLeft, bottomRight, topLeft)
      camera.updateMatrixWorld(true)
      const previous = renderer.getRenderTarget()
      try { renderer.setRenderTarget(target); renderer.render(scene, camera); lastEye.copy(eye); lastLightingRevision = lightingRevision }
      finally { renderer.setRenderTarget(previous) }
      return true
    },
    destroy() {
      if (disposed) return
      disposed = true
      const geometries = new Set<THREE.BufferGeometry>()
      const materials = new Set<THREE.Material>()
      scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return
        geometries.add(object.geometry); materials.add(object.material as THREE.Material)
        if (object instanceof THREE.InstancedMesh) object.dispose()
      })
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); scene.clear(); target.dispose()
    },
  }
}