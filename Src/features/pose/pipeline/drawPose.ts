import type { Landmark } from '../../../types/pose'

const connections = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28], [27, 29], [29, 31], [28, 30], [30, 32],
]

export function drawPose(ctx: CanvasRenderingContext2D, landmarks: Landmark[], width: number, height: number) {
  ctx.clearRect(0, 0, width, height)
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#c9ff48'

  for (const [from, to] of connections) {
    const a = landmarks[from]
    const b = landmarks[to]
    if (!a || !b || (a.visibility ?? 1) < 0.45 || (b.visibility ?? 1) < 0.45) continue
    ctx.beginPath()
    ctx.moveTo(a.x * width, a.y * height)
    ctx.lineTo(b.x * width, b.y * height)
    ctx.stroke()
  }

  ctx.fillStyle = '#f5fff0'
  landmarks.forEach((point, index) => {
    if (index < 11 || (point.visibility ?? 1) < 0.45) return
    ctx.beginPath()
    ctx.arc(point.x * width, point.y * height, 4, 0, Math.PI * 2)
    ctx.fill()
  })
}
