import { useCallback, useEffect, useRef, useState } from 'react'
import { createPoseLandmarker, type PoseLandmarker } from '../features/pose/adapters/mediapipePose'
import { drawPose } from '../features/pose/pipeline/drawPose'
import { selectPrimaryPose, type TrackingPoint } from '../features/pose/pipeline/selectPrimaryPose'
import { metricsFromPose } from '../features/pose/geometry/poseGeometry'
import { detectStrokeCandidates } from '../features/stroke-detection/rules/detectStrokeEvents'
import { exportAnalysisReport, type ExportFormat } from '../features/highlights/export/exportAnalysis'
import type { PoseFrame, PoseMetrics } from '../types/pose'
import type { AnalyzedPoseFrame, VideoAnalysis } from '../types/analysis'

const emptyMetrics = metricsFromPose(null, 0, 0)
type LabStatus = 'idle' | 'loading' | 'ready' | 'running' | 'error'
type SourceMode = 'camera' | 'video' | null

function waitForValidVideoFrame(video: HTMLVideoElement, timeoutMs = 15000) {
  return new Promise<void>((resolve, reject) => {
    let timer = 0
    let pollTimer = 0
    let settled = false

    const hasFrame = () => video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      && video.videoWidth > 0
      && video.videoHeight > 0
      && Number.isFinite(video.duration)

    const cleanup = () => {
      window.clearTimeout(timer)
      window.clearTimeout(pollTimer)
      video.removeEventListener('loadedmetadata', check)
      video.removeEventListener('loadeddata', check)
      video.removeEventListener('canplay', check)
      video.removeEventListener('resize', check)
      video.removeEventListener('error', onError)
    }
    const finish = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }
    const check = () => {
      if (settled) return
      if (hasFrame()) {
        finish()
        return
      }
      // Mobile browsers can expose metadata several seconds before the first
      // decoded frame, especially for 4K, portrait and rotated recordings.
      pollTimer = window.setTimeout(check, 80)
    }
    const onError = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('浏览器无法解码该视频编码，请尝试 MP4/H.264 或 WebM'))
    }

    video.addEventListener('loadedmetadata', check)
    video.addEventListener('loadeddata', check)
    video.addEventListener('canplay', check)
    video.addEventListener('resize', check)
    video.addEventListener('error', onError)
    timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('等待视频首帧超时，请确认浏览器支持该视频编码'))
    }, timeoutMs)
    check()
  })
}

function seekAndWaitForFrame(video: HTMLVideoElement, time: number, timeoutMs = 15000) {
  return new Promise<void>((resolve, reject) => {
    let settled = false
    let pollTimer = 0
    let timeoutTimer = 0
    const tolerance = 0.12

    const cleanup = () => {
      window.clearTimeout(pollTimer)
      window.clearTimeout(timeoutTimer)
      video.removeEventListener('seeked', check)
      video.removeEventListener('canplay', check)
      video.removeEventListener('timeupdate', check)
      video.removeEventListener('error', onError)
    }
    const finish = () => {
      if (settled) return
      settled = true
      cleanup()
      const requestFrame = video.requestVideoFrameCallback?.bind(video)
      if (requestFrame) {
        let delivered = false
        const deliver = () => {
          if (delivered) return
          delivered = true
          resolve()
        }
        requestFrame(deliver)
        window.setTimeout(deliver, 250)
      } else window.setTimeout(resolve, 0)
    }
    const check = () => {
      if (settled) return
      const atTarget = Math.abs(video.currentTime - time) <= tolerance
      const hasFrame = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        && video.videoWidth > 0 && video.videoHeight > 0
      if (!video.seeking && atTarget && hasFrame) {
        finish()
        return
      }
      pollTimer = window.setTimeout(check, 50)
    }
    const onError = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('视频解码器无法读取该位置'))
    }

    video.addEventListener('seeked', check)
    video.addEventListener('canplay', check)
    video.addEventListener('timeupdate', check)
    video.addEventListener('error', onError)
    timeoutTimer = window.setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(`无法读取 ${time.toFixed(1)} 秒处的视频帧`))
    }, timeoutMs)

    if (Math.abs(video.currentTime - time) > 0.002) video.currentTime = time
    check()
  })
}

