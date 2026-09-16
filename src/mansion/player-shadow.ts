import * as THREE from 'three'

export const playerShadowGLSL = `
  uniform vec3 shadowPlayerFeet;
  uniform vec3 shadowSunDirection;
  uniform vec3 shadowLampPosition;
  uniform float shadowSunStrength;
  uniform float shadowLampStrength;
  float playerCapsuleShadow(vec3 origin, vec3 direction, float limit) {
    vec3 bottom = shadowPlayerFeet + vec3(0.0, .26, 0.0);
    vec3 axis = vec3(0.0, 1.02, 0.0);
    vec3 offset = origin - bottom;
    float axisLength = dot(axis, axis);
    float alongAxis = dot(axis, direction);
    float axisOffset = dot(axis, offset);
    float alongRay = dot(direction, offset);
    float segment = clamp((axisOffset - alongAxis * alongRay) / max(.0001, axisLength - alongAxis * alongAxis), 0.0, 1.0);
    float travel = clamp(alongAxis * segment - alongRay, 0.0, limit);
    segment = clamp((axisOffset + alongAxis * travel) / axisLength, 0.0, 1.0);
    float distanceToBody = length(origin + direction * travel - bottom - axis * segment);
    float softness = .045 + travel * .018;
    float body = (1.0 - smoothstep(.24 - softness, .24 + softness, distanceToBody)) * step(.015, travel) * step(travel, limit - .015);
    vec3 head = shadowPlayerFeet + vec3(0.0, 1.56, 0.0);
    float headTravel = clamp(dot(head - origin, direction), 0.0, limit);
    float distanceToHead = length(origin + direction * headTravel - head);
    float headSoftness = .035 + headTravel * .015;
    float headShadow = (1.0 - smoothstep(.18 - headSoftness, .18 + headSoftness, distanceToHead)) * step(.015, headTravel) * step(headTravel, limit - .015);
    return max(body, headShadow);
  }
  float playerShadowVisibility(vec3 receiver) {
    if (dot(receiver - shadowPlayerFeet, receiver - shadowPlayerFeet) > 196.0) return 1.0;
    float sun = shadowSunStrength > 0.0 ? playerCapsuleShadow(receiver, shadowSunDirection, 64.0) * shadowSunStrength : 0.0;
    vec3 lampRay = shadowLampPosition - receiver;
    float lampDistance = length(lampRay);
    float lamp = shadowLampStrength > 0.0 ? playerCapsuleShadow(receiver, lampRay / max(lampDistance, .001), lampDistance) * shadowLampStrength : 0.0;
    return 1.0 - min(.72, sun + lamp);
  }
`

export function createPlayerShadow() {
  const uniforms = {
    shadowPlayerFeet: { value: new THREE.Vector3(0, -100, 0) },
    shadowSunDirection: { value: new THREE.Vector3(-.55, .75, .35).normalize() },
    shadowLampPosition: { value: new THREE.Vector3(0, 4, 0) },
    shadowSunStrength: { value: 0 },
    shadowLampStrength: { value: 0 },
  }
  const attached = new WeakSet<THREE.Material>()
  let revision = 0
  return {
    uniforms,
    get revision() { return revision },
    update(feet: THREE.Vector3, sunlight: THREE.Vector3, lamp: THREE.Vector3, sunStrength: number, lampStrength: number) {
      const sun = Math.round(THREE.MathUtils.clamp(sunStrength, 0, .6) * 20) / 20
      const point = Math.round(THREE.MathUtils.clamp(lampStrength, 0, .6) * 20) / 20
      if (uniforms.shadowPlayerFeet.value.distanceToSquared(feet) > .00000001 || uniforms.shadowSunDirection.value.distanceToSquared(sunlight) > .000001 || uniforms.shadowLampPosition.value.distanceToSquared(lamp) > .000001 || uniforms.shadowSunStrength.value !== sun || uniforms.shadowLampStrength.value !== point) revision++
      uniforms.shadowPlayerFeet.value.copy(feet)
      uniforms.shadowSunDirection.value.copy(sunlight).normalize()
      uniforms.shadowLampPosition.value.copy(lamp)
      uniforms.shadowSunStrength.value = sun
      uniforms.shadowLampStrength.value = point
    },
    attach(material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial) {
      if (attached.has(material)) return
      attached.add(material)
      const previous = material.onBeforeCompile
      const key = material.customProgramCacheKey()
      material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer)
        Object.assign(shader.uniforms, uniforms)
        shader.vertexShader = `varying vec3 playerShadowWorld;\n${shader.vertexShader}`.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
          vec4 playerShadowPosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            playerShadowPosition = instanceMatrix * playerShadowPosition;
          #endif
          playerShadowWorld = (modelMatrix * playerShadowPosition).xyz;
        `)
        shader.fragmentShader = `varying vec3 playerShadowWorld;\n${playerShadowGLSL}\n${shader.fragmentShader}`.replace('#include <opaque_fragment>', `
          outgoingLight *= playerShadowVisibility(playerShadowWorld);
          #include <opaque_fragment>
        `)
      }
      material.customProgramCacheKey = () => `${key}|player-shadow`
      material.needsUpdate = true
    },
  }
}

export type PlayerShadow = ReturnType<typeof createPlayerShadow>