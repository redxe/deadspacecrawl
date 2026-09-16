import * as THREE from 'three'
import seedrandom from 'seedrandom'
import { mansionSeed, hallLampDepths, ballroomLampDepths } from './layout'
import { musicResponse, waveformResponse } from './music-response'
import { createClouds } from './clouds'

export function createEnvironment(scene: THREE.Scene, leaves: THREE.MeshStandardMaterial, sunlight: THREE.DirectionalLight) {
  const random = seedrandom(`${mansionSeed}-garden`)
  const textures: THREE.Texture[] = []
  const timeUniform = { value: 0 }
  const windUniform = { value: 0 }
  const levels = [0, 0, 0]
  const bassUniform = { value: 0 }
  const melodyUniform = { value: 0 }
  const wallpaperTime = { value: 0 }
  const show = { value: 0 }
  const waveData = new Uint8Array(64 * 4).fill(128)
  const waveTexture = new THREE.DataTexture(waveData, 64, 1, THREE.RGBAFormat)
  waveTexture.magFilter = THREE.LinearFilter; waveTexture.minFilter = THREE.LinearFilter; waveTexture.needsUpdate = true; textures.push(waveTexture)
  const shades: THREE.MeshStandardMaterial[] = []
  const lampLights: THREE.PointLight[] = []
  const lampGlows: THREE.MeshBasicMaterial[] = []
  const clouds = createClouds(scene)
  let accentLevel = 0
  let previousBass = 0
  const wind = (material: THREE.MeshStandardMaterial) => {
    material.onBeforeCompile = shader => {
      shader.uniforms.gardenTime = timeUniform
      shader.uniforms.gardenWind = windUniform
      shader.uniforms.gardenShow = show
      shader.uniforms.gardenMelody = melodyUniform
      shader.vertexShader = `uniform float gardenTime; uniform float gardenWind;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float gardenPhase = instanceMatrix[3].x * .31 + instanceMatrix[3].z * .19;
          transformed.x += sin(gardenTime * 1.2 + gardenPhase + position.y) * gardenWind * max(0.0, position.y + .35);
          transformed.z += cos(gardenTime * .8 + gardenPhase) * gardenWind * .4 * max(0.0, position.y + .35);
        #else
          transformed.x += sin(gardenTime * 1.2 + position.y) * gardenWind * max(0.0,position.y+.35);
        #endif`)
      shader.fragmentShader = `uniform float gardenShow; uniform float gardenMelody;\n${shader.fragmentShader}`.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(.32,.12,.58) * gardenShow * (.12 + gardenMelody*.35);`)
    }
  }
  wind(leaves)
  const porchMaterials = new Set<THREE.MeshStandardMaterial>()
  scene.getObjectByName('shared-entrance-porch')?.traverse(object => {
    if (object instanceof THREE.Mesh && (object.name === 'porch-grass' || object.geometry.name === 'porch-tree-canopy') && object.material instanceof THREE.MeshStandardMaterial) porchMaterials.add(object.material)
  })
  porchMaterials.forEach(wind)
  const grassMaterial = new THREE.MeshStandardMaterial({ color: '#b5d991', roughness: 1, side: THREE.DoubleSide })
  wind(grassMaterial)
  const blade = new THREE.PlaneGeometry(.075, .65, 1, 3); blade.translate(0, .325, 0)
  const vertices = blade.getAttribute('position')
  for (let index = 0; index < vertices.count; index++) vertices.setX(index, vertices.getX(index) * Math.max(0, 1 - vertices.getY(index) / .65))
  const grass = new THREE.InstancedMesh(blade, grassMaterial, 8400)
  const placement = new THREE.Object3D()
  const color = new THREE.Color()
  for (let index = 0; index < grass.count; index++) {
    const depth = 12 - random() * 55
    const road = -18 + Math.sin(depth / 21) * 2
    let horizontal = index < 4200 ? -3.5 - random() * 10 : road - 3.1 - random() * 15
    if (index < 4200 && Math.abs(horizontal + 5.7) < .95) horizontal -= 2
    if (Math.abs(horizontal - road) < 2.9) horizontal = road + 3
    placement.position.set(horizontal, -.21, depth)
    placement.rotation.y = random() * Math.PI
    placement.scale.set(.65 + random(), .35 + random() * .65, 1)
    placement.updateMatrix(); grass.setMatrixAt(index, placement.matrix)
    color.setHSL(.2 + random() * .12, .32 + random() * .2, .28 + random() * .2); grass.setColorAt(index, color)
  }
  grass.frustumCulled = false
  scene.add(grass)
  const sunMaterial = new THREE.MeshBasicMaterial({ color: '#fff2b6', fog: false })
  const sun = new THREE.Mesh(new THREE.SphereGeometry(3.8, 16, 12), sunMaterial)
  sun.name = 'mansion-sun'
  sun.position.set(-75, 32, -21); scene.add(sun)

  const wallpaper = (floral: boolean) => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128
    const context = canvas.getContext('2d')!
    context.fillStyle = floral ? '#dee5c8' : '#46374d'; context.fillRect(0, 0, 512, 128)
    context.strokeStyle = floral ? '#46796e' : '#d7b878'; context.lineWidth = 4
    context.beginPath(); context.moveTo(0, 8); context.lineTo(512, 8); context.moveTo(0, 120); context.lineTo(512, 120); context.stroke()
    for (let index = 0; index < 8; index++) {
      const horizontal = index * 64 + 32
      if (floral) {
        context.strokeStyle = '#568476'; context.lineWidth = 3
        context.beginPath(); context.moveTo(horizontal - 32, 64); context.bezierCurveTo(horizontal - 12, 20, horizontal + 12, 108, horizontal + 32, 64); context.stroke()
        context.fillStyle = '#7c9e75'; context.beginPath(); context.ellipse(horizontal - 15, 76, 15, 6, -.6, 0, Math.PI * 2); context.fill()
        context.fillStyle = index % 2 ? '#bd6674' : '#cd974c'
        for (let petal = 0; petal < 6; petal++) {
          const angle = petal * Math.PI / 3
          context.beginPath(); context.ellipse(horizontal + Math.cos(angle) * 9, 49 + Math.sin(angle) * 9, 7, 4, angle, 0, Math.PI * 2); context.fill()
        }
        context.fillStyle = '#eee4ac'; context.beginPath(); context.arc(horizontal, 49, 4, 0, Math.PI * 2); context.fill()
      } else {
        context.save(); context.translate(horizontal, 64); context.rotate(Math.PI / 4)
        context.fillStyle = index % 2 ? '#73aea6' : '#c37e81'; context.fillRect(-18, -18, 36, 36)
        context.strokeStyle = '#eed7a0'; context.lineWidth = 2; context.strokeRect(-24, -24, 48, 48); context.restore()
      }
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping; texture.repeat.set(3, 1); texture.anisotropy = 4; textures.push(texture)
    return Array.from({ length: 1 }, (_, index) => {
      const material = new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: .06, roughness: .94 })
      material.onBeforeCompile = shader => {
        shader.uniforms.wallpaperTime = wallpaperTime
        shader.uniforms.wallpaperBass = bassUniform
        shader.uniforms.wallpaperMelody = melodyUniform
        shader.uniforms.wallpaperShow = show
        shader.uniforms.wallpaperWave = { value: waveTexture }
        shader.fragmentShader = `uniform float wallpaperTime; uniform float wallpaperBass; uniform float wallpaperMelody; uniform float wallpaperShow; uniform sampler2D wallpaperWave;\n${shader.fragmentShader}`.replace('#include <map_fragment>', `
          vec2 patternUV = vMapUv;
          float edgeMask = smoothstep(.12, .3, patternUV.y) * (1.0 - smoothstep(.7, .88, patternUV.y));
          patternUV.x += edgeMask * (sin(patternUV.x * 12.0 + wallpaperTime * ${floral ? '1.8' : '-2.2'} + ${index.toFixed(1)}) * wallpaperMelody * .075 + sin(wallpaperTime * 2.7) * wallpaperBass * .045);
          patternUV.y += edgeMask * sin(patternUV.x * 20.0 - wallpaperTime * 2.4) * wallpaperBass * .11;
          vec4 sampledDiffuseColor = texture2D(map, patternUV);
          float soundWave = (texture2D(wallpaperWave,vec2(fract(vMapUv.x),.5)).r-.5)*.8;
          float goldTrace = exp(-pow((vMapUv.y-.5-soundWave)*65.0,2.0));
          float violetTrace = exp(-pow((vMapUv.y-.5+soundWave*.7)*40.0,2.0));
          vec3 waveColor = vec3(.018,.007,.04) + vec3(1.0,.77,.3)*goldTrace + vec3(.5,.18,1.0)*violetTrace*.65;
          sampledDiffuseColor = mix(sampledDiffuseColor,vec4(waveColor,1.0),wallpaperShow);
          diffuseColor *= sampledDiffuseColor;
        `).replace('#include <emissivemap_fragment>', `
          totalEmissiveRadiance *= texture2D(emissiveMap, patternUV).rgb;
          totalEmissiveRadiance *= 1.0 + .7 * wallpaperMelody * sin(patternUV.x * 12.0 - wallpaperTime * 3.0);
          totalEmissiveRadiance = mix(totalEmissiveRadiance,waveColor*1.8,wallpaperShow);
        `)
      }
      material.customProgramCacheKey = () => `wallpaper-${floral}-${index}`
      return material
    })
  }
  const upper = wallpaper(true)
  const lower = wallpaper(false)
  const strip = (width: number, height: number, horizontal: number, vertical: number, depth: number, rotation: number, material: THREE.Material) => {
    const geometry = new THREE.PlaneGeometry(width, height)
    const coordinates = geometry.getAttribute('uv')
    const origin = Math.abs(Math.sin(rotation)) > .5 ? depth * -Math.sin(rotation) - width / 2 : horizontal * Math.cos(rotation) - width / 2
    for (let index = 0; index < coordinates.count; index++) coordinates.setX(index, (origin + coordinates.getX(index) * width) / 4.875)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(horizontal, vertical, depth); mesh.rotation.y = rotation; scene.add(mesh)
  }
  for (const side of [-1, 1]) {
    strip(39, .3, side * 2.94, 4.22, -16.5, -side * Math.PI / 2, upper[0]!)
    const lowerSegments = side > 0 ? [[-36, -28.84], [-27.16, -9.84], [-8.16, 3]] : [[-36, 3]]
    for (const [start, end] of lowerSegments) strip(end! - start!, .24, side * 2.925, .51, (start! + end!) / 2, -side * Math.PI / 2, lower[0]!)
    strip(19.6, .35, side * 9.935, 4.12, -55, -side * Math.PI / 2, upper[0]!)
    strip(19.6, .3, side * 9.845, -2.55, -55, -side * Math.PI / 2, lower[0]!)
    strip(6.5, .35, side * 6.5, 4.12, -45.265, Math.PI, upper[0]!)
    strip(2.3, .3, side * 4.35, -2.55, -45.37, Math.PI, lower[0]!)
    strip(2.45, .3, side * 8.475, -2.55, -45.37, Math.PI, lower[0]!)
    strip(2.08, .24, side * 1.96, .51, 2.974, Math.PI, lower[0]!)
  }
  strip(19.87, .35, 0, 4.12, -64.83, 0, upper[0]!)
  strip(19.69, .3, 0, -2.55, -64.865, 0, lower[0]!)
  strip(5.97, .3, 0, 4.2, 3.028, Math.PI, upper[0]!)
  const lampColors = ['#e892a7', '#81d6c5', '#eabe73', '#99b7ed']
  const lampGeometry = new THREE.CylinderGeometry(.19, .33, .4, 16, 1, true)
  const stemGeometry = new THREE.CylinderGeometry(.025, .025, .46, 8)
  const brass = new THREE.MeshStandardMaterial({ color: '#bb9b60', metalness: .7, roughness: .28 })
  const lamp = (horizontal: number, vertical: number, depth: number, index: number) => {
    const material = new THREE.MeshStandardMaterial({ color: lampColors[index % 4], emissive: lampColors[index % 4], emissiveIntensity: .45, roughness: .5, side: THREE.DoubleSide })
    shades.push(material)
    const shade = new THREE.Mesh(lampGeometry, material); shade.position.set(horizontal, vertical, depth); scene.add(shade)
    const stem = new THREE.Mesh(stemGeometry, brass); stem.position.set(horizontal, vertical - .38, depth); scene.add(stem)
    const wall = Math.sign(horizontal) * (Math.abs(horizontal) > 3 ? 9.64 : 2.95)
    const plate = new THREE.Mesh(new THREE.BoxGeometry(.045, .28, .18), brass); plate.position.set(wall, vertical - .5, depth); scene.add(plate)
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(wall - horizontal), .045, .055), brass)
    bracket.position.set((wall + horizontal) / 2, vertical - .5, depth); scene.add(bracket)
    const glowMaterial = new THREE.MeshBasicMaterial({ color: lampColors[index % 4] })
    lampGlows.push(glowMaterial)
    const glow = new THREE.Mesh(new THREE.SphereGeometry(.095, 8, 6), glowMaterial)
    glow.position.set(horizontal, vertical - .12, depth); scene.add(glow)
    const light = new THREE.PointLight(lampColors[index % 4], 5, 5, 2)
    light.position.set(horizontal - Math.sign(horizontal) * .18, vertical - .15, depth); scene.add(light); lampLights.push(light)
  }
  for (const [index, depth] of hallLampDepths.entries()) lamp(2.65, 3.4, depth, index)
  for (const side of [-1, 1]) for (const [index, depth] of ballroomLampDepths.entries()) lamp(side * 9.5, 1.8, depth, index + (side > 0 ? 2 : 0))
  const accent = new THREE.PointLight('#86d9cd', 15, 12, 2); accent.position.set(-7, 1.5, -55); scene.add(accent)
  let previousTime = 0
  return {
    levels,
    animate(time: number, motion: boolean, bands: readonly number[], performance = 0, waveform: readonly number[] = []) {
      const target = motion ? musicResponse(bands) : [0, 0, 0]
      const delta = Math.min(.1, previousTime ? time - previousTime : 0); previousTime = time
      show.value += (performance - show.value) * (1 - Math.exp(-delta * 2))
      const wave = waveformResponse(motion ? waveform : [])
      for (let index = 0; index < 64; index++) {
        const value = wave[index]!
        waveData[index * 4] = Math.round((value * .5 + .5) * 255)
        waveData[index * 4 + 3] = 255
      }
      waveTexture.needsUpdate = true
      accentLevel = motion ? Math.max(accentLevel * Math.exp(-delta * 4), Math.min(1, Math.max(0, target[0]! - previousBass) * 5)) : 0
      previousBass = target[0]!
      for (let index = 0; index < 3; index++) levels[index] += (target[index]! - levels[index]!) * (1 - Math.exp(-delta * (target[index]! > levels[index]! ? 7 : 3)))
      timeUniform.value = motion ? time : 0
      bassUniform.value = levels[0]!
      melodyUniform.value = levels[1]!
      wallpaperTime.value += delta * (levels[0]! + levels[1]!) * 2
      windUniform.value = motion ? .025 + levels[0]! * (.16 + show.value * .12) + levels[1]! * .09 : 0
      clouds.animate(delta, motion, levels[0]!, levels[1]!)
      sun.scale.setScalar(1 + levels[0]! * .09)
      sunMaterial.color.setHSL(.12 - levels[1]! * .035, .65, .82 + levels[2]! * .07)
      sunlight.intensity = .65 + levels[1]! * 3.4 + accentLevel * 1.8
      sunlight.color.setHSL(.06 + levels[2]! * .13, .22 + levels[1]! * .42, .78)
      shades.forEach((shade, index) => {
        const strength = levels[index % 3]!
        const hue = [.97, .46, .1, .59][index % 4]!
        shade.color.setHSL(hue + levels[2]! * .2, .7, .57)
        shade.emissive.copy(shade.color); shade.emissiveIntensity = .18 + strength * 2.3
        lampGlows[index]!.color.copy(shade.color)
        lampLights[index]!.color.copy(shade.color); lampLights[index]!.intensity = 2 + strength * 38 + accentLevel * 13
      })
      upper.forEach(material => { material.emissiveIntensity = .04 + levels[1]! * .95 })
      lower.forEach(material => { material.emissiveIntensity = .06 + levels[2]! * 1.1 })
      accent.intensity = 6 + levels[1]! * 38
      accent.color.setHSL(.46 + levels[2]! * .2, .65, .6)
    },
    destroy() { textures.forEach(texture => texture.dispose()) },
  }
}