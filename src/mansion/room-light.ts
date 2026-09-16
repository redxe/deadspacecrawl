import * as THREE from 'three'
import type { PlayerShadow } from './player-shadow'

const roomLightGLSL = `
  float roomAperture(vec3 point, vec3 direction, float limit) {
    if (direction.z <= .01 || point.z >= 2.5) return 0.0;
    float travel = (2.5 - point.z) / direction.z;
    if (travel > limit) return 0.0;
    vec3 opening = point + direction * travel;
    float blur = .025 + (2.5 - point.z) * .025;
    float horizontal = 1.0 - smoothstep(.43 - blur, .43 + blur, abs(opening.x));
    float vertical = 1.0 - smoothstep(.5375 - blur, .5375 + blur, abs(opening.y - 2.0));
    float mullions = mix(.18, 1.0, smoothstep(.012, .04 + blur, abs(opening.x))) * mix(.18, 1.0, smoothstep(.012, .04 + blur, abs(opening.y - 2.08)));
    return horizontal * vertical * mullions / (1.0 + travel * .08);
  }
  vec2 roomWindowEnergy(vec3 point) {
    vec3 lamp = shadowLampPosition - point;
    float distanceToLamp = length(lamp);
    float sun = roomAperture(point, shadowSunDirection, 64.0) * shadowSunStrength;
    float local = roomAperture(point, lamp / max(.001, distanceToLamp), distanceToLamp) * shadowLampStrength;
    return vec2(sun, local);
  }
  vec3 roomWindowRadiance(vec3 point, vec3 normal) {
    vec2 energy = roomWindowEnergy(point);
    vec3 lampDirection = normalize(shadowLampPosition - point);
    float sunlight = energy.x * max(0.0, dot(normal, shadowSunDirection));
    float lamplight = energy.y * max(0.0, dot(normal, lampDirection));
    vec3 windowOffset = vec3(0.0, 2.0, 2.5) - point;
    float windowDistance = length(windowOffset);
    float windowFacing = max(0.0, dot(normal, windowOffset / max(.001, windowDistance)));
    float indirect = (shadowSunStrength + shadowLampStrength) * 1.1 * windowFacing / (1.0 + windowDistance * windowDistance * .18);
    float visibility = playerShadowVisibility(point);
    vec3 direct = vec3(1.0, .92, .78) * sunlight + vec3(.92, .95, 1.0) * lamplight;
    return direct * 1.35 * visibility + vec3(.9, .93, 1.0) * indirect * mix(.55, 1.0, visibility);
  }
`

export function addRoomLight(scene: THREE.Scene, shadow: PlayerShadow) {
  const materials = new Set<THREE.MeshStandardMaterial>()
  scene.traverse(object => { if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) materials.add(object.material) })
  for (const material of materials) {
    const previous = material.onBeforeCompile
    const key = material.customProgramCacheKey()
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer)
      Object.assign(shader.uniforms, shadow.uniforms)
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${roomLightGLSL}`).replace('#include <opaque_fragment>', `
        outgoingLight += diffuseColor.rgb * roomWindowRadiance(playerShadowWorld, inverseTransformDirection(normal, viewMatrix));
        #include <opaque_fragment>
      `)
    }
    material.customProgramCacheKey = () => `${key}|room-window-light`
  }
}