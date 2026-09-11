import type { NombreSistema } from '../../shared/sistemas'
import type {
  LocalSceneSemanticV1,
  NarrativeKeywordCandidateV2,
} from '../../shared/local-scene-semantic'
import {
  createResolverSessionV1,
  type ResolveSceneInputV1,
} from './asset-resolver'
import {
  resolveLocalSemanticVisualSceneV1,
  type LocalSemanticVisualDecisionResultV1,
} from './semantic-decision'
import type { VideoVisualStyleIdV1 } from '../../shared/visual-style-v1'
import {
  createMotionGraphicsResolverSessionV2,
  resolveMotionGraphicsSceneV2,
  type LockedVisualChoiceV2,
  type MotionGraphicsProviderHooksV2,
  type MotionGraphicsResolutionV2,
} from './motion-graphics-resolver'

/**
 * Persisted, non-pixel input required to reproduce one modern Visual decision.
 * It intentionally contains semantic context and deterministic direction, never
 * provider URLs, paths, hashes, or rendered bytes.
 */
export const MODERN_VISUAL_GENERATION_CONTEXT_VERSION = 1 as const

export type ModernVisualGenerationContextV1 = {
  version: typeof MODERN_VISUAL_GENERATION_CONTEXT_VERSION
  sceneId: string
  duration: number
  localSemantic: LocalSceneSemanticV1
  keywordCandidates: NarrativeKeywordCandidateV2[]
  preferredVisualMode: 'asset-led' | 'editorial-text' | 'auto'
  sistema: NombreSistema
  direction: ResolveSceneInputV1['direction']
}

export type ResolvedModernVisualGenerationV1 = {
  context: ModernVisualGenerationContextV1
  resolved: LocalSemanticVisualDecisionResultV1
}

export const MODERN_VISUAL_GENERATION_CONTEXT_VERSION_V2 = 2 as const

export type ModernVisualGenerationContextV2 = Omit<ModernVisualGenerationContextV1, 'version'> & {
  version: typeof MODERN_VISUAL_GENERATION_CONTEXT_VERSION_V2
  /** Selected once per video and persisted with every scene for deterministic regeneration. */
  videoStyleId: VideoVisualStyleIdV1
  /** Provider decisions are administrative locators and remain outside SceneSpec/PixelIdentity. */
  lockedChoices: LockedVisualChoiceV2[]
}

export type ResolvedModernVisualGenerationV2 = {
  context: ModernVisualGenerationContextV2
  resolved: MotionGraphicsResolutionV2
}

export class ModernVisualGenerationContextError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ModernVisualGenerationContextError'
  }
}

function fail(code: string, message: string, details: Record<string, unknown> = {}): never {
  throw new ModernVisualGenerationContextError(code, message, details)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function nonempty(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) fail('MODERN_VISUAL_CONTEXT_INVALID', `${field} es obligatorio`)
  return value.trim()
}

function localSemantic(value: unknown): LocalSceneSemanticV1 {
  if (!isRecord(value) || value.version !== 1 || typeof value.sceneId !== 'string' ||
      !value.sceneId.trim() || !Number.isFinite(value.start) || !Number.isFinite(value.end) ||
      typeof value.localText !== 'string' || !Array.isArray(value.localTokens) ||
      !Array.isArray(value.concepts) || !Array.isArray(value.globalHints) || !Array.isArray(value.directEvidence))
    fail('MODERN_VISUAL_CONTEXT_INVALID', 'LocalSceneSemanticV1 persistido no es válido')
  return value as unknown as LocalSceneSemanticV1
}

