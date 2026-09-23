import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import manifestJson from './editorial-idea-support-catalog-v4-1.manifest.json'
import { IDEA_SUPPORT_CATALOG_V41, getApprovedIdeaSupportV41,
  type IdeaSupportCatalogAssetIdV41 } from '../../shared/editorial-idea-support-catalog-v4-1'
import { EDITORIAL_IDEA_ASSEMBLY_V4, EDITORIAL_IDEA_ASSEMBLY_V4_1, IDEA_SUPPORT_IDS,
  resolveIdeaColorV4, type IdeaColorIntentV4, type IdeaAssemblyV1 } from '../../shared/editorial-idea-assembly-v1'
import { validateRenderBindingsAny, validateVisualSceneSpecV2, sceneSpecPixelIdentityAny,
  type RenderBindingsV2, type VisualSceneSpecV2 } from '../../shared/visual-scene-spec-v2'
import type { ProjectAssetRecord } from '../../shared/project-state'
import { publishRasterProjectAssetV1 } from './pixabay-images'

type CatalogManifestEntry = (typeof manifestJson.assets)[number]
type CatalogManifestV41 = typeof manifestJson
type ImportedSupportV41 = { asset: ProjectAssetRecord; manifest: CatalogManifestEntry }

export type IdeaSupportTintRequestV41 = {
  supportSource: IdeaColorIntentV4['supportSource']
  customColor?: string
  heroPrimary: string
}

export type IdeaSupportSelectionV41 = readonly [
  IdeaSupportCatalogAssetIdV41, IdeaSupportCatalogAssetIdV41,
  IdeaSupportCatalogAssetIdV41, IdeaSupportCatalogAssetIdV41,
]

type PngAlphaInspectionV41 = {
  width: number; height: number; transparentPixels: number; partialAlphaPixels: number
  opaquePixels: number; alphaUseful: boolean; chromaticVisiblePixels: number
}

const manifest = manifestJson as CatalogManifestV41
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value)
}
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

export function inspectSupportPngV41(bytes: Buffer): PngAlphaInspectionV41 {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (!Buffer.isBuffer(bytes) || bytes.length < 33 || !bytes.subarray(0, 8).equals(signature))
    throw new Error('IDEA_V41_SUPPORT_PNG_INVALID')
  let offset = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0
  const compressed: Buffer[] = []
  let sawEnd = false
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset); offset += 4
    const type = bytes.subarray(offset, offset + 4).toString('ascii'); offset += 4
    if (offset + length + 4 > bytes.length) throw new Error('IDEA_V41_SUPPORT_PNG_INVALID')
    const data = bytes.subarray(offset, offset + length); offset += length + 4
    if (type === 'IHDR') {
      if (data.length !== 13) throw new Error('IDEA_V41_SUPPORT_PNG_INVALID')
      width = data.readUInt32BE(0); height = data.readUInt32BE(4)
      bitDepth = data[8]; colorType = data[9]; interlace = data[12]
    } else if (type === 'IDAT') compressed.push(data)
    else if (type === 'IEND') { sawEnd = true; break }
  }
  if (!sawEnd || width < 64 || height < 64 || width > 4096 || height > 4096)
    throw new Error('IDEA_V41_SUPPORT_DIMENSIONS_INVALID')
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0 || !compressed.length)
    throw new Error('IDEA_V41_SUPPORT_RGBA8_REQUIRED')
  let decoded: Buffer
  try { decoded = inflateSync(Buffer.concat(compressed)) }
  catch { throw new Error('IDEA_V41_SUPPORT_PNG_DEFLATE_INVALID') }
  const rowBytes = width * 4
  if (decoded.length !== height * (rowBytes + 1)) throw new Error('IDEA_V41_SUPPORT_PNG_LENGTH_INVALID')
  let previous = Buffer.alloc(rowBytes), cursor = 0
  let transparentPixels = 0, partialAlphaPixels = 0, opaquePixels = 0, chromaticVisiblePixels = 0
  for (let y = 0; y < height; y++) {
    const filter = decoded[cursor++]
    const row = Buffer.from(decoded.subarray(cursor, cursor + rowBytes)); cursor += rowBytes
    if (filter > 4) throw new Error('IDEA_V41_SUPPORT_PNG_FILTER_INVALID')
    for (let x = 0; x < rowBytes; x++) {
      const left = x >= 4 ? row[x - 4] : 0
      const up = previous[x]
      const upperLeft = x >= 4 ? previous[x - 4] : 0
      if (filter === 1) row[x] = (row[x] + left) & 255
      else if (filter === 2) row[x] = (row[x] + up) & 255
      else if (filter === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 255
      else if (filter === 4) {
        const predictor = left + up - upperLeft
        const da = Math.abs(predictor - left), db = Math.abs(predictor - up), dc = Math.abs(predictor - upperLeft)
        row[x] = (row[x] + (da <= db && da <= dc ? left : db <= dc ? up : upperLeft)) & 255
      }
    }
    for (let x = 0; x < width; x++) {
      const i = x * 4, alpha = row[i + 3]
      if (alpha === 0) transparentPixels++
      else if (alpha < 255) partialAlphaPixels++
      else opaquePixels++
      if (alpha > 0) {
        const high = Math.max(row[i], row[i + 1], row[i + 2])
        const low = Math.min(row[i], row[i + 1], row[i + 2])
        if (high - low > 18) chromaticVisiblePixels++
      }
    }
    previous = row
  }
  return { width, height, transparentPixels, partialAlphaPixels, opaquePixels,
    alphaUseful: transparentPixels > 0 && partialAlphaPixels + opaquePixels > 0, chromaticVisiblePixels }
}

