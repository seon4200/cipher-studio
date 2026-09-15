import { canonicalNarrativeTerm } from '../../shared/asset-intent'
import type { ProjectAssetRecord } from '../../shared/project-state'
import { readAssetStorage } from '../services/project-persistence'
import {
  resolveSceneDensityV2,
  fullSubjectBounds,
  type SubjectBoundsV1,
  type VisualDirectionV1,
} from '../../shared/visual-scene-spec'
import {
  createRoleMotionV2,
  validateVisualSceneSpecV2,
  visualRevisionsV2,
  type EditorialTextV2,
  type PresentSceneSlotV2,
  type ProceduralSceneSlotV2,
  type RenderBindingsV2,
  type SceneSlotV2,
  type VisualAssetKindV2,
  type VisualSceneSpecV2,
} from '../../shared/visual-scene-spec-v2'
import {
  selectVisualPresentationV4,
  type ModernLayoutStructureV4,
} from '../../shared/visual-layout-v4'
import {
  VIDEO_VISUAL_STYLES_V1,
  materializeVideoVisualStyleV1,
  type VideoVisualStyleIdV1,
} from '../../shared/visual-style-v1'
import { materializeBackgroundProfileV1 } from '../../shared/background-profile-v1'
import {
  materializeSceneColorPaletteV1,
  selectVideoColorPalettePlanV1,
} from '../../shared/color-palette-selection-v1'
import {
  validateSceneColorPaletteV1,
  validateVideoColorPalettePlanV1,
  type SceneColorPaletteV1,
  type VideoColorPalettePlanV1,
} from '../../shared/color-palette-v1'
import {
  relevanceAdmitsRoleV1,
  relevanceAllowsHeroPromotionV1,
  type RelevanceVerdictV1,
} from '../../shared/semantic-relevance-gate-v1'
import type { VisualConceptV1 } from '../../shared/visual-concepts'
import { visualConceptCanBeHeroV1, type VisualConceptEligibilityV1 } from '../../shared/visual-concept-hygiene'
import type { LocalSemanticVisualDecisionResultV1 } from './semantic-decision'
import {
  deriveEditorialTextV2,
} from './asset-resolver'
import type { VisualRetrievalCandidateV1 } from './visual-retrieval'
import {
  resolveAssetRepresentationPreferenceV1,
  type AssetRepresentationPreferenceV1,
} from './asset-representation'
import {
  materializePhotoCutoutV1,
  type CutoutRuntimeConfigV1,
  type CutoutTransformHooksV1,
} from './cutout-transform'
import { publishOpenMojiAsset, verifyProjectAssetContent } from './openmoji/publish'
import {
  buildPixabayImageSearchPlansV1,
  downloadPixabayImageBytesV1,
  findReusablePixabayImageAssetV1,
  publishPixabayImageAssetV1,
  readVerifiedRasterProjectAssetContentV1,
  pixabayCandidateAdmissibleV1,
  searchPixabayImagesV1,
  selectPixabayImageCandidateV1,
  type PixabayImageCandidateV1,
  type PixabayRequestBytesV1,
  type PixabayRequestJsonV1,
  type PixabayTransportOutcomeV1,
} from './pixabay-images'

export const MOTION_GRAPHICS_RESOLVER_VERSION = 2 as const

export type MaterializedVisualChoiceV2 = {
  /**
   * Semantic Asset Relevance Gate V1 verdict that admitted this choice.  Diagnostics only:
   * `compileV2` builds every SceneSlot field by field and `lockChoice` enumerates what it
   * persists, so this never reaches SceneSpec, RenderBindings, PixelIdentity or project state.
   * Absent means the choice came from a path that carries its own verification (a restored
   * locked choice), not that it was judged and passed.
   */
  relevance?: RelevanceVerdictV1
  /** Concept Hygiene routing state. Resolver-only; never locked or copied to a SceneSpec. */
  conceptEligibility?: Exclude<VisualConceptEligibilityV1, 'not-visual'>
  slotId: 'hero' | 'support-1' | 'support-2'
  concept: string
  provider: 'openmoji' | 'pixabay-images' | 'photo-cutout' | 'solar'
  representation: AssetRepresentationPreferenceV1
  reason: string
  score: 2 | 3
  asset?: ProjectAssetRecord
  stableId?: string
  solarIcon?: string
  solarStyle?: 'linear' | 'bold-duotone'
  bounds: SubjectBoundsV1
  kind: VisualAssetKindV2
  alphaMode: 'vector' | 'useful-alpha' | 'opaque-rectangle'
}

export type LockedVisualChoiceV2 = {
  slotId: MaterializedVisualChoiceV2['slotId']
  concept: string
  provider: MaterializedVisualChoiceV2['provider']
  /** Absent only on V15 contexts persisted before Photo Cutout Production V1. */
  representation?: AssetRepresentationPreferenceV1
  reason: string
  score: 2 | 3
  assetId?: string
  relativeFile?: string
  sha256?: string
  mime?: string
  stableId?: string
  solarIcon?: string
  solarStyle?: 'linear' | 'bold-duotone'
  bounds: SubjectBoundsV1
  kind: VisualAssetKindV2
  alphaMode: MaterializedVisualChoiceV2['alphaMode']
}

export type MotionGraphicsResolverSessionV2 = {
  version: typeof MOTION_GRAPHICS_RESOLVER_VERSION
  recentFamilies: ModernLayoutStructureV4[]
  recentTypographyLooks: import('../../shared/visual-layout-v3').TypographyLookIdV3[]
  colorPalettePlan?: VideoColorPalettePlanV1
  recentAccentPrimaries: string[]
  scenesResolved: number
  preparedByConcept: Map<string, MaterializedVisualChoiceV2>
}

export type MotionGraphicsTraceV2 = {
  version: typeof MOTION_GRAPHICS_RESOLVER_VERSION
  sceneId: string
  concepts: Array<{ role: 'hero' | 'support-1' | 'support-2'; concept: string; subject: string; evidence: string }>
  roleDecisions: Array<{ role: string; concept: string; provider: string | null; identity: string | null; reason: string; score: number | null
    relevanceClass?: string; relevanceFocus?: number; relevanceEvidence?: readonly string[]; rejectionReason?: string | null }>
  representation: Array<{ role: string; concept: string; preference: AssetRepresentationPreferenceV1; reason: string; outcome: string }>
  pixabay: Array<{ concept: string; query: string; candidates: number; selected: string | null; outcome: string
    relevanceClass?: string; relevanceFocus?: number; rejectedByRelevance?: number }>
  family: ModernLayoutStructureV4
  videoStyleId: VideoVisualStyleIdV1
  colorPalette: {
    videoPrimaryFamily: string
    family: string
    variant: string
    accentPrimary: string
  }
  fallback: string | null
  warnings: string[]
}

export type MotionGraphicsCompiledV2 = {
  sceneSpec: VisualSceneSpecV2
  renderBindings: RenderBindingsV2
  graphicData: { type: 'visual_escena'; value: string; extra: { sceneSpec: VisualSceneSpecV2 } }
}

