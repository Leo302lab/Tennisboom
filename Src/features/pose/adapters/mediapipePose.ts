import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision'

const wasmRoot = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task'

export async function createPoseLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(wasmRoot)
  const sharedOptions = {
    runningMode: 'VIDEO',
    numPoses: 4,
    minPoseDetectionConfidence: 0.55,
    minTrackingConfidence: 0.55,
  } as const

  try {
    return await PoseLandmarker.createFromOptions(vision, {
      ...sharedOptions,
      baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
    })
  } catch (gpuError) {
    console.warn('GPU pose inference unavailable; falling back to CPU.', gpuError)
    return PoseLandmarker.createFromOptions(vision, {
      ...sharedOptions,
      baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' },
    })
  }
}

export type { PoseLandmarker, PoseLandmarkerResult }
