import { useRef } from 'react'
import { usePoseLab } from '../../hooks/usePoseLab'
import { createReportSummary } from '../../features/highlights/reportSummary'
import type { PoseMetrics } from '../../types/pose'

const format = (value: number | null, unit = '°') => value == null ? '—' : `${Math.round(value)}${unit}`
const clock = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className={`metric ${accent ? 'metric--accent' : ''}`}><span>{label}</span><strong>{value}</strong></div>
}

function MetricGrid({ data }: { data: PoseMetrics }) {
  return <div className="metric-grid">
    <MetricCard label="姿态置信度" value={`${Math.round(data.confidence * 100)}%`} accent />
    <MetricCard label="分析帧率" value={`${data.fps} FPS`} />
    <MetricCard label="单帧延迟" value={`${Math.round(data.latencyMs)} ms`} />
    <MetricCard label="左肘角度" value={format(data.leftElbow)} />
    <MetricCard label="右肘角度" value={format(data.rightElbow)} />
    <MetricCard label="左膝角度" value={format(data.leftKnee)} />
    <MetricCard label="右膝角度" value={format(data.rightKnee)} />
    <MetricCard label="肩线倾角" value={format(data.shoulderTilt)} />
    <MetricCard label="髋线倾角" value={format(data.hipTilt)} />
  </div>
}

function CameraIcon() {
  return <svg viewBox="0 0 32 32" aria-hidden="true">
    <rect x="3.5" y="8.5" width="18" height="15" rx="3" />
    <path d="m21.5 13 7-3.5v13l-7-3.5z" />
    <circle cx="12.5" cy="16" r="4" />
  </svg>
}

function TennisBallIcon() {
  return <svg viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="12" />
    <path d="M8.3 6.8c5 3.2 7.1 7.1 6.2 11.7-.6 3.2-2.6 5.5-5.9 7M23.7 25.2c-5-3.2-7.1-7.1-6.2-11.7.6-3.2 2.6-5.5 5.9-7" />
  </svg>
}

function TennisReportBadge() {
  return <div className="report-badge" aria-label="Boom Tennis 可解释训练报告徽章">
    <TennisBallIcon />
    <span><strong>BOOM</strong><small>XAI REPORT</small></span>
  </div>
}

