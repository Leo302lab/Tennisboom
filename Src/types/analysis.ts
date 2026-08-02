import type { Landmark } from './pose'

export type AnalyzedPoseFrame = {
  time: number
  landmarks: Landmark[]
  confidence: number
  leftWristSpeed: number
  rightWristSpeed: number
}

export type StrokeEvent = {
  id: string
  time: number
  side: 'left' | 'right'
  score: number
  wristSpeed: number
  keyframe: string
  phases: Array<{ name: string; time: number; keyframe: string }>
  label: string
  summary: string
  strengths: string[]
  suggestions: string[]
}

export type VideoAnalysis = {
  fileName: string
  analyzedAt: string
  duration: number
  sampledFrames: number
  sampleRate: number
  events: StrokeEvent[]
}
