/*
 * FROZEN HOLDOUT V2 — Visual Concept Hygiene repair pass.
 *
 * Created before the repaired implementation is executed. It is intentionally
 * disjoint from calibration and Holdout V1; after its first execution it must
 * not be used to tune routing, thresholds, or the lexicon.
 */
function row (value) {
  return Object.freeze({
    ...value,
    tokens: Object.freeze(value.tokens.map(token => Object.freeze({ ...token }))),
    concepts: Object.freeze(value.concepts.map(concept => Object.freeze({ ...concept }))),
    expected: Object.freeze({ ...value.expected }),
  })
}

const direct = (word, start) => ({ word, start, end: start + 0.18 })

const VISUAL_CONCEPT_HYGIENE_HOLDOUT_V2 = Object.freeze([
  row({ id: 'v2-discourse-tampoco', keyword: 'tampoco', text: 'tampoco explica el problema',
    tokens: [direct('tampoco', 0), direct('explica', .2), direct('el', .4), direct('problema', .6)], concepts: [],
    expected: { term: 'tampoco', authority: 'lexical-fallback', visuality: 'non-visual', eligibility: 'not-visual', emitted: false, pixabay: false } }),
  row({ id: 'v2-inference-pareciera', keyword: 'pareciera', text: 'pareciera que el mapa cambia',
    tokens: [direct('pareciera', 0), direct('que', .2), direct('el', .4), direct('mapa', .6), direct('cambia', .8)], concepts: [],
    expected: { term: 'pareciera', authority: 'lexical-fallback', visuality: 'non-visual', eligibility: 'not-visual', emitted: false, pixabay: false } }),
  row({ id: 'v2-unknown-adverb', keyword: 'probablemente', text: 'probablemente todo cambia',
    tokens: [direct('probablemente', 0), direct('todo', .2), direct('cambia', .4)], concepts: [],
    expected: { term: 'probablemente', authority: 'lexical-fallback', visuality: 'unknown', eligibility: 'not-visual', emitted: false, pixabay: false } }),
  row({ id: 'v2-action-viajar-alone', keyword: 'viajar', text: 'viajar abre perspectivas',
    tokens: [direct('viajar', 0), direct('abre', .2), direct('perspectivas', .4)], concepts: [],
    expected: { term: 'viajar', authority: 'lexical-fallback', visuality: 'visual-action-with-context', eligibility: 'not-visual', emitted: false, pixabay: false } }),
  row({ id: 'v2-action-navegar-context', keyword: 'barco', text: 'el barco permite navegar',
    tokens: [direct('el', 0), direct('barco', .2), direct('permite', .4), direct('navegar', .6)], concepts: [],
    expected: { term: 'navegar', authority: 'lexical-fallback', visuality: 'visual-action-with-context', eligibility: 'support-only', emitted: true, pixabay: false } }),
  row({ id: 'v2-action-sostener-context', keyword: 'puente', text: 'el puente puede sostener el tránsito',
    tokens: [direct('el', 0), direct('puente', .2), direct('puede', .4), direct('sostener', .6), direct('el', .8), direct('transito', 1)], concepts: [],
    expected: { term: 'sostener', authority: 'lexical-fallback', visuality: 'visual-action-with-context', eligibility: 'support-only', emitted: true, pixabay: false } }),
  row({ id: 'v2-abstract-incertidumbre', keyword: 'incertidumbre', text: 'la incertidumbre persiste',
    tokens: [direct('la', 0), direct('incertidumbre', .2), direct('persiste', .4)], concepts: [],
    expected: { term: 'incertidumbre', authority: 'lexical-fallback', visuality: 'abstract-symbolic', eligibility: 'support-only', emitted: true, pixabay: false } }),
  row({ id: 'v2-abstract-prioridad', keyword: 'prioridad', text: 'la prioridad cambia',
    tokens: [direct('la', 0), direct('prioridad', .2), direct('cambia', .4)], concepts: [],
    expected: { term: 'prioridad', authority: 'lexical-fallback', visuality: 'abstract-symbolic', eligibility: 'support-only', emitted: true, pixabay: false } }),
  row({ id: 'v2-abstract-esperanza', keyword: 'esperanza', text: 'la esperanza permanece',
    tokens: [direct('la', 0), direct('esperanza', .2), direct('permanece', .4)], concepts: [],
    expected: { term: 'esperanza', authority: 'lexical-fallback', visuality: 'abstract-symbolic', eligibility: 'support-only', emitted: true, pixabay: false } }),
  row({ id: 'v2-concrete-tren', keyword: 'tren', text: 'el tren llega a la estación',
    tokens: [direct('el', 0), direct('tren', .2), direct('llega', .4), direct('a', .6), direct('la', .8), direct('estacion', 1)], concepts: [],
    expected: { term: 'tren', authority: 'lexical-fallback', visuality: 'concrete-visual', eligibility: 'hero-eligible', emitted: true, pixabay: true } }),
  row({ id: 'v2-concrete-arbol', keyword: 'árbol', text: 'el árbol protege la calle',
    tokens: [direct('el', 0), direct('árbol', .2), direct('protege', .4), direct('la', .6), direct('calle', .8)], concepts: [],
    expected: { term: 'arbol', authority: 'lexical-fallback', visuality: 'concrete-visual', eligibility: 'hero-eligible', emitted: true, pixabay: true } }),
  row({ id: 'v2-concrete-laboratorio', keyword: 'laboratorio', text: 'el laboratorio analiza muestras',
    tokens: [direct('el', 0), direct('laboratorio', .2), direct('analiza', .4), direct('muestras', .6)], concepts: [],
    expected: { term: 'laboratorio', authority: 'lexical-fallback', visuality: 'concrete-visual', eligibility: 'hero-eligible', emitted: true, pixabay: true } }),
  row({ id: 'v2-neologism', keyword: 'zorelium', text: 'zorelium vuelve a aparecer',
    tokens: [direct('zorelium', 0), direct('vuelve', .2), direct('a', .4), direct('aparecer', .6)], concepts: [],
    expected: { term: 'zorelium', authority: 'lexical-fallback', visuality: 'unknown', eligibility: 'not-visual', emitted: false, pixabay: false } }),
  row({ id: 'v2-explicit-symbol-email', keyword: 'correo', text: 'el correo abre la conversación',
    tokens: [direct('el', 0), direct('correo', .2), direct('abre', .4), direct('la', .6), direct('conversación', .8)],
    concepts: [{ label: 'correo', emoji: '✉️', start: .2, end: .38, scope: 'scene' }],
    expected: { term: 'correo', authority: 'explicit-visual-evidence', visuality: 'abstract-symbolic', eligibility: 'hero-eligible', emitted: true, pixabay: false } }),
  row({ id: 'v2-explicit-physical-dog', keyword: 'perro', text: 'el perro corre al parque',
    tokens: [direct('el', 0), direct('perro', .2), direct('corre', .4), direct('al', .6), direct('parque', .8)],
    concepts: [{ label: 'perro', emoji: '🐶', start: .2, end: .38, scope: 'scene' }],
    expected: { term: 'perro', authority: 'structured-semantic', visuality: 'concrete-visual', eligibility: 'hero-eligible', emitted: true, pixabay: true } }),
  row({ id: 'v2-direct-hexcode', keyword: '1F680', text: '1F680',
    tokens: [direct('1F680', 0)], concepts: [],
    expected: { term: '1f680', authority: 'explicit-visual-evidence', visuality: 'abstract-symbolic', eligibility: 'hero-eligible', emitted: true, pixabay: false } }),
])

if (VISUAL_CONCEPT_HYGIENE_HOLDOUT_V2.length !== 16)
  throw new Error('El holdout V2 de Concept Hygiene debe permanecer congelado en 16 casos')

module.exports = { VISUAL_CONCEPT_HYGIENE_HOLDOUT_V2 }