export type MotionGraphicsResolutionV2 = {
  base: LocalSemanticVisualDecisionResultV1
  choices: MaterializedVisualChoiceV2[]
  lockedChoices: LockedVisualChoiceV2[]
  compiled: MotionGraphicsCompiledV2
  trace: MotionGraphicsTraceV2
  metrics: {
    pixabayQueries: number
    pixabayDownloads: number
    pixabayPublished: number
    pixabayReused: number
    openMojiPublished: number
    openMojiReused: number
    supportsMaterialized: number
    photoCutoutHero: number
    photoCutoutSupport: number
    fullRasterHero: number
    fullRasterSupport: number
    openMojiHero: number
    openMojiSupport: number
    solarHero: number
    solarSupport: number
    editorialOnly: number
    cutoutAttempted: number
    cutoutInferenceExecuted: number
    cutoutSourceAlphaReused: number
    cutoutRuntimeErrors: number
    cutoutUsable: number
    cutoutSuspicious: number
    cutoutFailed: number
    cutoutCacheHit: number
    cutoutProcessingMs: number[]
    /** Semantic Asset Relevance Gate V1. Diagnostics; never part of any cache key. */
    candidatesEvaluated: number
    relevanceExact: number
    relevanceStrong: number
    relevanceRelated: number
    relevanceWeak: number
    relevanceUnrelated: number
    relevanceRejected: number
    acceptedHero: number
    acceptedSupport: number
    photoRejectedBeforeCutout: number
    photoCutoutAttempted: number
    heroPromotionBlockedByRelevance: number
  }
}

/**
 * Project-local diagnostics only.  It deliberately aggregates decisions after resolution and is
 * never copied into SceneSpec, RenderBindings, PixelIdentity or the renderer cache key.
 */
export type MotionGraphicsVideoMetricsV2 = {
  visualScenes: number
  photoCutoutHero: number
  photoCutoutSupport: number
  fullRasterHero: number
  fullRasterSupport: number
  openMojiHero: number
  openMojiSupport: number
  solarHero: number
  solarSupport: number
  editorialOnly: number
  cutoutAttempted: number
  cutoutInferenceExecuted: number
  cutoutSourceAlphaReused: number
  cutoutRuntimeErrors: number
  cutoutUsable: number
  cutoutSuspicious: number
  cutoutFailed: number
  cutoutCacheHit: number
  averageCutoutMs: number | null
  p95CutoutMs: number | null
}

export function summarizeMotionGraphicsVideoMetricsV2(
  resolutions: readonly Pick<MotionGraphicsResolutionV2, 'metrics'>[],
): MotionGraphicsVideoMetricsV2 {
  const totals = {
    visualScenes: resolutions.length,
    photoCutoutHero: 0, photoCutoutSupport: 0, fullRasterHero: 0, fullRasterSupport: 0,
    openMojiHero: 0, openMojiSupport: 0, solarHero: 0, solarSupport: 0, editorialOnly: 0,
    cutoutAttempted: 0, cutoutInferenceExecuted: 0, cutoutSourceAlphaReused: 0, cutoutRuntimeErrors: 0,
    cutoutUsable: 0, cutoutSuspicious: 0, cutoutFailed: 0, cutoutCacheHit: 0,
  }
  const times: number[] = []
  for (const { metrics } of resolutions) {
    totals.photoCutoutHero += metrics.photoCutoutHero; totals.photoCutoutSupport += metrics.photoCutoutSupport
    totals.fullRasterHero += metrics.fullRasterHero; totals.fullRasterSupport += metrics.fullRasterSupport
    totals.openMojiHero += metrics.openMojiHero; totals.openMojiSupport += metrics.openMojiSupport
    totals.solarHero += metrics.solarHero; totals.solarSupport += metrics.solarSupport
    totals.editorialOnly += metrics.editorialOnly; totals.cutoutAttempted += metrics.cutoutAttempted
    totals.cutoutInferenceExecuted += metrics.cutoutInferenceExecuted
    totals.cutoutSourceAlphaReused += metrics.cutoutSourceAlphaReused
    totals.cutoutRuntimeErrors += metrics.cutoutRuntimeErrors
    totals.cutoutUsable += metrics.cutoutUsable; totals.cutoutSuspicious += metrics.cutoutSuspicious
    totals.cutoutFailed += metrics.cutoutFailed; totals.cutoutCacheHit += metrics.cutoutCacheHit
    times.push(...metrics.cutoutProcessingMs.filter(value => Number.isFinite(value) && value >= 0))
  }
  const sorted = [...times].sort((a, b) => a - b)
  const averageCutoutMs = sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : null
  const p95CutoutMs = sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * .95) - 1)] : null
  return { ...totals, averageCutoutMs, p95CutoutMs }
}

export type MotionGraphicsProviderHooksV2 = {
  searchRequestJson?: PixabayRequestJsonV1
  downloadRequestBytes?: PixabayRequestBytesV1
  cutout?: CutoutTransformHooksV1
  cutoutRuntime?: CutoutRuntimeConfigV1 | null
}

export class MotionGraphicsResolverError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'MotionGraphicsResolverError'
  }
}

function fail(code: string, message: string, details: Record<string, unknown> = {}): never {
  throw new MotionGraphicsResolverError(code, message, details)
}

function pixabayOutcome(error: unknown): Exclude<PixabayTransportOutcomeV1, 'OK' | 'NO_RESULTS' | 'NO_USABLE_RESULT'> {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : ''
  if (code === 'HTTP_429' || code === 'TIMEOUT' || code === 'INVALID_RESPONSE') return code
  return 'NETWORK_ERROR'
}

export function createMotionGraphicsResolverSessionV2(
  colorPalettePlan?: VideoColorPalettePlanV1,
): MotionGraphicsResolverSessionV2 {
  return {
    version: MOTION_GRAPHICS_RESOLVER_VERSION,
    recentFamilies: [],
    recentTypographyLooks: [],
    ...(colorPalettePlan ? { colorPalettePlan: validateVideoColorPalettePlanV1(colorPalettePlan) } : {}),
    recentAccentPrimaries: [],
    scenesResolved: 0,
    preparedByConcept: new Map(),
  }
}

function manifestAsset(projectRoot: string, assetId: string): ProjectAssetRecord | null {
  const storage = readAssetStorage(projectRoot)
  if (storage.status !== 'valid' && storage.status !== 'recovered-from-backup') return null
  return storage.manifest.assets.find(asset => asset.id === assetId) ?? null
}

function lockChoice(choice: MaterializedVisualChoiceV2): LockedVisualChoiceV2 {
  return {
    slotId: choice.slotId, concept: choice.concept, provider: choice.provider, reason: choice.reason,
    representation: choice.representation, score: choice.score, ...(choice.asset ? { assetId: choice.asset.id, relativeFile: choice.asset.relativeFile,
      sha256: choice.asset.sha256, mime: choice.asset.mime } : {}),
    ...(choice.stableId ? { stableId: choice.stableId } : {}),
    ...(choice.solarIcon ? { solarIcon: choice.solarIcon, solarStyle: choice.solarStyle } : {}),
    bounds: choice.bounds, kind: choice.kind, alphaMode: choice.alphaMode,
  }
}

