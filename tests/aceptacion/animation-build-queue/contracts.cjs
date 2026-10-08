const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const sourcePath = path.join(__dirname, '../../../src/shared/animation-build-queue.ts')
const source = fs.readFileSync(sourcePath, 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const loaded = { exports: {} }
new Function('require', 'module', 'exports', compiled)(require, loaded, loaded.exports)
const { animationBuildQueueCounts, isPendingAnimationSlot, runAnimationBuildQueue } = loaded.exports
const repartoSource = fs.readFileSync(path.join(__dirname, '../../../src/shared/reparto.ts'), 'utf8')
const repartoCompiled = ts.transpileModule(repartoSource,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const repartoLoaded = { exports: {} }
new Function('require', 'module', 'exports', repartoCompiled)(require, repartoLoaded, repartoLoaded.exports)
const { repartoObjetivos } = repartoLoaded.exports

const profile = { id: 'cipher-editorial-motion-v1', version: 1, parameters: { paletteId: 'paper' } }
const makeSlot = (id, startSeconds, quote = `narración ${id}`) => ({ id, type: 'video', category: 'visual',
  startSeconds, durationSeconds: 3, transcriptText: quote, animationPending: true, materialized: false })
const makeDraft = (slot, quote, draftId) => ({ schema: 'cipher-animation-draft-v1', draftId,
  selectedTimelineBinding: { clipId: slot.id, startSeconds: slot.startSeconds, durationSeconds: slot.durationSeconds },
  styleProfile: { id: profile.id, version: profile.version },
  config: { content: { verbatimQuote: quote } }, provider: { threadId: 'thread-animation' },
  render: { mediaAvailable: true }, metrics: { directionMs: 18, renderMs: 50, totalMs: 70 },
  clip: { id: slot.id, name: `Animation ${slot.id}`, startSeconds: slot.startSeconds, durationSeconds: slot.durationSeconds,
    type: 'video', category: 'visual', path: `C:/project/${draftId}.mp4`, url: `file:///C:/project/${draftId}.mp4`,
    animationV1: { draftId, planHash: 'a'.repeat(64) } } })

function makeOptions(initialClips, overrides = {}) {
  let clips = [...initialClips]
  let active = true
  let activeCount = 0
  let maxActive = 0
  const calls = []
  const saved = []
  const applied = []
  const progress = []
  const drafts = new Map()
  let jobPoll = 0
  const options = {
    clips, projectPath: 'C:/project', styleProfile: profile, animationState: { styleProfile: profile, references: [{ id: 'ref-private' }] },
    transcriptSegments: [{ start: 0, end: 12, text: 'narración literal con vecinos', words: [] }],
    projectFormat: 'vertical', fps: 30, referenceIds: ['ref-private'], threadId: 'thread-existing',
    makeJobId: (() => { let n = 0; return () => `job-${++n}-12345678` })(),
    isProjectCurrent: () => active,
    getActiveJobs: async () => { jobPoll++; return { success: true, jobs: [] } },
    wait: async () => {},
    loadDrafts: async clipId => ({ success: true, drafts: [...(drafts.get(clipId) || [])] }),
    loadDraft: async draftId => {
      for (const values of drafts.values()) {
        const draft = values.find(item => item.draftId === draftId)
        if (draft) return { success: true, draft }
      }
      return { success: false, error: 'ANIMATION_DRAFT_NOT_FOUND' }
    },
    replayDraft: async () => ({ success: false, error: 'unexpected replay' }),
    generateDraft: async (input, onProgress) => {
      calls.push(input)
      activeCount++; maxActive = Math.max(maxActive, activeCount)
      onProgress({ phase: 'direction', message: 'dirección' })
      onProgress({ phase: 'render', message: 'render' })
      const result = await (overrides.generateDraft || (async request => {
        const draftId = `animation-${String(request.clip.id).replace(/[^a-f0-9]/g, '').padEnd(20, 'a').slice(0, 20)}`
        const draft = makeDraft(request.clip, request.clip.text, draftId)
        const values = drafts.get(request.clip.id) || []
        values.unshift(draft); drafts.set(request.clip.id, values)
        return { success: true, kind: 'draft', threadId: 'thread-resumed', draft, clip: draft.clip, metrics: draft.metrics }
      }))(input)
      activeCount--; return result
    },
    persist: async (nextClips, animationState) => { saved.push({ clips: [...nextClips], animationState: { ...animationState } }) },
    apply: (clip, slotId, currentClips) => {
      applied.push(slotId)
      const next = currentClips.map(item => item.id === slotId
        ? { ...item, name: clip.name, path: clip.path, url: clip.url, animationV1: clip.animationV1,
          materialized: true, animationPending: undefined, animationBuild: clip.animationBuild }
        : item)
      return { success: true, clips: next }
    },
    onClips: next => { clips = [...next] },
    onProgress: item => progress.push(item),
    quoteForSlot: slot => slot.transcriptText,
    now: (() => { let n = 0; return () => `2026-10-07T00:00:${String(n++).padStart(2, '0')}.000Z` })(),
  }
  Object.assign(options, overrides)
  options.drafts = drafts
  options.getState = () => ({ clips, calls, saved, applied, progress, maxActive, jobPoll, drafts })
  options.setInactive = () => { active = false }
  return options
}

async function run() {
  const rendererSource = fs.readFileSync(path.join(__dirname, '../../../src/renderer/src/main.tsx'), 'utf8')
  const serviceSource = fs.readFileSync(path.join(__dirname, '../../../src/main/services/animation-integration.ts'), 'utf8')
  const buildHandler = rendererSource.slice(rendererSource.indexOf('const handleBuildIATimeline = async () => {'),
    rendererSource.indexOf('const handleClearGraphics = () => {'))
  assert.equal(repartoObjetivos([0, 39, 28, 33], 5).visual, 2,
    'a positive Visuales quota remains in the four-way project allocation')
  assert.ok(buildHandler.includes('const buildAnimationSlots = (timelineWeights[3] ?? 0) > 0'),
    'a positive Visuales quota enables the Animation-slot planning path')
  assert.ok(buildHandler.includes('buildAnimationSlots ? animationInputSegments : effectiveAudioSegments'),
    'the Animation path passes timed narration slots to the existing timeline planner')
  assert.ok(buildHandler.indexOf('existingPendingAnimationSlots.length > 0') < buildHandler.indexOf('generateTimelineAssets('),
    'existing slots resume before planning, media selection, or other providers')
  assert.ok(buildHandler.includes('continuePendingAnimationBuild(timelineVideoClips)'), 'Build wires existing pending slots to Animation')
  assert.ok(buildHandler.includes('continuePendingAnimationBuild(finalTimelineClips'), 'newly planned Animation slots run automatically after planning')
  assert.ok(rendererSource.includes('window.electronAPI.animationGenerateDraft(input)'), 'automatic queue uses the existing Animation IPC')
  assert.ok(rendererSource.includes('allowUnselectedSlot: true'), 'automatic application binds by stable slot ID, not UI selection')
  assert.ok(serviceSource.includes('Formato del proyecto: '), 'the Animation director receives the exact project format')
  assert.ok(serviceSource.includes('Animation es la única ruta para nuevos Visuales'), 'Animation remains the only Visual creation route')

  const unsorted = [makeSlot('slot-b', 6), { id: 'stock', type: 'video', category: 'stock', startSeconds: 2, durationSeconds: 3 }, makeSlot('slot-a', 0)]
  assert.equal(isPendingAnimationSlot(unsorted[0]), true)
  assert.equal(isPendingAnimationSlot(unsorted[1]), false, 'Stock must never enter the Animation queue')
  assert.deepEqual(animationBuildQueueCounts(unsorted), { pending: 2, generating: 0, rendering: 0, applying: 0, applied: 0, errors: 0 })

  const options = makeOptions(unsorted)
  const result = await runAnimationBuildQueue(options)
  const state = options.getState()
  assert.equal(result.applied, 2)
  assert.equal(result.errors, 0)
  assert.deepEqual(state.calls.map(call => call.clip.id), ['slot-a', 'slot-b'], 'slots run in timeline order')
  assert.equal(state.maxActive, 1, 'only one generator can run at a time')
  assert.ok(state.calls.every(call => call.clip.startSeconds === call.clip.startSeconds && call.clip.durationSeconds === 3))
  assert.ok(state.calls.every(call => call.projectFormat === 'vertical' && call.styleProfile.id === profile.id &&
    call.referenceIds[0] === 'ref-private'))
  assert.equal(state.calls[0].threadId, 'thread-existing')
  assert.equal(state.calls[1].threadId, 'thread-resumed', 'successor slots continue on the returned Codex thread')
  assert.deepEqual(state.applied, ['slot-a', 'slot-b'], 'application uses each stable slot ID')
  assert.ok(state.saved.some(snapshot => snapshot.clips.find(clip => clip.id === 'slot-a')?.animationBuild?.status === 'rendering'),
    'render state is persisted before application')
  assert.ok(state.saved.some(snapshot => snapshot.clips.find(clip => clip.id === 'slot-a')?.animationBuild?.status === 'applied'),
    'applied state is persisted')
  assert.equal(result.counts.pending, 0)
  assert.equal(result.counts.applied, 2)
  assert.ok(state.progress.some(item => item.phase === 'rendering'))

  const repeated = makeOptions(result.clips)
  const noOp = await runAnimationBuildQueue(repeated)
  assert.equal(noOp.slots, 0)
  assert.equal(repeated.getState().calls.length, 0, 'rerunning a completed queue makes no model calls')

  const recoverSlot = makeSlot('slot-recover', 9)
  const recoveredDraft = makeDraft(recoverSlot, recoverSlot.transcriptText, 'animation-0123456789abcdefabcd')
  const recovery = makeOptions([recoverSlot], { loadDrafts: async () => ({ success: true, drafts: [{ draftId: recoveredDraft.draftId }] }),
    loadDraft: async () => ({ success: true, draft: recoveredDraft }) })
  const recoveryResult = await runAnimationBuildQueue(recovery)
  assert.equal(recoveryResult.applied, 1)
  assert.equal(recovery.getState().calls.length, 0, 'a valid saved draft is reused without repeating the model call')

  const activeSlot = makeSlot('slot-active', 12)
  const activeDraft = makeDraft(activeSlot, activeSlot.transcriptText, 'animation-fedcba9876543210fedc')
  const activeRun = makeOptions([activeSlot], {
    getActiveJobs: (() => { let reads = 0; return async () => ({ success: true,
      jobs: reads++ === 0 ? [{ jobId: 'running-job-12345678', clipId: activeSlot.id, phase: 'render' }] : [] }) })(),
    wait: async () => { activeRun.drafts.set(activeSlot.id, [activeDraft]) },
  })
  const activeResult = await runAnimationBuildQueue(activeRun)
  assert.equal(activeResult.applied, 1)
  assert.equal(activeRun.getState().calls.length, 0, 'a finished active job is recovered before dispatch')
  assert.equal(activeRun.getState().progress.some(item => item.phase === 'waiting'), true)

  const cacheLostSlot = makeSlot('slot-cache-lost', 15)
  const cacheLostDraft = makeDraft(cacheLostSlot, cacheLostSlot.transcriptText, 'animation-112233445566778899aa')
  cacheLostDraft.render.mediaAvailable = false
  const cacheRecovery = makeOptions([cacheLostSlot], {
    loadDrafts: async () => ({ success: true, drafts: [{ draftId: cacheLostDraft.draftId }] }),
    loadDraft: async () => ({ success: true, draft: cacheLostDraft }),
    replayDraft: async (_draftId, _jobId, clipId) => ({ success: true, rendered: {
      path: `C:/project/${clipId}-offline.mp4`, url: `file:///C:/project/${clipId}-offline.mp4`, renderMs: 44,
    } }),
  })
  const cacheRecoveryResult = await runAnimationBuildQueue(cacheRecovery)
  assert.equal(cacheRecoveryResult.applied, 1)
  assert.equal(cacheRecovery.getState().calls.length, 0, 'missing MP4 is replayed from saved code without the model')
  assert.match(cacheRecoveryResult.clips.find(clip => clip.id === cacheLostSlot.id).path, /offline\.mp4$/)

  let failFirst = true
  const partial = makeOptions([makeSlot('slot-fail', 0), makeSlot('slot-ok', 3)], {
    generateDraft: async input => {
      if (input.clip.id === 'slot-fail' && failFirst) throw new Error('ANIMATION_PROVIDER_TEST_FAILURE')
      const id = `animation-${input.clip.id.replace(/[^a-f0-9]/g, '').padEnd(20, 'b').slice(0, 20)}`
      const draft = makeDraft(input.clip, input.clip.text, id)
      partial.drafts.set(input.clip.id, [draft])
      return { success: true, kind: 'draft', draft, clip: draft.clip, metrics: draft.metrics }
    },
  })
  const partialResult = await runAnimationBuildQueue(partial)
  assert.equal(partialResult.applied, 1)
  assert.equal(partialResult.errors, 1)
  assert.equal(partialResult.clips.find(clip => clip.id === 'slot-fail').animationBuild.status, 'error')
  assert.equal(partialResult.clips.find(clip => clip.id === 'slot-fail').animationPending, true, 'failed slot stays retryable, without a fallback')
  failFirst = false
  const retryIds = []
  const retry = makeOptions(partialResult.clips, { generateDraft: async input => {
    retryIds.push(input.clip.id)
    return partial.generateDraft(input)
  } })
  const retryResult = await runAnimationBuildQueue(retry)
  assert.deepEqual(retryIds, ['slot-fail'], 'retry touches only the failed pending slot')
  assert.equal(retryResult.counts.pending, 0)

  const stale = makeOptions([makeSlot('slot-stale', 0)], {
    generateDraft: async input => {
      stale.setInactive()
      const draft = makeDraft(input.clip, input.clip.text, 'animation-abcdefabcdefabcdefab')
      return { success: true, kind: 'draft', draft, clip: draft.clip }
    },
  })
  const staleResult = await runAnimationBuildQueue(stale)
  assert.equal(staleResult.cancelled, true)
  assert.deepEqual(stale.getState().applied, [], 'late results are not applied after project switch')

  let cancelRequested = false
  const cancelRequests = []
  const cancellable = makeOptions([makeSlot('slot-cancel', 0), makeSlot('slot-after-cancel', 3)], {
    isCancelled: () => cancelRequested,
    generateDraft: async input => {
      cancelRequests.push(input.clip.id)
      cancelRequested = true
      const draft = makeDraft(input.clip, input.clip.text, 'animation-1234567890abcdefabcd')
      return { success: true, kind: 'draft', draft, clip: draft.clip, metrics: draft.metrics }
    },
  })
  const cancellationResult = await runAnimationBuildQueue(cancellable)
  assert.equal(cancellationResult.cancelled, true)
  assert.deepEqual(cancellable.getState().applied, [], 'cancelled output is not applied late')
  assert.deepEqual(cancelRequests, ['slot-cancel'], 'cancellation prevents dispatching the next pending slot')
  assert.equal(cancellationResult.clips.find(clip => clip.id === 'slot-cancel').animationBuild.status, 'cancelled')
  assert.equal(cancellationResult.clips.find(clip => clip.id === 'slot-after-cancel').animationPending, true)

  console.log('Animation Build queue contracts: OK (sequential, recovery, stable slots, retry, stale-project guard)')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
