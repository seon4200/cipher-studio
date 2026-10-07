// Extract entry/read/exit observations from the already-rendered 24-fps acceptance MP4s.
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const corpus = require('../../fixtures/visual-recovery-corpus-v1')
const output = __dirname
const frameDir = path.join(output, 'motion-stages')
fs.mkdirSync(frameDir, { recursive: true })
const selected = [0, 5, 7, 11]
const samples = []
for (const format of ['vertical', 'horizontal']) {
  const video = path.join(output, `visual-recovery-12-${format}.mp4`)
  if (!fs.existsSync(video)) throw new Error(`ACCEPTANCE_VIDEO_MISSING:${format}`)
  for (const index of selected) {
    const row = corpus[index]
    const start = corpus.slice(0, index).reduce((sum, scene) => sum + scene.duration, 0)
    for (const [stage, fraction] of [['entry', .16], ['read', .57], ['exit', .9]]) {
      const image = `${row.id}-${format}-${stage}.png`
      const at = start + row.duration * fraction
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', at.toFixed(4),
        '-i', video, '-frames:v', '1', path.join(frameDir, image)])
      samples.push({ scene: row.id, format, stage, at: Number(at.toFixed(4)), image })
    }
  }
}
const cards = samples.map(row => `<figure><img src="motion-stages/${row.image}">` +
  `<figcaption>${row.scene} · ${row.format} · ${row.stage} · ${row.at}s</figcaption></figure>`).join('')
const html = '<!doctype html><meta charset="utf-8"><style>body{background:#17171a;color:#fff;' +
  'font:16px Arial;margin:20px}.grid{display:grid;grid-template-columns:repeat(3,minmax(250px,1fr));' +
  'gap:16px}figure{margin:0}img{width:100%;height:490px;object-fit:contain;background:#000}' +
  'figcaption{padding:7px}</style><main class="grid">' + cards + '</main>'
fs.writeFileSync(path.join(output, 'motion-entry-read-exit.html'), html)
fs.writeFileSync(path.join(output, 'motion-stages.json'), JSON.stringify(samples, null, 2))
console.log('VISUAL_RECOVERY_MOTION_STAGES_OK', samples.length)
