export interface Position { x: number; z: number }
export const mansionSeed = 'robin-gallery-2026'
export const ballroomCenter: Position = { x: 0, z: -56 }
export const hallLampDepths = [-4.35, -13.75, -23.15, -32.55]
export const ballroomLampDepths = [-53, -59]
export const ballroomPillarDepths = [-47, -53, -59, -64.5]

export function floorHeight(z: number): number {
  return -3 * Math.max(0, Math.min(1, (-z - 36) / 9)) || 0
}

export function walkable(position: Position): boolean {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return false
  if (position.z > 2.5 || position.z < -64.5) return false
  return Math.abs(position.x) <= (position.z > -45.5 ? 2.45 : 9.45)
}

export function movePosition(position: Position, horizontal: number, depth: number): Position {
  const next = { ...position }
  if (!Number.isFinite(horizontal) || !Number.isFinite(depth)) return next
  const steps = Math.max(1, Math.ceil(Math.hypot(horizontal, depth) / 0.15))
  for (let index = 0; index < Math.min(steps, 100); index++) {
    const x = next.x + horizontal / steps
    if (walkable({ x, z: next.z })) next.x = x
    const z = next.z + depth / steps
    if (walkable({ x: next.x, z })) next.z = z
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
}

export const pictureFrames: PictureFrame[] = [
  ...Array.from({ length: 7 }, (_, index) => ({ id: `gallery-${index + 1}`, x: 2.88, y: 2.25, z: -2 - index * 4.7, rotation: -Math.PI / 2, width: 1.55, height: 1.95 })),
  ...[-6, -2, 2, 6].map((x, index) => ({ id: `ballroom-north-${index + 1}`, x, y: -0.2, z: -64.85, rotation: 0, width: 2.1, height: 2.6 })),
  ...[-50, -56, -62].flatMap((z, index) => [
    { id: `ballroom-east-${index + 1}`, x: 9.88, y: -0.2, z, rotation: -Math.PI / 2, width: 1.85, height: 2.3 },
    { id: `ballroom-west-${index + 1}`, x: -9.88, y: -0.2, z, rotation: Math.PI / 2, width: 1.85, height: 2.3 },
  ]),
]