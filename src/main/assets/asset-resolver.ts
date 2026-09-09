import {
  ASSET_INTENT_VERSION,
  canonicalNarrativeTerm,
  createAssetIntentV1,
  type AssetIntentInputV1,
  type AssetIntentV1,
} from '../../shared/asset-intent'
import type { DirectConcreteEvidenceV1, LocalSceneSemanticV1 } from '../../shared/local-scene-semantic'
import type { ProjectAssetRecord } from '../../shared/project-state'
import {
  VISUAL_MVP_STRUCTURES,
  VISUAL_MVP_TREATMENT_REVISION,
  createMvpMotion,
  resolveSceneDensityV2,
  fullSubjectBounds,
  validateVisualSceneSpec,
  visualMvpRevisions,
  type RenderBindingsV1,
  type SceneSlotV1,
  type VisualDirectionV1,
  type VisualMvpStructure,
  type VisualSceneSpecV1,
} from '../../shared/visual-scene-spec'
import type { NombreSistema } from '../../shared/sistemas'
import { resolverSolarDetallado } from '../../shared/iconos-solar'
import { readAssetStorage } from '../services/project-persistence'
import {
  OpenMojiAssetError,
  publishOpenMojiAsset,
  requireAssetProjectRoot,
  verifyProjectAssetContent,
} from './openmoji/publish'
import { searchOpenMoji, type OpenMojiCatalogEntry } from './openmoji/catalog'

export const ASSET_RESOLVER_VERSION = 1 as const
export const MAX_OPENMOJI_QUERIES_V1 = 4
export const MAX_OPENMOJI_RESULTS_PER_QUERY_V1 = 3
export const MAX_OPENMOJI_CANDIDATES_V1 = 6

export type ResolverScoreV1 = 0 | 1 | 2 | 3
export type ResolverProviderV1 = 'project-asset' | 'openmoji' | 'solar' | 'editorial-text'
export type ResolverVisualModeV1 = 'asset-led' | 'editorial-text'
export type ResolverAlertCodeV1 =
  | 'NO_VISUAL_METAPHOR'
  | 'AMBIGUOUS_ASSET_CANDIDATES'
  | 'PROJECT_ASSET_INVALID'
  | 'PROVIDER_NO_USABLE_RESULT'
  | 'FALLBACK_EDITORIAL'
  | 'RESOLVER_DEGRADED'

export type ResolverAlertV1 = {
  code: ResolverAlertCodeV1
  severity: 'info' | 'warning'
  message: string
}

export type MetaphorCandidateV1 = {
  id: string
  label: string
  family: 'icon-monochrome' | 'flat-illustration'
  kind: 'simple-icon' | 'complex-illustration'
  score: 2 | 3
  openmojiQuery: string
  expectedStableId?: string
  solarName?: string
  preferProvider: 'openmoji' | 'solar'
  /** Whether the subject survives as a silhouette or needs its internal marks to remain visible. */
  detailReliance?: 'silhouette' | 'interior-detail'
  /** Local semantic evidence is diagnostic/scoring input only; it never reaches RenderSpec. */
  directEvidence?: readonly DirectConcreteEvidenceV1[]
}

export type ResolverProviderCandidateV1 = {
  provider: ResolverProviderV1
  identity: string
  score: ResolverScoreV1
  reason: string
  query?: string
  stableId?: string
  annotation?: string
}

export type ResolverTraceV1 = {
  sceneId: string
  input: AssetIntentV1
  metaphorCandidates: Array<{ id: string; score: ResolverScoreV1; reason: string }>
  selectedMetaphor: string | null
  providerCandidates: ResolverProviderCandidateV1[]
  selectedCandidate: ResolverProviderCandidateV1 | null
  visualMode: ResolverVisualModeV1
  treatment: { requested: string; effective: string; reason: string; revision: string } | null
  structure: VisualMvpStructure
  reuse: { allowedByContinuity: boolean; reusedProjectAsset: boolean; reason: string | null }
  fallback: string | null
  reasons: string[]
  localContext?: {
    start: number
    end: number
    localText: string
    globalContextRef?: string
    globalTextLength: number
    globalHints: string[]
    directEvidence: DirectConcreteEvidenceV1[]
  }
}

export type ResolvedHeroV1 =
  | {
    provider: 'openmoji'
    stableId: string
    assetId: string
    relativeFile: string
    sha256: string
    mime: 'image/svg+xml'
    kind: 'simple-icon' | 'complex-illustration'
    treatment: 'none' | 'accent-mask' | 'duotone'
    published: 'created' | 'reused'
  }
  | {
    provider: 'solar'
    solarName: string
    solarStyle: 'linear' | 'bold-duotone'
    kind: 'simple-icon'
  }

export type ResolvedSceneDecisionV1 = {
  version: typeof ASSET_RESOLVER_VERSION
  sceneId: string
  intent: AssetIntentV1
  visualMode: ResolverVisualModeV1
  metaphor: MetaphorCandidateV1 | null
  hero: ResolvedHeroV1 | null
  structure: VisualMvpStructure
  reasons: string[]
  fallback: string | null
  alerts: ResolverAlertV1[]
}

export type CompiledResolvedSceneV1 = {
  sceneSpec: VisualSceneSpecV1
  renderBindings: RenderBindingsV1
  graphicData: {
    type: 'visual_escena'
    value: string
    extra: { sceneSpec: VisualSceneSpecV1 }
  }
}

export type ResolverResultV1 = {
  decision: ResolvedSceneDecisionV1
  trace: ResolverTraceV1
  compiled: CompiledResolvedSceneV1
  metrics: {
    openMojiQueries: number
    openMojiCandidates: number
    projectAssetsReused: number
    assetsPublished: number
    manifestReads: number
  }
}

type HistoryEntry = {
  sceneId: string
  metaphorId: string | null
  assetIdentity: string | null
  structure: VisualMvpStructure
  treatment: string | null
}

export type ResolverSessionV1 = {
  version: typeof ASSET_RESOLVER_VERSION
  history: HistoryEntry[]
}

export type ResolveSceneInputV1 = {
  intent: AssetIntentV1
  /** Bounded timestamp-local context. Its global text is retained only for diagnostics. */
  localSemantic?: LocalSceneSemanticV1
  /** Required only if an OpenMoji candidate must be reused or materialized. Never defaults to cwd. */
  projectRoot?: unknown
  sistema: NombreSistema
  direction: {
    fondo: unknown
    estructura?: unknown
    camara: unknown
    densidad: unknown
    ritmo: unknown
    semilla: unknown
  }
  session?: ResolverSessionV1
}

export class AssetResolverError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'AssetResolverError'
  }
}

function fail(code: string, message: string, details: Record<string, unknown> = {}): never {
  throw new AssetResolverError(code, message, details)
}

/**
 * This is the executable, intentionally small subset of metaforas-v1.md. The terms are
 * category rules, not scene IDs or a lookup of the human 42-scene decisions.
 */
