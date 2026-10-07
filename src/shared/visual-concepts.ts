import { canonicalNarrativeTerm, type AssetIntentV1 } from './asset-intent'
import type { LocalSceneSemanticV1 } from './local-scene-semantic'
import { narrativeTermsEquivalentV1 } from './narrative-term-forms'
import { isSpanishVisualStopwordV1, isVisualPersonTermV1, visualNarrativeTermStrengthV1 } from './visual-term-filter'
import {
  classifyVisualConceptHygieneV1,
  hasDirectConcreteVisualEvidenceV1,
  isLexicalFallbackSourceV1,
  resolveExplicitVisualEvidenceV1,
  summarizeVisualConceptHygieneV1,
  type ExplicitVisualEvidenceV1,
  type VisualConceptHygieneAuthorityV1,
  type VisualConceptHygieneCandidateSourceV1,
  type VisualConceptHygieneCandidateV1,
  type VisualConceptHygieneDecisionV1,
  type VisualConceptHygieneMetricsV1,
} from './visual-concept-hygiene'

/**
 * Narrative-only concept roles.  They describe retrieval intent and deliberately stay
 * outside VisualSceneSpec, RenderBindings and PixelIdentity.
 */
export type VisualConceptRoleV1 = 'hero' | 'support' | 'editorial'
export type VisualConceptSubjectV1 =
  | 'object'
  | 'place'
  | 'symbol'
  | 'person'
  | 'event'
  | 'process'
  | 'context'
  | 'unknown'

export type VisualConceptV1 = {
  originalTerm: string
  normalizedTerm: string
  aliases: readonly string[]
  emoji?: string
  subject: VisualConceptSubjectV1
  relation?: string
  importance: 1 | 2 | 3
  preferredRole: VisualConceptRoleV1
  evidence: 'direct-timed-concept' | 'direct-timed-token' | 'anchor' | 'keyword' | 'contextual-concept'
  /** Present only when the lexical-fallback hygiene classifier actually evaluated this concept. */
  hygiene?: VisualConceptHygieneDecisionV1
  /** Provenance is diagnostics-only; candidate ordering remains the historical evidence order. */
  hygieneAuthority?: VisualConceptHygieneAuthorityV1
}

export type VisualConceptSetV1 = {
  version: 1
  primary: VisualConceptV1 | null
  secondary: VisualConceptV1 | null
  tertiary: VisualConceptV1 | null
  hygiene: {
    version: 1
    candidates: readonly VisualConceptHygieneCandidateV1[]
    metrics: VisualConceptHygieneMetricsV1
  }
}

type ConceptInput = {
  originalTerm: string
  canonicalHint?: string
  emoji?: string
  relation?: string
  importance: 1 | 2 | 3
  evidence: VisualConceptV1['evidence']
  source: VisualConceptHygieneCandidateSourceV1
  structured: boolean
}

/**
 * A nonvisual lexical fallback is intentionally not emitted as a VisualConcept.  It still keeps
 * its historical ordering slot while the three-concept window is selected, so filtering it cannot
 * accidentally promote a lower-priority contextual concept into a new Hero.
 */
type HygieneSelectionReservationV1 = {
  normalizedTerm: string
  evidence: VisualConceptV1['evidence']
  importance: 1 | 2 | 3
  preferredRole: VisualConceptRoleV1
}

type ConceptSelectionEntryV1 = HygieneSelectionReservationV1 & {
  concept: VisualConceptV1 | null
}

const EDITORIAL_TERMS = new Set([
  'caos', 'contradiccion', 'indignacion', 'estabilidad', 'recuperacion', 'requerimiento',
  'proceso', 'relacion', 'historia', 'religioso', 'religion',
])
const PLACE_TERMS = new Set(['estadio', 'hospital', 'escuela', 'iglesia', 'puente', 'mexico', 'mexico'])
const SYMBOL_TERMS = new Set([
  'tiempo', 'reloj', 'direccion', 'brujula', 'evidencia', 'dinero', 'conexion', 'crecimiento',
  'planeta', 'bandera', 'mapa', 'calendario', 'corazon', 'estrella', 'sol', 'luna',
])
const EVENT_TERMS = new Set(['protesta', 'celebracion', 'incendio', 'accidente', 'construccion'])
const EVIDENCE_ORDER: Record<VisualConceptV1['evidence'], number> = {
  'direct-timed-concept': 0,
  'direct-timed-token': 1,
  anchor: 2,
  keyword: 3,
  'contextual-concept': 4,
}

