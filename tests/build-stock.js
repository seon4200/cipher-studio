'use strict'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { randomUUID } = require('node:crypto')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file)
const {
  buildStockSearchQuery, scoreBuildStockMetadata, rankBuildStockCandidates, compareBuildStockRanking,
  createBuildStockService, BUILD_STOCK_VERSION, BUILD_STOCK_MIN_VISUAL_FIT, safeNasaAssetUrl,
} = require('../src/main/services/build-stock.ts')
const { allocateBuildSources, pendingBuildSlot, runCommonMediaQueue } = require('../src/shared/build-integrity.ts')
const persistence = require('../src/main/services/project-persistence.ts')

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status,
  headers: { get: () => null }, json: async () => data, arrayBuffer: async () => Buffer.from(data) })
const candidates = [
  { id: 'fox-broken', title: 'Red fox hunting in snow', description: 'A red fox hunts across deep snow.', tags: ['fox', 'snow', 'hunting'],
    duration: 8, video_files: [{ link: 'https://cdn.test/media/fox-broken.mp4', width: 1280, height: 720 }] },
  { id: 'fox-short', title: 'Red fox hunting through winter snow', description: 'A fox moves through snow.', tags: ['fox', 'snow', 'winter'],
    duration: 2, video_files: [{ link: 'https://cdn.test/media/fox-short.mp4', width: 1280, height: 720 }] },
  { id: 'fox-valid', title: 'Red fox stalking prey in winter snow', description: 'Fox hunts beside a pine forest.', tags: ['red fox', 'snow', 'forest'],
    duration: 12, video_files: [{ link: 'https://cdn.test/media/fox-valid.mp4', width: 1280, height: 720 }] },
  { id: 'forest-4k', title: 'Aerial evergreen forest at sunrise', description: 'Wide landscape drone shot.', tags: ['forest', 'sunrise'],
    duration: 8, video_files: [{ link: 'https://cdn.test/media/forest-4k.mp4', width: 1920, height: 1080 }] },
]
const scene = { keyword: 'fox hunting snow', phrase: 'A red fox hunts in deep snow',
  contextBefore: 'Winter forest at dawn', contextAfter: 'It returns to its den.' }