const METAPHOR_RULES: ReadonlyArray<MetaphorCandidateV1 & { terms: readonly string[] }> = [
  // Concrete category rules are deliberately semantic categories, never forensic scene IDs.
  // They cover vocabulary that is already present in production narration even when its
  // historical Solar hint was a generic star/settings glyph.
  { id: 'football-soccer-ball', label: 'fútbol → balón', family: 'icon-monochrome', kind: 'simple-icon', score: 3,
    terms: ['futbol', 'fútbol', 'balon', 'balón', 'soccer'],
    openmojiQuery: 'soccer ball', expectedStableId: 'openmoji:26bd', preferProvider: 'openmoji',
    detailReliance: 'interior-detail' },
  { id: 'stadium', label: 'estadio → estadio', family: 'flat-illustration', kind: 'complex-illustration', score: 3,
    terms: ['estadio', 'estadios'], openmojiQuery: 'stadium', expectedStableId: 'openmoji:1f3df', preferProvider: 'openmoji' },
  { id: 'construction', label: 'construcción → obra', family: 'flat-illustration', kind: 'complex-illustration', score: 3,
    terms: ['construir', 'construccion', 'construcción', 'obras'],
    openmojiQuery: 'building construction', expectedStableId: 'openmoji:1f3d7', preferProvider: 'openmoji' },
  { id: 'construction-worker', label: 'trabajadores → obrero', family: 'flat-illustration', kind: 'complex-illustration', score: 3,
    terms: ['trabajador', 'trabajadores', 'obrero', 'obreros'],
    openmojiQuery: 'construction worker', expectedStableId: 'openmoji:1f477', preferProvider: 'openmoji' },
  { id: 'beer-mug', label: 'cerveza → tarro', family: 'icon-monochrome', kind: 'simple-icon', score: 3,
    terms: ['cerveza', 'alcohol', 'beer'], openmojiQuery: 'beer mug', expectedStableId: 'openmoji:1f37a', preferProvider: 'openmoji' },
  { id: 'protest-flag', label: 'protesta → bandera', family: 'icon-monochrome', kind: 'simple-icon', score: 2,
    terms: ['protesta', 'protestas', 'manifestacion', 'manifestación'],
    openmojiQuery: 'triangular flag', expectedStableId: 'openmoji:1f6a9', preferProvider: 'openmoji' },
  { id: 'mexico-flag', label: 'México → bandera', family: 'icon-monochrome', kind: 'simple-icon', score: 3,
    terms: ['mexico', 'méxico', 'mexicanos'],
    openmojiQuery: 'flag mexico', expectedStableId: 'openmoji:1f1f2-1f1fd', preferProvider: 'openmoji' },
  { id: 'birthday-cake', label: 'cumpleaños → pastel', family: 'icon-monochrome', kind: 'simple-icon', score: 3,
    terms: ['cumpleanos', 'cumpleaños', 'birthday', 'pastel', 'torta', 'cake'],
    openmojiQuery: 'birthday cake', expectedStableId: 'openmoji:1f382', preferProvider: 'openmoji' },
  { id: 'time-stopwatch', label: 'tiempo → cronómetro', family: 'icon-monochrome', kind: 'simple-icon', score: 3,
    terms: ['tiempo', 'reloj', 'hora', 'horas', 'segundo', 'segundos', 'precision', 'retraso', 'desincron'],
    openmojiQuery: 'stopwatch', expectedStableId: 'openmoji:23f1', solarName: 'stopwatch', preferProvider: 'solar' },
  { id: 'direction-compass', label: 'dirección → brújula', family: 'icon-monochrome', kind: 'simple-icon', score: 3,
    terms: ['direccion', 'brujula', 'objetivo', 'rumbo'],
    openmojiQuery: 'compass', expectedStableId: 'openmoji:1f9ed', solarName: 'compass', preferProvider: 'openmoji' },
  { id: 'evidence-magnifier', label: 'evidencia → lupa', family: 'icon-monochrome', kind: 'simple-icon', score: 3,
    terms: ['evidencia', 'prueba', 'indicio', 'investigacion', 'investigar', 'entender'],
    openmojiQuery: 'magnifying glass', expectedStableId: 'openmoji:1f50d', solarName: 'document', preferProvider: 'solar' },
  { id: 'universe-astronaut', label: 'universo → astronauta', family: 'flat-illustration', kind: 'complex-illustration', score: 3,
    terms: ['universo', 'espacio', 'cosmos', 'galaxia', 'astronauta', 'astronaut'],
    openmojiQuery: 'astronaut', expectedStableId: 'openmoji:1f9d1-200d-1f680', solarName: 'telescope', preferProvider: 'openmoji' },
  { id: 'discovery-notebook', label: 'descubrimiento → cuaderno', family: 'icon-monochrome', kind: 'simple-icon', score: 3,
    terms: ['descubrir', 'descubrio', 'descubrió', 'notas', 'apuntes', 'cuaderno'],
    openmojiQuery: 'notebook', expectedStableId: 'openmoji:1f4d3', solarName: 'book', preferProvider: 'solar' },
  { id: 'connection-link', label: 'conexión → eslabón', family: 'icon-monochrome', kind: 'simple-icon', score: 3,
    terms: ['conexion', 'red', 'vinculo', 'enlace', 'conecta'],
    openmojiQuery: 'link', expectedStableId: 'openmoji:1f517', solarName: 'link', preferProvider: 'solar' },
  { id: 'growth-seedling', label: 'crecimiento → brote', family: 'icon-monochrome', kind: 'simple-icon', score: 2,
    terms: ['crecimiento', 'tendencia', 'naturaleza', 'brote', 'semilla', 'hoja'],
    openmojiQuery: 'seedling', expectedStableId: 'openmoji:1f331', solarName: 'leaf', preferProvider: 'openmoji' },
  { id: 'heart', label: 'corazón → corazón', family: 'icon-monochrome', kind: 'simple-icon', score: 3,
    terms: ['corazon', 'luciérnagas', 'luciernagas'],
    openmojiQuery: 'red heart', expectedStableId: 'openmoji:2764', solarName: 'heart', preferProvider: 'openmoji' },
  { id: 'bridge', label: 'puente → puente', family: 'flat-illustration', kind: 'complex-illustration', score: 2,
    terms: ['puente', 'puentes'],
    openmojiQuery: 'bridge', expectedStableId: 'openmoji:1f309', preferProvider: 'openmoji' },
  { id: 'calendar', label: 'calendario → calendario', family: 'icon-monochrome', kind: 'simple-icon', score: 3,
    terms: ['calendario', 'clausurado', 'anos', 'año', 'años'],
    openmojiQuery: 'calendar', expectedStableId: 'openmoji:1f4c5', solarName: 'calendar', preferProvider: 'solar' },
  { id: 'map', label: 'mapa → mapa', family: 'icon-monochrome', kind: 'simple-icon', score: 3,
    terms: ['mapa', 'map'],
    openmojiQuery: 'world map', expectedStableId: 'openmoji:1f5fa', solarName: 'map', preferProvider: 'solar' },
  { id: 'sun', label: 'sol → sol', family: 'icon-monochrome', kind: 'simple-icon', score: 3,
    terms: ['sol', 'solar'],
    openmojiQuery: 'sun', expectedStableId: 'openmoji:2600', solarName: 'sun', preferProvider: 'solar' },
  { id: 'hook', label: 'enganche → gancho', family: 'flat-illustration', kind: 'complex-illustration', score: 3,
    terms: ['gancho', 'embarcacion', 'embarcación'],
    openmojiQuery: 'hook', expectedStableId: 'openmoji:1fa9d', preferProvider: 'openmoji' },
  { id: 'bed', label: 'cama → cama', family: 'icon-monochrome', kind: 'simple-icon', score: 2,
    terms: ['cama'], openmojiQuery: 'bed', expectedStableId: 'openmoji:1f6cf', preferProvider: 'openmoji' },
  { id: 'wind', label: 'corriente → viento', family: 'icon-monochrome', kind: 'simple-icon', score: 3,
    terms: ['aire', 'viento', 'corriente', 'corrientes'],
    openmojiQuery: 'wind face', expectedStableId: 'openmoji:1f32c', preferProvider: 'openmoji' },
  { id: 'magic-sparkles', label: 'magia → destellos', family: 'icon-monochrome', kind: 'simple-icon', score: 2,
    terms: ['magia', 'misterio'],
    openmojiQuery: 'sparkles', expectedStableId: 'openmoji:2728', solarName: 'star', preferProvider: 'openmoji' },
  { id: 'money-coin', label: 'dinero → moneda', family: 'icon-monochrome', kind: 'simple-icon', score: 3,
    terms: ['dinero', 'moneda', 'economia', 'economía'],
    openmojiQuery: 'coin', expectedStableId: 'openmoji:1fa99', preferProvider: 'openmoji' },
  { id: 'technology-computer', label: 'tecnología → computadora', family: 'icon-monochrome', kind: 'simple-icon', score: 3,
    terms: ['tecnologia', 'tecnología', 'computadora', 'ordenador'],
    openmojiQuery: 'desktop computer', expectedStableId: 'openmoji:1f5a5', solarName: 'monitor', preferProvider: 'solar' },
]

