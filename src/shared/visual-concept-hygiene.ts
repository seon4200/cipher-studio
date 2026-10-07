import { canonicalNarrativeTerm } from './asset-intent'
import { expandConceptLexiconV1 } from './concept-lexicon'
import { isSpanishVisualStopwordV1, isVisualPersonTermV1, visualNarrativeTermStrengthV1 } from './visual-term-filter'

/**
 * Concept Hygiene answers whether a *lexical fallback* is entitled to become a retrieval
 * subject. It deliberately runs before provider search but after stronger authorities:
 * same-subclip structured semantics and direct icon evidence keep their established routes.
 * Semantic Relevance Gate V1 remains deliberately separate: it judges a concrete candidate
 * asset later, never the narration term itself.
 */
export const VISUAL_CONCEPT_HYGIENE_VERSION = 1 as const

export type VisualityClassV1 =
  | 'concrete-visual'
  | 'visual-action-with-context'
  | 'abstract-symbolic'
  | 'non-visual'
  | 'unknown'

export type VisualConceptEligibilityV1 = 'hero-eligible' | 'support-only' | 'not-visual'

export type VisualConceptHygieneDecisionV1 = {
  version: typeof VISUAL_CONCEPT_HYGIENE_VERSION
  normalizedTerm: string
  visuality: VisualityClassV1
  eligibility: VisualConceptEligibilityV1
  /** Raster retrieval is allowed only for a physical, concrete lexical subject. */
  rasterEligible: boolean
  reason: string
}

export type VisualConceptHygieneCandidateSourceV1 =
  | 'structured-concept'
  | 'fallback-token'
  | 'fallback-anchor'
  | 'fallback-keyword'
  | 'intent-concept'

export type ExplicitVisualEvidenceKindV1 = 'emoji' | 'hexcode' | 'canonical-hint'

/**
 * Direct icon evidence is trace information, not an instruction to replace the established
 * representation route. The existing resolver remains the authority for its local catalogue
 * resolution and attempt order.
 */
export type ExplicitVisualEvidenceV1 = {
  kind: ExplicitVisualEvidenceKindV1
  iconSymbolicOnly: boolean
  reason: string
}

export type VisualConceptHygieneAuthorityV1 =
  | 'structured-semantic'
  | 'explicit-visual-evidence'
  | 'lexical-fallback'

/** Diagnostics only; none of this becomes SceneSpec/PixelIdentity data. */
export type VisualConceptHygieneCandidateV1 = {
  source: VisualConceptHygieneCandidateSourceV1
  originalTerm: string
  authority: VisualConceptHygieneAuthorityV1
  hygieneEvaluated: boolean
  emitted: boolean
  decision?: VisualConceptHygieneDecisionV1
  explicitVisualEvidence?: ExplicitVisualEvidenceV1
}

export type VisualConceptHygieneMetricsV1 = {
  /** Kept as the public V1 metric: only lexical fallbacks actually classified by Hygiene. */
  fallbackTokensEvaluated: number
  concreteVisual: number
  visualActionWithContext: number
  abstractSymbolic: number
  nonVisual: number
  unknown: number
  fallbackTokensRejected: number
  photoQueriesPreventedByConceptHygiene: number
  abstractReroutedToSymbolic: number
  abstractReroutedToEditorial: number
  heroEligible: number
  supportOnly: number
  structuredConceptsBypassedHygiene: number
  explicitVisualEvidenceBypassedHygiene: number
  lexicalFallbackConceptsHygieneEvaluated: number
}

/** Reusable language categories, not fixture-specific token lists. */
const DISCOURSE_MODIFIERS = new Set([
  'apenas', 'bastante', 'casi', 'demasiado', 'mas', 'más', 'menos', 'muy', 'poco', 'tanto',
  'tan', 'siempre', 'nunca', 'tambien', 'también', 'tampoco', 'solo', 'sólo', 'incluso',
  'quizas', 'quizá', 'quizas', 'quizás', 'acaso', 'luego', 'antes', 'despues', 'después',
])

/** Covers normal Spanish conjugations of non-referential predicates without fixture lookup. */
const NON_REFERENTIAL_PREDICATE_STEMS = Object.freeze([
  'result', 'parec', 'signific', 'implic', 'consist', 'equival', 'correspond', 'depend',
])

const ABSTRACT_NOMINAL_SUFFIX = /(?:cion|sion|dad|tad|ancia|encia|anza|eza|ez|ismo|idad|umbre|encio)$/u
const ACTION_FORM_SUFFIX = /(?:ar|er|ir|ando|iendo)$/u
const OPENMOJI_REFERENCE = /^(?:openmoji:)?(?:[0-9a-f]{2,8})(?:-[0-9a-f]{2,8})*$/iu

