import { canonicalNarrativeTerm, type AssetIntentV1 } from '../../shared/asset-intent'
import {
  expandConceptLexiconV1,
  expandLexiconTermsV1,
  type ConceptExpansionLevelV1,
  type ConceptLexiconEntryV1,
} from '../../shared/concept-lexicon'
import type { LocalSceneSemanticV1 } from '../../shared/local-scene-semantic'
import { createVisualConceptSetV1, type VisualConceptSetV1, type VisualConceptV1 } from '../../shared/visual-concepts'
import { loadOpenMojiCatalog, searchOpenMoji, type OpenMojiCatalogEntry } from './openmoji/catalog'
import { buildPixabayImageSearchPlansV1, type PixabayImageSearchPlanV1 } from './pixabay-images'
import { searchSolarAssetIndexV1, type SolarSearchCandidateV1 } from './solar-index'

export const VISUAL_RETRIEVAL_ENGINE_VERSION = 1 as const
export const MAX_LOCAL_RETRIEVAL_CONCEPTS_V1 = 3
export const MAX_OPENMOJI_CANDIDATES_PER_CONCEPT_V1 = 6

export type VisualRetrievalProviderV1 = 'openmoji' | 'solar' | 'pixabay-images' | 'editorial-text'
export type VisualRetrievalRoleV1 = 'hero' | 'support' | 'editorial'
export type VisualRetrievalRegisteredProviderV1 = VisualRetrievalProviderV1 | 'bypeople'
export type VisualRetrievalProviderStatusV1 = 'active-local' | 'active-on-demand' | 'decision-fallback' | 'planned-not-audited'

/**
 * Registry metadata is deliberately separate from candidate emission.  It gives a future
 * provider a stable adapter boundary without letting an unaudited library become searchable.
 */
export const BYPEOPLE_PROVIDER_STATUS = 'planned-not-audited' as const
export const VISUAL_RETRIEVAL_PROVIDER_REGISTRY_V1: Readonly<Record<VisualRetrievalRegisteredProviderV1, {
  status: VisualRetrievalProviderStatusV1
  requiresLocalIndex: boolean
  requiresExplicitPreparation: boolean
}>> = Object.freeze({
  openmoji: { status: 'active-local', requiresLocalIndex: true, requiresExplicitPreparation: true },
  solar: { status: 'active-local', requiresLocalIndex: true, requiresExplicitPreparation: false },
  'pixabay-images': { status: 'active-on-demand', requiresLocalIndex: false, requiresExplicitPreparation: true },
  'editorial-text': { status: 'decision-fallback', requiresLocalIndex: false, requiresExplicitPreparation: false },
  bypeople: { status: BYPEOPLE_PROVIDER_STATUS, requiresLocalIndex: true, requiresExplicitPreparation: true },
})

export type VisualSearchQueryV1 = {
  text: string
  level: ConceptExpansionLevelV1
  reason: string
}

export type VisualSearchPlanV1 = {
  version: typeof VISUAL_RETRIEVAL_ENGINE_VERSION
  provider: VisualRetrievalProviderV1
  concept: string
  role: VisualRetrievalRoleV1
  queries: readonly VisualSearchQueryV1[]
  /** Pixabay has official, provider-specific request plans; no key is persisted here. */
  pixabayPlans?: readonly PixabayImageSearchPlanV1[]
}

export type VisualRetrievalCandidateV1 = {
  provider: Exclude<VisualRetrievalProviderV1, 'editorial-text'>
  role: VisualRetrievalRoleV1
  concept: string
  identity: string
  score: 0 | 1 | 2 | 3
  level: ConceptExpansionLevelV1
  reason: string
  query?: string
  stableId?: string
  annotation?: string
  solarBase?: string
  solarVariant?: string
  deferredUntilRendererSupport?: boolean
}

export type VisualRetrievalDecisionV1 = {
  version: typeof VISUAL_RETRIEVAL_ENGINE_VERSION
  concepts: VisualConceptSetV1
  plans: readonly VisualSearchPlanV1[]
  candidates: readonly VisualRetrievalCandidateV1[]
  selectedHero: VisualRetrievalCandidateV1 | null
  selectedSupport: readonly VisualRetrievalCandidateV1[]
  /** Pixabay candidates can be selected for preparation, but not bound to the V14 one-Hero renderer. */
  deferredCandidates: readonly VisualRetrievalCandidateV1[]
  editorialReason: string | null
  metrics: { openMojiQueries: number; openMojiCandidates: number; solarCandidates: number; pixabayPlans: number }
}