const HUMAN_SCENE_TERMS = [
  'persona', 'personas', 'gente', 'multitud', 'peaton', 'peatones', 'transeunte', 'transeuntes',
  'policia', 'ejercito', 'soldado', 'marcha', 'marcharon', 'caminan', 'caminar',
  'crowd', 'people', 'pedestrian', 'soldier', 'police', 'army',
]
const HISTORICAL_OR_CONTEXTUAL_TERMS = [
  'historia', 'historico', 'londres', 'hoygens', 'mastil', 'archivo', 'vintage', 'grabado',
]
const ABSTRACT_PROCESS_TERMS = [
  'termodinam', 'caos', 'sincroniz', 'oscilador', 'requer', 'caida', 'proceso', 'relacion',
]

// Only deliberate linguistic stems can use prefix matching. Generic words such as `persona`
// must remain whole words: otherwise `personal` becomes a human-scene veto by accident.
const CONTROLLED_STEM_TERMS = new Set(['termodinam', 'sincroniz', 'desincron', 'requer'])
const GENERIC_HUMAN_EVIDENCE = new Set([
  'persona', 'personas', 'gente', 'hombre', 'mujer', 'religioso', 'multitud', 'aficion',
  'person', 'people', 'crowd', 'human',
])
// These are narrative events/conditions, not visual entities. An upstream generic icon (for
// example, shield for an accident) may be evaluated but cannot become a strong Hero solely by
// exact emoji equality.
const NON_ENTITY_EVIDENCE = new Set([
  'accidente', 'problema', 'indignacion', 'contradiccion', 'recuperacion', 'estabilidad',
  'religion', 'religioso', 'vida', 'practicas', 'decisiones', 'fiebre', 'mundialista',
])

function narrativeWords(intent: AssetIntentV1, localSemantic?: LocalSceneSemanticV1, includeConcepts = true): string {
  const values = [localSemantic?.localText ?? intent.phrase, intent.keyword, intent.anchor, intent.relation,
    ...(includeConcepts ? intent.concepts : []), ...intent.searchTerms]
  return values.filter((value): value is string => typeof value === 'string')
    .map(canonicalNarrativeTerm).filter(Boolean).join(' ')
}

function primaryNarrativeWords(intent: AssetIntentV1, localSemantic?: LocalSceneSemanticV1): string {
  return [localSemantic?.localText ?? intent.phrase, intent.keyword, intent.anchor, intent.relation]
    .filter((value): value is string => typeof value === 'string')
    .map(canonicalNarrativeTerm).filter(Boolean).join(' ')
}

function hasTerm(text: string, term: string): boolean {
  const needle = canonicalNarrativeTerm(term)
  if (!needle) return false
  const words = text.split(' ').filter(Boolean)
  const wanted = needle.split(' ').filter(Boolean)
  if (wanted.length > 1) {
    return words.some((_, start) => wanted.every((word, index) => words[start + index] === word))
  }
  return words.some(word => word === needle || (CONTROLLED_STEM_TERMS.has(needle) && word.startsWith(needle)))
}

function evidenceText(entry: OpenMojiCatalogEntry): string {
  return [entry.annotation, ...entry.tags, ...entry.aliases].map(canonicalNarrativeTerm).join(' ')
}

function evidenceMatches(text: string, raw: string | undefined): boolean {
  const expected = canonicalNarrativeTerm(raw)
  if (!expected) return false
  const wanted = expected.split(' ').filter(Boolean)
  const words = text.split(' ').filter(Boolean)
  return wanted.length > 0 && wanted.every(word => words.includes(word))
}

/** Emoji identity ignores text/emoji presentation selectors but never changes asset identity. */
function emojiIdentity(value: string | undefined): string {
  return String(value ?? '').normalize('NFC').replace(/[\uFE0E\uFE0F]/g, '')
}

function emojiQueryVariants(value: string): string[] {
  const base = emojiIdentity(value)
  if (!base || /^[\x00-\x7F]+$/.test(base)) return [value]
  return [...new Set([value, base, base + '\uFE0F'])]
}

function genericHumanEvidence(evidence: DirectConcreteEvidenceV1): boolean {
  return GENERIC_HUMAN_EVIDENCE.has(canonicalNarrativeTerm(evidence.label))
}

function nonEntityEvidence(evidence: DirectConcreteEvidenceV1): boolean {
  return NON_ENTITY_EVIDENCE.has(canonicalNarrativeTerm(evidence.label))
}

function directEvidenceRank(evidence: DirectConcreteEvidenceV1): number {
  // The source is the primary authority: an exact local emoji or label is stronger
  // evidence than an old anchor that may have been produced for an adjacent clause.
  // Relevance only breaks ties within the same evidence source.
  const source = { emoji: 0, label: 1, anchor: 2, 'canonical-hint': 3, keyword: 4 }[evidence.source]
  const relevance = { anchor: 0, keyword: 1, concept: 2, context: 3 }[evidence.relevance]
  return source * 10 + relevance
}

function directEvidenceQueries(evidence: readonly DirectConcreteEvidenceV1[]): string[] {
  const sourceOrder = { emoji: 0, label: 1, anchor: 2, 'canonical-hint': 3, keyword: 4 } as const
  const sorted = [...evidence].sort((a, b) => sourceOrder[a.source] - sourceOrder[b.source] ||
    directEvidenceRank(a) - directEvidenceRank(b) ||
    canonicalNarrativeTerm(a.query).localeCompare(canonicalNarrativeTerm(b.query), 'es'))
  const seen = new Set<string>()
  const output: string[] = []
  for (const item of sorted) {
    // canonicalNarrativeTerm deliberately removes emoji; preserve them as search identities.
    // The metadata may carry VS16 while upstream concepts omit it, so ask the local
    // catalog for both presentation-equivalent forms without altering its scoring.
    const variants = item.source === 'emoji' ? emojiQueryVariants(item.query) : [item.query]
    for (const query of variants) {
      const key = canonicalNarrativeTerm(query) || 'emoji:' + query.normalize('NFC')
      if (seen.has(key)) continue
      seen.add(key)
      output.push(query)
    }
  }
  return output
}

function evidenceBelongsToKeyword(evidence: DirectConcreteEvidenceV1, keyword: string): boolean {
  const target = canonicalNarrativeTerm(keyword)
  if (!target) return false
  return [evidence.label, evidence.canonicalHint, evidence.query]
    .some(value => canonicalNarrativeTerm(value) === target)
}

