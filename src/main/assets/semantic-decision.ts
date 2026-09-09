import {
  AssetIntentError,
  createAssetIntentV1,
  type AssetIntentV1,
} from '../../shared/asset-intent'
import {
  safeEditorialKeywordV2,
  selectNarrativeKeywordV2,
  withNarrativeKeywordEvidenceV2,
  type LocalSceneSemanticV1,
  type NarrativeKeywordSelectionV2,
} from '../../shared/local-scene-semantic'
import {
  AssetResolverError,
  resolveAndCompileVisualSceneV1,
  type ResolveSceneInputV1,
  type ResolverResultV1,
} from './asset-resolver'

export type LocalSemanticVisualDecisionInputV1 = Omit<ResolveSceneInputV1, 'intent' | 'localSemantic'> & {
  localSemantic: LocalSceneSemanticV1
  keywordCandidates?: readonly unknown[]
  preferredVisualMode?: 'asset-led' | 'editorial-text' | 'auto'
}

export type LocalSemanticVisualDecisionResultV1 = ResolverResultV1 & {
  localSemantic: LocalSceneSemanticV1
  keywordSelection: NarrativeKeywordSelectionV2
  inputFallback: { used: boolean; code: string | null }
}

function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code : 'UNKNOWN'
}

function intentFor(
  semantic: LocalSceneSemanticV1,
  keywordSelection: NarrativeKeywordSelectionV2,
  preferredVisualMode: 'asset-led' | 'editorial-text' | 'auto',
): AssetIntentV1 {
  const searchTerms = [semantic.anchor, ...semantic.concepts.map(concept => concept.label),
    ...semantic.directEvidence.map(evidence => evidence.query)]
  return createAssetIntentV1({
    sceneId: semantic.sceneId,
    phrase: semantic.localText,
    keyword: safeEditorialKeywordV2(keywordSelection, semantic),
    concepts: semantic.concepts.map(concept => concept.label),
    relation: semantic.relation,
    anchor: semantic.anchor,
    searchTerms,
    preferredVisualMode,
  })
}

function fallbackResult(
  input: LocalSemanticVisualDecisionInputV1,
  keywordSelection: NarrativeKeywordSelectionV2,
  code: string,
): LocalSemanticVisualDecisionResultV1 {
  // A caller can hand this boundary malformed external data. Bound it here as well as in the
  // extractor so the recovery path cannot repeat the same AssetIntent length failure.
  const boundedSemantic = {
    ...input.localSemantic,
    localText: input.localSemantic.localText.trim().slice(0, 360) || 'escena',
  }
  const semantic = withNarrativeKeywordEvidenceV2(boundedSemantic, safeEditorialKeywordV2(keywordSelection, boundedSemantic))
  const intent = intentFor(semantic, keywordSelection, 'editorial-text')
  const resolved = resolveAndCompileVisualSceneV1({ ...input, intent, localSemantic: semantic })
  const warning = {
    code: 'RESOLVER_DEGRADED' as const,
    severity: 'warning' as const,
    message: 'La entrada semántica no pudo convertirse en AssetIntent; se materializa texto editorial seguro.',
  }
  resolved.decision.alerts.push(warning)
  resolved.decision.reasons.unshift('ASSET_INTENT_INVALID_FALLBACK:' + code)
  resolved.trace.reasons.unshift('ASSET_INTENT_INVALID_FALLBACK:' + code)
  resolved.trace.fallback = 'ASSET_INTENT_INVALID_FALLBACK'
  return { ...resolved, localSemantic: semantic, keywordSelection, inputFallback: { used: true, code } }
}

/**
 * Single production entry point for localized semantic decisions. An invalid narrative input
 * becomes an explicit editorial SceneSpec; it is never converted back to legacy graphicData.
 */
export function resolveLocalSemanticVisualSceneV1(
  input: LocalSemanticVisualDecisionInputV1,
): LocalSemanticVisualDecisionResultV1 {
  const keywordSelection = selectNarrativeKeywordV2(input.localSemantic, input.keywordCandidates)
  const semantic = withNarrativeKeywordEvidenceV2(input.localSemantic, keywordSelection.keyword)
  try {
    const intent = intentFor(semantic, keywordSelection, input.preferredVisualMode ?? 'auto')
    const resolved = resolveAndCompileVisualSceneV1({ ...input, intent, localSemantic: semantic })
    if (keywordSelection.confidence === 'low') {
      resolved.decision.alerts.push({
        code: 'RESOLVER_DEGRADED',
        severity: 'warning',
        message: 'La keyword local tiene confianza baja; la decisión queda trazable para revisión.',
      })
      resolved.trace.reasons.push('LOW_CONFIDENCE_LOCAL_KEYWORD')
    }
    return { ...resolved, localSemantic: semantic, keywordSelection, inputFallback: { used: false, code: null } }
  } catch (error: unknown) {
    // Input and resolver failures are observable. The safe fallback compiles through the same
    // SceneSpec path, so the next hash is different from legacy rather than silently reusing it.
    const code = errorCode(error)
    if (!(error instanceof AssetIntentError) && !(error instanceof AssetResolverError)) {
      // Other failures still need the product's no-legacy guarantee, but retain their code.
      return fallbackResult(input, keywordSelection, code)
    }
    return fallbackResult(input, keywordSelection, code)
  }
}
