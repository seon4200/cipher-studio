import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { EDITORIAL_MODULAR_CATALOG_V1, MODULAR_CATALOG_PACK_ID_V1, MODULAR_CATALOG_REVISION_V1,
  MODULAR_CATALOG_MANIFEST_SHA256_V1,
  curatedModularAssetsV1, getCuratedModularAssetV1, resolveModularTitleAccentV1,
  type CuratedModularAssetV1, type ModularCatalogRoleV1, type ModularRecipeV1 } from '../../shared/editorial-modular-catalog-v1'
import { IDEA_SUPPORT_IDS, resolveIdeaColorV4, type IdeaAssemblyV1,
  type IdeaAccentTheme, type IdeaColorIntentV4, type IdeaAssemblyResource } from '../../shared/editorial-idea-assembly-v1'
import { sceneSpecPixelIdentityAny, validateRenderBindingsAny, validateVisualSceneSpecV2,
  type VisualSceneSpecV2, type RenderBindingsV2 } from '../../shared/visual-scene-spec-v2'
import type { ProjectAssetRecord } from '../../shared/project-state'
import { inspectPixabayRasterImageV1, publishRasterProjectAssetV1 } from './pixabay-images'
import { inspectSupportPngV41 } from './editorial-idea-support-catalog-v4-1'

type InventoryEntry = { assetId: string; role: ModularCatalogRoleV1; primaryWordEs: string;
  aliasesEs: string[]; aliasesEn: string[]; runtimeRef: string; runtimeSHA256: string;
  runtimeDimensions: { width: number; height: number }; status: string;
  aspectClass?: 'vertical' | 'wide' | 'compact' | 'organic' }
export type ImportedModularAssetV1 = { asset: ProjectAssetRecord; curated: CuratedModularAssetV1 }
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const normalize = (word: string) => word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()

function safeFile(root: string, relative: string): string {
  if (!/^(?:runtime)\/[a-z0-9]+\.png$/.test(relative)) throw new Error('MODULAR_PATH_INVALID')
  const absolute = path.join(root, ...relative.split('/'))
  const real = fs.realpathSync(absolute)
  const relation = path.relative(fs.realpathSync(root), real)
  if (!relation || relation.startsWith('..') || path.isAbsolute(relation) || fs.lstatSync(absolute).isSymbolicLink())
    throw new Error('MODULAR_PATH_ESCAPE')
  return real
}

/** Registry-pinned raster extension beside the existing SVG provider. This reads one
 * configured local root and publishes through the existing ProjectAsset pathway. */
