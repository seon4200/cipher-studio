import { CodexAppServerProvider } from '../animation/codex-app-server-provider.cjs'
import {
  BUILD_PLANNER_OUTPUT_SCHEMA, buildPlannerPrompt, parseBuildPlannerReply,
  type BuildTimedSegment,
} from '../../shared/build-planning'

const provider = new CodexAppServerProvider({ timeoutMs: 600_000 })

/** Use the existing Codex app-server login for Build direction, in small validated batches. */
export function createBuildPlanner(codexProvider: { complete: (request: any) => Promise<any> }) {
  return async function planBuildWithCodex(input: {
  scriptText: string
  segments: readonly BuildTimedSegment[]
  durationSeconds: number
  sourceDurationSeconds: number
  weights: readonly number[]
  signal?: AbortSignal
  onProgress?: (progress: { phase: string; message: string; index?: number; total?: number }) => void
}) {
  const planned: any[] = []
  let model = 'Codex configured model'
  for (let offset = 0; offset < input.segments.length; offset += 6) {
    if (input.signal?.aborted) throw new Error('BUILD_CODEX_CANCELLED')
    const batch = input.segments.slice(offset, offset + 6)
    input.onProgress?.({ phase: 'planning', message: `Codex está planificando el bloque ${Math.floor(offset / 6) + 1}.`, index: offset,
      total: input.segments.length })
    let result: any
    try {
      result = await codexProvider.complete({ purpose: 'build-planner', prompt: buildPlannerPrompt({
        scriptText: input.scriptText,
        segments: batch,
        durationSeconds: input.durationSeconds,
        sourceDurationSeconds: input.sourceDurationSeconds,
        weights: input.weights,
      }), signal: input.signal, outputSchema: BUILD_PLANNER_OUTPUT_SCHEMA,
      onProgress: input.onProgress })
    } catch (error: any) {
      const message = String(error?.message || error || 'BUILD_CODEX_FAILED')
      throw new Error(message.startsWith('BUILD_CODEX_') ? message : `BUILD_CODEX_FAILED:${message}`)
    }
    if (typeof result?.model === 'string' && result.model.trim()) model = result.model
    const decisions = parseBuildPlannerReply(result.text, batch, input.sourceDurationSeconds)
    for (const decision of decisions) decision.phraseIndex += offset
    planned.push(...decisions)
    input.onProgress?.({ phase: 'planning', message: `Codex terminó el bloque ${Math.floor(offset / 6) + 1}.`,
      index: offset + batch.length - 1, total: input.segments.length })
  }
  if (planned.length !== input.segments.length) throw new Error('BUILD_CODEX_PLAN_PHRASES_INCOMPLETE')
  return { phrases: planned, provider: 'codex-app-server', model }
  }
}

export const planBuildWithCodex = createBuildPlanner(provider)
