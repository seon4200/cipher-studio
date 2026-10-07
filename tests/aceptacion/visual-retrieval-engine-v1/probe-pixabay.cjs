// One bounded human-directed Pixabay probe. It bundles only pure retrieval/persistence modules
// into a marked temporary directory, so it cannot start Cipher's Electron UI or unrelated IPC.
const crypto = require('crypto')
const esbuild = require('esbuild')
const fs = require('fs')
const https = require('https')
const path = require('path')
const { createTestFixture, cleanupTestFixture } = require('../../helpers/safe-fixture')

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const FIXTURE_ROOT = createTestFixture('pixabay-live-probe')

function dotenvValue (key) {
  const file = path.join(REPO_ROOT, '.env')
  if (!fs.existsSync(file)) return ''
  const expression = new RegExp('^\\s*' + key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + '\\s*=\\s*(.*?)\\s*$')
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(expression)
    if (!match) continue
    const value = match[1].trim()
    return value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      ? value.slice(1, -1) : value
  }
  return ''
}

function loadProbeBundle () {
  const output = path.join(FIXTURE_ROOT, 'pixabay-probe.bundle.cjs')
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, 'probe-entry.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    outfile: output,
    logLevel: 'silent',
  })
  return require(output)
}

function download (url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 15000 }, response => {
      const chunks = []
      let size = 0
      response.on('data', chunk => {
        size += chunk.length
        if (size > 20 * 1024 * 1024) return request.destroy(new Error('PIXABAY_DOWNLOAD_TOO_LARGE'))
        chunks.push(Buffer.from(chunk))
      })
      response.on('error', reject)
      response.on('end', () => {
        if ((response.statusCode || 500) < 200 || (response.statusCode || 500) >= 300)
          return reject(new Error('PIXABAY_DOWNLOAD_HTTP_' + response.statusCode))
        resolve(Buffer.concat(chunks))
      })
    })
    request.once('timeout', () => request.destroy(new Error('PIXABAY_DOWNLOAD_TIMEOUT')))
    request.once('error', reject)
  })
}

async function main () {
  const bundle = loadProbeBundle()
  if (process.env.CIPHER_PIXABAY_PROBE_OFFLINE === '1') {
    console.log('PIXABAY_LIVE_PROBE=SKIPPED_OFFLINE_HARNESS_CHECK')
    return
  }
  const apiKey = dotenvValue('PIXABAY_API_KEY')
  if (!apiKey) {
    console.log('PIXABAY_LIVE_PROBE=SKIPPED_NO_API_KEY')
    return
  }
  const intent = bundle.createAssetIntentV1({ sceneId: 'pixabay-live-airplane', keyword: 'avión', concepts: ['avión'] })
  const concept = bundle.createVisualConceptSetV1({ intent }).primary
  const expansion = bundle.expandConceptLexiconV1(concept.originalTerm)[0]
  const plan = bundle.buildPixabayImageSearchPlansV1({ concept, lexicon: expansion?.entry, level: expansion?.level ?? 'context' })[0]
  const searched = await bundle.searchPixabayImagesV1({ plan, apiKey })
  const selected = searched.candidates[0]
  if (!selected) {
    console.log('PIXABAY_LIVE_PROBE=' + JSON.stringify({ query: plan.query, candidateCount: 0, transparentRequested: plan.transparentRequested }))
    return
  }
  const bytes = await download(selected.downloadUrl)
  const inspection = bundle.inspectPixabayRasterImageV1(bytes)
  const projectRoot = path.join(FIXTURE_ROOT, 'project')
  bundle.createProjectFiles(projectRoot, { id: 'pixabay-live-probe', clips: [], timelineVideoClips: [], aiScript: 'fixture' })
  const published = bundle.publishPixabayImageAssetV1({ projectRoot, candidate: selected, bytes })
  console.log('PIXABAY_LIVE_PROBE=' + JSON.stringify({
    query: plan.query, transparentRequested: plan.transparentRequested, candidateCount: searched.candidates.length,
    selected: { id: selected.id, type: selected.imageType, score: selected.score },
    inspection: { mime: inspection.mime, width: inspection.width, height: inspection.height,
      hasAlpha: inspection.hasAlpha, alphaUseful: inspection.alphaUseful, warnings: inspection.warnings },
    published: { status: published.status, sha256: published.asset.sha256, mime: published.asset.mime,
      byteLength: published.asset.byteLength, hasAlpha: published.asset.validation.hasAlpha,
      alphaUseful: published.asset.validation.alphaUseful },
    bytesSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  }))
}

main().catch(error => {
  console.error(error && error.stack || error)
  process.exitCode = 1
}).finally(() => {
  try { cleanupTestFixture(FIXTURE_ROOT) } catch (error) { console.error('Fixture retenido:', error.message); process.exitCode = 1 }
})
