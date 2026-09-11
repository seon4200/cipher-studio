/*
 * Bounded source-selection helper for the V15 cutout final gate.
 *
 * It uses Cipher's existing Pixabay adapter for search/download and writes a
 * visual contact sheet outside Git. It does not invoke a model, publish a
 * ProjectAsset, or change production selection policy. A human/technical
 * review selects one opaque photo per case from this bounded candidate set.
 */

const { app } = require('electron')
const { spawnSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const WORKER = path.join(REPO_ROOT, 'tools', 'photo-cutout-spike', 'cutout_worker.py')
const SPIKE_RUNTIME = process.env.CUTOUT_SPIKE_ROOT || 'C:\\graphify\\_spike-runtime\\photo-cutout-v1'
const GATE_RUNTIME = process.env.CUTOUT_FINAL_GATE_ROOT || 'C:\\graphify\\_spike-runtime\\photo-cutout-final-gate-v1'
const PYTHON = process.env.CUTOUT_SPIKE_PYTHON || path.join(SPIKE_RUNTIME, 'venv', 'Scripts', 'python.exe')
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').replace('Z', '')
const RUN_ROOT = path.join(GATE_RUNTIME, 'runs', RUN_ID)
const CANDIDATE_ROOT = path.join(RUN_ROOT, 'candidate-downloads')
const EVIDENCE_ROOT = path.join(RUN_ROOT, 'evidence')
const FIXTURE_ROOT = createTestFixture('photo-cutout-final-gate-candidate-selection')

const CASES = Object.freeze([
  { id: 'bicycle-holes', label: 'BICICLETA · ruedas/radios/huecos', term: 'bicycle wheels', subject: 'object' },
  { id: 'chair-holes', label: 'SILLA · patas/huecos/estructura fina', term: 'chair', subject: 'object' },
  { id: 'person-fine-hair', label: 'PERSONA · cabello fino/suelto', term: 'woman long hair', subject: 'person' },
  { id: 'animal-fur', label: 'ANIMAL · perro/gato con pelo', term: 'dog', subject: 'object' },
  { id: 'complex-object', label: 'OBJETO COMPLEJO · cámara/herramienta', term: 'camera', subject: 'object' },
])
const MAX_CANDIDATES_PER_CASE = 4
const MAX_INSPECTED_PER_CASE = 12
const REQUESTED_CASES = new Set(process.argv.filter(value => value.startsWith('--case=')).map(value => value.slice('--case='.length)))

function mkdir (target) { fs.mkdirSync(target, { recursive: true }) }
function writeJson (target, value) { mkdir(path.dirname(target)); fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n') }
function sha256 (bytes) { return crypto.createHash('sha256').update(bytes).digest('hex') }

function opaquePhotoPlan (bundle, definition) {
  const concept = {
    originalTerm: definition.term,
    normalizedTerm: definition.term,
    aliases: [],
    subject: definition.subject,
    importance: 3,
    preferredRole: 'hero',
    evidence: 'direct-timed-concept',
  }
  const [planned] = bundle.buildPixabayImageSearchPlansV1({
    concept,
    // Provider-native English is already an authority in the current adapter;
    // this lightweight lexicon object only supplies the test corpus term.
    lexicon: { pixabayTerms: [definition.term] },
    level: 'exact',
    role: 'hero',
    maxPlans: 1,
  })
  if (!planned) throw new Error('PIXABAY_PLAN_MISSING:' + definition.id)
  const { colors, ...withoutTransparentPreference } = planned.parameters
  return {
    ...planned,
    imageType: 'photo',
    transparentRequested: false,
    reason: 'CUTOUT_FINAL_GATE_OPAQUE_PHOTO_CORPUS',
    parameters: { ...withoutTransparentPreference, image_type: 'photo' },
  }
}

function workerMotionSheet (manifest, output) {
  const result = spawnSync(PYTHON, [WORKER, 'motion-sheet', '--manifest', manifest, '--output', output], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('CANDIDATE_SHEET_FAILED:' + (result.stderr || result.stdout || '').slice(-4000))
}

function finish (code) {
  try { process.chdir(path.dirname(FIXTURE_ROOT)) } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error('Fixture temporal retenido:', error.message) }
  app.exit(code)
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)

app.whenReady().then(async () => {
  const result = { schemaVersion: 1, runId: RUN_ID, purpose: 'manual visual source selection for the final cutout gate', cases: [] }
  try {
    if (!fs.existsSync(PYTHON)) throw new Error('CUTOUT_SPIKE_PYTHON_MISSING:' + PYTHON)
    if (!fs.existsSync(WORKER)) throw new Error('CUTOUT_WORKER_MISSING:' + WORKER)
    const bundle = require(path.join(REPO_ROOT, 'dist-electron', 'main', 'index.js'))
    const apiKey = String(process.env.PIXABAY_API_KEY || '').trim()
    if (!apiKey) throw new Error('PIXABAY_API_KEY_REQUIRED_FOR_FINAL_GATE_SELECTION')
    mkdir(CANDIDATE_ROOT); mkdir(EVIDENCE_ROOT)
    const usedIds = new Set()
    const sheetCells = []
    const cases = REQUESTED_CASES.size ? CASES.filter(value => REQUESTED_CASES.has(value.id)) : CASES
    if (!cases.length) throw new Error('NO_MATCHING_CASES')
    for (const definition of cases) {
      const plan = opaquePhotoPlan(bundle, definition)
      const searched = await bundle.searchPixabayImagesV1({ plan, apiKey })
      const accepted = []
      for (const candidate of searched.candidates.slice(0, MAX_INSPECTED_PER_CASE)) {
        if (usedIds.has(candidate.id) || accepted.length >= MAX_CANDIDATES_PER_CASE) continue
        const bytes = await bundle.downloadPixabayImageBytesV1({ candidate })
        const inspection = bundle.inspectPixabayRasterImageV1(bytes)
        // The final gate deliberately tests removal of real opaque photos.
        if (inspection.alphaUseful) continue
        const target = path.join(CANDIDATE_ROOT, definition.id, `${candidate.id}.${inspection.extension}`)
        mkdir(path.dirname(target)); fs.writeFileSync(target, bytes)
        const record = {
          provider: 'pixabay-images', providerAssetId: candidate.id, query: plan.query,
          selectedAsset: candidate.pageUrl, sourceSha256: sha256(bytes), sourcePath: target,
          sourceBytes: bytes.length, inspection, tags: candidate.tags, score: candidate.score,
          ranking: candidate.ranking, selectionValid: null,
        }
        accepted.push(record); usedIds.add(candidate.id)
        sheetCells.push({ label: `${definition.id} · ${candidate.id} · ${candidate.tags.slice(0, 3).join(', ')}`, path: target })
      }
      if (!accepted.length) throw new Error('NO_OPAQUE_PIXABAY_CANDIDATE:' + definition.id)
      result.cases.push({ id: definition.id, label: definition.label, term: definition.term, query: plan.query,
        searchOutcome: searched.outcome, candidatesReturned: searched.candidates.length, opaqueCandidates: accepted })
    }
    const manifest = path.join(RUN_ROOT, 'candidate-sheet.json')
    const sheet = path.join(EVIDENCE_ROOT, 'cutout-final-gate-candidates.png')
    writeJson(manifest, { cells: sheetCells })
    workerMotionSheet(manifest, sheet)
    result.contactSheet = sheet
    writeJson(path.join(EVIDENCE_ROOT, 'candidate-selection.json'), result)
    console.log('CUTOUT_FINAL_GATE_CANDIDATE_RUN=' + RUN_ROOT)
    console.log('CUTOUT_FINAL_GATE_CANDIDATE_SHEET=' + sheet)
    finish(0)
  } catch (error) {
    result.status = 'FAIL'; result.error = String(error?.message || error)
    try { writeJson(path.join(EVIDENCE_ROOT, 'failure.json'), result) } catch {}
    console.error(error?.stack || error)
    finish(1)
  }
}).catch(error => { console.error(error?.stack || error); finish(1) })
