import path from 'path'
import { normalizeProjectRelativePath, type ProjectAssetRecord } from '../../shared/project-state'
import {
  editorialFallbackSpec,
  evaluateVisualMvpQc,
  sceneSpecFromGraphicData,
  sceneSpecPixelIdentity,
  validateRenderBindings,
  type PreparedRenderAssetV1,
  type RenderBindingsV1,
  type VisualSceneSpecV1,
} from '../../shared/visual-scene-spec'
import { readAssetStorage } from '../services/project-persistence'
import {
  OpenMojiAssetError,
  readVerifiedProjectAssetContent,
  requireAssetProjectRoot,
} from './openmoji/publish'

export class VisualAssetRenderError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'VisualAssetRenderError'
  }
}

export type PreparedVisualSceneRender = {
  kind: 'scene-spec'
  graphicData: Record<string, unknown>
  sceneSpec: VisualSceneSpecV1
  scenePixelIdentity: string
  projectRoot: string
  preparedAssets: PreparedRenderAssetV1[]
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

function withSceneSpec(graphicData: unknown, sceneSpec: VisualSceneSpecV1): Record<string, unknown> {
  const source = graphicData && typeof graphicData === 'object'
    ? graphicData as Record<string, unknown> : {}
  const extra = source.extra && typeof source.extra === 'object' && !Array.isArray(source.extra)
    ? source.extra as Record<string, unknown> : {}
  return { ...source, extra: { ...extra, sceneSpec } }
}

function fallback(
  graphicData: unknown,
  sceneSpec: VisualSceneSpecV1,
  projectRoot: string,
  warning: string,
): PreparedVisualSceneRender {
  const effective = editorialFallbackSpec(sceneSpec)
  return {
    kind: 'scene-spec',
    graphicData: withSceneSpec(graphicData, effective),
    sceneSpec: effective,
    scenePixelIdentity: sceneSpecPixelIdentity(effective),
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

/**
 * Resolves only already-published ProjectAssets. It performs no provider search, no network
 * request and no semantic selection. Absent sceneSpec returns the input untouched (legacy).
 */
export function prepareGraphicForVisualRender(input: {
  graphicData: unknown
  projectRoot?: unknown
  renderBindings?: unknown
}): PreparedGraphicRender {
  const spec = sceneSpecFromGraphicData(input.graphicData)
  if (!spec) return {
    kind: 'legacy', graphicData: input.graphicData, sceneSpec: null,
    scenePixelIdentity: null, projectRoot: null, preparedAssets: [], warnings: [],
  }

  if (!input.graphicData || typeof input.graphicData !== 'object' ||
      (input.graphicData as { type?: unknown }).type !== 'visual_escena')
    fail('VISUAL_SCENE_TYPE_INVALID', 'extra.sceneSpec sólo puede activar visual_escena')

  const projectRoot = requireAssetProjectRoot(input.projectRoot)
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
  if (bindings.assets.length !== 1) fail('VISUAL_HERO_BINDING_REQUIRED', 'asset-led requiere un binding Hero')
  return resolvePresentHero(input.graphicData, spec, projectRoot, bindings)
}

export function visualRenderRoot(prepared: PreparedGraphicRender, legacyRoot: string | null): string | null {
  return prepared.kind === 'scene-spec' ? path.resolve(prepared.projectRoot) : legacyRoot
}