export class CuratedModularCatalogV1 {
  private readonly root: string
  private readonly entriesById: Map<string, InventoryEntry>
  constructor(catalogRoot: string) {
    if (!path.isAbsolute(catalogRoot) || !fs.statSync(catalogRoot).isDirectory()) throw new Error('MODULAR_ROOT_INVALID')
    this.root = fs.realpathSync(catalogRoot)
    const manifestBytes = fs.readFileSync(path.join(this.root, 'inventory.json'))
    if (sha(manifestBytes) !== MODULAR_CATALOG_MANIFEST_SHA256_V1)
      throw new Error('MODULAR_MANIFEST_SHA_MISMATCH')
    const inventory = JSON.parse(manifestBytes.toString('utf8')) as {
      id: string; catalogRevision: string; entries: InventoryEntry[] }
    if (inventory.id !== MODULAR_CATALOG_PACK_ID_V1 || inventory.catalogRevision !== MODULAR_CATALOG_REVISION_V1 ||
        !Array.isArray(inventory.entries)) throw new Error('MODULAR_MANIFEST_INVALID')
    const approvedAssets = curatedModularAssetsV1()
    if (inventory.entries.length !== approvedAssets.length) throw new Error('MODULAR_MANIFEST_ROSTER_MISMATCH')
    this.entriesById = new Map()
    for (const entry of inventory.entries) {
      if (!entry || typeof entry.assetId !== 'string' || this.entriesById.has(entry.assetId))
        throw new Error('MODULAR_ID_COLLISION')
      const approved = getCuratedModularAssetV1(entry.assetId)
      if (!approved || approved.role !== entry.role || approved.sha256 !== entry.runtimeSHA256 ||
          approved.primaryWordEs !== entry.primaryWordEs)
        throw new Error('MODULAR_MANIFEST_UNAUTHORIZED_ASSET:' + entry.assetId)
      this.entriesById.set(entry.assetId, entry)
    }
  }
  entries(): readonly CuratedModularAssetV1[] { return curatedModularAssetsV1() }
  /** Advisory shape metadata; the resolved layout is frozen in the SceneSpec. */
  aspectClass(assetId: string): InventoryEntry['aspectClass'] {
    return this.getById(assetId) ? this.entriesById.get(assetId)?.aspectClass : undefined
  }
  getById(assetId: string): CuratedModularAssetV1 | undefined {
    const approved = getCuratedModularAssetV1(assetId)
    const entry = this.entriesById.get(assetId)
    return approved && entry && ['selected_technical', 'imported'].includes(entry.status) &&
      entry.role === approved.role && entry.runtimeSHA256 === approved.sha256 ? approved : undefined
  }
  search(terms: readonly string[], role?: ModularCatalogRoleV1): readonly CuratedModularAssetV1[] {
    const forms = new Set(terms.map(normalize).filter(Boolean))
    return this.entries().filter(approved => {
      if (role && approved.role !== role || !this.getById(approved.assetId)) return false
      const entry = this.entriesById.get(approved.assetId)!
      return [entry.primaryWordEs, ...(entry.aliasesEs ?? []), ...(entry.aliasesEn ?? [])]
        .some(word => forms.has(normalize(word)))
    })
  }
  getVariants(concept: string): readonly CuratedModularAssetV1[] { return this.search([concept]) }
  resolveAsset(assetId: string): Buffer {
    const approved = this.getById(assetId)
    const entry = this.entriesById.get(assetId)
    if (!approved || !entry || !entry.runtimeRef) throw new Error('MODULAR_ASSET_NOT_CURATED:' + assetId)
    const bytes = fs.readFileSync(safeFile(this.root, entry.runtimeRef))
    if (sha(bytes) !== approved.sha256 || sha(bytes) !== entry.runtimeSHA256)
      throw new Error('MODULAR_ASSET_SHA_MISMATCH:' + assetId)
    const inspected = inspectPixabayRasterImageV1(bytes)
    if (inspected.mime !== 'image/png' || !inspected.alphaUseful ||
        inspected.width !== entry.runtimeDimensions.width || inspected.height !== entry.runtimeDimensions.height)
      throw new Error('MODULAR_ALPHA_OR_DIMENSIONS_INVALID:' + assetId)
    if (approved.role === 'support') {
      const support = inspectSupportPngV41(bytes)
      if (support.transparentPixels < support.width * support.height * .1 ||
          support.chromaticVisiblePixels > Math.max(12, (support.partialAlphaPixels + support.opaquePixels) * .001)) {
        // The first four historical V4.1 Supports are byte-preserved and tint by silhouette.
        if (!['idea-support-personas-v1', 'idea-support-datos-v1',
          'idea-support-soluciones-v1', 'idea-support-impacto-v1'].includes(assetId))
          throw new Error('MODULAR_SUPPORT_BACKGROUND_OR_COLOR_INVALID:' + assetId)
      }
    }
    return bytes
  }
  publish(projectRoot: string, assetId: string): ImportedModularAssetV1 {
    const curated = this.getById(assetId)
    if (!curated) throw new Error('MODULAR_ASSET_NOT_CURATED:' + assetId)
    const bytes = this.resolveAsset(assetId)
    const result = publishRasterProjectAssetV1({ projectRoot, provider: 'editorial_modular_v1',
      assetId, bytes, requireUsefulAlpha: true,
      source: { providerVersion: MODULAR_CATALOG_REVISION_V1,
        attribution: 'Locally curated Codex/OpenAI generated editorial modular catalog asset' },
      validationRevision: 'editorial-modular-raster-2026-09-v1' })
    if (result.asset.sha256 !== curated.sha256) throw new Error('MODULAR_PUBLISHED_SHA_MISMATCH')
    return { asset: result.asset, curated }
  }
}

