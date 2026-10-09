export type AnimationBuildPhase = 'queued' | 'waiting' | 'generating' | 'rendering' | 'applying' | 'applied' | 'error' | 'cancelled'

export type AnimationBuildClip = {
  id: string
  type?: string
  category?: string
  startSeconds: number
  durationSeconds: number
  path?: string
  animationPending?: boolean
  materialized?: boolean
  animationV1?: any
  animationBuild?: Record<string, any>
  [key: string]: any
}

export function isPendingAnimationSlot(clip: AnimationBuildClip) {
  return clip?.type === 'video' && clip.category === 'visual' &&
    (clip.animationPending === true || (clip.materialized === false && !clip.animationV1))
}

export function animationBuildQueueCounts(clips: AnimationBuildClip[]) {
  const visuals = (clips || []).filter(clip => clip?.type === 'video' && clip.category === 'visual')
  return {
    pending: visuals.filter(isPendingAnimationSlot).length,
    generating: visuals.filter(clip => clip.animationBuild?.status === 'generating').length,
    rendering: visuals.filter(clip => clip.animationBuild?.status === 'rendering').length,
    applying: visuals.filter(clip => clip.animationBuild?.status === 'applying').length,
    applied: visuals.filter(clip => !isPendingAnimationSlot(clip) && clip.materialized === true &&
      !!clip.animationV1 && !!clip.path).length,
    errors: visuals.filter(clip => clip.animationBuild?.status === 'error').length,
  }
}

function normalizeQuote(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function sameTime(a: unknown, b: unknown) {
  return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a) - Number(b)) <= 1 / 300
}

function draftStyleId(draft: any) {
  return String(draft?.styleProfile?.id || draft?.scenePlan?.style?.profileId || draft?.config?.style?.profileId || '')
}

function draftQuote(draft: any) {
  return normalizeQuote(draft?.config?.content?.verbatimQuote || draft?.scenePlan?.scene?.quote || '')
}

function matchesDraft(draft: any, slot: AnimationBuildClip, expected: {
  quote: string; styleProfileId: string; styleProfileVersion: string | number
}) {
  const binding = draft?.selectedTimelineBinding
  const sameBinding = binding?.clipId === slot.id && sameTime(binding.startSeconds, slot.startSeconds) &&
    sameTime(binding.durationSeconds, slot.durationSeconds)
  const sameStyle = draftStyleId(draft) === expected.styleProfileId &&
    String(draft?.styleProfile?.version || draft?.scenePlan?.style?.profileVersion || draft?.config?.style?.profileVersion || '') ===
      String(expected.styleProfileVersion)
  return sameBinding && sameStyle && !!expected.quote && draftQuote(draft) === normalizeQuote(expected.quote)
}

function errorMessage(error: unknown) {
  return String((error as any)?.message || error || 'ANIMATION_BUILD_FAILED').slice(0, 500)
}