function restoreLockedChoice(projectRoot: string, locked: LockedVisualChoiceV2): MaterializedVisualChoiceV2 | null {
  if (locked.provider === 'solar') {
    if (!locked.solarIcon || !locked.solarStyle) return null
    return { ...locked, provider: 'solar', representation: locked.representation ?? 'symbolic',
      solarIcon: locked.solarIcon, solarStyle: locked.solarStyle }
  }
  if (!locked.assetId || !locked.relativeFile || !locked.sha256 || !locked.mime) return null
  const asset = manifestAsset(projectRoot, locked.assetId)
  if (!asset || asset.relativeFile !== locked.relativeFile || asset.sha256 !== locked.sha256 || asset.mime !== locked.mime) return null
  try {
    if (locked.provider === 'openmoji') verifyProjectAssetContent(projectRoot, asset)
    else readVerifiedRasterProjectAssetContentV1(projectRoot, asset)
  } catch { return null }
  return { ...locked, representation: locked.representation ??
    (locked.provider === 'pixabay-images' ? 'full-raster' : 'photo-cutout'), asset }
}

function kindForConcept(concept: VisualConceptV1): VisualAssetKindV2 {
  return concept.subject === 'person' || concept.subject === 'place' || concept.subject === 'event'
    ? 'complex-illustration' : 'simple-icon'
}

function openMojiChoice(input: {
  projectRoot: string
  slotId: MaterializedVisualChoiceV2['slotId']
  concept: VisualConceptV1
  candidate: VisualRetrievalCandidateV1
  representation?: Extract<AssetRepresentationPreferenceV1, 'icon' | 'symbolic'>
}): MaterializedVisualChoiceV2 | null {
  if (!input.candidate.stableId) return null
  try {
    const published = publishOpenMojiAsset({ projectRoot: input.projectRoot, stableId: input.candidate.stableId })
    return {
      ...(input.candidate.relevance ? { relevance: input.candidate.relevance } : {}),
      slotId: input.slotId, concept: input.concept.normalizedTerm, provider: 'openmoji',
      representation: input.representation ?? 'icon',
      reason: `${input.candidate.reason}:${published.status}`, score: input.candidate.score >= 3 ? 3 : 2,
      asset: published.asset, stableId: input.candidate.stableId, bounds: fullSubjectBounds(),
      kind: kindForConcept(input.concept), alphaMode: 'vector',
    }
  } catch { return null }
}

function solarChoice(input: {
  slotId: MaterializedVisualChoiceV2['slotId']
  concept: VisualConceptV1
  candidate: VisualRetrievalCandidateV1
  representation?: Extract<AssetRepresentationPreferenceV1, 'icon' | 'symbolic'>
}): MaterializedVisualChoiceV2 | null {
  const icon = input.candidate.solarVariant
  if (!icon) return null
  return {
    ...(input.candidate.relevance ? { relevance: input.candidate.relevance } : {}),
    slotId: input.slotId, concept: input.concept.normalizedTerm, provider: 'solar',
    representation: input.representation ?? 'symbolic',
    reason: input.candidate.reason, score: input.candidate.score >= 3 ? 3 : 2,
    solarIcon: icon, solarStyle: icon.endsWith('-bold-duotone') ? 'bold-duotone' : 'linear',
    bounds: fullSubjectBounds(), kind: 'simple-icon', alphaMode: 'vector',
  }
}