type EnrichedConcept = {
  concept: VisualConceptV1
  lexicon?: ConceptLexiconEntryV1
  level: ConceptExpansionLevelV1
  role: VisualRetrievalRoleV1
}

type OpenMojiIndex = {
  exact: Map<string, OpenMojiCatalogEntry[]>
  tokens: Map<string, OpenMojiCatalogEntry[]>
}

let openMojiIndex: OpenMojiIndex | undefined

const LEVEL_RANK: Record<ConceptExpansionLevelV1, number> = { exact: 0, synonym: 1, related: 2, context: 3 }

function normalized(value: unknown): string { return canonicalNarrativeTerm(String(value ?? '')) }
function terms(value: string): string[] { return normalized(value).split(' ').filter(Boolean) }
function emojiKey(value: string): string { return value.normalize('NFC').replace(/[\uFE0E\uFE0F]/g, '') }
function scoreFor(level: ConceptExpansionLevelV1): 0 | 1 | 2 | 3 {
  return level === 'exact' || level === 'synonym' ? 3 : level === 'related' ? 2 : 1
}

function richValues(entry: OpenMojiCatalogEntry): string[] {
  return [entry.annotation, ...entry.tags, ...entry.aliases, entry.group ?? '', entry.subgroup ?? '']
    .map(normalized).filter(Boolean)
}

function getOpenMojiIndex(): OpenMojiIndex {
  if (openMojiIndex) return openMojiIndex
  const exact = new Map<string, OpenMojiCatalogEntry[]>()
  const tokens = new Map<string, OpenMojiCatalogEntry[]>()
  const add = <T>(map: Map<string, T[]>, key: string, value: T) => {
    if (!key) return
    const values = map.get(key) ?? []
    values.push(value)
    map.set(key, values)
  }
  for (const entry of loadOpenMojiCatalog().entries) {
    for (const value of richValues(entry)) {
      add(exact, value, entry)
      for (const token of terms(value)) add(tokens, token, entry)
    }
    if (entry.emoji) add(exact, 'emoji:' + emojiKey(entry.emoji), entry)
    add(exact, 'hex:' + entry.hexcode.toLowerCase(), entry)
  }
  openMojiIndex = { exact, tokens }
  return openMojiIndex
}

function enrichConcept(concept: VisualConceptV1): EnrichedConcept {
  // Resolve the narrated label first. `canonicalHint` lives in aliases for diagnostics/search
  // support, but it is provider-shaped evidence and cannot turn an unrelated local subject
  // (for example an accident hinted as a shield) into the primary Hero.
  const probes = [concept.originalTerm, concept.normalizedTerm]
  const expansions = probes.flatMap(value => expandConceptLexiconV1(value))
  const selected = expansions.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
    a.entry.canonical.localeCompare(b.entry.canonical, 'en'))[0]
  if (!selected) return { concept, level: 'context', role: concept.preferredRole }
  const aliases = [...new Set([concept.originalTerm, ...concept.aliases, selected.entry.canonical,
    ...expandLexiconTermsV1(selected.entry, 'related')])]
  // A lexicon-declared emoji is canonical visual evidence, not a guessed search result. It lets
  // a named concept take the same exact path as an explicitly supplied Unicode pictograph.
  const resolvedEmoji = concept.emoji ?? selected.entry.emoji[0]
  const concreteProvider = selected.entry.providerBias === 'openmoji'
  // Person/context entries whose policy is editorial remain editorial in V14. A concrete
  // individual can opt in through its lexicon provider policy (for example an astronaut),
  // while generic people and contextual scenes do not accidentally become literal one-Hero
  // scenes before the future support/cutout pipeline exists.
  const role: VisualRetrievalRoleV1 = selected.entry.providerBias === 'editorial'
    ? 'editorial'
    : concept.preferredRole === 'editorial' && concreteProvider &&
        (selected.level === 'exact' || selected.level === 'synonym' || !!concept.emoji) ? 'hero' : concept.preferredRole
  return {
    concept: { ...concept, normalizedTerm: selected.entry.canonical, aliases: Object.freeze(aliases),
      ...(resolvedEmoji ? { emoji: resolvedEmoji } : {}), subject: selected.entry.subject,
      preferredRole: role },
    lexicon: selected.entry, level: selected.level, role,
  }
}

