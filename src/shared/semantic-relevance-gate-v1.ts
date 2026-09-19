import { canonicalNarrativeTerm } from './asset-intent'
import type { ConceptExpansionLevelV1, ConceptLexiconEntryV1 } from './concept-lexicon'
import { narrativeTermsEquivalentV1 } from './narrative-term-forms'
import type { VisualConceptSubjectV1, VisualConceptV1 } from './visual-concepts'

/**
 * SEMANTIC ASSET RELEVANCE GATE V1
 *
 * It answers one question about a CONCRETE candidate: how much of the evidence the candidate
 * carries actually belongs to the narrated concept, and how prominent that evidence is.
 *
 * It deliberately does NOT attempt a semantic distance. With 112 lexicon entries the system
 * cannot prove that an unknown term is unrelated, so a gate built on refutation would never
 * reject anything, and a gate that rejected everything unproven would destroy defendible
 * metaphors. Concentration of evidence is measurable today, from data the pipeline already has.
 *
 * The gate is a FILTER, never a re-ranker: it decides admission. Ordering stays with the
 * existing provider rankers. Its output is diagnostics and never reaches SceneSpec,
 * RenderBindings or PixelIdentity.
 */
export const SEMANTIC_RELEVANCE_GATE_VERSION = 1 as const

export type RelevanceClassV1 = 'EXACT' | 'STRONG' | 'RELATED' | 'WEAK' | 'UNRELATED'
export type RelevanceMatchLevelV1 = 'exact' | 'synonym' | 'related' | 'sibling' | 'domain' | 'none'
export type RelevanceAuthorityV1 = 'curated-local' | 'third-party-tags'
export type RelevanceRoleV1 = 'hero' | 'support'

/**
 * How many descriptors are considered, after production noise is removed. Stock providers
 * routinely attach 25 to 90 tags; a term appearing in position 19 is not what the image is
 * about. The window is what makes a late incidental tag stop counting as evidence.
 */
export const RELEVANCE_DESCRIPTOR_WINDOW_V1 = 12


/** Salience normaliser: matching the first three descriptors already saturates the measure. */
const FOCUS_NORMALISER = 1 + 1 / 2 + 1 / 3

/**
 * The two thresholds are DERIVED FROM DESCRIPTOR POSITIONS, not fitted to cases. Stating them as
 * positions is what keeps them from becoming numbers tuned until a particular fixture passed.
 *
 * HIGH  — "the concept is the subject": one match among the first three descriptors, or several
 *         matches further down that corroborate each other. Equals a lone match at index 2.
 * MEDIUM— "the concept is present at all": a lone match at the last position still inside the
 *         window. Below it the evidence exists but is not what the asset is about.
 *
 * Rejection of genuinely unrelated candidates does NOT depend on these numbers: an unrelated
 * candidate has no matching descriptor at all and is UNRELATED whatever the thresholds say.
 */
export const RELEVANCE_FOCUS_HIGH_V1 = (1 / 3) / FOCUS_NORMALISER
export const RELEVANCE_FOCUS_MEDIUM_V1 = (1 / RELEVANCE_DESCRIPTOR_WINDOW_V1) / FOCUS_NORMALISER

/** Positions produce exact threshold values; compare with tolerance so equality is inclusive. */
const FOCUS_EPSILON = 1e-9

/**
 * Stock-production vocabulary. These terms describe how a file was produced, not what it shows.
 * `buildPixabayImageSearchPlansV1` appends `isolated`/`aislado` to its queries, so providers
 * whose uploaders tag for stock discoverability match the DECORATION rather than the concept.
 * That is the exact mechanism by which an unrelated illustration was accepted in production.
 */
export const RELEVANCE_NEUTRAL_DESCRIPTORS_V1: readonly string[] = Object.freeze([
  'aislado', 'aislada', 'aislados', 'aisladas', 'aislado en negro', 'aislado en blanco',
  'isolated', 'isolated on black', 'isolated on white', 'cutout', 'cut out', 'cortar', 'recorte',
  'transparent', 'transparente', 'fondo transparente', 'transparent background',
  'sin fondo', 'fondo blanco', 'white background', 'black background', 'fondo negro',
  'png', 'psd', 'png foto', 'exencion', 'eliminando', 'cultivo', 'clipping', 'clipart',
])

const NEUTRAL = new Set<string>(RELEVANCE_NEUTRAL_DESCRIPTORS_V1.map(value => canonicalNarrativeTerm(value)))

export type RelevanceCandidateEvidenceV1 = {
  provider: 'openmoji' | 'solar' | 'pixabay-images' | 'modern-pack'
  /** Descriptive terms IN PROVIDER SALIENCE ORDER. Repetitions are kept: they are a signal. */
  descriptors: readonly string[]
  /**
   * A mapping the system itself declared (a lexicon Solar base, a direct Unicode pictograph, a
   * resolved metaphor canonical). This is curated internal evidence, not third-party metadata.
   */
  declaredIdentity?: string
  authority: RelevanceAuthorityV1
}