export function PoseLabPage() {
  const lab = usePoseLab()
  const reportSummary = lab.analysis ? createReportSummary(lab.analysis) : null
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasSource = lab.sourceMode !== null
  const isVideo = lab.sourceMode === 'video'

  return <main className="shell">
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark"><TennisBallIcon /></div>
        <div className="brand-copy"><span className="eyebrow">TENNIS MOTION LAB</span><div className="brand-title"><h1>Boom</h1><span>LOCAL AI</span></div><p>把每一次挥拍，变成看得懂的进步。</p></div>
      </div>
      <div className={`status status--${lab.status}`}><i />{lab.message}</div>
    </header>

    <section className="source-picker">
      <button className={lab.sourceMode === 'camera' ? 'source-tab source-tab--active' : 'source-tab'} onClick={lab.startCamera} disabled={lab.status === 'loading'}>
        <span>01</span><div className="source-label"><strong>实时摄像头</strong><small>现场测试姿态追踪</small></div><i className="source-icon"><CameraIcon /></i>
      </button>
      <button className={isVideo ? 'source-tab source-tab--active' : 'source-tab'} onClick={() => fileInputRef.current?.click()} disabled={lab.status === 'loading'}>
        <span>02</span><div className="source-label"><strong>本地视频</strong><small>上传录像并重复复查</small></div><i className="source-icon"><TennisBallIcon /></i>
      </button>
      <input ref={fileInputRef} className="file-input" type="file" accept="video/mp4,video/quicktime,video/webm,video/*" onChange={event => {
        const file = event.target.files?.[0]
        if (file) lab.loadVideo(file)
        event.target.value = ''
      }} />
    </section>

    <section className="workspace">
      <div className="stage-card">
        <div className="stage">
          <video ref={lab.videoRef} playsInline muted className={lab.sourceMode === 'camera' && lab.facingMode === 'user' ? 'mirrored' : ''} />
          <canvas ref={lab.canvasRef} className={`target-canvas ${lab.sourceMode === 'camera' && lab.facingMode === 'user' ? 'mirrored' : ''}`} onClick={event => {
            if (!hasSource || lab.isAnalyzing) return
            const rect = event.currentTarget.getBoundingClientRect()
            const rawX = (event.clientX - rect.left) / rect.width
            const x = lab.sourceMode === 'camera' && lab.facingMode === 'user' ? 1 - rawX : rawX
            const y = (event.clientY - rect.top) / rect.height
            lab.selectTarget(x, y)
          }} />
          {!hasSource && <div className="empty-state"><div className="court-visual" aria-hidden="true"><div className="court-surface"><i className="court-singles court-singles--left" /><i className="court-singles court-singles--right" /><i className="court-service court-service--left" /><i className="court-service court-service--right" /><i className="court-center" /><i className="court-net" /><span className="court-ball" /></div><div className="court-shadow" /></div><h2>选择分析来源</h2><p>打开摄像头实时分析，或选择手机里的训练视频进行复查。</p></div>}
          <div className="frame-corners" />
          {lab.status === 'running' && <div className="live-badge"><i /> {isVideo ? 'VIDEO ANALYSIS' : 'LIVE POSE'}</div>}
          {hasSource && <div className={`target-badge ${lab.hasLockedTarget ? 'target-badge--locked' : ''}`}>{lab.hasLockedTarget ? '已锁定球员' : '点击画面锁定球员'}</div>}
          {isVideo && lab.fileName && <div className="file-badge" title={lab.fileName}>{lab.fileName}</div>}
        </div>

        <div className="controls">
          {lab.sourceMode === 'camera'
            ? <button className="secondary" onClick={lab.flipCamera} disabled={lab.status === 'running'}>切换至{lab.facingMode === 'environment' ? '前置' : '后置'}</button>
            : <button className="secondary" onClick={() => fileInputRef.current?.click()} disabled={lab.isAnalyzing}>选择其他视频</button>}
          <button className="danger" onClick={lab.stop} disabled={!hasSource || lab.isAnalyzing}>关闭当前来源</button>
        </div>

        {isVideo && <div className="video-controls">
          <button className="play-button" onClick={lab.togglePlayback} disabled={lab.isAnalyzing}>{lab.isPlaying ? '暂停' : '播放'}</button>
          <span>{clock(lab.currentTime)}</span>
          <input aria-label="视频进度" type="range" min="0" max={lab.duration || 0} step="0.01" value={Math.min(lab.currentTime, lab.duration || 0)} disabled={lab.isAnalyzing} onChange={event => lab.seek(Number(event.target.value))} />
          <span>{clock(lab.duration)}</span>
        </div>}

        {isVideo && <div className="analysis-actions">
          <div className="analysis-copy">
            <strong>{lab.isAnalyzing ? `正在分析 ${Math.round(lab.analysisProgress * 100)}%` : lab.analysis ? `已识别 ${lab.analysis.events.length} 个动作` : '尚未分析动作'}</strong>
            <small>{lab.isAnalyzing ? '正在抽取姿态、计算手腕速度并保存关键帧' : '扫描整段视频，不需要按正常速度等待播放结束'}</small>
          </div>
          <div className="analysis-buttons">
            <button className="primary" onClick={lab.analyzeVideo} disabled={lab.isAnalyzing || !lab.duration}>{lab.isPlaying ? '暂停并开始分析' : lab.analysis ? '重新分析' : '开始分析'}</button>
            <button className="secondary export-image" onClick={() => lab.exportAnalysis('png')} disabled={!lab.analysis || lab.isAnalyzing}>保存图片</button>
            <button className="secondary export-pdf" onClick={() => lab.exportAnalysis('pdf')} disabled={!lab.analysis || lab.isAnalyzing}>保存 PDF</button>
          </div>
          <div className="progress-track"><i style={{ width: `${lab.analysisProgress * 100}%` }} /></div>
        </div>}
      </div>

      <aside className="panel">
        <div className="panel-heading"><div><span className="eyebrow">LIVE METRICS</span><h2>关键指标</h2></div><span className="sample-rate">实时</span></div>
        <MetricGrid data={lab.metrics} />
        <div className="guide">
          <h3>视频建议</h3>
          <ul><li>优先使用 H.264 编码的 MP4</li><li>人物全身保持在画面内</li><li>固定侧面机位，避免镜头移动</li><li>视频只在当前浏览器中处理</li></ul>
        </div>
        <p className="privacy">目前会在视频正常播放时分析每个可用画面。下一阶段将加入抽帧批量分析和挥拍事件时间线。</p>
      </aside>
    </section>

    {lab.analysis && <section className="results-section">
      <div className="results-heading">
        <div className="results-title"><TennisReportBadge /><div><span className="eyebrow">ACTION HIGHLIGHTS</span><h2>关键动作与建议</h2></div></div>
        <p>抽取 {lab.analysis.sampledFrames} 帧 · {lab.analysis.sampleRate} FPS · {lab.analysis.events.length} 个候选</p>
      </div>
      {reportSummary && <div className="overall-analysis">
        <div className="overall-score"><span>综合评分</span><strong>{reportSummary.score || '—'}</strong><small>/ 100</small></div>
        <div className="overall-content"><span className="eyebrow">OVERALL REVIEW</span><h3>总体分析与建议</h3><p className="overall-conclusion">{reportSummary.conclusion}</p><div className="overall-columns"><div><strong>表现亮点</strong><ul>{reportSummary.strengths.map(item => <li key={item}>{item}</li>)}</ul></div><div><strong>优先改进</strong><ul>{reportSummary.suggestions.map(item => <li key={item}>{item}</li>)}</ul></div></div></div>
      </div>}
      <div className="timeline-heading"><span>关键时间节点</span><small>按视频时间顺序逐帧解释</small></div>
      {lab.analysis.events.length === 0
        ? <div className="no-events"><strong>没有找到明显的手腕速度峰值</strong><p>建议确保挥拍手、肩部和髋部完整入镜，或使用固定机位重新拍摄。</p></div>
        : <div className="event-grid">{lab.analysis.events.map((event, index) => <article className="event-card" key={event.id}>
            <button className="event-image" onClick={() => lab.seek(event.time)} title="跳转到该动作">
              <img src={event.keyframe} alt={`挥拍关键帧 ${index + 1}`} />
              <span>{clock(event.time)}</span>
            </button>
            <div className="phase-strip">{event.phases.map(phase => <button key={`${event.id}-${phase.name}`} onClick={() => lab.seek(phase.time)} title={`跳转到${phase.name}`}>
              <img src={phase.keyframe} alt={phase.name} /><span>{phase.name}</span>
            </button>)}</div>
            <div className="event-body">
              <div className="event-meta"><span>{event.label}</span><strong>{event.score}</strong></div>
              <h3>{event.side === 'right' ? '右手' : '左手'}挥拍候选</h3>
              {event.strengths[0] && <p className="good">做得好：{event.strengths[0]}</p>}
              <p className="advice">建议：{event.suggestions[0] ?? '保持当前动作节奏并继续重复练习'}</p>
            </div>
          </article>)}</div>}
    </section>}
  </main>
}