function queryList(enriched: EnrichedConcept): VisualSearchQueryV1[] {
  const output: VisualSearchQueryV1[] = []
  const add = (text: string | undefined, level: ConceptExpansionLevelV1, reason: string) => {
    const query = String(text ?? '').trim()
    const key = query.startsWith('openmoji:') ? query.toLowerCase() : normalized(query) || 'emoji:' + emojiKey(query)
    if (!query || output.some(item => (normalized(item.text) || 'emoji:' + emojiKey(item.text)) === key)) return
    output.push({ text: query, level, reason })
  }
  if (enriched.concept.emoji) add(enriched.concept.emoji, 'exact', 'DIRECT_EMOJI')
  add(enriched.concept.normalizedTerm, enriched.level, 'LEXICON_CANONICAL')
  if (enriched.lexicon) {
    for (const synonym of enriched.lexicon.synonyms) add(synonym, 'synonym', 'LEXICON_SYNONYM')
    for (const related of enriched.lexicon.related) add(related, 'related', 'LEXICON_RELATED')
  }
  return output.slice(0, 4)
}

/** Provider-native query plans; planning itself is offline and does not download or publish assets. */
export function buildVisualSearchPlansV1(input: {
  intent: AssetIntentV1
  localSemantic?: LocalSceneSemanticV1
}): { concepts: VisualConceptSetV1; enriched: readonly EnrichedConcept[]; plans: readonly VisualSearchPlanV1[] } {
  const concepts = createVisualConceptSetV1(input)
  const raw = [concepts.primary, concepts.secondary, concepts.tertiary].filter((value): value is VisualConceptV1 => !!value)
    .slice(0, MAX_LOCAL_RETRIEVAL_CONCEPTS_V1)
  const enriched = raw.map(enrichConcept)
  const enrichedConcepts: VisualConceptSetV1 = {
    version: 1,
    primary: enriched[0]?.concept ?? null,
    secondary: enriched[1]?.concept ?? null,
    tertiary: enriched[2]?.concept ?? null,
  }
  const plans: VisualSearchPlanV1[] = []
  for (const value of enriched) {
    const queries = queryList(value)
    if (value.role !== 'editorial') {
      plans.push({ version: VISUAL_RETRIEVAL_ENGINE_VERSION, provider: 'openmoji', concept: value.concept.normalizedTerm,
        role: value.role, queries })
      plans.push({ version: VISUAL_RETRIEVAL_ENGINE_VERSION, provider: 'solar', concept: value.concept.normalizedTerm,
        role: value.role, queries })
      const pixabayPlans = buildPixabayImageSearchPlansV1({
        concept: value.concept,
        lexicon: value.lexicon,
        level: value.level,
        role: value.role === 'support' ? 'support' : 'hero',
      })
      plans.push({ version: VISUAL_RETRIEVAL_ENGINE_VERSION, provider: 'pixabay-images', concept: value.concept.normalizedTerm,
        role: value.role, queries: pixabayPlans.map(plan => ({ text: plan.query, level: plan.level, reason: plan.reason })), pixabayPlans })
    }
  }
  return { concepts: enrichedConcepts, enriched: Object.freeze(enriched), plans: Object.freeze(plans) }
}

function addUnique(map: Map<string, VisualRetrievalCandidateV1>, value: VisualRetrievalCandidateV1): void {
  const existing = map.get(value.provider + '|' + value.identity)
  if (!existing || value.score > existing.score || (value.score === existing.score && LEVEL_RANK[value.level] < LEVEL_RANK[existing.level])) map.set(value.provider + '|' + value.identity, value)
}

