'use strict'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file)
const { createBuildGraphicsPlanner, BUILD_GRAPHICS_OUTPUT_SCHEMA } = require('../src/main/services/build-graphics-planner.ts')
const { createTimedScriptSegments } = require('../src/shared/build-planning.ts')
const { colocarYFiltrarTarjetas } = require('../src/shared/exclusion.ts')

const graphicFor = phraseIndex => ({ phraseIndex, graphic: { type: 'frase_clave', value: `Idea ${phraseIndex}`,
  label: `Idea ${phraseIndex}`, unit: '', emoji: '', extra: { rightValue: '', leftLabel: '', rightLabel: '',
    beforeValue: '', afterValue: '', steps: [], items: [], top3: [] }, graphicStart: 0.2, graphicEnd: 2.2 } })
const phrasesFromPrompt = prompt => JSON.parse(prompt.slice(prompt.lastIndexOf('Frases: ') + 'Frases: '.length))

async function main() {
  const segments = createTimedScriptSegments('Forest growth matters. Birds return each spring. Water sustains the whole ecosystem. People protect its future.', 12)
  const clips = [
    { id: 'original-0', name: 'Original 0', category: 'original', phraseIdx: 0, startSeconds: segments[0].start },
    { id: 'stock-1', name: 'Stock 1', category: 'stock', phraseIdx: 1, startSeconds: segments[1].start },
    { id: 'ia-2', name: 'IA 2', category: 'ia', phraseIdx: 2, startSeconds: segments[2].start },
    { id: 'visual-3', name: 'Visual 3', category: 'visual', phraseIdx: 3, startSeconds: segments[3].start },
  ]
  const calls = []
  const planner = createBuildGraphicsPlanner({ complete: async request => {
    calls.push(request)
    assert.equal(request.purpose, 'build-planner')
    assert.equal(request.outputSchema, BUILD_GRAPHICS_OUTPUT_SCHEMA)
    const phrases = phrasesFromPrompt(request.prompt)
    return { text: JSON.stringify({ graphics: phrases.map(item => graphicFor(item.phraseIndex)) }), model: 'mock Codex',
      providerTiming: { elapsedMs: 11 } }
  } })
  const result = await planner({ scriptText: segments.map(segment => segment.text).join(' '), clips,
    audioSegments: segments, graphicsPercent: 50, durationSeconds: 12 })
  assert.equal(result.targetCount, 2)
  assert.equal(result.calls, 1)
  assert.equal(result.providerMs, 11)
  assert.equal(result.provider, 'codex-app-server')
  assert.deepEqual(result.clips.filter(clip => clip.graphicData).map(clip => clip.id), ['original-0', 'stock-1'])
  assert.ok(result.clips.every(clip => clip.id !== 'visual-3'))
  assert.ok(result.clips.filter(clip => clip.graphicData).every(clip =>
    clip.graphicAbsoluteStart >= clip.startSeconds && clip.graphicDuration > 0 && clip.graphicDuration <= 2))
  const placed = colocarYFiltrarTarjetas(result.clips, [...result.clips,
    { id: 'animation-visual', category: 'visual', startSeconds: 0, durationSeconds: 2 }])
  assert.equal(placed.descartadas.length, 1, 'graphics overlapping a Visual are excluded by the existing placement contract')

  let visualOnlyCalls = 0
  const visualOnly = await createBuildGraphicsPlanner({ complete: async () => { visualOnlyCalls++; throw new Error('UNEXPECTED_CODEX_CALL') } })(
    { scriptText: 'Forest.', clips: [], audioSegments: createTimedScriptSegments('Forest.', 20), graphicsPercent: 100, durationSeconds: 20 })
  assert.equal(visualOnly.targetCount, 0)
  assert.equal(visualOnlyCalls, 0, 'a 100% Visuals build has no eligible legacy graphics targets')

  await assert.rejects(createBuildGraphicsPlanner({ complete: async request => ({
    text: JSON.stringify({ graphics: phrasesFromPrompt(request.prompt).map(item => graphicFor(item.phraseIndex)).slice(0, 0) }),
  }) })({ scriptText: 'Forest.', clips: [clips[0]], audioSegments: [segments[0]], graphicsPercent: 100, durationSeconds: 12 }),
  /BUILD_GRAPHICS_CODEX_RESULT_INCOMPLETE/)

  const sevenSegments = createTimedScriptSegments('One. Two. Three. Four. Five. Six. Seven.', 21)
  let batchCalls = 0
  const failedBatch = await createBuildGraphicsPlanner({ complete: async request => {
    batchCalls++
    if (batchCalls === 2) { const error = new Error('OFFLINE'); error.providerTiming = { elapsedMs: 9 }; throw error }
    return { text: JSON.stringify({ graphics: phrasesFromPrompt(request.prompt).map(item => graphicFor(item.phraseIndex)) }) }
  } })({ scriptText: sevenSegments.map(segment => segment.text).join(' '),
    clips: sevenSegments.map((segment, phraseIdx) => ({ id: `slot-${phraseIdx}`, category: 'stock', phraseIdx, startSeconds: segment.start })),
    audioSegments: sevenSegments, graphicsPercent: 100, durationSeconds: 21 }).catch(error => error)
  assert.match(failedBatch.message, /BUILD_GRAPHICS_CODEX_FAILED:OFFLINE/)
  assert.equal(batchCalls, 2, 'a later Codex error rejects the full graphics response')
  assert.deepEqual(failedBatch.buildGraphicsMetrics, { calls: 2, providerMs: 9, planningMs: failedBatch.buildGraphicsMetrics.planningMs })
  assert.ok(failedBatch.buildGraphicsMetrics.planningMs >= 0)

  const controller = new AbortController()
  const pending = createBuildGraphicsPlanner({ complete: async request => new Promise((_resolve, reject) =>
    request.signal.addEventListener('abort', () => reject(new Error('BUILD_GRAPHICS_CODEX_CANCELLED')), { once: true })) })({
      scriptText: 'Forest.', clips: [clips[0]], audioSegments: [segments[0]], graphicsPercent: 100, durationSeconds: 12,
      signal: controller.signal,
    })
  await new Promise(resolve => setImmediate(resolve))
  controller.abort()
  await assert.rejects(pending, /BUILD_GRAPHICS_CODEX_CANCELLED/)
  process.stdout.write('Build graphics planner: Codex schema, distribution, placement, Visual exclusion, fail-closed batching and cancellation passed.\n')
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1 })