async function pixabayChoice(input: {
  projectRoot: string
  slotId: MaterializedVisualChoiceV2['slotId']
  concept: VisualConceptV1
  siblingConcepts: readonly VisualConceptV1[]
  representation: 'photo-cutout' | 'full-raster'
  apiKey?: string
  hooks?: MotionGraphicsProviderHooksV2
  trace: MotionGraphicsTraceV2['pixabay']
  metrics: MotionGraphicsResolutionV2['metrics']
}): Promise<MaterializedVisualChoiceV2 | null> {
  if (!input.apiKey && !input.hooks?.searchRequestJson) return null
  const plans = buildPixabayImageSearchPlansV1({ concept: input.concept, level: 'exact',
    role: input.slotId === 'hero' ? 'hero' : 'support', representation: input.representation, maxPlans: 3,
    siblingConcepts: input.siblingConcepts })
  // A cutout that fails the cheap alpha gate does not prove that every photo candidate for the
  // concept is unusable. Keep one honest full-raster fallback, but first try the other bounded,
  // already-ranked candidates. This remains a small on-demand search; it never harvests.
  let fallbackRaster: MaterializedVisualChoiceV2 | null = null
  const preparedSources = new Map<string, ProjectAssetRecord>()
  const evaluatedCutoutSources = new Set<string>()
  for (const plan of plans.slice(0, 2)) {
    let searched
    input.metrics.pixabayQueries++
    try {
      searched = await searchPixabayImagesV1({ plan, apiKey: input.apiKey,
        ...(input.hooks?.searchRequestJson ? { requestJson: input.hooks.searchRequestJson } : {}) })
    } catch (error) {
      input.trace.push({ concept: input.concept.normalizedTerm, query: plan.query, candidates: 0,
        selected: null, outcome: pixabayOutcome(error) })
      continue
    }
    // SEMANTIC ASSET RELEVANCE GATE V1.  Admission happens here, on the raw hit, so an
    // irrelevant photo costs neither a download nor a background-removal pass.  The gate only
    // removes candidates; `rankPixabayImageCandidatesV1` still decides the order of survivors.
    input.metrics.candidatesEvaluated += searched.candidates.length
    for (const candidate of searched.candidates) {
      const verdict = candidate.ranking.relevance.relevanceClass
      if (verdict === 'EXACT') input.metrics.relevanceExact++
      else if (verdict === 'STRONG') input.metrics.relevanceStrong++
      else if (verdict === 'RELATED') input.metrics.relevanceRelated++
      else if (verdict === 'WEAK') input.metrics.relevanceWeak++
      else input.metrics.relevanceUnrelated++
    }
    const admissible = searched.candidates.filter(pixabayCandidateAdmissibleV1)
    const rejectedHere = searched.candidates.length - admissible.length
    input.metrics.relevanceRejected += rejectedHere
    if (input.representation === 'photo-cutout') input.metrics.photoRejectedBeforeCutout += rejectedHere
    const ranked = admissible.slice(0, 3)
    const selected = selectPixabayImageCandidateV1(ranked)
    input.trace.push({ concept: input.concept.normalizedTerm, query: plan.query,
      candidates: searched.candidates.length, selected: selected?.id ?? null,
      outcome: selected ? 'CANDIDATE_SELECTED' : searched.outcome,
      rejectedByRelevance: rejectedHere,
      ...(selected ? { relevanceClass: selected.ranking.relevance.relevanceClass,
        relevanceFocus: selected.ranking.relevance.relevanceFocus } : {}) })
    if (!selected) continue
    const candidates: PixabayImageCandidateV1[] = [selected, ...ranked.filter(candidate => candidate.id !== selected.id)].slice(0, 2)
    for (const candidate of candidates) {
      let sourceAsset: ProjectAssetRecord
      let sourceReused = false
      const sourceKey = `${candidate.pageUrl}\n${candidate.downloadUrl}`
      const prepared = preparedSources.get(sourceKey)
      if (prepared) {
        readVerifiedRasterProjectAssetContentV1(input.projectRoot, prepared)
        sourceAsset = prepared
        sourceReused = true
        input.metrics.pixabayReused++
      } else {
        const reusable = findReusablePixabayImageAssetV1(input.projectRoot, candidate)
        if (reusable.asset) {
          readVerifiedRasterProjectAssetContentV1(input.projectRoot, reusable.asset)
          sourceAsset = reusable.asset
          sourceReused = true
          input.metrics.pixabayReused++
        } else {
          if (reusable.invalid) continue
          try {
            const sourceBytes = await downloadPixabayImageBytesV1({ candidate,
              ...(input.hooks?.downloadRequestBytes ? { requestBytes: input.hooks.downloadRequestBytes } : {}) })
            input.metrics.pixabayDownloads++
            const published = publishPixabayImageAssetV1({ projectRoot: input.projectRoot, candidate, bytes: sourceBytes })
            input.metrics.pixabayPublished += published.status === 'created' ? 1 : 0
            input.metrics.pixabayReused += published.status === 'reused' ? 1 : 0
            sourceReused = published.status === 'reused'
            sourceAsset = published.asset
          } catch (error) {
            input.trace.push({ concept: input.concept.normalizedTerm, query: plan.query,
              candidates: searched.candidates.length, selected: candidate.id,
              outcome: error && typeof error === 'object' && 'code' in error
                ? String((error as { code: unknown }).code) : 'NETWORK_ERROR' })
            continue
          }
        }
        preparedSources.set(sourceKey, sourceAsset)
      }
      const score = candidate.score >= 3 ? 3 as const : 2 as const
      if (input.representation === 'full-raster') {
        return {
          relevance: candidate.ranking.relevance,
          slotId: input.slotId, concept: input.concept.normalizedTerm, provider: 'pixabay-images',
          representation: 'full-raster', reason: sourceReused ? 'PIXABAY_FULL_RASTER_REUSED' : 'PIXABAY_FULL_RASTER_PREPARED',
          score, asset: sourceAsset, bounds: fullSubjectBounds(), kind: 'raster-image', alphaMode: 'opaque-rectangle',
        }
      }
      if (evaluatedCutoutSources.has(sourceAsset.sha256)) {
        input.trace.push({ concept: input.concept.normalizedTerm, query: plan.query,
          candidates: searched.candidates.length, selected: candidate.id,
          outcome: 'PHOTO_CUTOUT_SOURCE_ALREADY_EVALUATED' })
        continue
      }
      evaluatedCutoutSources.add(sourceAsset.sha256)
      const cutout = await materializePhotoCutoutV1({ projectRoot: input.projectRoot, sourceAsset,
        ...(input.hooks?.cutoutRuntime !== undefined ? { runtime: input.hooks.cutoutRuntime } : {}),
        ...(input.hooks?.cutout ? { hooks: input.hooks.cutout } : {}) })
      if (cutout.attempted) { input.metrics.cutoutAttempted++; input.metrics.photoCutoutAttempted++ }
      if (cutout.inferenceExecuted) input.metrics.cutoutInferenceExecuted++
      if (cutout.reason.startsWith('CUTOUT_SOURCE_ALREADY_HAS_ALPHA:')) input.metrics.cutoutSourceAlphaReused++
      if (cutout.warnings.some(value => value === 'CUTOUT_RUNTIME_UNAVAILABLE' ||
          value.startsWith('CUTOUT_INTERPRETER_') || value.startsWith('CUTOUT_WORKER_') ||
          value.startsWith('CUTOUT_MODEL_') || value === 'CUTOUT_RUNTIME_NOT_CONFIGURED'))
        input.metrics.cutoutRuntimeErrors++
      if (cutout.quality === 'CUTOUT_USABLE') input.metrics.cutoutUsable++
      else if (cutout.quality === 'CUTOUT_SUSPICIOUS') input.metrics.cutoutSuspicious++
      else input.metrics.cutoutFailed++
      if (cutout.cacheHit) input.metrics.cutoutCacheHit++
      // Alpha already present and cache hits do not run inference; keep their outcome counters
      // but exclude zero milliseconds from the actual CutoutTransform timing distribution.
      if (cutout.attempted && !cutout.cacheHit && cutout.processingMs !== null)
        input.metrics.cutoutProcessingMs.push(cutout.processingMs)
      if (cutout.status === 'usable' && cutout.asset && cutout.bounds) {
        input.trace.push({ concept: input.concept.normalizedTerm, query: plan.query,
          candidates: searched.candidates.length, selected: candidate.id,
          outcome: cutout.cacheHit ? 'PHOTO_CUTOUT_CACHE_REUSED' : 'PHOTO_CUTOUT_USABLE' })
        return {
          relevance: candidate.ranking.relevance,
          slotId: input.slotId, concept: input.concept.normalizedTerm, provider: 'photo-cutout',
          representation: 'photo-cutout', reason: `PHOTO_CUTOUT:${cutout.reason}`,
          score, asset: cutout.asset, bounds: cutout.bounds, kind: 'photo-cutout', alphaMode: 'useful-alpha',
        }
      }
      // V1 deliberately does not auto-run ISNet after a suspicious or failed transform.  The
      // provider source remains a valid, original-colour contextual resource when the family can
      // honestly render a full raster, so the scene never becomes broken merely because alpha did.
      input.trace.push({ concept: input.concept.normalizedTerm, query: plan.query,
        candidates: searched.candidates.length, selected: candidate.id,
        outcome: `PHOTO_CUTOUT_FALLBACK_FULL_RASTER:${cutout.reason}` })
      fallbackRaster ??= {
        relevance: candidate.ranking.relevance,
        slotId: input.slotId, concept: input.concept.normalizedTerm, provider: 'pixabay-images',
        representation: 'full-raster', reason: `PHOTO_CUTOUT_FALLBACK_FULL_RASTER:${cutout.reason}`,
        score, asset: sourceAsset, bounds: fullSubjectBounds(), kind: 'raster-image', alphaMode: 'opaque-rectangle',
      }
    }
  }
  return fallbackRaster
}

function localCandidate(
  base: LocalSemanticVisualDecisionResultV1,
  concept: VisualConceptV1,
  role: MaterializedVisualChoiceV2['slotId'],
  provider?: 'openmoji' | 'solar',
): VisualRetrievalCandidateV1 | null {
  // A retrieval candidate without a verdict predates the gate (or came from a path that does not
  // emit one); it keeps its previous behaviour instead of being rejected for missing evidence.
  const admissible = (candidate: VisualRetrievalCandidateV1): boolean => candidate.relevance === undefined ||
    relevanceAdmitsRoleV1(candidate.relevance.relevanceClass, role === 'hero' ? 'hero' : 'support')
  const candidates = (base.trace.retrieval?.candidates ?? []).filter(candidate =>
    candidate.concept === concept.normalizedTerm && candidate.score >= 2 && admissible(candidate) &&
    (!provider || candidate.provider === provider) && candidate.provider !== 'pixabay-images')
  return [...candidates].sort((a, b) => b.score - a.score ||
    (a.provider === 'openmoji' ? -1 : 1) || a.identity.localeCompare(b.identity, 'en'))[0] ?? null
}