function directConcreteMetaphor(localSemantic: LocalSceneSemanticV1 | undefined, keyword: string): MetaphorCandidateV1 | null {
  const evidence = Array.isArray(localSemantic?.directEvidence) ? [...localSemantic!.directEvidence] : []
  const useful = evidence.filter(candidate => typeof candidate?.query === 'string' && candidate.query.trim())
  if (!useful.length) return null
  // A selected local subject narrows the semantic scope before source priority is applied.
  // It prevents a neighbouring entity present in the same old concept list (for example,
  // FIFA) from displacing the local noun that the scene actually names (iglesia).
  const keywordEvidence = useful.filter(evidence => evidenceBelongsToKeyword(evidence, keyword))
  const keywordTerm = canonicalNarrativeTerm(keyword)
  // An event/condition or a generic human label needs its own concrete evidence. It may not
  // borrow an unrelated old concept merely because that concept happened to be structured in
  // the same response (for example, indignación inheriting a FIFA office/shield icon).
  if (!keywordEvidence.length && (NON_ENTITY_EVIDENCE.has(keywordTerm) || GENERIC_HUMAN_EVIDENCE.has(keywordTerm)))
    return null
  const scoped = keywordEvidence.length ? keywordEvidence : useful
  scoped.sort((a, b) => directEvidenceRank(a) - directEvidenceRank(b) ||
    canonicalNarrativeTerm(a.query).localeCompare(canonicalNarrativeTerm(b.query), 'es'))
  const lead = scoped[0]
  const strong = (lead.relevance === 'anchor' || lead.relevance === 'keyword') && !genericHumanEvidence(lead)
  const complex = /\u200d/u.test(lead.emoji ?? '') || /(?:astronaut|worker|family|couple)/i.test(lead.canonicalHint ?? '')
  const idStem = canonicalNarrativeTerm(lead.label ?? lead.query).replace(/\s+/g, '-').slice(0, 48) || 'evidence'
  return {
    id: 'direct-concrete-' + idStem,
    label: 'evidencia concreta → ' + (lead.label ?? lead.query),
    family: complex ? 'flat-illustration' : 'icon-monochrome',
    kind: complex ? 'complex-illustration' : 'simple-icon',
    score: strong ? 3 : 2,
    openmojiQuery: lead.query,
    preferProvider: 'openmoji',
    directEvidence: scoped,
  }
}

