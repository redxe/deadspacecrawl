import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'

export function createFountainWater(renderer: THREE.WebGLRenderer) {
  const resolution = 64
  const compute = new GPUComputationRenderer(resolution, resolution, renderer)
  compute.setDataType(THREE.HalfFloatType)
  const initial = compute.createTexture()
  const water = compute.addVariable('waterState', `
    uniform float force; uniform float clock;
    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy;
      vec2 stepUV = 1.0 / resolution.xy;
      vec2 point = (uv - .5) * 5.1;
      vec4 state = texture2D(waterState,uv);
      float height = state.r;
      float laplacian = texture2D(waterState,uv + vec2(stepUV.x,0.0)).r
        + texture2D(waterState,uv - vec2(stepUV.x,0.0)).r
        + texture2D(waterState,uv + vec2(0.0,stepUV.y)).r
        + texture2D(waterState,uv - vec2(0.0,stepUV.y)).r - 4.0 * height;
      float impact = exp(-pow((length(point)-1.55)*15.0,2.0)) * sin(clock*11.0 + atan(point.y,point.x)*12.0);
      impact += exp(-dot(point,point)*12.0) * sin(clock*17.0) * .5;
      float velocity = (state.g + (laplacian * 226.77 + impact * (.8 + force * 2.0)) / 120.0) * .992;
      float boundary = 1.0 - smoothstep(2.3,2.43,length(point));
      gl_FragColor = vec4(clamp(height + velocity / 120.0,-.12,.12)*boundary,velocity*boundary,0.0,1.0);
    }`, initial)
  compute.setVariableDependencies(water, [water])
  water.material.uniforms.force = { value: 0 }
  water.material.uniforms.clock = { value: 0 }
  const uniforms = { waterMap: { value: initial as THREE.Texture }, energy: { value: 0 }, clock: { value: 0 } }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 5.1, resolution, resolution), new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false, uniforms,
    vertexShader: `uniform sampler2D waterMap; varying vec2 waterUV; varying vec3 waterNormal; varying vec3 waterView;
      void main() {
        waterUV = uv; vec2 stepUV = vec2(1.0/64.0);
        float height = texture2D(waterMap,uv).r;
        float slopeX = texture2D(waterMap,uv+vec2(stepUV.x,0.0)).r-texture2D(waterMap,uv-vec2(stepUV.x,0.0)).r;
        float slopeY = texture2D(waterMap,uv+vec2(0.0,stepUV.y)).r-texture2D(waterMap,uv-vec2(0.0,stepUV.y)).r;
        waterNormal = normalize(normalMatrix * vec3(-slopeX*14.0,-slopeY*14.0,1.0));
        vec4 view = modelViewMatrix * vec4(position.xy,height,1.0); waterView = -view.xyz;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `uniform float energy; uniform float clock; varying vec2 waterUV; varying vec3 waterNormal; varying vec3 waterView;
      void main() {
        float radius = length((waterUV-.5)*5.1); if(radius>2.43) discard;
        vec3 normal = normalize(waterNormal); vec3 eye = normalize(waterView);
        float fresnel = pow(1.0-abs(dot(normal,eye)),3.0);
        float glint = pow(max(0.0,dot(reflect(-normalize(vec3(.5,.8,1.0)),normal),eye)),36.0);
        float ripple = .5+.5*sin(radius*35.0 + normal.x*30.0 + normal.y*30.0-clock*2.0);
        vec3 color = mix(vec3(.12,.045,.26),vec3(.7,.5,.17),fresnel*.65);
        color += vec3(1.0,.85,.5) * (glint*(.7+energy)+pow(ripple,12.0)*.1);
        gl_FragColor = vec4(color,.86);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }))
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = .57; mesh.name = 'robin-fluid-surface'
  let initialized = false
  let failed = false
  let accumulator = 0
  let clock = 0
  return {
    mesh,
    update(delta: number, energy: number, motion: boolean) {
      if (!initialized && !failed) {
        try { failed = compute.init() !== null; initialized = !failed } catch { failed = true }
        mesh.userData.fluidBackend = failed ? 'static-fallback' : 'gpu-shallow-water'
      }
      uniforms.energy.value = energy
      if (!initialized || !motion) return
      accumulator += Math.min(.05, Math.max(0, delta))
      while (accumulator >= 1 / 120) {
        clock += 1 / 120; accumulator -= 1 / 120
        water.material.uniforms.clock!.value = clock
        water.material.uniforms.force!.value = energy
        compute.compute()
      }
      uniforms.waterMap.value = compute.getCurrentRenderTarget(water).texture
      uniforms.clock.value = clock
    },
    destroy() { compute.dispose(); mesh.geometry.dispose(); mesh.material.dispose(); mesh.removeFromParent() },
  }
}