function openMojiCandidates(value: EnrichedConcept, plan: VisualSearchPlanV1): {
  candidates: readonly VisualRetrievalCandidateV1[]
  uncertainSearches: number
} {
  const index = getOpenMojiIndex()
  const found = new Map<string, VisualRetrievalCandidateV1>()
  let uncertainSearches = 0
  for (const query of plan.queries) {
    const exactKey = query.text.match(/^openmoji:([0-9a-f-]+)$/i) ? 'hex:' + query.text.slice(9).toLowerCase() :
      query.text.match(/^[0-9a-f]{2,8}(?:-[0-9a-f]{2,8})*$/i) ? 'hex:' + query.text.toLowerCase() :
        /[^\x00-\x7f]/.test(query.text) && Array.from(query.text).some(char => /\p{Extended_Pictographic}/u.test(char))
          ? 'emoji:' + emojiKey(query.text) : normalized(query.text)
    const direct = index.exact.get(exactKey) ?? []
    // Direct Unicode/hex/metadata evidence already identifies a local entry. Calling the broad
    // text search as well would be an unnecessary second authority and can introduce ambiguity.
    const native = direct.length ? [] : (uncertainSearches++, searchOpenMoji(query.text, {
      limit: MAX_OPENMOJI_CANDIDATES_PER_CONCEPT_V1,
    }).map(result => result.entry))
    const tokenMatches = !direct.length && !native.length ? (() => {
      const queryTokens = terms(query.text)
      if (!queryTokens.length) return [] as OpenMojiCatalogEntry[]
      const lists = queryTokens.map(token => index.tokens.get(token) ?? [])
      const initial = lists.sort((a, b) => a.length - b.length)[0] ?? []
      return initial.filter(entry => queryTokens.every(token => (index.tokens.get(token) ?? []).includes(entry)))
    })() : []
    for (const entry of [...direct, ...native, ...tokenMatches]) {
      const directEmoji = !!value.concept.emoji && emojiKey(entry.emoji ?? '') === emojiKey(value.concept.emoji)
      const queryNormalized = normalized(query.text)
      const exactHex = entry.hexcode.toLowerCase() === query.text.toLowerCase() || entry.stableId.toLowerCase() === query.text.toLowerCase()
      const annotationExact = normalized(entry.annotation) === queryNormalized
      const aliasExact = entry.aliases.some(alias => normalized(alias) === queryNormalized)
      const tagExact = entry.tags.some(tag => normalized(tag) === queryNormalized)
      const groupExact = normalized(entry.group) === queryNormalized || normalized(entry.subgroup) === queryNormalized
      const fields = richValues(entry)
      const tokenMatch = terms(query.text).every(token => fields.some(field => terms(field).includes(token)))
      const metadataStrength = directEmoji || exactHex || annotationExact || aliasExact ? 3 : tagExact ? 2 : groupExact || tokenMatch ? 1 : 0
      const score = directEmoji || exactHex ? 3 : Math.min(metadataStrength, scoreFor(query.level))
      if (score === 0) continue
      addUnique(found, {
        provider: 'openmoji', role: value.role, concept: value.concept.normalizedTerm, identity: entry.stableId,
        stableId: entry.stableId, annotation: entry.annotation, score: score as 0 | 1 | 2 | 3, level: query.level,
        reason: directEmoji ? 'OPENMOJI_DIRECT_EMOJI' : annotationExact || aliasExact || exactHex ? 'OPENMOJI_METADATA_EXACT' :
          tagExact ? 'OPENMOJI_METADATA_TAG' : 'OPENMOJI_METADATA_TOKEN_MATCH', query: query.text,
      })
    }
  }
  return {
    candidates: Object.freeze([...found.values()].sort((a, b) => b.score - a.score || a.identity.localeCompare(b.identity, 'en'))
      .slice(0, MAX_OPENMOJI_CANDIDATES_PER_CONCEPT_V1)),
    uncertainSearches,
  }
}

function solarCandidates(value: EnrichedConcept): VisualRetrievalCandidateV1[] {
  return searchSolarAssetIndexV1({ concept: value.concept, lexicon: value.lexicon, level: value.level })
    .map((candidate: SolarSearchCandidateV1) => ({
      provider: 'solar' as const, role: value.role, concept: value.concept.normalizedTerm,
      identity: candidate.variant, solarBase: candidate.base, solarVariant: candidate.variant,
      score: candidate.score, level: candidate.level, reason: candidate.reason,
    }))
}

function candidateEvidenceRank(candidate: VisualRetrievalCandidateV1): number {
  if (candidate.reason === 'OPENMOJI_DIRECT_EMOJI') return 4
  if (candidate.reason === 'OPENMOJI_METADATA_EXACT' || candidate.reason === 'LEXICON_SOLAR_BASE') return 3
  if (candidate.reason === 'OPENMOJI_METADATA_TAG') return 2
  return candidate.reason === 'OPENMOJI_METADATA_TOKEN_MATCH' || candidate.reason === 'SOLAR_BASE_TOKEN_MATCH' ? 1 : 0
}