type LexiconSubject = 'object' | 'place' | 'symbol' | 'person' | 'event' | 'process' | 'context' | 'unknown'

function stableDecision(
  normalizedTerm: string,
  visuality: VisualityClassV1,
  eligibility: VisualConceptEligibilityV1,
  rasterEligible: boolean,
  reason: string,
): VisualConceptHygieneDecisionV1 {
  return Object.freeze({ version: VISUAL_CONCEPT_HYGIENE_VERSION, normalizedTerm, visuality, eligibility, rasterEligible, reason })
}

function isPhysicalSubject(subject: LexiconSubject | undefined): boolean {
  return subject === 'object' || subject === 'person' || subject === 'place' || subject === 'event'
}

function isNonReferentialPredicate(term: string): boolean {
  return NON_REFERENTIAL_PREDICATE_STEMS.some(stem => term === stem || term.startsWith(stem))
}

function directLexiconSubject(term: string): LexiconSubject | undefined {
  const entry = expandConceptLexiconV1(term).find(value => value.level === 'exact' || value.level === 'synonym')
  return entry?.entry.subject
}

function explicitKind(input: { term: unknown; emoji?: unknown; canonicalHint?: unknown }): ExplicitVisualEvidenceKindV1 | null {
  const term = String(input.term ?? '').trim()
  if (OPENMOJI_REFERENCE.test(term)) return 'hexcode'
  if (typeof input.emoji === 'string' && input.emoji.trim()) return 'emoji'
  if (typeof input.canonicalHint === 'string' && input.canonicalHint.trim()) return 'canonical-hint'
  return null
}

/**
 * Separately resolves direct icon evidence. This is intentionally not the lexical Hygiene
 * classifier: a declared emoji/hexcode/hint is already stronger authority than raw transcript
 * text. The result is diagnostic evidence only; it does not override a structured concept's
 * historical subject, provider plan or representation preference.
 */
export function resolveExplicitVisualEvidenceV1(input: {
  term: unknown
  emoji?: unknown
  canonicalHint?: unknown
}): ExplicitVisualEvidenceV1 | null {
  const kind = explicitKind(input)
  if (!kind) return null
  const term = String(input.term ?? '').trim()
  const emoji = typeof input.emoji === 'string' ? input.emoji.trim() : ''
  const canonicalHint = typeof input.canonicalHint === 'string' ? input.canonicalHint.trim() : ''
  const subject = [term, emoji, canonicalHint].map(directLexiconSubject).find((value): value is LexiconSubject => !!value)
  const iconSymbolicOnly = kind === 'hexcode' || !isPhysicalSubject(subject)
  return Object.freeze({
    kind,
    iconSymbolicOnly,
    reason: iconSymbolicOnly ? 'EXPLICIT_ICON_OR_SYMBOLIC_EVIDENCE' : 'EXPLICIT_PHYSICAL_EVIDENCE_PRESERVED',
  })
}

/** Direct, catalog-backed physical evidence used only to establish action context. */
export function hasDirectConcreteVisualEvidenceV1(input: {
  term: unknown
  emoji?: unknown
  canonicalHint?: unknown
}): boolean {
  const values = [
    String(input.term ?? '').trim(),
    typeof input.emoji === 'string' ? input.emoji.trim() : '',
    typeof input.canonicalHint === 'string' ? input.canonicalHint.trim() : '',
  ]
  return values.some(value => isPhysicalSubject(directLexiconSubject(value)))
}

export function isLexicalFallbackSourceV1(source: VisualConceptHygieneCandidateSourceV1): boolean {
  return source === 'fallback-token' || source === 'fallback-anchor' || source === 'fallback-keyword'
}

/**
 * Classifies only fallback narration terms. Unknown terms remain unknown; they never inherit a
 * physical-object route simply because legacy VisualConcept used `object` as a broad default.
 */
