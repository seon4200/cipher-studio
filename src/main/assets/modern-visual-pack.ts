import fs from 'fs'
import path from 'path'
import catalogDocument from '../../../public/modern-pack-100-v1/manifest.json'
import { canonicalNarrativeTerm } from '../../shared/asset-intent'
import { narrativeTermsEquivalentV1 } from '../../shared/narrative-term-forms'
import type { VisualConceptV1 } from '../../shared/visual-concepts'
import { MODERN_VISUAL_PACK_V1, type ModernVisualPackAssetV1 } from '../../shared/modern-visual-pack-v1'
import { evaluateSemanticRelevanceV1, relevanceConceptContextV1, relevanceAdmitsRoleV1 } from '../../shared/semantic-relevance-gate-v1'
import { publishVerifiedSvgProjectAssetV1, validateOpenMojiSvgBytes, OPENMOJI_SVG_VALIDATION_REVISION } from './openmoji/publish'

const assets = catalogDocument.assets as ModernVisualPackAssetV1[]
if (catalogDocument.schemaVersion !== 1 || catalogDocument.packId !== MODERN_VISUAL_PACK_V1.id ||
    catalogDocument.revision !== MODERN_VISUAL_PACK_V1.revision) throw new Error('MODERN_PACK_MANIFEST_REVISION_INVALID')
const index = new Map<string, ModernVisualPackAssetV1[]>()
const ids = new Set<string>()
for (const asset of assets) {
  if (ids.has(asset.assetId) || !/^assets\/[a-z0-9-]+\.svg$/.test(asset.localRelativePath) ||
      !/^[a-f0-9]{64}$/.test(asset.sha256) || !['MIT', 'ISC', 'Apache-2.0'].includes(asset.license))
    throw new Error('MODERN_PACK_MANIFEST_INVALID')
  ids.add(asset.assetId)
  Object.freeze(asset.aliasesEs); Object.freeze(asset.aliasesEn); Object.freeze(asset)
  for (const term of new Set([asset.canonicalConcept, ...asset.aliasesEs, ...asset.aliasesEn].map(canonicalNarrativeTerm))) {
    const entries = index.get(term) ?? []; entries.push(asset); index.set(term, entries)
  }
}
Object.freeze(assets)
export type ModernPackLookupAuditV1 = { evaluated: number; rejectedByRelevance: number; missingConcepts: string[] }
export function modernVisualPackCatalogV1(): readonly ModernVisualPackAssetV1[] { return assets }
export function readModernVisualPackAssetV1(assetId: string): Buffer {
  const asset = assets.find(a => a.assetId === assetId)
  if (!asset) throw new Error('MODERN_PACK_ASSET_UNKNOWN')
  const root = path.resolve(__dirname, '../../dist/modern-pack-100-v1')
  const file = path.join(root, asset.localRelativePath)
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error('MODERN_PACK_ASSET_SYMLINK')
  const bytes = fs.readFileSync(file)
  const validated = validateOpenMojiSvgBytes(bytes)
  // Static geometry only; no active content, remote fonts, animation or embedded raster.
  if (/<(?:text|image|animate\w*|set)\b|@font-face/i.test(bytes.toString('utf8')) || validated.sha256 !== asset.sha256)
    throw new Error('MODERN_PACK_ASSET_INTEGRITY_INVALID')
  return bytes
}
export function findModernVisualPackCandidatesV1(concept: VisualConceptV1, role: 'hero' | 'support', recent: readonly string[] = [], audit?: ModernPackLookupAuditV1) {
  if (concept.hygieneAuthority === 'explicit-visual-evidence' || concept.hygiene?.eligibility === 'not-visual' ||
      role === 'hero' && concept.hygiene?.eligibility === 'support-only') return []
  // Retrieval aliases can include related metaphors (scientist → microscope). They are not
  // literal identity for a new pack replacement. Only the concept's own terms enter this index.
  const terms = [concept.normalizedTerm, concept.originalTerm].map(canonicalNarrativeTerm)
  const found = new Map<string, ModernVisualPackAssetV1>()
  for (const term of terms) {
    for (const a of index.get(term) ?? []) found.set(a.assetId, a)
  }
  // Reuse the existing singular/plural authority, never substring or fuzzy matching.
  if (!found.size) for (const [term, entries] of index)
    if (terms.some(t => narrativeTermsEquivalentV1(t, term))) for (const a of entries) found.set(a.assetId, a)
  if (!found.size && audit && !audit.missingConcepts.includes(concept.normalizedTerm)) audit.missingConcepts.push(concept.normalizedTerm)
  const context = relevanceConceptContextV1({ concept })
  return [...found.values()].filter(a => role === 'hero' ? a.heroAllowed : a.supportAllowed).map(asset => ({
    asset, relevance: evaluateSemanticRelevanceV1({ provider: 'modern-pack', authority: 'curated-local',
      descriptors: [asset.canonicalConcept, ...asset.aliasesEs, ...asset.aliasesEn], declaredIdentity: asset.canonicalConcept }, context),
  })).filter(c => {
    const admitted = relevanceAdmitsRoleV1(c.relevance.relevanceClass, role)
    if (audit) { audit.evaluated++; if (!admitted) audit.rejectedByRelevance++ }
    return admitted
  }).sort((a,b) =>
    // Relevance and source/style coherence precede variety. Only equivalent priority rotates.
    b.asset.priority - a.asset.priority || Number(recent.includes(a.asset.assetId)) - Number(recent.includes(b.asset.assetId)) ||
    a.asset.assetId.localeCompare(b.asset.assetId, 'en'))
}
export function publishModernVisualPackAssetV1(projectRoot: string, assetId: string) {
  const entry = assets.find(a => a.assetId === assetId)
  if (!entry) throw new Error('MODERN_PACK_ASSET_UNKNOWN')
  const bytes = readModernVisualPackAssetV1(assetId)
  return publishVerifiedSvgProjectAssetV1(projectRoot, {
    id: `${assetId}-${entry.sha256.slice(0,12)}`, provider: 'modern-pack',
    relativeFile: `materiales/assets/modern-pack/${entry.sha256}.svg`, sha256: entry.sha256,
    mime: 'image/svg+xml', byteLength: bytes.length,
    source: { providerVersion: MODERN_VISUAL_PACK_V1.revision, licenseClaim: entry.license,
      attribution: `${entry.collection}; ${entry.licenseNotice}`, fetchedAt: new Date().toISOString() },
    validation: { status: 'accepted', validationRevision: OPENMOJI_SVG_VALIDATION_REVISION, validatedAt: new Date().toISOString(), warnings: [] },
  }, bytes)
}
