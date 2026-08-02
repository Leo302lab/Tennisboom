export type Landmark = {
  x: number
  y: number
  z: number
  visibility?: number
}

export type PoseFrame = {
  timestamp: number
  landmarks: Landmark[]
}

export type PoseMetrics = {
  fps: number
  latencyMs: number
  confidence: number
  leftElbow: number | null
  rightElbow: number | null
  leftKnee: number | null
  rightKnee: number | null
  shoulderTilt: number | null
  hipTilt: number | null
}