function keywordCandidates(value: unknown): NarrativeKeywordCandidateV2[] {
  if (!Array.isArray(value)) fail('MODERN_VISUAL_CONTEXT_INVALID', 'keywordCandidates debe ser un array')
  const result: NarrativeKeywordCandidateV2[] = []
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.keyword !== 'string' || !candidate.keyword.trim())
      fail('MODERN_VISUAL_CONTEXT_INVALID', 'keywordCandidates contiene una entrada inválida')
    const source = candidate.source
    if (source !== undefined && source !== 'scene-semantic' && source !== 'legacy-timed' && source !== 'context')
      fail('MODERN_VISUAL_CONTEXT_INVALID', 'keywordCandidates contiene un origen inválido')
    result.push(source === undefined
      ? { keyword: candidate.keyword.trim() }
      : { keyword: candidate.keyword.trim(), source })
  }
  return result
}

function direction(value: unknown): ResolveSceneInputV1['direction'] {
  if (!isRecord(value) || !Number.isSafeInteger(value.semilla) || Number(value.semilla) <= 0)
    fail('MODERN_VISUAL_CONTEXT_INVALID', 'La dirección persistida requiere una semilla positiva')
  for (const field of ['fondo', 'camara', 'densidad', 'ritmo']) {
    if (typeof value[field] !== 'string' || !String(value[field]).trim())
      fail('MODERN_VISUAL_CONTEXT_INVALID', `La dirección persistida no contiene ${field}`)
  }
  return {
    fondo: value.fondo,
    ...(value.estructura === undefined ? {} : { estructura: value.estructura }),
    camara: value.camara,
    densidad: value.densidad,
    ritmo: value.ritmo,
    semilla: Number(value.semilla),
  }
}

/** Creates the serializable context once during normal generation. */
export function createModernVisualGenerationContextV1(input: {
  sceneId: unknown
  duration: unknown
  localSemantic: unknown
  keywordCandidates?: unknown
  preferredVisualMode?: unknown
  sistema: unknown
  direction: unknown
}): ModernVisualGenerationContextV1 {
  const duration = Number(input.duration)
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600)
    fail('MODERN_VISUAL_CONTEXT_INVALID', 'La duración del Visual debe ser finita y positiva')
  const preferredVisualMode = input.preferredVisualMode ?? 'auto'
  if (preferredVisualMode !== 'asset-led' && preferredVisualMode !== 'editorial-text' && preferredVisualMode !== 'auto')
    fail('MODERN_VISUAL_CONTEXT_INVALID', 'preferredVisualMode no es válido')
  const semantic = localSemantic(input.localSemantic)
  const sceneId = nonempty(input.sceneId, 'sceneId')
  if (semantic.sceneId !== sceneId)
    fail('MODERN_VISUAL_CONTEXT_INVALID', 'sceneId y LocalSceneSemanticV1 deben coincidir')
  return {
    version: MODERN_VISUAL_GENERATION_CONTEXT_VERSION,
    sceneId,
    duration,
    localSemantic: semantic,
    keywordCandidates: keywordCandidates(input.keywordCandidates ?? []),
    preferredVisualMode,
    sistema: nonempty(input.sistema, 'sistema') as NombreSistema,
    direction: direction(input.direction),
  }
}

function lockedChoices(value: unknown): LockedVisualChoiceV2[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 3) fail('MODERN_VISUAL_CONTEXT_INVALID', 'lockedChoices no es válido')
  const slots = new Set<string>()
  return value.map(raw => {
    if (!isRecord(raw) || !['hero', 'support-1', 'support-2'].includes(String(raw.slotId)) ||
        !['openmoji', 'pixabay-images', 'solar'].includes(String(raw.provider)) ||
        typeof raw.concept !== 'string' || !raw.concept.trim() || typeof raw.reason !== 'string' ||
        ![2, 3].includes(Number(raw.score)) || !isRecord(raw.bounds) || typeof raw.kind !== 'string' ||
        !['vector', 'useful-alpha', 'opaque-rectangle'].includes(String(raw.alphaMode)) || slots.has(String(raw.slotId)))
      fail('MODERN_VISUAL_CONTEXT_INVALID', 'lockedChoices contiene una decisión inválida')
    slots.add(String(raw.slotId))
    return raw as unknown as LockedVisualChoiceV2
  })
}