function recordForV1Hero(projectRoot: string, base: LocalSemanticVisualDecisionResultV1): ProjectAssetRecord | null {
  const hero = base.decision.hero
  if (!hero || hero.provider !== 'openmoji') return null
  const record = manifestAsset(projectRoot, hero.assetId)
  if (!record || record.sha256 !== hero.sha256 || record.relativeFile !== hero.relativeFile) return null
  try { verifyProjectAssetContent(projectRoot, record); return record } catch { return null }
}

function v1HeroChoice(input: {
  projectRoot: string
  base: LocalSemanticVisualDecisionResultV1
  role: { slotId: MaterializedVisualChoiceV2['slotId']; concept: VisualConceptV1 }
  representation: 'icon' | 'symbolic'
}): MaterializedVisualChoiceV2 | null {
  if (input.role.slotId !== 'hero') return null
  const selected = input.base.trace.retrieval?.selectedHero
  if (selected?.concept !== input.role.concept.normalizedTerm) return null
  // The V1 engine chose this before the gate existed; it may only be reused as a Hero when the
  // gate would have admitted it as one.  A missing verdict keeps the prior behaviour.
  if (selected.relevance && !relevanceAdmitsRoleV1(selected.relevance.relevanceClass, 'hero')) return null
  const hero = input.base.decision.hero
  if (!hero) return null
  if (input.representation === 'icon' && hero.provider === 'openmoji') {
    const asset = recordForV1Hero(input.projectRoot, input.base)
    if (!asset) return null
    return {
      ...(selected.relevance ? { relevance: selected.relevance } : {}),
      slotId: 'hero', concept: input.role.concept.normalizedTerm, provider: 'openmoji', representation: 'icon',
      reason: selected.reason?.startsWith('HERO_PROMOTED_')
        ? `C_PRIMARY_OPENMOJI_REUSED:${selected.reason}` : 'C_PRIMARY_OPENMOJI_REUSED',
      score: 3, asset, stableId: hero.stableId, bounds: fullSubjectBounds(), kind: hero.kind, alphaMode: 'vector',
    }
  }
  if (input.representation === 'symbolic' && hero.provider === 'solar') {
    return {
      ...(selected.relevance ? { relevance: selected.relevance } : {}),
      slotId: 'hero', concept: input.role.concept.normalizedTerm, provider: 'solar', representation: 'symbolic',
      reason: selected.reason?.startsWith('HERO_PROMOTED_')
        ? `C_PRIMARY_SOLAR:${selected.reason}` : 'C_PRIMARY_SOLAR',
      score: 3, solarIcon: hero.solarName, solarStyle: hero.solarStyle,
      bounds: fullSubjectBounds(), kind: 'simple-icon', alphaMode: 'vector',
    }
  }
  return null
}

function localChoiceForRepresentation(input: {
  projectRoot: string
  base: LocalSemanticVisualDecisionResultV1
  role: { slotId: MaterializedVisualChoiceV2['slotId']; concept: VisualConceptV1 }
  representation: 'icon' | 'symbolic'
}): MaterializedVisualChoiceV2 | null {
  const remembered = v1HeroChoice(input)
  if (remembered) return remembered
  const providerOrder: Array<'openmoji' | 'solar'> = input.representation === 'icon'
    ? ['openmoji', 'solar'] : ['solar', 'openmoji']
  for (const provider of providerOrder) {
    const candidate = localCandidate(input.base, input.role.concept, input.role.slotId, provider)
    if (!candidate) continue
    const choice = provider === 'openmoji'
      ? openMojiChoice({ projectRoot: input.projectRoot, ...input.role, candidate, representation: input.representation })
      : solarChoice({ ...input.role, candidate, representation: input.representation })
    if (choice) return choice
  }
  return null
}

function isRasterChoice(choice: MaterializedVisualChoiceV2): boolean {
  return choice.provider === 'pixabay-images' || choice.provider === 'photo-cutout'
}

function hasDuplicateChoice(choices: readonly MaterializedVisualChoiceV2[], candidate: MaterializedVisualChoiceV2): boolean {
  const identity = candidate.asset?.sha256 ?? candidate.solarIcon
  return choices.some(existing => existing.provider === candidate.provider &&
    (existing.asset?.sha256 ?? existing.solarIcon) === identity)
}

function roleConcepts(base: LocalSemanticVisualDecisionResultV1): Array<{
  slotId: MaterializedVisualChoiceV2['slotId']; concept: VisualConceptV1
}> {
  const set = base.trace.retrieval?.concepts
  const values = [set?.primary, set?.secondary, set?.tertiary].filter((value): value is VisualConceptV1 => !!value)
  const selectedConcept = base.trace.retrieval?.selectedHero?.concept
  const selected = selectedConcept ? values.find(concept => concept.normalizedTerm === selectedConcept && visualConceptCanBeHeroV1(concept)) : undefined
  // Hygiene makes hero eligibility explicit. A support-only action/abstraction never occupies the
  // primary slot just because it happens to be first in narration or has a lexical candidate.
  const hero = selected ?? values.find(visualConceptCanBeHeroV1)
  if (!hero) return []
  const ordered = [hero, ...values.filter(concept => concept !== hero)]
  return ordered.map((concept, index) => ({ slotId: index === 0 ? 'hero' : index === 1 ? 'support-1' : 'support-2', concept }))
}

/**
 * A local transcript token is useful when semantic analysis had no stronger scene concept, but
 * it must not become a third photo merely because it is a searchable verb beside two structured
 * concepts from the same subclip.  This is a materialisation gate, not a mutation of semantic
 * selection: the token remains traceable and can still be used when it is the only local evidence.
 */
function weakTokenShadowedByStructuredConcept(
  role: { slotId: MaterializedVisualChoiceV2['slotId']; concept: VisualConceptV1 },
  allRoles: readonly { slotId: MaterializedVisualChoiceV2['slotId']; concept: VisualConceptV1 }[],
): boolean {
  return role.concept.evidence === 'direct-timed-token' && role.concept.importance === 1 &&
    allRoles.some(other => other !== role && other.concept.evidence === 'direct-timed-concept')
}

function lockedConceptBelongsToScene(base: LocalSemanticVisualDecisionResultV1, roleInputs: ReturnType<typeof roleConcepts>, concept: string): boolean {
  const expected = canonicalNarrativeTerm(concept)
  if (!expected) return false
  return roleInputs.some(role => role.concept.normalizedTerm === expected) ||
    base.localSemantic.concepts.some(value => canonicalNarrativeTerm(value.label) === expected) ||
    base.localSemantic.localTokens.some(value => canonicalNarrativeTerm(value.text) === expected) ||
    canonicalNarrativeTerm(base.keywordSelection.keyword) === expected
}

