import { repartoObjetivos } from './reparto'

export const BUILD_SOURCES = ['original', 'stock', 'ia', 'visual'] as const
export type BuildSource = typeof BUILD_SOURCES[number]
export type AudioProvenance = { origin: 'original' | 'generated' | 'unknown'; sourcePath?: string; voiceId?: string }

// A persisted generation record is evidence; a display name or matching timings are not.
export function resolveAudioProvenance(clip: any, voices: any[] = []): AudioProvenance {
  if (['original', 'generated'].includes(clip?.audioProvenance?.origin)) return clip.audioProvenance
  const voice = voices.find(v => clip?.path && v.filePath === clip.path && v.id && v.model)
  return voice ? { origin: 'generated', voiceId: voice.id } : { origin: 'unknown' }
}

export function allocateBuildSources(weights: number[], total: number): BuildSource[] {
  const targets = repartoObjetivos(weights, total)
  const used = { original: 0, stock: 0, ia: 0, visual: 0 }
  // Largest deficit spreads sources through the timeline, with the same stable tie order.
  return Array.from({ length: total }, (_, index) => {
    const source = BUILD_SOURCES.filter(s => used[s] < targets[s]).sort((a, b) =>
      ((index + 1) * targets[b] / total - used[b]) - ((index + 1) * targets[a] / total - used[a]))[0]
    if (!source) throw new Error('BUILD_ALLOCATION_INVALID')
    used[source]++
    return source
  })
}

export function pendingBuildSlot(plan: any, error?: string) {
  return { id: plan.id, name: `${plan.source} · pendiente`, type: 'video',
    startSeconds: plan.startSeconds, durationSeconds: plan.durationSeconds,
    transcriptText: plan.transcriptText, category: plan.source, requestedSource: plan.source,
    materialized: false, buildPlan: plan, mediaBuild: { status: error ? 'error' : 'pending', error },
    ...(plan.source === 'visual' ? { animationPending: true, animationSlotIndex: plan.index - 1 } : {}) }
}

export function isPendingCommonSlot(clip: any): boolean {
  return clip?.type === 'video' && clip.category !== 'visual' && !!clip.buildPlan &&
    (clip.materialized !== true || !clip.path || clip.mediaBuild?.status !== 'ready')
}

export function requiredMediaPending(clip: any): boolean {
  if (clip.type === 'graphic') return false
  if (clip.type !== 'video' && clip.type !== 'audio') return false
  return !clip.path || clip.materialized === false || clip.animationPending === true ||
    clip.vibesPlaceholder === true || (clip.buildPlan && clip.category === 'visual' && !clip.animationV1) ||
    (clip.buildPlan && clip.category !== 'visual' && clip.mediaBuild?.status !== 'ready')
}

export function buildSummary(clips: any[]) {
  const videos = clips.filter(c => c.type === 'video')
  const pending = clips.filter(requiredMediaPending).length
  const sources = BUILD_SOURCES.map(source => ({ source,
    requested: videos.filter(c => (c.requestedSource || c.category) === source).length,
    ready: videos.filter(c => c.category === source && !requiredMediaPending(c)).length }))
  return { pending, ready: videos.length > 0 && pending === 0, sources }
}

export function sameBuildSlot(a: any, b: any): boolean {
  return a?.id === b?.id && a?.category === b?.category && a?.startSeconds === b?.startSeconds &&
    a?.durationSeconds === b?.durationSeconds && JSON.stringify(a?.buildPlan) === JSON.stringify(b?.buildPlan)
}

// Shared by initial materialization and retries. Persist before dispatch and after each
// result; never re-plan, copy neighbors or change requested sources. Writes are serialized.
export async function runCommonMediaQueue(options: {
  getClips: () => any[]; persist: (clips: any[]) => Promise<void>; onClips: (clips: any[]) => void;
  dispatch: (slot: any) => Promise<any>; isCurrent: () => boolean; isCancelled: () => boolean;
}) {
  const queue = options.getClips().filter(isPendingCommonSlot)
  let writeTail = Promise.resolve()
  let saveFailed = false
  const update = (slot: any, result: any) => {
    const task = writeTail.then(async () => {
      if (saveFailed || !options.isCurrent()) throw new Error('BUILD_PROJECT_CHANGED_OR_SAVE_FAILED')
      const latest = options.getClips()
      const live = latest.find(c => c.id === slot.id)
      if (!sameBuildSlot(live, slot) || !isPendingCommonSlot(live)) return false
      const next = latest.map(c => c.id === slot.id ? result : c)
      try { await options.persist(next) } catch (e) { saveFailed = true; throw e }
      if (!options.isCurrent()) throw new Error('BUILD_PROJECT_CHANGED')
      options.onClips(next)
      return true
    })
    writeTail = task.then(() => {}, () => {})
    return task
  }
  let firstFailure: { error: unknown } | undefined
  await Promise.allSettled(Array.from({ length: Math.min(3, queue.length) }, async () => {
    try {
      while (queue.length && options.isCurrent() && !options.isCancelled() && !saveFailed) {
        const slot = queue.shift()!
        if (!await update(slot, { ...slot, mediaBuild: { status: 'preparing' } })) continue
        if (!options.isCurrent() || options.isCancelled() || saveFailed) break
        let result: any
        try {
          result = await options.dispatch(slot)
          if (!sameBuildSlot(slot, result) || !result.path || result.materialized !== true ||
              result.requestedSource !== slot.requestedSource) throw new Error('BUILD_RESULT_INVALID')
          result = { ...result, mediaBuild: { status: 'ready' } }
        } catch (error: any) {
          result = { ...slot, ...(error?.stockDecision ? { stockDecision: error.stockDecision } : {}),
            materialized: false, mediaBuild: { status: 'error', error: String(error?.message || error) } }
        }
        await update(slot, result)
      }
    } catch (error) {
      // Keep the caller's build lock until every dispatched provider has settled.
      // Their receipts can then be recovered safely by the next attempt.
      firstFailure ??= { error }
      throw error
    }
  }))
  if (firstFailure) throw firstFailure.error
  return buildSummary(options.getClips())
}