function makeDependencies(root, options = {}) {
  const counts = { api: {}, downloads: {}, maxConcurrentProviders: 0, activeProviders: 0, codexCalls: [] }
  const env = { PEXELS_API_KEY: 'test', PIXABAY_API_KEY: 'test', COVERR_API_KEY: 'test' }
  const providerDelay = { pexels: 20, pixabay: 10, coverr: 60, ...(options.providerDelay || {}) }
  const fetch = async (url, init = {}) => {
    const text = String(url)
    if (text.includes('api.pexels.com/videos/search')) {
      counts.api.pexels = (counts.api.pexels || 0) + 1
      counts.activeProviders++
      counts.maxConcurrentProviders = Math.max(counts.maxConcurrentProviders, counts.activeProviders)
      await delay(providerDelay.pexels)
      counts.activeProviders--
      return response({ videos: (options.videos || candidates).map(video => ({ ...video,
        url: `https://www.pexels.com/video/${video.id}`, user: { name: 'fixture creator' } })) })
    }
    if (text.includes('pixabay.com/api/videos')) {
      counts.api.pixabay = (counts.api.pixabay || 0) + 1
      counts.activeProviders++
      counts.maxConcurrentProviders = Math.max(counts.maxConcurrentProviders, counts.activeProviders)
      await delay(providerDelay.pixabay)
      counts.activeProviders--
      return response({}, 503)
    }
    if (text.includes('api.coverr.co/videos')) {
      counts.api.coverr = (counts.api.coverr || 0) + 1
      counts.activeProviders++
      counts.maxConcurrentProviders = Math.max(counts.maxConcurrentProviders, counts.activeProviders)
      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, providerDelay.coverr)
          init.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')) }, { once: true })
        })
        return response({ hits: [] })
      } finally { counts.activeProviders-- }
    }
    if (text.includes('images-api.nasa.gov')) {
      counts.api.nasa = (counts.api.nasa || 0) + 1
      return response({ collection: { items: [] } })
    }
    if (text.includes('/media/')) {
      const id = path.basename(new URL(text).pathname, '.mp4')
      counts.downloads[id] = (counts.downloads[id] || 0) + 1
      if (options.downloadDelay) await delay(options.downloadDelay)
      return response(Buffer.from(id === 'fox-broken' ? 'CORRUPT' : id === 'fox-short' ? 'SHORT' : 'VALID'))
    }
    throw new Error('UNEXPECTED_FETCH:' + text)
  }
  const probeVideo = async filePath => {
    const bytes = fs.readFileSync(filePath).toString()
    if (bytes === 'CORRUPT') throw new Error('STOCK_MEDIA_INVALID')
    if (bytes === 'SHORT') return { durationSeconds: 2, width: 1280, height: 720 }
    return { durationSeconds: 12, width: 1280, height: 720 }
  }
  const runFfmpeg = async args => {
    const output = args[args.length - 1]
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, output.endsWith('.jpg') ? 'FRAME' : 'CROP')
  }
  const codexProvider = { complete: async request => {
    counts.codexCalls.push(request)
    assert.equal(request.purpose, 'build-planner')
    assert.equal(request.outputSchema.required[0], 'reviews')
    assert.ok(request.referencePaths.length > 0)
    request.referencePaths.forEach(frame => assert.ok(path.isAbsolute(frame) && fs.existsSync(frame)))
    const entries = [...request.prompt.matchAll(/Candidato (\d+): pexels\/([^.]+)\./g)]
    return { text: JSON.stringify({ reviews: entries.map(([_, candidateIndex, id]) => ({
      candidateIndex: Number(candidateIndex), visualFit: id === 'fox-valid' || id === 'fox-primary' || id === 'rover-good' ? 92 :
        id === 'mars-poor' ? 4 : id === 'forest-4k' ? 35 : 50,
      reason: id === 'fox-valid' || id === 'fox-primary' || id === 'rover-good' ? 'El sujeto y la acción aparecen juntos en los fotogramas.' :
        id === 'mars-poor' ? 'Los fotogramas no contienen el vehículo solicitado.' : 'Los fotogramas muestran contexto sin la acción pedida.'
    })) }), model: 'Codex fixture', providerTiming: { elapsedMs: 4 } }
  } }
  const service = createBuildStockService({
    fetch, codexProvider, env: () => env, probeVideo, runFfmpeg,
    providerTimeoutMs: options.providerTimeoutMs ?? 25, downloadTimeoutMs: 200, visualTimeoutMs: 200,
    providerConcurrency: options.providerConcurrency ?? 3, downloadConcurrency: 2,
    maxCandidates: options.maxCandidates ?? 5, visualFinalists: options.visualFinalists ?? 3,
    logger: () => {},
  })
  return { service, counts }
}

