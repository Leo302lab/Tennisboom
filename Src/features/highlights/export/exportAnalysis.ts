import type { VideoAnalysis } from '../../../types/analysis'
import { createReportSummary } from '../reportSummary'

export type ExportFormat = 'html' | 'png' | 'pdf'

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!)

function triggerDownload(url: string, fileName: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function drawTennisBadge(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = '#c9ff48'
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#102017'
  ctx.lineWidth = Math.max(3, radius * 0.08)
  ctx.beginPath()
  ctx.arc(-radius * 0.72, 0, radius * 0.92, -Math.PI * 0.52, Math.PI * 0.52)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(radius * 0.72, 0, radius * 0.92, Math.PI * 0.48, Math.PI * 1.52)
  ctx.stroke()
  ctx.restore()
}

function drawBadgePill(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, label: string) {
  ctx.fillStyle = '#13221a'
  ctx.strokeStyle = '#35513f'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(x, y, width, 54, 27)
  ctx.fill()
  ctx.stroke()
  drawTennisBadge(ctx, x + 28, y + 27, 12)
  ctx.fillStyle = '#dfeae2'
  ctx.font = '600 18px system-ui, sans-serif'
  ctx.fillText(label, x + 52, y + 34)
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('关键帧图片加载失败'))
    image.src = source
  })
}

function drawCoverImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const sw = width / scale
  const sh = height / scale
  const sx = (image.naturalWidth - sw) / 2
  const sy = (image.naturalHeight - sh) / 2
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 3) {
  const chars = [...text]
  let line = ''
  let lines = 0
  for (let index = 0; index < chars.length; index += 1) {
    const test = line + chars[index]
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight)
      line = chars[index]
      lines += 1
      if (lines >= maxLines) return y + lines * lineHeight
    } else line = test
  }
  if (line && lines < maxLines) {
    ctx.fillText(line, x, y + lines * lineHeight)
    lines += 1
  }
  return y + lines * lineHeight
}