export async function runAnimationBuildQueue(options: {
  clips: AnimationBuildClip[]
  projectPath: string
  styleProfile: { id: string; version: string | number; [key: string]: any }
  animationState: Record<string, any>
  transcriptSegments: any[]
  projectFormat: string
  fps?: number
  referenceIds?: string[]
  threadId?: string | null
  makeJobId: () => string
  isProjectCurrent: () => boolean
  isCancelled?: () => boolean
  onJobStarted?: (jobId: string, clipId: string) => void
  onJobSettled?: (jobId: string) => void
  getActiveJobs: () => Promise<{ success: boolean; jobs?: Array<{ jobId: string; clipId?: string | null; phase?: string }>; error?: string }>
  wait: (ms: number) => Promise<void>
  loadDrafts: (clipId: string) => Promise<{ success: boolean; drafts?: Array<{ draftId: string; createdAt?: string | null }>; error?: string }>
  loadDraft: (draftId: string) => Promise<{ success: boolean; draft?: any; error?: string }>
  replayDraft: (draftId: string, jobId: string, clipId: string, projectPath: string) => Promise<{ success: boolean; rendered?: any; error?: string }>
  generateDraft: (input: any, onProgress: (progress: any) => void) => Promise<any>
  persist: (clips: AnimationBuildClip[], animationState: Record<string, any>) => Promise<void>
  apply: (clip: any, slotId: string, currentClips: AnimationBuildClip[]) => { success: boolean; clips?: AnimationBuildClip[] }
  onClips: (clips: AnimationBuildClip[]) => void
  onProgress: (progress: {
    phase: string; current: number; total: number; counts: ReturnType<typeof animationBuildQueueCounts>
    clipId?: string; message: string; metrics?: any
  }) => void
  quoteForSlot: (slot: AnimationBuildClip) => string
  now?: () => string
}) {
  let clips = [...options.clips]
  let animationState = { ...options.animationState }
  const active = () => options.isProjectCurrent()
  const wasCancelled = () => options.isCancelled?.() === true
  const now = options.now || (() => new Date().toISOString())
  const slots = clips.filter(isPendingAnimationSlot).sort((a, b) =>
    Number(a.startSeconds) - Number(b.startSeconds) || Number(a.animationSlotIndex || 0) - Number(b.animationSlotIndex || 0) || a.id.localeCompare(b.id))
  let applied = 0
  let errors = 0
  let cancelled = false
  let persistChain = Promise.resolve()

  const updateSlot = (slotId: string, build: Record<string, any>) => {
    clips = clips.map(clip => clip.id === slotId ? { ...clip, animationBuild: build } : clip)
    options.onClips(clips)
  }
  const save = async () => {
    if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
    const snapshot = [...clips]
    const savedAnimationState = { ...animationState }
    const operation = persistChain.then(() => options.persist(snapshot, savedAnimationState))
    persistChain = operation.catch(() => undefined)
    await operation
    if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
  }
  const emit = (phase: string, current: number, slotId: string | undefined, message: string, metrics?: any) => {
    options.onProgress({ phase, current, total: slots.length, counts: animationBuildQueueCounts(clips),
      ...(slotId ? { clipId: slotId } : {}), message, ...(metrics ? { metrics } : {}) })
  }
  const waitForIdle = async (slotId: string, index: number) => {
    while (active() && !wasCancelled()) {
      const result = await options.getActiveJobs()
      if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
      if (wasCancelled()) throw new Error('ANIMATION_BUILD_CANCELLED')
      if (!result.success) throw new Error(result.error || 'ANIMATION_ACTIVE_JOBS_UNAVAILABLE')
      const jobs = Array.isArray(result.jobs) ? result.jobs : []
      if (!jobs.length) return
      const job = jobs.find(item => item.clipId === slotId) || jobs[0]
      updateSlot(slotId, { schema: 'cipher-animation-build-slot-v1', status: 'waiting', jobId: job.jobId,
        phase: job.phase || 'active', draftId: clips.find(clip => clip.id === slotId)?.animationBuild?.draftId || null,
        updatedAt: now(), error: null })
      await save()
      emit('waiting', index + 1, slotId, `Esperando la tarea Animation activa (${job.phase || 'en curso'}).`)
      await options.wait(750)
    }
    if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
    throw new Error('ANIMATION_BUILD_CANCELLED')
  }
  const loadMatchingDraft = async (slot: AnimationBuildClip, expected: { quote: string; styleProfileId: string; styleProfileVersion: string | number }) => {
    const listed = await options.loadDrafts(slot.id)
    if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
    if (!listed.success) throw new Error(listed.error || 'ANIMATION_DRAFT_RECOVERY_FAILED')
    const knownId = String(slot.animationBuild?.draftId || '')
    const ids = [...new Set([knownId, ...(listed.drafts || []).map(item => item.draftId)].filter(Boolean))]
    for (const draftId of ids) {
      const loaded = await options.loadDraft(draftId)
      if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
      if (!loaded.success || !loaded.draft || !matchesDraft(loaded.draft, slot, expected)) continue
      return loaded.draft
    }
    return null
  }

  for (let index = 0; index < slots.length; index++) {
    const originalSlot = slots[index]
    if (!active()) { cancelled = true; break }
    if (wasCancelled()) { cancelled = true; break }
    const currentSlot = clips.find(clip => clip.id === originalSlot.id)
    if (!currentSlot || !isPendingAnimationSlot(currentSlot)) continue
    const quote = options.quoteForSlot(currentSlot)
    const generationKey = JSON.stringify({ id: currentSlot.id, start: Number(currentSlot.startSeconds),
      duration: Number(currentSlot.durationSeconds), quote: normalizeQuote(quote), style: options.styleProfile.id,
      version: String(options.styleProfile.version) })
    const previousBuild = currentSlot.animationBuild || {}
    const draftIdBeforeWork = previousBuild.generationKey === generationKey ? previousBuild.draftId || null : null
    const baseBuild = { schema: 'cipher-animation-build-slot-v1', generationKey,
      styleProfileId: options.styleProfile.id, styleProfileVersion: options.styleProfile.version,
      attempts: Number(previousBuild.attempts || 0), createdAt: previousBuild.createdAt || now() }

    try {
      updateSlot(currentSlot.id, { ...baseBuild, status: 'queued', jobId: null, draftId: draftIdBeforeWork,
        updatedAt: now(), error: null })
      await save()
      emit('queued', index + 1, currentSlot.id, `Visual ${index + 1}/${slots.length} en cola.`)
      await waitForIdle(currentSlot.id, index)

      const expected = { quote, styleProfileId: options.styleProfile.id, styleProfileVersion: options.styleProfile.version }
      let draft = await loadMatchingDraft({ ...currentSlot, animationBuild: clips.find(clip => clip.id === currentSlot.id)?.animationBuild }, expected)
      let clip: any = draft?.clip || null
      let metrics: any = draft?.metrics || null
      let threadId = draft?.provider?.threadId || animationState.threadId || options.threadId || null

      if (draft && draft.render?.mediaAvailable !== true) {
        if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
        await waitForIdle(currentSlot.id, index)
        if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
        const replayJobId = options.makeJobId()
        updateSlot(currentSlot.id, { ...baseBuild, status: 'rendering', jobId: replayJobId,
          draftId: draft.draftId, attempts: baseBuild.attempts, updatedAt: now(), error: null })
        await save()
        emit('rendering', index + 1, currentSlot.id, 'Regenerando desde el plan Animation guardado, sin volver al modelo.')
        options.onJobStarted?.(replayJobId, currentSlot.id)
        if (wasCancelled()) { options.onJobSettled?.(replayJobId); throw new Error('ANIMATION_BUILD_CANCELLED') }
        let replay: any
        try { replay = await options.replayDraft(draft.draftId, replayJobId, currentSlot.id, options.projectPath) }
        finally { options.onJobSettled?.(replayJobId) }
        if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
        if (wasCancelled()) throw new Error('ANIMATION_BUILD_CANCELLED')
        if (!replay.success || !replay.rendered?.path) throw new Error(replay.error || 'ANIMATION_REPLAY_FAILED')
        clip = { ...draft.clip, path: replay.rendered.path, url: replay.rendered.url,
          animationV1: draft.clip.animationV1 }
        draft = { ...draft, render: { ...draft.render, mediaAvailable: true } }
        metrics = { ...(metrics || {}), renderMs: replay.rendered.renderMs, cacheHit: replay.rendered.cacheHit === true }
      }

      if (!draft) {
        if (!quote) throw new Error('ANIMATION_SLOT_TRANSCRIPT_MISSING')
        if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
        await waitForIdle(currentSlot.id, index)
        if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
        draft = await loadMatchingDraft({ ...currentSlot,
          animationBuild: clips.find(clip => clip.id === currentSlot.id)?.animationBuild }, expected)
        if (draft) {
          clip = draft.clip
          metrics = draft.metrics || null
          threadId = draft.provider?.threadId || animationState.threadId || options.threadId || null
        }
      }

      if (draft && draft.render?.mediaAvailable !== true) {
        if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
        await waitForIdle(currentSlot.id, index)
        if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
        const replayJobId = options.makeJobId()
        updateSlot(currentSlot.id, { ...baseBuild, status: 'rendering', jobId: replayJobId,
          draftId: draft.draftId, attempts: Number(clips.find(item => item.id === currentSlot.id)?.animationBuild?.attempts || baseBuild.attempts),
          updatedAt: now(), error: null })
        await save()
        emit('rendering', index + 1, currentSlot.id, 'Recuperando el render del plan guardado sin una nueva llamada al modelo.')
        options.onJobStarted?.(replayJobId, currentSlot.id)
        if (wasCancelled()) { options.onJobSettled?.(replayJobId); throw new Error('ANIMATION_BUILD_CANCELLED') }
        let replay: any
        try { replay = await options.replayDraft(draft.draftId, replayJobId, currentSlot.id, options.projectPath) }
        finally { options.onJobSettled?.(replayJobId) }
        if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
        if (wasCancelled()) throw new Error('ANIMATION_BUILD_CANCELLED')
        if (!replay.success || !replay.rendered?.path) throw new Error(replay.error || 'ANIMATION_REPLAY_FAILED')
        clip = { ...draft.clip, path: replay.rendered.path, url: replay.rendered.url,
          animationV1: draft.clip.animationV1 }
        draft = { ...draft, render: { ...draft.render, mediaAvailable: true } }
        metrics = { ...(metrics || {}), renderMs: replay.rendered.renderMs, cacheHit: replay.rendered.cacheHit === true }
      }

      if (!draft) {
        if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
        const jobId = options.makeJobId()
        updateSlot(currentSlot.id, { ...baseBuild, status: 'generating', phase: 'direction', jobId,
          draftId: draftIdBeforeWork, attempts: baseBuild.attempts + 1, updatedAt: now(), error: null })
        await save()
        emit('generating', index + 1, currentSlot.id, 'Animation prepara la escena con el perfil y la narración guardados.')
        if (wasCancelled()) throw new Error('ANIMATION_BUILD_CANCELLED')
        const userMessage = 'Construye automáticamente el Visual procedural de esta ranura para el flujo Construir. ' +
          'Representa con una acción, relación o cambio claro la narración literal temporizada del intervalo: “' + quote + '”. ' +
          'Usa el perfil de Animation vigente y el contexto vecino solo para resolver referencias. No inventes hechos, ' +
          'no añadas medios raster y no uses catálogos ni motores anteriores.'
        options.onJobStarted?.(jobId, currentSlot.id)
        if (wasCancelled()) { options.onJobSettled?.(jobId); throw new Error('ANIMATION_BUILD_CANCELLED') }
        let result: any
        try { result = await options.generateDraft({ jobId, projectPath: options.projectPath,
          clip: { ...currentSlot, text: currentSlot.transcriptText || quote },
          userMessage, transcriptSegments: options.transcriptSegments, styleProfile: options.styleProfile,
          freshCodeOnly: true,
          referenceIds: options.referenceIds || [], threadId: animationState.threadId || options.threadId || undefined,
          fps: options.fps || 30, projectFormat: options.projectFormat }, progress => {
          if (!active()) return
          const phase = String(progress?.phase || 'generating')
          const isRendering = phase === 'render' || phase === 'rendering'
          if (isRendering && clips.find(item => item.id === currentSlot.id)?.animationBuild?.status !== 'rendering') {
            const latestBuild = clips.find(item => item.id === currentSlot.id)?.animationBuild || baseBuild
            updateSlot(currentSlot.id, { ...latestBuild, status: 'rendering', phase, updatedAt: now() })
            void save().catch(() => undefined)
          }
          emit(isRendering ? 'rendering' : 'generating', index + 1,
            currentSlot.id, String(progress?.message || `Animation: ${phase}.`), progress?.metrics)
        }) } finally { options.onJobSettled?.(jobId) }
        if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
        if (wasCancelled()) throw new Error('ANIMATION_BUILD_CANCELLED')
        if (!result?.success || result.kind !== 'draft' || !result.clip?.path || !result.draft?.draftId)
          throw new Error(result?.error || (result?.kind === 'answer' ? 'ANIMATION_AGENT_DID_NOT_CREATE_DRAFT' : 'ANIMATION_DRAFT_INVALID'))
        draft = result.draft
        clip = result.clip
        metrics = result.metrics || result.draft.metrics || null
        threadId = result.threadId || result.draft.provider?.threadId || threadId
      }

      if (!clip || clip.id !== currentSlot.id || !sameTime(clip.startSeconds, currentSlot.startSeconds) ||
          !sameTime(clip.durationSeconds, currentSlot.durationSeconds) || !clip.path || !clip.animationV1?.draftId)
        throw new Error('ANIMATION_SLOT_BINDING_MISMATCH')
      if (!active()) throw new Error('ANIMATION_PROJECT_CHANGED')
      if (wasCancelled()) throw new Error('ANIMATION_BUILD_CANCELLED')
      const completedAt = now()
      const attempts = Number(clips.find(clip => clip.id === currentSlot.id)?.animationBuild?.attempts ?? baseBuild.attempts)
      const completedBuild = { ...baseBuild, status: 'applied', jobId: null, draftId: draft.draftId,
        attempts, updatedAt: completedAt, completedAt,
        metrics: metrics ? { directionMs: metrics.directionMs, codegenCalls: metrics.codegenCalls, codegenMs: metrics.codegenMs,
          validationFailures: metrics.validationFailures, compileMs: metrics.compileMs, renderMs: metrics.renderMs,
          renderStages: metrics.renderStages || null, totalMs: metrics.totalMs, cacheHit: metrics.cacheHit === true } : null }
      const applyingClip = { ...clip, id: currentSlot.id, startSeconds: Number(currentSlot.startSeconds),
        durationSeconds: Number(currentSlot.durationSeconds), animationBuild: completedBuild, materialized: true }
      updateSlot(currentSlot.id, { ...completedBuild, status: 'applying', updatedAt: now() })
      await save()
      if (wasCancelled()) throw new Error('ANIMATION_BUILD_CANCELLED')
      emit('applying', index + 1, currentSlot.id, 'Aplicando el render al slot original y guardando.')
      const appliedResult = options.apply(applyingClip, currentSlot.id, clips)
      if (!appliedResult.success || !Array.isArray(appliedResult.clips)) throw new Error('ANIMATION_SLOT_APPLY_REJECTED')
      clips = appliedResult.clips.map(item => item.id === currentSlot.id
        ? { ...item, animationPending: undefined, materialized: true, animationBuild: completedBuild }
        : item)
      options.onClips(clips)
      if (threadId) animationState.threadId = threadId
      animationState.activeDraftId = draft.draftId
      animationState.styleProfile = options.styleProfile
      await save()
      applied++
      emit('applied', index + 1, currentSlot.id, `Visual ${index + 1}/${slots.length} aplicado.`, metrics)
    } catch (error) {
      if (!active()) { cancelled = true; break }
      if (wasCancelled() || errorMessage(error) === 'ANIMATION_BUILD_CANCELLED') {
        let draftId = clips.find(clip => clip.id === currentSlot.id)?.animationBuild?.draftId || draftIdBeforeWork
        try {
          const recoverable = await loadMatchingDraft({ ...currentSlot,
            animationBuild: clips.find(clip => clip.id === currentSlot.id)?.animationBuild },
          { quote, styleProfileId: options.styleProfile.id, styleProfileVersion: options.styleProfile.version })
          if (recoverable?.draftId) draftId = recoverable.draftId
        } catch { /* recovery can be retried after the active task settles */ }
        updateSlot(currentSlot.id, { ...baseBuild, status: 'cancelled', jobId: null,
          draftId: draftId || null, attempts: Number(clips.find(clip => clip.id === currentSlot.id)?.animationBuild?.attempts ?? baseBuild.attempts),
          updatedAt: now(), error: null })
        try { await save() } catch { /* the project switch guard may have rejected this save */ }
        cancelled = true
        emit('cancelled', index + 1, currentSlot.id, 'Cola detenida. El slot sigue pendiente y su borrador guardado se recuperará al continuar.')
        break
      }
      const message = errorMessage(error)
      let draftId = clips.find(clip => clip.id === currentSlot.id)?.animationBuild?.draftId || draftIdBeforeWork
      try {
        const recoverable = await loadMatchingDraft({ ...currentSlot,
          animationBuild: clips.find(clip => clip.id === currentSlot.id)?.animationBuild },
        { quote, styleProfileId: options.styleProfile.id, styleProfileVersion: options.styleProfile.version })
        if (recoverable?.draftId) draftId = recoverable.draftId
      } catch { /* keep the original failure evidence; the slot remains retryable */ }
      const latest = clips.find(clip => clip.id === currentSlot.id)
      const alreadyApplied = latest && !isPendingAnimationSlot(latest) && !!latest.animationV1 && !!latest.path
      updateSlot(currentSlot.id, { ...baseBuild, status: alreadyApplied ? 'applied' : 'error', jobId: null,
        draftId: draftId || null, attempts: Number(latest?.animationBuild?.attempts ?? baseBuild.attempts),
        updatedAt: now(), ...(alreadyApplied ? { persistenceError: message } : { error: message }) })
      try { await save() } catch { /* renderer stays dirty; scoped persistence error is still reported */ }
      errors++
      if (alreadyApplied) applied++
      emit(alreadyApplied ? 'applied' : 'error', index + 1, currentSlot.id,
        alreadyApplied ? `El Visual quedó aplicado, pero falló su guardado: ${message}` : `Falló el slot ${currentSlot.id}: ${message}`)
    }
  }

  return { clips, animationState, slots: slots.length, applied, errors, cancelled,
    counts: animationBuildQueueCounts(clips) }
}
