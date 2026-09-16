import * as THREE from 'three'
import seedrandom from 'seedrandom'
import { mansionSeed } from './layout'

export function createClouds(scene: THREE.Scene) {
  const random = seedrandom(`${mansionSeed}-clouds`)
  const time = { value: 0 }
  const response = { value: 0 }
  const tint = { value: new THREE.Color('#fff3de') }
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { cloudTime: time, cloudResponse: response, cloudTint: tint },
    vertexShader: `varying vec2 cloudUV;
      void main() { cloudUV = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 cloudUV;
      uniform float cloudTime; uniform float cloudResponse; uniform vec3 cloudTint;
      float hash(vec2 point) { return fract(sin(dot(point, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 point) {
        vec2 cell = floor(point); vec2 blend = fract(point); blend = blend * blend * (3.0 - 2.0 * blend);
        return mix(mix(hash(cell), hash(cell + vec2(1,0)), blend.x), mix(hash(cell + vec2(0,1)), hash(cell + vec2(1,1)), blend.x), blend.y);
      }
      void main() {
        vec2 point = cloudUV * vec2(5.0,3.0) + vec2(cloudTime * .065, cloudTime * .022);
        point.y += sin(point.x * 1.6 + cloudTime * .15) * (.12 + cloudResponse * .65);
        float density = noise(point) * .55 + noise(point * 2.0) * .28 + noise(point * 4.0) * .17;
        vec2 outline = (cloudUV - .5) * vec2(2.0,2.3);
        float envelope = 1.0 - smoothstep(.3, 1.0, dot(outline, outline));
        float alpha = smoothstep(.25, .7, density + cloudResponse * .12) * envelope;
        vec3 color = cloudTint * (.72 + .28 * smoothstep(0.0, 1.0, cloudUV.y));
        gl_FragColor = vec4(color, alpha * .87);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const geometry = new THREE.PlaneGeometry(1, 1)
  const clouds = Array.from({ length: 12 }, (_, index) => {
    const mesh = new THREE.Mesh(geometry, material)
    const width = 19 + random() * 17
    const height = 7 + random() * 5
    mesh.name = 'music-cloud'
    mesh.position.set(-54 - random() * 52, 19 + random() * 14, 48 - index * 14)
    mesh.rotation.set(0, Math.PI / 2, -.12 + random() * .24)
    mesh.scale.set(width, height, 1)
    scene.add(mesh)
    return { mesh, width, height, depth: mesh.position.z, phase: random() * Math.PI * 2 }
  })
  return {
    animate(delta: number, motion: boolean, energy: number, melody: number) {
      if (motion) time.value += delta * (.8 + energy * 1.6)
      response.value = motion ? melody : 0
      tint.value.setHSL(.1 + melody * .065, .13 + energy * .17, .86)
      clouds.forEach(({ mesh, width, height, depth, phase }) => {
        mesh.position.z = depth + Math.sin(time.value * .045 + phase) * 7
        mesh.scale.set(width * (1 + response.value * .14), height * (1 + response.value * .35), 1)
      })
    },
  }
}