function chooseCandidate(candidates: readonly VisualRetrievalCandidateV1[], providerBias: string | undefined): VisualRetrievalCandidateV1 | null {
  const eligible = candidates.filter(candidate => candidate.role === 'hero' && candidate.score >= 2 && candidate.provider !== 'pixabay-images')
  const ranked = [...eligible].sort((a, b) => {
    const providerA = a.provider === providerBias ? 0 : a.provider === 'openmoji' ? 1 : 2
    const providerB = b.provider === providerBias ? 0 : b.provider === 'openmoji' ? 1 : 2
    return b.score - a.score || providerA - providerB || candidateEvidenceRank(b) - candidateEvidenceRank(a) ||
      LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.identity.localeCompare(b.identity, 'en')
  })
  if (!ranked.length) return null
  const top = ranked[0]
  // A remaining tie really has equal provider policy, semantic strength, metadata evidence and
  // lexical specificity. Only then does V1 choose editorial rather than an arbitrary filename.
  const tied = ranked.filter(candidate => candidate.score === top.score && candidate.provider === top.provider &&
    candidateEvidenceRank(candidate) === candidateEvidenceRank(top) && candidate.level === top.level && candidate.identity !== top.identity)
  return tied.length ? null : top
}

/**
 * Offline local retrieval used by the current resolver. It reads only catalog metadata, never
 * SVG bytes, network, ProjectAsset files or renderer contracts. Pixabay is represented by plans
 * and can be executed explicitly through its own adapter before a future multi-asset renderer.
 */
export function resolveVisualRetrievalV1(input: {
  intent: AssetIntentV1
  localSemantic?: LocalSceneSemanticV1
}): VisualRetrievalDecisionV1 {
  const prepared = buildVisualSearchPlansV1(input)
  const candidates: VisualRetrievalCandidateV1[] = []
  let openMojiQueries = 0
  let pixabayPlans = 0
  for (const value of prepared.enriched) {
    const openPlan = prepared.plans.find(plan => plan.provider === 'openmoji' && plan.concept === value.concept.normalizedTerm && plan.role === value.role)
    if (openPlan) {
      const local = openMojiCandidates(value, openPlan)
      openMojiQueries += local.uncertainSearches
      candidates.push(...local.candidates)
    }
    candidates.push(...solarCandidates(value))
    pixabayPlans += prepared.plans.filter(plan => plan.provider === 'pixabay-images' && plan.concept === value.concept.normalizedTerm).flatMap(plan => plan.pixabayPlans ?? []).length
  }
  const primary = prepared.enriched[0]
  const selectedHero = primary && primary.role === 'hero' ? chooseCandidate(candidates.filter(candidate => candidate.concept === primary.concept.normalizedTerm), primary.lexicon?.providerBias) : null
  const selectedSupport = candidates.filter(candidate => candidate.role === 'support' && candidate.score >= 2)
    .sort((a, b) => b.score - a.score || a.identity.localeCompare(b.identity, 'en')).slice(0, 2)
  const deferredCandidates: VisualRetrievalCandidateV1[] = []
  for (const plan of prepared.plans.filter(plan => plan.provider === 'pixabay-images')) {
    deferredCandidates.push({ provider: 'pixabay-images', role: plan.role, concept: plan.concept,
      identity: 'pixabay-plan:' + plan.concept, score: 1, level: plan.queries[0]?.level ?? 'context',
      reason: 'PIXABAY_ON_DEMAND_NOT_QUERIED', query: plan.queries[0]?.text, deferredUntilRendererSupport: true })
  }
  return {
    version: VISUAL_RETRIEVAL_ENGINE_VERSION, concepts: prepared.concepts, plans: prepared.plans,
    candidates: Object.freeze(candidates.sort((a, b) => b.score - a.score || a.provider.localeCompare(b.provider, 'en') || a.identity.localeCompare(b.identity, 'en'))),
    selectedHero, selectedSupport: Object.freeze(selectedSupport), deferredCandidates: Object.freeze(deferredCandidates),
    editorialReason: selectedHero ? null : primary?.role === 'editorial' ? 'CONCEPT_EDITORIAL_ROLE' : 'NO_LOCAL_RENDERABLE_CANDIDATE',
    metrics: { openMojiQueries, openMojiCandidates: candidates.filter(candidate => candidate.provider === 'openmoji').length,
      solarCandidates: candidates.filter(candidate => candidate.provider === 'solar').length, pixabayPlans },
  }
}