function recent(session: ResolverSessionV1, count: number): HistoryEntry[] {
  return session.history.slice(Math.max(0, session.history.length - count))
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function emptyBindings(): RenderBindingsV1 {
  return { assets: [] }
}

function canonicalAssetIdForOpenMoji(entry: OpenMojiCatalogEntry): string {
  return 'openmoji-' + entry.hexcode.toLowerCase() + '-'
}

function isValidProjectAsset(projectRoot: string, candidate: ProjectAssetRecord): boolean {
  try {
    verifyProjectAssetContent(projectRoot, candidate)
    return true
  } catch {
    return false
  }
}

function existingOpenMojiAsset(
  projectRoot: string,
  entry: OpenMojiCatalogEntry,
): { asset: ProjectAssetRecord | null; invalid: boolean; manifestReads: number } {
  const storage = readAssetStorage(projectRoot)
  if (storage.status === 'absent') return { asset: null, invalid: false, manifestReads: 1 }
  if (storage.status !== 'valid' && storage.status !== 'recovered-from-backup') return { asset: null, invalid: true, manifestReads: 1 }
  const prefix = canonicalAssetIdForOpenMoji(entry)
  const candidate = storage.manifest.assets.find(asset => asset.provider === 'openmoji' &&
    asset.id.toLowerCase().startsWith(prefix) && asset.validation.status === 'accepted')
  if (!candidate) return { asset: null, invalid: false, manifestReads: 1 }
  return isValidProjectAsset(projectRoot, candidate)
    ? { asset: candidate, invalid: false, manifestReads: 1 }
    : { asset: null, invalid: true, manifestReads: 1 }
}

function resolveMetaphor(intent: AssetIntentV1, localSemantic?: LocalSceneSemanticV1): { metaphor: MetaphorCandidateV1 | null; reason: string } {
  if (intent.preferredVisualMode === 'editorial-text') return { metaphor: null, reason: 'PREFERRED_EDITORIAL_TEXT' }
  const all = narrativeWords(intent, localSemantic)
  const primary = primaryNarrativeWords(intent, localSemantic)
  // The local selector has already discarded residual tokens. For a localized production
  // input, its keyword represents the timed subclip and must outrank an anchor inherited from
  // a neighbouring/global semantic response. The old non-local public consumer keeps its
  // historical anchor-first order for compatibility.
  const anchorWords = canonicalNarrativeTerm(intent.anchor)
  const keywordWords = canonicalNarrativeTerm(intent.keyword)
  const anchorRule = METAPHOR_RULES.find(rule => rule.terms.some(term => hasTerm(anchorWords, term)))
  const keywordRule = METAPHOR_RULES.find(rule => rule.terms.some(term => hasTerm(keywordWords, term)))
  const localKeywordMustNotBorrowAnchor = NON_ENTITY_EVIDENCE.has(keywordWords) || GENERIC_HUMAN_EVIDENCE.has(keywordWords)
  const directRule = localSemantic
    ? (keywordRule ?? (localKeywordMustNotBorrowAnchor ? undefined : anchorRule))
    : (anchorRule ?? keywordRule)
  const directEvidence = directConcreteMetaphor(localSemantic, intent.keyword)
  // A known category rule is already a tested metaphor and therefore outranks a loose old
  // Solar hint such as `star` for a football scene. Direct evidence remains the second route:
  // it catches concrete emoji/labels that do not yet need a category rule. Bare abstract
  // labels such as "tiempo" preserve Solar-first rather than becoming an OpenMoji search.
  if (directRule) {
    const { terms: _terms, ...metaphor } = directRule
    return { metaphor, reason: 'CONCRETE_METAPHOR:' + metaphor.id }
  }
  if (directEvidence)
    return { metaphor: directEvidence, reason: 'DIRECT_CONCRETE_EVIDENCE:' + directEvidence.id }
  if (HUMAN_SCENE_TERMS.some(term => hasTerm(all, term))) return { metaphor: null, reason: 'HUMAN_SCENE_REQUIRES_EDITORIAL' }
  if (HISTORICAL_OR_CONTEXTUAL_TERMS.some(term => hasTerm(primary, term))) return { metaphor: null, reason: 'CONTEXTUAL_HISTORY_REQUIRES_EDITORIAL' }
  // A broad process word in the phrase must not erase an explicit concrete keyword such as
  // "tiempo" or an explicit anchor. Without that signal, an abstract process remains valid
  // editorial text rather than a forced generic Hero.
  if (!directRule && ABSTRACT_PROCESS_TERMS.some(term => hasTerm(primary, term)))
    return { metaphor: null, reason: 'ABSTRACT_PROCESS_WITHOUT_OBJECT' }
  const selected = METAPHOR_RULES.find(rule => rule.terms.some(term => hasTerm(primary, term)))
  if (!selected) return { metaphor: null, reason: 'NO_CONCRETE_METAPHOR' }
  const { terms: _terms, ...metaphor } = selected
  return { metaphor, reason: 'CONCRETE_METAPHOR:' + metaphor.id }
}

function candidateScore(entry: OpenMojiCatalogEntry, metaphor: MetaphorCandidateV1): ResolverScoreV1 {
  if (metaphor.expectedStableId && entry.stableId === metaphor.expectedStableId) return 3
  if (metaphor.directEvidence?.length) {
    let directScore: ResolverScoreV1 = 1
    const source = evidenceText(entry)
    for (const evidence of metaphor.directEvidence) {
      const exactEmoji = !!evidence.emoji && emojiIdentity(entry.emoji) === emojiIdentity(evidence.emoji)
      const labelMatch = evidenceMatches(source, evidence.label)
      const hintMatch = evidenceMatches(source, evidence.canonicalHint)
      const semanticText = labelMatch || hintMatch
      // A generic provider hint cannot turn an event/condition into its literal upstream
      // icon: `accidente` + `shield` is not a defendable Hero. Such evidence needs a real
      // narrative-label match; otherwise the normal editorial fallback remains available.
      if (nonEntityEvidence(evidence) && !labelMatch) continue
      if (genericHumanEvidence(evidence) && !semanticText) continue
      if (labelMatch) {
        const score: ResolverScoreV1 = evidence.relevance === 'anchor' || evidence.relevance === 'keyword' ? 3 : 2
        directScore = Math.max(directScore, score) as ResolverScoreV1
      } else if (hintMatch) {
        // A provider-oriented icon hint is useful recall evidence, but cannot outrank the
        // narrative label that names the concrete object.
        directScore = Math.max(directScore, 2) as ResolverScoreV1
      } else if (exactEmoji) {
        // An exact emoji is evidence worth evaluating, but without a matching label/hint it is
        // never promoted to a strong metaphor (for example, shield ≠ accident).
        const score: ResolverScoreV1 = evidence.relevance === 'anchor' || evidence.relevance === 'keyword' ? 3 : 2
        directScore = Math.max(directScore, score) as ResolverScoreV1
      }
    }
    if (directScore > 1) return directScore
  }
  const expected = canonicalNarrativeTerm(metaphor.openmojiQuery)
  const annotation = canonicalNarrativeTerm(entry.annotation)
  if (annotation === expected) return 3
  const expectedTokens = expected.split(' ').filter(Boolean)
  const source = [annotation, ...entry.tags, ...entry.aliases].map(canonicalNarrativeTerm).join(' ')
  if (expectedTokens.length && expectedTokens.every(token => source.split(' ').includes(token))) return 2
  return 1
}

function orderedQueries(intent: AssetIntentV1, metaphor: MetaphorCandidateV1): Array<{ source: string; query: string }> {
  const sources: Array<{ source: string; values: readonly string[] }> = [
    ...(metaphor.directEvidence
      ? [{ source: 'direct-concrete-evidence', values: directEvidenceQueries(metaphor.directEvidence) }]
      : []),
    { source: 'concrete-metaphor', values: [metaphor.openmojiQuery] },
    { source: 'anchor', values: intent.anchor ? [intent.anchor] : [] },
    { source: 'keyword', values: [intent.keyword] },
    { source: 'concept', values: intent.concepts },
    { source: 'search-term', values: intent.searchTerms },
  ]
  const seen = new Set<string>()
  const output: Array<{ source: string; query: string }> = []
  for (const group of sources) for (const raw of group.values) {
    const query = String(raw ?? '').trim()
    const key = canonicalNarrativeTerm(query) || 'emoji:' + query.normalize('NFC')
    if (!key || seen.has(key)) continue
    seen.add(key)
    output.push({ source: group.source, query })
    if (output.length === MAX_OPENMOJI_QUERIES_V1) return output
  }
  return output
}

function openMojiCandidates(intent: AssetIntentV1, metaphor: MetaphorCandidateV1): {
  candidates: Array<{ entry: OpenMojiCatalogEntry; score: ResolverScoreV1; query: string }>
  trace: ResolverProviderCandidateV1[]
  queries: number
} {
  const unique = new Map<string, { entry: OpenMojiCatalogEntry; score: ResolverScoreV1; query: string }>()
  const trace: ResolverProviderCandidateV1[] = []
  const queries = orderedQueries(intent, metaphor)
  for (const request of queries) {
    const results = searchOpenMoji(request.query, { limit: MAX_OPENMOJI_RESULTS_PER_QUERY_V1 })
    for (const result of results) {
      if (unique.size >= MAX_OPENMOJI_CANDIDATES_V1 && !unique.has(result.entry.stableId)) continue
      const score = candidateScore(result.entry, metaphor)
      const prior = unique.get(result.entry.stableId)
      if (!prior || score > prior.score) unique.set(result.entry.stableId, { entry: result.entry, score, query: request.query })
      trace.push({ provider: 'openmoji', identity: result.entry.stableId, score,
        reason: request.source + ':' + result.matchReason, query: request.query,
        stableId: result.entry.stableId, annotation: result.entry.annotation })
    }
  }
  return {
    candidates: [...unique.values()].sort((a, b) => b.score - a.score ||
      a.entry.stableId.localeCompare(b.entry.stableId, 'en')),
    trace,
    queries: queries.length,
  }
}

export function chooseSemanticCandidateV1<T extends { identity: string; score: ResolverScoreV1 }>(
  candidates: readonly T[],
): { selected: T | null; reason: 'selected' | 'below-threshold' | 'ambiguous' | 'empty' } {
  if (!candidates.length) return { selected: null, reason: 'empty' }
  const ordered = [...candidates].sort((a, b) => b.score - a.score || a.identity.localeCompare(b.identity, 'en'))
  const top = ordered[0]
  if (top.score < 2) return { selected: null, reason: 'below-threshold' }
  if (ordered.filter(candidate => candidate.score === top.score && candidate.identity !== top.identity).length)
    return { selected: null, reason: 'ambiguous' }
  return { selected: top, reason: 'selected' }
}

export function createResolverSessionV1(): ResolverSessionV1 {
  return { version: ASSET_RESOLVER_VERSION, history: [] }
}

function usableSession(value: ResolverSessionV1 | undefined): ResolverSessionV1 {
  if (!value) return createResolverSessionV1()
  if (value.version !== ASSET_RESOLVER_VERSION || !Array.isArray(value.history))
    fail('ASSET_RESOLVER_SESSION_INVALID', 'ResolverSessionV1 inválida')
  return value
}

export function resolveAssetTreatment(input: {
  kind: 'simple-icon' | 'complex-illustration'
  requested?: 'none' | 'accent-mask' | 'duotone'
  detailReliance?: 'silhouette' | 'interior-detail'
}): { requested: string; effective: 'none' | 'accent-mask' | 'duotone'; reason: string; revision: string } {
  const requested = input.requested ?? 'auto'
  if (input.requested === 'none') return {
    requested, effective: 'none', reason: 'EXPLICIT_NONE_ONLY', revision: VISUAL_MVP_TREATMENT_REVISION,
  }
  if (input.requested && input.requested !== 'accent-mask' && input.requested !== 'duotone')
    fail('ASSET_TREATMENT_INVALID', 'Tratamiento solicitado no válido')
  if (input.requested) return {
    requested,
    effective: input.requested,
    reason: 'EXPLICIT_TREATMENT',
    revision: VISUAL_MVP_TREATMENT_REVISION,
  }
  if (input.detailReliance === 'interior-detail') return {
    requested,
    effective: 'duotone',
    reason: 'INTERIOR_DETAIL_DUOTONE',
    revision: VISUAL_MVP_TREATMENT_REVISION,
  }
  if (input.kind === 'simple-icon') return {
    requested, effective: 'accent-mask', reason: 'SILHOUETTE_SAFE_ACCENT_MASK', revision: VISUAL_MVP_TREATMENT_REVISION,
  }
  return {
    requested,
    effective: 'duotone',
    reason: 'COMPLEX_ILLUSTRATION_DUOTONE',
    revision: VISUAL_MVP_TREATMENT_REVISION,
  }
}

function treatmentForMetaphor(metaphor: MetaphorCandidateV1) {
  return resolveAssetTreatment({ kind: metaphor.kind, detailReliance: metaphor.detailReliance })
}

function selectStructure(intent: AssetIntentV1, metaphor: MetaphorCandidateV1 | null, session: ResolverSessionV1, seed: number): VisualMvpStructure {
  const keywordWords = canonicalNarrativeTerm(intent.keyword).split(' ').filter(Boolean).length
  const first: VisualMvpStructure = metaphor?.kind === 'complex-illustration'
    ? 'marcoPoster' : keywordWords > 2 ? 'editorial' : 'constelacion'
  const rotated = [...VISUAL_MVP_STRUCTURES]
  const offset = stableHash(intent.sceneId + '|' + seed) % rotated.length
  const candidates = [first, ...rotated.slice(offset), ...rotated.slice(0, offset)]
    .filter((value, index, values): value is VisualMvpStructure => values.indexOf(value) === index)
  const recentStructures = recent(session, 2).map(entry => entry.structure)
  if (recentStructures.length === 2 && recentStructures.every(structure => structure === candidates[0]))
    return candidates.find(structure => structure !== candidates[0]) ?? candidates[0]
  return candidates[0]
}

function motionForDensity(densidad: unknown) {
  if (densidad === 'minima' || densidad === 'baja') return createMvpMotion('fade-slide', 'breathe', 'fade-out', false)
  if (densidad === 'alta' || densidad === 'saturada') return createMvpMotion('scale-in', 'float', 'scale-down', true)
  return createMvpMotion('scale-in', 'float', 'scale-down', false)
}

function clipWords(value: string): string {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 8).join(' ')
}