function resolvedCatalogPath(root: string, relativePath: string): string {
  if (typeof relativePath !== 'string' || !relativePath || relativePath.includes('\\') ||
      path.posix.isAbsolute(relativePath) || relativePath.split('/').some(part => !part || part === '.' || part === '..'))
    throw new Error('IDEA_V41_SUPPORT_MANIFEST_PATH_INVALID')
  const resolved = path.resolve(root, ...relativePath.split('/'))
  const relation = path.relative(root, resolved)
  if (!relation || relation.startsWith('..') || path.isAbsolute(relation))
    throw new Error('IDEA_V41_SUPPORT_MANIFEST_PATH_INVALID')
  const realRoot = fs.realpathSync(root)
  const realFile = fs.realpathSync(resolved)
  const realRelation = path.relative(realRoot, realFile)
  if (!realRelation || realRelation.startsWith('..') || path.isAbsolute(realRelation))
    throw new Error('IDEA_V41_SUPPORT_MANIFEST_PATH_INVALID')
  return realFile
}

/** Read the fixed ten-entry local manifest, enforce its in-repo reviewed authority,
 * verify file bytes/alpha/content and materialize through the existing ProjectAsset path. */
export function importEditorialIdeaSupportCatalogV41(input: {
  projectRoot: string
  catalogRoot: string
  assetIds: readonly string[]
}): Record<string, ImportedSupportV41> {
  if (!path.isAbsolute(input.projectRoot) || !path.isAbsolute(input.catalogRoot) ||
      !Array.isArray(input.assetIds) || input.assetIds.length < 1 || input.assetIds.length > 10 ||
      new Set(input.assetIds).size !== input.assetIds.length)
    throw new Error('IDEA_V41_IMPORT_INPUT_INVALID')
  const root = fs.realpathSync(input.catalogRoot)
  const externalManifestPath = path.join(root, 'manifest.json')
  let external: unknown
  try { external = JSON.parse(fs.readFileSync(externalManifestPath, 'utf8')) }
  catch { throw new Error('IDEA_V41_SUPPORT_MANIFEST_MISSING_OR_INVALID') }
  if (canonical(external) !== canonical(manifest)) throw new Error('IDEA_V41_SUPPORT_MANIFEST_UNTRUSTED')
  if (manifest.assetCount !== 10 || manifest.assets.length !== 10 ||
      manifest.assets.length !== IDEA_SUPPORT_CATALOG_V41.length)
    throw new Error('IDEA_V41_SUPPORT_CATALOG_COUNT_INVALID')

  const imported: Record<string, ImportedSupportV41> = Object.create(null)
  for (const requestedId of input.assetIds) {
    const approved = getApprovedIdeaSupportV41(requestedId)
    const entry = manifest.assets.find(item => item.assetId === requestedId)
    if (!approved || !entry || entry.kind !== 'support' || entry.curationStatus !== 'approved' ||
        entry.colorCapability !== 'alpha-mask' || entry.sha256 !== approved.sha256 ||
        entry.concept !== approved.concept || entry.label !== approved.label)
      throw new Error('IDEA_V41_SUPPORT_ASSET_NOT_CURATED:' + String(requestedId))
    const file = resolvedCatalogPath(root, entry.runtimeRelativePath)
    const bytes = fs.readFileSync(file)
    const inspection = inspectSupportPngV41(bytes)
    if (!inspection.alphaUseful || !entry.alphaValidation.hasAlpha || !entry.alphaValidation.alphaUseful ||
        inspection.width !== entry.dimensions.width || inspection.height !== entry.dimensions.height)
      throw new Error('IDEA_V41_SUPPORT_ALPHA_OR_DIMENSIONS_INVALID:' + entry.assetId)
    // The four V3/V4 Supports were already approved and their exact bytes are
    // pinned in the immutable identity allowlist. They may contain legacy color
    // pixels; V4.1 deliberately uses their alpha silhouette, not their RGB.
    // Newly generated candidates, in contrast, must be genuinely monochrome.
    const legacyBytePinned = entry.curation.legacyApprovedBytePreserved === true &&
      ['idea-support-personas-v1', 'idea-support-datos-v1', 'idea-support-soluciones-v1',
        'idea-support-impacto-v1'].includes(entry.assetId)
    if (inspection.transparentPixels < inspection.width * inspection.height * 0.1 ||
        (!legacyBytePinned && inspection.chromaticVisiblePixels > Math.max(12,
          (inspection.partialAlphaPixels + inspection.opaquePixels) * 0.001)))
      throw new Error('IDEA_V41_SUPPORT_BACKGROUND_OR_COLOR_INVALID:' + entry.assetId)
    if (inspection.transparentPixels !== entry.alphaValidation.transparentPixels ||
        inspection.partialAlphaPixels !== entry.alphaValidation.partialAlphaPixels ||
        inspection.opaquePixels !== entry.alphaValidation.opaquePixels)
      throw new Error('IDEA_V41_SUPPORT_ALPHA_MANIFEST_MISMATCH:' + entry.assetId)
    if (entry.promptLiteral && (!entry.curation.simpleIcon || !entry.curation.blackMonochrome ||
        entry.curation.bakedBackground || entry.curation.card || entry.curation.text || entry.curation.logo ||
        entry.curation.watermark || entry.curation.shadow || !entry.curation.manualVisualReview))
      throw new Error('IDEA_V41_SUPPORT_CONTENT_NOT_APPROVED:' + entry.assetId)
    const actualSha = sha256(bytes)
    if (actualSha !== approved.sha256 || actualSha !== entry.sha256)
      throw new Error('IDEA_V41_SUPPORT_SHA_MISMATCH:' + entry.assetId)
    const record = publishRasterProjectAssetV1({ projectRoot: input.projectRoot,
      provider: 'editorial-idea-support-v4-1', assetId: entry.assetId, bytes, requireUsefulAlpha: true,
      source: { providerVersion: manifest.revision, attribution: entry.source },
      validationRevision: 'editorial-idea-support-alpha-mask-v4-1' })
    if (record.asset.sha256 !== approved.sha256 || record.asset.validation.width !== entry.dimensions.width ||
        record.asset.validation.height !== entry.dimensions.height || record.asset.mime !== 'image/png')
      throw new Error('IDEA_V41_PROJECT_ASSET_MISMATCH:' + entry.assetId)
    imported[entry.assetId] = { asset: record.asset, manifest: entry }
  }
  return imported
}