export function classifyVisualConceptHygieneV1(input: {
  term: unknown
  source: VisualConceptHygieneCandidateSourceV1
  semanticSubject?: LexiconSubject | 'unknown'
  hasConcreteContext?: boolean
}): VisualConceptHygieneDecisionV1 {
  const normalizedTerm = canonicalNarrativeTerm(String(input.term ?? ''))
  const directSubject = directLexiconSubject(normalizedTerm)
  const semanticSubject = input.semanticSubject
  const physical = isPhysicalSubject(directSubject) || isPhysicalSubject(semanticSubject) ||
    isVisualPersonTermV1(normalizedTerm)
  const knownSymbol = directSubject === 'symbol' || semanticSubject === 'symbol'

  if (!normalizedTerm || isSpanishVisualStopwordV1(normalizedTerm))
    return stableDecision(normalizedTerm, 'non-visual', 'not-visual', false, 'FUNCTIONAL_OR_EMPTY_TERM')
  if (DISCOURSE_MODIFIERS.has(normalizedTerm) || visualNarrativeTermStrengthV1(normalizedTerm) === 1 ||
      isNonReferentialPredicate(normalizedTerm))
    return stableDecision(normalizedTerm, 'non-visual', 'not-visual', false, 'DISCOURSE_OR_NONREFERENTIAL_TERM')
  if (physical)
    return stableDecision(normalizedTerm, 'concrete-visual', 'hero-eligible', true, 'CONCRETE_SUBJECT_EVIDENCE')
  if (knownSymbol)
    return stableDecision(normalizedTerm, 'abstract-symbolic', 'hero-eligible', false, 'CURATED_SYMBOL_EVIDENCE')
  if (ACTION_FORM_SUFFIX.test(normalizedTerm)) {
    return input.hasConcreteContext
      ? stableDecision(normalizedTerm, 'visual-action-with-context', 'support-only', false, 'ACTION_HAS_LOCAL_CONCRETE_CONTEXT')
      : stableDecision(normalizedTerm, 'visual-action-with-context', 'not-visual', false, 'ACTION_REQUIRES_LOCAL_CONCRETE_CONTEXT')
  }
  if (ABSTRACT_NOMINAL_SUFFIX.test(normalizedTerm) || semanticSubject === 'process' || semanticSubject === 'context')
    return stableDecision(normalizedTerm, 'abstract-symbolic', 'support-only', false, 'ABSTRACT_NOMINAL_OR_CONTEXTUAL_SUBJECT')
  return stableDecision(normalizedTerm, 'unknown', 'not-visual', false, 'UNKNOWN_REQUIRES_RESOURCE_EVIDENCE')
}

export function visualConceptCanBeHeroV1(concept: { hygiene?: VisualConceptHygieneDecisionV1 }): boolean {
  return concept.hygiene?.eligibility !== 'support-only' && concept.hygiene?.eligibility !== 'not-visual'
}

export function visualConceptCanSearchLocalAssetsV1(concept: { hygiene?: VisualConceptHygieneDecisionV1 }): boolean {
  return concept.hygiene?.eligibility !== 'not-visual'
}

export function visualConceptCanSearchRasterV1(concept: {
  hygiene?: VisualConceptHygieneDecisionV1
}): boolean {
  return concept.hygiene?.rasterEligible !== false
}

export function summarizeVisualConceptHygieneV1(
  candidates: readonly VisualConceptHygieneCandidateV1[],
): VisualConceptHygieneMetricsV1 {
  const metrics: VisualConceptHygieneMetricsV1 = {
    fallbackTokensEvaluated: 0, concreteVisual: 0, visualActionWithContext: 0, abstractSymbolic: 0,
    nonVisual: 0, unknown: 0, fallbackTokensRejected: 0, photoQueriesPreventedByConceptHygiene: 0,
    abstractReroutedToSymbolic: 0, abstractReroutedToEditorial: 0, heroEligible: 0, supportOnly: 0,
    structuredConceptsBypassedHygiene: 0, explicitVisualEvidenceBypassedHygiene: 0,
    lexicalFallbackConceptsHygieneEvaluated: 0,
  }
  for (const candidate of candidates) {
    if (candidate.source === 'structured-concept' || candidate.source === 'intent-concept')
      metrics.structuredConceptsBypassedHygiene++
    if (candidate.explicitVisualEvidence) metrics.explicitVisualEvidenceBypassedHygiene++
    if (!candidate.hygieneEvaluated || !candidate.decision) continue
    metrics.fallbackTokensEvaluated++
    metrics.lexicalFallbackConceptsHygieneEvaluated++
    if (candidate.decision.visuality === 'concrete-visual') metrics.concreteVisual++
    else if (candidate.decision.visuality === 'visual-action-with-context') metrics.visualActionWithContext++
    else if (candidate.decision.visuality === 'abstract-symbolic') metrics.abstractSymbolic++
    else if (candidate.decision.visuality === 'non-visual') metrics.nonVisual++
    else metrics.unknown++
    if (candidate.decision.eligibility === 'hero-eligible') metrics.heroEligible++
    if (candidate.decision.eligibility === 'support-only') metrics.supportOnly++
    if (!candidate.emitted) metrics.fallbackTokensRejected++
    if (!candidate.decision.rasterEligible) metrics.photoQueriesPreventedByConceptHygiene++
    if (candidate.decision.visuality === 'abstract-symbolic') metrics.abstractReroutedToSymbolic++
    if (candidate.decision.visuality === 'abstract-symbolic' && !candidate.emitted) metrics.abstractReroutedToEditorial++
  }
  return Object.freeze(metrics)
}
