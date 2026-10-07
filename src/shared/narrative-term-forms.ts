import { canonicalNarrativeTerm } from './asset-intent'

/**
 * Small, deterministic inflection bridge for retrieval evidence. It is deliberately not a
 * linguistic parser: it only lets local singular/plural narration and structured concepts
 * recognise one another before provider-specific search begins.
 */
export function narrativeTermFormsV1(value: unknown): readonly string[] {
  const normalized = canonicalNarrativeTerm(String(value ?? ''))
  if (!normalized) return []
  const forms = new Set<string>([normalized])
  if (normalized.endsWith('ies') && normalized.length > 4) forms.add(normalized.slice(0, -3) + 'y')
  if (normalized.endsWith('es') && normalized.length > 4) forms.add(normalized.slice(0, -2))
  if (normalized.endsWith('s') && normalized.length > 3) forms.add(normalized.slice(0, -1))
  return Object.freeze([...forms].filter(Boolean))
}

export function narrativeTermsEquivalentV1(left: unknown, right: unknown): boolean {
  const leftForms = narrativeTermFormsV1(left)
  const rightForms = new Set(narrativeTermFormsV1(right))
  return leftForms.some(form => rightForms.has(form))
}
