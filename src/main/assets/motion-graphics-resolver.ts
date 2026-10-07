import { canonicalNarrativeTerm } from '../../shared/asset-intent'
import { MODERN_VISUAL_PACK_V1, validateModernVisualAssetIdentityV1, validateModernVisualPackSelectionV1, type ModernVisualPackSelectionV1, type ModernVisualAssetIdentityV1 } from '../../shared/modern-visual-pack-v1'
import { createCompositeVisualCatalogV1, type CompositeVisualCatalog, findModernVisualPackCandidatesV1, publishModernVisualPackAssetV1, modernVisualPackCatalogV1, type ModernPackLookupAuditV1 } from './modern-visual-pack'
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
  eligibleLayoutFamiliesV4,
  type ModernLayoutStructureV4,
} from '../../shared/visual-layout-v4'
import {
  EDITORIAL_MOTION_PROFILE_V2,
  VISUAL_RECOVERY_PROFILE_V1,
  PREMIUM_TYPE_COLOR_PROFILE_V1,
  FAMILIES_MOTION_PROFILE_V2,
  createEditorialPilotLayoutV1,
  createEditorialPilotLayoutV2,
  createVisualRecoveryLayoutV1,
  selectEditorialPilotFamilyV1,
  type EditorialMotionCue,
  type EditorialMotionProfile,
} from '../../shared/editorial-motion-profile-v1'
import { createCompositionLayoutV2, selectCompositionV2,
  type BackgroundVariantV2 } from '../../shared/families-motion-v2'
import { selectPremiumStyleV1 } from '../../shared/premium-type-color-v1'
import { EDITORIAL_EXPLAINER_LIGHT_V1, createLightLayoutV1, makeLightDataRepeaterV1,
  type LightStyleV1 } from '../../shared/editorial-explainer-light-v1'
import { EDITORIAL_EXPLAINER_LIGHT_V2, createLightLayoutV2, type LightStyleV2 } from '../../shared/editorial-explainer-light-v2'
import { EDITORIAL_EXPLAINER_V3, createLightLayoutV3, type EditorialV3Placement, type LightStyleV3 } from '../../shared/editorial-explainer-v3'
import {
  VIDEO_VISUAL_STYLES_V1,
  materializeVideoVisualStyleV1,
  type VideoVisualStyleIdV1,
} from '../../shared/visual-style-v1'
import { materializeBackgroundProfileV1 } from '../../shared/background-profile-v1'
import { selectVisualRecoveryTypographyV1 } from '../../shared/visual-recovery-typography-v1'
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
import { publishOpenMojiAsset, verifyProjectAssetContent } from './openmoji/publish'
import {
  buildPixabayImageSearchPlansV1,
  downloadPixabayImageBytesV1,
  findReusablePixabayImageAssetV1,
  publishPixabayImageAssetV1,
  readVerifiedRasterProjectAssetContentV1,
  pixabayCandidateAdmissibleV1,
  rankPixabayImageCandidatesV1,
  searchPixabayImagesV1,
  type PixabayImageCandidateV1,
  type PixabayRequestBytesV1,
  type PixabayRequestJsonV1,
  type PixabayTransportOutcomeV1,
} from './pixabay-images'

export const MOTION_GRAPHICS_RESOLVER_VERSION = 2 as const

/** Shared per-scene limits. Provider adapters retain their narrower per-call limits. */
export const PHOTO_SCENE_BUDGET_V1 = Object.freeze({ requests: 4, downloads: 4, transforms: 2 })
/** A single role may not consume the capacity reserved for another physical concept. */
export const PHOTO_ROLE_BUDGET_V1 = Object.freeze({ requests: 2, downloads: 2, transforms: 2 })

type PhotoSceneBudgetStateV1 = {
  requests: number
  downloads: number
  transforms: number
}

type PhotoRoleBudgetStateV1 = PhotoSceneBudgetStateV1

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
  /** Provider identity for deterministic per-video variety. Diagnostics only; never locked. */
  providerAssetId?: string
  slotId: 'hero' | 'support-1' | 'support-2'
  concept: string
  provider: 'openmoji' | 'pixabay-images' | 'photo-cutout' | 'solar' | 'modern-pack' | 'editorial-pilot-raster'
  catalogAsset?: ModernVisualAssetIdentityV1
  originalColor?: boolean
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
  catalogAsset?: ModernVisualAssetIdentityV1
  originalColor?: boolean
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
  recentBackgroundVariants?: BackgroundVariantV2[]
  colorPalettePlan?: VideoColorPalettePlanV1
  recentAccentPrimaries: string[]
  scenesResolved: number
  preparedByConcept: Map<string, MaterializedVisualChoiceV2>
  recentPhotoProviderAssetIds: string[]
  recentPhotoAssetShas: string[]
  recentModernAssetIds?: string[]
  localVisualCatalog?: CompositeVisualCatalog
  catalogStyleFamily?: string
  catalogCollection?: string
}