const normalizeHex = (value: unknown, code: string): string => {
  if (typeof value !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(value)) throw new Error(code)
  return value.toUpperCase()
}

export function resolveIdeaColorV41(intent: IdeaSupportTintRequestV41) {
  if (!intent || typeof intent !== 'object') throw new Error('IDEA_V41_COLOR_INTENT_INVALID')
  const extended = intent as IdeaSupportTintRequestV41 & { heroMode?: unknown; heroSecondary?: unknown }
  if ((extended.heroMode !== undefined && extended.heroMode !== 'recolorable') || extended.heroSecondary !== undefined)
    throw new Error('IDEA_V41_HERO_COLOR_MODE_UNAVAILABLE')
  const heroPrimary = normalizeHex(intent.heroPrimary, 'IDEA_V41_HERO_PRIMARY_INVALID')
  const customColor = intent.supportSource === 'custom'
    ? normalizeHex(intent.customColor, 'IDEA_V41_SUPPORT_CUSTOM_COLOR_INVALID') : undefined
  if (intent.supportSource === 'hero-secondary') throw new Error('IDEA_V41_HERO_SECONDARY_UNAVAILABLE')
  const resolved = resolveIdeaColorV4({ supportSource: intent.supportSource,
    heroMode: 'recolorable', heroPrimary, ...(customColor ? { customColor } : {}) })
  return resolved
}

