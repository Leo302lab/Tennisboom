import { metricsFromPose } from '../../pose/geometry/poseGeometry'
import type { AnalyzedPoseFrame, StrokeEvent } from '../../../types/analysis'

const percentile = (values: number[], ratio: number) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]
}

export type StrokeCandidate = Omit<StrokeEvent, 'keyframe' | 'phases'> & { frameIndex: number }

export function detectStrokeCandidates(frames: AnalyzedPoseFrame[]): StrokeCandidate[] {
  const velocities = frames.flatMap(frame => [frame.leftWristSpeed, frame.rightWristSpeed]).filter(Number.isFinite)
  // Adaptive threshold makes distant players and slower practice swings detectable.
  const threshold = Math.max(0.45, percentile(velocities, 0.72) * 1.12)
  const raw: StrokeCandidate[] = []

  for (let i = 1; i < frames.length - 1; i += 1) {
    const frame = frames[i]
    if (frame.confidence < 0.48) continue
    const side = frame.rightWristSpeed >= frame.leftWristSpeed ? 'right' : 'left'
    const speed = Math.max(frame.rightWristSpeed, frame.leftWristSpeed)
    const previous = Math.max(frames[i - 1].rightWristSpeed, frames[i - 1].leftWristSpeed)
    const next = Math.max(frames[i + 1].rightWristSpeed, frames[i + 1].leftWristSpeed)
    if (speed < threshold || speed < previous || speed < next) continue

    const metrics = metricsFromPose({ timestamp: frame.time * 1000, landmarks: frame.landmarks }, 0, 0)
    const elbow = side === 'right' ? metrics.rightElbow : metrics.leftElbow
    const knees = [metrics.leftKnee, metrics.rightKnee].filter((value): value is number => value != null)
    const knee = knees.length ? Math.min(...knees) : 180
    const separation = metrics.shoulderTilt != null && metrics.hipTilt != null
      ? Math.abs(metrics.shoulderTilt - metrics.hipTilt)
      : 0

    let score = 55
    score += Math.min(16, speed * 3)
    score += knee < 165 ? 9 : 2
    score += elbow != null && elbow > 105 && elbow < 175 ? 9 : 3
    score += separation > 5 ? 7 : 2
    score += frame.confidence * 8
    score = Math.min(96, Math.round(score))

    const strengths: string[] = []
    const suggestions: string[] = []
    if (speed > threshold * 1.45) strengths.push('挥拍加速明显，动作具有清晰速度峰值')
    else suggestions.push('加速阶段略平缓，可尝试先转体再带动手臂')
    if (knee < 165) strengths.push('击球阶段有主动屈膝，重心较稳定')
    else suggestions.push('击球前增加屈膝，避免重心停留得过高')
    if (elbow != null && elbow > 105 && elbow < 175) strengths.push('击球臂展开程度处于合理区间')
    else suggestions.push('注意击球距离，避免肘部过度弯曲或锁死')
    if (separation > 5) strengths.push('肩髋存在分离，观察到躯干参与发力')
    else suggestions.push('引拍时增加肩部转动，减少单纯用手臂挥拍')

    raw.push({
      id: `stroke-${Math.round(frame.time * 1000)}`,
      frameIndex: i,
      time: frame.time,
      side,
      score,
      wristSpeed: speed,
      label: score >= 82 ? '优秀动作候选' : score >= 70 ? '有效挥拍' : '待改进动作',
      summary: `${side === 'right' ? '右手' : '左手'}挥拍速度峰值，动作评分 ${score} 分`,
      strengths,
      suggestions,
    })
  }

  // Also keep deliberate low-speed poses. A user may hold preparation or
  // loading positions without creating a wrist-speed peak.
  const postures: StrokeCandidate[] = []
  for (let i = 1; i < frames.length - 1; i += 1) {
    const frame = frames[i]
    if (frame.confidence < 0.58) continue
    const p = frame.landmarks
    const shoulderWidth = Math.max(0.04, Math.hypot(p[11].x - p[12].x, p[11].y - p[12].y))
    const leftReach = Math.hypot(p[15].x - p[11].x, p[15].y - p[11].y) / shoulderWidth
    const rightReach = Math.hypot(p[16].x - p[12].x, p[16].y - p[12].y) / shoulderWidth
    const side = rightReach >= leftReach ? 'right' : 'left'
    const reach = Math.max(leftReach, rightReach)
    const metrics = metricsFromPose({ timestamp: frame.time * 1000, landmarks: p }, 0, 0)
    const knees = [metrics.leftKnee, metrics.rightKnee].filter((value): value is number => value != null)
    const knee = knees.length ? Math.min(...knees) : 180
    const postureQuality = reach + Math.max(0, 170 - knee) / 35
    if (reach < 1.25 || knee > 172) continue

    const neighborQuality = (neighbor: AnalyzedPoseFrame) => {
      const np = neighbor.landmarks
      const width = Math.max(0.04, Math.hypot(np[11].x - np[12].x, np[11].y - np[12].y))
      return Math.max(
        Math.hypot(np[15].x - np[11].x, np[15].y - np[11].y) / width,
        Math.hypot(np[16].x - np[12].x, np[16].y - np[12].y) / width,
      )
    }
    if (postureQuality < neighborQuality(frames[i - 1]) || postureQuality < neighborQuality(frames[i + 1])) continue

    const score = Math.min(88, Math.round(58 + Math.min(14, reach * 5) + Math.max(0, 170 - knee) / 3))
    postures.push({
      id: `posture-${Math.round(frame.time * 1000)}`,
      frameIndex: i,
      time: frame.time,
      side,
      score,
      wristSpeed: Math.max(frame.leftWristSpeed, frame.rightWristSpeed),
      label: '关键姿势',
      summary: `${side === 'right' ? '右手' : '左手'}持拍侧出现明显伸展与屈膝姿势`,
      strengths: ['检测到稳定的身体姿态和持拍侧伸展'],
      suggestions: knee < 160 ? ['保持重心稳定，并衔接后续转体加速'] : ['可以进一步降低重心，为启动和击球预留空间'],
    })
  }

  // Suppress duplicate peaks and poses from the same action window.
  return [...raw, ...postures]
    .sort((a, b) => b.score - a.score)
    .filter((event, index, all) => all.slice(0, index).every(kept => Math.abs(kept.time - event.time) >= 0.9))
    .slice(0, 12)
    .sort((a, b) => a.time - b.time)
}
