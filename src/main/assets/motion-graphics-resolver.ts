import fs from 'fs'
import path from 'path'
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
import type { VisualConceptV1 } from '../../shared/visual-concepts'
import type { LocalSemanticVisualDecisionResultV1 } from './semantic-decision'
import {
  deriveEditorialTextV2,
} from './asset-resolver'
import type { VisualRetrievalCandidateV1 } from './visual-retrieval'
import { publishOpenMojiAsset, verifyProjectAssetContent } from './openmoji/publish'
import {
  buildPixabayImageSearchPlansV1,
  downloadPixabayImageBytesV1,
  findReusablePixabayImageAssetV1,
  publishPixabayImageAssetV1,
  searchPixabayImagesV1,
  selectPixabayImageCandidateV1,
  subjectBoundsFromPixabayRasterV1,
  verifyPixabayImageAssetContentV1,
  type PixabayImageCandidateV1,
} from './pixabay-images'

export const MOTION_GRAPHICS_RESOLVER_VERSION = 2 as const

export type MaterializedVisualChoiceV2 = {
  slotId: 'hero' | 'support-1' | 'support-2'
  concept: string
  provider: 'openmoji' | 'pixabay-images' | 'solar'
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
  preparedByConcept: Map<string, MaterializedVisualChoiceV2>
}

export type MotionGraphicsTraceV2 = {
  version: typeof MOTION_GRAPHICS_RESOLVER_VERSION
  sceneId: string
  concepts: Array<{ role: 'hero' | 'support-1' | 'support-2'; concept: string; subject: string; evidence: string }>
  roleDecisions: Array<{ role: string; concept: string; provider: string | null; identity: string | null; reason: string; score: number | null }>
  pixabay: Array<{ concept: string; query: string; candidates: number; selected: string | null; outcome: string }>
  family: ModernLayoutStructureV4
  videoStyleId: VideoVisualStyleIdV1
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
  }
}