async function run() {
  const fixture = createTestFixture('build-stock-phase3')
  try {
    const query = buildStockSearchQuery(scene)
    assert.match(query, /fox/); assert.match(query, /hunting/); assert.match(query, /red/)
    assert.ok(query.split(/\s+/).length <= 5, 'search queries stay compact for conjunctive provider APIs')
    assert.equal(buildStockSearchQuery({ keyword: 'Mars rover', phrase: 'A Mars rover crosses the red planet',
      contextBefore: 'Dust covers the tracks', contextAfter: 'Scientists study the landscape' }), 'mars rover red landscape')
    assert.match(buildStockSearchQuery({ keyword: 'ocean', phrase: 'ocean water', contextBefore: 'coral reef nearby',
      contextAfter: 'waves along shore' }), /waves|shore/)
    assert.equal(safeNasaAssetUrl('http://images-assets.nasa.gov/video/example~large.mp4'),
      'https://images-assets.nasa.gov/video/example~large.mp4')
    assert.equal(safeNasaAssetUrl('http://example.com/video.mp4'), '')
    const compared = compareBuildStockRanking([
      { provider: 'pexels', id: 'forest-4k', title: 'Aerial evergreen forest at sunrise', description: '', tags: [], width: 1920, height: 1080, duration: 8, downloadUrl: 'https://x/1' },
      { provider: 'pexels', id: 'fox-relevant', title: 'Red fox hunting in snow', description: '', tags: ['fox', 'hunting', 'snow'], width: 1280, height: 720, duration: 12, downloadUrl: 'https://x/2' },
    ], [
      { provider: 'pexels', id: 'forest-4k', title: 'Aerial evergreen forest at sunrise', description: '', tags: [], width: 1920, height: 1080, duration: 8, downloadUrl: 'https://x/1' },
      { provider: 'pexels', id: 'fox-relevant', title: 'Red fox hunting in snow', description: '', tags: ['fox', 'hunting', 'snow'], width: 1280, height: 720, duration: 12, downloadUrl: 'https://x/2' },
    ], false, scene)
    assert.equal(compared.baseTop, 'pexels:forest-4k')
    assert.equal(compared.improvedTop, 'pexels:fox-relevant')
    assert.ok(scoreBuildStockMetadata({ title: 'Red fox hunting in snow', description: '', tags: [] }, scene) >
      scoreBuildStockMetadata({ title: 'Aerial evergreen forest at sunrise', description: '', tags: [] }, scene))
    console.log(`COMPARISON MOCK ranking: base=${compared.baseTop} improved=${compared.improvedTop}; search query="${query}"`)

    const varietyVideos = [
      { id: 'fox-primary', title: 'Red fox hunting through deep snow', description: 'A fox hunts in winter snow.',
        tags: ['fox', 'hunting', 'snow'], duration: 12,
        video_files: [{ link: 'https://cdn.test/media/fox-primary.mp4', width: 1280, height: 720 }] },
      { id: 'fox-alternate', title: 'Fox crossing winter woods', description: 'A fox moves through snowy forest.',
        tags: ['fox', 'snow', 'winter', 'forest'], duration: 12,
        video_files: [{ link: 'https://cdn.test/media/fox-alternate.mp4', width: 1280, height: 720 }] },
    ]
    const variety = makeDependencies(fixture, { videos: varietyVideos })
    const varietyInput = (slotId, priorDecisions = []) => ({ buildId: 'same-build-variety', slotId, ...scene,
      durationSeconds: 3, aspectRatio: '16:9', stockCacheDirectory: path.join(fixture, 'variety-cache'),
      outputPath: path.join(fixture, 'variety-output', slotId + '.mp4'),
      projectStockDirectory: path.join(fixture, 'variety-stock'), priorDecisions })
    const firstVariety = await variety.service(varietyInput('variety-1'))
    const secondVariety = await variety.service(varietyInput('variety-2', [firstVariety.decision]))
    assert.equal(firstVariety.decision.selected.id, 'fox-primary')
    assert.equal(secondVariety.decision.selected.id, 'fox-alternate',
      'only the selected source remains reserved for a later slot in the same running build')
    console.log('PASS MOCK same-build variety: second slot selects the unused alternative after the first completes')

    const nasaRelevant = makeDependencies(fixture, { videos: [] })
    await assert.rejects(nasaRelevant.service({ buildId: 'mars-search', slotId: 'mars-slot', keyword: 'Mars rover',
      phrase: 'A Mars rover crosses the red planet', contextBefore: 'Dust covers the tracks', contextAfter: 'Scientists study the landscape',
      durationSeconds: 3, aspectRatio: '16:9', stockCacheDirectory: path.join(fixture, 'mars-cache'),
      outputPath: path.join(fixture, 'mars-output.mp4'), projectStockDirectory: path.join(fixture, 'mars-stock') }), error => {
      assert.equal(error.message, 'STOCK_NO_RESULTS')
      assert.equal(error.stockDecision.providerSearches.find(provider => provider.provider === 'nasa').status, 'ok')
      return true
    })
    assert.equal(nasaRelevant.counts.api.nasa, 1, 'NASA is queried only for a domain-specific Mars scene')

    const { service, counts } = makeDependencies(fixture)
    const outputPath = path.join(fixture, 'materiales', 'originales', 'clip-stock-1.mp4')
    const result = await service({ buildId: 'build-reopen', slotId: 'build-stock-1', ...scene,
      durationSeconds: 3, aspectRatio: '16:9', stockCacheDirectory: path.join(fixture, 'stock-cache'), outputPath,
      projectStockDirectory: path.join(fixture, 'materiales', 'stock') })
    assert.equal(result.decision.schema, BUILD_STOCK_VERSION)
    assert.equal(result.decision.selected.id, 'fox-valid')
    assert.equal(result.decision.crop.validation, 'valid')
    assert.ok(fs.existsSync(outputPath)); assert.equal(result.decision.visualReview.frameCount, 6)
    assert.equal(counts.api.pexels, 1); assert.equal(counts.api.pixabay, 1); assert.equal(counts.api.coverr, 1)
    assert.equal(counts.api.nasa || 0, 0, 'NASA is not queried for wildlife scenes')
    assert.ok(counts.maxConcurrentProviders <= 3 && counts.maxConcurrentProviders >= 2)
    assert.ok(result.decision.providerSearches.some(provider => provider.provider === 'pixabay' && provider.status === 'error'))
    assert.ok(result.decision.providerSearches.some(provider => provider.provider === 'coverr' && /TIMEOUT/.test(provider.error)))
    assert.ok(result.decision.discarded.some(candidate => candidate.id === 'fox-broken'))
    assert.ok(result.decision.discarded.some(candidate => candidate.id === 'fox-short' && candidate.reason === 'CANDIDATE_TOO_SHORT'))
    assert.ok(result.decision.timingsMs.providerSearchMs >= 0 && result.decision.timingsMs.visualInspectionMs >= 0 &&
      result.decision.timingsMs.cropMs >= 0 && result.decision.timingsMs.totalMs >= 0)
    const baseSequentialMockSearchMs = 20 + 10 + 60
    assert.ok(result.decision.timingsMs.providerSearchMs < baseSequentialMockSearchMs,
      'bounded parallel provider search should beat the same mocked sequential waits')
    console.log(`PASS MOCK provider search: maxConcurrent=${counts.maxConcurrentProviders}; errors=Pixabay/ Coverr-timeout; NASA skipped; ` +
      `base sequential mock=${baseSequentialMockSearchMs}ms, parallel=${result.decision.timingsMs.providerSearchMs}ms; ` +
      `stageMs=${JSON.stringify(result.decision.timingsMs)}; Codex mock calls=${counts.codexCalls.length}`)

    const relevanceFallback = makeDependencies(fixture, { videos: [
      { id: 'mars-poor', title: 'Mars rover red planet exploration', description: 'Rover vehicle on Mars.', tags: ['mars', 'rover', 'red', 'planet'], duration: 12,
        video_files: [{ link: 'https://cdn.test/media/mars-poor.mp4', width: 1280, height: 720 }] },
      { id: 'rover-good', title: 'Mars rover crossing the red planet surface', description: 'Rover moves on the Mars surface.', tags: ['mars', 'rover', 'red', 'planet'], duration: 12,
        video_files: [{ link: 'https://cdn.test/media/rover-good.mp4', width: 1280, height: 720 }] },
    ], visualFinalists: 1 })
    const relevantResult = await relevanceFallback.service({ buildId: 'relevance-fallback', slotId: 'stock-relevance-fallback', ...scene,
      durationSeconds: 3, aspectRatio: '16:9', stockCacheDirectory: path.join(fixture, 'relevance-cache'),
      outputPath: path.join(fixture, 'relevance-output.mp4'), projectStockDirectory: path.join(fixture, 'relevance-stock') })
    assert.equal(relevantResult.decision.selected.id, 'rover-good')
    assert.equal(relevantResult.decision.discarded.find(item => item.id === 'mars-poor').reason, 'VISUAL_RELEVANCE_BELOW_MINIMUM')
    assert.equal(BUILD_STOCK_MIN_VISUAL_FIT, 40)
    console.log('PASS MOCK visual rejection: unrelated first candidate (4/100) discarded; next relevant candidate selected')

    // Persist and reload the montage decision, then run a fresh service instance as after app restart.
    const completedSlot = { id: 'build-stock-1', category: 'stock', requestedSource: 'stock',
      buildPlan: { buildId: 'build-reopen' }, stockDecision: result.decision,
      materialized: true, mediaBuild: { status: 'ready' }, path: outputPath }
    persistence.createProjectFiles(fixture, { timelineVideoClips: [completedSlot] })
    const reopened = persistence.loadProjectFile(path.join(fixture, 'project-state.json')).state.timelineVideoClips[0]
    assert.equal(reopened.stockDecision.selected.id, 'fox-valid')
    const alternateFox = { id: 'fox-alternate', title: 'Red fox hunting through powder snow in a pine forest',
      description: 'A fox stalks prey through winter snow beside pine trees.', tags: ['fox', 'hunting', 'snow', 'winter', 'forest'], duration: 12,
      video_files: [{ link: 'https://cdn.test/media/fox-alternate.mp4', width: 1280, height: 720 }] }
    const resumed = makeDependencies(fixture, { videos: [candidates.find(video => video.id === 'fox-valid'), alternateFox] }).service
    const retry = await resumed({ buildId: 'build-reopen', slotId: 'build-stock-2', ...scene,
      durationSeconds: 3, aspectRatio: '16:9', stockCacheDirectory: path.join(fixture, 'stock-cache'),
      outputPath: path.join(fixture, 'materiales', 'originales', 'clip-stock-2.mp4'),
      projectStockDirectory: path.join(fixture, 'materiales', 'stock'),
      priorDecisions: [reopened.stockDecision] })
    assert.equal(retry.decision.selected.id, 'fox-alternate')
    assert.ok(retry.decision.discarded.some(candidate => candidate.id === 'fox-valid' &&
      candidate.reason === 'PREVIOUSLY_SELECTED_IN_THIS_BUILD'))
    console.log(`PASS persistence/reopen: prior=${reopened.stockDecision.selected.id} next=${retry.decision.selected.id}`)

    const failedSearch = makeDependencies(fixture, { videos: [
      { id: 'only-corrupt', title: 'Red fox hunting in snow', tags: ['fox', 'hunting', 'snow'], duration: 8,
        video_files: [{ link: 'https://cdn.test/media/fox-broken.mp4', width: 1280, height: 720 }] },
      { id: 'only-short', title: 'Red fox hunting through winter snow', tags: ['fox', 'snow'], duration: 2,
        video_files: [{ link: 'https://cdn.test/media/fox-short.mp4', width: 1280, height: 720 }] },
    ] })
    const failedSlot = pendingBuildSlot({ id: 'build-' + randomUUID(), buildId: 'failure-build', index: 1, total: 1,
      source: 'stock', startSeconds: 0, durationSeconds: 3, transcriptText: scene.phrase, keyword: scene.keyword,
      prompt: 'A fox hunting in snow', contextBefore: scene.contextBefore, contextAfter: scene.contextAfter })
    let failedClips = [failedSlot]
    const existingState = persistence.loadProjectFile(path.join(fixture, 'project-state.json')).state
    await runCommonMediaQueue({ getClips: () => failedClips, onClips: next => { failedClips = next },
      isCurrent: () => true, isCancelled: () => false,
      persist: async next => persistence.saveProjectFile(path.join(fixture, 'project-state.json'),
        { timelineVideoClips: [...existingState.timelineVideoClips, ...next] }),
      dispatch: async slot => failedSearch.service({ buildId: slot.buildPlan.buildId, slotId: slot.id, keyword: slot.buildPlan.keyword,
        phrase: slot.transcriptText, contextBefore: slot.buildPlan.contextBefore, contextAfter: slot.buildPlan.contextAfter,
        durationSeconds: slot.durationSeconds, aspectRatio: '16:9', stockCacheDirectory: path.join(fixture, 'invalid-cache'),
        outputPath: path.join(fixture, 'invalid-output', slot.id + '.mp4'), projectStockDirectory: path.join(fixture, 'invalid-stock') })
    })
    assert.equal(failedClips[0].category, 'stock'); assert.equal(failedClips[0].requestedSource, 'stock')
    assert.equal(failedClips[0].mediaBuild.status, 'error')
    assert.ok(failedClips[0].stockDecision.discarded.some(candidate => candidate.reason === 'CANDIDATE_TOO_SHORT'))
    assert.ok(failedClips[0].stockDecision.discarded.some(candidate => candidate.stage === 'download-validation'))
    const failedAfterReopen = persistence.loadProjectFile(path.join(fixture, 'project-state.json')).state.timelineVideoClips
      .find(clip => clip.id === failedSlot.id)
    assert.equal(failedAfterReopen.category, 'stock'); assert.equal(failedAfterReopen.stockDecision.schema, BUILD_STOCK_VERSION)
    console.log('PASS failure diagnostics persist through the shared queue and project reopen; slot remains pending Stock')

    // Different montage jobs requesting the same asset share one in-flight download.
    let sharedVideos = [{ id: 'shared-ocean', title: 'Coral reef sea turtle swimming',
      description: 'Sea turtle swims over coral reef.', tags: ['coral', 'reef', 'turtle'], duration: 12,
      video_files: [{ link: 'https://cdn.test/media/shared-ocean.mp4', width: 1280, height: 720 }] }]
    const shared = makeDependencies(fixture, { videos: sharedVideos, downloadDelay: 35 })
    const makeInput = (buildId, slotId) => ({ buildId, slotId, keyword: 'sea turtle reef',
      phrase: 'A sea turtle swims above a coral reef', contextBefore: 'Warm clear water', contextAfter: 'Fish move nearby.',
      durationSeconds: 3, aspectRatio: '16:9', stockCacheDirectory: path.join(fixture, 'shared-cache'),
      outputPath: path.join(fixture, 'shared-output', `${slotId}.mp4`), projectStockDirectory: path.join(fixture, 'shared-stock') })
    const concurrent = await Promise.all([shared.service(makeInput('parallel-a', 'slot-a')),
      shared.service(makeInput('parallel-b', 'slot-b'))])
    assert.equal(shared.counts.downloads['shared-ocean'], 1)
    assert.ok(concurrent.every(item => item.decision.selected.id === 'shared-ocean'))
    console.log('PASS MOCK concurrent downloads share one validated in-flight cache write')

    const weightsAtZero = allocateBuildSources([100, 0, 0, 0], 4)
    assert.equal(weightsAtZero.filter(source => source === 'stock').length, 0)
    let zeroStockDispatches = 0
    const zeroSlots = weightsAtZero.map((source, index) => pendingBuildSlot({ id: `build-${randomUUID()}`,
      buildId: 'zero-stock', index: index + 1, total: 4, source, startSeconds: index * 3, durationSeconds: 3,
      transcriptText: 'scene', keyword: 'fox', prompt: 'fox' }))
    await runCommonMediaQueue({ getClips: () => zeroSlots, persist: async () => {}, onClips: () => {},
      isCurrent: () => true, isCancelled: () => false,
      dispatch: async slot => { if (slot.category === 'stock') zeroStockDispatches++; return { ...slot, materialized: true,
        path: 'fixture.mp4', requestedSource: slot.requestedSource, mediaBuild: { status: 'ready' } } } })
    assert.equal(zeroStockDispatches, 0)
    const weightsAtHundred = allocateBuildSources([0, 100, 0, 0], 4)
    assert.deepEqual(weightsAtHundred, ['stock', 'stock', 'stock', 'stock'])
    assert.ok(result.decision.selected.provider && result.decision.candidates.length > 0)
    console.log('PASS quotas: Stock 0% dispatches no Stock slots; Stock 100% assigns all four slots to Stock')
    console.log('REAL SEARCHES=0 CODEX MODEL CALLS=0; all provider and frame-inspection responses above are controlled mocks.')
  } finally { cleanupTestFixture(fixture) }
}

run().catch(error => { console.error(error); process.exitCode = 1 })
