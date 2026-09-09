import { canonicalNarrativeTerm } from './asset-intent'

/**
 * Contexto narrativo localizado de un subclip. No describe proveedores, bytes ni píxeles.
 * `globalText` se conserva sólo como apoyo/diagnóstico: la decisión visual nunca lo usa como
 * señal primaria cuando existe `localText`.
 */
export const LOCAL_SCENE_SEMANTIC_VERSION = 1 as const
export const LOCAL_SCENE_TEXT_MAX_CHARS_V1 = 360

export type LocalSceneTokenV1 = {
  text: string
  start: number
  end: number
  confidence?: number
}

export type LocalSceneConceptV1 = {
  label: string
  emoji?: string
  canonicalHint?: string
}

export type DirectConcreteEvidenceV1 = {
  source: 'emoji' | 'label' | 'anchor' | 'canonical-hint' | 'keyword'
  query: string
  label?: string
  emoji?: string
  canonicalHint?: string
  relevance: 'anchor' | 'keyword' | 'concept' | 'context'
}

export type LocalSceneSemanticV1 = {
  version: typeof LOCAL_SCENE_SEMANTIC_VERSION
  sceneId: string
  start: number
  end: number
  localText: string
  localTokens: LocalSceneTokenV1[]
  concepts: LocalSceneConceptV1[]
  anchor?: string
  relation?: string
  globalText?: string
  globalHints: string[]
  globalContextRef?: string
  directEvidence: DirectConcreteEvidenceV1[]
}

export type NarrativeKeywordAlternativeV2 = {
  keyword: string
  visualizability: 0 | 1 | 2 | 3
  source: 'anchor' | 'concept' | 'candidate' | 'local-token'
  reason: string
}

export type NarrativeKeywordSelectionV2 = {
  keyword: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
  alternatives: NarrativeKeywordAlternativeV2[]
}

export type CreateLocalSceneSemanticInputV1 = {
  sceneId: unknown
  start: unknown
  end: unknown
  transcriptSegments?: unknown
  concepts?: unknown
  anchor?: unknown
  relation?: unknown
  globalText?: unknown
  globalHints?: unknown
  globalContextRef?: unknown
}

type TimedWord = LocalSceneTokenV1 & { order: number }

const MAX_CONCEPTS = 12
const MAX_DIRECT_EVIDENCE = 24
const MAX_KEYWORD_ALTERNATIVES = 8
const CONTEXT_SECONDS = .45
const CONTEXT_TOKEN_MARGIN = 5

const AUXILIARY_OR_RESIDUAL = new Set([
  'a', 'al', 'ante', 'como', 'con', 'contra', 'de', 'del', 'desde', 'el', 'ella', 'ellos', 'en',
  'entre', 'es', 'esa', 'ese', 'esta', 'estaba', 'estando', 'estar', 'estas', 'este', 'esto',
  'fue', 'ha', 'habia', 'haber', 'hay', 'la', 'las', 'le', 'les', 'lo', 'los', 'me', 'mi',
  'no', 'nos', 'o', 'para', 'pero', 'por', 'que', 'se', 'ser', 'si', 'sin', 'su', 'sus', 'te',
  'tiene', 'todo', 'un', 'una', 'uno', 'y', 'ya', 'llevaba', 'llevar', 'perfecto', 'importante',
  'bellisimo', 'posible', 'siguiente', 'obligando', 'inaccesibles', 'mundialista', 'deja', 'dejar',
  'cree', 'creer', 'hace', 'hacer', 'sufre', 'sufrir', 'otro', 'otra', 'donde', 'dónde', 'ahi', 'ahí',
  'alli', 'allí', 'aqui', 'aquí', 'aun', 'aún', 'mas', 'más', 'analogia', 'analogía', 'ir', 'va', 'van', 've', 'ven',
  'vive', 'viven',
])

const GENERIC_HUMAN_TERMS = new Set([
  'persona', 'personas', 'gente', 'hombre', 'mujer', 'religioso', 'multitud', 'aficion',
  'people', 'person', 'crowd', 'human',
])

