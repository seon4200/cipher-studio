import path from 'path'
import { normalizeProjectRelativePath, type ProjectAssetRecord } from '../../shared/project-state'
import {
  evaluateVisualMvpQc,
  sceneSpecPixelIdentity,
  validateRenderBindings,
  type RenderBindingsV1,
  type VisualSceneSpecV1,
} from '../../shared/visual-scene-spec'
import {
  degradedVisualSceneSpecV2,
  editorialFallbackSpecAny,
  evaluateVisualStructuralQcV2,
  sceneSpecFromGraphicDataAny,
  sceneSpecPixelIdentityAny,
  validateRenderBindingsV2,
  type PreparedRenderAssetAny,
  type RenderBindingsV2,
  type SceneSlotV2,
  type VisualSceneSpecAny,
  type VisualSceneSpecV2,
} from '../../shared/visual-scene-spec-v2'
import { readAssetStorage } from '../services/project-persistence'
import {
  OpenMojiAssetError,
  readVerifiedProjectAssetContent,
  requireAssetProjectRoot,
} from './openmoji/publish'
import { readVerifiedRasterProjectAssetContentV1 } from './pixabay-images'

export class VisualAssetRenderError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'VisualAssetRenderError'
  }
}

export type PreparedVisualSceneRender = {
  kind: 'scene-spec'
  graphicData: Record<string, unknown>
  sceneSpec: VisualSceneSpecAny
  scenePixelIdentity: string
  projectRoot: string
  preparedAssets: PreparedRenderAssetAny[]
  warnings: string[]
}

export type LegacyVisualSceneRender = {
  kind: 'legacy'
  graphicData: unknown
  sceneSpec: null
  scenePixelIdentity: null
  projectRoot: null
  preparedAssets: []
  warnings: []
}

export type PreparedGraphicRender = PreparedVisualSceneRender | LegacyVisualSceneRender

function fail(code: string, message: string, details: Record<string, unknown> = {}): never {
  throw new VisualAssetRenderError(code, message, details)
}

function errorCode(error: unknown): string | undefined {
  return !!error && typeof error === 'object' && 'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code : undefined
}

function withSceneSpec(graphicData: unknown, sceneSpec: VisualSceneSpecAny): Record<string, unknown> {
  const source = graphicData && typeof graphicData === 'object'
    ? graphicData as Record<string, unknown> : {}
  const extra = source.extra && typeof source.extra === 'object' && !Array.isArray(source.extra)
    ? source.extra as Record<string, unknown> : {}
  return { ...source, extra: { ...extra, sceneSpec } }
}

function fallback(
  graphicData: unknown,
  sceneSpec: VisualSceneSpecAny,
  projectRoot: string,
  warning: string,
): PreparedVisualSceneRender {
  const effective = editorialFallbackSpecAny(sceneSpec)
  return {
    kind: 'scene-spec',
    graphicData: withSceneSpec(graphicData, effective),
    sceneSpec: effective,
    scenePixelIdentity: sceneSpecPixelIdentityAny(effective),
    projectRoot,
    preparedAssets: [],
    warnings: [warning],
  }
}

function manifestRecord(projectRoot: string, assetId: string): ProjectAssetRecord | null {
  const storage = readAssetStorage(projectRoot)
  if (storage.status === 'absent') return null
  if (storage.status !== 'valid' && storage.status !== 'recovered-from-backup')
    fail('VISUAL_ASSET_MANIFEST_INVALID', 'El AssetManifest no se puede usar para render', {
      status: storage.status,
      warnings: storage.warnings,
    })
  return storage.manifest.assets.find(asset => asset.id === assetId) ?? null
}