function promoteBestSupportToHero(choices: readonly MaterializedVisualChoiceV2[]): MaterializedVisualChoiceV2[] {
  const existingHero = choices.find(choice => choice.slotId === 'hero')
  if (existingHero) {
    return [existingHero, ...choices.filter(choice => choice !== existingHero)
      .sort((a, b) => a.slotId.localeCompare(b.slotId, 'en'))
      .map((choice, index) => ({ ...choice, slotId: index === 0 ? 'support-1' as const : 'support-2' as const }))]
  }
  // SEMANTIC ASSET RELEVANCE GATE V1.  Only EXACT|STRONG may be promoted.  A RELATED asset is
  // an honest Support, but promoting it would make the weakest admissible evidence carry the
  // whole scene, which is precisely the filler the product rule rejects.
  const promotable = choices.filter(choice => choice.conceptEligibility !== 'support-only' &&
    relevanceAllowsHeroPromotionV1(choice.relevance?.relevanceClass))
  const support = [...promotable].sort((a, b) => b.score - a.score ||
    (a.provider === 'openmoji' ? -1 : b.provider === 'openmoji' ? 1 : 0) ||
    a.slotId.localeCompare(b.slotId, 'en'))[0]
  // Supports exist to support a Hero.  With nothing defendible enough to anchor the scene, V15
  // says so and renders editorial text rather than assembling a scene out of secondary material.
  if (!support) return []
  const remaining = choices.filter(choice => choice !== support)
  return [
    { ...support, slotId: 'hero', reason: `HERO_PROMOTED_FROM_${support.slotId.toUpperCase()}:${support.reason}` },
    ...remaining.map((choice, index) => ({ ...choice, slotId: index === 0 ? 'support-1' as const : 'support-2' as const })),
  ]
}

function textFor(
  base: LocalSemanticVisualDecisionResultV1,
  presentation: ReturnType<typeof selectVisualPresentationV4>,
  visualMode: 'asset-led' | 'editorial-text',
): EditorialTextV2 {
  const old = deriveEditorialTextV2({ localText: base.localSemantic.localText,
    keyword: base.keywordSelection.keyword, visualMode,
    structure: base.decision.structure })
  const keywordPreset = presentation.family === 'rayosImpacto' ? 'scale-punch'
    : presentation.family === 'cuaderno' || presentation.family === 'lineaTiempo' ? 'underline-reveal'
      : 'slide-reveal'
  return {
    ...(old.connector ? { connector: old.connector } : {}), keyword: old.keyword,
    ...(old.closing ? { closing: old.closing } : {}), alignment: presentation.layout.textAlignment,
    maxLines: old.maxLines, typographyLookId: presentation.typographyLookId,
    timing: old.timing,
    motion: { secondaryPreset: 'fade-slide', keywordPreset, emphasisStart: .52 },
  }
}

function compileV2(input: {
  base: LocalSemanticVisualDecisionResultV1
  choices: MaterializedVisualChoiceV2[]
  videoStyleId: VideoVisualStyleIdV1
  colorPalette: SceneColorPaletteV1
  session: MotionGraphicsResolverSessionV2
}): MotionGraphicsCompiledV2 {
  const hero = input.choices.find(choice => choice.slotId === 'hero')
  const supports = input.choices.filter(choice => choice.slotId !== 'hero')
  const visualMode = hero ? 'asset-led' : 'editorial-text'
  const directionV1 = input.base.compiled.sceneSpec.direccion
  const styleDefinition = VIDEO_VISUAL_STYLES_V1[input.videoStyleId]
  const presentation = selectVisualPresentationV4({
    sceneId: input.base.decision.sceneId, visualMode, supportCount: supports.length,
    relation: input.base.localSemantic.relation, density: directionV1.densidad, rhythm: directionV1.ritmo,
    seed: directionV1.semilla, allowedTypographyLooks: styleDefinition.allowedTypographyLooks,
    recentFamilies: input.session.recentFamilies, recentTypographyLooks: input.session.recentTypographyLooks,
  })
  const text = textFor(input.base, presentation, visualMode)
  const visibleWords = [text.connector, text.keyword, text.closing].filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length
  const density = resolveSceneDensityV2({ localText: input.base.localSemantic.localText, visualMode,
    heroState: hero ? (hero.provider === 'solar' ? 'procedural' : 'present') : 'none',
    actualElementCount: 1 + input.choices.length + (text.connector ? 1 : 0) + (text.closing ? 1 : 0),
    visibleWordCount: visibleWords, lineCount: text.maxLines, rhythm: directionV1.ritmo,
    structure: directionV1.estructura, supportCount: supports.length })
  const energy = density === 'alta' || density === 'saturada' ? 'high' : density === 'media' ? 'medium' : 'low'
  const slots: SceneSlotV2[] = input.choices.map(choice => {
    const motion = createRoleMotionV2({ role: choice.slotId, energy, emphasis: choice.slotId === 'hero' })
    if (choice.provider === 'solar') {
      if (!choice.solarIcon || !choice.solarStyle) fail('MOTION_GRAPHICS_SOLAR_INVALID', 'Solar sin identidad materializada')
      const slot: ProceduralSceneSlotV2 = { slotId: choice.slotId, role: choice.slotId, state: 'procedural',
        kind: 'simple-icon', solarIcon: choice.solarIcon, solarStyle: choice.solarStyle, bounds: choice.bounds,
        fitPolicy: 'contain', tint: { treatment: 'system-tint' }, motion }
      return slot
    }
    if (!choice.asset) fail('MOTION_GRAPHICS_ASSET_INVALID', 'ProjectAsset no materializado')
    const slot: PresentSceneSlotV2 = {
      slotId: choice.slotId, role: choice.slotId, state: 'present', sha256: choice.asset.sha256,
      mime: choice.asset.mime as PresentSceneSlotV2['mime'], kind: choice.kind, alphaMode: choice.alphaMode,
      bounds: choice.bounds, fitPolicy: choice.alphaMode === 'opaque-rectangle' ? 'cover' :
        choice.alphaMode === 'useful-alpha' ? 'subject-contain' : 'contain',
      tint: { treatment: 'original-color' }, motion,
    }
    return slot
  })
  const direction = {
    fondo: directionV1.fondo,
    estructura: presentation.family,
    camara: 'quieto' as VisualDirectionV1['camara'],
    densidad: density,
    ritmo: directionV1.ritmo,
    semilla: directionV1.semilla,
  }
  const sceneSpec = validateVisualSceneSpecV2({
    renderSpecVersion: 2, visualMode, renderTier: 'standard', sistema: input.base.compiled.sceneSpec.sistema,
    direccion: direction,
    videoStyle: materializeVideoVisualStyleV1({ videoStyleId: input.videoStyleId,
      sceneId: input.base.decision.sceneId, seed: directionV1.semilla }),
    backgroundProfile: materializeBackgroundProfileV1('solid-black-v1'),
    colorPalette: input.colorPalette,
    layout: presentation.layout, text, slots, revisions: visualRevisionsV2(), fallbackVisual: 'editorial-text',
  })
  const renderBindings: RenderBindingsV2 = { version: 2, assets: input.choices.filter(choice => choice.asset).map(choice => ({
    slotId: choice.slotId, assetId: choice.asset!.id, relativeFile: choice.asset!.relativeFile,
  })) }
  input.session.recentFamilies.push(presentation.family)
  input.session.recentTypographyLooks.push(presentation.typographyLookId)
  if (input.session.recentFamilies.length > 18) input.session.recentFamilies.shift()
  if (input.session.recentTypographyLooks.length > 18) input.session.recentTypographyLooks.shift()
  return { sceneSpec, renderBindings,
    graphicData: { type: 'visual_escena', value: text.keyword, extra: { sceneSpec } } }
}