// Contextual nouns and bare infinitives often occur inside a clause but are not its drawable
// subject. They are deliberately lower confidence than an object/entity in the same timed span.
// This is a linguistic class, not a list of forensic scene IDs.
const CONTEXTUAL_OR_DISCOURSE_TERMS = new Set([
  'aqui', 'ahora', 'ano', 'anos', 'año', 'años', 'cosa', 'cosas', 'fifa', 'forma', 'mismo',
  'momento', 'mundial', 'mundo', 'pais', 'país', 'paises', 'países', 'parte', 'poder', 'tema', 'tiempo', 'vez', 'veces',
  'cabrón', 'cabron', 'chupé', 'chupe', 'par',
])

function fail(message: string): never {
  const error = new Error(message)
  error.name = 'LocalSceneSemanticError'
  throw error
}

function cleanText(value: unknown, field: string, max = LOCAL_SCENE_TEXT_MAX_CHARS_V1): string | undefined {
  void field
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') return undefined
  const clean = value.trim().replace(/\s+/g, ' ')
  if (!clean) return undefined
  if (clean.length > max) return clean.slice(0, max).trim()
  return clean
}

function requiredText(value: unknown, field: string, max = LOCAL_SCENE_TEXT_MAX_CHARS_V1): string {
  const clean = cleanText(value, field, max)
  if (!clean) fail(field + ' es obligatorio')
  return clean
}

function finite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(field + ' debe ser finito')
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function conceptFromUnknown(value: unknown): LocalSceneConceptV1 | null {
  if (typeof value === 'string') {
    const label = cleanText(value, 'concepto', 120)
    return label ? { label } : null
  }
  if (!isRecord(value)) return null
  const label = cleanText(value.etiqueta ?? value.label ?? value.name, 'concepto', 120)
  const canonicalHint = cleanText(value.canonicalHint ?? value.icono ?? value.hint, 'canonicalHint', 120)
  const emoji = cleanText(value.emoji, 'emoji', 32)
  if (!label && !canonicalHint) return null
  return {
    label: label ?? canonicalHint!,
    ...(emoji ? { emoji } : {}),
    ...(canonicalHint ? { canonicalHint } : {}),
  }
}

function normalizeConcepts(value: unknown): LocalSceneConceptV1[] {
  if (!Array.isArray(value)) return []
  const unique = new Map<string, LocalSceneConceptV1>()
  for (const raw of value) {
    const concept = conceptFromUnknown(raw)
    if (!concept) continue
    const key = [canonicalNarrativeTerm(concept.label), concept.emoji ?? '', canonicalNarrativeTerm(concept.canonicalHint)].join('|')
    if (key !== '||' && !unique.has(key)) unique.set(key, concept)
    if (unique.size >= MAX_CONCEPTS) break
  }
  return [...unique.values()]
}

