'use strict'
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const ts = require('typescript')
const { randomUUID } = require('node:crypto')
const { createTestFixture, cleanupTestFixture } = require('./helpers/safe-fixture')
const root = path.resolve(__dirname, '..')
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file)
const integrity = require('../src/shared/build-integrity.ts')
const { repartoObjetivos, repartirPesos } = require('../src/shared/reparto.ts')
const { hayTiemposPorPalabra } = require('../src/shared/palabra.ts')
const buildPlanning = require('../src/shared/build-planning.ts')
const { validateControlAdapterJob } = require('../src/shared/control-adapter.ts')
const { createBuildPlanner } = require('../src/main/services/build-planner.ts')
const persistence = require('../src/main/services/project-persistence.ts')
const ffmpeg = require('../src/main/services/ffmpeg.ts')
const source = fs.readFileSync(path.join(root, 'src/main/index.ts'), 'utf8')
const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true)
// Execute AST-extracted production functions/IPC callbacks with injected providers.
// No copied algorithm and no application bootstrap, credentials or network.
function productionFunction(name, context, tree = ast) {
  const node = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
  assert.ok(node, name)
  return vm.runInNewContext(ts.transpileModule(node.getText(tree) + '\n' + name,
    { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context)
}
function productionHandler(channel, context) {
  let callback
  function visit(node) {
    if (ts.isCallExpression(node) && node.arguments[0]?.text === channel) callback = node.arguments[1]
    ts.forEachChild(node, visit)
  }
  visit(ast); assert.ok(callback, channel)
  return vm.runInNewContext(ts.transpileModule('(' + callback.getText(ast) + ')',
    { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context)
}
function productionBinding(name, context, tree) {
  let expression
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) expression = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(tree); assert.ok(expression, name)
  return vm.runInNewContext(ts.transpileModule('(' + expression.getText(tree) + ')',
    { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context)
}
const makeSlot = (source, index = 0) => integrity.pendingBuildSlot({ id: 'build-' + randomUUID(),
  buildId: 'test', index: index + 1, total: 3, source, startSeconds: index * 3, durationSeconds: 3,
  transcriptText: `text ${index}`, keyword: 'forest', prompt: 'A forest moving in the wind', timestamp: 20 })
const success = slot => ({ ...slot, materialized: true, path: '/fixture/' + slot.id + '.mp4', mediaBuild: { status: 'ready' } })

async function run() {
  let combinations = 0
  for (let a = 0; a <= 100; a += 5) for (let b = 0; b <= 100 - a; b += 5)
    for (let c = 0; c <= 100 - a - b; c += 5) for (const n of [1, 3, 6, 20]) {
      const weights = [a, b, c, 100 - a - b - c]
      const counts = Object.values(repartoObjetivos(weights, n))
      assert.equal(counts.reduce((s, v) => s + v, 0), n)
      counts.forEach((v, i) => { assert.ok(Number.isInteger(v) && v >= 0); if (!weights[i]) assert.equal(v, 0) })
      const dispatched = integrity.allocateBuildSources(weights, n)
      integrity.BUILD_SOURCES.forEach((s, i) => assert.equal(dispatched.filter(x => x === s).length, counts[i]))
      assert.deepEqual(dispatched, integrity.allocateBuildSources(weights, n)); combinations++
    }
  assert.deepEqual(repartoObjetivos([0, 0, 50, 50], 3), { original: 0, stock: 0, ia: 2, visual: 1 })
  assert.throws(() => repartoObjetivos([0, 0, 0, 0], 3), /WEIGHTS_EMPTY/)
  const timedScript = buildPlanning.createTimedScriptSegments('A forest grows. Birds return.', 6)
  assert.equal(timedScript[0].start, 0); assert.equal(timedScript.at(-1).end, 6)
  assert.ok(timedScript.every(segment => segment.words?.length && segment.words.every(word => word.end > word.start)))
  const timedVisuals = buildPlanning.createAnimationSlotsFromSegments(timedScript, 6)
  assert.equal(timedVisuals.length, 2); assert.ok(timedVisuals.every(slot => slot.animationSlot && slot.words.length))
  const noNarrationJob = { schemaVersion: 1, operationId: randomUUID(), attemptId: randomUUID(), projectId: randomUUID(), kind: 'build',
    settings: { scriptText: 'A script.', weights: [0,100,0,0], graphicsPercent: 0, transitionsPercent: 0,
      voice: { mode: 'none' }, buildDurationSeconds: 30 } }
  assert.equal(validateControlAdapterJob(noNarrationJob).settings.voice.mode, 'none')
  assert.throws(() => validateControlAdapterJob({ ...noNarrationJob, settings: { ...noNarrationJob.settings, buildDurationSeconds: undefined } }), /BUILD_DURATION_REQUIRED/)
  assert.throws(() => validateControlAdapterJob({ ...noNarrationJob, sourceRelativePath: undefined,
    settings: { ...noNarrationJob.settings, voice: { mode: 'original' }, buildDurationSeconds: undefined } }), /SOURCE_AUDIO_UNAVAILABLE|CONTROL_SOURCE_REQUIRED/)
  console.log('PASS script-only duration, word timing, Animation windows and Control no-source contract')
  const codexCalls = []
  const batchedPlanner = createBuildPlanner({ complete: async request => {
    codexCalls.push(request)
    request.onProgress?.({ phase: 'thinking', message: 'mock Codex' })
    const segments = request.prompt.match(/\[Frase \d+\]/g) || []
    return { text: JSON.stringify({ phrases: segments.map((_segment, index) => ({ phraseIndex: index + 1,
      visualClips: [{ keyword: 'forest birds', prompt: 'Birds returning to a forest', timestamp: 0 }] })) }), model: 'mock Codex' }
  } })
  const batchedSegments = Array.from({ length: 7 }, (_value, index) => ({ start: index, end: index + 1, text: `segment ${index + 1}` }))
  const codexPlan = await batchedPlanner({ scriptText: 'forest', segments: batchedSegments, durationSeconds: 7,
    sourceDurationSeconds: 7, weights: [0,100,0,0] })
  assert.deepEqual(codexCalls.map(call => (call.prompt.match(/\[Frase \d+\]/g) || []).length), [6,1])
  assert.ok(codexCalls.every(call => call.purpose === 'build-planner' && call.outputSchema === buildPlanning.BUILD_PLANNER_OUTPUT_SCHEMA))
  assert.deepEqual(codexPlan.phrases.map(phrase => phrase.phraseIndex), [1,2,3,4,5,6,7])
  assert.equal(codexPlan.provider, 'codex-app-server'); assert.equal(codexPlan.model, 'mock Codex')
  let codexFailures = 0
  await assert.rejects(createBuildPlanner({ complete: async () => { codexFailures++; throw new Error('ANIMATION_CODEX_LOGIN_REQUIRED') } })(
    { scriptText: 'forest', segments: batchedSegments.slice(0,1), durationSeconds: 1, sourceDurationSeconds: 1, weights: [0,100,0,0] }), /BUILD_CODEX_FAILED/)
  assert.equal(codexFailures, 1)
  console.log('PASS Codex planner batches, strict schema, ordered output and fail-closed provider errors')
  for (let i = 0; i < 4; i++) for (let v = 0; v <= 100; v++)
    assert.equal(repartirPesos([0, 0, 50, 50], i, v).reduce((a, b) => a + b, 0), 100)
  console.log(`PASS allocation: ${combinations} plans, pure modes, zeros, exact count and deterministic dispatch`)

  assert.equal(integrity.resolveAudioProvenance({ name: 'Voz - Audio Original' }).origin, 'unknown')
  assert.equal(integrity.resolveAudioProvenance({ path: '/voice' }, [{ id: 'v', model: 'm', filePath: '/voice' }]).origin, 'generated')
  const fixture = createTestFixture('build-integrity')
  try {
    const audio = { id: 'audio', type: 'audio', audioProvenance: { origin: 'generated', voiceId: 'v' }, narrationSegments: [{ start: 0, end: 3, text: 'a' }] }
    const stock = makeSlot('stock', 1), visual = makeSlot('visual'), done = success(makeSlot('original', 2))
    persistence.createProjectFiles(fixture, { timelineVideoClips: [visual, stock, done, audio] })
    let clips = persistence.loadProjectFile(path.join(fixture, 'project-state.json')).state.timelineVideoClips
    assert.deepEqual(clips[3], audio)
    const originalDone = JSON.stringify(done), visualBefore = JSON.stringify(visual)
    const calls = [], saves = []
    let fail = true
    const options = { getClips: () => clips, onClips: x => { clips = x }, isCurrent: () => true, isCancelled: () => false,
      persist: async next => { saves.push(structuredClone(next)); persistence.saveProjectFile(path.join(fixture, 'project-state.json'), { timelineVideoClips: next }) },
      dispatch: async slot => { calls.push(slot.id); if (fail) throw new Error('STOCK_OFFLINE'); return success(slot) } }
    await integrity.runCommonMediaQueue(options)
    assert.equal(clips[1].category, 'stock'); assert.equal(clips[1].transcriptText, stock.transcriptText)
    assert.equal(clips[1].id, stock.id); assert.equal(clips[1].startSeconds, 3)
    assert.equal(clips[1].mediaBuild.error, 'STOCK_OFFLINE'); assert.equal(clips[1].animationPending, undefined)
    assert.equal(JSON.stringify(clips[0]), visualBefore); assert.equal(JSON.stringify(clips[2]), originalDone)
    assert.equal(saves[0][1].mediaBuild.status, 'preparing')
    clips = persistence.loadProjectFile(path.join(fixture, 'project-state.json')).state.timelineVideoClips
    fail = false; await integrity.runCommonMediaQueue(options); await integrity.runCommonMediaQueue(options)
    assert.deepEqual(calls, [stock.id, stock.id]); assert.equal(clips[1].mediaBuild.status, 'ready')
    assert.equal(integrity.buildSummary(clips).ready, false)
    assert.equal(integrity.requiredMediaPending({ ...stock, path: '/fake', materialized: false }), true)
    console.log('PASS persistence, own failed slot next to Animation, retry only unfinished, completion/export gate')

    for (const weights of [[100,0,0,0], [0,100,0,0], [0,0,100,0], [0,0,0,100], [0,0,50,50]]) {
      clips = integrity.allocateBuildSources(weights, 3).map((s, i) => makeSlot(s, i))
      const sources = []
      await integrity.runCommonMediaQueue({ ...options, dispatch: async slot => { sources.push(slot.category); throw new Error('FAILED') } })
      sources.forEach(s => assert.ok(weights[integrity.BUILD_SOURCES.indexOf(s)] > 0))
      assert.ok(clips.every(c => c.category === c.buildPlan.source && c.materialized === false))
    }
    clips = Array.from({ length: 6 }, (_, i) => makeSlot('stock', i))
    let cancelled = false, active = 0, peak = 0, count = 0
    await integrity.runCommonMediaQueue({ ...options, isCancelled: () => cancelled, dispatch: async slot => {
      count++; active++; peak = Math.max(active, peak); await new Promise(r => setTimeout(r, 5)); active--; cancelled = true; return success(slot)
    } })
    assert.ok(peak <= 3); assert.ok(count <= 3); assert.ok(clips.some(integrity.isPendingCommonSlot))
    clips = [makeSlot('ia')]; let current = true
    await assert.rejects(integrity.runCommonMediaQueue({ ...options, isCurrent: () => current,
      dispatch: async slot => { current = false; return success(slot) } }), /PROJECT_CHANGED/)
    assert.equal(clips[0].materialized, false)
    clips = [makeSlot('stock')]; let dispatched = false
    await assert.rejects(integrity.runCommonMediaQueue({ ...options, persist: async () => { throw new Error('DISK_FULL') },
      dispatch: async slot => { dispatched = true; return success(slot) } }), /DISK_FULL/)
    assert.equal(dispatched, false)
    // A failed save must not release the build lock while sibling providers still run.
    clips = Array.from({ length: 5 }, (_, i) => makeSlot('stock', i))
    const releases = []
    let settled = false
    const draining = integrity.runCommonMediaQueue({ ...options,
      persist: async next => {
        if (next.some(c => c.mediaBuild?.status === 'ready')) throw new Error('DISK_FULL_AFTER_PROVIDER')
      },
      dispatch: slot => new Promise(resolve => releases.push(() => resolve(success(slot))))
    }).then(() => { settled = true }, error => { settled = true; return error })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(releases.length, 3)
    releases[0]()
    await new Promise(resolve => setImmediate(resolve))
    const releasedTooEarly = settled
    releases[1](); releases[2]()
    const drainError = await draining
    assert.equal(releasedTooEarly, false, 'wait for all active providers before releasing the build')
    assert.match(drainError.message, /DISK_FULL_AFTER_PROVIDER/)
    assert.equal(releases.length, 3, 'failed save stops dispatch of remaining slots')
    assert.ok(clips.every(integrity.isPendingCommonSlot))
    console.log('PASS failed save drains active providers before a new build may start')
    clips = [makeSlot('stock')]
    await integrity.runCommonMediaQueue({ ...options, dispatch: async slot => {
      clips = [{ ...clips[0], startSeconds: 99 }]; return success(slot)
    } })
    assert.equal(clips[0].startSeconds, 99); assert.equal(clips[0].materialized, false)
    console.log('PASS zero-source provider mocks, bounded concurrency, cancellation, project/slot changes and failed save')

    const rendererAst = ts.createSourceFile('main.tsx', fs.readFileSync(path.join(root, 'src/renderer/src/main.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    for (const change of ['project', 'version']) {
      let animationCalls = 0, finishCalls = 0
      const projectRef = { current: fixture }, versionRef = { current: 'v1' }
      const timeline = [makeSlot('visual')]
      const rendererContext = { ...integrity,
        animationBuildInFlightRef: { current: false }, animationBuildCancellationRef: { current: {} },
        activeProjectPathRef: projectRef, activeVersionIdRef: versionRef, activeVersionId: 'v1',
        isGeneratingAssets: false, timelineVideoClips: timeline, timelineVideoClipsRef: { current: timeline },
        window: { electronAPI: { inspectBuildMedia: async () => ({ success: true, invalidIds: [] }) } },
        isPendingAnimationSlot: c => c.animationPending === true,
        setAnimationBuildSummary() {}, setGenerationError() {}, setIsGeneratingAssets() {},
        setIsBuildingAnimationQueue() {}, setGenerationProgress() {},
        continueCommonBuild: async () => { if (change === 'project') projectRef.current = '/other'; else versionRef.current = 'v2' },
        continuePendingAnimationBuild: async () => { animationCalls++ }, finishBuild: async () => { finishCalls++ }
      }
      await productionBinding('handleBuildIATimeline', rendererContext, rendererAst)()
      assert.equal(animationCalls, 0, `do not start Animation after changing ${change}`)
      assert.equal(finishCalls, 0)
      let presented = false
      projectRef.current = fixture; versionRef.current = 'v1'
      const finishContext = { ...rendererContext, timelineVersions: [], persistBuildTimeline: async () => {},
        window: { electronAPI: { inspectBuildMedia: async () => {
          if (change === 'project') projectRef.current = '/other'; else versionRef.current = 'v2'
          return { success: true, invalidIds: [] }
        } } },
        setResumen: () => { presented = true }, pushMilestone: () => { presented = true }
      }
      await assert.rejects(productionBinding('finishBuild', finishContext, rendererAst)(fixture), /BUILD_PROJECT_CHANGED/)
      assert.equal(presented, false)
    }
    console.log('PASS actual Studio flow: project/version changes stop Animation and stale completion summaries')

    // Exercise the actual planner callback with identical segment arrays for both audio origins.
    const warnings = require('../src/shared/avisos.ts')
    let deepSeekRequests = 0, failPlanning = false, waitForPlannerCancel = false
    const activeBuildPlannerJobs = new Map()
    const context = { ...integrity, ...warnings, ...buildPlanning, repartoObjetivos, randomUUID, hayTiemposPorPalabra,
      AbortController, activeBuildPlannerJobs, process: { env: {} }, console: { log() {}, error() {} },
      writeDebugLog: async () => {}, enviarAviso() {}, loadEnv() {}, exists: async () => true, getVideoDuration: async () => 60,
      fetch: async () => { deepSeekRequests++; throw new Error('DEEPSEEK_MUST_NOT_BE_CALLED') },
      planBuildWithCodex: async input => {
        if (failPlanning) throw new Error('BUILD_CODEX_OFFLINE')
        input.onProgress?.({ index: 0, total: input.segments.length, message: 'mock plan' })
        if (waitForPlannerCancel) await new Promise((_resolve, reject) => input.signal.addEventListener('abort',
          () => reject(new Error('BUILD_CODEX_CANCELLED')), { once: true }))
        return { provider: 'codex-app-server', model: 'mock Codex', phrases: input.segments.map((segment, index) => ({
          phraseIndex: index + 1, visualClips: Array.from({ length: buildPlanning.buildPlannerPhraseCount(segment) }, () => ({
            keyword: 'forest wildlife', prompt: 'A close view of birds returning to a green forest', timestamp: 23,
          }))
        })) }
      } }
    const planner = productionHandler('generate-timeline-assets', context)
    const segments = [{ start: 0, end: 3, text: 'forest', words: [{ word: ' forest', start: 0, end: 3 }], animationSlot: true }]
    const input = { scriptText: 'forest', audioDuration: 3, transcriptSegments: segments, newAudioSegments: segments,
      videoPath: '/synthetic', weights: [100,0,0,0], segmentProvenance: { source: 'source-transcript', narration: 'generated' }, audioProvenance: { origin: 'generated' } }
    const event = { sender: { id: 7, send() {}, isDestroyed: () => false } }
    const generated = await planner(event, input)
    assert.equal(generated.success, true, generated.error); assert.equal(generated.clips[0].buildPlan.timestamp, 23)
    const original = await planner(event, { ...input, audioProvenance: { origin: 'original' }, segmentProvenance: { ...input.segmentProvenance, narration: 'original' } })
    assert.equal(original.success, true, original.error); assert.equal(original.clips[0].buildPlan.timestamp, 0)
    assert.equal((await planner(event, { ...input, audioProvenance: undefined })).success, false)
    const visualPlan = await planner(event, { ...input, weights: [0,0,0,100] })
    assert.equal(visualPlan.clips[0].category, 'visual'); assert.equal(visualPlan.clips[0].animationPending, true)
    const noVoice = await planner(event, { scriptText: 'A forest grows. Birds return.', buildDurationSeconds: 6,
      weights: [0,100,0,0], audioProvenance: { origin: 'none' } })
    assert.equal(noVoice.success, true, noVoice.error); assert.equal(noVoice.clips.length, 2)
    assert.ok(noVoice.clips.every(clip => clip.category === 'stock' && clip.buildPlan.audioProvenance.origin === 'none' && !clip.buildPlan.videoPath))
    const noVoiceIA = await planner(event, { scriptText: 'A forest grows. Birds return.', buildDurationSeconds: 6,
      weights: [0,0,100,0], audioProvenance: { origin: 'none' } })
    assert.equal(noVoiceIA.success, true, noVoiceIA.error)
    assert.ok(noVoiceIA.clips.every(clip => clip.category === 'ia' && !clip.buildPlan.videoPath))
    const noVoiceOriginal = await planner(event, { scriptText: 'A forest grows. Birds return.', buildDurationSeconds: 6,
      videoPath: '/synthetic-source.mp4', weights: [100,0,0,0], audioProvenance: { origin: 'none' } })
    assert.equal(noVoiceOriginal.success, true, noVoiceOriginal.error)
    assert.ok(noVoiceOriginal.clips.every(clip => clip.category === 'original' && clip.buildPlan.videoPath === '/synthetic-source.mp4'))
    const noVoiceVisuals = await planner(event, { scriptText: 'A forest grows. Birds return.', buildDurationSeconds: 6,
      weights: [0,0,0,100], audioProvenance: { origin: 'none' } })
    assert.equal(noVoiceVisuals.success, true, noVoiceVisuals.error); assert.equal(noVoiceVisuals.clips.length, 2)
    assert.ok(noVoiceVisuals.clips.every(clip => clip.category === 'visual' && clip.animationPending))
    assert.equal((await planner(event, { ...input, videoPath: undefined })).error, 'BUILD_ORIGINAL_SOURCE_REQUIRED')
    failPlanning = true
    const failedPlanner = await planner(event, { ...input, weights: [0,100,0,0], videoPath: undefined })
    assert.equal(failedPlanner.success, false); assert.match(failedPlanner.error, /BUILD_CODEX_OFFLINE/)
    failPlanning = false; waitForPlannerCancel = true
    const cancellation = planner(event, { ...input, weights: [0,100,0,0], videoPath: undefined })
    await new Promise(resolve => setImmediate(resolve))
    activeBuildPlannerJobs.get(event.sender.id).abort()
    const cancelledPlanner = await cancellation
    assert.equal(cancelledPlanner.success, false); assert.equal(cancelledPlanner.error, 'BUILD_CODEX_CANCELLED')
    waitForPlannerCancel = false
    assert.equal(deepSeekRequests, 0, 'Build never falls back to DeepSeek')
    console.log('PASS actual planner: explicit audio provenance, script-only timing/Animation, source gates and no DeepSeek fallback')

    // Exercise the extracted real worker: provider failures never enter Original/FFmpeg.
    let originalCommands = 0, stockRequests = 0
    const workerContext = { fs, path, Buffer, ...ffmpeg, buildStockUsage: new Map(),
      dirMat: (r, d) => path.join(r, 'materiales', d), dirCache: (r, d) => path.join(r, 'cache', d),
      getBancoClipsPath: () => path.join(fixture, 'bank'), writeDebugLog: async () => {}, process: { env: {} },
      isVerticalAspectRatioV1: () => false, stockCoverFilter: () => '', urlDeRuta: x => require('node:url').pathToFileURL(x).href,
      exists: async p => fs.existsSync(p), exec: () => { originalCommands++; throw new Error('UNEXPECTED_ORIGINAL') },
      fal: { subscribe: async () => { throw new Error('IA_OFFLINE') } },
      fetch: async () => { stockRequests++; return { ok: true, json: async () => ({ collection: { items: [] } }) } } }
    const worker = productionFunction('materializeBuildSlot', workerContext)
    await assert.rejects(worker(event, makeSlot('ia'), fixture), /IA_FAILED/)
    await assert.rejects(worker(event, makeSlot('stock'), fixture), /STOCK_FAILED/)
    assert.equal(originalCommands, 0); assert.ok(stockRequests > 0)
    // A small synthetic source verifies the same worker with real FFmpeg/ffprobe, no user media.
    const cp = require('node:child_process'), sourcePath = path.join(fixture, 'source.mp4')
    cp.execFileSync('ffmpeg', ['-v','error','-y','-f','lavfi','-i','color=c=blue:s=160x90:r=30','-t','4','-c:v','libx264',sourcePath])
    workerContext.exec = cp.exec
    const realSlot = makeSlot('original'); realSlot.buildPlan.videoPath = sourcePath; realSlot.buildPlan.timestamp = 0
    const real = await productionFunction('materializeBuildSlot', workerContext)(event, realSlot, fixture)
    assert.equal(real.id, realSlot.id); assert.equal(real.durationSeconds, 3); assert.ok(fs.statSync(real.path).size > 0)
    assert.ok(await ffmpeg.getVideoDuration(real.path) >= 3)
    console.log('PASS actual worker failure isolation and synthetic Original MP4, duration and identity')
    let providerRuns = 0
    persistence.saveProjectFile(path.join(fixture, 'project-state.json'), { timelineVideoClips: [realSlot] })
    const retryContext = { ...workerContext, ...integrity, ...persistence, randomUUID,
      activeProjectPath: fixture, loadEnv() {}, buildMediaJobs: new Map(),
      materializeBuildSlot: async () => { providerRuns++; return real } }
    const retry = productionHandler('retry-timeline-asset', retryContext)
    const request = { projectPath: fixture, clip: realSlot }
    const initialResults = await Promise.all([retry(event, request), retry(event, request)])
    assert.ok(initialResults.every(x => x.success)); assert.equal(providerRuns, 1)
    const recovered = await retry(event, request)
    assert.equal(recovered.success, true); assert.equal(recovered.clip.id, realSlot.id); assert.equal(providerRuns, 1)
    assert.equal((await retry(event, { ...request, projectPath: '/another-project' })).success, false)
    assert.equal((await retry(event, { ...request, clip: { ...realSlot, durationSeconds: 5 } })).success, false)
    const inspect = productionHandler('inspect-build-media', retryContext)
    const inspected = await inspect(event, { projectPath: fixture, clips: [{ ...real, path: '/missing-synthetic-file' }] })
    assert.deepEqual(Array.from(inspected.invalidIds), [realSlot.id])
    const exportHandler = productionHandler('export-video', { ...integrity, exists: async () => false })
    assert.equal((await exportHandler(event, { clips: [makeSlot('stock')] })).success, false)
    console.log('PASS actual IPC: concurrent retry deduplication, persisted receipt recovery, stale project/slot and export rejection')
    const controlAst = ts.createSourceFile('control.tsx', fs.readFileSync(path.join(root, 'src/renderer/src/control-adapter.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const controlSlots = [makeSlot('stock'), makeSlot('stock', 1)]
    const oldVersion = { id: 'old', timelineVideoClips: [done] }
    let controlState = { clips: [{ type: 'video', path: sourcePath, durationSeconds: 6 }],
      transcriptSegments: [{ start: 0, end: 6, text: 'forest' }], timelineVersions: [oldVersion], activeVersionId: 'old' }
    let planned = 0, cut = 0, attempts = [], controlPlans = []
    let failSecond = true
    const controlApi = { loadProjectState: async () => ({ success: true, data: structuredClone(controlState) }),
      animationSaveBuildState: async input => { controlState = structuredClone(input.projectState); return { success: true } },
      generateTimelineAssets: async input => {
        controlPlans.push(input); planned++
        if (input.audioProvenance.origin === 'none') return { success: true, clips: [makeSlot('stock')] }
        assert.equal(input.audioProvenance.origin, 'original'); return { success: true, clips: controlSlots }
      },
      cutVideoClips: async () => { cut++; return { success: true } },
      retryTimelineAsset: async input => { attempts.push(input.clip.id); return failSecond && input.clip.id === controlSlots[1].id
        ? { success: false, error: 'OFFLINE' } : { success: true, clip: success(input.clip) } },
      inspectBuildMedia: async () => ({ success: true, invalidIds: [] }) }
    const controlContext = { ...integrity, ...buildPlanning, api: controlApi, emit() {}, assignCipherTransitions: () => ({}), CIPHER_DEFAULT_TRANSITIONS: [] }
    controlContext.audioClip = productionFunction('audioClip', controlContext, controlAst)
    const runControl = productionFunction('run', controlContext, controlAst)
    const job = { kind: 'build', operationId: 'op', attemptId: 'attempt1', projectId: 'project', settings: {
      scriptText: 'forest', weights: [0,100,0,0], graphicsPercent: 0, transitionsPercent: 0,
      voice: { mode: 'original' }, sourceHasAudio: true } }
    await assert.rejects(runControl(job, sourcePath, fixture), /BUILD_MEDIA_PENDING/)
    assert.equal(controlState.activeVersionId, 'control-attempt1')
    assert.deepEqual(controlState.timelineVersions[0], oldVersion)
    assert.equal(controlState.timelineVersions[1].timelineVideoClips[1].mediaBuild.status, 'error')
    failSecond = false
    const controlResult = await runControl({ ...job, attemptId: 'attempt2' }, sourcePath, fixture)
    assert.equal(controlResult.timelineVersionId, 'control-attempt1'); assert.equal(planned, 1); assert.equal(cut, 0)
    assert.deepEqual(attempts, [controlSlots[0].id, controlSlots[1].id, controlSlots[1].id])
    assert.equal(controlState.timelineVersions.length, 2)
    await runControl({ ...job, attemptId: 'attempt3' }, sourcePath, fixture)
    assert.equal(attempts.length, 3); assert.deepEqual(controlState.timelineVersions[0], oldVersion)
    controlState = { clips: [], transcriptSegments: [], timelineVersions: [], activeVersionId: 'v-empty' }
    const noVoiceJob = { ...job, operationId: 'op-no-voice', attemptId: 'attempt-no-voice', settings: { ...job.settings,
      weights: [0,100,0,0], voice: { mode: 'none' }, sourceHasAudio: false, buildDurationSeconds: 6 } }
    const noVoiceResult = await runControl(noVoiceJob, '', fixture)
    const noVoicePlan = controlPlans.at(-1)
    assert.equal(noVoiceResult.clipCount, 1); assert.equal(noVoicePlan.audioProvenance.origin, 'none')
    assert.equal(noVoicePlan.buildDurationSeconds, 6); assert.equal(noVoicePlan.videoPath, undefined)
    assert.equal(controlState.buildDurationSeconds, 6)
    assert.ok(controlState.timelineVideoClips.every(clip => clip.type !== 'audio'))
    console.log('PASS actual Control adapter: persisted version, no zero-source cut, retry only pending and completed operation reuse')



    const animationSource = fs.readFileSync(path.join(root, 'src/main/services/animation-integration.ts'), 'utf8')
    const animationAst = ts.createSourceFile('animation.ts', animationSource, ts.ScriptTarget.Latest, true)
    const fn = animationAst.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'generateAnimationDraft')
    let clock = 0
    const records = []
    const codeModule = { fps: 30, durationSec: 3, scene: { id: 'scene', title: 'Test', summary: 'Test', version: 1 },
      source: 'synthetic', sourceSha256: 'hash', parameters: {}, parameterSchema: {} }
    const metricContext = { path, randomUUID, performance: { now: () => clock },
      assertProjectRoot: x => x, fail: code => { throw new Error(code) },
      clipAnimationTranscript: () => ({ transcript: [], adjacentContext: [], fallbackQuote: 'test' }),
      readProjectState: () => ({ references: [], styleProfile: { id: 'profile', version: 1, parameters: {} } }),
      validateCipherAnimationStyleProfileV1: x => x, makeDirectorPrompt: () => 'test',
      provider: { complete: async () => { clock += 100; return { text: 'test', provider: 'mock', model: 'mock' } } },
      osSafeTemp: () => fixture, PLAN_OUTPUT_SCHEMA: {}, animationDir: x => x,
      parseDirectorReply: () => ({ route: 'code', module: codeModule, response: 'ok' }),
      resolveTimelineDuration: () => ({}), validateSceneModule: x => x,
      compileCodeScenePlan: () => { clock += 7; return { clock: { durationSec: 3 }, viewport: { fps: 30 }, style: {} } },
      materializeRuntime: () => ({ manifest: { renderer: 'mock', revision: '1', modules: [{ file: 'scene.js', projectRelativeFile: 'scene.js' }] } }),
      sha256: () => 'hash', materializeFonts: () => ({ manifest: { assets: [] } }),
      fs: { mkdirSync() {}, writeFileSync() { clock += 2 }, existsSync: () => false },
      atomicJson: (_file, record) => { records.push(structuredClone(record)); clock += 2 },
      EXTERNAL_REVISION: 'test', pathToFileURL: x => ({ href: 'file://' + x }),
      renderAnimationPlan: async () => { clock += 40; return { path: '/mock.mp4', renderMs: 40, frameCount: 90 } },
      animationAssetManifest: () => ({}), exports: {} }
    const generate = vm.runInNewContext(ts.transpileModule(fn.getText(animationAst).replace(/^export /, '') + '\ngenerateAnimationDraft',
      { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, metricContext)
    const draft = await generate(fixture, { userMessage: 'test', clip: makeSlot('visual'), fps: 30 })
    assert.equal(draft.metrics.directionMs, 100); assert.equal(draft.metrics.compileMs, 7); assert.equal(draft.metrics.renderMs, 40)
    assert.ok(draft.metrics.totalMs >= 147)
    assert.ok(records.filter(r => r.metrics).every(r => r.metrics.directionMs === 100))
    console.log('PASS actual Animation service metrics: direction/compile/render do not overlap')

  } finally { cleanupTestFixture(fixture) }
}
run().catch(e => { console.error(e); process.exitCode = 1 })