export type MotionGraphicsTraceV2 = {
  modernPack?: ModernPackLookupAuditV1
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
    photoOpportunities: number
    photoPlans: number
    photoRequests: number
    photoRetriesObserved: number
    photoDownloads: number
    photoTransformCalls: number
    photoBudgetExhausted: number
    photoNetworkMs: number[]
    finalPhotoAssetShas: string[]
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
  photoOpportunities: number
  photoPlans: number
  photoRequests: number
  photoRetriesObserved: number
  photoDownloads: number
  photoTransformCalls: number
  photoBudgetExhausted: number
  candidatesEvaluated: number
  relevanceRejected: number
  uniquePhotoAssets: number
  reusedPhotoAssets: number
  averagePhotoNetworkMs: number | null
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
    photoOpportunities: 0, photoPlans: 0, photoRequests: 0, photoRetriesObserved: 0,
    photoDownloads: 0, photoTransformCalls: 0, photoBudgetExhausted: 0,
    candidatesEvaluated: 0, relevanceRejected: 0,
  }
  const times: number[] = []
  const networkTimes: number[] = []
  const photoAssets: string[] = []
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
    totals.photoOpportunities += metrics.photoOpportunities; totals.photoPlans += metrics.photoPlans
    totals.photoRequests += metrics.photoRequests; totals.photoRetriesObserved += metrics.photoRetriesObserved
    totals.photoDownloads += metrics.photoDownloads; totals.photoTransformCalls += metrics.photoTransformCalls
    totals.photoBudgetExhausted += metrics.photoBudgetExhausted
    totals.candidatesEvaluated += metrics.candidatesEvaluated; totals.relevanceRejected += metrics.relevanceRejected
    times.push(...metrics.cutoutProcessingMs.filter(value => Number.isFinite(value) && value >= 0))
    networkTimes.push(...metrics.photoNetworkMs.filter(value => Number.isFinite(value) && value >= 0))
    photoAssets.push(...metrics.finalPhotoAssetShas)
  }
  const sorted = [...times].sort((a, b) => a - b)
  const averageCutoutMs = sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : null
  const p95CutoutMs = sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * .95) - 1)] : null
  const averagePhotoNetworkMs = networkTimes.length
    ? networkTimes.reduce((sum, value) => sum + value, 0) / networkTimes.length : null
  const uniquePhotoAssets = new Set(photoAssets).size
  return { ...totals, averageCutoutMs, p95CutoutMs, uniquePhotoAssets,
    reusedPhotoAssets: Math.max(0, photoAssets.length - uniquePhotoAssets), averagePhotoNetworkMs }
}

export type MotionGraphicsProviderHooksV2 = {
  searchRequestJson?: PixabayRequestJsonV1
  downloadRequestBytes?: PixabayRequestBytesV1
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
    recentBackgroundVariants: [],
    ...(colorPalettePlan ? { colorPalettePlan: validateVideoColorPalettePlanV1(colorPalettePlan) } : {}),
    recentAccentPrimaries: [],
    scenesResolved: 0,
    preparedByConcept: new Map(),
    recentPhotoProviderAssetIds: [],
    recentPhotoAssetShas: [],
  }
}

function samePhotoDefensibility(a: PixabayImageCandidateV1, b: PixabayImageCandidateV1): boolean {
  return a.ranking.relevance.relevanceClass === b.ranking.relevance.relevanceClass &&
    a.ranking.semantic === b.ranking.semantic && a.score === b.score &&
    Math.abs(a.ranking.total - b.ranking.total) <= 3
}

function selectPhotoCandidateWithVarietyV1(
  candidates: readonly PixabayImageCandidateV1[],
  recentProviderAssetIds: ReadonlySet<string>,
): { candidate: PixabayImageCandidateV1 | null; outcome: 'DEFAULT' | 'ALTERNATIVE_FOR_VARIETY' | 'REUSE_UNAVOIDABLE' } {
  const ordered = rankPixabayImageCandidatesV1(candidates).filter(pixabayCandidateAdmissibleV1)
  const first = ordered[0]
  if (!first) return { candidate: null, outcome: 'DEFAULT' }
  if (!recentProviderAssetIds.has(first.id)) return { candidate: first, outcome: 'DEFAULT' }
  const alternative = ordered.find(candidate => !recentProviderAssetIds.has(candidate.id) &&
    samePhotoDefensibility(first, candidate))
  return alternative
    ? { candidate: alternative, outcome: 'ALTERNATIVE_FOR_VARIETY' }
    : { candidate: first, outcome: 'REUSE_UNAVOIDABLE' }
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
    ...(choice.catalogAsset ? { catalogAsset: choice.catalogAsset, originalColor: choice.originalColor } : {}),
    ...(choice.solarIcon ? { solarIcon: choice.solarIcon, solarStyle: choice.solarStyle } : {}),
    bounds: choice.bounds, kind: choice.kind, alphaMode: choice.alphaMode,
  }
}