export type MotionGraphicsProviderHooksV2 = {
  searchRequestJson?: (url: URL) => Promise<unknown>
  downloadRequestBytes?: (url: URL) => Promise<Buffer>
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

export function createMotionGraphicsResolverSessionV2(): MotionGraphicsResolverSessionV2 {
  return { version: MOTION_GRAPHICS_RESOLVER_VERSION, recentFamilies: [], recentTypographyLooks: [], preparedByConcept: new Map() }
}

function manifestAsset(projectRoot: string, assetId: string): ProjectAssetRecord | null {
  const storage = readAssetStorage(projectRoot)
  if (storage.status !== 'valid' && storage.status !== 'recovered-from-backup') return null
  return storage.manifest.assets.find(asset => asset.id === assetId) ?? null
}

function lockChoice(choice: MaterializedVisualChoiceV2): LockedVisualChoiceV2 {
  return {
    slotId: choice.slotId, concept: choice.concept, provider: choice.provider, reason: choice.reason,
    score: choice.score, ...(choice.asset ? { assetId: choice.asset.id, relativeFile: choice.asset.relativeFile,
      sha256: choice.asset.sha256, mime: choice.asset.mime } : {}),
    ...(choice.stableId ? { stableId: choice.stableId } : {}),
    ...(choice.solarIcon ? { solarIcon: choice.solarIcon, solarStyle: choice.solarStyle } : {}),
    bounds: choice.bounds, kind: choice.kind, alphaMode: choice.alphaMode,
  }
}

function restoreLockedChoice(projectRoot: string, locked: LockedVisualChoiceV2): MaterializedVisualChoiceV2 | null {
  if (locked.provider === 'solar') {
    if (!locked.solarIcon || !locked.solarStyle) return null
    return { ...locked, provider: 'solar', solarIcon: locked.solarIcon, solarStyle: locked.solarStyle }
  }
  if (!locked.assetId || !locked.relativeFile || !locked.sha256 || !locked.mime) return null
  const asset = manifestAsset(projectRoot, locked.assetId)
  if (!asset || asset.relativeFile !== locked.relativeFile || asset.sha256 !== locked.sha256 || asset.mime !== locked.mime) return null
  try {
    if (locked.provider === 'openmoji') verifyProjectAssetContent(projectRoot, asset)
    else verifyPixabayImageAssetContentV1(projectRoot, asset)
  } catch { return null }
  return { ...locked, asset }
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
}): MaterializedVisualChoiceV2 | null {
  if (!input.candidate.stableId) return null
  try {
    const published = publishOpenMojiAsset({ projectRoot: input.projectRoot, stableId: input.candidate.stableId })
    return {
      slotId: input.slotId, concept: input.concept.normalizedTerm, provider: 'openmoji',
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
}): MaterializedVisualChoiceV2 | null {
  const icon = input.candidate.solarVariant
  if (!icon) return null
  return {
    slotId: input.slotId, concept: input.concept.normalizedTerm, provider: 'solar',
    reason: input.candidate.reason, score: input.candidate.score >= 3 ? 3 : 2,
    solarIcon: icon, solarStyle: icon.endsWith('-bold-duotone') ? 'bold-duotone' : 'linear',
    bounds: fullSubjectBounds(), kind: 'simple-icon', alphaMode: 'vector',
  }
}

async function pixabayChoice(input: {
  projectRoot: string
  slotId: MaterializedVisualChoiceV2['slotId']
  concept: VisualConceptV1
  apiKey?: string
  hooks?: MotionGraphicsProviderHooksV2
  trace: MotionGraphicsTraceV2['pixabay']
  metrics: MotionGraphicsResolutionV2['metrics']
}): Promise<MaterializedVisualChoiceV2 | null> {
  if (!input.apiKey && !input.hooks?.searchRequestJson) return null
  const plans = buildPixabayImageSearchPlansV1({ concept: input.concept, level: 'exact',
    role: input.slotId === 'hero' ? 'hero' : 'support', maxPlans: 3 })
  for (const plan of plans.slice(0, 2)) {
    let searched
    try {
      searched = await searchPixabayImagesV1({ plan, apiKey: input.apiKey,
        ...(input.hooks?.searchRequestJson ? { requestJson: input.hooks.searchRequestJson } : {}) })
      input.metrics.pixabayQueries++
    } catch {
      input.trace.push({ concept: input.concept.normalizedTerm, query: plan.query, candidates: 0,
        selected: null, outcome: 'SEARCH_FAILED' })
      continue
    }
    const ranked = searched.candidates.filter(candidate => candidate.score >= 2).slice(0, 3)
    const selected = selectPixabayImageCandidateV1(ranked)
    input.trace.push({ concept: input.concept.normalizedTerm, query: plan.query,
      candidates: searched.candidates.length, selected: selected?.id ?? null,
      outcome: selected ? 'CANDIDATE_SELECTED' : 'NO_USABLE_CANDIDATE' })
    if (!selected) continue
    const candidates: PixabayImageCandidateV1[] = [selected, ...ranked.filter(candidate => candidate.id !== selected.id)].slice(0, 2)
    for (const candidate of candidates) {
      const reusable = findReusablePixabayImageAssetV1(input.projectRoot, candidate)
      if (reusable.asset) {
        const absolute = path.resolve(input.projectRoot, reusable.asset.relativeFile)
        const bytes = fs.readFileSync(absolute)
        input.metrics.pixabayReused++
        return {
          slotId: input.slotId, concept: input.concept.normalizedTerm, provider: 'pixabay-images',
          reason: 'PIXABAY_PROJECT_ASSET_REUSED', score: candidate.score >= 3 ? 3 : 2,
          asset: reusable.asset, bounds: subjectBoundsFromPixabayRasterV1(bytes),
          kind: reusable.asset.validation.alphaUseful ? 'photo-cutout' : 'raster-image',
          alphaMode: reusable.asset.validation.alphaUseful ? 'useful-alpha' : 'opaque-rectangle',
        }
      }
      if (reusable.invalid) continue
      try {
        const bytes = await downloadPixabayImageBytesV1({ candidate,
          ...(input.hooks?.downloadRequestBytes ? { requestBytes: input.hooks.downloadRequestBytes } : {}) })
        input.metrics.pixabayDownloads++
        const published = publishPixabayImageAssetV1({ projectRoot: input.projectRoot, candidate, bytes })
        input.metrics.pixabayPublished += published.status === 'created' ? 1 : 0
        input.metrics.pixabayReused += published.status === 'reused' ? 1 : 0
        return {
          slotId: input.slotId, concept: input.concept.normalizedTerm, provider: 'pixabay-images',
          reason: 'PIXABAY_PREPARED:' + published.status, score: candidate.score >= 3 ? 3 : 2,
          asset: published.asset, bounds: subjectBoundsFromPixabayRasterV1(bytes),
          kind: published.asset.validation.alphaUseful ? 'photo-cutout' : 'raster-image',
          alphaMode: published.asset.validation.alphaUseful ? 'useful-alpha' : 'opaque-rectangle',
        }
      } catch {
        input.trace.push({ concept: input.concept.normalizedTerm, query: plan.query,
          candidates: searched.candidates.length, selected: candidate.id, outcome: 'DOWNLOAD_OR_VALIDATION_REJECTED' })
      }
    }
  }
  return null
}

function localCandidate(
  base: LocalSemanticVisualDecisionResultV1,
  concept: VisualConceptV1,
  provider?: 'openmoji' | 'solar',
): VisualRetrievalCandidateV1 | null {
  const candidates = (base.trace.retrieval?.candidates ?? []).filter(candidate =>
    candidate.concept === concept.normalizedTerm && candidate.score >= 2 &&
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

function roleConcepts(base: LocalSemanticVisualDecisionResultV1): Array<{
  slotId: MaterializedVisualChoiceV2['slotId']; concept: VisualConceptV1
}> {
  const set = base.trace.retrieval?.concepts
  const values = [set?.primary, set?.secondary, set?.tertiary].filter((value): value is VisualConceptV1 => !!value)
  return values.map((concept, index) => ({ slotId: index === 0 ? 'hero' : index === 1 ? 'support-1' : 'support-2', concept }))
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
  pixabayApiKey?: string
  lockedChoices?: readonly LockedVisualChoiceV2[]
  hooks?: MotionGraphicsProviderHooksV2
}): Promise<MotionGraphicsResolutionV2> {
  const session = input.session ?? createMotionGraphicsResolverSessionV2()
  if (session.version !== 2) fail('MOTION_GRAPHICS_SESSION_INVALID', 'Sesión V15 inválida')
  const roleInputs = roleConcepts(input.base)
  const trace: MotionGraphicsTraceV2 = {
    version: 2, sceneId: input.base.decision.sceneId,
    concepts: roleInputs.map(value => ({ role: value.slotId, concept: value.concept.normalizedTerm,
      subject: value.concept.subject, evidence: value.concept.evidence })),
    roleDecisions: [], pixabay: [], family: 'editorial', videoStyleId: input.videoStyleId,
    fallback: null, warnings: [],
  }
  const metrics: MotionGraphicsResolutionV2['metrics'] = {
    pixabayQueries: 0, pixabayDownloads: 0, pixabayPublished: 0, pixabayReused: 0,
    openMojiPublished: 0, openMojiReused: 0, supportsMaterialized: 0,
  }
  const choices: MaterializedVisualChoiceV2[] = []

  if (input.lockedChoices?.length) {
    for (const locked of input.lockedChoices) {
      const expected = roleInputs.find(role => role.slotId === locked.slotId)
      if (!expected || expected.concept.normalizedTerm !== locked.concept)
        fail('MOTION_GRAPHICS_LOCKED_CONTEXT_MISMATCH', 'La elección persistida no pertenece al contexto semántico actual', {
          slotId: locked.slotId,
        })
      const restored = restoreLockedChoice(input.projectRoot, locked)
      if (!restored) fail('MOTION_GRAPHICS_LOCKED_ASSET_INVALID', 'Una elección persistida ya no verifica', { slotId: locked.slotId })
      choices.push(restored)
      trace.roleDecisions.push({ role: locked.slotId, concept: locked.concept, provider: locked.provider,
        identity: restored.asset?.sha256 ?? restored.solarIcon ?? null, reason: `LOCKED:${locked.reason}`, score: locked.score })
    }
    if (choices.filter(choice => choice.provider === 'pixabay-images').length > 2)
      fail('MOTION_GRAPHICS_RASTER_BUDGET_EXCEEDED', 'Una escena admite máximo dos assets raster')
    const identities = choices.map(choice => choice.asset?.sha256 ?? `solar:${choice.solarIcon}`)
    if (new Set(identities).size !== identities.length)
      fail('MOTION_GRAPHICS_DUPLICATE_ASSET', 'Una elección persistida repite el mismo asset en varios slots')
  } else {
    for (const role of roleInputs) {
      let choice: MaterializedVisualChoiceV2 | null = null
      if (role.slotId === 'hero') {
        const v1Hero = input.base.decision.hero
        if (v1Hero?.provider === 'openmoji') {
          const asset = recordForV1Hero(input.projectRoot, input.base)
          if (asset) choice = { slotId: 'hero', concept: role.concept.normalizedTerm, provider: 'openmoji',
            reason: 'C_PRIMARY_OPENMOJI_REUSED', score: 3, asset, stableId: v1Hero.stableId,
            bounds: fullSubjectBounds(), kind: v1Hero.kind, alphaMode: 'vector' }
        } else if (v1Hero?.provider === 'solar') {
          choice = { slotId: 'hero', concept: role.concept.normalizedTerm, provider: 'solar',
            reason: 'C_PRIMARY_SOLAR', score: 3, solarIcon: v1Hero.solarName, solarStyle: v1Hero.solarStyle,
            bounds: fullSubjectBounds(), kind: 'simple-icon', alphaMode: 'vector' }
        }
        if (!choice && choices.filter(value => value.provider === 'pixabay-images').length < 2 &&
            ['person', 'place', 'event', 'object'].includes(role.concept.subject))
          choice = await pixabayChoice({ projectRoot: input.projectRoot, slotId: role.slotId, concept: role.concept,
            apiKey: input.pixabayApiKey, hooks: input.hooks, trace: trace.pixabay, metrics })
        if (!choice) {
          const candidate = localCandidate(input.base, role.concept)
          if (candidate?.provider === 'openmoji') choice = openMojiChoice({ projectRoot: input.projectRoot, ...role, candidate })
          else if (candidate?.provider === 'solar') choice = solarChoice({ ...role, candidate })
        }
      } else {
        const candidate = localCandidate(input.base, role.concept)
        if (candidate?.provider === 'openmoji') choice = openMojiChoice({ projectRoot: input.projectRoot, ...role, candidate })
        else if (candidate?.provider === 'solar') choice = solarChoice({ ...role, candidate })
        if (!choice && choices.filter(value => value.provider === 'pixabay-images').length < 2 &&
            ['person', 'place', 'event', 'object'].includes(role.concept.subject))
          choice = await pixabayChoice({ projectRoot: input.projectRoot, slotId: role.slotId, concept: role.concept,
            apiKey: input.pixabayApiKey, hooks: input.hooks, trace: trace.pixabay, metrics })
      }
      if (choice && !choices.some(existing => existing.provider === choice!.provider &&
        (existing.asset?.sha256 ?? existing.solarIcon) === (choice!.asset?.sha256 ?? choice!.solarIcon))) {
        choices.push(choice)
        session.preparedByConcept.set(role.concept.normalizedTerm, choice)
        if (choice.provider === 'openmoji') {
          if (choice.reason.endsWith(':created')) metrics.openMojiPublished++
          else metrics.openMojiReused++
        }
      } else if (choice) trace.warnings.push('DUPLICATE_SEMANTIC_ASSET_OMITTED:' + role.slotId)
      trace.roleDecisions.push({ role: role.slotId, concept: role.concept.normalizedTerm,
        provider: choice?.provider ?? null, identity: choice?.asset?.sha256 ?? choice?.solarIcon ?? null,
        reason: choice?.reason ?? 'NO_DEFENDIBLE_RESOURCE', score: choice?.score ?? null })
    }
  }
  // Supports cannot outlive a missing Hero; that state is a legitimate editorial result.
  const hasHero = choices.some(choice => choice.slotId === 'hero')
  const effectiveChoices = hasHero ? choices : []
  metrics.supportsMaterialized = effectiveChoices.filter(choice => choice.slotId !== 'hero').length
  if (!hasHero) trace.fallback = 'EDITORIAL_NO_DEFENDIBLE_HERO'
  const compiled = compileV2({ base: input.base, choices: effectiveChoices, videoStyleId: input.videoStyleId, session })
  trace.family = compiled.sceneSpec.layout.family
  return { base: input.base, choices: effectiveChoices, lockedChoices: effectiveChoices.map(lockChoice),
    compiled, trace, metrics }
}
