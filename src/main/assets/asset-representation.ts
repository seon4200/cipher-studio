import type { VisualConceptV1 } from '../../shared/visual-concepts'

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
  const subject = input.concept.subject
  if (subject === 'process' || subject === 'context' || subject === 'unknown' ||
      input.concept.preferredRole === 'editorial') {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'editorial',
      attemptOrder: Object.freeze(['editorial'] as const), cutoutEligible: false, fullRasterEligible: false,
      reason: 'REPRESENTATION_ABSTRACT_OR_CONTEXTUAL' })
  }
  if (subject === 'symbol') {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'symbolic',
      attemptOrder: Object.freeze(['symbolic', 'icon', 'editorial'] as const), cutoutEligible: false, fullRasterEligible: false,
      reason: 'REPRESENTATION_SYMBOLIC_CONCEPT' })
  }
  if (subject === 'place' || subject === 'event') {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'full-raster',
      attemptOrder: Object.freeze(['full-raster', 'icon', 'symbolic', 'editorial'] as const), cutoutEligible: false,
      fullRasterEligible: true, reason: 'REPRESENTATION_CONTEXT_RETAINS_MEANING' })
  }
  if (subject === 'person') {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'photo-cutout',
      attemptOrder: Object.freeze(['photo-cutout', 'full-raster', 'icon', 'symbolic', 'editorial'] as const),
      cutoutEligible: true, fullRasterEligible: true, reason: 'REPRESENTATION_PERSON_CUTOUT_PREFERRED' })
  }
  if (likelyAbstractNominalWithoutLiteralCue(input.concept)) {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'symbolic',
      attemptOrder: Object.freeze(['symbolic', 'icon', 'editorial'] as const), cutoutEligible: false,
      fullRasterEligible: false, reason: 'REPRESENTATION_ABSTRACT_NOMINAL_SYMBOL_OR_EDITORIAL' })
  }
  // An explicit emoji is direct evidence that the narration already has a compact, literal icon
  // representation.  It wins first for simple objects; a photo cutout still remains a valid
  // fallback when no defendible icon actually materialises.
  if (input.concept.emoji) {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'icon',
      attemptOrder: Object.freeze(['icon', 'photo-cutout', 'symbolic', 'full-raster', 'editorial'] as const),
      cutoutEligible: true, fullRasterEligible: true, reason: 'REPRESENTATION_EXPLICIT_EMOJI_ICON_FIRST' })
  }
  // `object` includes animals, tools, devices, vehicles, food and products.  Its exact resource
  // depends on the role: a primary physical subject can gain a real cutout, whereas supports do
  // not pay that cost when a literal icon already communicates the same idea.
  if (input.role === 'hero') {
    return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'auto',
      attemptOrder: Object.freeze(['photo-cutout', 'icon', 'symbolic', 'full-raster', 'editorial'] as const),
      cutoutEligible: true, fullRasterEligible: true, reason: 'REPRESENTATION_PHYSICAL_OBJECT_HERO_AUTO' })
  }
  return Object.freeze({ version: ASSET_REPRESENTATION_DECISION_VERSION, preference: 'auto',
    attemptOrder: Object.freeze(['icon', 'photo-cutout', 'symbolic', 'full-raster', 'editorial'] as const),
    cutoutEligible: true, fullRasterEligible: true, reason: 'REPRESENTATION_PHYSICAL_OBJECT_SUPPORT_AUTO' })
}
