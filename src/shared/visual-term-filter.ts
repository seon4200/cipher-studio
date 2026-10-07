import { canonicalNarrativeTerm } from './asset-intent'

/**
 * Reusable Spanish narrative filter for visual retrieval only.
 * It deliberately does not alter the editorial keyword shown on screen.
 */
export const SPANISH_VISUAL_STOPWORDS_V1 = Object.freeze([
  'a', 'al', 'algo', 'ante', 'aquel', 'aquella', 'aquello', 'aqui', 'asi', 'aunque',
  'cada', 'como', 'con', 'contra', 'cual', 'cuando', 'de', 'del', 'desde', 'donde',
  'el', 'ella', 'ellas', 'ellos', 'en', 'entre', 'esa', 'esas', 'ese', 'eso', 'esos',
  'esta', 'estas', 'este', 'esto', 'estos', 'hacia', 'hasta', 'la', 'las', 'le', 'les',
  'lo', 'los', 'me', 'mi', 'mis', 'mucho', 'muy', 'nada', 'ni', 'no', 'nos', 'nosotros',
  'o', 'otra', 'otro', 'para', 'pero', 'por', 'porque', 'que', 'quien', 'se', 'si', 'sin',
  'sobre', 'su', 'sus', 'te', 'todo', 'todos', 'tras', 'tu', 'tus', 'un', 'una', 'uno',
  'unos', 'unas', 'usted', 'ustedes', 'y', 'ya', 'yo',
] as const)

export const SPANISH_VISUAL_GENERIC_TERMS_V1 = Object.freeze([
  'dar', 'decir', 'dejar', 'ejemplo', 'estar', 'fue', 'hacer', 'hace', 'hacen', 'hacemos',
  'hay', 'importante', 'ir', 'llegar', 'llevar', 'momento', 'pasa', 'pasar', 'poner',
  'poder', 'problema', 'quedar', 'saber', 'seguir', 'sentir', 'sentirte', 'ser', 'tener',
  'tiene', 'tienen', 'va', 'van', 'vas', 'ver', 'volver', 'vaya',
] as const)

/**
 * Reusable human-subject vocabulary. These are entities that can be rendered as an icon, photo
 * cutout or full raster; they must not be demoted to editorial merely because a catalog happens
 * not to contain a synonym for one profession.
 */
export const VISUAL_PERSON_TERMS_V1 = Object.freeze([
  'persona', 'personas', 'gente', 'multitud', 'policia', 'trabajador', 'trabajadores',
  'hombre', 'hombres', 'mujer', 'mujeres', 'esposa', 'esposo', 'nino', 'nina', 'ninos',
  'ninas', 'adolescente', 'adolescentes', 'enfermera', 'enfermero', 'maestra', 'maestro',
  'cientifica', 'cientifico', 'fotografa', 'fotografo', 'viajera', 'viajero', 'human',
  'person', 'people', 'woman', 'women', 'man', 'men', 'worker', 'user', 'usuario',
  'usuarios', 'crowd',
] as const)

const STOPWORDS = new Set<string>(SPANISH_VISUAL_STOPWORDS_V1)
const GENERIC = new Set<string>(SPANISH_VISUAL_GENERIC_TERMS_V1)
const PERSON = new Set<string>(VISUAL_PERSON_TERMS_V1)

function tokens(value: unknown): string[] {
  return canonicalNarrativeTerm(String(value ?? '')).split(' ').filter(Boolean)
}

/** True only when a term contains no independently meaningful visual token. */
export function isSpanishVisualStopwordV1(value: unknown): boolean {
  const values = tokens(value)
  return values.length === 0 || values.every(token => STOPWORDS.has(token))
}

/** Canonical person/entity test shared by subject inference and lexical Concept Hygiene. */
export function isVisualPersonTermV1(value: unknown): boolean {
  const values = tokens(value)
  return values.length === 1 && PERSON.has(values[0])
}

/**
 * 0 rejects functional residue; 1 marks generic/discourse terms; 2–3 are usable
 * narrative evidence. Explicit structured emoji/icon evidence is evaluated by
 * the caller and can safely rescue a weak label without making a stopword a query.
 */
export function visualNarrativeTermStrengthV1(value: unknown): 0 | 1 | 2 | 3 {
  const values = tokens(value)
  const meaningful = values.filter(token => !STOPWORDS.has(token))
  if (!meaningful.length) return 0
  if (meaningful.every(token => GENERIC.has(token))) return 1
  return meaningful.length > 1 ? 3 : 2
}