type NarrativeWordV2 = { value: string; canonical: string; start: number; end: number }

const CONNECTOR_WORDS_V2 = new Set([
  'a', 'al', 'ante', 'bajo', 'como', 'con', 'contra', 'de', 'del', 'desde', 'durante', 'el', 'en',
  'entre', 'hacia', 'hasta', 'la', 'las', 'lo', 'los', 'para', 'pero', 'por', 'que', 'segun',
  'según', 'sin', 'sobre', 'tras', 'un', 'una', 'y',
])

function editorialWords(value: string): NarrativeWordV2[] {
  const output: NarrativeWordV2[] = []
  for (const match of value.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu)) {
    const word = match[0]
    const start = match.index ?? 0
    output.push({ value: word, canonical: canonicalNarrativeTerm(word), start, end: start + word.length })
  }
  return output
}

function clauseBreak(value: string, left: NarrativeWordV2, right: NarrativeWordV2): boolean {
  return /[.!?;:,]/u.test(value.slice(left.end, right.start))
}

/**
 * Extracts a short, contiguous editorial fragment from the already-local phrase. It never
 * invents copy: connector and closing are literal words adjacent to the selected keyword.
 */
export function deriveEditorialTextV2(input: {
  localText?: string
  keyword: string
  visualMode: ResolverVisualModeV1
  structure: VisualMvpStructure
}): VisualSceneSpecV1['text'] {
  const keyword = clipWords(input.keyword)
  const source = String(input.localText ?? '').trim()
  const words = editorialWords(source)
  const keywordParts = editorialWords(keyword).map(word => word.canonical).filter(Boolean)
  const matches: number[] = []
  if (keywordParts.length) {
    for (let index = 0; index <= words.length - keywordParts.length; index++) {
      if (keywordParts.every((part, offset) => words[index + offset]?.canonical === part)) matches.push(index)
    }
  }
  const occurrence = matches.sort((a, b) => {
    const quality = (index: number) => {
      const before = words[index - 1]
      const keywordStart = words[index]
      const afterStart = index + keywordParts.length
      const priorConnector = before && keywordStart && !clauseBreak(source, before, keywordStart) &&
        CONNECTOR_WORDS_V2.has(before.canonical) ? 2 : 0
      let following = 0
      for (let cursor = afterStart; cursor < Math.min(words.length, afterStart + 4); cursor++) {
        if (cursor > afterStart && clauseBreak(source, words[cursor - 1], words[cursor])) break
        following++
      }
      const centerDistance = Math.abs(index + keywordParts.length / 2 - words.length / 2)
      return priorConnector + following - centerDistance * .01
    }
    return quality(b) - quality(a) || a - b
  })[0]

  let connectorWords: NarrativeWordV2[] = []
  let closingWords: NarrativeWordV2[] = []
  if (occurrence !== undefined) {
    for (let cursor = occurrence - 1; cursor >= Math.max(0, occurrence - 2); cursor--) {
      const right = cursor === occurrence - 1 ? words[occurrence] : words[cursor + 1]
      if (clauseBreak(source, words[cursor], right) || !CONNECTOR_WORDS_V2.has(words[cursor].canonical)) break
      connectorWords.unshift(words[cursor])
    }
    const after = occurrence + keywordParts.length
    const maxClosing = input.visualMode === 'editorial-text' ? 4 : 2
    for (let cursor = after; cursor < Math.min(words.length, after + maxClosing); cursor++) {
      if (cursor > after && clauseBreak(source, words[cursor - 1], words[cursor])) break
      closingWords.push(words[cursor])
    }
  }

  if (input.visualMode === 'asset-led' && connectorWords.length) closingWords = []
  const keywordWordCount = Math.max(1, keyword.split(/\s+/).filter(Boolean).length)
  while (connectorWords.length + keywordWordCount + closingWords.length > 8) closingWords.pop()
  while (connectorWords.length + keywordWordCount + closingWords.length > 8) connectorWords.shift()
  const connector = connectorWords.map(word => word.value).join(' ')
  const closing = closingWords.map(word => word.value).join(' ')
  const maxLines: 2 | 3 = input.visualMode === 'editorial-text' && connector && closing ? 3 : 2
  return {
    ...(connector ? { connector } : {}),
    keyword,
    ...(closing ? { closing } : {}),
    alignment: input.structure === 'editorial' ? 'left' : 'center',
    maxLines,
    fontPairId: input.structure === 'editorial' ? 'editorial-black' : 'technical-black',
    timing: {
      connectorStart: 0.04,
      keywordStart: 0.16,
      ...(closing ? { closingStart: 0.32 } : {}),
    },
  }
}

function directionFor(
  input: ResolveSceneInputV1,
  structure: VisualMvpStructure,
  density: VisualDirectionV1['densidad'],
): VisualDirectionV1 {
  const source = input.direction
  if (!Number.isSafeInteger(source.semilla) || Number(source.semilla) <= 0)
    fail('ASSET_RESOLVER_DIRECTION_INVALID', 'La dirección necesita una semilla positiva')
  return {
    fondo: source.fondo as VisualDirectionV1['fondo'],
    estructura: structure,
    camara: source.camara as VisualDirectionV1['camara'],
    densidad: density,
    ritmo: source.ritmo as VisualDirectionV1['ritmo'],
    semilla: Number(source.semilla),
  }
}

