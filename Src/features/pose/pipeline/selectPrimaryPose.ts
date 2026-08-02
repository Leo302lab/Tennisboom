import type { Landmark } from '../../../types/pose'

export type TrackingPoint = { x: number; y: number }

export function poseCenter(pose: Landmark[]): TrackingPoint {
  const indices = [11, 12, 23, 24]
  const points = indices.map(index => pose[index]).filter(Boolean)
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  }
}

export function selectPrimaryPose(poses: Landmark[][], target: TrackingPoint | null) {
  if (!poses.length) return null
  return poses.map(pose => {
    const visible = pose.filter(point => (point.visibility ?? 1) >= 0.45)
    const center = poseCenter(pose)
    const xs = visible.map(point => point.x)
    const ys = visible.map(point => point.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const completeness = visible.length / Math.max(1, pose.length)
    const edgePenalty = minX < 0.015 || maxX > 0.985 || minY < 0.01 || maxY > 0.995 ? 1.3 : 0
    const anchor = target ?? { x: 0.5, y: 0.55 }
    const distance = Math.hypot(center.x - anchor.x, center.y - anchor.y)
    const bodyHeight = Math.max(0, maxY - minY)
    const score = completeness * 2.2 + Math.min(bodyHeight, 0.8) - distance * (target ? 5.5 : 2.8) - edgePenalty
    return { pose, center, score }
  }).sort((a, b) => b.score - a.score)[0]
}