export function bindEditorialModularCatalogV1(input: {
  template: { sceneSpec: VisualSceneSpecV2; graphicData: Record<string, any>; renderBindings: RenderBindingsV2 }
  imported: Record<string, ImportedModularAssetV1>
  heroId: string; supportIds: readonly [string, string, string, string]
  rearId?: string; accentId?: string; frontId?: string
  recipe: ModularRecipeV1; accentTheme: IdeaAccentTheme; color: IdeaColorIntentV4
  headline?: { connector: string; keyword: string; closing: string }
}) {
  const source = input.template.sceneSpec
  if (!source.ideaAssembly || !source.presentationProfile ||
      source.presentationProfile.revision !== 'editorial-idea-assembly-2026-09-v4')
    throw new Error('MODULAR_TEMPLATE_MUST_BE_APPROVED_V4')
  const role = (id: string, required: ModularCatalogRoleV1) => {
    const selected = input.imported[id], approved = getCuratedModularAssetV1(id)
    if (!selected || !approved || approved.role !== required || selected.asset.sha256 !== approved.sha256 ||
        selected.asset.id !== id) throw new Error('MODULAR_SELECTION_UNAUTHORIZED:' + id)
    return selected
  }
  const hero = role(input.heroId, 'hero-core')
  const supports = input.supportIds.map(id => role(id, 'support'))
  const layers = [
    input.rearId && { id: 'idea-rear' as const, selected: role(input.rearId, 'rear-collage') },
    input.accentId && { id: 'idea-accent' as const, selected: role(input.accentId, 'accent-mask') },
    input.frontId && { id: 'idea-front' as const, selected: role(input.frontId, 'front-collage') },
  ].filter((item): item is { id: 'idea-rear' | 'idea-accent' | 'idea-front'; selected: ImportedModularAssetV1 } => !!item)
  const colors = resolveIdeaColorV4(input.color)
  if (colors.heroPalette.mode !== 'recolorable') throw new Error('MODULAR_HERO_COLOR_MODE_UNAVAILABLE')
  const resources: IdeaAssemblyResource[] = source.ideaAssembly.resources
    .filter(r => r.id === 'idea-background')
    .map(r => ({ ...r, colorCapability: 'none', accentTreatment: 'none' }))
  for (const { id, selected } of layers) {
    const original = source.ideaAssembly.resources.find(r => r.id === id)
    if (!original) throw new Error('MODULAR_TEMPLATE_RESOURCE_MISSING:' + id)
    resources.push({ ...original, sha256: selected.asset.sha256,
      accentTreatment: id === 'idea-accent' ? 'alpha-mask' : 'none',
      colorCapability: id === 'idea-accent' ? 'accent-primary' : 'none',
      catalogAssetId: selected.curated.assetId, catalogSha256: selected.curated.sha256 })
  }
  const plan: IdeaAssemblyV1 = { ...source.ideaAssembly, revision: EDITORIAL_MODULAR_CATALOG_V1.revision,
    accentTheme: input.accentTheme, resources, supportTint: colors.supportTint, heroPalette: colors.heroPalette,
    catalogRevision: MODULAR_CATALOG_REVISION_V1,
    heroCatalogAssetId: hero.curated.assetId, heroCatalogSha256: hero.curated.sha256, recipe: input.recipe,
    titleAccentResolved: resolveModularTitleAccentV1(colors.heroPalette.primary!),
    supports: source.ideaAssembly.supports.map((support, index) => ({ ...support,
      label: supports[index].curated.primaryWordEs.toLocaleUpperCase('es'),
      catalogAssetId: supports[index].curated.assetId, catalogSha256: supports[index].curated.sha256 })),
  }
  const sceneSpec: VisualSceneSpecV2 = { ...source, presentationProfile: EDITORIAL_MODULAR_CATALOG_V1,
    text: input.headline ? { ...source.text, ...input.headline } : source.text,
    ideaAssembly: plan, slots: source.slots.map(slot => {
      if (slot.state !== 'present') return slot
      if (slot.slotId === 'hero') return { ...slot, sha256: hero.asset.sha256,
        mime: 'image/png' as const, alphaMode: 'useful-alpha' as const, colorCapability: 'none' as const }
      const index = IDEA_SUPPORT_IDS.indexOf(slot.slotId as typeof IDEA_SUPPORT_IDS[number])
      if (index < 0) return slot
      return { ...slot, sha256: supports[index].asset.sha256, mime: 'image/png' as const,
        kind: 'simple-icon' as const, alphaMode: 'useful-alpha' as const,
        colorCapability: 'alpha-mask' as const, tint: { treatment: 'accent-mask' as const } }
    }) }
  const bindingBySlot = new Map<string, { assetId: string; relativeFile: string }>()
  bindingBySlot.set('hero', { assetId: hero.asset.id, relativeFile: hero.asset.relativeFile })
  supports.forEach((selected, index) => bindingBySlot.set(IDEA_SUPPORT_IDS[index],
    { assetId: selected.asset.id, relativeFile: selected.asset.relativeFile }))
  layers.forEach(({ id, selected }) => bindingBySlot.set(id,
    { assetId: selected.asset.id, relativeFile: selected.asset.relativeFile }))
  const renderBindings: RenderBindingsV2 = { version: 2, assets: source.ideaAssembly.resources
    .filter(resource => resource.id === 'idea-background').map(resource => {
      const original = input.template.renderBindings.assets.find(binding => binding.slotId === resource.id)!
      return original
    }).concat([...bindingBySlot].map(([slotId, binding]) => ({ slotId: slotId as RenderBindingsV2['assets'][number]['slotId'], ...binding }))) }
  validateVisualSceneSpecV2(sceneSpec)
  validateRenderBindingsAny(renderBindings, sceneSpec)
  const graphicData = { ...input.template.graphicData,
    extra: { ...input.template.graphicData.extra, sceneSpec } }
  return { sceneSpec, renderBindings, graphicData, pixelIdentity: sceneSpecPixelIdentityAny(sceneSpec) }
}
