const { app } = require('electron')
const fs = require('fs')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')

const REPO_ROOT = path.resolve(__dirname, '../../..')
const OUTPUT = path.join(__dirname, 'pixabay-live-probe.json')
const FIXTURE_ROOT = createTestFixture('pixabay-images-live-probe')
const PROJECT_ROOT = path.join(FIXTURE_ROOT, 'project')

function finish (code) {
  try { process.chdir(path.dirname(FIXTURE_ROOT)) } catch {}
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error('Fixture retenido:', error.message) }
  app.exit(code)
}

app.setPath('userData', path.join(FIXTURE_ROOT, 'electron-user-data'))
process.chdir(FIXTURE_ROOT)
app.whenReady().then(async () => {
  const bundle = require(path.join(REPO_ROOT, 'dist-electron/main/index.js'))
  const apiKey = String(process.env.PIXABAY_API_KEY || '').trim()
  if (!apiKey) throw new Error('PIXABAY_API_KEY_REQUIRED')
  bundle.createProjectFiles(PROJECT_ROOT, { id: 'pixabay-live-probe', clips: [], timelineVideoClips: [], aiScript: 'fixture' })
  const retrieval = bundle.resolveVisualRetrievalV1({
    intent: bundle.createAssetIntentV1({ sceneId: 'pixabay-live-airplane', keyword: 'avión', concepts: ['avión'] }),
  })
  const plans = retrieval.plans.filter(plan => plan.provider === 'pixabay-images').flatMap(plan => plan.pixabayPlans || [])
  let result = null
  for (const plan of plans.slice(0, 2)) {
    const searched = await bundle.searchPixabayImagesV1({ plan, apiKey })
    const candidate = bundle.selectPixabayImageCandidateV1(searched.candidates)
    if (!candidate) continue
    const bytes = await bundle.downloadPixabayImageBytesV1({ candidate })
    const inspection = bundle.inspectPixabayRasterImageV1(bytes)
    if (candidate.transparentRequested && !inspection.alphaUseful) continue
    const published = bundle.publishPixabayImageAssetV1({ projectRoot: PROJECT_ROOT, candidate, bytes })
    bundle.verifyPixabayImageAssetContentV1(PROJECT_ROOT, published.asset)
    result = {
      status: 'PASS', query: plan.query, language: plan.language, searchOutcome: searched.outcome,
      candidateCount: searched.candidates.length, selectedId: candidate.id,
      mime: inspection.mime, width: inspection.width, height: inspection.height,
      hasAlpha: inspection.hasAlpha, alphaUseful: inspection.alphaUseful,
      byteLength: bytes.length, sha256: published.asset.sha256,
      projectAssetStatus: published.status, userAgent: bundle.PIXABAY_USER_AGENT,
    }
    break
  }
  if (!result) result = { status: 'NO_USABLE_RESULT', plansTried: Math.min(2, plans.length), userAgent: bundle.PIXABAY_USER_AGENT }
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + '\n')
  console.log('PIXABAY_LIVE_PROBE=' + JSON.stringify(result))
  finish(result.status === 'PASS' ? 0 : 2)
}).catch(error => {
  const result = { status: 'FAIL', code: error?.code || error?.name || 'ERROR', message: String(error?.message || error),
    details: error?.details || null }
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + '\n')
  console.error('PIXABAY_LIVE_PROBE=' + JSON.stringify(result))
  finish(1)
})
