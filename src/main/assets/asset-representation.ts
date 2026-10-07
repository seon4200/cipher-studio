import type { VisualConceptV1 } from '../../shared/visual-concepts'
import { expandConceptLexiconV1 } from '../../shared/concept-lexicon'
import { searchOpenMoji } from './openmoji/catalog'

/**
 * The representation choice is a retrieval/materialisation preference, never a pixel contract.
 * SceneSpec persists the resulting bytes, geometry and treatment instead.  This keeps a future
 * local cutout library or 3D asset class behind the same decision boundary.
 */
export const ASSET_REPRESENTATION_DECISION_VERSION = 1 as const

export type AssetRepresentationPreferenceV1 =
  | 'photo-cutout'
  | 'full-raster'
  | 'icon'
  | 'symbolic'
  | 'editorial'
  | 'auto'

export type AssetRepresentationDecisionV1 = {
  version: typeof ASSET_REPRESENTATION_DECISION_VERSION
  preference: AssetRepresentationPreferenceV1
  attemptOrder: readonly Exclude<AssetRepresentationPreferenceV1, 'auto'>[]
  cutoutEligible: boolean
  fullRasterEligible: boolean
  reason: string
}

// A structured noun can still describe an abstract decision, relationship or quality even when
// the upstream subject classifier has to conservatively call it `object`.  We do not rewrite the
// concept or keyword here; we merely prevent an opaque stock-photo query from pretending that a
// non-physical noun is a cutout candidate. Explicit emoji, person/place/event/symbol subjects
// continue through their more specific branches above.
function likelyAbstractNominalWithoutLiteralCue(concept: VisualConceptV1): boolean {
  if (concept.emoji || concept.subject !== 'object') return false
  return /(?:cion|sion|dad|encia|miento|ismo|idad)$/u.test(concept.normalizedTerm)
}

const PHYSICAL_SUBJECTS = new Set<VisualConceptV1['subject']>(['person', 'object', 'place', 'event'])

function firstLexiconSubject(
  values: readonly string[],
  levels: ReadonlySet<'exact' | 'synonym' | 'related' | 'context'>,
): VisualConceptV1['subject'] | null {
  for (const value of values) {
    const expansion = expandConceptLexiconV1(value).find(item => levels.has(item.level))
    if (expansion) return expansion.entry.subject
  }
  return null
}

function isPhysicalSubject(subject: VisualConceptV1['subject'] | null): subject is 'person' | 'object' | 'place' | 'event' {
  return !!subject && PHYSICAL_SUBJECTS.has(subject)
}

function emojiCatalogClassification(concept: VisualConceptV1): { group: string; subgroup: string } | null {
  if (!concept.emoji) return null
  try {
    const match = searchOpenMoji(concept.emoji, { limit: 1 })[0]
    return match?.matchReason === 'emoji-exact' && match.entry.group && match.entry.subgroup
      ? { group: match.entry.group, subgroup: match.entry.subgroup }
      : null
  } catch {
    // Representation evidence is optional. A missing local catalogue must not create a raster
    // route, nor may it break the existing icon/Solar fallback.
    return null
  }
}

/**
 * Resolves representation evidence without rewriting the narrative subject. Direct ES/EN
 * lexical evidence owns the decision. A people emoji is independently strong enough to prove a
 * person; other emoji groups require a compatible canonical hint so a metaphorical flame/heart
 * does not silently turn an abstract concept into a stock-photo request.
 */
function representationSubject(concept: VisualConceptV1): VisualConceptV1['subject'] | null {
  const direct = firstLexiconSubject([concept.normalizedTerm, concept.originalTerm], new Set(['exact', 'synonym']))
  if (direct) return direct

  const emojiClass = emojiCatalogClassification(concept)
  // A literal person or profession is strong evidence. Body parts, generic silhouettes and
  // activities remain hints: otherwise “cognitivo”+brain or “vacía”+walking person would open a
  // portrait search even though the structured concept itself is not a person.
  if (emojiClass?.group === 'people-body' &&
      (emojiClass.subgroup === 'person' || emojiClass.subgroup === 'person-role')) return 'person'

  const aliases = concept.aliases.filter(value => value !== concept.originalTerm && value !== concept.normalizedTerm)
  const hint = firstLexiconSubject(aliases, new Set(['exact', 'synonym', 'related']))
  const emoji = concept.emoji
    ? firstLexiconSubject([concept.emoji], new Set(['exact', 'synonym']))
    : null
  if (!isPhysicalSubject(hint) || !isPhysicalSubject(emoji)) return null
  if (hint === emoji) return hint
  if (hint === 'person' || emoji === 'person') return null
  // Object/place/event differences are normal for a physical subject and its context hint
  // (construction crane/building, phone/screen). Prefer the textual hint when both are physical.
  return hint
}