export function usePoseLab() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modelRef = useRef<PoseLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastVideoTimeRef = useRef(-1)
  const sampleRef = useRef<number[]>([])
  const frameErrorsRef = useRef(0)
  const targetPointRef = useRef<TrackingPoint | null>(null)
  const [status, setStatus] = useState<LabStatus>('idle')
  const [sourceMode, setSourceMode] = useState<SourceMode>(null)
  const [message, setMessage] = useState('请选择摄像头或本地视频')
  const [metrics, setMetrics] = useState<PoseMetrics>(emptyMetrics)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [fileName, setFileName] = useState('')
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null)
  const [hasLockedTarget, setHasLockedTarget] = useState(false)

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    lastVideoTimeRef.current = -1
    sampleRef.current = []
    frameErrorsRef.current = 0
  }, [])

  const runLoop = useCallback(() => {
    stopLoop()
    const loop = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || !modelRef.current) return

      const hasValidFrame = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        && video.videoWidth > 0
        && video.videoHeight > 0
        && Number.isFinite(video.currentTime)
        && !video.seeking

      setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0)
      if (hasValidFrame && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        try {
          const started = performance.now()
          const result = modelRef.current.detectForVideo(video, started)
          const latency = performance.now() - started
          const now = performance.now()
          frameErrorsRef.current = 0
          sampleRef.current = [...sampleRef.current.filter(t => now - t < 1000), now]
          const selected = selectPrimaryPose(result.landmarks, targetPointRef.current)
          if (selected) targetPointRef.current = selected.center
          const frame: PoseFrame | null = selected
            ? { timestamp: now, landmarks: selected.pose }
            : null
          const ctx = canvas.getContext('2d')
          if (ctx) drawPose(ctx, frame?.landmarks ?? [], canvas.width, canvas.height)
          setMetrics(metricsFromPose(frame, sampleRef.current.length, latency))
        } catch (error) {
          frameErrorsRef.current += 1
          console.warn('Pose frame skipped:', error)
          if (frameErrorsRef.current >= 3) {
            setStatus('error')
            setMessage('连续视频帧无法分析，请重新选择视频或转换为 H.264 MP4')
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    loop()
  }, [stopLoop])

  const releaseCurrentSource = useCallback(() => {
    stopLoop()
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
    const video = videoRef.current
    if (video) {
      video.pause()
      video.srcObject = null
      video.removeAttribute('src')
      video.load()
    }
  }, [stopLoop])

  const ensureModel = useCallback(async () => {
    if (!modelRef.current) modelRef.current = await createPoseLandmarker()
  }, [])

  const startCamera = useCallback(async () => {
    try {
      releaseCurrentSource()
      setStatus('loading')
      setSourceMode('camera')
      setFileName('')
      setMessage('正在加载轻量姿态模型…')
      await ensureModel()
      setMessage('正在请求摄像头权限…')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      if (!video.videoWidth || !video.videoHeight) throw new Error('摄像头尚未产生有效画面')
      setStatus('running')
      setIsPlaying(true)
      setMessage('摄像头姿态追踪中')
      runLoop()
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '启动失败，请检查摄像头权限和网络')
    }
  }, [ensureModel, facingMode, releaseCurrentSource, runLoop])

  const loadVideo = useCallback(async (file: File) => {
    try {
      if (!file.type.startsWith('video/')) throw new Error('请选择有效的视频文件')
      releaseCurrentSource()
      setStatus('loading')
      setSourceMode('video')
      setFileName(file.name)
      setAnalysis(null)
      setAnalysisProgress(0)
      targetPointRef.current = null
      setHasLockedTarget(false)
      setMessage('正在加载模型和视频…')
      await ensureModel()
      const video = videoRef.current
      if (!video) return
      if (file.type && video.canPlayType(file.type) === '') {
        throw new Error(`当前浏览器不支持 ${file.type} 视频，请换用本机可播放的 MP4、MOV 或 WebM`)
      }

      const url = URL.createObjectURL(file)
      objectUrlRef.current = url
      video.preload = 'auto'
      video.src = url
      video.muted = true
      video.load()
      await waitForValidVideoFrame(video)

      setDuration(Number.isFinite(video.duration) ? video.duration : 0)
      setCurrentTime(0)
      setIsPlaying(false)
      setStatus('ready')
      setMessage('视频已就绪，点击播放开始分析')
      runLoop()
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '视频加载失败')
    }
  }, [ensureModel, releaseCurrentSource, runLoop])

  const togglePlayback = useCallback(async () => {
    const video = videoRef.current
    if (!video || sourceMode !== 'video') return
    if (video.paused) {
      if (video.ended) video.currentTime = 0
      await video.play()
      setIsPlaying(true)
      setStatus('running')
      setMessage('正在分析本地视频')
    } else {
      video.pause()
      setIsPlaying(false)
      setStatus('ready')
      setMessage('分析已暂停')
    }
  }, [sourceMode])

  const seek = useCallback((time: number) => {
    const video = videoRef.current
    if (!video || sourceMode !== 'video') return
    video.currentTime = time
    setCurrentTime(time)
  }, [sourceMode])

  const selectTarget = useCallback((x: number, y: number) => {
    targetPointRef.current = { x, y }
    setHasLockedTarget(true)
    setMessage('已锁定所选球员，播放和分析都会跟随该主体')
    lastVideoTimeRef.current = -1
  }, [])

  const analyzeVideo = useCallback(async () => {
    const previewVideo = videoRef.current
    const model = modelRef.current
    const sourceUrl = objectUrlRef.current
    if (!previewVideo || !model || !sourceUrl || sourceMode !== 'video' || !previewVideo.duration) return

    // Batch analysis uses its own decoder so it never competes with the visible
    // player's playhead, controls or canvas loop.
    const analysisVideo = document.createElement('video')
    analysisVideo.muted = true
    analysisVideo.playsInline = true
    analysisVideo.preload = 'auto'
    analysisVideo.src = sourceUrl

    const capture = (landmarks: AnalyzedPoseFrame['landmarks']) => {
      const maxWidth = 720
      const scale = Math.min(1, maxWidth / analysisVideo.videoWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(analysisVideo.videoWidth * scale)
      canvas.height = Math.round(analysisVideo.videoHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return ''
      ctx.drawImage(analysisVideo, 0, 0, canvas.width, canvas.height)
      drawPose(ctx, landmarks, canvas.width, canvas.height)
      return canvas.toDataURL('image/jpeg', 0.84)
    }

    try {
      stopLoop()
      previewVideo.pause()
      setIsPlaying(false)
      setIsAnalyzing(true)
      setAnalysis(null)
      setAnalysisProgress(0)
      setStatus('running')
      setMessage('正在扫描整段视频并寻找挥拍…')
      analysisVideo.load()
      await waitForValidVideoFrame(analysisVideo, 20000)

      const analysisDuration = analysisVideo.duration
      const sampleRate = analysisDuration > 120 ? 4 : 8
      const total = Math.max(1, Math.floor(analysisDuration * sampleRate))
      const frames: AnalyzedPoseFrame[] = []
      let previous: AnalyzedPoseFrame | null = null
      let analysisTarget = targetPointRef.current

      for (let index = 0; index < total; index += 1) {
        const time = Math.min(analysisDuration - 0.001, index / sampleRate)
        await seekAndWaitForFrame(analysisVideo, time)
        const result = model.detectForVideo(analysisVideo, performance.now())
        const selected = selectPrimaryPose(result.landmarks, analysisTarget)
        if (selected) analysisTarget = selected.center
        const landmarks = selected?.pose
        if (landmarks) {
          const confidence = landmarks.reduce((sum, point) => sum + (point.visibility ?? 1), 0) / landmarks.length
          const shoulderWidth = Math.max(0.04, Math.hypot(landmarks[11].x - landmarks[12].x, landmarks[11].y - landmarks[12].y))
          const dt = previous ? Math.max(0.001, time - previous.time) : 1 / sampleRate
          const speed = (wristIndex: 15 | 16) => previous
            ? Math.hypot(landmarks[wristIndex].x - previous.landmarks[wristIndex].x, landmarks[wristIndex].y - previous.landmarks[wristIndex].y) / shoulderWidth / dt
            : 0
          const frame: AnalyzedPoseFrame = {
            time,
            landmarks,
            confidence,
            leftWristSpeed: speed(15),
            rightWristSpeed: speed(16),
          }
          frames.push(frame)
          previous = frame
        }
        setAnalysisProgress((index + 1) / total * 0.85)
        if (index % 8 === 0) await new Promise(resolve => window.setTimeout(resolve, 0))
      }

      const candidates = detectStrokeCandidates(frames)
      const events = []
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index]
        const frame = frames[candidate.frameIndex]
        await seekAndWaitForFrame(analysisVideo, candidate.time)
        const keyframe = capture(frame.landmarks)
        const phaseSpecs = [
          { name: '准备', offset: -0.65 },
          { name: '引拍', offset: -0.3 },
          { name: '击球', offset: 0 },
          { name: '随挥', offset: 0.45 },
        ]
        const phases = []
        for (const phase of phaseSpecs) {
          const phaseTime = Math.max(0, Math.min(analysisDuration - 0.001, candidate.time + phase.offset))
          const phaseFrame = frames.reduce((nearest, item) => Math.abs(item.time - phaseTime) < Math.abs(nearest.time - phaseTime) ? item : nearest, frame)
          await seekAndWaitForFrame(analysisVideo, phaseTime)
          phases.push({ name: phase.name, time: phaseTime, keyframe: capture(phaseFrame.landmarks) })
        }
        events.push({ ...candidate, keyframe, phases })
        setAnalysisProgress(0.85 + ((index + 1) / Math.max(1, candidates.length)) * 0.15)
      }

      const result: VideoAnalysis = {
        fileName,
        analyzedAt: new Date().toISOString(),
        duration: analysisDuration,
        sampledFrames: frames.length,
        sampleRate,
        events,
      }
      setAnalysis(result)
      setAnalysisProgress(1)
      setStatus('ready')
      setMessage(events.length ? `分析完成，识别到 ${events.length} 个挥拍候选` : '分析完成，未找到明确挥拍')
      runLoop()
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '视频分析失败')
      runLoop()
    } finally {
      analysisVideo.pause()
      analysisVideo.removeAttribute('src')
      analysisVideo.load()
      setIsAnalyzing(false)
    }
  }, [fileName, runLoop, sourceMode, stopLoop])

  const exportAnalysis = useCallback(async (format: ExportFormat) => {
    if (!analysis) return
    try {
      setMessage(`正在生成 ${format.toUpperCase()} 训练报告…`)
      await exportAnalysisReport(analysis, format)
      setMessage(`${format.toUpperCase()} 训练报告已生成`)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '报告导出失败')
    }
  }, [analysis])

  const stop = useCallback(() => {
    releaseCurrentSource()
    setSourceMode(null)
    setStatus('idle')
    setIsPlaying(false)
    setFileName('')
    setDuration(0)
    setCurrentTime(0)
    setMetrics(emptyMetrics)
    setAnalysis(null)
    setAnalysisProgress(0)
    setIsAnalyzing(false)
    targetPointRef.current = null
    setHasLockedTarget(false)
    setMessage('请选择摄像头或本地视频')
  }, [releaseCurrentSource])

  const flipCamera = useCallback(() => {
    setFacingMode(value => value === 'user' ? 'environment' : 'user')
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onEnded = () => {
      setIsPlaying(false)
      setStatus('ready')
      setMessage('视频分析播放完成，可拖动进度复查')
    }
    video.addEventListener('ended', onEnded)
    return () => video.removeEventListener('ended', onEnded)
  }, [])

  useEffect(() => () => {
    stopLoop()
    streamRef.current?.getTracks().forEach(track => track.stop())
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    modelRef.current?.close()
  }, [stopLoop])

  return {
    videoRef, canvasRef, status, sourceMode, message, metrics, facingMode,
    fileName, duration, currentTime, isPlaying,
    isAnalyzing, analysisProgress, analysis, hasLockedTarget,
    startCamera, loadVideo, togglePlayback, seek, selectTarget, analyzeVideo, exportAnalysis, stop, flipCamera,
  }
}