export type RelevanceConceptContextV1 = {
  canonical: string
  subject: VisualConceptSubjectV1
  expectedLevel: ConceptExpansionLevelV1
  exactTerms: readonly string[]
  synonymTerms: readonly string[]
  relatedTerms: readonly string[]
  domainTerms: readonly string[]
  /** The OTHER concepts of the same scene. This is what keeps defendible metaphors alive. */
  siblingTerms: readonly string[]
}

export type RelevanceVerdictV1 = {
  version: typeof SEMANTIC_RELEVANCE_GATE_VERSION
  relevanceClass: RelevanceClassV1
  relevanceFocus: number
  matchLevel: RelevanceMatchLevelV1
  leadBelongs: boolean
  declaredBelongs: boolean
  descriptorsConsidered: number
  relevanceEvidence: readonly string[]
  rejectionReason: string | null
}

const MATCH_RANK: Record<RelevanceMatchLevelV1, number> = {
  exact: 0, synonym: 1, related: 2, sibling: 3, domain: 4, none: 5,
}
const CLASS_RANK: Record<RelevanceClassV1, number> = {
  EXACT: 0, STRONG: 1, RELATED: 2, WEAK: 3, UNRELATED: 4,
}

function normalized(value: unknown): string {
  return canonicalNarrativeTerm(String(value ?? ''))
}

function tokens(value: string): string[] {
  return value.split(' ').filter(Boolean)
}

function isNeutralDescriptor(value: string): boolean {
  const canonical = normalized(value)
  if (!canonical) return true
  if (NEUTRAL.has(canonical)) return true
  // A multi-word production tag ("aislado en negro") is neutral when every one of its tokens is.
  return tokens(canonical).every(token => NEUTRAL.has(token))
}

/**
 * A descriptor belongs to a concept set when the whole descriptor matches, or when one of its
 * tokens does. Token depth is required because providers publish phrases ("sillin de bicicleta")
 * where the concept is one word inside the phrase.
 */
function touches(descriptor: string, terms: readonly string[]): boolean {
  const canonical = normalized(descriptor)
  if (!canonical) return false
  for (const term of terms) {
    const target = normalized(term)
    if (!target) continue
    if (narrativeTermsEquivalentV1(canonical, target)) return true
    const targetTokens = tokens(target)
    const descriptorTokens = tokens(canonical)
    // A single-word concept may live inside a provider phrase, and a multi-word concept is
    // satisfied when all of its tokens are present. Neither direction invents a new synonym.
    if (targetTokens.length === 1 && descriptorTokens.some(token => narrativeTermsEquivalentV1(token, target))) return true
    if (targetTokens.length > 1 && targetTokens.every(token =>
      descriptorTokens.some(value => narrativeTermsEquivalentV1(value, token)))) return true
  }
  return false
}

function levelFor(descriptor: string, context: RelevanceConceptContextV1): RelevanceMatchLevelV1 {
  if (touches(descriptor, context.exactTerms)) return 'exact'
  if (touches(descriptor, context.synonymTerms)) return 'synonym'
  if (touches(descriptor, context.relatedTerms)) return 'related'
  if (touches(descriptor, context.siblingTerms)) return 'sibling'
  if (touches(descriptor, context.domainTerms)) return 'domain'
  return 'none'
}

function baseClassFor(level: RelevanceMatchLevelV1): RelevanceClassV1 {
  if (level === 'exact') return 'EXACT'
  if (level === 'synonym') return 'STRONG'
  if (level === 'related' || level === 'sibling') return 'RELATED'
  if (level === 'domain') return 'WEAK'
  return 'UNRELATED'
}

function weakest(left: RelevanceClassV1, right: RelevanceClassV1): RelevanceClassV1 {
  return CLASS_RANK[left] >= CLASS_RANK[right] ? left : right
}

function reasonFor(value: RelevanceClassV1): string {
  if (value === 'EXACT') return 'EXACT_CONCEPT'
  if (value === 'STRONG') return 'STRONG_SYNONYM'
  if (value === 'RELATED') return 'RELATED_CONTEXT'
  if (value === 'WEAK') return 'WEAK_ASSOCIATION'
  return 'UNRELATED_CANDIDATE'
}

/**
 * Builds the concept side of the comparison from evidence the pipeline already owns. The lexicon
 * is optional on purpose: with 112 entries the common case is an unresolved Spanish term, and the
 * gate must still work there from the concept's own terms and its scene siblings.
 */
