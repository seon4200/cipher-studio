import { canonicalNarrativeTerm, type AssetIntentV1 } from './asset-intent'
import type { LocalSceneSemanticV1 } from './local-scene-semantic'
import { narrativeTermsEquivalentV1 } from './narrative-term-forms'

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
}

export type VisualConceptSetV1 = {
  version: 1
  primary: VisualConceptV1 | null
  secondary: VisualConceptV1 | null
  tertiary: VisualConceptV1 | null
}

type ConceptInput = {
  originalTerm: string
  canonicalHint?: string
  emoji?: string
  relation?: string
  importance: 1 | 2 | 3
  evidence: VisualConceptV1['evidence']
}

const EDITORIAL_TERMS = new Set([
  'caos', 'contradiccion', 'indignacion', 'estabilidad', 'recuperacion', 'requerimiento',
  'proceso', 'relacion', 'historia', 'religioso', 'religion', 'multitud', 'personas', 'gente',
])
const PERSON_TERMS = new Set([
  'persona', 'personas', 'gente', 'multitud', 'policia', 'trabajador', 'trabajadores',
  'hombre', 'mujer', 'human', 'person', 'people', 'user', 'usuario', 'usuarios', 'crowd',
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
  if (PERSON_TERMS.has(term)) return 'person'
  if (PLACE_TERMS.has(term)) return 'place'
  if (SYMBOL_TERMS.has(term)) return 'symbol'
  if (EVENT_TERMS.has(term)) return 'event'
  return term ? 'object' : 'unknown'
}

function roleFor(subject: VisualConceptSubjectV1): VisualConceptRoleV1 {
  if (subject === 'person' || subject === 'process' || subject === 'context' || subject === 'unknown') return 'editorial'
  return 'hero'
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function isDirectTimedConcept(
  concept: { label: string; canonicalHint?: string; start?: number; end?: number },
  semantic: LocalSceneSemanticV1,
  directTokens: ReadonlySet<string>,
): boolean {
  if (concept.start !== undefined && concept.end !== undefined)
    return concept.end >= semantic.start && concept.start <= semantic.end
  return [...directTokens].some(token => narrativeTermsEquivalentV1(concept.label, token) ||
    narrativeTermsEquivalentV1(concept.canonicalHint, token))
}

function candidateToConcept(candidate: ConceptInput): VisualConceptV1 | null {
  const originalTerm = clean(candidate.originalTerm)
  const normalizedTerm = canonicalNarrativeTerm(originalTerm)
  if (!originalTerm || !normalizedTerm) return null
  const subject = subjectFor(normalizedTerm)
  return {
    originalTerm,
    normalizedTerm,
    aliases: [originalTerm, ...(candidate.canonicalHint ? [candidate.canonicalHint] : [])],
    ...(candidate.emoji ? { emoji: candidate.emoji } : {}),
    subject,
    ...(candidate.relation ? { relation: candidate.relation } : {}),
    importance: candidate.importance,
    preferredRole: roleFor(subject),
    evidence: candidate.evidence,
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
  // Keyword V2 is already temporally selected by LocalSceneSemantic. It is the only direct
  // token promoted above other words in the same window; structured direct concepts remain
  // strong but cannot displace that locally aligned selection just by appearing earlier.
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
    })
  }
  for (const token of semantic?.localTokens ?? []) {
    if (token.temporalAlignment !== 'direct') continue
    const normalized = canonicalNarrativeTerm(token.text)
    candidates.push({ originalTerm: token.text, importance: preferredDirectTerms.has(normalized) ? 3 : 1, evidence: 'direct-timed-token',
      ...(semantic?.relation ? { relation: semantic.relation } : {}) })
  }
  if (semantic?.anchor || input.intent.anchor) candidates.push({
    originalTerm: semantic?.anchor || input.intent.anchor || '', importance: 2, evidence: 'anchor',
    ...(semantic?.relation || input.intent.relation ? { relation: semantic?.relation || input.intent.relation } : {}),
  })
  candidates.push({ originalTerm: input.intent.keyword, importance: 2, evidence: 'keyword',
    ...(input.intent.relation ? { relation: input.intent.relation } : {}) })
  for (const concept of input.intent.concepts) candidates.push({ originalTerm: concept, importance: 1,
    evidence: 'contextual-concept', ...(input.intent.relation ? { relation: input.intent.relation } : {}) })

  const unique = new Map<string, VisualConceptV1>()
  for (const candidate of candidates) {
    const concept = candidateToConcept(candidate)
    if (!concept) continue
    const previousEntry = [...unique.entries()].find(([term]) => narrativeTermsEquivalentV1(term, concept.normalizedTerm))
    const previousKey = previousEntry?.[0] ?? concept.normalizedTerm
    const previous = previousEntry?.[1]
    if (!previous || EVIDENCE_ORDER[concept.evidence] < EVIDENCE_ORDER[previous.evidence] ||
      (EVIDENCE_ORDER[concept.evidence] === EVIDENCE_ORDER[previous.evidence] && concept.importance > previous.importance)) {
      if (previous && previousKey !== concept.normalizedTerm) unique.delete(previousKey)
      unique.set(concept.normalizedTerm, concept)
    }
  }
  const prioritized = [...unique.values()].sort((a, b) => EVIDENCE_ORDER[a.evidence] - EVIDENCE_ORDER[b.evidence] ||
    b.importance - a.importance ||
    (a.preferredRole === 'hero' ? 0 : 1) - (b.preferredRole === 'hero' ? 0 : 1))
  const [primary = null, secondary = null, tertiary = null] = prioritized.slice(0, 3)
  const normalizeRole = (concept: VisualConceptV1 | null, index: number): VisualConceptV1 | null => {
    if (!concept) return null
    if (concept.preferredRole !== 'hero') return concept
    return { ...concept, preferredRole: index === 0 ? 'hero' : 'support' }
  }
  return { version: 1, primary: normalizeRole(primary, 0), secondary: normalizeRole(secondary, 1), tertiary: normalizeRole(tertiary, 2) }
}