function restoreLockedChoice(projectRoot: string, locked: LockedVisualChoiceV2): MaterializedVisualChoiceV2 | null {
  if (locked.provider === 'modern-pack') {
    try { validateModernVisualAssetIdentityV1(locked.catalogAsset) } catch { return null }
  }
  if (locked.provider === 'modern-pack' && !locked.catalogAsset?.id.startsWith('local-')) {
    const entry = modernVisualPackCatalogV1().find(a => a.assetId === locked.catalogAsset?.assetId)
    if (!entry || locked.catalogAsset?.id !== MODERN_VISUAL_PACK_V1.id || locked.catalogAsset.revision !== MODERN_VISUAL_PACK_V1.revision ||
        entry.sha256 !== locked.sha256 || entry.originalColor !== locked.originalColor ||
        locked.slotId === 'hero' && !entry.heroAllowed) return null
  }
  if (locked.provider === 'solar') {
    if (!locked.solarIcon || !locked.solarStyle) return null
    return { ...locked, provider: 'solar', representation: locked.representation ?? 'symbolic',
      solarIcon: locked.solarIcon, solarStyle: locked.solarStyle }
  }
  if (!locked.assetId || !locked.relativeFile || !locked.sha256 || !locked.mime) return null
  const asset = manifestAsset(projectRoot, locked.assetId)
  if (!asset || asset.relativeFile !== locked.relativeFile || asset.sha256 !== locked.sha256 || asset.mime !== locked.mime) return null
  if (locked.provider === 'editorial-pilot-raster' && (asset.provider !== 'editorial-pilot-raster' ||
      asset.validation.status !== 'accepted' || asset.validation.alphaUseful !== true || locked.alphaMode !== 'useful-alpha' ||
      locked.kind !== 'photo-cutout' || locked.representation !== 'photo-cutout')) return null
  if (locked.provider === 'modern-pack' && locked.catalogAsset?.id.startsWith('local-')) {
    // Restore the approved publication, not a mutable/removed external library.
    try { validateModernVisualAssetIdentityV1(locked.catalogAsset) } catch { return null }
    const snapshot = asset.source?.catalogSnapshot as { identity?: ModernVisualAssetIdentityV1; originalColor?: boolean; heroAllowed?: boolean; supportAllowed?: boolean } | undefined
    if (asset.provider !== 'modern-pack' || !snapshot || snapshot.identity?.id !== locked.catalogAsset.id ||
        snapshot.identity.revision !== locked.catalogAsset.revision || snapshot.identity.assetId !== locked.catalogAsset.assetId ||
        snapshot.originalColor !== locked.originalColor || (locked.slotId === 'hero' ? !snapshot.heroAllowed : !snapshot.supportAllowed)) return null
  }
  try {
    if (locked.provider === 'openmoji' || locked.provider === 'modern-pack') verifyProjectAssetContent(projectRoot, asset)
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
  budget: PhotoSceneBudgetStateV1
  recentPhotoProviderAssetIds: ReadonlySet<string>
  recentPhotoAssetShas: ReadonlySet<string>
  reserveForLaterPhotoRole: boolean
}): Promise<MaterializedVisualChoiceV2 | null> {
  if (!input.apiKey && !input.hooks?.searchRequestJson) return null
  const plans = buildPixabayImageSearchPlansV1({ concept: input.concept, level: 'exact',
    role: input.slotId === 'hero' ? 'hero' : 'support', representation: input.representation, maxPlans: 3,
    siblingConcepts: input.siblingConcepts })
  const boundedPlans = plans.slice(0, 2)
  input.metrics.photoPlans += boundedPlans.length
  // A cutout that fails the cheap alpha gate does not prove that every photo candidate for the
  // concept is unusable. Keep one honest full-raster fallback, but first try the other bounded,
  // already-ranked candidates. This remains a small on-demand search; it never harvests.
  let fallbackRaster: MaterializedVisualChoiceV2 | null = null
  const preparedSources = new Map<string, ProjectAssetRecord>()
  const roleBudget: PhotoRoleBudgetStateV1 = { requests: 0, downloads: 0, transforms: 0 }
  const sharedLimit = {
    requests: PHOTO_SCENE_BUDGET_V1.requests - (input.reserveForLaterPhotoRole ? 2 : 0),
    downloads: PHOTO_SCENE_BUDGET_V1.downloads - (input.reserveForLaterPhotoRole ? 2 : 0),
    transforms: PHOTO_SCENE_BUDGET_V1.transforms - (input.reserveForLaterPhotoRole ? 1 : 0),
  }
  for (const plan of boundedPlans) {
    if (input.budget.requests >= sharedLimit.requests || roleBudget.requests >= PHOTO_ROLE_BUDGET_V1.requests) {
      input.metrics.photoBudgetExhausted++
      input.trace.push({ concept: input.concept.normalizedTerm, query: plan.query, candidates: 0,
        selected: null, outcome: input.budget.requests >= sharedLimit.requests
          ? 'PHOTO_REQUEST_BUDGET_EXHAUSTED' : 'PHOTO_ROLE_REQUEST_BUDGET_EXHAUSTED' })
      break
    }
    let searched
    input.budget.requests++
    roleBudget.requests++
    input.metrics.photoRequests++
    input.metrics.pixabayQueries++
    const searchStarted = Date.now()
    try {
      const requestJson = input.hooks?.searchRequestJson
        ? async (url: URL, context?: Parameters<PixabayRequestJsonV1>[1]) => {
            if ((context?.attempt ?? 1) > 1) input.metrics.photoRetriesObserved++
            return await input.hooks!.searchRequestJson!(url, context)
          }
        : undefined
      searched = await searchPixabayImagesV1({ plan, apiKey: input.apiKey,
        ...(requestJson ? { requestJson } : {}) })
    } catch (error) {
      input.trace.push({ concept: input.concept.normalizedTerm, query: plan.query, candidates: 0,
        selected: null, outcome: pixabayOutcome(error) })
      continue
    } finally {
      input.metrics.photoNetworkMs.push(Date.now() - searchStarted)
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
    const selection = selectPhotoCandidateWithVarietyV1(ranked, input.recentPhotoProviderAssetIds)
    const selected = selection.candidate
    input.trace.push({ concept: input.concept.normalizedTerm, query: plan.query,
      candidates: searched.candidates.length, selected: selected?.id ?? null,
      outcome: selected ? selection.outcome === 'ALTERNATIVE_FOR_VARIETY'
        ? 'CANDIDATE_SELECTED_FOR_VARIETY' : selection.outcome === 'REUSE_UNAVOIDABLE'
          ? 'CANDIDATE_REUSE_UNAVOIDABLE' : 'CANDIDATE_SELECTED' : searched.outcome,
      rejectedByRelevance: rejectedHere,
      ...(selected ? { relevanceClass: selected.ranking.relevance.relevanceClass,
        relevanceFocus: selected.ranking.relevance.relevanceFocus } : {}) })
    if (!selected) continue
    const candidates: PixabayImageCandidateV1[] = [selected, ...ranked.filter(candidate => candidate.id !== selected.id)].slice(0, 2)
    for (const [candidateIndex, candidate] of candidates.entries()) {
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
          if (input.budget.downloads >= sharedLimit.downloads || roleBudget.downloads >= PHOTO_ROLE_BUDGET_V1.downloads) {
            input.metrics.photoBudgetExhausted++
            input.trace.push({ concept: input.concept.normalizedTerm, query: plan.query,
              candidates: searched.candidates.length, selected: candidate.id,
              outcome: input.budget.downloads >= sharedLimit.downloads
                ? 'PHOTO_DOWNLOAD_BUDGET_EXHAUSTED' : 'PHOTO_ROLE_DOWNLOAD_BUDGET_EXHAUSTED' })
            continue
          }
          input.budget.downloads++
          roleBudget.downloads++
          input.metrics.photoDownloads++
          const downloadStarted = Date.now()
          try {
            const requestBytes = input.hooks?.downloadRequestBytes
              ? async (url: URL, context?: Parameters<PixabayRequestBytesV1>[1]) => {
                  if ((context?.attempt ?? 1) > 1) input.metrics.photoRetriesObserved++
                  return await input.hooks!.downloadRequestBytes!(url, context)
                }
              : undefined
            const sourceBytes = await downloadPixabayImageBytesV1({ candidate,
              ...(requestBytes ? { requestBytes } : {}) })
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
          } finally {
            input.metrics.photoNetworkMs.push(Date.now() - downloadStarted)
          }
        }
        preparedSources.set(sourceKey, sourceAsset)
      }
      const contentWasRecentlyUsed = input.recentPhotoAssetShas.has(sourceAsset.sha256)
      const equallyDefensibleAlternative = candidates.slice(candidateIndex + 1)
        .some(other => samePhotoDefensibility(candidate, other))
      if (contentWasRecentlyUsed && equallyDefensibleAlternative) {
        input.trace.push({ concept: input.concept.normalizedTerm, query: plan.query,
          candidates: searched.candidates.length, selected: candidate.id,
          outcome: 'CANDIDATE_CONTENT_REUSE_DEFERRED_FOR_VARIETY' })
        continue
      }
      if (contentWasRecentlyUsed) {
        input.trace.push({ concept: input.concept.normalizedTerm, query: plan.query,
          candidates: searched.candidates.length, selected: candidate.id,
          outcome: 'CANDIDATE_CONTENT_REUSE_UNAVOIDABLE' })
      }
      const score = candidate.score >= 3 ? 3 as const : 2 as const
      if (input.representation === 'full-raster') {
        return {
          relevance: candidate.ranking.relevance,
          slotId: input.slotId, concept: input.concept.normalizedTerm, provider: 'pixabay-images',
          providerAssetId: candidate.id, representation: 'full-raster',
          reason: `${sourceReused ? 'PIXABAY_FULL_RASTER_REUSED' : 'PIXABAY_FULL_RASTER_PREPARED'}:${selection.outcome}`,
          score, asset: sourceAsset, bounds: fullSubjectBounds(), kind: 'raster-image', alphaMode: 'opaque-rectangle',
        }
      }
      input.trace.push({ concept: input.concept.normalizedTerm, query: plan.query,
        candidates: searched.candidates.length, selected: candidate.id,
        outcome: 'PHOTO_CUTOUT_DISABLED_WITH_RETIRED_VISUAL_ENGINE' })
      continue
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
  audit?: ModernPackLookupAuditV1
  visualAssetPack?: ModernVisualPackSelectionV1
  session: MotionGraphicsResolverSessionV2
  warnings: string[]
  projectRoot: string
  base: LocalSemanticVisualDecisionResultV1
  role: { slotId: MaterializedVisualChoiceV2['slotId']; concept: VisualConceptV1 }
  representation: 'icon' | 'symbolic'
}): MaterializedVisualChoiceV2 | null {
  const remembered = v1HeroChoice(input)
  // Direct evidence is never an automatic style preference. Keep Solar's symbolic route.
  const preserve = input.role.concept.hygieneAuthority === 'explicit-visual-evidence' ||
    input.representation === 'symbolic' && (remembered?.provider === 'solar' || !!localCandidate(input.base, input.role.concept, input.role.slotId, 'solar'))
  if (input.visualAssetPack && !preserve) {
    const catalog = input.visualAssetPack.localLibrary ? input.session.localVisualCatalog : undefined
    for (const candidate of findModernVisualPackCandidatesV1(input.role.concept,
      input.role.slotId === 'hero' ? 'hero' : 'support', input.session.recentModernAssetIds, input.audit, catalog,
      catalog ? input.session.catalogStyleFamily : undefined, catalog ? input.session.catalogCollection : undefined)) {
      try {
        const published = publishModernVisualPackAssetV1(input.projectRoot, candidate.asset.assetId, catalog)
        if (catalog) {
          input.session.catalogStyleFamily ??= candidate.asset.styleFamily
          input.session.catalogCollection ??= candidate.asset.collection
        }
        return { slotId: input.role.slotId, concept: input.role.concept.normalizedTerm,
          provider: 'modern-pack', representation: input.representation, score: 3,
          reason: `MODERN_PACK_EXACT_LOCAL:${candidate.asset.source}:${published.status}`,
          relevance: candidate.relevance, asset: published.asset,
          catalogAsset: candidate.identity,
          originalColor: candidate.asset.originalColor,
          conceptEligibility: candidate.asset.heroAllowed ? 'hero-eligible' : 'support-only',
          bounds: fullSubjectBounds(), kind: 'simple-icon', alphaMode: 'vector' }
      } catch (error) { input.warnings.push(`MODERN_PACK_ASSET_REJECTED:${candidate.asset.assetId}:${error instanceof Error ? error.message : 'invalid'}`) }
    }
  }
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
  return choice.provider === 'pixabay-images' || choice.provider === 'photo-cutout' || choice.provider === 'editorial-pilot-raster'
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
  presentationProfile?: EditorialMotionProfile
}): MotionGraphicsCompiledV2 {
  const hero = input.choices.find(choice => choice.slotId === 'hero')
  const supports = input.choices.filter(choice => choice.slotId !== 'hero')
  const visualMode = hero ? 'asset-led' : 'editorial-text'
  const familiesV2 = input.presentationProfile?.revision === FAMILIES_MOTION_PROFILE_V2.revision
  const lightV2 = input.presentationProfile?.revision === EDITORIAL_EXPLAINER_LIGHT_V2.revision
  const lightV3 = input.presentationProfile?.revision === EDITORIAL_EXPLAINER_V3.revision
  const light = input.presentationProfile?.revision === EDITORIAL_EXPLAINER_LIGHT_V1.revision || lightV2 || lightV3
  const premium = input.presentationProfile?.revision === PREMIUM_TYPE_COLOR_PROFILE_V1.revision || familiesV2
  const recovery = input.presentationProfile?.revision === VISUAL_RECOVERY_PROFILE_V1.revision || premium
  const refined = recovery || light || input.presentationProfile?.revision === EDITORIAL_MOTION_PROFILE_V2.revision
  const relation = (input.base.localSemantic.relation ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const lightCountLiteral = light && /\b\d{1,4}\s+(?:personas|participantes)\b/iu.test(input.base.localSemantic.localText)
  const editorialMotionCue: EditorialMotionCue = lightCountLiteral ? 'datum' : familiesV2 && /\b\d{1,3}(?:[.,]\d+)?\s*%/u.test(input.base.localSemantic.localText)
    ? 'datum' : !hero ? 'typographic'
    : /\b\d{1,3}(?:[.,]\d+)?\s*%/u.test(input.base.localSemantic.localText) ? 'datum'
      : /(compara|contrasta|diferenc)/.test(relation) && supports.length ? 'comparison'
        : /(secuencia|antes|despues|evoluciona|pasos)/.test(relation) && supports.length ? 'process'
          : /(causa|consecuencia|deriva|provoca)/.test(relation) && supports.length ? 'cause'
            : 'protagonist'
  const directionV1 = input.base.compiled.sceneSpec.direccion
  const styleDefinition = VIDEO_VISUAL_STYLES_V1[input.videoStyleId]
  const standardPresentation = selectVisualPresentationV4({
    sceneId: input.base.decision.sceneId, visualMode, supportCount: supports.length,
    relation: input.base.localSemantic.relation, density: directionV1.densidad, rhythm: directionV1.ritmo,
    seed: directionV1.semilla, allowedTypographyLooks: styleDefinition.allowedTypographyLooks,
    recentFamilies: input.session.recentFamilies, recentTypographyLooks: input.session.recentTypographyLooks,
  })
  const presentation = light ? (() => {
    const family = visualMode === 'editorial-text' ? 'editorial' as const : 'marcoPoster' as const
    const motionCue: LightStyleV1['motionCue'] = editorialMotionCue === 'comparison' ? 'compare'
      : editorialMotionCue === 'process' ? 'process' : editorialMotionCue === 'datum' ? 'count'
        : editorialMotionCue === 'cause' && supports.length ? 'transfer'
          : visualMode === 'editorial-text' ? 'statement' : 'hero'
    const placements:EditorialV3Placement[]=['top-left','right-of-hero','top-right','bottom-left','left-of-hero','full-type']
    const placement=placements[Math.abs(directionV1.semilla)%placements.length]
    return { family, typographyLookId: 'editorial-strong' as const,
      layout: lightV3 ? createLightLayoutV3(visualMode,supports.length,motionCue,'portrait',placement)
        : lightV2 ? createLightLayoutV2(visualMode, supports.length, motionCue, 'portrait')
        : createLightLayoutV1(visualMode, supports.length, motionCue, 'portrait') }
  })() : familiesV2 ? (() => {
    // The old eligibility authority remains decisive: relation-specific families
    // are only selected when the scene actually contains their required slots.
    const eligible = eligibleLayoutFamiliesV4({ visualMode, supportCount: supports.length,
      relation: input.base.localSemantic.relation })
    const family = hero?.kind === 'raster-image' && eligible.includes('marcoPoster') ? 'marcoPoster'
      : editorialMotionCue === 'comparison' && eligible.includes('partidoVertical') ? 'partidoVertical'
        : editorialMotionCue === 'process' && eligible.includes('lineaTiempo') &&
          /(secuencia|antes|despues|evoluciona)/.test(relation) ? 'lineaTiempo'
          : editorialMotionCue === 'cause' && eligible.includes('cascada') ? 'cascada'
            : standardPresentation.family
    return { family, typographyLookId: selectVisualRecoveryTypographyV1(input.colorPalette.videoPrimaryFamily).look,
      layout: createCompositionLayoutV2(family, visualMode, supports.length, directionV1.semilla,
        editorialMotionCue, hero?.kind, 'portrait') }
  })() : recovery ? (() => {
    // A video has one primary palette family, hence one primary/secondary font pairing.
    // The scene's keyword/data content may alter sizing but never randomly swaps typefaces.
    const family = standardPresentation.family
    const typographyLookId = selectVisualRecoveryTypographyV1(input.colorPalette.videoPrimaryFamily).look
    return { family, typographyLookId,
      layout: createVisualRecoveryLayoutV1(family, visualMode, supports.length, directionV1.semilla, editorialMotionCue) }
  })() : input.presentationProfile ? (() => {
    const selectedFamily = selectEditorialPilotFamilyV1({
      sceneId: input.base.decision.sceneId, visualMode, supportCount: supports.length,
      relation: input.base.localSemantic.relation, seed: directionV1.semilla,
      recentFamilies: input.session.recentFamilies,
    })
    const family = refined && (editorialMotionCue === 'datum' ||
      (hero?.alphaMode === 'opaque-rectangle' && hero.kind === 'raster-image'))
      ? 'marcoPoster' : selectedFamily
    return {
      family,
      layout: refined
        ? createEditorialPilotLayoutV2(family, visualMode, supports.length, directionV1.semilla, editorialMotionCue)
        : createEditorialPilotLayoutV1(family, visualMode, supports.length, directionV1.semilla),
      typographyLookId: family === 'partidoVertical' || family === 'cuaderno' || directionV1.semilla % 4 === 0
        ? 'technical-condensed' as const : 'editorial-strong' as const,
    }
  })() : standardPresentation
  let text = textFor(input.base, presentation, visualMode)
  if (lightV2 || lightV3) {
    // The pilot's short narration is the authority. V1 remains frozen, while V2
    // displays the literal pre/post-keyword fragments rather than losing its verb.
    const source = input.base.localSemantic.localText.trim()
    const offset = source.toLocaleLowerCase('es').indexOf(text.keyword.toLocaleLowerCase('es'))
    if (offset >= 0) {
      const connector = source.slice(0, offset).trim()
      const closing = source.slice(offset + text.keyword.length).trim()
      const words = [connector, text.keyword, closing].filter(Boolean).join(' ').split(/\s+/u).filter(Boolean)
      if (words.length <= 8) {
        const { connector: _oldConnector, closing: _oldClosing, ...remaining } = text
        text = { ...remaining, ...(connector ? { connector } : {}), ...(closing ? { closing } : {}),
          timing: { connectorStart: text.timing.connectorStart, keywordStart: text.timing.keywordStart,
            ...(closing ? { closingStart: Math.max(text.timing.keywordStart, .36) } : {}) },
        }
      }
    }
    const count = /\b(\d{1,4})\s+(personas|participantes)\b/iu.exec(source)
    if (count) {
      const before = source.slice(0, count.index).trim()
      const after = source.slice(count.index + count[1].length).trim()
      const { connector: _oldConnector, closing: _oldClosing, ...remaining } = text
      text = { ...remaining, keyword: count[1], ...(before ? { connector: before } : {}),
        ...(after ? { closing: after } : {}),
        timing: { connectorStart: text.timing.connectorStart, keywordStart: text.timing.keywordStart,
          ...(after ? { closingStart: Math.max(text.timing.keywordStart, .36) } : {}) },
      }
    }
  }
  // The historical short-text compiler may truncate a final clause. For the opt-in
  // text-led revision, retain a literal trailing fragment only when it fits the
  // existing eight-word contract; never fabricate or paraphrase narration.
  if (refined && visualMode === 'editorial-text' && text.closing) {
    const local = input.base.localSemantic.localText.trim()
    const endingAt = local.toLocaleLowerCase('es').lastIndexOf(text.closing.toLocaleLowerCase('es'))
    if (endingAt >= 0) {
      const suffix = local.slice(endingAt + text.closing.length).trim().replace(/[.!?]+$/u, '').trim()
      const candidate = `${text.closing} ${suffix}`.trim()
      const count = [text.connector, text.keyword, candidate].filter(Boolean).join(' ').split(/\s+/u).filter(Boolean).length
      if (suffix && count <= 8) text = { ...text, closing: candidate }
    }
  }
  const visibleWords = [text.connector, text.keyword, text.closing].filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length
  const literalPercent = input.presentationProfile && !text.closing && visibleWords <= 7
    ? /\b\d{1,3}(?:[.,]\d+)?\s*%/u.exec(input.base.localSemantic.localText)?.[0]
    : undefined
  const percentValue = literalPercent ? literalPercent.replace(/\s+%/, '%') : undefined
  const percentNumber = percentValue ? Number(percentValue.slice(0, -1).replace(',', '.')) : NaN
  const editorialData = percentValue && Number.isFinite(percentNumber) && percentNumber <= 100 &&
    text.keyword !== percentValue
    ? { revision: 'editorial-data-callout-v1' as const, value: percentValue, percent: percentNumber }
    : undefined
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
      bounds: choice.bounds, fitPolicy: choice.alphaMode === 'opaque-rectangle' ? (refined ? 'contain' : 'cover') :
        choice.alphaMode === 'useful-alpha' ? 'subject-contain' : 'contain',
      tint: { treatment: choice.catalogAsset && !choice.originalColor ? 'system-tint' : 'original-color' }, motion,
      ...(choice.catalogAsset ? { catalogAsset: choice.catalogAsset } : {}),
    }
    return slot
  })
  const lightMotionCue: LightStyleV1['motionCue'] = editorialMotionCue === 'comparison' ? 'compare'
    : editorialMotionCue === 'process' ? 'process' : editorialMotionCue === 'datum' ? 'count'
      : editorialMotionCue === 'cause' && supports.length ? 'transfer'
        : visualMode === 'editorial-text' ? 'statement' : 'hero'
  const dataLiteral = /\b(\d{1,4})\s+(personas|participantes)\b/iu.exec(input.base.localSemantic.localText)
  const dataRepeater = light && visualMode === 'editorial-text' && dataLiteral
    ? makeLightDataRepeaterV1(Number(dataLiteral[1]), dataLiteral[2].toLocaleLowerCase('es')) : null
  const heroOriginal = hero?.provider === 'openmoji' || !!hero?.originalColor || hero?.kind === 'photo-cutout' || hero?.kind === 'raster-image'
  const v3Placements:EditorialV3Placement[]=['top-left','right-of-hero','top-right','bottom-left','left-of-hero','full-type']
  const v3Placement=v3Placements[Math.abs(directionV1.semilla)%v3Placements.length]
  const baseLightStyle:LightStyleV1|LightStyleV2|undefined = light ? {
    revision: lightV2 ? EDITORIAL_EXPLAINER_LIGHT_V2.revision : EDITORIAL_EXPLAINER_LIGHT_V1.revision,
    background: (['ivory-clean', 'ivory-subtle-grid', 'white-soft-paper'] as const)[input.session.scenesResolved % 3],
    materialPreset: hero && hero.kind === 'simple-icon' ? 'raised-object' : 'flat-editorial',
    shadowPreset: 'upper-left-contact-ambient-v1',
    heroTile: !hero || hero.kind !== 'simple-icon' ? 'none'
      : heroOriginal ? 'neutral-raised' : 'orange-raised',
    iconTreatment: supports.length ? 'black-circle' : heroOriginal ? 'original-color' : 'orange-tile',
    connector: supports.length && (lightMotionCue === 'transfer' || lightMotionCue === 'compare' || lightMotionCue === 'process')
      ? { variant: lightMotionCue === 'transfer' ? 'curved' as const : 'straight' as const, state: 'draw' as const, arrow: lightMotionCue !== 'compare' } : null,
    motionCue: lightMotionCue, negativeSpace: 'intentional-editorial', dataRepeater,
    landscapeLayout: lightV2 ? createLightLayoutV2(visualMode, supports.length, lightMotionCue, 'landscape')
      : createLightLayoutV1(visualMode, supports.length, lightMotionCue, 'landscape'),
  } : undefined
  const lightStyle:LightStyleV1|LightStyleV2|LightStyleV3|undefined=lightV3?{
    ...baseLightStyle!, revision:EDITORIAL_EXPLAINER_V3.revision,
    artDirectionRevision:'editorial-explainer-art-direction-v3', accentTheme:'orange',
    compositionDensity: visualMode==='editorial-text'?'minimal':supports.length>1?'rich':'editorial',
    textPlacement:v3Placement, typeRole:lightMotionCue==='count'?'data-display':lightMotionCue==='statement'?'display-hero':'narrative',
    heroTreatment:!hero?'none':hero.kind==='raster-image'||hero.kind==='photo-cutout'?'composite-hero':'clean-hero',
    supportTreatment:supports.length>1?(lightMotionCue==='transfer'?'accent-tile':'paper-icon-card'):'black-micro-badge',
    connector:supports.length&&(lightMotionCue==='transfer'||lightMotionCue==='compare'||lightMotionCue==='process')
      ?{variant:lightMotionCue==='transfer'?'curved-wide':'curved-short',state:'draw',arrow:lightMotionCue!=='compare',dotAnchors:true}:null,
    microdetailPreset:visualMode==='editorial-text'?'editorial-2':supports.length>1?'rich-5':'technical-4',
    microdetailVariant:Math.abs(directionV1.semilla)%8,
    dataRepeaterVariant:dataRepeater?'compact-prominent-v3':'none',
    transitionVariant:(['fade-slide','paired-exit','stagger-out'] as const)[Math.abs(directionV1.semilla)%3],
    narrativeBeats:[{at:.05,target:'text'},{at:.16,target:'hero'},{at:.29,target:'support-1'},
      {at:.40,target:'support-2'},{at:.48,target:'connector'},{at:.58,target:dataRepeater?'data':'microdetails'}],
    landscapeLayout:createLightLayoutV3(visualMode,supports.length,lightMotionCue,'landscape',v3Placement),
  }:baseLightStyle
  const direction = {
    fondo: directionV1.fondo,
    estructura: presentation.family,
    camara: 'quieto' as VisualDirectionV1['camara'],
    densidad: density,
    ritmo: directionV1.ritmo,
    semilla: directionV1.semilla,
  }
  const compositionV2 = familiesV2 ? selectCompositionV2({ family: presentation.family, mode: visualMode,
    supportCount: supports.length, seed: directionV1.semilla, sceneId: input.base.decision.sceneId,
    cue: editorialMotionCue, heroKind: hero?.kind, videoPaletteFamily: input.colorPalette.videoPrimaryFamily,
    recentBackgrounds: input.session.recentBackgroundVariants }) : undefined
  const sceneSpec = validateVisualSceneSpecV2({
    renderSpecVersion: 2, visualMode, renderTier: 'standard', sistema: input.base.compiled.sceneSpec.sistema,
    direccion: direction,
    videoStyle: materializeVideoVisualStyleV1({ videoStyleId: input.videoStyleId,
      sceneId: input.base.decision.sceneId, seed: directionV1.semilla }),
    backgroundProfile: materializeBackgroundProfileV1('solid-black-v1'),
    // V1's vivid per-scene colors select the video theme upstream but do not enter
    // Porcelain's pixel contract: only the materialized neutral/accent tokens are visible.
    ...(!premium && !light ? { colorPalette: input.colorPalette } : {}),
    ...(premium ? { premiumStyle: selectPremiumStyleV1(input.colorPalette.videoPrimaryFamily,
      editorialMotionCue, text.keyword) } : {}),
    ...(compositionV2 ? { compositionV2 } : {}),
    ...(lightStyle ? { lightStyle } : {}),
    ...(input.presentationProfile ? { presentationProfile: input.presentationProfile } : {}),
    ...(refined ? { editorialMotionCue } : {}),
    ...(editorialData ? { editorialData } : {}),
    layout: presentation.layout, text, slots, revisions: visualRevisionsV2(), fallbackVisual: 'editorial-text',
  })
  const renderBindings: RenderBindingsV2 = { version: 2, assets: input.choices.filter(choice => choice.asset).map(choice => ({
    slotId: choice.slotId, assetId: choice.asset!.id, relativeFile: choice.asset!.relativeFile,
  })) }
  input.session.recentFamilies.push(presentation.family)
  input.session.recentTypographyLooks.push(presentation.typographyLookId)
  if (compositionV2) {
    input.session.recentBackgroundVariants ??= []
    input.session.recentBackgroundVariants.push(compositionV2.backgroundVariant)
    if (input.session.recentBackgroundVariants.length > 18) input.session.recentBackgroundVariants.shift()
  }
  if (input.session.recentFamilies.length > 18) input.session.recentFamilies.shift()
  if (input.session.recentTypographyLooks.length > 18) input.session.recentTypographyLooks.shift()
  return { sceneSpec, renderBindings,
    graphicData: { type: 'visual_escena', value: text.keyword, extra: { sceneSpec } } }
}