/** Bind four selected catalog IDs to the existing four visual Support slots. The ten-entry
 * catalog is not ten simultaneous SceneSpec slots; V1-V4 geometry stays byte-compatible. */
export function bindEditorialIdeaSupportsV41(input: {
  template: { sceneSpec: VisualSceneSpecV2; graphicData: Record<string, any>; renderBindings: RenderBindingsV2 }
  imported: Record<string, ImportedSupportV41>
  assetIds: IdeaSupportSelectionV41
  color: IdeaSupportTintRequestV41
}) {
  const source = input.template.sceneSpec
  if (source.presentationProfile?.revision !== EDITORIAL_IDEA_ASSEMBLY_V4.revision ||
      source.ideaAssembly?.revision !== EDITORIAL_IDEA_ASSEMBLY_V4.revision)
    throw new Error('IDEA_V41_TEMPLATE_MUST_BE_APPROVED_V4')
  const color = resolveIdeaColorV41(input.color)
  const selected = input.assetIds.map(id => {
    const trusted = getApprovedIdeaSupportV41(id)
    const imported = input.imported[id]
    if (!trusted || !imported || imported.asset.id !== id || imported.asset.sha256 !== trusted.sha256 ||
        imported.manifest.sha256 !== trusted.sha256)
      throw new Error('IDEA_V41_SUPPORT_SELECTION_UNAUTHORIZED:' + id)
    return { trusted, imported }
  })
  const sceneSpec: VisualSceneSpecV2 = {
    ...source,
    presentationProfile: EDITORIAL_IDEA_ASSEMBLY_V4_1,
    slots: source.slots.map(slot => {
      const index = IDEA_SUPPORT_IDS.indexOf(slot.slotId as typeof IDEA_SUPPORT_IDS[number])
      if (index < 0 || slot.state !== 'present') return slot
      const chosen = selected[index]
      return { ...slot, sha256: chosen.trusted.sha256, mime: 'image/png' as const, kind: 'simple-icon' as const,
        alphaMode: 'useful-alpha' as const, colorCapability: 'alpha-mask' as const,
        tint: { treatment: 'accent-mask' as const } }
    }),
    ideaAssembly: {
      ...source.ideaAssembly!, revision: EDITORIAL_IDEA_ASSEMBLY_V4_1.revision,
      supportTint: color.supportTint,
      heroPalette: color.heroPalette,
      supports: source.ideaAssembly!.supports.map((support, index) => ({
        ...support, label: selected[index].trusted.label,
        catalogAssetId: selected[index].trusted.assetId,
        catalogSha256: selected[index].trusted.sha256,
      })),
    } as IdeaAssemblyV1,
  }
  validateVisualSceneSpecV2(sceneSpec)
  const renderBindings: RenderBindingsV2 = {
    version: 2,
    assets: input.template.renderBindings.assets.map(binding => {
      const index = IDEA_SUPPORT_IDS.indexOf(binding.slotId as typeof IDEA_SUPPORT_IDS[number])
      if (index < 0) return binding
      const record = selected[index].imported.asset
      return { slotId: binding.slotId, assetId: record.id, relativeFile: record.relativeFile }
    }),
  }
  validateRenderBindingsAny(renderBindings, sceneSpec)
  const graphicData = { ...input.template.graphicData,
    extra: { ...input.template.graphicData.extra, sceneSpec } }
  return { sceneSpec, graphicData, renderBindings,
    pixelIdentity: sceneSpecPixelIdentityAny(sceneSpec), resolvedColor: color.supportTint.resolvedColor }
}

export const IDEA_SUPPORT_MANIFEST_V41 = manifest
