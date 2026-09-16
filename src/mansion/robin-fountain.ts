import * as THREE from 'three'
import { ballroomCenter } from './layout'
import { ballroomWait } from './robin-state'
import { createFountainWater } from './fountain-water'

export function createRobinFountain(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const root = new THREE.Group(); root.name = 'robin-performance'; scene.add(root)
  const progress = { value: 0 }
  const countdown = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { progress },
    vertexShader: `varying vec2 point; void main(){point=(uv-.5)*8.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform float progress; varying vec2 point;
      void main(){float radius=length(point);float angle=mod(atan(point.x,point.y)+6.2831853,6.2831853)/6.2831853;
        float ring=exp(-pow((radius-3.48)*45.0,2.0));float loaded=step(angle,progress)*step(.0001,progress);
        float ticks=pow(abs(cos(angle*6.2831853*48.0)),24.0)*exp(-pow((radius-3.28)*60.0,2.0));
        gl_FragColor=vec4(mix(vec3(.48,.25,.9),vec3(1.0,.82,.4),loaded),ring*(.12+loaded*.88)+ticks*(.12+progress*.35));}`,
  }))
  countdown.name = 'robin-ballroom-countdown'; countdown.rotation.x = -Math.PI / 2; countdown.position.set(0, -2.963, ballroomCenter.z); root.add(countdown)
  const glyphMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { glyph: { value: null as THREE.Texture | null }, reveal: { value: 0 } },
    vertexShader: `varying vec2 glyphUV;void main(){glyphUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform sampler2D glyph;uniform float reveal;varying vec2 glyphUV;void main(){gl_FragColor=vec4(1.0,.79,.32,texture2D(glyph,glyphUV).a*reveal*.8);}`,
  })
  const readyGlyph = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), glyphMaterial)
  readyGlyph.name = 'robin-ready-glyph'; readyGlyph.rotation.x = -Math.PI / 2; readyGlyph.position.set(0, -2.95, ballroomCenter.z); readyGlyph.visible = false; root.add(readyGlyph)
  const fountain = new THREE.Group(); fountain.name = 'robin-fountain'; fountain.visible = false; fountain.position.set(0, -3, ballroomCenter.z); root.add(fountain)
  const stone = new THREE.MeshStandardMaterial({ color: '#ded9e7', roughness: .32, metalness: .18 })
  const gold = new THREE.MeshStandardMaterial({ color: '#d6b571', metalness: .8, roughness: .23, emissive: '#8f6530', emissiveIntensity: .12 })
  const dark = new THREE.MeshStandardMaterial({ color: '#251b35', metalness: .45, roughness: .3 })
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, height: number) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.y = height; fountain.add(mesh); return mesh
  }
  add(new THREE.CylinderGeometry(2.86, 3.02, .22, 64), dark, .11)
  add(new THREE.CylinderGeometry(2.62, 2.83, .28, 64), stone, .33)
  add(new THREE.CylinderGeometry(2.48, 2.48, .08, 64), dark, .43)
  for (const [radius, height, tube] of [[2.65,.54,.16],[2.97,.2,.035],[1.03,1.65,.1],[.55,2.45,.075]]) {
    const rim = add(new THREE.TorusGeometry(radius, tube, 12, 80), gold, height); rim.rotation.x = Math.PI / 2
  }
  add(new THREE.CylinderGeometry(.27, .5, 1.1, 24), stone, 1.02)
  add(new THREE.CylinderGeometry(1.02, .35, .32, 48), stone, 1.48)
  add(new THREE.CylinderGeometry(.17, .25, .8, 24), gold, 2.02)
  add(new THREE.CylinderGeometry(.55, .2, .22, 40), stone, 2.36)
  add(new THREE.SphereGeometry(.16, 16, 12), gold, 2.55)
  const water = createFountainWater(renderer); fountain.add(water.mesh)
  const clock = { value: 0 }; const energy = { value: 0 }; const melody = { value: 0 }; const strength = { value: 0 }
  const spectrum = { value: new Float32Array(12) }; const hit = { value: 0 }
  const jetGeometry = new THREE.BufferGeometry()
  const drops = new Float32Array(2400 * 3)
  for (let index = 0; index < 2400; index++) {
    drops[index * 3] = index % 12
    drops[index * 3 + 1] = Math.floor(index / 12) / 200
    drops[index * 3 + 2] = ((index * 73) % 997) / 997
  }
  jetGeometry.setAttribute('position', new THREE.BufferAttribute(drops, 3))
  const jets = new THREE.Points(jetGeometry, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { clock, energy, melody, strength, spectrum, hit },
    vertexShader: `uniform float clock;uniform float energy;uniform float melody;uniform float spectrum[12];uniform float hit;varying float life;varying float lane;
      void main(){lane=position.x;float angle=lane/12.0*6.2831853;float height=1.1+energy*.6+spectrum[int(lane)]*2.0+hit*.22;
        float velocity=sqrt(2.0*9.81*height);float flight=2.0*velocity/9.81;
        float age=fract(position.y+clock/flight);float seconds=age*flight;life=age;
        float radius=mix(2.12,.25,age);vec3 point=vec3(cos(angle)*radius,.61+velocity*seconds-4.905*seconds*seconds,sin(angle)*radius);
        point.xz+=vec2(sin(position.z*41.0),cos(position.z*31.0))*.018;
        vec4 view=modelViewMatrix*vec4(point,1.0);gl_PointSize=clamp((22.0+position.z*15.0)/max(.1,-view.z),1.2,7.0);gl_Position=projectionMatrix*view;}`,
    fragmentShader: `uniform float strength;varying float life;varying float lane;void main(){float radius=length(gl_PointCoord-.5)*2.0;float glow=exp(-radius*radius*4.0)*(1.0-smoothstep(.5,1.0,radius));vec3 color=mix(vec3(.65,.4,1.0),vec3(1.0,.94,.72),.5+.5*sin(lane));gl_FragColor=vec4(color*1.5,glow*.7*strength);}`,
  }))
  jets.name = 'robin-fountain-jets'; jets.frustumCulled = false; fountain.add(jets)
  const splashGeometry = new THREE.BufferGeometry()
  const splashDrops = new Float32Array(960 * 3)
  for (let index = 0; index < 960; index++) {
    splashDrops[index * 3] = index % 12
    splashDrops[index * 3 + 1] = Math.floor(index / 12) / 80
    splashDrops[index * 3 + 2] = ((index * 97) % 991) / 991
  }
  splashGeometry.setAttribute('position', new THREE.BufferAttribute(splashDrops, 3))
  const splashes = new THREE.Points(splashGeometry, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { clock, spectrum, hit, strength },
    vertexShader: `uniform float clock;uniform float spectrum[12];uniform float hit;varying float fade;
      void main(){float band=spectrum[int(position.x)];float angle=(position.x+position.z*.5)/12.0*6.2831853;
        float age=fract(position.y+clock*1.4);float height=.16+band*.8+hit*.35;
        float velocity=sqrt(2.0*9.81*height);float seconds=age*2.0*velocity/9.81;
        float radius=.3+age*(.6+band*.85);vec3 point=vec3(cos(angle)*radius,.6+velocity*seconds-4.905*seconds*seconds,sin(angle)*radius);
        fade=sin(age*3.14159265)*(.3+band*.7);vec4 view=modelViewMatrix*vec4(point,1.0);gl_PointSize=clamp((18.0+hit*8.0)/max(.1,-view.z),1.0,5.0);gl_Position=projectionMatrix*view;}`,
    fragmentShader: `uniform float strength;varying float fade;void main(){float radius=length(gl_PointCoord-.5)*2.0;gl_FragColor=vec4(1.0,.9,.65,(1.0-smoothstep(.05,1.0,radius))*fade*strength*.6);}`,
  }))
  splashes.name = 'robin-spectrum-splashes'; splashes.frustumCulled = false; fountain.add(splashes)
  const flameMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { clock, energy, strength },
    vertexShader: `varying vec2 flameUV;varying float flameSeed;void main(){flameUV=uv;flameSeed=instanceMatrix[3].x*7.0+instanceMatrix[3].z*11.0;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform float clock;uniform float energy;uniform float strength;varying vec2 flameUV;varying float flameSeed;
      float hash(vec2 point){return fract(sin(dot(point,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 point){vec2 cell=floor(point);vec2 blend=fract(point);blend=blend*blend*(3.0-2.0*blend);return mix(mix(hash(cell),hash(cell+vec2(1,0)),blend.x),mix(hash(cell+vec2(0,1)),hash(cell+vec2(1,1)),blend.x),blend.y);}
      void main(){vec2 point=flameUV;float turbulence=noise(vec2(point.x*5.0+flameSeed,point.y*7.0-clock*2.8))*.65+noise(vec2(point.x*11.0,point.y*17.0-clock*4.0+flameSeed))*.35;
        float center=.5+sin(point.y*8.0-clock*3.0+flameSeed)*point.y*.14;
        float shape=1.0-abs(point.x-center)/(max(.025,(1.0-point.y)*.45));float flame=smoothstep(.15,.75,shape+turbulence*.5-point.y*.3);
        float fade=smoothstep(0.0,.12,point.y)*(1.0-smoothstep(.72,1.0,point.y));vec3 color=mix(vec3(.35,.035,1.0),vec3(.94,.75,1.0),pow(max(0.0,shape),4.0)*(1.0-point.y));
        gl_FragColor=vec4(color*(1.0+energy*.4),flame*fade*strength*.85);}`,
  })
  const flameGeometry = new THREE.PlaneGeometry(.55, 1.05); flameGeometry.translate(0, .525, 0)
  const flames = new THREE.InstancedMesh(flameGeometry, flameMaterial, 24)
  const placement = new THREE.Object3D()
  for (let index = 0; index < 24; index++) {
    const angle = Math.floor(index / 2) / 12 * Math.PI * 2
    placement.position.set(Math.cos(angle) * 2.9, .2, Math.sin(angle) * 2.9)
    placement.rotation.y = -angle + Math.PI / 2 + (index % 2) * Math.PI / 2
    placement.updateMatrix(); flames.setMatrixAt(index, placement.matrix)
  }
  flames.name = 'robin-violet-flames'; flames.frustumCulled = false; fountain.add(flames)
  const glow = new THREE.PointLight('#b481ff', 0, 12, 2); glow.position.y = 1.4; fountain.add(glow)
  const crownLight = new THREE.PointLight('#ffe8ab', 0, 10, 2); crownLight.position.y = 3.3; fountain.add(crownLight)
  let elapsed = 0
  let glyphTime = 0
  return {
    setGlyph(texture: THREE.Texture) { glyphMaterial.uniforms.glyph!.value?.dispose(); glyphMaterial.uniforms.glyph!.value = texture },
    update(delta: number, waiting: number, awakened: boolean, active: boolean, cycle: number, ended: boolean, motion: boolean, levels: readonly number[], bands: readonly number[] = [], impact = 0) {
      progress.value = Math.min(1, waiting / ballroomWait)
      countdown.visible = !awakened
      countdown.userData.progress = progress.value
      glyphTime = awakened ? glyphTime + Math.min(delta, .05) : 0
      readyGlyph.visible = awakened && !active && !!glyphMaterial.uniforms.glyph!.value
      glyphMaterial.uniforms.reveal!.value = motion ? THREE.MathUtils.smoothstep(glyphTime, 0, 2.5) : 1
      fountain.visible = active
      if (!active) return
      const seconds = cycle * 240 / 104
      const rise = motion ? THREE.MathUtils.smoothstep(seconds, 0, 6) : 1
      fountain.scale.y = Math.max(.001, rise)
      fountain.userData.rise = rise
      const bass = motion && !ended ? levels[0] ?? 0 : 0
      energy.value += (bass - energy.value) * (1 - Math.exp(-delta * 5))
      melody.value += ((motion && !ended ? levels[1] ?? 0 : 0) - melody.value) * (1 - Math.exp(-delta * 4))
      hit.value = motion && !ended ? impact : 0
      for (let lane = 0; lane < 12; lane++) {
        const target = motion && !ended ? Math.min(1, Math.max(0, ...bands.slice(lane * 4, lane * 4 + 4))) : 0
        spectrum.value[lane] = spectrum.value[lane]! + (target - spectrum.value[lane]!) * (1 - Math.exp(-delta * 6))
      }
      strength.value = rise * (ended ? .45 : 1)
      elapsed += motion ? Math.min(delta, .05) : 0
      clock.value = motion ? elapsed : 2
      water.update(delta, energy.value + hit.value * .5, motion && !ended)
      glow.intensity = rise * (8 + energy.value * 18)
      crownLight.intensity = rise * (12 + melody.value * 22)
      gold.emissiveIntensity = .1 + melody.value * .4
    },
    destroy() {
      glyphMaterial.uniforms.glyph!.value?.dispose()
      water.destroy()
      const materials = new Set<THREE.Material>()
      root.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Points) { object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material) } })
      materials.forEach(material => material.dispose()); root.removeFromParent()
    },
  }
}