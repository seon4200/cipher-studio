/*
 * Final quality gate for the isolated V15 CutoutTransform spike.
 *
 * This runner consumes only five preselected, locally stored opaque Pixabay
 * photographs. It never searches/downloads a provider, touches a real project,
 * publishes an asset, or imports rembg into Cipher's production runtime.
 */

const { spawnSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const WORKER = path.join(REPO_ROOT, 'tools', 'photo-cutout-spike', 'cutout_worker.py')
const SPIKE_RUNTIME = process.env.CUTOUT_SPIKE_ROOT || 'C:\\graphify\\_spike-runtime\\photo-cutout-v1'
const GATE_RUNTIME = process.env.CUTOUT_FINAL_GATE_ROOT || 'C:\\graphify\\_spike-runtime\\photo-cutout-final-gate-v1'
const PYTHON = process.env.CUTOUT_SPIKE_PYTHON || path.join(SPIKE_RUNTIME, 'venv', 'Scripts', 'python.exe')
const PRIOR_RUN = '2026-09-11-06-18-11-623'
const MODEL_CACHE = process.env.CUTOUT_FINAL_GATE_MODEL_CACHE || path.join(SPIKE_RUNTIME, 'runs', PRIOR_RUN, 'model-cache')
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').replace('Z', '')
const RUN_ROOT = path.join(GATE_RUNTIME, 'runs', RUN_ID)
const RAW_ROOT = path.join(RUN_ROOT, 'raw')
const CUTOUT_ROOT = path.join(RUN_ROOT, 'cutouts')
const EVIDENCE_ROOT = path.join(RUN_ROOT, 'evidence')

// Candidate IDs are evidence references, not production retrieval rules. Each
// source was inspected visually in prepare-candidates.cjs before this gate.
const SELECTED = Object.freeze([
  { id: 'bicycle-holes', label: 'bicicleta · ruedas/radios/huecos', run: '2026-09-11-20-05-06-513', assetId: '1658214', narrativeUse: 'GOOD_CUTOUT_CANDIDATE' },
  { id: 'chair-holes', label: 'silla · patas/huecos/estructura fina', run: '2026-09-11-20-02-59-315', assetId: '1547845', narrativeUse: 'GOOD_CUTOUT_CANDIDATE' },
  { id: 'person-fine-hair', label: 'persona · cabello fino/suelto', run: '2026-09-11-20-02-59-315', assetId: '2593366', narrativeUse: 'CONDITIONAL_CUTOUT' },
  { id: 'animal-fur', label: 'animal · perro con pelo', run: '2026-09-11-20-02-59-315', assetId: '2184791', narrativeUse: 'CONDITIONAL_CUTOUT' },
  { id: 'complex-object', label: 'objeto complejo · cámara', run: '2026-09-11-20-02-59-315', assetId: '1362419', narrativeUse: 'GOOD_CUTOUT_CANDIDATE' },
])

function mkdir (target) { fs.mkdirSync(target, { recursive: true }) }
function writeJson (target, value) { mkdir(path.dirname(target)); fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n') }
function sha256 (bytes) { return crypto.createHash('sha256').update(bytes).digest('hex') }
function sha256File (target) { return sha256(fs.readFileSync(target)) }

function runWorker (args) {
  if (!fs.existsSync(PYTHON)) throw new Error('CUTOUT_SPIKE_PYTHON_MISSING:' + PYTHON)
  if (!fs.existsSync(WORKER)) throw new Error('CUTOUT_WORKER_MISSING:' + WORKER)
  const result = spawnSync(PYTHON, [WORKER, ...args], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('CUTOUT_WORKER_FAILED:' + (result.stderr || result.stdout || '').slice(-4000))
  const line = String(result.stdout).trim().split(/\r?\n/).reverse().find(value => value.trim().startsWith('{'))
  if (!line) throw new Error('CUTOUT_WORKER_NO_JSON')
  return JSON.parse(line)
}

function selectedRecord (definition) {
  const file = path.join(GATE_RUNTIME, 'runs', definition.run, 'evidence', 'candidate-selection.json')
  const candidateRun = JSON.parse(fs.readFileSync(file, 'utf8'))
  const sourceCase = candidateRun.cases.find(value => value.id === definition.id)
  const candidate = sourceCase?.opaqueCandidates?.find(value => value.providerAssetId === definition.assetId)
  if (!candidate) throw new Error('SELECTED_CANDIDATE_NOT_FOUND:' + definition.id + ':' + definition.assetId)
  if (candidate.inspection?.alphaUseful) throw new Error('SELECTED_SOURCE_NOT_OPAQUE:' + definition.id)
  if (!fs.existsSync(candidate.sourcePath) || sha256File(candidate.sourcePath) !== candidate.sourceSha256)
    throw new Error('SELECTED_SOURCE_SHA_MISMATCH:' + definition.id)
  return candidate
}

function modelExists (model) {
  const file = path.join(MODEL_CACHE, 'models', model, `${model}.onnx`)
  if (!fs.existsSync(file)) throw new Error('REUSED_MODEL_CACHE_MISSING:' + model)
  return { path: file, bytes: fs.statSync(file).size, sha256: sha256File(file) }
}

function pickReferencePerformance () {
  const file = path.join(SPIKE_RUNTIME, 'runs', PRIOR_RUN, 'evidence', 'performance.json')
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  return {
    source: file,
    u2netp1024: raw.summary?.u2netp?.['1024'] ?? null,
    isnetGeneralUse1024: raw.summary?.['isnet-general-use']?.['1024'] ?? null,
  }
}

try {
  mkdir(RAW_ROOT); mkdir(CUTOUT_ROOT); mkdir(EVIDENCE_ROOT)
  const selected = SELECTED.map(definition => ({ definition, candidate: selectedRecord(definition) }))
  const selectionControl = {
    schemaVersion: 1,
    selectionRule: 'VISUALLY_VERIFIED_OPAQUE_PHOTO; no provider search during benchmark',
    sources: selected.map(({ definition, candidate }) => ({
      id: definition.id, label: definition.label, narrativeUse: definition.narrativeUse,
      query: candidate.query, provider: candidate.provider, providerAssetId: candidate.providerAssetId,
      selectedAsset: candidate.selectedAsset, selectionValid: true, tags: candidate.tags,
      sourcePath: candidate.sourcePath, sourceSha256: candidate.sourceSha256, sourceBytes: candidate.sourceBytes,
      inspection: candidate.inspection,
    })),
  }
  const manifest = { version: 1, cases: [] }
  for (const { definition, candidate } of selected) {
    const extension = candidate.inspection.extension
    const target = path.join(RAW_ROOT, `${definition.id}.${extension}`)
    fs.copyFileSync(candidate.sourcePath, target)
    if (sha256File(target) !== candidate.sourceSha256) throw new Error('COPIED_SOURCE_SHA_MISMATCH:' + definition.id)
    manifest.cases.push({ id: definition.id, label: definition.label, sourcePath: target })
  }
  const manifestPath = path.join(RUN_ROOT, 'sources-manifest.json')
  writeJson(manifestPath, manifest)
  writeJson(path.join(EVIDENCE_ROOT, 'source-selection-control.json'), selectionControl)

  const models = { u2netp: modelExists('u2netp'), 'isnet-general-use': modelExists('isnet-general-use') }
  const benchmark = { schemaVersion: 1, runId: RUN_ID, maxDimension: 1024, warmRunsPerCase: 3, models: {} }
  for (const model of ['u2netp', 'isnet-general-use']) {
    benchmark.models[model] = runWorker([
      'benchmark', '--model', model, '--cache', MODEL_CACHE, '--manifest', manifestPath,
      '--output-dir', CUTOUT_ROOT, '--max-dimension', '1024', '--warm-runs', '3',
    ])
  }
  const qualityBenchmark = { version: 1, models: benchmark.models }
  const qualityBenchmarkPath = path.join(RUN_ROOT, 'quality-benchmark.json')
  const qualitySheet = path.join(EVIDENCE_ROOT, 'cutout-final-gate-comparison.png')
  writeJson(qualityBenchmarkPath, qualityBenchmark)
  runWorker(['quality-sheet', '--benchmark', qualityBenchmarkPath, '--output', qualitySheet])
  const draft = {
    schemaVersion: 1,
    runId: RUN_ID,
    purpose: 'V15 CutoutTransform final gate; local-only model comparison at 1024px',
    sourceSelection: selectionControl,
    models,
    benchmark,
    performanceReference: pickReferencePerformance(),
    artifacts: { comparison: qualitySheet, qualityBenchmark: qualityBenchmarkPath },
    requiresVisualReview: true,
  }
  const draftPath = path.join(EVIDENCE_ROOT, 'cutout-final-gate-results.draft.json')
  writeJson(draftPath, draft)
  console.log('CUTOUT_FINAL_GATE_RUN=' + RUN_ROOT)
  console.log('CUTOUT_FINAL_GATE_DRAFT=' + draftPath)
  console.log('CUTOUT_FINAL_GATE_COMPARISON=' + qualitySheet)
} catch (error) {
  const failure = { schemaVersion: 1, status: 'FAIL', error: String(error?.message || error), runRoot: RUN_ROOT }
  try { writeJson(path.join(EVIDENCE_ROOT, 'failure.json'), failure) } catch {}
  console.error(error?.stack || error)
  process.exitCode = 1
}
