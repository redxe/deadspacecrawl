import * as THREE from 'three'
import seedrandom from 'seedrandom'
import { mansionSeed, pictureFrames, ballroomPillarDepths, floorHeight } from './layout'
import { createEnvironment } from './environment'
import { addSharedPorch, createDoorView } from './door-views'
import type { DoorView } from './door-views'
import { createWindowGlass } from './window-glass'
import { createPlayerShadow } from './player-shadow'

export interface FrameSurface { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>; id: string; placeholder: THREE.Texture; mat: string }

function canvasTexture(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d')!)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

export function createScenery(scene: THREE.Scene, sunlight: THREE.DirectionalLight, renderer: THREE.WebGLRenderer) {
  const random = seedrandom(mansionSeed)
  const textures: THREE.Texture[] = []
  const doorViews: ReturnType<typeof createDoorView>[] = []
  const surfaces: FrameSurface[] = []
  const windowLight: THREE.MeshBasicMaterial[] = []
  const animated: THREE.Object3D[] = []
  const playerShadow = createPlayerShadow()
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
  const materials = {
    wall: new THREE.MeshStandardMaterial({ color: '#adbbb6', roughness: .92 }),
    panel: new THREE.MeshStandardMaterial({ color: '#526861', roughness: .65 }),
    trim: new THREE.MeshStandardMaterial({ color: '#e2e6de', roughness: .65 }),
    gold: new THREE.MeshStandardMaterial({ color: '#aa8950', metalness: .72, roughness: .3 }),
    dark: new THREE.MeshStandardMaterial({ color: '#252b2d', roughness: .65 }),
    door: new THREE.MeshStandardMaterial({ color: '#4e3738', roughness: .7 }),
    glass: createWindowGlass(playerShadow),
    glow: new THREE.MeshBasicMaterial({ color: '#fff0c7' }),
  }
  const box = (width: number, height: number, depth: number, x: number, y: number, z: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(boxGeometry, material)
    mesh.scale.set(width, height, depth)
    mesh.position.set(x, y, z)
    scene.add(mesh)
    return mesh
  }
  const floorMap = canvasTexture(512, 512, context => {
    context.fillStyle = '#49342e'; context.fillRect(0, 0, 512, 512)
    for (let row = 0; row < 8; row++) for (let column = 0; column < 4; column++) {
      const x = column * 128
      const y = row * 64
      const shade = 28 + random() * 12
      context.fillStyle = `hsl(25, 24%, ${shade}%)`
      context.fillRect(x + 1, y + 1, 126, 62)
      for (let grain = 0; grain < 28; grain++) {
        context.strokeStyle = `rgba(28,15,14,${random() * .15})`
        context.beginPath(); context.moveTo(x + 2, y + grain * 2.2); context.bezierCurveTo(x + 45, y + grain * 2.2 + random() * 5, x + 85, y + grain * 2.2 - 2, x + 126, y + grain * 2.2); context.stroke()
      }
    }
  })
  floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping
  floorMap.repeat.set(2.5, 15)
  textures.push(floorMap)
  const floorMaterial = new THREE.MeshStandardMaterial({ map: floorMap, roughness: .38, metalness: .05 })
  const roomMap = floorMap.clone(); roomMap.repeat.set(7, 7); textures.push(roomMap)
  const roomFloorMaterial = new THREE.MeshStandardMaterial({ map: roomMap, roughness: .32, metalness: .08 })
  box(6, .16, 40, 0, -.08, -16, floorMaterial)
  box(20, .18, 20, 0, -3.09, -55, roomFloorMaterial)
  box(.25, 4.7, 40, 3.1, 2.35, -16, materials.wall)
  box(6.4, .22, 40, 0, 4.8, -16, materials.trim)
  for (const side of [-1, 1]) box(2.77, 4.7, .22, side * 1.815, 2.35, 3.15, materials.wall)
  box(.86, 1.4625, .22, 0, .73125, 3.15, materials.wall)
  box(.86, 2.1625, .22, 0, 3.61875, 3.15, materials.wall)
  const runnerMap = canvasTexture(256, 512, context => {
    context.fillStyle = '#562e42'; context.fillRect(0, 0, 256, 512)
    context.strokeStyle = '#bca174'; context.lineWidth = 7; context.strokeRect(12, -5, 232, 522)
    context.strokeStyle = '#929c84'; context.lineWidth = 2; context.strokeRect(26, -5, 204, 522)
    for (let y = 0; y < 600; y += 85) {
      context.save(); context.translate(128, y); context.rotate(Math.PI / 4)
      context.fillStyle = '#394e51'; context.fillRect(-25, -25, 50, 50)
      context.strokeStyle = '#bf996e'; context.strokeRect(-29, -29, 58, 58)
      context.restore()
    }
  })
  runnerMap.wrapS = runnerMap.wrapT = THREE.RepeatWrapping
  runnerMap.repeat.set(1, 9); textures.push(runnerMap)
  box(1.6, .018, 36, 0, .016, -16, new THREE.MeshStandardMaterial({ map: runnerMap, roughness: 1 }))
  for (const side of [-1, 1]) {
    box(.16, .18, 40, side * 2.96, .1, -16, materials.dark)
    box(.13, .13, 40, side * 2.92, 1.04, -16, materials.trim)
    box(.18, .16, 40, side * 2.91, 4.45, -16, materials.trim)
    box(.3, .12, 40, side * 2.86, 4.63, -16, materials.trim)
    box(.12, .85, 40, side * 3, .54, -16, materials.panel)
    box(2.08, .85, .12, side * 1.96, .54, 3.04, materials.panel)
    box(2.08, .18, .16, side * 1.96, .1, 2.99, materials.dark)
    box(2.08, .13, .13, side * 1.96, 1.04, 2.98, materials.trim)
  }
  box(5.84, .16, .18, 0, 4.45, 2.97, materials.trim)
  box(5.72, .12, .3, 0, 4.63, 2.91, materials.trim)
  const windowMask = canvasTexture(256, 256, context => {
    context.fillStyle = '#ffffff'; context.shadowColor = '#ffffff'; context.shadowBlur = 3
    for (const horizontal of [4, 132]) for (const vertical of [4, 132]) context.fillRect(horizontal, vertical, 120, 120)
  })
  windowMask.name = 'window-light-mask'; textures.push(windowMask)
  for (let index = 0; index < 8; index++) {
    const z = 1 - index * 4.7
    box(.24, 4.4, 1.05, -3.08, 2.2, z + 2.3, materials.wall)
    box(.24, .9, 3.8, -3.08, .48, z, materials.wall)
    box(.24, .64, 3.8, -3.08, 4.28, z, materials.wall)
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3), materials.glass)
    pane.name = 'hall-window-glass'
    pane.rotation.y = Math.PI / 2; pane.position.set(-3.06, 2.46, z); scene.add(pane)
    for (const offset of [-1.85, 0, 1.85]) box(.12, 3.15, .065, -2.94, 2.45, z + offset, materials.trim)
    for (const y of [.9, 2.6, 4.02]) box(.13, .07, 3.82, -2.94, y, z, materials.trim)
    box(.46, .11, 4, -2.87, .9, z, materials.trim)
    const sun = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.8), new THREE.MeshBasicMaterial({ map: windowMask, color: '#f4e4b5', transparent: true, opacity: .13, depthWrite: false, blending: THREE.AdditiveBlending }))
    sun.name = 'window-light-patch'
    sun.rotation.x = -Math.PI / 2; sun.rotation.z = -.28; sun.position.set(-.3, .031, z + 1); scene.add(sun)
    windowLight.push(sun.material)
  }
  box(.24, 4.7, 2.3, -3.08, 2.35, -34.85, materials.wall)
  const door = (x: number, y: number, z: number, rotation: number, view: DoorView) => {
    const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = rotation; scene.add(group)
    const part = (width: number, height: number, depth: number, px: number, py: number, pz: number, material: THREE.Material) => {
      const mesh = new THREE.Mesh(boxGeometry, material); mesh.scale.set(width, height, depth); mesh.position.set(px, py, pz); group.add(mesh)
    }
    if (view === 'porch') {
      for (const side of [-1, 1]) part(.22, 2.9, .09, side * .54, 1.45, 0, materials.door)
      part(.86, 1.4625, .09, 0, .73125, 0, materials.door)
      part(.86, .3625, .09, 0, 2.71875, 0, materials.door)
    } else part(1.3, 2.9, .09, 0, 1.45, 0, materials.door)
    for (const px of [-.73, .73]) part(.13, 3.1, .15, px, 1.5, .08, materials.trim)
    part(1.6, .16, .16, 0, 3, .08, materials.trim)
    part(.94, .72, .025, 0, .65, .06, materials.panel)
    const window = new THREE.Mesh(new THREE.PlaneGeometry(.86, 1.075), new THREE.MeshBasicMaterial())
    window.name = `closed-door-window-${view}`; window.position.set(0, 2, .083)
    if (view !== 'porch') {
      group.add(window)
      doorViews.push(createDoorView(view, window, playerShadow))
    } else window.material.dispose()
    const glass = new THREE.Mesh(window.geometry, materials.glass)
    glass.name = `door-window-glass-${view}`; glass.position.set(0, 2, .089); group.add(glass)
    for (const side of [-1, 1]) {
      part(.055, 1.19, .07, side * .458, 2, .095, materials.trim)
      part(.97, .055, .07, 0, 2 + side * .568, .095, materials.trim)
    }
    part(.035, 1.075, .045, 0, 2, .115, materials.trim)
    part(.86, .035, .045, 0, 2.08, .115, materials.trim)
    part(.06, .2, .14, .48, 1.24, .14, materials.gold)
  }
  door(2.86, 0, -9, -Math.PI / 2, 'study')
  door(2.86, 0, -28, -Math.PI / 2, 'conservatory')
  door(0, 0, 2.98, Math.PI, 'porch')
  addSharedPorch(scene)
  for (let index = 0; index < 18; index++) {
    const top = -(index + 1) * 3 / 18
    box(6, 3 + top + .08, .51, 0, (top - 3) / 2, -36 - (index + .5) * .5, materials.trim)
    box(1.6, .025, .5, 0, top + .018, -36 - (index + .5) * .5, new THREE.MeshStandardMaterial({ color: '#582e43', roughness: 1 }))
    box(6, .045, .035, 0, top, -36 - index * .5, materials.gold)
    for (const side of [-1, 1]) {
      box(.09, 1, .09, side * 2.75, top + .5, -36 - (index + .5) * .5, materials.trim)
    }
  }
  for (const side of [-1, 1]) {
    const rail = box(.12, .12, 9.5, side * 2.75, -.52, -40.5, materials.door)
    rail.rotation.x = -Math.atan(3 / 9)
    box(.3, 7.7, 10, side * 3.1, .8, -40.5, materials.wall)
    box(7, 7.7, .25, side * 6.5, .8, -45.13, materials.wall)
  }
  box(6.3, .3, 10, 0, 4.7, -40.5, materials.trim)
  for (const x of [-3, 3]) box(.25, 4.5, .3, x, 2.2, -35.7, materials.trim)
  box(6.3, .4, .4, 0, 4.3, -35.7, materials.trim)
  box(20.4, .3, 20.4, 0, 4.72, -55, materials.trim)
  box(20.4, 7.7, .3, 0, .85, -65.1, materials.wall)
  for (const side of [-1, 1]) {
    box(.3, 7.7, 20, side * 10.1, .85, -55, materials.wall)
    box(.15, 1.35, 20, side * 9.93, -2.32, -55, materials.panel)
    box(.23, .13, 20, side * 9.86, -1.6, -55, materials.trim)
    box(.26, .2, 20, side * 9.84, 4.4, -55, materials.trim)
    for (const [start, end] of [[3, 5.57], [7.23, 9.86]] as const) {
      const horizontal = side * (start + end) / 2
      box(end - start, 1.35, .12, horizontal, -2.32, -45.3, materials.panel)
      box(end - start, .13, .13, horizontal, -1.6, -45.4, materials.trim)
      box(end - start, .18, .16, horizontal, -2.91, -45.4, materials.dark)
    }
    box(6.5, .2, .26, side * 6.5, 4.4, -45.38, materials.trim)
    door(side * 6.4, -3, -45.32, Math.PI, side < 0 ? 'music-room' : 'tea-room')
    for (const z of ballroomPillarDepths) {
      box(.32, 7.2, .4, side * 9.82, .6, z, materials.trim)
      box(.5, .24, .62, side * 9.72, 3.9, z, materials.gold)
    }
  }
  box(20, 1.35, .15, 0, -2.32, -64.95, materials.panel)
  box(20, .13, .23, 0, -1.6, -64.88, materials.trim)
  for (let x = -8; x <= 8; x += 4) box(.28, .12, 20, x, 4.48, -55, materials.gold)
  for (const z of [-48, -55, -62]) box(20, .12, .28, 0, 4.48, z, materials.gold)
  const inlay = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.66, 96), materials.gold)
  inlay.rotation.x = -Math.PI / 2; inlay.position.set(0, -2.985, -56); scene.add(inlay)
  const chandelier = new THREE.Group(); chandelier.position.set(0, 2.9, -56); scene.add(chandelier); animated.push(chandelier)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, .035, 6, 48), materials.gold); ring.rotation.x = Math.PI / 2; chandelier.add(ring)
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.8, 6), materials.gold); chain.position.y = .9; chandelier.add(chain)
  for (let index = 0; index < 12; index++) {
    const angle = index * Math.PI / 6
    const tint = ['#eaaaaf', '#85dcca', '#a2bfea', '#efcc85'][index % 4]!
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshBasicMaterial({ color: tint }))
    bulb.position.set(Math.cos(angle) * 1.45, .17, Math.sin(angle) * 1.45); chandelier.add(bulb)
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.11), new THREE.MeshStandardMaterial({ color: tint, emissive: tint, emissiveIntensity: .22, metalness: .4, roughness: .12 }))
    crystal.scale.y = 2.5; crystal.position.set(Math.cos(angle) * 1.45, -.32, Math.sin(angle) * 1.45); chandelier.add(crystal)
  }
  const ballroomLight = new THREE.PointLight('#ffe4ad', 85, 24, 2); ballroomLight.position.set(0, 2.7, -56); scene.add(ballroomLight)
  for (const z of [-4, -17, -30]) {
    const fixture = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 8), materials.glow); fixture.position.set(0, 4.05, z); scene.add(fixture)
    const light = new THREE.PointLight('#fff0d0', 12, 9, 2); light.position.set(0, 3.9, z); scene.add(light)
  }
  const frameFinishes = {
    brass: materials.gold,
    silver: new THREE.MeshStandardMaterial({ color: '#bfc9c7', metalness: .75, roughness: .36 }),
    dark: new THREE.MeshStandardMaterial({ color: '#293335', metalness: .25, roughness: .5 }),
  }
  for (const frame of pictureFrames) {
    const group = new THREE.Group(); group.name = `picture-frame-${frame.id}`; group.position.set(frame.x, frame.y, frame.z); group.rotation.y = frame.rotation; scene.add(group)
    const finish = frameFinishes[frame.finish ?? 'brass']
    const edge = frame.finish === 'silver' ? .045 : frame.finish === 'dark' ? .055 : .07
    const surround = new THREE.Mesh(boxGeometry, materials.dark); surround.scale.set(frame.width + .22, frame.height + .22, .07); group.add(surround)
    for (const side of [-1, 1]) {
      const vertical = new THREE.Mesh(boxGeometry, finish); vertical.scale.set(edge, frame.height + .2, .11); vertical.position.set(side * (frame.width + .13) / 2, 0, .035); group.add(vertical)
      const horizontal = new THREE.Mesh(boxGeometry, finish); horizontal.scale.set(frame.width + .2, edge, .11); horizontal.position.set(0, side * (frame.height + .13) / 2, .035); group.add(horizontal)
    }
    const placeholder = canvasTexture(320, 400, context => {
      context.fillStyle = '#d6d9d2'; context.fillRect(0, 0, 320, 400)
      context.strokeStyle = '#b5b9b0'; context.lineWidth = 1; context.strokeRect(24, 24, 272, 352)
      context.fillStyle = '#818b83'; context.font = '300 55px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText('+', 160, 195)
    })
    textures.push(placeholder)
    const material = new THREE.MeshStandardMaterial({ map: placeholder, roughness: .88 })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(frame.width, frame.height), material); mesh.position.z = .095; mesh.userData.frameId = frame.id; group.add(mesh)
    surfaces.push({ mesh, id: frame.id, placeholder, mat: frame.mat === 'dark' ? '#15191b' : '#e7e8e2' })
  }
  const grass = new THREE.MeshStandardMaterial({ color: '#6f8850', roughness: 1 })
  box(140, .2, 190, -81, -.32, -36, grass)
  box(8, .2, 86, -7, -.32, -2, grass)
  box(8, .2, 65, -7, -.32, -98, grass)
  box(1.35, .07, 38, -5.7, -.18, -16, new THREE.MeshStandardMaterial({ color: '#8c9476', roughness: 1 }))
  const roadVertices: number[] = []
  for (let index = 0; index < 95; index++) {
    const near = 45 - index * 2
    const far = near - 2
    const nearX = -18 + Math.sin(near / 21) * 2
    const farX = -18 + Math.sin(far / 21) * 2
    roadVertices.push(nearX - 2.4, -.17, near, nearX + 2.4, -.17, near, farX - 2.4, -.17, far, farX - 2.4, -.17, far, nearX + 2.4, -.17, near, farX + 2.4, -.17, far)
  }
  const roadGeometry = new THREE.BufferGeometry(); roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roadVertices, 3)); roadGeometry.computeVertexNormals()
  scene.add(new THREE.Mesh(roadGeometry, new THREE.MeshStandardMaterial({ color: '#606464', roughness: 1, side: THREE.DoubleSide })))
  const treeCount = 440
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.13, .24, 1, 6), new THREE.MeshStandardMaterial({ color: '#625849', roughness: 1 }), treeCount)
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), treeCount * 3)
  const matrix = new THREE.Object3D()
  const color = new THREE.Color()
  for (let index = 0; index < treeCount; index++) {
    let x = -9 - random() * 100
    const z = 40 - random() * 172
    const roadX = -18 + Math.sin(z / 21) * 2
    if (Math.abs(x - roadX) < 4.3) x -= 9
    if (z < -43 && z > -68 && x > -13) x = -13 - random() * 3
    const height = 4 + random() * 7
    matrix.position.set(x, height / 2 - .3, z); matrix.scale.set(1, height, 1); matrix.rotation.set(0, 0, 0); matrix.updateMatrix(); trunks.setMatrixAt(index, matrix.matrix)
    for (let tier = 0; tier < 3; tier++) {
      matrix.position.set(x + (random() - .5) * 1.8, height * .6 + tier * 1.35, z + (random() - .5) * 1.8)
      const radius = 1.4 + random() * 1.2
      matrix.scale.set(radius, radius * .85, radius); matrix.rotation.set(random(), random(), random()); matrix.updateMatrix(); crowns.setMatrixAt(index * 3 + tier, matrix.matrix)
      color.setHSL(.2 + random() * .12, .22 + random() * .18, .2 + random() * .15); crowns.setColorAt(index * 3 + tier, color)
    }
  }
  scene.add(trunks, crowns)
  const environment = createEnvironment(scene, crowns.material, sunlight)
  const dustGeometry = new THREE.BufferGeometry()
  const particles = Array.from({ length: 120 }, () => [random() * 5 - 2.5, random() * 4.2, -random() * 35]).flat()
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particles, 3))
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: '#fff0c8', size: .018, transparent: true, opacity: .38, depthWrite: false }))
  scene.add(dust); animated.push(dust)
  scene.updateMatrixWorld(true)
  const boxBatches = new Map<THREE.Material, THREE.Mesh[]>()
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.geometry !== boxGeometry || Array.isArray(object.material)) return
    const batch = boxBatches.get(object.material) ?? []
    batch.push(object)
    boxBatches.set(object.material, batch)
  })
  for (const [material, meshes] of boxBatches) {
    if (meshes.length < 2) continue
    const batch = new THREE.InstancedMesh(boxGeometry, material, meshes.length)
    meshes.forEach((mesh, index) => { batch.setMatrixAt(index, mesh.matrixWorld); mesh.removeFromParent() })
    batch.computeBoundingSphere()
    scene.add(batch)
  }
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof THREE.MeshStandardMaterial || object.name === 'window-light-patch' && material instanceof THREE.MeshBasicMaterial) playerShadow.attach(material)
    }
  })
  const shadowLights = scene.children.filter((object): object is THREE.PointLight => object instanceof THREE.PointLight)
  const shadowFeet = new THREE.Vector3()
  const shadowSun = new THREE.Vector3()
  const shadowLamp = new THREE.Vector3()
  return {
    surfaces,
    levels: environment.levels,
    render(camera: THREE.PerspectiveCamera) {
      shadowFeet.set(camera.position.x, floorHeight(camera.position.z), camera.position.z)
      shadowSun.copy(sunlight.position).sub(sunlight.target.position).normalize()
      let nearest: THREE.PointLight | undefined
      let distance = Infinity
      for (const light of shadowLights) {
        const next = light.position.distanceTo(camera.position)
        if (next < distance && next < (light.distance || 24)) { nearest = light; distance = next }
      }
      shadowLamp.copy(nearest?.position ?? camera.position)
      const daylight = THREE.MathUtils.smoothstep(camera.position.z, -36, -33.7)
      playerShadow.update(shadowFeet, shadowSun, shadowLamp, daylight * (.12 + sunlight.intensity * .045), nearest ? .5 * Math.max(.15, 1 - distance / (nearest.distance || 24)) : 0)
      doorViews.forEach(view => view.update(renderer, camera))
      renderer.render(scene, camera)
    },
    animate(time: number, motion: boolean, bands: readonly number[] = [], performance = 0, waveform: readonly number[] = []) {
      environment.animate(time, motion, bands, performance, waveform)
      windowLight.forEach((material, index) => { material.opacity = .05 + environment.levels[index % 3]! * .35; material.color.copy(sunlight.color) })
      ballroomLight.intensity = 35 + environment.levels[1]! * 140
      ballroomLight.color.setHSL(.08 + environment.levels[2]! * .3, .6, .7)
      if (!motion) return
      chandelier.rotation.z = Math.sin(time * .35) * (.003 + environment.levels[1]! * .004)
      dust.position.y = Math.sin(time * .13) * .14
    },
    destroy() {
      environment.destroy()
      doorViews.forEach(view => view.destroy())
      const geometries = new Set<THREE.BufferGeometry>()
      const disposableMaterials = new Set<THREE.Material>()
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          geometries.add(object.geometry)
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) disposableMaterials.add(material)
        }
      })
      geometries.forEach(geometry => geometry.dispose())
      disposableMaterials.forEach(material => material.dispose())
      textures.forEach(texture => texture.dispose())
    },
  }
}