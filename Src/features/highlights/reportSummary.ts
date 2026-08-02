import type { VideoAnalysis } from '../../types/analysis'

export type ReportSummary = {
  score: number
  conclusion: string
  strengths: string[]
  suggestions: string[]
}

export function createReportSummary(analysis: VideoAnalysis): ReportSummary {
  const events = analysis.events
  if (!events.length) {
    return {
      score: 0,
      conclusion: '本次视频暂未识别到足够清晰的完整动作，建议先优化拍摄条件后重新分析。',
      strengths: ['视频已在本地完成端侧扫描，原始画面不会上传云端。'],
      suggestions: ['固定机位并保证球员全身入镜，分析前点击画面锁定目标球员。'],
    }
  }

  const score = Math.round(events.reduce((sum, event) => sum + event.score, 0) / events.length)
  const strengths = [...new Set(events.flatMap(event => event.strengths).filter(Boolean))].slice(0, 2)
  const suggestions = [...new Set(events.flatMap(event => event.suggestions).filter(Boolean))].slice(0, 3)
  const level = score >= 85 ? '动作完成度较高，节奏和身体协同表现稳定' : score >= 70 ? '动作框架基本完整，但稳定性和发力衔接仍有提升空间' : '动作阶段已经能够识别，当前应优先建立稳定的准备姿势和挥拍路径'

  return {
    score,
    conclusion: `共识别 ${events.length} 个关键动作，综合评分 ${score} 分。${level}。`,
    strengths: strengths.length ? strengths : ['能够识别到较清晰的动作阶段与挥拍轨迹。'],
    suggestions: suggestions.length ? suggestions : ['保持当前节奏，通过多组重复练习提升动作稳定性。'],
  }
}
