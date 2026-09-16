export const ballroomWait = 194
export const returnHold = 3.14
export const nightFade = 12
export const returnOrigin = { x: 0, z: 1.3 }
export const returnRadius = .7

export function createRobinSequence() {
  let ballroomTime = 0
  let nightTime = 0
  let chargeTime = 0
  let pulseTime = 0
  let awakened = false
  let unlocked = false
  return {
    update(delta: number, position: { x: number; z: number }, active = true) {
      const elapsed = active && Number.isFinite(delta) && delta > 0 ? delta : 0
      if (!awakened) {
        ballroomTime = position.z < -45.5 && Math.abs(position.x) <= 9.45 ? ballroomTime + elapsed : 0
        if (ballroomTime >= ballroomWait) awakened = true
      } else {
        const previousNightTime = nightTime
        nightTime += elapsed
        if (unlocked) pulseTime += elapsed
        else if (nightTime >= nightFade) {
          const inside = Math.hypot(position.x - returnOrigin.x, position.z - returnOrigin.z) <= returnRadius
          const chargingElapsed = Math.max(0, nightTime - Math.max(previousNightTime, nightFade))
          chargeTime = inside ? Math.min(returnHold, chargeTime + chargingElapsed) : 0
          if (chargeTime >= returnHold) unlocked = true
        }
      }
      return {
        ballroomTime, nightTime, awakened, unlocked,
        night: Math.min(1, nightTime / nightFade),
        charge: chargeTime / returnHold,
        pulse: unlocked ? Math.min(1, pulseTime / 5) : -1,
        phase: !awakened ? 'waiting' : nightTime < nightFade ? 'fading' : unlocked ? pulseTime < 5 ? 'pulse' : 'complete' : chargeTime > 0 ? 'charging' : 'return',
      }
    },
  }
}

export type RobinFrame = ReturnType<ReturnType<typeof createRobinSequence>['update']>