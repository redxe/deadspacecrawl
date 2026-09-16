import * as THREE from 'three'
import seedrandom from 'seedrandom'
import { floorHeight } from './layout'
import { returnOrigin, returnRadius } from './robin-state'
import type { RobinFrame } from './robin-state'

export function createRobinNight(scene: THREE.Scene, renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
  const random = seedrandom('robin-night-sky')
  const group = new THREE.Group(); group.name = 'robin-night'; group.visible = false; scene.add(group)
  const clock = { value: 0 }
  const reveal = { value: 0 }
  const music = { value: new THREE.Vector3() }
  const performance = { value: 0 }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(125, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { reveal },
    vertexShader: `varying vec3 direction; void main() { direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 direction; uniform float reveal;
      float grain(vec3 point) { return fract(sin(dot(point, vec3(12.9898,78.233,43.17))) * 43758.5453); }
      float galaxy(vec3 ray, vec3 center, float size) {
        vec3 right = normalize(cross(center, vec3(0.0,1.0,0.0)));
        vec3 up = cross(right, center);
        vec2 position = vec2(dot(ray,right), dot(ray,up) * 2.8) / size;
        float radius = length(position);
        float arms = pow(.5 + .5 * cos(atan(position.y,position.x) * 2.0 - radius * 9.0), 3.0);
        return step(.8,dot(ray,center)) * (exp(-radius * radius * 8.0) + arms * exp(-radius * 2.4) * .35);
      }
      void main() {
        vec3 ray = normalize(direction);
        float belt = exp(-pow((ray.y - .35 + .1 * sin(atan(ray.z,ray.x) * 3.0)) * 13.0, 2.0));
        float dust = grain(floor(ray * 180.0)) * .55 + grain(floor(ray * 430.0)) * .45;
        float nebula = belt * (.025 + dust * .055);
        float spirals = galaxy(ray,normalize(vec3(-1.0,.5,.12)),.25) * .28 + galaxy(ray,normalize(vec3(-1.0,.35,-.65)),.16) * .16;
        gl_FragColor = vec4((vec3(.0015,.001,.004) + vec3(.32,.18,.55) * nebula + vec3(.85,.72,1.0) * spirals) * reveal, 1.0);
      }`,
  }))
  sky.position.z = -28; sky.renderOrder = -20; sky.name = 'robin-galaxies'; group.add(sky)
  const starsGeometry = new THREE.BufferGeometry()
  const positions: number[] = []; const phases: number[] = []
  for (let index = 0; index < 1800; index++) {
    const azimuth = random() * Math.PI * 2
    const height = .08 + random() * .88
    const radius = Math.sqrt(1 - height * height)
    positions.push(Math.cos(azimuth) * radius * 118, height * 118, Math.sin(azimuth) * radius * 118 - 28)
    phases.push(random() * Math.PI * 2)
  }
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  starsGeometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1))
  const stars = new THREE.Points(starsGeometry, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { clock, reveal, music, performance },
    vertexShader: `attribute float phase; uniform float clock; uniform vec3 music; uniform float performance; varying float brightness;
      void main() { float voice = mix(music.x,music.y,fract(phase)); brightness = (.6 + .4 * sin(clock * (.35 + fract(phase) * .3) + phase)) * (1.0+performance*voice*1.8); gl_PointSize = 1.2 + fract(phase * 7.0) * 2.2 + performance*music.z; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float reveal; varying float brightness; void main() { float radius = length(gl_PointCoord - .5) * 2.0; gl_FragColor = vec4(vec3(1.0,.9,1.0) * brightness, (1.0 - smoothstep(.1,1.0,radius)) * reveal); }`,
  }))
  stars.name = 'robin-stars'; stars.renderOrder = -19; group.add(stars)
  const moon = new THREE.Mesh(new THREE.SphereGeometry(3.8, 32, 24), new THREE.ShaderMaterial({
    uniforms: { reveal }, vertexShader: `varying vec3 lunarNormal; void main() { lunarNormal = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 lunarNormal; uniform float reveal;
      void main() { vec3 normal = normalize(lunarNormal); float phase = smoothstep(-.12,.5,dot(normal,normalize(vec3(.7,.2,1.0)))); float maria = .78 + .12 * sin(normal.x * 17.0 + sin(normal.y * 14.0)) * cos(normal.z * 19.0); float crater = pow(abs(sin(normal.x * 61.0) * sin(normal.y * 47.0 + normal.z * 27.0)), 12.0); gl_FragColor = vec4(vec3(.9,.88,1.0) * (.035 + phase * (maria - crater * .2)) * reveal * 1.6,1.0); }`,
  }))
  moon.position.set(-75, 32, -21); moon.name = 'robin-moon'; group.add(moon)
  const trailGeometry = new THREE.BufferGeometry()
  const trailPositions = new Float32Array(360 * 3)
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
  const trailMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { opacity: { value: 0 } },
    vertexShader: `void main() { vec4 view = modelViewMatrix * vec4(position,1.0); gl_PointSize = clamp(45.0 / max(.1,-view.z),1.5,9.0); gl_Position = projectionMatrix * view; }`,
    fragmentShader: `uniform float opacity; void main() { float radius = length(gl_PointCoord - .5) * 2.0; float glow = exp(-radius * radius * 5.0) * (1.0 - smoothstep(.65,1.0,radius)); gl_FragColor = vec4(mix(vec3(1.0,.7,.25),vec3(1.0,.98,.85),glow),glow * opacity); }`,
  })
  const trail = new THREE.Points(trailGeometry, trailMaterial); trail.frustumCulled = false; trail.name = 'robin-homeward-trail'; group.add(trail)
  const threadPoints = Array.from({ length: 160 }, (_, index) => {
    const depth = -62 + index / 159 * 63.3
    return new THREE.Vector3(Math.sin(depth * .7) * .06, floorHeight(depth) + .045, depth)
  })
  const thread = new THREE.Line(new THREE.BufferGeometry().setFromPoints(threadPoints), new THREE.LineBasicMaterial({ color: '#ffe8a9', transparent: true, opacity: .15, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))
  thread.name = 'robin-homeward-thread'; group.add(thread)
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { charge: { value: 0 }, reveal },
    vertexShader: `varying vec2 point; void main() { point = uv * 2.2 - 1.1; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 point; uniform float charge; uniform float reveal;
      void main() { float radius = length(point); float angle = (atan(point.y,point.x) + 3.14159265) / 6.2831853; float ring = exp(-pow((radius - ${returnRadius}) * 65.0,2.0)); float loaded = step(angle,charge); float inner = exp(-radius * radius * 8.0) * charge * .18; float etching = exp(-pow((radius - .52) * 100.0,2.0)) * (.3 + .7 * pow(abs(sin(angle * 75.398)),12.0)); gl_FragColor = vec4(mix(vec3(.65,.4,1.0),vec3(1.0,.82,.4),loaded), (ring * (.18 + loaded * .82) + etching * charge * .4 + inner) * reveal); }`,
  }))
  aura.rotation.x = -Math.PI / 2; aura.position.set(returnOrigin.x, .035, returnOrigin.z); aura.name = 'robin-return-aura'; group.add(aura)
  const fountainPulses = { value: Array.from({ length: 3 }, () => new THREE.Vector2(-1, 0)) }
  const target = new THREE.WebGLRenderTarget(1, 1)
  target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType)
  const passScene = new THREE.Scene()
  const passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const passMaterial = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { picture: { value: target.texture }, depth: { value: target.depthTexture }, night: { value: 0 }, pulse: { value: -1 }, fountainPulses, reduced: { value: 0 }, inverseProjection: { value: camera.projectionMatrixInverse }, cameraWorld: { value: camera.matrixWorld } },
    vertexShader: `varying vec2 screenUV; void main() { screenUV = uv; gl_Position = vec4(position.xy,0.0,1.0); }`,
    fragmentShader: `varying vec2 screenUV; uniform sampler2D picture; uniform sampler2D depth; uniform float night; uniform float pulse; uniform vec2 fountainPulses[3]; uniform float reduced; uniform mat4 inverseProjection; uniform mat4 cameraWorld;
      void main() {
        vec3 original = texture2D(picture,screenUV).rgb;
        float luminance = dot(original,vec3(.2126,.7152,.0722));
        vec3 tint = mix(vec3(.4,.16,.8),vec3(1.0,.7,.25),smoothstep(.1,.42,luminance));
        tint = mix(tint,vec3(1.0,.98,1.0),smoothstep(.35,.8,luminance));
        float violet = smoothstep(.05,.35,original.b-max(original.r*.9,original.g));
        tint = mix(tint,vec3(.65,.22,1.0),violet);
        vec3 palette = tint * pow(max(0.0,luminance),.9) * .9;
        float dimmer = mix(1.0,.055,smoothstep(0.0,.32,night)) + smoothstep(.34,1.0,night) * .68;
        vec3 color = mix(original,palette,smoothstep(.25,.85,night)) * dimmer;
        float surfaceDepth = texture2D(depth,screenUV).r;
        vec4 view = inverseProjection * vec4(screenUV * 2.0 - 1.0,surfaceDepth * 2.0 - 1.0,1.0);
        vec3 world = (cameraWorld * vec4(view.xyz / view.w,1.0)).xyz;
        float distanceHome = distance(world,vec3(0.0,0.0,1.3));
        float wave = exp(-pow((distanceHome - pulse * 82.0) / 1.1,2.0));
        float echo = exp(-pow((distanceHome - pulse * 82.0 + 4.0) / 1.8,2.0)) * .3;
        float strength = step(0.0,pulse) * (1.0 - smoothstep(.75,1.0,pulse)) * (1.0 - step(.99999,surfaceDepth));
        color += vec3(1.0,.8,.35) * mix(wave + echo,.12 * (1.0 - pulse),reduced) * strength * .65;
        float distanceFountain = distance(world,vec3(0.0,-2.4,-56.0));
        for(int index=0;index<3;index++) {
          float age=fountainPulses[index].x;
          float ring=exp(-pow((distanceFountain-2.9-age*13.0)/1.5,2.0));
          float envelope=smoothstep(0.0,.12,age)*(1.0-smoothstep(1.2,2.4,age));
          color+=vec3(1.0,.82,.45)*ring*envelope*fountainPulses[index].y*.085*(1.0-reduced)*(1.0-step(.99999,surfaceDepth));
        }
        gl_FragColor = vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), passMaterial); passScene.add(quad)
  const size = new THREE.Vector2()
  const daylight = (scene.background as THREE.Color).clone()
  const nightColor = new THREE.Color('#03020b')
  const daySun = scene.getObjectByName('mansion-sun')
  const dayClouds = scene.children.filter((object): object is THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> => object instanceof THREE.Mesh && object.name === 'music-cloud' && object.material instanceof THREE.ShaderMaterial)
  return {
    update(frame: RobinFrame, motion: boolean, show = 0, levels: readonly number[] = [], pulses: readonly import('./fountain-response').FountainPulse[] = []) {
      fountainPulses.value.forEach((value, index) => value.set(pulses[index]?.age ?? -1, pulses[index]?.strength ?? 0))
      group.visible = frame.awakened
      performance.value = show
      music.value.set(motion ? levels[0] ?? 0 : 0, motion ? levels[1] ?? 0 : 0, motion ? levels[2] ?? 0 : 0)
      if (!frame.awakened) {
        if (daySun) daySun.visible = true
        dayClouds.forEach(cloud => { cloud.material.uniforms.cloudNightFade!.value = 1; cloud.visible = true })
        ;(scene.background as THREE.Color).copy(daylight)
        if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(daylight)
        return
      }
      reveal.value = THREE.MathUtils.smoothstep(frame.night, .3, 1)
      clock.value = motion ? frame.nightTime : 0
      passMaterial.uniforms.night!.value = frame.night
      passMaterial.uniforms.pulse!.value = frame.pulse
      passMaterial.uniforms.reduced!.value = motion ? 0 : 1
      aura.material.uniforms.charge!.value = frame.charge
      aura.visible = frame.pulse < 0
      if (daySun) daySun.visible = frame.night < .32
      const cloudFade = 1 - THREE.MathUtils.smoothstep(frame.night, .1, .75)
      dayClouds.forEach(cloud => { cloud.material.uniforms.cloudNightFade!.value = cloudFade; cloud.visible = cloudFade > 0 })
      ;(scene.background as THREE.Color).copy(daylight).lerp(nightColor, reveal.value)
      if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(scene.background as THREE.Color)
      trailMaterial.uniforms.opacity!.value = reveal.value * (frame.unlocked ? show * .6 : .8)
      thread.material.opacity = reveal.value * (frame.unlocked ? show * .12 : .17)
      for (let index = 0; index < 360; index++) {
        const offset = (index / 360 * 63.3 + (motion ? frame.nightTime * 1.8 : 0)) % 63.3
        const depth = frame.unlocked ? 1.3 - offset : -62 + offset
        trailPositions[index * 3] = Math.sin(index * 2.4 + clock.value) * .18
        trailPositions[index * 3 + 1] = floorHeight(depth) + .12 + Math.sin(index * 1.7 + clock.value) * .055
        trailPositions[index * 3 + 2] = depth
      }
      trailGeometry.attributes.position!.needsUpdate = true
    },
    render(draw: () => void) {
      if (!group.visible) { draw(); return }
      renderer.getDrawingBufferSize(size)
      if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y)
      const previous = renderer.getRenderTarget()
      try { renderer.setRenderTarget(target); draw(); renderer.setRenderTarget(previous); renderer.render(passScene, passCamera) }
      finally { renderer.setRenderTarget(previous) }
    },
    destroy() {
      group.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) { object.geometry.dispose(); (object.material as THREE.Material).dispose() } })
      group.removeFromParent(); target.dispose(); target.depthTexture?.dispose(); quad.geometry.dispose(); passMaterial.dispose()
    },
  }
}