export async function resolveMotionGraphicsSceneV2(input: {
  visualAssetPack?: ModernVisualPackSelectionV1
  base: LocalSemanticVisualDecisionResultV1
  projectRoot: string
  videoStyleId: VideoVisualStyleIdV1
  session?: MotionGraphicsResolverSessionV2
  colorPalettePlan?: VideoColorPalettePlanV1
  sceneIndex?: number
  lockedColorPalette?: SceneColorPaletteV1
  pixabayApiKey?: string
  lockedChoices?: readonly LockedVisualChoiceV2[]
  presentationProfile?: EditorialMotionProfile
  hooks?: MotionGraphicsProviderHooksV2
}): Promise<MotionGraphicsResolutionV2> {
  const session = input.session ?? createMotionGraphicsResolverSessionV2()
  if (input.visualAssetPack) validateModernVisualPackSelectionV1(input.visualAssetPack)
  if (input.visualAssetPack?.localLibrary) session.localVisualCatalog ??= createCompositeVisualCatalogV1()
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
    ...(input.visualAssetPack ? { modernPack: { evaluated: 0, rejectedByRelevance: 0, missingConcepts: [],
      ...(input.visualAssetPack.localLibrary ? { catalogDiagnostics: session.localVisualCatalog?.diagnostics } : {}) } } : {}),
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
    photoOpportunities: 0, photoPlans: 0, photoRequests: 0, photoRetriesObserved: 0,
    photoDownloads: 0, photoTransformCalls: 0, photoBudgetExhausted: 0,
    photoNetworkMs: [], finalPhotoAssetShas: [],
  }
  const choices: MaterializedVisualChoiceV2[] = []
  const photoBudget: PhotoSceneBudgetStateV1 = { requests: 0, downloads: 0, transforms: 0 }

  if (input.lockedChoices?.length) {
    for (const locked of input.lockedChoices) {
      if (locked.provider === 'editorial-pilot-raster' && ![
      EDITORIAL_EXPLAINER_LIGHT_V1.revision, EDITORIAL_EXPLAINER_LIGHT_V2.revision, EDITORIAL_EXPLAINER_V3.revision,
      ].includes(input.presentationProfile?.revision as typeof EDITORIAL_EXPLAINER_LIGHT_V1.revision))
        fail('MOTION_GRAPHICS_PILOT_RASTER_PROFILE_REQUIRED', 'Raster piloto requiere perfil Light')
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
    for (const [roleIndex, role] of roleInputs.entries()) {
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
      if (representation.attemptOrder.some(value => value === 'photo-cutout' || value === 'full-raster'))
        metrics.photoOpportunities++
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
            representation: attempt, apiKey: input.pixabayApiKey, hooks: input.hooks, trace: trace.pixabay, metrics,
            budget: photoBudget, recentPhotoProviderAssetIds: new Set(session.recentPhotoProviderAssetIds),
            recentPhotoAssetShas: new Set(session.recentPhotoAssetShas),
            reserveForLaterPhotoRole: roleInputs.slice(roleIndex + 1).some(other =>
              resolveAssetRepresentationPreferenceV1({ concept: other.concept, role: other.slotId }).attemptOrder
                .some(value => value === 'photo-cutout' || value === 'full-raster')) })
        } else if (attempt === 'icon' || attempt === 'symbolic') {
          choice = localChoiceForRepresentation({ projectRoot: input.projectRoot, base: input.base, role, representation: attempt,
            visualAssetPack: input.visualAssetPack, session, warnings: trace.warnings, audit: trace.modernPack })
        }
        if (choice) {
          choice = { ...choice, conceptEligibility: role.concept.hygiene?.eligibility === 'support-only' || choice.conceptEligibility === 'support-only'
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
    if ((choice.provider === 'photo-cutout' || choice.provider === 'pixabay-images') && choice.asset)
      metrics.finalPhotoAssetShas.push(choice.asset.sha256)
    if ((choice.provider === 'photo-cutout' || choice.provider === 'pixabay-images') && choice.asset) {
      session.recentPhotoAssetShas.push(choice.asset.sha256)
      if (choice.providerAssetId) session.recentPhotoProviderAssetIds.push(choice.providerAssetId)
    }
  }
  if (session.recentPhotoAssetShas.length > 18)
    session.recentPhotoAssetShas.splice(0, session.recentPhotoAssetShas.length - 18)
  if (session.recentPhotoProviderAssetIds.length > 18)
    session.recentPhotoProviderAssetIds.splice(0, session.recentPhotoProviderAssetIds.length - 18)
  metrics.editorialOnly = hasHero ? 0 : 1
  if (!hasHero) trace.fallback = 'EDITORIAL_NO_DEFENDIBLE_HERO'
  const compiled = compileV2({ base: input.base, choices: effectiveChoices, videoStyleId: input.videoStyleId,
    ...(input.presentationProfile ? { presentationProfile: input.presentationProfile } : {}),
    colorPalette, session })
  session.recentModernAssetIds = [...(session.recentModernAssetIds ?? []), ...effectiveChoices.flatMap(c => c.catalogAsset ? [c.catalogAsset.assetId] : [])].slice(-12)
  session.recentAccentPrimaries.push(colorPalette.tokens.accentPrimary)
  if (session.recentAccentPrimaries.length > 12) session.recentAccentPrimaries.shift()
  session.scenesResolved++
  trace.family = compiled.sceneSpec.layout.family
  return { base: input.base, choices: effectiveChoices, lockedChoices: effectiveChoices.map(lockChoice),
    compiled, trace, metrics }
}