/**
 * `object` is a historical broad default, not proof of a physical subject.  A real-photo route
 * requires either a lexicon-backed physical class or Hygiene's concrete lexical evidence.
 */
function hasConcretePhysicalRepresentationEvidence(concept: VisualConceptV1): boolean {
  const lexiconSubject = representationSubject(concept)
  if (isPhysicalSubject(lexiconSubject)) return true
  if (concept.subject === 'person') return true
  return concept.subject === 'object' && concept.hygiene?.visuality === 'concrete-visual'
}

/**
 * Chooses a resource *class*, not a particular provider result.  The resolver still requires a
 * semantically ranked candidate and can promote another concept from the same scene.  Physical
 * objects remain AUTO: heroes may try a cutout first, while supports retain the faster literal
 * icon route when it is equally suitable.
 */
export function resolveAssetRepresentationPreferenceV1(input: {
  concept: VisualConceptV1
  role: 'hero' | 'support-1' | 'support-2'
}): AssetRepresentationDecisionV1 {
  // Subject/provenance remain whatever Visual Retrieval produced. Lexicon is consulted below
  // only as evidence of physicality; it does not rewrite the concept at this decision boundary.
  const subject = input.concept.subject
  const hygiene = input.concept.hygiene
  // Concept Hygiene is the authority before retrieval. A word that did not earn visual-subject
  // status must never inherit the old default `object → photo` route.
  if (hygiene?.eligibility === 'not-visual') {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'editorial',
      attemptOrder: Object.freeze(['editorial'] as const), cutoutEligible: false, fullRasterEligible: false,
      reason: `REPRESENTATION_CONCEPT_${hygiene.visuality.toUpperCase().replace(/-/g, '_')}_NOT_VISUAL` })
  }
  // A support-only action/abstraction is allowed to look for an honest local symbol, but it may
  // not become a stock-photo/cutout Hero through lexical coincidence alone.
  if (hygiene?.eligibility === 'support-only' && input.role === 'hero') {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'editorial',
      attemptOrder: Object.freeze(['editorial'] as const), cutoutEligible: false, fullRasterEligible: false,
      reason: 'REPRESENTATION_CONCEPT_SUPPORT_ONLY_NOT_HERO' })
  }
  if (hygiene?.visuality === 'visual-action-with-context') {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'symbolic',
      attemptOrder: Object.freeze(['icon', 'symbolic', 'editorial'] as const), cutoutEligible: false, fullRasterEligible: false,
      reason: 'REPRESENTATION_ACTION_CONTEXT_LOCAL_SYMBOL_ONLY' })
  }
  if (hygiene?.visuality === 'abstract-symbolic') {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'symbolic',
      attemptOrder: Object.freeze(['symbolic', 'icon', 'editorial'] as const), cutoutEligible: false, fullRasterEligible: false,
      reason: 'REPRESENTATION_ABSTRACT_SYMBOLIC_NO_RASTER' })
  }
  // Direct provider evidence is an explicit route, not a semantic emoji hint. Keep it ahead of
  // all inferred physical evidence so an OpenMoji hexcode never becomes a photo opportunity.
  if (input.concept.hygieneAuthority === 'explicit-visual-evidence') {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'icon',
      attemptOrder: Object.freeze(['icon', 'symbolic', 'editorial'] as const),
      cutoutEligible: false, fullRasterEligible: false, reason: 'REPRESENTATION_DIRECT_ICON_EVIDENCE' })
  }
  const inferredSubject = representationSubject(input.concept)
  // The broad historical `object` subject may be refined only when the evidence proves a
  // physical representation. A symbolic lexicon match must not rewrite a structured object:
  // its existing emoji/icon fallback remains authoritative (for example message + speech icon).
  const representationSubjectValue = subject === 'object' && isPhysicalSubject(inferredSubject) ? inferredSubject : subject
  if (subject === 'process' || subject === 'context' || subject === 'unknown' ||
      input.concept.preferredRole === 'editorial') {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'editorial',
      attemptOrder: Object.freeze(['editorial'] as const), cutoutEligible: false, fullRasterEligible: false,
      reason: 'REPRESENTATION_ABSTRACT_OR_CONTEXTUAL' })
  }
  if (representationSubjectValue === 'symbol') {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'symbolic',
      attemptOrder: Object.freeze(['symbolic', 'icon', 'editorial'] as const), cutoutEligible: false, fullRasterEligible: false,
      reason: 'REPRESENTATION_SYMBOLIC_CONCEPT' })
  }
  if (representationSubjectValue === 'place' || representationSubjectValue === 'event') {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'full-raster',
      attemptOrder: Object.freeze(['full-raster', 'icon', 'symbolic', 'editorial'] as const), cutoutEligible: false,
      fullRasterEligible: true, reason: 'REPRESENTATION_CONTEXT_RETAINS_MEANING' })
  }
  if (representationSubjectValue === 'person') {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'photo-cutout',
      attemptOrder: Object.freeze(['photo-cutout', 'full-raster', 'icon', 'symbolic', 'editorial'] as const),
      cutoutEligible: true, fullRasterEligible: true, reason: 'REPRESENTATION_PERSON_CUTOUT_PREFERRED' })
  }
  if (likelyAbstractNominalWithoutLiteralCue(input.concept)) {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'symbolic',
      attemptOrder: Object.freeze(['symbolic', 'icon', 'editorial'] as const), cutoutEligible: false,
      fullRasterEligible: false, reason: 'REPRESENTATION_ABSTRACT_NOMINAL_SYMBOL_OR_EDITORIAL' })
  }
  const physical = hasConcretePhysicalRepresentationEvidence(input.concept)
  // DeepSeek/local semantics may attach an emoji as a compact clue for a physical concept. That
  // clue remains a valid icon fallback, but it is not a user command to skip a real-photo option.
  if (input.concept.emoji && physical) {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'photo-cutout',
      attemptOrder: Object.freeze(['photo-cutout', 'icon', 'symbolic', 'full-raster', 'editorial'] as const),
      cutoutEligible: true, fullRasterEligible: true,
      reason: 'REPRESENTATION_PHYSICAL_CONCEPT_WITH_SEMANTIC_EMOJI_HINT' })
  }
  // Non-physical emoji evidence remains an icon/symbol route. It never creates a photo query on
  // its own, and therefore cannot turn a symbol or an unknown noun into decorative stock imagery.
  if (input.concept.emoji) {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'icon',
      attemptOrder: Object.freeze(['icon', 'symbolic', 'editorial'] as const),
      cutoutEligible: false, fullRasterEligible: false, reason: 'REPRESENTATION_SEMANTIC_EMOJI_ICON_FIRST' })
  }
  // `object` includes animals, tools, devices, vehicles, food and products.  Its exact resource
  // depends on the role: a primary physical subject can gain a real cutout, whereas supports do
  // not pay that cost when a literal icon already communicates the same idea.
  if (physical) {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'auto',
      attemptOrder: Object.freeze(['photo-cutout', 'icon', 'symbolic', 'full-raster', 'editorial'] as const),
      cutoutEligible: true, fullRasterEligible: true,
      reason: input.role === 'hero' ? 'REPRESENTATION_PHYSICAL_OBJECT_HERO_AUTO' : 'REPRESENTATION_PHYSICAL_OBJECT_SUPPORT_AUTO' })
  }
  // A broad structured noun that is not backed by a physical lexicon class must not inherit the
  // historical object→photo default. Local symbolic candidates may still represent it honestly.
  return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'auto',
    attemptOrder: Object.freeze(['icon', 'symbolic', 'editorial'] as const),
    cutoutEligible: false, fullRasterEligible: false, reason: 'REPRESENTATION_OBJECT_WITHOUT_PHYSICAL_EVIDENCE' })
}
