import fs from 'fs'
import path from 'path'
import catalogDocument from '../../../public/modern-pack-100-v1/manifest.json'
import { canonicalNarrativeTerm } from '../../shared/asset-intent'
import { narrativeTermFormsV1 } from '../../shared/narrative-term-forms'
import type { VisualConceptV1 } from '../../shared/visual-concepts'
import { MODERN_VISUAL_PACK_V1, validateModernVisualAssetIdentityV1, type ModernVisualAssetIdentityV1, type ModernVisualPackAssetV1 } from '../../shared/modern-visual-pack-v1'
import { evaluateSemanticRelevanceV1, relevanceConceptContextV1, relevanceAdmitsRoleV1 } from '../../shared/semantic-relevance-gate-v1'
import { publishVerifiedSvgProjectAssetV1, validateOpenMojiSvgBytes, OPENMOJI_SVG_VALIDATION_REVISION } from './openmoji/publish'

export type CatalogEntryV1 = Readonly<{ asset: ModernVisualPackAssetV1; identity: ModernVisualAssetIdentityV1; origin: 'embedded' | 'local'; quality: number }>
/** Backends retrieve literals only; relevance and ranking have ONE authority below. */
export interface CatalogProviderV1 {
  search(terms: readonly string[], inflected?: boolean): readonly CatalogEntryV1[]
  getById(assetId: string): CatalogEntryV1 | undefined
  getVariants(concept: string): readonly CatalogEntryV1[]
  resolveAsset(assetId: string): Buffer
  entries(): readonly CatalogEntryV1[]
}
export type CatalogDiagnosticV1 = { code: string; assetId?: string; detail?: string }
export const DEFAULT_VISUAL_LIBRARY_PATH_V1 = 'C:\\CipherAssets\\VisualLibrary'
const licenses = ['MIT', 'ISC', 'Apache-2.0']
function fail(code: string): never { throw new Error(code) }

/** No traversal, junction, alternate stream or remote locator crosses this boundary. */
function readConfined(root: string, relative: string, maxBytes: number): Buffer {
  if (!path.isAbsolute(root) || root.startsWith('\\\\') || !/^(assets\/[a-z0-9-]+\.svg|notices\/[a-z0-9-]+\.txt|manifest\.json)$/.test(relative)) fail('CATALOG_PATH_INVALID')
  const absoluteRoot = path.resolve(root)
  let cursor = absoluteRoot
  while (true) {
    if (fs.lstatSync(cursor).isSymbolicLink()) fail('CATALOG_SYMLINK')
    const parent = path.dirname(cursor); if (parent === cursor) break; cursor = parent
  }
  cursor = absoluteRoot
  for (const segment of relative.split('/')) {
    cursor = path.join(cursor, segment)
    if (fs.lstatSync(cursor).isSymbolicLink()) fail('CATALOG_SYMLINK')
  }
  const stat = fs.statSync(cursor)
  if (!stat.isFile() || stat.size <= 0 || stat.size > maxBytes) fail('CATALOG_FILE_SIZE_INVALID')
  return fs.readFileSync(cursor)
}
function validatedBytes(root: string, asset: ModernVisualPackAssetV1): Buffer {
  const bytes = readConfined(root, asset.localRelativePath, 2 * 1024 * 1024)
  const validated = validateOpenMojiSvgBytes(bytes)
  if (/<(?:text|image|animate\w*|set)\b|@font-face/i.test(bytes.toString('utf8')) || validated.sha256 !== asset.sha256) fail('MODERN_PACK_ASSET_INTEGRITY_INVALID')
  return bytes
}
function validateAsset(value: unknown, local: boolean): ModernVisualPackAssetV1 {
  if (!value || typeof value !== 'object') fail('CATALOG_ENTRY_INVALID')
  const a = value as ModernVisualPackAssetV1
  const text = (x: unknown) => typeof x === 'string' && x.trim().length > 0 && x.length <= 200
  if (![a.assetId, a.canonicalConcept, a.collection, a.styleFamily].every(text) ||
      ![a.aliasesEs, a.aliasesEn].every(v => Array.isArray(v) && v.length <= 40 && v.every(text)) ||
      !/^assets\/[a-z0-9-]+\.svg$/.test(a.localRelativePath) || !/^notices\/[a-z0-9-]+\.txt$/.test(a.licenseNotice) || a.format !== 'svg' ||
      !/^[a-f0-9]{64}$/.test(a.sha256) || !licenses.includes(a.license) || !['fluent', 'iconify', 'tabler'].includes(a.source) ||
      ![a.originalColor, a.heroAllowed, a.supportAllowed].every(v => typeof v === 'boolean') ||
      !Number.isInteger(a.priority) || a.priority < 0 || a.priority > 100 ||
      !['modern-color','modern-line','modern-solid'].includes(a.styleFamily) ||
      a.originalColor !== (a.styleFamily === 'modern-color') ||
      a.source === 'fluent' && !a.originalColor || a.source === 'tabler' && (a.heroAllowed || a.originalColor) ||
      !(local ? /^local-[a-z0-9-]{1,120}$/ : /^modern-[a-z0-9-]+-v1$/).test(a.assetId)) fail('CATALOG_ENTRY_INVALID')
  return Object.freeze({ ...a, aliasesEs: Object.freeze([...a.aliasesEs]) as unknown as string[], aliasesEn: Object.freeze([...a.aliasesEn]) as unknown as string[] })
}