export function createModernVisualGenerationContextV2(input: {
  sceneId: unknown
  duration: unknown
  localSemantic: unknown
  keywordCandidates?: unknown
  preferredVisualMode?: unknown
  sistema: unknown
  direction: unknown
  videoStyleId: unknown
  lockedChoices?: unknown
}): ModernVisualGenerationContextV2 {
  const base = createModernVisualGenerationContextV1(input)
  if (input.videoStyleId !== 'cream-editorial' && input.videoStyleId !== 'ink-technical')
    fail('MODERN_VISUAL_CONTEXT_INVALID', 'videoStyleId no es válido')
  return {
    ...base,
    version: MODERN_VISUAL_GENERATION_CONTEXT_VERSION_V2,
    // DeepSeek emits these concepts inside this exact visualClip. Persist that source scope
    // explicitly so an unspoken but valid visual concept is not mistaken for paragraph-wide
    // context. Existing timestamps and an explicit `context` scope remain authoritative.
    localSemantic: {
      ...base.localSemantic,
      concepts: base.localSemantic.concepts.map(concept => ({
        ...concept,
        scope: concept.scope ?? 'scene',
      })),
    },
    videoStyleId: input.videoStyleId,
    lockedChoices: lockedChoices(input.lockedChoices),
  }
}

/**
 * Single authority shared by ordinary generation and explicit regeneration.
 * A fresh resolver session is intentionally created per ordered batch; with the
 * same contexts and order, both entry points materialize the same SceneSpecs.
 */
export function resolveModernVisualGenerationBatchV1(input: {
  contexts: readonly unknown[]
  projectRoot?: unknown
}): ResolvedModernVisualGenerationV1[] {
  const session = createResolverSessionV1()
  return input.contexts.map(raw => {
    const context = createModernVisualGenerationContextV1(raw as Parameters<typeof createModernVisualGenerationContextV1>[0])
    const resolved = resolveLocalSemanticVisualSceneV1({
      localSemantic: context.localSemantic,
      keywordCandidates: context.keywordCandidates,
      preferredVisualMode: context.preferredVisualMode,
      projectRoot: input.projectRoot,
      sistema: context.sistema,
      direction: context.direction,
      session,
    })
    return { context, resolved }
  })
}

/**
 * V15 generation and explicit regeneration share this single ordered authority.  Provider IO is
 * complete before SceneSpec reaches hash/render; locked choices make regeneration independent of
 * changing remote search order while every local byte is verified again.
 */
export async function resolveModernVisualGenerationBatchV2(input: {
  contexts: readonly unknown[]
  projectRoot: unknown
  pixabayApiKey?: string
  hooks?: MotionGraphicsProviderHooksV2
}): Promise<ResolvedModernVisualGenerationV2[]> {
  const semanticSession = createResolverSessionV1()
  const visualSession = createMotionGraphicsResolverSessionV2()
  const output: ResolvedModernVisualGenerationV2[] = []
  for (const raw of input.contexts) {
    const context = createModernVisualGenerationContextV2(raw as Parameters<typeof createModernVisualGenerationContextV2>[0])
    const base = resolveLocalSemanticVisualSceneV1({
      localSemantic: context.localSemantic,
      keywordCandidates: context.keywordCandidates,
      preferredVisualMode: context.preferredVisualMode,
      projectRoot: input.projectRoot,
      sistema: context.sistema,
      direction: context.direction,
      session: semanticSession,
    })
    const resolved = await resolveMotionGraphicsSceneV2({
      base,
      projectRoot: String(input.projectRoot),
      videoStyleId: context.videoStyleId,
      session: visualSession,
      ...(input.pixabayApiKey ? { pixabayApiKey: input.pixabayApiKey } : {}),
      ...(context.lockedChoices.length ? { lockedChoices: context.lockedChoices } : {}),
      ...(input.hooks ? { hooks: input.hooks } : {}),
    })
    output.push({
      context: { ...context, lockedChoices: resolved.lockedChoices },
      resolved,
    })
  }
  return output
}
