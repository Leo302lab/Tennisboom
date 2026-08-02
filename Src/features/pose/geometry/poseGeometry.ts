import type { Landmark, PoseFrame, PoseMetrics } from '../../../types/pose'

const angle = (a: Landmark, b: Landmark, c: Landmark) => {
  const ab = Math.atan2(a.y - b.y, a.x - b.x)
  const cb = Math.atan2(c.y - b.y, c.x - b.x)
  let degrees = Math.abs((ab - cb) * 180 / Math.PI)
  if (degrees > 180) degrees = 360 - degrees
  return degrees
}

const tilt = (a: Landmark, b: Landmark) =>
  Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI

export function metricsFromPose(frame: PoseFrame | null, fps: number, latencyMs: number): PoseMetrics {
  const p = frame?.landmarks
  if (!p || p.length < 33) {
    return { fps, latencyMs, confidence: 0, leftElbow: null, rightElbow: null, leftKnee: null, rightKnee: null, shoulderTilt: null, hipTilt: null }
  }

  const confidence = p.reduce((sum, item) => sum + (item.visibility ?? 1), 0) / p.length
  return {
    fps,
    latencyMs,
    confidence,
    leftElbow: angle(p[11], p[13], p[15]),
    rightElbow: angle(p[12], p[14], p[16]),
    leftKnee: angle(p[23], p[25], p[27]),
    rightKnee: angle(p[24], p[26], p[28]),
    shoulderTilt: tilt(p[11], p[12]),
    hipTilt: tilt(p[23], p[24]),
  }
}
