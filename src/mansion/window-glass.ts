import * as THREE from 'three'
import { createPlayerShadow, playerShadowGLSL } from './player-shadow'

export function createWindowGlass(shadow = createPlayerShadow()) {
  return new THREE.ShaderMaterial({
    name: 'clear-window-glass', transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: shadow.uniforms,
    vertexShader: `varying vec3 glassPosition; varying vec3 glassNormal;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        glassPosition = worldPosition.xyz;
        glassNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }`,
    fragmentShader: `${playerShadowGLSL}\nvarying vec3 glassPosition; varying vec3 glassNormal;
      void main() {
        vec3 viewDirection = normalize(cameraPosition - glassPosition);
        vec3 surfaceNormal = normalize(glassNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 reflection = reflect(-viewDirection, surfaceNormal);
        float fresnel = pow(1.0 - max(dot(viewDirection, surfaceNormal), 0.0), 5.0);
        float ribbon = exp(-pow((reflection.x + reflection.z * .65 - reflection.y * .3 - .2) * 16.0, 2.0));
        float glint = pow(max(dot(reflection, normalize(vec3(-.4, .7, .5))), 0.0), 96.0);
        float visibility = playerShadowVisibility(glassPosition);
        float shadow = 1.0 - visibility;
        float alpha = .014 + fresnel * .045 + (ribbon * .11 + glint * .2) * visibility * visibility * visibility + shadow * .05;
        vec3 tint = mix(vec3(.7, .86, .92), vec3(1.0, .97, .88), glint);
        gl_FragColor = vec4(mix(tint, vec3(.04, .06, .07), shadow), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
}