function resolvePresentHero(
  graphicData: unknown,
  spec: VisualSceneSpecV1,
  projectRoot: string,
  bindings: RenderBindingsV1,
): PreparedVisualSceneRender {
  const slot = spec.slots.find(candidate => candidate.state === 'present')
  if (!slot || slot.state !== 'present') fail('VISUAL_HERO_REQUIRED', 'asset-led no contiene Hero present')
  const binding = bindings.assets.find(candidate => candidate.slotId === slot.slotId)
  if (!binding) fail('VISUAL_HERO_BINDING_REQUIRED', 'Hero present requiere RenderBinding')

  const relativeFile = normalizeProjectRelativePath(binding.relativeFile, true)
  const record = manifestRecord(projectRoot, binding.assetId)
  if (!record) return fallback(graphicData, spec, projectRoot, 'VISUAL_HERO_ASSET_MISSING')
  if (record.provider !== 'openmoji')
    fail('VISUAL_ASSET_PROVIDER_UNSUPPORTED', 'El MVP productivo sólo certifica ProjectAsset OpenMoji')
  if (record.validation.status !== 'accepted')
    fail('VISUAL_ASSET_NOT_ACCEPTED', 'El ProjectAsset no está aceptado', { status: record.validation.status })
  if (record.relativeFile !== relativeFile)
    fail('VISUAL_ASSET_BINDING_MISMATCH', 'RenderBinding y AssetManifest señalan rutas distintas')
  if (record.sha256 !== slot.sha256)
    fail('VISUAL_ASSET_IDENTITY_MISMATCH', 'RenderSpec y AssetManifest tienen SHA distintas')
  if (record.mime !== slot.mime)
    fail('VISUAL_ASSET_MIME_MISMATCH', 'RenderSpec y AssetManifest tienen MIME distintos')

  try {
    // One read produces the exact immutable bytes transported through the whole capture.
    const verified = readVerifiedProjectAssetContent(projectRoot, record)
    return {
      kind: 'scene-spec',
      graphicData: withSceneSpec(graphicData, spec),
      sceneSpec: spec,
      scenePixelIdentity: sceneSpecPixelIdentity(spec),
      projectRoot,
      preparedAssets: [{
        slotId: 'hero',
        assetId: record.id,
        mime: 'image/svg+xml',
        bytesBase64: verified.bytes.toString('base64'),
      }],
      warnings: [],
    }
  } catch (error: unknown) {
    const code = errorCode(error)
    if (error instanceof OpenMojiAssetError && [
      'PROJECT_ASSET_MISSING',
      'PROJECT_ASSET_SIZE_MISMATCH',
      'PROJECT_ASSET_SHA_MISMATCH',
      'PROJECT_ASSET_SVG_INVALID',
    ].includes(error.code)) return fallback(graphicData, spec, projectRoot, `VISUAL_HERO_FALLBACK:${error.code}`)
    fail('VISUAL_ASSET_VERIFY_FAILED', 'El ProjectAsset no superó la verificación previa al render', { causeCode: code })
  }
}

function isRecoverableContentFailure(error: unknown): boolean {
  return [
    'PROJECT_ASSET_MISSING', 'PROJECT_ASSET_SIZE_MISMATCH', 'PROJECT_ASSET_SHA_MISMATCH',
    'PROJECT_ASSET_MIME_MISMATCH', 'PROJECT_ASSET_SVG_INVALID', 'PIXABAY_IMAGE_ASSET_INVALID',
    'PIXABAY_IMAGE_NOT_REGULAR',
  ].includes(errorCode(error) ?? '')
}

function prepareV2(
  graphicData: unknown,
  spec: VisualSceneSpecV2,
  projectRoot: string,
  rawBindings: unknown,
): PreparedVisualSceneRender {
  const structural = evaluateVisualStructuralQcV2(spec)
  const errors = structural.filter(issue => issue.level === 'error')
  if (errors.length) fail('VISUAL_QC_REJECTED', 'RenderSpec V15 no supera el QC estructural', { issues: errors })

  const bindings: RenderBindingsV2 = rawBindings === undefined
    ? { version: 2, assets: [] }
    : validateRenderBindingsV2(rawBindings)
  const present = spec.slots.filter((slot): slot is Extract<SceneSlotV2, { state: 'present' }> => slot.state === 'present')
  const expectedIds = new Set(present.map(slot => slot.slotId))
  if (bindings.assets.some(binding => !expectedIds.has(binding.slotId)))
    fail('VISUAL_RENDER_BINDINGS_UNUSED', 'RenderBindings V15 contiene un locator sin slot present')
  if (bindings.assets.length !== present.length)
    fail('VISUAL_SLOT_BINDING_REQUIRED', 'Cada ProjectAsset present requiere exactamente un binding')

  const preparedAssets: PreparedRenderAssetAny[] = []
  const failedSlots: SceneSlotV2['slotId'][] = []
  const warnings = structural.filter(issue => issue.level === 'needs-review').map(issue => issue.code)
  for (const slot of present) {
    const binding = bindings.assets.find(candidate => candidate.slotId === slot.slotId)
    if (!binding) fail('VISUAL_SLOT_BINDING_REQUIRED', `Falta binding para ${slot.slotId}`)
    const relativeFile = normalizeProjectRelativePath(binding.relativeFile, true)
    const record = manifestRecord(projectRoot, binding.assetId)
    if (!record) {
      failedSlots.push(slot.slotId)
      warnings.push(`VISUAL_SLOT_ASSET_MISSING:${slot.slotId}`)
      continue
    }
    if (record.relativeFile !== relativeFile)
      fail('VISUAL_ASSET_BINDING_MISMATCH', 'RenderBinding y AssetManifest señalan rutas distintas', { slotId: slot.slotId })
    if (record.sha256 !== slot.sha256)
      fail('VISUAL_ASSET_IDENTITY_MISMATCH', 'RenderSpec y AssetManifest tienen SHA distintas', { slotId: slot.slotId })
    if (record.mime !== slot.mime)
      fail('VISUAL_ASSET_MIME_MISMATCH', 'RenderSpec y AssetManifest tienen MIME distintos', { slotId: slot.slotId })
    if (record.validation.status !== 'accepted')
      fail('VISUAL_ASSET_NOT_ACCEPTED', 'El ProjectAsset no está aceptado', { slotId: slot.slotId })
    try {
      if (slot.mime === 'image/svg+xml') {
        if (record.provider !== 'openmoji')
          fail('VISUAL_ASSET_PROVIDER_UNSUPPORTED', 'SVG V15 certificado debe ser ProjectAsset OpenMoji')
        const verified = readVerifiedProjectAssetContent(projectRoot, record)
        preparedAssets.push({ slotId: slot.slotId, assetId: record.id, mime: slot.mime,
          bytesBase64: verified.bytes.toString('base64') })
      } else {
        const verified = readVerifiedRasterProjectAssetContentV1(projectRoot, record)
        if (slot.alphaMode === 'useful-alpha' && !verified.inspection.alphaUseful)
          fail('VISUAL_ASSET_ALPHA_MISMATCH', 'El slot exige alpha útil pero los bytes no lo tienen')
        preparedAssets.push({ slotId: slot.slotId, assetId: record.id, mime: slot.mime,
          bytesBase64: verified.bytes.toString('base64') })
      }
    } catch (error: unknown) {
      if (!isRecoverableContentFailure(error)) throw error
      failedSlots.push(slot.slotId)
      warnings.push(`VISUAL_SLOT_FALLBACK:${slot.slotId}:${errorCode(error) ?? 'UNKNOWN'}`)
    }
  }

  const effective = failedSlots.length ? degradedVisualSceneSpecV2(spec, failedSlots) : spec
  const retained = new Set(effective.slots.filter(slot => slot.state === 'present').map(slot => slot.slotId))
  const effectiveAssets = preparedAssets.filter(asset => retained.has(asset.slotId))
  return {
    kind: 'scene-spec',
    graphicData: withSceneSpec(graphicData, effective),
    sceneSpec: effective,
    scenePixelIdentity: sceneSpecPixelIdentityAny(effective),
    projectRoot,
    preparedAssets: effectiveAssets,
    warnings,
  }
}

