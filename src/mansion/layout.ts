export interface Position { x: number; z: number }
export const mansionSeed = 'robin-gallery-2026'
export const ballroomCenter: Position = { x: 0, z: -56 }
export const fountainClearance = 3.35
export const hallLampDepths = [-4.35, -13.75, -23.15, -32.55]
export const ballroomLampDepths = [-53, -59]
export const ballroomPillarDepths = [-47, -53, -59, -64.5]

export function floorHeight(z: number): number {
  return -3 * Math.max(0, Math.min(1, (-z - 36) / 9)) || 0
}

export function walkable(position: Position, fountain = false): boolean {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return false
  if (position.z > 2.5 || position.z < -64.5) return false
  if (fountain && Math.hypot(position.x - ballroomCenter.x, position.z - ballroomCenter.z) < fountainClearance) return false
  return Math.abs(position.x) <= (position.z > -45.5 ? 2.45 : 9.45)
}

export function movePosition(position: Position, horizontal: number, depth: number, fountain = false): Position {
  const next = { ...position }
  if (fountain) {
    const offset = { x: next.x - ballroomCenter.x, z: next.z - ballroomCenter.z }
    const radius = Math.hypot(offset.x, offset.z)
    if (radius < fountainClearance) {
      next.x = ballroomCenter.x + (radius ? offset.x / radius : 0) * (fountainClearance + .001)
      next.z = ballroomCenter.z + (radius ? offset.z / radius : 1) * (fountainClearance + .001)
    }
  }
  if (!Number.isFinite(horizontal) || !Number.isFinite(depth)) return next
  const steps = Math.max(1, Math.ceil(Math.hypot(horizontal, depth) / 0.15))
  for (let index = 0; index < Math.min(steps, 100); index++) {
    const x = next.x + horizontal / steps
    if (walkable({ x, z: next.z }, fountain)) next.x = x
    const z = next.z + depth / steps
    if (walkable({ x: next.x, z }, fountain)) next.z = z
  }
  return next
}

export function spatialMusic(position: Position, yaw: number): { gain: number; pan: number } {
  const horizontal = ballroomCenter.x - position.x
  const depth = ballroomCenter.z - position.z
  const distance = Math.hypot(horizontal, depth)
  return {
    gain: 0.045 + 0.655 / (1 + (distance / 11) ** 2),
    pan: distance < 0.05 ? 0 : Math.max(-1, Math.min(1, (horizontal * Math.cos(yaw) - depth * Math.sin(yaw)) / distance)),
  }
}

export interface PictureFrame {
  id: string
  x: number
  y: number
  z: number
  rotation: number
  width: number
  height: number
  finish?: 'brass' | 'silver' | 'dark'
  mat?: 'light' | 'dark'
}

export const pictureFrames: PictureFrame[] = [
  { id: 'gallery-1', x: 2.88, y: 2.4, z: -2, rotation: -Math.PI / 2, width: 1.48, height: 1.98, finish: 'brass' },
  { id: 'gallery-2', x: 2.88, y: 2.45, z: -6.7, rotation: -Math.PI / 2, width: 2.35, height: 1.26, finish: 'dark' },
  { id: 'gallery-3', x: 2.88, y: 2.4, z: -11.4, rotation: -Math.PI / 2, width: 1.48, height: 1.98, finish: 'silver' },
  { id: 'gallery-4', x: 2.88, y: 2.45, z: -16.1, rotation: -Math.PI / 2, width: 1.5, height: 2, finish: 'brass' },
  { id: 'gallery-5', x: 2.88, y: 2.35, z: -20.8, rotation: -Math.PI / 2, width: 1.38, height: 1.84, finish: 'dark' },
  { id: 'gallery-6', x: 2.88, y: 2.4, z: -25.5, rotation: -Math.PI / 2, width: 1.45, height: 1.94, finish: 'silver' },
  { id: 'gallery-7', x: 2.88, y: 2.4, z: -30.2, rotation: -Math.PI / 2, width: 2.05, height: 1.45, finish: 'brass' },
  { id: 'ballroom-north-1', x: -6.2, y: .15, z: -64.85, rotation: 0, width: 3.15, height: 1.78, finish: 'dark', mat: 'dark' },
  { id: 'ballroom-north-2', x: -2.25, y: .3, z: -64.85, rotation: 0, width: 1.98, height: 2.8, finish: 'brass', mat: 'dark' },
  { id: 'ballroom-north-3', x: 2.25, y: .3, z: -64.85, rotation: 0, width: 1.64, height: 2.9, finish: 'silver', mat: 'dark' },
  { id: 'ballroom-north-4', x: 6.2, y: .15, z: -64.85, rotation: 0, width: 2.65, height: 1.98, finish: 'brass' },
  { id: 'ballroom-east-1', x: 9.88, y: .15, z: -50, rotation: -Math.PI / 2, width: 2.35, height: 2.2, finish: 'silver', mat: 'dark' },
  { id: 'ballroom-east-2', x: 9.88, y: .15, z: -56, rotation: -Math.PI / 2, width: 2.05, height: 2.65, finish: 'dark', mat: 'dark' },
  { id: 'ballroom-east-3', x: 9.88, y: .2, z: -62, rotation: -Math.PI / 2, width: 1.85, height: 2.61, finish: 'brass', mat: 'dark' },
  { id: 'ballroom-west-1', x: -9.88, y: .1, z: -50, rotation: Math.PI / 2, width: 3.05, height: 1.72, finish: 'silver', mat: 'dark' },
  { id: 'ballroom-west-2', x: -9.88, y: .15, z: -56, rotation: Math.PI / 2, width: 1.35, height: 2.45, finish: 'brass' },
  { id: 'ballroom-west-3', x: -9.88, y: .3, z: -62, rotation: Math.PI / 2, width: 3.3, height: .9, finish: 'dark', mat: 'dark' },
]