/** The existing literal index, shared by both backends. Morphology indexed once, not scanned. */
class LiteralManifestIndex implements CatalogProviderV1 {
  private readonly literal = new Map<string, CatalogEntryV1[]>()
  private readonly forms = new Map<string, CatalogEntryV1[]>()
  private readonly byId = new Map<string, CatalogEntryV1>()
  private readonly all: readonly CatalogEntryV1[]
  constructor(entries: readonly CatalogEntryV1[], private readonly root: string) {
    this.all = Object.freeze([...entries])
    for (const entry of entries) {
      if (this.byId.has(entry.asset.assetId)) fail('CATALOG_DUPLICATE_ID')
      this.byId.set(entry.asset.assetId, entry)
      const terms = new Set([entry.asset.canonicalConcept, ...entry.asset.aliasesEs, ...entry.asset.aliasesEn].map(canonicalNarrativeTerm))
      for (const term of terms) {
        const literal = this.literal.get(term) ?? []; literal.push(entry); this.literal.set(term, literal)
      }
      for (const form of new Set([...terms].flatMap(narrativeTermFormsV1))) {
        const inflected = this.forms.get(form) ?? []; inflected.push(entry); this.forms.set(form, inflected)
      }
    }
  }
  search(terms: readonly string[], inflected = false): readonly CatalogEntryV1[] {
    const found = new Map<string, CatalogEntryV1>()
    for (const term of terms) for (const form of inflected ? narrativeTermFormsV1(term) : [canonicalNarrativeTerm(term)])
      for (const entry of (inflected ? this.forms : this.literal).get(form) ?? []) found.set(entry.asset.assetId, entry)
    return [...found.values()]
  }
  getById(assetId: string) { return this.byId.get(assetId) }
  getVariants(concept: string) { const exact = this.search([concept]); return exact.length ? exact : this.search([concept], true) }
  resolveAsset(assetId: string) { const entry = this.getById(assetId); if (!entry) fail('MODERN_PACK_ASSET_UNKNOWN'); return validatedBytes(this.root, entry.asset) }
  entries() { return this.all }
}
export class EmbeddedManifestCatalog extends LiteralManifestIndex {
  constructor() {
    if (catalogDocument.schemaVersion !== 1 || catalogDocument.packId !== MODERN_VISUAL_PACK_V1.id || catalogDocument.revision !== MODERN_VISUAL_PACK_V1.revision) fail('MODERN_PACK_MANIFEST_REVISION_INVALID')
    super(catalogDocument.assets.map(value => {
      const asset = validateAsset(value, false)
      return Object.freeze({ asset, identity: Object.freeze({ ...MODERN_VISUAL_PACK_V1, assetId: asset.assetId }), origin: 'embedded' as const, quality: 3 })
    }), path.resolve(__dirname, '../../dist/modern-pack-100-v1'))
  }
}
export class LocalManifestCatalog extends LiteralManifestIndex {
  /** Read-only snapshot. No downloads, index files or seed copies. */
  constructor(root: string) {
    const document = JSON.parse(readConfined(root, 'manifest.json', 32 * 1024 * 1024).toString('utf8'))
    if (document.schemaVersion !== 1 || !Array.isArray(document.assets) || document.assets.length > 20000 ||
        !Array.isArray(document.collections) || document.collections.length > 32) fail('LOCAL_CATALOG_MANIFEST_INVALID')
    validateModernVisualAssetIdentityV1({ id: document.packId, revision: document.revision, assetId: 'local-validation' })
    if (!document.packId.startsWith('local-')) fail('LOCAL_CATALOG_NAMESPACE_INVALID')
    const notices = new Set<string>()
    const entries = document.assets.map((value: unknown) => {
      const asset = validateAsset(value, true)
      const policy = document.collections.find((c: any) => c.source === asset.source && c.collection === asset.collection)
      if (!policy || policy.licenseApproved !== true || typeof policy.reviewedBy !== 'string' || !policy.reviewedBy.trim() ||
          typeof policy.reviewedAt !== 'string' || Number.isNaN(Date.parse(policy.reviewedAt)) ||
          policy.license !== asset.license || policy.licenseNotice !== asset.licenseNotice || policy.styleFamily !== asset.styleFamily ||
          !Number.isInteger((value as any).quality) || (value as any).quality < 1 || (value as any).quality > 3) fail('LOCAL_CATALOG_CURATION_UNAPPROVED')
      if (!notices.has(asset.licenseNotice)) { readConfined(root, asset.licenseNotice, 256 * 1024); notices.add(asset.licenseNotice) }
      return Object.freeze({ asset, identity: Object.freeze({ id: document.packId, revision: document.revision, assetId: asset.assetId }), origin: 'local' as const, quality: (value as any).quality as number })
    })
    super(entries, root)
  }
}
export class CompositeVisualCatalog implements CatalogProviderV1 {
  private readonly owners = new Map<string, CatalogProviderV1>()
  private readonly all: readonly CatalogEntryV1[]
  constructor(private readonly providers: readonly CatalogProviderV1[], readonly diagnostics: readonly CatalogDiagnosticV1[] = []) {
    const all: CatalogEntryV1[] = [], shas = new Set<string>()
    for (const provider of providers) for (const entry of provider.entries()) {
      if (this.owners.has(entry.asset.assetId)) fail('CATALOG_DUPLICATE_ID')
      // Embedded first: duplicates cannot silently replace an existing identity.
      if (shas.has(entry.asset.sha256)) continue
      shas.add(entry.asset.sha256); this.owners.set(entry.asset.assetId, provider); all.push(entry)
    }
    this.all = Object.freeze(all)
  }
  search(terms: readonly string[], inflected = false): readonly CatalogEntryV1[] {
    return this.providers.flatMap(p => p.search(terms, inflected)).filter(e => this.owners.get(e.asset.assetId)?.getById(e.asset.assetId) === e)
  }
  getById(id: string) { return this.owners.get(id)?.getById(id) }
  getVariants(concept: string) { const exact = this.search([concept]); return exact.length ? exact : this.search([concept], true) }
  resolveAsset(id: string) { const owner = this.owners.get(id); if (!owner) fail('MODERN_PACK_ASSET_UNKNOWN'); return owner.resolveAsset(id) }
  entries() { return this.all }
}
const embedded = new EmbeddedManifestCatalog()
export function createCompositeVisualCatalogV1(root = process.env.CIPHER_VISUAL_LIBRARY_PATH || DEFAULT_VISUAL_LIBRARY_PATH_V1): CompositeVisualCatalog {
  try { return new CompositeVisualCatalog([embedded, new LocalManifestCatalog(root)], [{ code: 'LOCAL_CATALOG_READY' }]) }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'LOCAL_CATALOG_UNAVAILABLE' : 'LOCAL_CATALOG_INVALID'
    // Paths and untrusted JSON/error messages never enter persisted diagnostics.
    const message = error instanceof Error ? error.message : ''
    return new CompositeVisualCatalog([embedded], [{ code, ...(/^[A-Z_]{1,100}$/.test(message) ? { detail: message } : {}) }])
  }
}
export type ModernPackLookupAuditV1 = { evaluated: number; rejectedByRelevance: number; missingConcepts: string[]; catalogDiagnostics?: readonly CatalogDiagnosticV1[] }
export function modernVisualPackCatalogV1(): readonly ModernVisualPackAssetV1[] { return embedded.entries().map(e => e.asset) }
export function readModernVisualPackAssetV1(assetId: string, catalog: CatalogProviderV1 = embedded): Buffer { return catalog.resolveAsset(assetId) }
export function findModernVisualPackCandidatesV1(concept: VisualConceptV1, role: 'hero' | 'support', recent: readonly string[] = [], audit?: ModernPackLookupAuditV1,
  catalog: CatalogProviderV1 = embedded, preferredStyleFamily?: string, preferredCollection?: string) {
  if (concept.hygieneAuthority === 'explicit-visual-evidence' || concept.hygiene?.eligibility === 'not-visual' || role === 'hero' && concept.hygiene?.eligibility === 'support-only') return []
  // Never use semantic retrieval aliases (scientist → microscope) as literal pack identity.
  const terms = [concept.normalizedTerm, concept.originalTerm]
  let found = catalog.search(terms); if (!found.length) found = catalog.search(terms, true)
  if (!found.length && audit && !audit.missingConcepts.includes(concept.normalizedTerm)) audit.missingConcepts.push(concept.normalizedTerm)
  const context = relevanceConceptContextV1({ concept })
  const candidates = found.filter(e => role === 'hero' ? e.asset.heroAllowed : e.asset.supportAllowed).map(entry => ({
    ...entry, relevance: evaluateSemanticRelevanceV1({ provider: 'modern-pack', authority: 'curated-local', descriptors: [entry.asset.canonicalConcept, ...entry.asset.aliasesEs, ...entry.asset.aliasesEn], declaredIdentity: entry.asset.canonicalConcept }, context),
  })).filter(c => {
    const admitted = relevanceAdmitsRoleV1(c.relevance.relevanceClass, role)
    if (audit) { audit.evaluated++; if (!admitted) audit.rejectedByRelevance++ }
    return admitted
  })
  const relevanceRank = (c: typeof candidates[number]) => ['UNRELATED','WEAK','RELATED','STRONG','EXACT'].indexOf(c.relevance.relevanceClass)
  const styleRank = (c: typeof candidates[number]) => Number(c.asset.styleFamily === preferredStyleFamily)
  const collectionRank = (c: typeof candidates[number]) => Number(c.asset.collection === preferredCollection)
  return candidates.sort((a,b) => relevanceRank(b) - relevanceRank(a) || styleRank(b) - styleRank(a) || collectionRank(b) - collectionRank(a) ||
    b.quality - a.quality || b.asset.priority - a.asset.priority || Number(recent.includes(a.asset.assetId)) - Number(recent.includes(b.asset.assetId)) || a.asset.assetId.localeCompare(b.asset.assetId, 'en'))
}
export function publishModernVisualPackAssetV1(projectRoot: string, assetId: string, catalog: CatalogProviderV1 = embedded) {
  const entry = catalog.getById(assetId)
  if (!entry) fail('MODERN_PACK_ASSET_UNKNOWN')
  const bytes = readModernVisualPackAssetV1(assetId, catalog)
  const published = publishVerifiedSvgProjectAssetV1(projectRoot, {
    id: `${assetId}-${entry.asset.sha256.slice(0,12)}`, provider: 'modern-pack', relativeFile: `materiales/assets/modern-pack/${entry.asset.sha256}.svg`,
    sha256: entry.asset.sha256, mime: 'image/svg+xml', byteLength: bytes.length,
    source: { providerVersion: entry.identity.revision, licenseClaim: entry.asset.license,
      attribution: `${entry.asset.collection}; ${entry.asset.licenseNotice}`, fetchedAt: new Date().toISOString(),
      ...(entry.origin === 'local' ? { catalogSnapshot: { identity: entry.identity, originalColor: entry.asset.originalColor,
        heroAllowed: entry.asset.heroAllowed, supportAllowed: entry.asset.supportAllowed } } : {}) },
    validation: { status: 'accepted', validationRevision: OPENMOJI_SVG_VALIDATION_REVISION, validatedAt: new Date().toISOString(), warnings: [] },
  }, bytes)
  // A previous same-content publication can own the path. Never claim a new catalog
  // revision with a stale policy snapshot; fall back through the existing resolver.
  if (entry.origin === 'local' && JSON.stringify(published.asset.source.catalogSnapshot?.identity) !== JSON.stringify(entry.identity))
    fail('LOCAL_CATALOG_PUBLICATION_REVISION_CONFLICT')
  return published
}