function subjectFor(term: string): VisualConceptSubjectV1 {
  if (EDITORIAL_TERMS.has(term)) return 'process'
  if (isVisualPersonTermV1(term)) return 'person'
  if (PLACE_TERMS.has(term)) return 'place'
  if (SYMBOL_TERMS.has(term)) return 'symbol'
  if (EVENT_TERMS.has(term)) return 'event'
  // Legacy default is retained for structured/direct inputs. Hygiene intercepts only lexical
  // fallbacks before this broad default is allowed to reach physical representation routing.
  return term ? 'object' : 'unknown'
}

function roleFor(subject: VisualConceptSubjectV1): VisualConceptRoleV1 {
  if (subject === 'process' || subject === 'context' || subject === 'unknown') return 'editorial'
  return 'hero'
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function isDirectTimedConcept(
  concept: { label: string; canonicalHint?: string; start?: number; end?: number; scope?: 'scene' | 'context' },
  semantic: LocalSceneSemanticV1,
  directTokens: ReadonlySet<string>,
): boolean {
  if (concept.scope === 'scene') return true
  if (concept.scope === 'context') return false
  if (concept.start !== undefined && concept.end !== undefined)
    return concept.end >= semantic.start && concept.start <= semantic.end
  // Unscoped historical evidence keeps the temporal safeguard from 4A. New V15
  // contexts explicitly mark DeepSeek concepts emitted by the same visualClip.
  return [...directTokens].some(token => narrativeTermsEquivalentV1(concept.label, token) ||
    narrativeTermsEquivalentV1(concept.canonicalHint, token))
}

function subjectForHygiene(
  subject: VisualConceptSubjectV1,
  hygiene: VisualConceptHygieneDecisionV1,
): VisualConceptSubjectV1 {
  if (hygiene.visuality === 'visual-action-with-context') return 'process'
  if (hygiene.visuality === 'abstract-symbolic') return subject === 'unknown' ? 'symbol' : subject
  if (hygiene.visuality === 'non-visual' || hygiene.visuality === 'unknown') return 'unknown'
  // `concrete-visual` is only reached through direct physical/emoji/lexicon evidence. An object
  // is a safe provisional subject until Visual Retrieval enriches it with its exact lexicon class.
  return subject === 'unknown' ? 'object' : subject
}

function roleForHygiene(
  subject: VisualConceptSubjectV1,
  hygiene: VisualConceptHygieneDecisionV1,
): VisualConceptRoleV1 {
  if (hygiene.eligibility === 'not-visual') return 'editorial'
  if (hygiene.eligibility === 'support-only') return 'support'
  return roleFor(subject)
}

function reservationForRejectedLexicalFallback(candidate: ConceptInput): HygieneSelectionReservationV1 | null {
  const originalTerm = clean(candidate.originalTerm)
  const normalizedTerm = canonicalNarrativeTerm(originalTerm)
  const legacyStrength = visualNarrativeTermStrengthV1(originalTerm)
  if (!normalizedTerm || legacyStrength === 0) return null
  const subject = legacyStrength === 1 ? 'process' : subjectFor(normalizedTerm)
  return {
    normalizedTerm,
    evidence: candidate.evidence,
    importance: legacyStrength === 1 ? 1 : candidate.importance,
    preferredRole: roleFor(subject),
  }
}

function compareConceptSelectionV1(
  a: Pick<ConceptSelectionEntryV1, 'evidence' | 'importance' | 'preferredRole'>,
  b: Pick<ConceptSelectionEntryV1, 'evidence' | 'importance' | 'preferredRole'>,
): number {
  return EVIDENCE_ORDER[a.evidence] - EVIDENCE_ORDER[b.evidence] ||
    b.importance - a.importance ||
    (a.preferredRole === 'hero' ? 0 : 1) - (b.preferredRole === 'hero' ? 0 : 1)
}

function candidateToConcept(
  candidate: ConceptInput,
  hasConcreteContext: boolean,
  hygieneCandidates: VisualConceptHygieneCandidateV1[],
  declaredExplicitEvidence: ExplicitVisualEvidenceV1 | null,
): VisualConceptV1 | null {
  const originalTerm = clean(candidate.originalTerm)
  const normalizedTerm = canonicalNarrativeTerm(originalTerm)
  if (!originalTerm || !normalizedTerm) return null
  const inferredSubject = subjectFor(normalizedTerm)
  // Hygiene is per candidate, never per scene. A structured concept stays on the historical
  // route while neighbouring raw fallback tokens are still allowed to be rejected as nonvisual.
  const hygieneEvaluated = !candidate.structured && isLexicalFallbackSourceV1(candidate.source) &&
    !declaredExplicitEvidence
  const hygiene = hygieneEvaluated
    ? classifyVisualConceptHygieneV1({ term: originalTerm, source: candidate.source, hasConcreteContext })
    : undefined
  // Outside the narrow Hygiene scope, retain the historical term filter exactly.  This matters
  // for a scene with structured concepts: a stale contextual noun is not granted a new route,
  // yet neither is the old resolver behavior silently rewritten.
  const legacyStrength = !hygieneEvaluated && !declaredExplicitEvidence
    ? visualNarrativeTermStrengthV1(originalTerm) : undefined
  const emitted = hygiene ? hygiene.eligibility !== 'not-visual' : legacyStrength !== 0
  const authority: VisualConceptHygieneAuthorityV1 = candidate.structured ? 'structured-semantic'
    : declaredExplicitEvidence ? 'explicit-visual-evidence' : 'lexical-fallback'
  hygieneCandidates.push(Object.freeze({ source: candidate.source, originalTerm, authority, hygieneEvaluated, emitted,
    ...(hygiene ? { decision: hygiene } : {}),
    ...(declaredExplicitEvidence ? { explicitVisualEvidence: declaredExplicitEvidence } : {}) }))
  if (!emitted) return null
  let subject = hygiene ? subjectForHygiene(inferredSubject, hygiene)
    : legacyStrength === 1 ? 'process' : inferredSubject
  let preferredRole = hygiene ? roleForHygiene(subject, hygiene) : roleFor(subject)
  return {
    originalTerm,
    normalizedTerm,
    aliases: [originalTerm, ...(candidate.canonicalHint ? [candidate.canonicalHint] : [])],
    ...(candidate.emoji ? { emoji: candidate.emoji } : {}),
    subject,
    ...(candidate.relation ? { relation: candidate.relation } : {}),
    importance: legacyStrength === 1 ? 1 : candidate.importance,
    preferredRole,
    evidence: candidate.evidence,
    ...(hygiene ? { hygiene } : {}),
    hygieneAuthority: authority,
  }
}

/**
 * Extracts at most three narrative concepts from existing local semantics. It never reads
 * globalText as a source of new subjects and never emits provider, path, asset or pixel data.
 * The lexicon later expands the normalized terms; this function preserves only narration evidence.
 */
export function createVisualConceptSetV1(input: {
  intent: AssetIntentV1
  localSemantic?: LocalSceneSemanticV1
}): VisualConceptSetV1 {
  const semantic = input.localSemantic
  const directTokens = new Set((semantic?.localTokens ?? [])
    .filter(token => token.temporalAlignment === 'direct')
    .map(token => canonicalNarrativeTerm(token.text)).filter(Boolean))
  // The on-screen keyword remains independent. Retrieval starts from structured scene concepts;
  // a pronounced token is only a fallback when DeepSeek supplied no stronger visual evidence.
  const preferredDirectTerms = new Set([canonicalNarrativeTerm(input.intent.keyword)].filter(Boolean))
  const candidates: ConceptInput[] = []
  for (const concept of semantic?.concepts ?? []) {
    const direct = isDirectTimedConcept(concept, semantic!, directTokens)
    const matchesSelectedKeyword = canonicalNarrativeTerm(concept.label) === canonicalNarrativeTerm(input.intent.keyword)
    candidates.push({
      // The source label is narrative evidence. A canonicalHint is an optional icon/provider
      // hint and must never replace that evidence (for example, “accidente” → “shield”).
      originalTerm: concept.label,
      ...(concept.canonicalHint ? { canonicalHint: concept.canonicalHint } : {}),
      ...(concept.emoji ? { emoji: concept.emoji } : {}),
      ...(semantic?.relation ? { relation: semantic.relation } : {}),
      importance: direct ? (matchesSelectedKeyword ? 3 : 2) : 1,
      evidence: direct ? 'direct-timed-concept' : 'contextual-concept',
      // Only concepts proved to belong to this temporal window have structured authority.
      // Historical/unscoped neighbouring concepts remain available as weak context, but must
      // never displace a directly pronounced local subject.
      source: 'structured-concept', structured: direct,
    })
  }
  for (const token of semantic?.localTokens ?? []) {
    if (token.temporalAlignment !== 'direct') continue
    if (isSpanishVisualStopwordV1(token.text)) continue
    const normalized = canonicalNarrativeTerm(token.text)
    candidates.push({ originalTerm: token.text, importance: preferredDirectTerms.has(normalized) ? 3 : 1, evidence: 'direct-timed-token',
      source: 'fallback-token', structured: false, ...(semantic?.relation ? { relation: semantic.relation } : {}) })
  }
  if (semantic?.anchor || input.intent.anchor) candidates.push({
    originalTerm: semantic?.anchor || input.intent.anchor || '', importance: 2, evidence: 'anchor',
    source: 'fallback-anchor', structured: false,
    ...(semantic?.relation || input.intent.relation ? { relation: semantic?.relation || input.intent.relation } : {}),
  })
  if (!isSpanishVisualStopwordV1(input.intent.keyword)) candidates.push({ originalTerm: input.intent.keyword, importance: 2, evidence: 'keyword',
    source: 'fallback-keyword', structured: false, ...(input.intent.relation ? { relation: input.intent.relation } : {}) })
  for (const concept of input.intent.concepts) candidates.push({ originalTerm: concept, importance: 1,
    // Without LocalSceneSemantic, AssetIntent concepts are the only structured evidence. Once a
    // localized semantic object exists, its timestamped concepts own authority instead; intent
    // context remains weaker and cannot override the local subclip.
    evidence: 'contextual-concept', source: 'intent-concept', structured: !semantic,
    ...(input.intent.relation ? { relation: input.intent.relation } : {}) })

  // Hygiene applies only to raw lexical fallback. Stronger authority remains diagnostic-only and
  // never replaces the original structured/direct routing contract.
  const declaredExplicitEvidence = candidates.map(candidate => resolveExplicitVisualEvidenceV1({
    term: candidate.originalTerm, emoji: candidate.emoji, canonicalHint: candidate.canonicalHint,
  }))
  const preliminary = candidates.map((candidate, index) =>
    !candidate.structured && isLexicalFallbackSourceV1(candidate.source) && !declaredExplicitEvidence[index]
      ? classifyVisualConceptHygieneV1({ term: candidate.originalTerm, source: candidate.source })
      : undefined)

  // Only direct, catalog-backed physical evidence in this local window establishes drawable
  // context for an action. Anchors and global labels cannot promote a bare verb to photo search.
  const hasConcreteContext = (index: number): boolean => candidates.some((candidate, candidateIndex) => candidateIndex !== index &&
    ((candidate.structured && hasDirectConcreteVisualEvidenceV1({ term: candidate.originalTerm,
      emoji: candidate.emoji, canonicalHint: candidate.canonicalHint })) ||
      preliminary[candidateIndex]?.visuality === 'concrete-visual'))

  const unique = new Map<string, VisualConceptV1>()
  const hygieneCandidates: VisualConceptHygieneCandidateV1[] = []
  const hygieneReservations: HygieneSelectionReservationV1[] = []
  for (const [index, candidate] of candidates.entries()) {
    const concept = candidateToConcept(candidate, hasConcreteContext(index), hygieneCandidates, declaredExplicitEvidence[index])
    if (!concept) {
      const diagnostic = hygieneCandidates[hygieneCandidates.length - 1]
      if (diagnostic?.hygieneEvaluated && !diagnostic.emitted) {
        const reservation = reservationForRejectedLexicalFallback(candidate)
        if (reservation) hygieneReservations.push(reservation)
      }
      continue
    }
    const previousEntry = [...unique.entries()].find(([term]) => narrativeTermsEquivalentV1(term, concept.normalizedTerm))
    const previousKey = previousEntry?.[0] ?? concept.normalizedTerm
    const previous = previousEntry?.[1]
    // This is intentionally narrower than a new global authority rank. When the exact same
    // narrative term has structured evidence and a lexical fallback that Hygiene reclassified,
    // the structured contract owns that term. Other duplicates retain the historical evidence
    // ordering unchanged.
    const structuredOverHygieneDuplicate = previous?.hygieneAuthority === 'structured-semantic' && !!concept.hygiene
    const replacesHygieneDuplicate = concept.hygieneAuthority === 'structured-semantic' && !!previous?.hygiene
    const historicalEvidenceWins = !previous ||
      EVIDENCE_ORDER[concept.evidence] < EVIDENCE_ORDER[previous.evidence] ||
      EVIDENCE_ORDER[concept.evidence] === EVIDENCE_ORDER[previous.evidence] && concept.importance > previous.importance
    const shouldReplace = !previous || replacesHygieneDuplicate ||
      !structuredOverHygieneDuplicate && historicalEvidenceWins
    if (shouldReplace) {
      if (previous && previousKey !== concept.normalizedTerm) unique.delete(previousKey)
      unique.set(concept.normalizedTerm, concept)
    }
  }
  const prioritized: ConceptSelectionEntryV1[] = [...unique.values()].map(concept => ({
    normalizedTerm: concept.normalizedTerm,
    evidence: concept.evidence,
    importance: concept.importance,
    preferredRole: concept.preferredRole,
    concept,
  }))
  for (const reservation of hygieneReservations) {
    // A surviving equivalent concept already owns this historical slot.  Reservations only stop
    // lower-priority concepts from backfilling a term that Hygiene intentionally removed.
    if (prioritized.some(entry => narrativeTermsEquivalentV1(entry.normalizedTerm, reservation.normalizedTerm))) continue
    prioritized.push({ ...reservation, concept: null })
  }
  prioritized.sort(compareConceptSelectionV1)
  // Reservations consume their historical top-three position, but never become VisualConcepts.
  // This preserves the old decision boundary without granting rejected transcript residue a
  // provider plan, a Hero role, or a physical-object route.
  const selected = prioritized.slice(0, 3).flatMap(entry => entry.concept ? [entry.concept] : [])
  const [primary = null, secondary = null, tertiary = null] = selected
  const normalizeRole = (concept: VisualConceptV1 | null, index: number): VisualConceptV1 | null => {
    if (!concept) return null
    if (concept.preferredRole !== 'hero') return concept
    return { ...concept, preferredRole: index === 0 ? 'hero' : 'support' }
  }
  return {
    version: 1,
    primary: normalizeRole(primary, 0), secondary: normalizeRole(secondary, 1), tertiary: normalizeRole(tertiary, 2),
    hygiene: Object.freeze({ version: 1 as const, candidates: Object.freeze(hygieneCandidates),
      metrics: summarizeVisualConceptHygieneV1(hygieneCandidates) }),
  }
}