export function relevanceConceptContextV1(input: {
  concept: VisualConceptV1
  lexicon?: ConceptLexiconEntryV1
  level?: ConceptExpansionLevelV1
  siblingConcepts?: readonly VisualConceptV1[]
}): RelevanceConceptContextV1 {
  const unique = (values: readonly (string | undefined)[]): readonly string[] =>
    Object.freeze([...new Set(values.map(value => normalized(value)).filter(Boolean))])
  const siblings = (input.siblingConcepts ?? [])
    .filter(value => normalized(value.normalizedTerm) !== normalized(input.concept.normalizedTerm))
  return Object.freeze({
    canonical: normalized(input.concept.normalizedTerm),
    subject: input.concept.subject,
    expectedLevel: input.level ?? 'exact',
    exactTerms: unique([input.concept.normalizedTerm, input.concept.originalTerm,
      ...input.concept.aliases, input.lexicon?.canonical]),
    synonymTerms: unique([...(input.lexicon?.synonyms ?? [])]),
    relatedTerms: unique([...(input.lexicon?.related ?? []), ...(input.lexicon?.pixabayTerms ?? []),
      ...(input.lexicon?.solarBases ?? [])]),
    domainTerms: unique([...(input.lexicon?.context ?? [])]),
    siblingTerms: unique(siblings.flatMap(value => [value.normalizedTerm, value.originalTerm, ...value.aliases])),
  })
}

/**
 * The single evaluation. Pure, deterministic, no I/O. Called once per concrete candidate at the
 * point where that candidate is created; the orchestrator reads the verdict and never recomputes.
 */
export function evaluateSemanticRelevanceV1(
  evidence: RelevanceCandidateEvidenceV1,
  context: RelevanceConceptContextV1,
): RelevanceVerdictV1 {
  const meaningful = evidence.descriptors.map(value => String(value ?? '')).filter(value => !isNeutralDescriptor(value))
  const window = meaningful.slice(0, RELEVANCE_DESCRIPTOR_WINDOW_V1)
  const evidenceLines: string[] = []
  let best: RelevanceMatchLevelV1 = 'none'
  let weighted = 0
  let leadBelongs = false
  for (let index = 0; index < window.length; index++) {
    const level = levelFor(window[index], context)
    if (level === 'none') continue
    if (MATCH_RANK[level] < MATCH_RANK[best]) best = level
    weighted += 1 / (1 + index)
    if (index === 0) leadBelongs = true
    if (evidenceLines.length < 6) evidenceLines.push(`${level.toUpperCase()}@${index}:${normalized(window[index])}`)
  }
  const declaredLevel = evidence.declaredIdentity ? levelFor(evidence.declaredIdentity, context) : 'none'
  const declaredBelongs = declaredLevel !== 'none'
  if (declaredBelongs) {
    if (MATCH_RANK[declaredLevel] < MATCH_RANK[best]) best = declaredLevel
    evidenceLines.unshift(`DECLARED_${declaredLevel.toUpperCase()}:${normalized(evidence.declaredIdentity)}`)
  }
  const focus = Math.min(1, weighted / FOCUS_NORMALISER)
  const base = baseClassFor(best)
  let value: RelevanceClassV1 = base
  // Curated catalogues and system-declared mappings are vetted evidence; an uploader's tag list
  // is not. Only the untrusted side is subject to the concentration cap.
  const trusted = evidence.authority === 'curated-local' || declaredBelongs
  if (base !== 'UNRELATED' && !trusted) {
    if (focus + FOCUS_EPSILON < RELEVANCE_FOCUS_MEDIUM_V1) value = 'WEAK'
    else if (focus + FOCUS_EPSILON < RELEVANCE_FOCUS_HIGH_V1) value = weakest(base, 'RELATED')
    else if (base === 'EXACT' && !leadBelongs) value = 'STRONG'
  }
  if (!window.length && !declaredBelongs) {
    return Object.freeze({
      version: SEMANTIC_RELEVANCE_GATE_VERSION, relevanceClass: 'UNRELATED', relevanceFocus: 0,
      matchLevel: 'none', leadBelongs: false, declaredBelongs: false, descriptorsConsidered: 0,
      relevanceEvidence: Object.freeze(['NO_CANDIDATE_EVIDENCE']), rejectionReason: 'UNRELATED_CANDIDATE',
    })
  }
  return Object.freeze({
    version: SEMANTIC_RELEVANCE_GATE_VERSION,
    relevanceClass: value,
    relevanceFocus: Math.round(focus * 1000) / 1000,
    matchLevel: best,
    leadBelongs,
    declaredBelongs,
    descriptorsConsidered: window.length,
    relevanceEvidence: Object.freeze(evidenceLines.length ? evidenceLines : ['NO_MATCHING_DESCRIPTOR']),
    rejectionReason: reasonFor(value),
  })
}

/** Hero admits EXACT|STRONG. Support additionally admits RELATED. WEAK and UNRELATED never enter. */
export function relevanceAdmitsRoleV1(value: RelevanceClassV1, role: RelevanceRoleV1): boolean {
  if (value === 'EXACT' || value === 'STRONG') return true
  return role === 'support' && value === 'RELATED'
}

/** A support may only be promoted to Hero when it would have been admissible as a Hero. */
export function relevanceAllowsHeroPromotionV1(value: RelevanceClassV1 | undefined): boolean {
  return value === undefined ? true : relevanceAdmitsRoleV1(value, 'hero')
}
