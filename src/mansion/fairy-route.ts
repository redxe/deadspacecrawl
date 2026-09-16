import * as THREE from 'three'
import { floorHeight } from './layout'

export const fairyMessages = ["Hi! I'm Fairy! It's nice to finally meet you", 'Violet has another present for you! Come with me!'] as const

export function fairyRoute(random: () => number) {
  const points = [new THREE.Vector3(.25, 2.1, -2)]
  for (let depth = -5; depth >= -47; depth -= 3) {
    points.push(new THREE.Vector3((random() - .5) * 2.7, floorHeight(depth) + 1.9 + random() * .8, depth))
  }
  points.push(new THREE.Vector3(-1, -.6, -51), new THREE.Vector3(2, -.1, -54), new THREE.Vector3(6, -.6, -51), new THREE.Vector3(8.8, -.9, -47))
  return new THREE.CatmullRomCurve3(points, false, 'centripetal')
}