/**
 * Resolves only already-published ProjectAssets. It performs no provider search, no network
 * request and no semantic selection. Absent sceneSpec returns the input untouched (legacy).
 */
export function prepareGraphicForVisualRender(input: {
  graphicData: unknown
  projectRoot?: unknown
  renderBindings?: unknown
}): PreparedGraphicRender {
  const spec = sceneSpecFromGraphicDataAny(input.graphicData)
  if (!spec) return {
    kind: 'legacy', graphicData: input.graphicData, sceneSpec: null,
    scenePixelIdentity: null, projectRoot: null, preparedAssets: [], warnings: [],
  }

  if (!input.graphicData || typeof input.graphicData !== 'object' ||
      (input.graphicData as { type?: unknown }).type !== 'visual_escena')
    fail('VISUAL_SCENE_TYPE_INVALID', 'extra.sceneSpec sólo puede activar visual_escena')

  const projectRoot = requireAssetProjectRoot(input.projectRoot)
  if (spec.renderSpecVersion === 2)
    return prepareV2(input.graphicData, spec, projectRoot, input.renderBindings)
  const issues = evaluateVisualMvpQc(spec)
  const errors = issues.filter(issue => issue.level === 'error')
  if (errors.length) fail('VISUAL_QC_REJECTED', 'RenderSpec no supera el QC estructural', { issues: errors })

  if (spec.visualMode === 'editorial-text') {
    const bindings = input.renderBindings === undefined
      ? { assets: [] } : validateRenderBindings(input.renderBindings)
    if (bindings.assets.length) fail('VISUAL_RENDER_BINDINGS_UNUSED', 'editorial-text no acepta bindings de Hero')
    return {
      kind: 'scene-spec',
      graphicData: withSceneSpec(input.graphicData, spec),
      sceneSpec: spec,
      scenePixelIdentity: sceneSpecPixelIdentity(spec),
      projectRoot,
      preparedAssets: [],
      warnings: issues.filter(issue => issue.level === 'needs-review').map(issue => issue.code),
    }
  }

  if (input.renderBindings === undefined)
    fail('VISUAL_HERO_BINDING_REQUIRED', 'asset-led requiere RenderBindings explícitos')
  const bindings = validateRenderBindings(input.renderBindings)
  const procedural = spec.slots.find(slot => slot.state === 'procedural')
  if (procedural) {
    if (bindings.assets.length) fail('VISUAL_RENDER_BINDINGS_UNUSED', 'Hero Solar procedural no acepta RenderBindings')
    // Solar is already materialized in sceneSpec by the resolver. This branch deliberately
    // performs no catalog/provider lookup and has no bytes to locate.
    return {
      kind: 'scene-spec',
      graphicData: withSceneSpec(input.graphicData, spec),
      sceneSpec: spec,
      scenePixelIdentity: sceneSpecPixelIdentity(spec),
      projectRoot,
      preparedAssets: [],
      warnings: issues.filter(issue => issue.level === 'needs-review').map(issue => issue.code),
    }
  }
  if (bindings.assets.length !== 1) fail('VISUAL_HERO_BINDING_REQUIRED', 'asset-led requiere un binding Hero')
  return resolvePresentHero(input.graphicData, spec, projectRoot, bindings)
}

export function visualRenderRoot(prepared: PreparedGraphicRender, legacyRoot: string | null): string | null {
  return prepared.kind === 'scene-spec' ? path.resolve(prepared.projectRoot) : legacyRoot
}