async function buildReportCanvas(analysis: VideoAnalysis) {
  const width = 1240
  const eventHeight = 650
  const summaryHeight = 310
  const height = 430 + summaryHeight + Math.max(1, analysis.events.length) * eventHeight + 150
  const reportSummary = createReportSummary(analysis)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器无法创建报告画布')

  ctx.fillStyle = '#07100c'
  ctx.fillRect(0, 0, width, height)
  const gradient = ctx.createRadialGradient(width, 0, 20, width, 0, 760)
  gradient.addColorStop(0, '#164c3e')
  gradient.addColorStop(1, 'rgba(7,16,12,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, 620)

  drawTennisBadge(ctx, 94, 100, 44)
  ctx.fillStyle = '#c9ff48'
  ctx.font = '600 18px system-ui, sans-serif'
  ctx.fillText('BOOM TENNIS · XAI REPORT', 164, 82)
  ctx.fillStyle = '#f2f7f3'
  ctx.font = '700 52px system-ui, sans-serif'
  ctx.fillText('网球动作分析报告', 164, 137)
  ctx.fillStyle = '#94a39a'
  ctx.font = '400 20px system-ui, sans-serif'
  ctx.fillText(`${analysis.fileName}  ·  ${analysis.duration.toFixed(1)} 秒  ·  识别 ${analysis.events.length} 个动作`, 64, 210)

  drawBadgePill(ctx, 64, 258, 228, '本地端侧分析')
  drawBadgePill(ctx, 310, 258, 228, '可解释评分')
  drawBadgePill(ctx, 556, 258, 228, '关键动作认证')
  ctx.fillStyle = '#17251d'
  ctx.fillRect(64, 350, width - 128, 2)

  ctx.fillStyle = '#101f16'
  ctx.strokeStyle = '#426134'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(64, 386, width - 128, 270, 22)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#c9ff48'
  ctx.font = '600 18px system-ui, sans-serif'
  ctx.fillText('总体分析与建议', 92, 428)
  ctx.font = '700 64px system-ui, sans-serif'
  ctx.fillText(reportSummary.score ? String(reportSummary.score) : '—', 92, 510)
  ctx.fillStyle = '#819087'
  ctx.font = '400 16px system-ui, sans-serif'
  ctx.fillText('/ 100 综合评分', 174, 506)
  ctx.fillStyle = '#edf5ef'
  ctx.font = '600 21px system-ui, sans-serif'
  wrapText(ctx, reportSummary.conclusion, 330, 438, 820, 30, 2)
  ctx.fillStyle = '#c9ff48'
  ctx.font = '600 16px system-ui, sans-serif'
  ctx.fillText('表现亮点', 330, 520)
  ctx.fillText('优先改进', 760, 520)
  ctx.fillStyle = '#c8d3cb'
  ctx.font = '400 17px system-ui, sans-serif'
  wrapText(ctx, reportSummary.strengths.join('；'), 330, 552, 380, 26, 3)
  wrapText(ctx, reportSummary.suggestions.join('；'), 760, 552, 390, 26, 3)

  if (!analysis.events.length) {
    ctx.fillStyle = '#dfeae2'
    ctx.font = '600 28px system-ui, sans-serif'
    ctx.fillText('本次未识别到明确挥拍', 64, 748)
    ctx.fillStyle = '#94a39a'
    ctx.font = '400 20px system-ui, sans-serif'
    ctx.fillText('请确认目标球员全身入镜，并在分析前点击画面锁定球员。', 64, 790)
  }

  for (let index = 0; index < analysis.events.length; index += 1) {
    const event = analysis.events[index]
    const top = 710 + index * eventHeight
    ctx.fillStyle = '#0f1c14'
    ctx.strokeStyle = '#294032'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(64, top, width - 128, eventHeight - 28, 24)
    ctx.fill()
    ctx.stroke()

    const hero = await loadImage(event.keyframe)
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(88, top + 24, 520, 320, 16)
    ctx.clip()
    drawCoverImage(ctx, hero, 88, top + 24, 520, 320)
    ctx.restore()

    ctx.fillStyle = '#c9ff48'
    ctx.font = '700 42px system-ui, sans-serif'
    ctx.fillText(String(event.score), 650, top + 72)
    ctx.fillStyle = '#829188'
    ctx.font = '500 16px system-ui, sans-serif'
    ctx.fillText(`${event.time.toFixed(2)} 秒 · ${event.label}`, 720, top + 68)
    ctx.fillStyle = '#edf5ef'
    ctx.font = '700 26px system-ui, sans-serif'
    wrapText(ctx, event.summary, 650, top + 118, 500, 34, 2)

    ctx.fillStyle = '#c9ff48'
    ctx.font = '600 17px system-ui, sans-serif'
    ctx.fillText('做得好', 650, top + 205)
    ctx.fillStyle = '#c8d3cb'
    ctx.font = '400 18px system-ui, sans-serif'
    wrapText(ctx, event.strengths[0] ?? '检测到清晰的动作阶段', 650, top + 238, 500, 28, 2)
    ctx.fillStyle = '#c9ff48'
    ctx.font = '600 17px system-ui, sans-serif'
    ctx.fillText('改进建议', 650, top + 312)
    ctx.fillStyle = '#edf5ef'
    ctx.font = '400 18px system-ui, sans-serif'
    wrapText(ctx, event.suggestions[0] ?? '保持当前节奏并继续重复练习', 650, top + 346, 500, 28, 3)

    const phaseWidth = 250
    for (let phaseIndex = 0; phaseIndex < Math.min(4, event.phases.length); phaseIndex += 1) {
      const phase = event.phases[phaseIndex]
      const phaseImage = await loadImage(phase.keyframe)
      const phaseX = 88 + phaseIndex * (phaseWidth + 12)
      const phaseY = top + 378
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(phaseX, phaseY, phaseWidth, 160, 12)
      ctx.clip()
      drawCoverImage(ctx, phaseImage, phaseX, phaseY, phaseWidth, 160)
      ctx.restore()
      ctx.fillStyle = 'rgba(5,12,8,.78)'
      ctx.fillRect(phaseX, phaseY + 122, phaseWidth, 38)
      ctx.fillStyle = '#f0f6f2'
      ctx.font = '600 16px system-ui, sans-serif'
      ctx.fillText(`${phase.name} · ${phase.time.toFixed(1)}s`, phaseX + 14, phaseY + 147)
    }
  }

  const footerY = height - 82
  drawTennisBadge(ctx, 70, footerY - 7, 18)
  ctx.fillStyle = '#728078'
  ctx.font = '400 15px system-ui, sans-serif'
  ctx.fillText('Boom Tennis · 本报告为训练辅助反馈，不替代专业教练或医学意见', 104, footerY)
  return canvas
}

function createHtmlReport(analysis: VideoAnalysis) {
  const tennisBadge = '<span class="tennis-badge" aria-label="Boom Tennis 认证徽章"><i></i></span>'
  const reportSummary = createReportSummary(analysis)
  const overall = `<section class="overall"><div class="overall-score"><small>综合评分</small><strong>${reportSummary.score || '—'}</strong><small>/ 100</small></div><div><label>OVERALL REVIEW</label><h2>总体分析与建议</h2><p>${escapeHtml(reportSummary.conclusion)}</p><div class="overall-grid"><div><h3>表现亮点</h3><p>${escapeHtml(reportSummary.strengths.join('；'))}</p></div><div><h3>优先改进</h3><p>${escapeHtml(reportSummary.suggestions.join('；'))}</p></div></div></div></section><div class="timeline-title"><b>关键时间节点</b><span>按视频时间顺序逐帧解释</span></div>`
  const cards = analysis.events.map((event, index) => `
    <article><div><img class="hero" src="${event.keyframe}" alt="关键帧 ${index + 1}"><div class="phases">${event.phases.map(phase => `<figure><img src="${phase.keyframe}" alt="${escapeHtml(phase.name)}"><figcaption>${escapeHtml(phase.name)}</figcaption></figure>`).join('')}</div></div>
    <div><div class="score">${event.score}</div><small>${event.time.toFixed(2)} 秒 · ${escapeHtml(event.label)}</small><h2>${escapeHtml(event.summary)}</h2>
    <h3>做得好</h3><p>${escapeHtml(event.strengths[0] ?? '检测到清晰的动作阶段')}</p>
    <h3>改进建议</h3><p>${escapeHtml(event.suggestions[0] ?? '保持当前节奏并继续重复练习')}</p></div></article>`).join('')
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Boom 网球分析报告</title>
  <style>*{box-sizing:border-box}body{font-family:system-ui;margin:0;padding:32px;background:#07100c;color:#edf7f0}main{max-width:980px;margin:auto}header{display:flex;gap:18px;align-items:center;margin-bottom:18px}.tennis-badge{display:grid;place-items:center;width:72px;height:72px;border-radius:50%;background:#c9ff48;flex:none}.tennis-badge i{width:52px;height:52px;border:3px solid #102017;border-radius:50%;position:relative}.tennis-badge i:before,.tennis-badge i:after{content:'';position:absolute;top:3px;width:30px;height:40px;border:3px solid #102017;border-top-color:transparent;border-bottom-color:transparent;border-radius:50%}.tennis-badge i:before{left:-9px}.tennis-badge i:after{right:-9px}h1{font-size:42px;margin:0;color:#c9ff48}.meta{color:#91a096}.badges{display:flex;gap:8px;margin:22px 0 30px}.badges span{padding:8px 13px;border:1px solid #35513f;border-radius:99px;color:#c9d5cd;font-size:12px}.overall{display:grid;grid-template-columns:150px 1fr;gap:24px;padding:22px;margin:0 0 24px;border:1px solid #426134;border-radius:18px;background:linear-gradient(135deg,#17271b,#0d1912)}.overall-score{display:flex;flex-direction:column;justify-content:center;align-items:center;border:1px solid #35513f;border-radius:14px}.overall-score strong{font-size:54px;color:#c9ff48}.overall-score small,.overall label,.timeline-title span{color:#84958a;font-size:11px}.overall h2{margin:4px 0}.overall-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.timeline-title{display:flex;align-items:baseline;gap:10px;margin:12px 2px}article{display:grid;grid-template-columns:1.08fr 1fr;gap:24px;padding:18px;margin:16px 0;border:1px solid #294032;border-radius:18px;background:#0f1c14}.hero{width:100%;border-radius:12px}.phases{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:6px}.phases figure{margin:0}.phases img{display:block;width:100%;aspect-ratio:1.2;object-fit:cover;border-radius:5px}.phases figcaption{text-align:center;color:#91a096;font-size:10px}.score{float:right;color:#c9ff48;font-size:44px;font-weight:700}h2{margin:8px 0 20px}h3{font-size:13px;color:#c9ff48;margin-bottom:5px}p{color:#c8d3cb}footer{display:flex;align-items:center;gap:10px;color:#718078;margin:26px 0}.mini{width:24px;height:24px!important}@media(max-width:700px){body{padding:16px}article,.overall{grid-template-columns:1fr}.badges{flex-wrap:wrap}.overall-score{min-height:110px}.overall-grid{grid-template-columns:1fr}}</style>
  <main><header>${tennisBadge}<div><h1>Boom Tennis</h1><div class="meta">${escapeHtml(analysis.fileName)} · ${analysis.duration.toFixed(1)} 秒 · ${analysis.events.length} 个动作</div></div></header><div class="badges"><span>本地端侧分析</span><span>可解释评分</span><span>关键动作认证</span></div>${overall}${cards || '<p>本次未识别到明确挥拍。</p>'}<footer>${tennisBadge}<span>训练辅助反馈，不替代专业教练或医学意见</span></footer></main></html>`
}

async function exportPng(analysis: VideoAnalysis) {
  const canvas = await buildReportCanvas(analysis)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('图片生成失败')), 'image/png'))
  const url = URL.createObjectURL(blob)
  triggerDownload(url, `Boom-训练报告-${Date.now()}.png`)
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

async function exportPdf(analysis: VideoAnalysis) {
  const canvas = await buildReportCanvas(analysis)
  const { jsPDF } = await import('jspdf')
  const pageHeight = Math.round(canvas.width * 1.414)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width, pageHeight], hotfixes: ['px_scaling'] })
  let offset = 0
  let pageIndex = 0
  while (offset < canvas.height) {
    const sliceHeight = Math.min(pageHeight, canvas.height - offset)
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = canvas.width
    pageCanvas.height = pageHeight
    const pageContext = pageCanvas.getContext('2d')!
    pageContext.fillStyle = '#07100c'
    pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
    pageContext.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
    if (pageIndex > 0) pdf.addPage([canvas.width, pageHeight], 'portrait')
    pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, canvas.width, pageHeight)
    offset += sliceHeight
    pageIndex += 1
  }
  pdf.save(`Boom-训练报告-${Date.now()}.pdf`)
}

export async function exportAnalysisReport(analysis: VideoAnalysis, format: ExportFormat) {
  if (format === 'png') return exportPng(analysis)
  if (format === 'pdf') return exportPdf(analysis)
  const blob = new Blob([createHtmlReport(analysis)], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, `Boom-训练报告-${Date.now()}.html`)
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}