function compileDecision(input: ResolveSceneInputV1, decision: ResolvedSceneDecisionV1): CompiledResolvedSceneV1 {
  const text = deriveEditorialTextV2({
    localText: decision.intent.phrase,
    keyword: decision.intent.keyword,
    visualMode: decision.visualMode,
    structure: decision.structure,
  })
  const heroState: SceneSlotV1['state'] | 'none' = decision.hero
    ? (decision.hero.provider === 'solar' ? 'procedural' : 'present') : 'none'
  const visibleWordCount = [text.connector, text.keyword, text.closing]
    .filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length
  const actualElementCount = 1 + (text.connector ? 1 : 0) + (text.closing ? 1 : 0) +
    (decision.hero ? 1 : 0)
  const density = resolveSceneDensityV2({
    localText: decision.intent.phrase ?? decision.intent.keyword,
    visualMode: decision.visualMode,
    heroState,
    actualElementCount,
    visibleWordCount,
    lineCount: text.maxLines,
    rhythm: input.direction.ritmo as VisualDirectionV1['ritmo'],
    structure: decision.structure,
    supportCount: 0,
  })
  const direction = directionFor(input, decision.structure, density)
  let slots: VisualSceneSpecV1['slots'] = []
  let bindings = emptyBindings()
  if (decision.hero?.provider === 'openmoji') {
    slots = [{
      slotId: 'hero', role: 'hero', state: 'present', sha256: decision.hero.sha256, mime: decision.hero.mime,
      kind: decision.hero.kind, bounds: fullSubjectBounds(), fitPolicy: 'contain',
      tint: { treatment: decision.hero.treatment }, motion: motionForDensity(direction.densidad),
    }]
    bindings = { assets: [{ slotId: 'hero', assetId: decision.hero.assetId, relativeFile: decision.hero.relativeFile }] }
  } else if (decision.hero?.provider === 'solar') {
    slots = [{
      slotId: 'hero', role: 'hero', state: 'procedural', kind: decision.hero.kind,
      solarIcon: decision.hero.solarName, solarStyle: decision.hero.solarStyle,
      bounds: fullSubjectBounds(), fitPolicy: 'contain', tint: { treatment: 'none' },
      motion: motionForDensity(direction.densidad),
    }]
  }
  const spec = validateVisualSceneSpec({
    renderSpecVersion: 1,
    visualMode: decision.visualMode,
    renderTier: 'standard',
    sistema: input.sistema,
    direccion: direction,
    text,
    slots,
    revisions: visualMvpRevisions(),
    fallbackVisual: 'editorial-text',
  })
  return {
    sceneSpec: spec,
    renderBindings: bindings,
    graphicData: { type: 'visual_escena', value: text.keyword, extra: { sceneSpec: spec } },
  }
}

function addHistory(session: ResolverSessionV1, decision: ResolvedSceneDecisionV1): void {
  session.history.push({
    sceneId: decision.sceneId,
    metaphorId: decision.metaphor?.id ?? null,
    assetIdentity: decision.hero?.provider === 'openmoji' ? decision.hero.sha256
      : decision.hero?.provider === 'solar' ? 'solar:' + decision.hero.solarName : null,
    structure: decision.structure,
    treatment: decision.hero?.provider === 'openmoji' ? decision.hero.treatment : null,
  })
  if (session.history.length > 18) session.history.splice(0, session.history.length - 18)
}

function editorialDecision(
  intent: AssetIntentV1,
  metaphor: MetaphorCandidateV1 | null,
  _structure: VisualMvpStructure,
  reason: string,
  alerts: ResolverAlertV1[],
): ResolvedSceneDecisionV1 {
  return {
    version: ASSET_RESOLVER_VERSION,
    sceneId: intent.sceneId,
    intent,
    visualMode: 'editorial-text',
    metaphor,
    hero: null,
    // Text is the Hero in this mode. The V2 renderer must not reserve an empty asset slot.
    structure: 'editorial',
    reasons: [reason],
    fallback: reason,
    alerts,
  }
}

function typedProjectRoot(value: unknown): { root: string | null; reason: string | null } {
  if (value === undefined || value === null) return { root: null, reason: 'PROJECT_ROOT_ABSENT' }
  try {
    return { root: requireAssetProjectRoot(value), reason: null }
  } catch (error: unknown) {
    const code = error instanceof OpenMojiAssetError ? error.code : 'PROJECT_ROOT_INVALID'
    return { root: null, reason: code }
  }
}

/**
 * Resolves the narrative decision and materializes at most one selected OpenMoji asset.
 * The renderer only receives the compiled spec and locator; it never sees this trace.
 */
