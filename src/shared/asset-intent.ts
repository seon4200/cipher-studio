/**
 * Narrative-only input for the automatic visual resolver.
 *
 * This contract deliberately stops before provider, asset, bytes, treatment and geometry.
 * It is safe to persist as diagnostic input, but never belongs to PixelIdentity.
 */
export const ASSET_INTENT_VERSION = 1 as const

export type PreferredVisualModeV1 = 'asset-led' | 'editorial-text' | 'auto'

export type AssetIntentV1 = {
  version: typeof ASSET_INTENT_VERSION
  sceneId: string
  phrase?: string
  keyword: string
  concepts: string[]
  relation?: string
  anchor?: string
  searchTerms: string[]
  preferredVisualMode: PreferredVisualModeV1
}

export type AssetIntentInputV1 = {
  sceneId: unknown
  phrase?: unknown
  keyword: unknown
  concepts?: unknown
  relation?: unknown
  anchor?: unknown
  searchTerms?: unknown
  preferredVisualMode?: unknown
}

export class AssetIntentError extends Error {
  constructor(public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'AssetIntentError'
  }
}

function fail(code: string, message: string, details: Record<string, unknown> = {}): never {
  throw new AssetIntentError(code, message, details)
}

function text(value: unknown, field: string, required = false): string | undefined {
  if (value === undefined || value === null) {
    if (required) fail('ASSET_INTENT_INVALID', `${field} es obligatorio`)
    return undefined
  }
  if (typeof value !== 'string') {
    if (required) fail('ASSET_INTENT_INVALID', `${field} debe ser texto`)
    return undefined
  }
  const clean = value.trim().replace(/\s+/g, ' ')
  if (!clean) {
    if (required) fail('ASSET_INTENT_INVALID', `${field} no puede estar vacío`)
    return undefined
  }
  if (clean.length > 480) fail('ASSET_INTENT_INVALID', `${field} supera el límite V1`)
  return clean
}

function termFromUnknown(value: unknown): string | undefined {
  if (typeof value === 'string') return text(value, 'término')
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  try {
    const source = value as Record<string, unknown>
    return text(source.etiqueta ?? source.label ?? source.icono ?? source.name, 'término')
  } catch {
    return undefined
  }
}

function terms(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) fail('ASSET_INTENT_INVALID', `${field} debe ser una lista`)
  const unique = new Map<string, string>()
  for (const candidate of value) {
    const current = termFromUnknown(candidate)
    if (!current) continue
    const key = canonicalNarrativeTerm(current)
    if (key && !unique.has(key)) unique.set(key, current)
  }
  return [...unique.values()].slice(0, 12)
}

/** Accent/case-insensitive matching for controlled resolver rules, never for asset identity. */
export function canonicalNarrativeTerm(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function preferredMode(value: unknown): PreferredVisualModeV1 {
  if (value === undefined || value === null || value === '') return 'auto'
  if (value === 'asset-led' || value === 'editorial-text' || value === 'auto') return value
  fail('ASSET_INTENT_INVALID', 'preferredVisualMode no pertenece al vocabulario V1', { value })
}

/**
 * Creates the only resolver input from existing generation semantics.
 * It does not invent narrative terms, call an AI, or derive a visual decision.
 */
export function createAssetIntentV1(input: AssetIntentInputV1): AssetIntentV1 {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    fail('ASSET_INTENT_INVALID', 'La entrada del AssetIntent debe ser un objeto')
  const sceneId = text(input.sceneId, 'sceneId', true)!
  const keyword = text(input.keyword, 'keyword', true)!
  const phrase = text(input.phrase, 'phrase')
  const concepts = terms(input.concepts, 'concepts')
  const relation = text(input.relation, 'relation')
  const anchor = termFromUnknown(input.anchor)
  const suppliedSearchTerms = terms(input.searchTerms, 'searchTerms')
  const allTerms = [anchor, keyword, ...concepts, ...suppliedSearchTerms]
  const uniqueTerms = new Map<string, string>()
  for (const candidate of allTerms) {
    if (!candidate) continue
    const key = canonicalNarrativeTerm(candidate)
    if (key && !uniqueTerms.has(key)) uniqueTerms.set(key, candidate)
  }
  return {
    version: ASSET_INTENT_VERSION,
    sceneId,
    ...(phrase ? { phrase } : {}),
    keyword,
    concepts,
    ...(relation ? { relation } : {}),
    ...(anchor ? { anchor } : {}),
    searchTerms: [...uniqueTerms.values()].slice(0, 12),
    preferredVisualMode: preferredMode(input.preferredVisualMode),
  }
}