export async function resolveMotionGraphicsSceneV2(input: {
  base: LocalSemanticVisualDecisionResultV1
  projectRoot: string
  videoStyleId: VideoVisualStyleIdV1
  session?: MotionGraphicsResolverSessionV2
  colorPalettePlan?: VideoColorPalettePlanV1
  sceneIndex?: number
  lockedColorPalette?: SceneColorPaletteV1
  pixabayApiKey?: string
  lockedChoices?: readonly LockedVisualChoiceV2[]
  hooks?: MotionGraphicsProviderHooksV2
}): Promise<MotionGraphicsResolutionV2> {
  const session = input.session ?? createMotionGraphicsResolverSessionV2()
  if (session.version !== 2) fail('MOTION_GRAPHICS_SESSION_INVALID', 'Sesión V15 inválida')
  const roleInputs = roleConcepts(input.base)
  const colorTerms = [
    ...roleInputs.map(value => value.concept.normalizedTerm),
    ...input.base.localSemantic.concepts.map(value => value.label),
    input.base.localSemantic.anchor,
    input.base.localSemantic.relation,
    input.base.localSemantic.localText,
  ].filter((value): value is string => typeof value === 'string' && !!value.trim())
  const lockedPlan = input.lockedColorPalette ? validateSceneColorPaletteV1(input.lockedColorPalette) : undefined
  const inferredFromLocked: VideoColorPalettePlanV1 | undefined = lockedPlan ? {
    version: 1,
    primaryFamily: lockedPlan.videoPrimaryFamily,
    compatibleFamilies: [...lockedPlan.videoCompatibleFamilies],
    revision: lockedPlan.revision,
  } : undefined
  const colorPalettePlan = validateVideoColorPalettePlanV1(input.colorPalettePlan ?? session.colorPalettePlan ??
    inferredFromLocked ?? selectVideoColorPalettePlanV1({ terms: colorTerms, seed: input.base.compiled.sceneSpec.direccion.semilla }).plan)
  if (session.colorPalettePlan && JSON.stringify(session.colorPalettePlan) !== JSON.stringify(colorPalettePlan))
    fail('MOTION_GRAPHICS_COLOR_PLAN_MISMATCH', 'Una sesión V15 no puede mezclar gamas de vídeo')
  session.colorPalettePlan = colorPalettePlan
  const sceneIndex = input.sceneIndex ?? session.scenesResolved
  const colorPalette = lockedPlan ?? materializeSceneColorPaletteV1({
    plan: colorPalettePlan,
    sceneId: input.base.decision.sceneId,
    sceneIndex,
    terms: colorTerms,
    recentAccentPrimaries: session.recentAccentPrimaries,
  })
  if (colorPalette.videoPrimaryFamily !== colorPalettePlan.primaryFamily ||
      JSON.stringify(colorPalette.videoCompatibleFamilies) !== JSON.stringify(colorPalettePlan.compatibleFamilies))
    fail('MOTION_GRAPHICS_COLOR_PLAN_MISMATCH', 'La decisión cromática persistida no pertenece a la gama del vídeo')
  const trace: MotionGraphicsTraceV2 = {
    version: 2, sceneId: input.base.decision.sceneId,
    concepts: roleInputs.map(value => ({ role: value.slotId, concept: value.concept.normalizedTerm,
      subject: value.concept.subject, evidence: value.concept.evidence })),
    roleDecisions: [], representation: [], pixabay: [], family: 'editorial', videoStyleId: input.videoStyleId,
    colorPalette: {
      videoPrimaryFamily: colorPalette.videoPrimaryFamily,
      family: colorPalette.family,
      variant: colorPalette.variant,
      accentPrimary: colorPalette.tokens.accentPrimary,
    },
    fallback: null, warnings: [],
  }
  const metrics: MotionGraphicsResolutionV2['metrics'] = {
    pixabayQueries: 0, pixabayDownloads: 0, pixabayPublished: 0, pixabayReused: 0,
    openMojiPublished: 0, openMojiReused: 0, supportsMaterialized: 0,
    photoCutoutHero: 0, photoCutoutSupport: 0, fullRasterHero: 0, fullRasterSupport: 0,
    openMojiHero: 0, openMojiSupport: 0, solarHero: 0, solarSupport: 0, editorialOnly: 0,
    cutoutAttempted: 0, cutoutInferenceExecuted: 0, cutoutSourceAlphaReused: 0, cutoutRuntimeErrors: 0,
    cutoutUsable: 0, cutoutSuspicious: 0, cutoutFailed: 0,
    cutoutCacheHit: 0, cutoutProcessingMs: [],
    candidatesEvaluated: 0, relevanceExact: 0, relevanceStrong: 0, relevanceRelated: 0,
    relevanceWeak: 0, relevanceUnrelated: 0, relevanceRejected: 0,
    acceptedHero: 0, acceptedSupport: 0, photoRejectedBeforeCutout: 0, photoCutoutAttempted: 0,
    heroPromotionBlockedByRelevance: 0,
  }
  const choices: MaterializedVisualChoiceV2[] = []

  if (input.lockedChoices?.length) {
    for (const locked of input.lockedChoices) {
      const expected = roleInputs.find(role => role.slotId === locked.slotId)
      if ((!expected || expected.concept.normalizedTerm !== locked.concept) &&
          !lockedConceptBelongsToScene(input.base, roleInputs, locked.concept))
        fail('MOTION_GRAPHICS_LOCKED_CONTEXT_MISMATCH', 'La elección persistida no pertenece al contexto semántico actual', {
          slotId: locked.slotId,
        })
      const restored = restoreLockedChoice(input.projectRoot, locked)
      if (!restored) fail('MOTION_GRAPHICS_LOCKED_ASSET_INVALID', 'Una elección persistida ya no verifica', { slotId: locked.slotId })
      choices.push(restored)
      trace.roleDecisions.push({ role: locked.slotId, concept: locked.concept, provider: locked.provider,
        identity: restored.asset?.sha256 ?? restored.solarIcon ?? null, reason: `LOCKED:${locked.reason}`, score: locked.score })
      trace.representation.push({ role: locked.slotId, concept: locked.concept,
        preference: restored.representation, reason: 'LOCKED_REPRESENTATION', outcome: 'LOCKED_RESTORED' })
    }
    if (choices.filter(isRasterChoice).length > 2)
      fail('MOTION_GRAPHICS_RASTER_BUDGET_EXCEEDED', 'Una escena admite máximo dos assets raster')
    const identities = choices.map(choice => choice.asset?.sha256 ?? `solar:${choice.solarIcon}`)
    if (new Set(identities).size !== identities.length)
      fail('MOTION_GRAPHICS_DUPLICATE_ASSET', 'Una elección persistida repite el mismo asset en varios slots')
  } else if (input.base.decision.intent.preferredVisualMode === 'editorial-text') {
    // Only an explicitly editorial intent is authoritative here. The older V1 resolver can
    // label an AUTO scene editorial because it had no one-Hero result; V15 must still let its
    // structured same-subclip concepts try the modern resource cascade in that case.
    for (const role of roleInputs) {
      const representation = resolveAssetRepresentationPreferenceV1({ concept: role.concept, role: role.slotId })
      trace.representation.push({ role: role.slotId, concept: role.concept.normalizedTerm,
        preference: representation.preference, reason: representation.reason, outcome: 'EDITORIAL_INTENTIONAL' })
      trace.roleDecisions.push({ role: role.slotId, concept: role.concept.normalizedTerm, provider: null,
        identity: null, reason: 'EDITORIAL_INTENTIONAL', score: null })
    }
    trace.fallback = 'EDITORIAL_INTENTIONAL'
  } else {
    for (const role of roleInputs) {
      let choice: MaterializedVisualChoiceV2 | null = null
      const representation = resolveAssetRepresentationPreferenceV1({ concept: role.concept, role: role.slotId })
      if (weakTokenShadowedByStructuredConcept(role, roleInputs)) {
        trace.representation.push({ role: role.slotId, concept: role.concept.normalizedTerm,
          preference: representation.preference, reason: representation.reason,
          outcome: 'WEAK_LOCAL_TOKEN_OMITTED_WHILE_STRUCTURED_CONCEPTS_EXIST' })
        trace.roleDecisions.push({ role: role.slotId, concept: role.concept.normalizedTerm, provider: null,
          identity: null, reason: 'WEAK_LOCAL_TOKEN_OMITTED_WHILE_STRUCTURED_CONCEPTS_EXIST', score: null })
        continue
      }
      let outcome = 'NO_DEFENDIBLE_RESOURCE'
      for (const attempt of representation.attemptOrder) {
        if (attempt === 'editorial') {
          outcome = choice ? 'MATERIALIZED' : 'EDITORIAL_FALLBACK'
          break
        }
        if (attempt === 'photo-cutout' || attempt === 'full-raster') {
          if (choices.filter(isRasterChoice).length >= 2) {
            outcome = 'RASTER_BUDGET_EXHAUSTED'
            continue
          }
          choice = await pixabayChoice({ projectRoot: input.projectRoot, slotId: role.slotId, concept: role.concept,
            siblingConcepts: roleInputs.filter(other => other !== role).map(other => other.concept),
            representation: attempt, apiKey: input.pixabayApiKey, hooks: input.hooks, trace: trace.pixabay, metrics })
        } else if (attempt === 'icon' || attempt === 'symbolic') {
          choice = localChoiceForRepresentation({ projectRoot: input.projectRoot, base: input.base, role, representation: attempt })
        }
        if (choice) {
          choice = { ...choice, conceptEligibility: role.concept.hygiene?.eligibility === 'support-only'
            ? 'support-only' : 'hero-eligible' }
          outcome = `MATERIALIZED:${choice.provider}:${choice.representation}`
          break
        }
        outcome = `NO_${attempt.toUpperCase().replace('-', '_')}_RESOURCE`
      }
      trace.representation.push({ role: role.slotId, concept: role.concept.normalizedTerm,
        preference: representation.preference, reason: representation.reason, outcome })
      if (choice && !hasDuplicateChoice(choices, choice)) {
        choices.push(choice)
        session.preparedByConcept.set(role.concept.normalizedTerm, choice)
        if (choice.provider === 'openmoji') {
          if (choice.reason.endsWith(':created')) metrics.openMojiPublished++
          else metrics.openMojiReused++
        }
      } else if (choice) trace.warnings.push('DUPLICATE_SEMANTIC_ASSET_OMITTED:' + role.slotId)
      trace.roleDecisions.push({ role: role.slotId, concept: role.concept.normalizedTerm,
        provider: choice?.provider ?? null, identity: choice?.asset?.sha256 ?? choice?.solarIcon ?? null,
        reason: choice?.reason ?? 'NO_DEFENDIBLE_RESOURCE', score: choice?.score ?? null,
        ...(choice?.relevance ? { relevanceClass: choice.relevance.relevanceClass,
          relevanceFocus: choice.relevance.relevanceFocus,
          relevanceEvidence: choice.relevance.relevanceEvidence,
          rejectionReason: choice.relevance.rejectionReason } : {}) })
    }
  }
  // A semantically strong secondary/tertiary resource may anchor the scene when the first
  // concept has no defendible asset. Promotion stays within the same subclip and is persisted.
  const effectiveChoices = promoteBestSupportToHero(choices)
  const hasHero = effectiveChoices.some(choice => choice.slotId === 'hero')
  if (choices.length && !effectiveChoices.length) {
    metrics.heroPromotionBlockedByRelevance++
    trace.warnings.push('HERO_PROMOTION_BLOCKED_BY_RELEVANCE_GATE')
  }
  if (!choices.some(choice => choice.slotId === 'hero') && hasHero) {
    const promoted = effectiveChoices.find(choice => choice.slotId === 'hero')!
    trace.roleDecisions.push({ role: 'hero', concept: promoted.concept, provider: promoted.provider,
      identity: promoted.asset?.sha256 ?? promoted.solarIcon ?? null, reason: promoted.reason, score: promoted.score })
    trace.warnings.push('HERO_PROMOTED_FROM_VALID_SAME_SCENE_CONCEPT')
  }
  metrics.supportsMaterialized = effectiveChoices.filter(choice => choice.slotId !== 'hero').length
  metrics.acceptedHero = effectiveChoices.filter(choice => choice.slotId === 'hero').length
  metrics.acceptedSupport = metrics.supportsMaterialized
  for (const choice of effectiveChoices) {
    const hero = choice.slotId === 'hero'
    if (choice.provider === 'photo-cutout') {
      if (hero) metrics.photoCutoutHero++; else metrics.photoCutoutSupport++
    } else if (choice.provider === 'pixabay-images') {
      if (hero) metrics.fullRasterHero++; else metrics.fullRasterSupport++
    } else if (choice.provider === 'openmoji') {
      if (hero) metrics.openMojiHero++; else metrics.openMojiSupport++
    } else if (choice.provider === 'solar') {
      if (hero) metrics.solarHero++; else metrics.solarSupport++
    }
  }
  metrics.editorialOnly = hasHero ? 0 : 1
  if (!hasHero) trace.fallback = 'EDITORIAL_NO_DEFENDIBLE_HERO'
  const compiled = compileV2({ base: input.base, choices: effectiveChoices, videoStyleId: input.videoStyleId,
    colorPalette, session })
  session.recentAccentPrimaries.push(colorPalette.tokens.accentPrimary)
  if (session.recentAccentPrimaries.length > 12) session.recentAccentPrimaries.shift()
  session.scenesResolved++
  trace.family = compiled.sceneSpec.layout.family
  return { base: input.base, choices: effectiveChoices, lockedChoices: effectiveChoices.map(lockChoice),
    compiled, trace, metrics }
}