export function resolveAndCompileVisualSceneV1(input: ResolveSceneInputV1): ResolverResultV1 {
  if (!input || typeof input !== 'object') fail('ASSET_RESOLVER_INPUT_INVALID', 'Entrada del resolver inválida')
  if (!input.intent || input.intent.version !== ASSET_INTENT_VERSION)
    fail('ASSET_RESOLVER_INTENT_INVALID', 'AssetIntentV1 no es válido')
  const intent = createAssetIntentV1(input.intent as AssetIntentInputV1)
  const session = usableSession(input.session)
  const localSemantic = input.localSemantic
  const resolvedMetaphor = resolveMetaphor(intent, localSemantic)
  const structure = selectStructure(intent, resolvedMetaphor.metaphor, session, Number(input.direction?.semilla))
  const trace: ResolverTraceV1 = {
    sceneId: intent.sceneId,
    input: intent,
    metaphorCandidates: resolvedMetaphor.metaphor
      ? [{ id: resolvedMetaphor.metaphor.id, score: resolvedMetaphor.metaphor.score, reason: resolvedMetaphor.reason }] : [],
    selectedMetaphor: resolvedMetaphor.metaphor?.id ?? null,
    providerCandidates: [],
    selectedCandidate: null,
    visualMode: 'editorial-text',
    treatment: null,
    structure,
    reuse: { allowedByContinuity: false, reusedProjectAsset: false, reason: null },
    fallback: null,
    reasons: [resolvedMetaphor.reason],
    ...(localSemantic ? {
      localContext: {
        start: localSemantic.start,
        end: localSemantic.end,
        localText: localSemantic.localText,
        ...(localSemantic.globalContextRef ? { globalContextRef: localSemantic.globalContextRef } : {}),
        globalTextLength: localSemantic.globalText?.length ?? 0,
        globalHints: [...localSemantic.globalHints],
        directEvidence: [...localSemantic.directEvidence],
      },
    } : {}),
  }
  const metrics = { openMojiQueries: 0, openMojiCandidates: 0, projectAssetsReused: 0, assetsPublished: 0, manifestReads: 0 }

  if (!resolvedMetaphor.metaphor) {
    const decision = editorialDecision(intent, null, structure, resolvedMetaphor.reason, [{
      code: 'NO_VISUAL_METAPHOR', severity: 'info', message: 'La escena no tiene una metáfora concreta defendible; se usa texto editorial.',
    }])
    trace.visualMode = decision.visualMode
    trace.structure = decision.structure
    trace.fallback = decision.fallback
    trace.reasons.push(...decision.reasons)
    const compiled = compileDecision(input, decision)
    addHistory(session, decision)
    return { decision, trace, compiled, metrics }
  }

  const metaphor = resolvedMetaphor.metaphor
  const searched = openMojiCandidates(intent, metaphor)
  metrics.openMojiQueries = searched.queries
  metrics.openMojiCandidates = searched.candidates.length
  trace.providerCandidates.push(...searched.trace)
  const semantic = chooseSemanticCandidateV1(searched.candidates.map(candidate => ({
    identity: candidate.entry.stableId, score: candidate.score, candidate,
  })))
  if (semantic.reason === 'ambiguous') {
    const decision = editorialDecision(intent, metaphor, structure, 'AMBIGUOUS_ASSET_CANDIDATES', [{
      code: 'AMBIGUOUS_ASSET_CANDIDATES', severity: 'warning', message: 'Los candidatos visuales empatan; no se elige un Hero en silencio.',
    }])
    trace.visualMode = decision.visualMode
    trace.structure = decision.structure
    trace.fallback = decision.fallback
    trace.reasons.push(...decision.reasons)
    const compiled = compileDecision(input, decision)
    addHistory(session, decision)
    return { decision, trace, compiled, metrics }
  }

  const selectedOpenMoji = semantic.selected?.candidate
  const root = selectedOpenMoji ? typedProjectRoot(input.projectRoot) : { root: null, reason: null }
  let reusable: ProjectAssetRecord | null = null
  let projectAssetInvalid = false
  if (selectedOpenMoji && root.root) {
    const existing = existingOpenMojiAsset(root.root, selectedOpenMoji.entry)
    metrics.manifestReads += existing.manifestReads
    reusable = existing.asset
    projectAssetInvalid = existing.invalid
    if (reusable) {
      const history = recent(session, 3)
      const sameMetaphor = history.some(entry => entry.metaphorId === metaphor.id)
      trace.reuse = {
        allowedByContinuity: sameMetaphor,
        reusedProjectAsset: true,
        reason: sameMetaphor ? 'CONTINUITY_WINDOW' : 'PROJECT_ASSET_FIRST',
      }
      metrics.projectAssetsReused++
    }
  }
  if (projectAssetInvalid) trace.providerCandidates.push({
    provider: 'project-asset', identity: selectedOpenMoji!.entry.stableId, score: 0,
    reason: 'PROJECT_ASSET_INVALID', stableId: selectedOpenMoji!.entry.stableId,
  })

  const solar = metaphor.solarName ? resolverSolarDetallado(metaphor.solarName, 'bold-duotone') : null
  if (solar?.resultado) trace.providerCandidates.push({
    provider: 'solar', identity: solar.resultado, score: metaphor.preferProvider === 'solar' ? 3 : 2,
    reason: 'SOLAR_RESOLVED:' + solar.motivo,
  })

  let hero: ResolvedHeroV1 | null = null
  const alerts: ResolverAlertV1[] = []
  if (reusable && selectedOpenMoji) {
    hero = {
      provider: 'openmoji', stableId: selectedOpenMoji.entry.stableId, assetId: reusable.id,
      relativeFile: reusable.relativeFile, sha256: reusable.sha256, mime: 'image/svg+xml', kind: metaphor.kind,
      treatment: treatmentForMetaphor(metaphor).effective, published: 'reused',
    }
    trace.selectedCandidate = { provider: 'project-asset', identity: reusable.id, score: 3,
      reason: 'PROJECT_ASSET_FIRST', stableId: selectedOpenMoji.entry.stableId }
  } else if (metaphor.preferProvider === 'solar' && solar?.resultado) {
    hero = { provider: 'solar', solarName: solar.resultado, solarStyle: 'bold-duotone', kind: 'simple-icon' }
    trace.selectedCandidate = { provider: 'solar', identity: solar.resultado, score: 3, reason: 'ABSTRACT_SOLAR_PREFERRED' }
  } else if (selectedOpenMoji && selectedOpenMoji.score >= 2 && root.root && !projectAssetInvalid) {
    try {
      const published = publishOpenMojiAsset({ projectRoot: root.root, stableId: selectedOpenMoji.entry.stableId })
      metrics.assetsPublished += published.status === 'created' ? 1 : 0
      hero = {
        provider: 'openmoji', stableId: selectedOpenMoji.entry.stableId, assetId: published.asset.id,
        relativeFile: published.asset.relativeFile, sha256: published.asset.sha256, mime: 'image/svg+xml', kind: metaphor.kind,
        treatment: treatmentForMetaphor(metaphor).effective, published: published.status,
      }
      trace.selectedCandidate = { provider: 'openmoji', identity: selectedOpenMoji.entry.stableId, score: selectedOpenMoji.score,
        reason: 'OPENMOJI_PUBLISHED:' + published.status, stableId: selectedOpenMoji.entry.stableId,
        annotation: selectedOpenMoji.entry.annotation }
    } catch (error: unknown) {
      const code = error instanceof OpenMojiAssetError ? error.code : 'OPENMOJI_PUBLISH_FAILED'
      trace.providerCandidates.push({ provider: 'openmoji', identity: selectedOpenMoji.entry.stableId, score: 0,
        reason: code, stableId: selectedOpenMoji.entry.stableId })
      alerts.push({ code: 'RESOLVER_DEGRADED', severity: 'warning', message: 'No se pudo publicar el candidato OpenMoji; se intentará una vía local alternativa.' })
    }
  } else if (selectedOpenMoji && !root.root) {
    trace.providerCandidates.push({ provider: 'openmoji', identity: selectedOpenMoji.entry.stableId, score: 0,
      reason: root.reason ?? 'PROJECT_ROOT_ABSENT', stableId: selectedOpenMoji.entry.stableId })
    alerts.push({ code: 'RESOLVER_DEGRADED', severity: 'warning', message: 'El candidato OpenMoji requiere una raíz de proyecto explícita y válida.' })
  }

  if (!hero && solar?.resultado) {
    hero = { provider: 'solar', solarName: solar.resultado, solarStyle: 'bold-duotone', kind: 'simple-icon' }
    trace.selectedCandidate = { provider: 'solar', identity: solar.resultado, score: 2, reason: 'SOLAR_FALLBACK' }
  }

  if (!hero) {
    const reason = semantic.reason === 'empty' || semantic.reason === 'below-threshold'
      ? 'PROVIDER_NO_USABLE_RESULT' : projectAssetInvalid ? 'PROJECT_ASSET_INVALID' : 'FALLBACK_EDITORIAL'
    alerts.push({
      code: reason === 'PROJECT_ASSET_INVALID' ? 'PROJECT_ASSET_INVALID' :
        reason === 'PROVIDER_NO_USABLE_RESULT' ? 'PROVIDER_NO_USABLE_RESULT' : 'FALLBACK_EDITORIAL',
      severity: reason === 'FALLBACK_EDITORIAL' ? 'info' : 'warning',
      message: 'No hay Hero local defendible; se materializa texto editorial.',
    })
    const decision = editorialDecision(intent, metaphor, structure, reason, alerts)
    trace.visualMode = decision.visualMode
    trace.structure = decision.structure
    trace.fallback = decision.fallback
    trace.reasons.push(...decision.reasons)
    const compiled = compileDecision(input, decision)
    addHistory(session, decision)
    return { decision, trace, compiled, metrics }
  }

  const treatment = hero.provider === 'openmoji' ? treatmentForMetaphor(metaphor) : null
  const decision: ResolvedSceneDecisionV1 = {
    version: ASSET_RESOLVER_VERSION,
    sceneId: intent.sceneId,
    intent,
    visualMode: 'asset-led',
    metaphor,
    hero,
    structure,
    reasons: [resolvedMetaphor.reason, hero.provider === 'openmoji' ? 'OPENMOJI_HERO' : 'SOLAR_HERO'],
    fallback: null,
    alerts,
  }
  trace.visualMode = decision.visualMode
  trace.treatment = treatment
  trace.reasons.push(...decision.reasons)
  const compiled = compileDecision(input, decision)
  addHistory(session, decision)
  return { decision, trace, compiled, metrics }
}