function wordsFromSegments(value: unknown): TimedWord[] {
  if (!Array.isArray(value)) return []
  const words: TimedWord[] = []
  let order = 0
  for (const segment of value) {
    if (!isRecord(segment)) continue
    const segmentStart = typeof segment.start === 'number' ? segment.start : undefined
    const segmentEnd = typeof segment.end === 'number' ? segment.end : undefined
    const rawWords = Array.isArray(segment.words) ? segment.words : []
    if (rawWords.length) {
      for (const rawWord of rawWords) {
        if (!isRecord(rawWord)) continue
        const text = cleanText(rawWord.word ?? rawWord.text, 'word', 120)
        const start = typeof rawWord.start === 'number' ? rawWord.start : undefined
        const end = typeof rawWord.end === 'number' ? rawWord.end : undefined
        if (!text || start === undefined || end === undefined || !Number.isFinite(start) || !Number.isFinite(end) || end < start) continue
        const confidence = typeof rawWord.probability === 'number' && Number.isFinite(rawWord.probability)
          ? rawWord.probability : undefined
        words.push({ text, start, end, ...(confidence === undefined ? {} : { confidence }), order: order++ })
      }
      continue
    }
    const segmentText = cleanText(segment.text, 'segment.text', 480)
    if (!segmentText || segmentStart === undefined || segmentEnd === undefined || segmentEnd < segmentStart) continue
    const tokens = segmentText.split(/\s+/).filter(Boolean)
    const span = Math.max(.001, segmentEnd - segmentStart)
    for (let index = 0; index < tokens.length; index++) {
      const start = segmentStart + span * index / tokens.length
      const end = segmentStart + span * (index + 1) / tokens.length
      words.push({ text: tokens[index], start, end, order: order++ })
    }
  }
  const seen = new Set<string>()
  return words.sort((a, b) => a.start - b.start || a.end - b.end || a.order - b.order)
    .filter(word => {
      const key = [word.start.toFixed(4), word.end.toFixed(4), canonicalNarrativeTerm(word.text)].join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function isBoundary(word: TimedWord | undefined): boolean {
  return !!word && /[.!?;:…]$/.test(word.text.trim())
}

function boundedText(tokens: readonly LocalSceneTokenV1[]): { text: string; tokens: LocalSceneTokenV1[] } {
  const selected: LocalSceneTokenV1[] = []
  let text = ''
  for (const token of tokens) {
    const candidate = (text ? text + ' ' : '') + token.text.trim()
    if (candidate.length > LOCAL_SCENE_TEXT_MAX_CHARS_V1) break
    text = candidate
    selected.push(token)
  }
  return { text: text.trim(), tokens: selected }
}

function localWindow(words: readonly TimedWord[], start: number, end: number): { text: string; tokens: LocalSceneTokenV1[] } {
  if (!words.length) return { text: '', tokens: [] }
  const overlapping = words.map((word, index) => ({ word, index }))
    .filter(({ word }) => word.end >= start && word.start <= end)
  let first: number
  let last: number
  if (overlapping.length) {
    first = overlapping[0].index
    last = overlapping[overlapping.length - 1].index
  } else {
    const midpoint = (start + end) / 2
    let nearest = 0
    let distance = Number.POSITIVE_INFINITY
    words.forEach((word, index) => {
      const d = Math.abs((word.start + word.end) / 2 - midpoint)
      if (d < distance) { distance = d; nearest = index }
    })
    first = nearest
    last = nearest
  }
  const lower = start - CONTEXT_SECONDS
  const upper = end + CONTEXT_SECONDS
  let left = first
  let right = last
  while (left > 0 && first - left < CONTEXT_TOKEN_MARGIN && words[left - 1].end >= lower && !isBoundary(words[left - 1])) left--
  while (right + 1 < words.length && right - last < CONTEXT_TOKEN_MARGIN && words[right + 1].start <= upper && !isBoundary(words[right])) right++
  const tokens = words.slice(left, right + 1).map(({ text, start, end, confidence }) => ({ text, start, end, ...(confidence === undefined ? {} : { confidence }) }))
  return boundedText(tokens)
}

function normalizedHints(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const unique = new Map<string, string>()
  for (const raw of value) {
    const clean = cleanText(raw, 'globalHint', 120)
    if (!clean) continue
    const key = canonicalNarrativeTerm(clean)
    if (key && !unique.has(key)) unique.set(key, clean)
  }
  return [...unique.values()].slice(0, 12)
}

function relevanceFor(label: string, anchor: string | undefined, keyword: string | undefined): DirectConcreteEvidenceV1['relevance'] {
  const canonical = canonicalNarrativeTerm(label)
  if (anchor && canonical && canonical === canonicalNarrativeTerm(anchor)) return 'anchor'
  if (keyword && canonical && canonical === canonicalNarrativeTerm(keyword)) return 'keyword'
  return 'concept'
}

function directEvidence(concepts: readonly LocalSceneConceptV1[], anchor: string | undefined, keyword: string | undefined): DirectConcreteEvidenceV1[] {
  const entries: DirectConcreteEvidenceV1[] = []
  const add = (entry: DirectConcreteEvidenceV1) => {
    const query = cleanText(entry.query, 'evidence.query', 120)
    if (!query) return
    entries.push({ ...entry, query })
  }
  for (const concept of concepts) {
    const relevance = relevanceFor(concept.label, anchor, keyword)
    if (concept.emoji) add({ source: 'emoji', query: concept.emoji, label: concept.label, emoji: concept.emoji,
      ...(concept.canonicalHint ? { canonicalHint: concept.canonicalHint } : {}), relevance })
    add({ source: 'label', query: concept.label, label: concept.label,
      ...(concept.emoji ? { emoji: concept.emoji } : {}),
      ...(concept.canonicalHint ? { canonicalHint: concept.canonicalHint } : {}), relevance })
    if (concept.canonicalHint) add({ source: 'canonical-hint', query: concept.canonicalHint, label: concept.label,
      ...(concept.emoji ? { emoji: concept.emoji } : {}), canonicalHint: concept.canonicalHint, relevance })
  }
  if (anchor) add({ source: 'anchor', query: anchor, label: anchor, relevance: 'anchor' })
  if (keyword) add({ source: 'keyword', query: keyword, label: keyword, relevance: 'keyword' })
  const unique = new Map<string, DirectConcreteEvidenceV1>()
  for (const entry of entries) {
    const key = entry.source + '|' + canonicalNarrativeTerm(entry.query) + '|' + (entry.emoji ?? '')
    if (!unique.has(key)) unique.set(key, entry)
  }
  return [...unique.values()].slice(0, MAX_DIRECT_EVIDENCE)
}

/** Extracts a bounded clause around a real subclip window; it never copies a global paragraph into AssetIntent. */
export function createLocalSceneSemanticV1(input: CreateLocalSceneSemanticInputV1): LocalSceneSemanticV1 {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Entrada LocalSceneSemanticV1 inválida')
  const sceneId = requiredText(input.sceneId, 'sceneId', 160)
  const start = finite(input.start, 'start')
  const end = finite(input.end, 'end')
  if (end < start) fail('end no puede ser anterior a start')
  const concepts = normalizeConcepts(input.concepts)
  const anchor = cleanText(input.anchor, 'anchor', 120)
  const relation = cleanText(input.relation, 'relation', 120)
  const globalText = cleanText(input.globalText, 'globalText', 4000)
  const globalHints = normalizedHints(input.globalHints)
  const globalContextRef = cleanText(input.globalContextRef, 'globalContextRef', 160)
  const words = wordsFromSegments(input.transcriptSegments)
  const window = localWindow(words, start, end)
  const localText = window.text || cleanText(input.globalText, 'globalText', LOCAL_SCENE_TEXT_MAX_CHARS_V1) || anchor || concepts[0]?.label || 'escena'
  return {
    version: LOCAL_SCENE_SEMANTIC_VERSION,
    sceneId,
    start,
    end,
    localText,
    localTokens: window.tokens,
    concepts,
    ...(anchor ? { anchor } : {}),
    ...(relation ? { relation } : {}),
    ...(globalText ? { globalText } : {}),
    globalHints,
    ...(globalContextRef ? { globalContextRef } : {}),
    directEvidence: directEvidence(concepts, anchor, undefined),
  }
}

/** Adds the selected local keyword as low-level evidence without letting global text rewrite the scene. */
export function withNarrativeKeywordEvidenceV2(
  semantic: LocalSceneSemanticV1,
  keyword: string,
): LocalSceneSemanticV1 {
  const normalizedKeyword = cleanText(keyword, 'keyword', 120)
  if (!normalizedKeyword) return semantic
  const evidence = directEvidence(semantic.concepts, semantic.anchor, normalizedKeyword)
  return { ...semantic, directEvidence: evidence }
}

function visualizability(value: string): 0 | 1 | 2 | 3 {
  const canonical = canonicalNarrativeTerm(value)
  if (!canonical || /^\d+$/.test(canonical) || AUXILIARY_OR_RESIDUAL.has(canonical)) return 0
  if (GENERIC_HUMAN_TERMS.has(canonical) || CONTEXTUAL_OR_DISCOURSE_TERMS.has(canonical)) return 1
  // Spanish nominal concepts ending in -ción/-sión/-ismo can be visualized editorially;
  // they are not residual merely because of their morphology. Adverbs and verb forms remain
  // lower-confidence unless structured evidence says otherwise.
  if (/(?:mente|idad|ar|er|ir|ando|iendo)$/.test(canonical)) return 1
  return 2
}

function localTokenScore(token: LocalSceneTokenV1): 0 | 1 | 2 | 3 {
  // A low-confidence ASR word can remain observable, but cannot outrank a structured object
  // merely because it is long or unusual.
  if (typeof token.confidence === 'number' && token.confidence < .85) return Math.min(1, visualizability(token.text)) as 0 | 1
  // A bare proper noun in ASR text is context (country, institution, brand) until the
  // structured concepts/anchor corroborate it. This stops it pre-empting a drawable object
  // later in the same local clause, while a flag/entity concept remains strong evidence.
  if (/^[A-ZÁÉÍÓÚÜÑ][\p{L}\p{M}]+$/u.test(token.text.trim())) return Math.min(1, visualizability(token.text)) as 0 | 1
  return visualizability(token.text)
}

function isConcreteConcept(concept: LocalSceneConceptV1): boolean {
  return !!concept.emoji || !!concept.canonicalHint
}

/**
 * Chooses a local narrative keyword by visualizability and structured semantic evidence.
 * It intentionally rejects the former "longest illustrative token" heuristic.
 */
export function selectNarrativeKeywordV2(
  semantic: LocalSceneSemanticV1,
  candidates: readonly unknown[] = [],
): NarrativeKeywordSelectionV2 {
  const alternatives: NarrativeKeywordAlternativeV2[] = []
  const localAlternatives: NarrativeKeywordAlternativeV2[] = []
  const add = (keyword: unknown, source: NarrativeKeywordAlternativeV2['source'], score: 0 | 1 | 2 | 3, reason: string) => {
    const clean = cleanText(keyword, 'keyword', 120)
    if (!clean) return
    const entry = { keyword: clean, source, visualizability: score, reason }
    alternatives.push(entry)
    if (source === 'local-token') localAlternatives.push(entry)
  }
  if (semantic.anchor) {
    const matching = semantic.concepts.find(concept => canonicalNarrativeTerm(concept.label) === canonicalNarrativeTerm(semantic.anchor))
    add(semantic.anchor, 'anchor', matching && isConcreteConcept(matching) ? 3 : 2,
      matching ? 'ANCHOR_CONCEPT_EVIDENCE' : 'STRUCTURED_ANCHOR')
  }
  for (const concept of semantic.concepts) {
    add(concept.label, 'concept', isConcreteConcept(concept) ? 3 : visualizability(concept.label),
      isConcreteConcept(concept) ? 'CONCEPT_CONCRETE_EVIDENCE' : 'CONCEPT_LABEL')
  }
  for (const candidate of candidates) add(candidate, 'candidate', visualizability(String(candidate ?? '')), 'EXISTING_KEYWORD_CANDIDATE')
  for (const token of semantic.localTokens) add(token.text, 'local-token', localTokenScore(token), 'TIMED_LOCAL_TOKEN')
  if (!alternatives.length) add('escena', 'local-token', 0, 'NO_LOCAL_TOKEN')
  const deduped = new Map<string, NarrativeKeywordAlternativeV2>()
  const sourcePriority: Record<NarrativeKeywordAlternativeV2['source'], number> = {
    'local-token': 0, anchor: 1, concept: 2, candidate: 3,
  }
  for (const alternative of alternatives) {
    const key = canonicalNarrativeTerm(alternative.keyword)
    const current = deduped.get(key)
    if (!current || alternative.visualizability > current.visualizability ||
      (alternative.visualizability === current.visualizability && sourcePriority[alternative.source] < sourcePriority[current.source])) {
      deduped.set(key, alternative)
    }
  }
  const ordered = [...deduped.values()].sort((a, b) => b.visualizability - a.visualizability ||
    sourcePriority[a.source] - sourcePriority[b.source] ||
    canonicalNarrativeTerm(a.keyword).localeCompare(canonicalNarrativeTerm(b.keyword), 'es'))
  // The local timed span is the primary authority. A concrete old concept is useful only when
  // the span itself has no visualizable subject; otherwise a paragraph-level semantic label can
  // leak from an adjacent subclip and overwrite the scene being rendered.
  const localWinner = localAlternatives.filter(candidate => candidate.visualizability >= 2)
    .sort((a, b) => b.visualizability - a.visualizability)[0]
  const winner = localWinner ?? ordered[0]
  const confidence = winner.visualizability >= 3 ? 'high' : winner.visualizability === 2 ? 'medium' : 'low'
  return {
    keyword: winner.keyword,
    confidence,
    reason: winner.reason,
    alternatives: ordered.slice(0, MAX_KEYWORD_ALTERNATIVES),
  }
}

/** Stable fallback text for a malformed input; it is editorial-only, never legacy. */
export function safeEditorialKeywordV2(selection: NarrativeKeywordSelectionV2, semantic: LocalSceneSemanticV1): string {
  const selected = cleanText(selection.keyword, 'keyword', 80)
  if (selected) return selected
  const anchor = cleanText(semantic.anchor, 'anchor', 80)
  if (anchor) return anchor
  return 'contexto'
}
