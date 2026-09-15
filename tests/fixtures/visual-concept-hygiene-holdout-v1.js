/*
 * FROZEN HOLDOUT — Visual Concept Hygiene V1.
 *
 * Este conjunto fue separado antes de la primera ejecución final. No se usa
 * para ajustar listas, reglas, umbrales ni ConceptLexicon.
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

const VISUAL_CONCEPT_HYGIENE_HOLDOUT_V1 = Object.freeze([
  row({ id: 'hold-adverb-demasiado', keyword: 'demasiado', text: 'es demasiado tarde',
    tokens: [direct('es', 0), direct('demasiado', .2), direct('tarde', .4)], concepts: [],
    expected: { visuality: 'non-visual', eligibility: 'not-visual', emitted: false, pixabay: false } }),
  row({ id: 'hold-discourse-parece', keyword: 'parece', text: 'parece que todo cambia',
    tokens: [direct('parece', 0), direct('que', .2), direct('todo', .4), direct('cambia', .6)], concepts: [],
    expected: { visuality: 'non-visual', eligibility: 'not-visual', emitted: false, pixabay: false } }),
  row({ id: 'hold-action-viajar-alone', keyword: 'viajar', text: 'viajar cambia perspectivas',
    tokens: [direct('viajar', 0), direct('cambia', .2), direct('perspectivas', .4)], concepts: [],
    expected: { visuality: 'visual-action-with-context', eligibility: 'not-visual', emitted: false, pixabay: false } }),
  row({ id: 'hold-action-viajar-context', keyword: 'avión', text: 'el avión permite viajar lejos',
    tokens: [direct('el', 0), direct('avión', .2), direct('permite', .4), direct('viajar', .6), direct('lejos', .8)], concepts: [],
    expected: { visuality: 'visual-action-with-context', eligibility: 'support-only', emitted: true, pixabay: false } }),
  row({ id: 'hold-abstract-incertidumbre', keyword: 'incertidumbre', text: 'la incertidumbre crece',
    tokens: [direct('la', 0), direct('incertidumbre', .2), direct('crece', .4)], concepts: [],
    expected: { visuality: 'abstract-symbolic', eligibility: 'support-only', emitted: true, pixabay: false } }),
  row({ id: 'hold-abstract-solidaridad', keyword: 'solidaridad', text: 'la solidaridad une personas',
    tokens: [direct('la', 0), direct('solidaridad', .2), direct('une', .4), direct('personas', .6)], concepts: [],
    expected: { visuality: 'abstract-symbolic', eligibility: 'support-only', emitted: true, pixabay: false } }),
  row({ id: 'hold-concrete-bicicleta', keyword: 'bicicleta', text: 'la bicicleta cruza el puente',
    tokens: [direct('la', 0), direct('bicicleta', .2), direct('cruza', .4), direct('puente', .6)], concepts: [],
    expected: { visuality: 'concrete-visual', eligibility: 'hero-eligible', emitted: true, pixabay: true } }),
  row({ id: 'hold-concrete-enfermera', keyword: 'enfermera', text: 'la enfermera cuida pacientes',
    tokens: [direct('la', 0), direct('enfermera', .2), direct('cuida', .4), direct('pacientes', .6)], concepts: [],
    expected: { visuality: 'concrete-visual', eligibility: 'hero-eligible', emitted: true, pixabay: true } }),
  row({ id: 'hold-concrete-bosque', keyword: 'bosque', text: 'el bosque protege el agua',
    tokens: [direct('el', 0), direct('bosque', .2), direct('protege', .4), direct('agua', .6)], concepts: [],
    expected: { visuality: 'concrete-visual', eligibility: 'hero-eligible', emitted: true, pixabay: true } }),
  row({ id: 'hold-symbol-brujula', keyword: 'brújula', text: 'la brújula marca dirección',
    tokens: [direct('la', 0), direct('brújula', .2), direct('marca', .4), direct('dirección', .6)], concepts: [],
    expected: { visuality: 'abstract-symbolic', eligibility: 'hero-eligible', emitted: true, pixabay: false } }),
  row({ id: 'hold-unknown-neologism', keyword: 'velquion', text: 'velquion se repite',
    tokens: [direct('velquion', 0), direct('se', .2), direct('repite', .4)], concepts: [],
    expected: { visuality: 'unknown', eligibility: 'not-visual', emitted: false, pixabay: false } }),
  row({ id: 'hold-structured-robot', keyword: 'robot', text: 'el robot organiza datos',
    tokens: [direct('el', 0), direct('robot', .2), direct('organiza', .4), direct('datos', .6)],
    concepts: [{ label: 'robot', emoji: '🤖', start: .2, end: .38, scope: 'scene' }],
    expected: { visuality: 'concrete-visual', eligibility: 'hero-eligible', emitted: true, pixabay: true } }),
  row({ id: 'hold-structured-message', keyword: 'mensaje', text: 'un mensaje cambia la conversación',
    tokens: [direct('un', 0), direct('mensaje', .2), direct('cambia', .4), direct('conversación', .6)],
    concepts: [{ label: 'mensaje', emoji: '💬', start: .2, end: .38, scope: 'scene' }],
    expected: { visuality: 'abstract-symbolic', eligibility: 'hero-eligible', emitted: true, pixabay: false } }),
])

if (VISUAL_CONCEPT_HYGIENE_HOLDOUT_V1.length !== 13)
  throw new Error('El holdout de Concept Hygiene debe permanecer congelado en 13 casos')

module.exports = { VISUAL_CONCEPT_HYGIENE_HOLDOUT_V1 }
