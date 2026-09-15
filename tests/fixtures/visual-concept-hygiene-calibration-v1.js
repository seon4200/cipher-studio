/*
 * CALIBRATION CORPUS — Visual Concept Hygiene V1.
 *
 * Congelado antes de implementar la higiene de conceptos. Cada fila describe
 * evidencia narrativa local, no un asset ni un resultado de proveedor. El
 * propósito es decidir si el término merece llegar a retrieval.
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

const VISUAL_CONCEPT_HYGIENE_CALIBRATION_V1 = Object.freeze([
  // Failures found in the previous fallback / relevance holdout path.
  row({
    id: 'fallback-bastante', keyword: 'bastante', text: 'es bastante difícil',
    tokens: [direct('es', 0), direct('bastante', .2), direct('difícil', .4)], concepts: [],
    expected: { term: 'bastante', visuality: 'non-visual', eligibility: 'not-visual', emitted: false, pixabay: false },
  }),
  row({
    id: 'fallback-resulta', keyword: 'resulta', text: 'resulta que cambia todo',
    tokens: [direct('resulta', 0), direct('que', .2), direct('cambia', .4), direct('todo', .6)], concepts: [],
    expected: { term: 'resulta', visuality: 'non-visual', eligibility: 'not-visual', emitted: false, pixabay: false },
  }),
  row({
    id: 'fallback-silencio', keyword: 'silencio', text: 'el silencio pesa mucho',
    tokens: [direct('el', 0), direct('silencio', .2), direct('pesa', .4), direct('mucho', .6)], concepts: [],
    expected: { term: 'silencio', visuality: 'abstract-symbolic', eligibility: 'support-only', emitted: true, pixabay: false },
  }),
  // Reconstructed production cases.
  row({
    id: 'fallback-desesperanza', keyword: 'desesperanza', text: 'la desesperanza no desaparece sola',
    tokens: [direct('la', 0), direct('desesperanza', .2), direct('no', .4), direct('desaparece', .6), direct('sola', .8)], concepts: [],
    expected: { term: 'desesperanza', visuality: 'abstract-symbolic', eligibility: 'support-only', emitted: true, pixabay: false },
  }),
  row({
    id: 'fallback-trabajar-alone', keyword: 'trabajar', text: 'trabajar resulta difícil',
    tokens: [direct('trabajar', 0), direct('resulta', .2), direct('difícil', .4)], concepts: [],
    expected: { term: 'trabajar', visuality: 'visual-action-with-context', eligibility: 'not-visual', emitted: false, pixabay: false },
  }),
  // Concrete lexical positives must retain a real retrieval route.
  row({
    id: 'concrete-persona', keyword: 'persona', text: 'una persona comparte su historia',
    tokens: [direct('una', 0), direct('persona', .2), direct('comparte', .4), direct('historia', .6)], concepts: [],
    expected: { term: 'persona', visuality: 'concrete-visual', eligibility: 'hero-eligible', emitted: true, pixabay: true },
  }),
  row({
    id: 'concrete-camara', keyword: 'cámara', text: 'la cámara registra el momento',
    tokens: [direct('la', 0), direct('cámara', .2), direct('registra', .4), direct('momento', .6)], concepts: [],
    expected: { term: 'camara', visuality: 'concrete-visual', eligibility: 'hero-eligible', emitted: true, pixabay: true },
  }),
  row({
    id: 'concrete-hospital', keyword: 'hospital', text: 'el hospital recibe pacientes',
    tokens: [direct('el', 0), direct('hospital', .2), direct('recibe', .4), direct('pacientes', .6)], concepts: [],
    expected: { term: 'hospital', visuality: 'concrete-visual', eligibility: 'hero-eligible', emitted: true, pixabay: true },
  }),
  // A real action survives only because the same local window names its drawable context.
  row({
    id: 'action-trabajar-with-context', keyword: 'persona', text: 'una persona va a trabajar al hospital',
    tokens: [direct('una', 0), direct('persona', .2), direct('va', .4), direct('a', .6), direct('trabajar', .8), direct('al', 1), direct('hospital', 1.2)], concepts: [],
    expected: { term: 'trabajar', visuality: 'visual-action-with-context', eligibility: 'support-only', emitted: true, pixabay: false },
  }),
  // Unknown must not inherit the old implicit `object` classification.
  row({
    id: 'unknown-token', keyword: 'zuntrax', text: 'zuntrax aparece de pronto',
    tokens: [direct('zuntrax', 0), direct('aparece', .2), direct('de', .4), direct('pronto', .6)], concepts: [],
    expected: { term: 'zuntrax', visuality: 'unknown', eligibility: 'not-visual', emitted: false, pixabay: false },
  }),
  // Same-subclip structured evidence stays authoritative and is not demoted by lexical hygiene.
  row({
    id: 'structured-football', keyword: 'fútbol', text: 'el fútbol llena el estadio',
    tokens: [direct('el', 0), direct('fútbol', .2), direct('llena', .4), direct('estadio', .6)],
    concepts: [{ label: 'fútbol', emoji: '⚽', start: .2, end: .38, scope: 'scene' }, { label: 'estadio', emoji: '🏟️', start: .6, end: .78, scope: 'scene' }],
    expected: { term: 'futbol', visuality: 'concrete-visual', eligibility: 'hero-eligible', emitted: true, pixabay: true },
  }),
  row({
    id: 'structured-abstract', keyword: 'recuperación', text: 'la recuperación llega después',
    tokens: [direct('la', 0), direct('recuperación', .2), direct('llega', .4), direct('después', .6)],
    concepts: [{ label: 'recuperación', start: .2, end: .38, scope: 'scene' }],
    expected: { term: 'recuperacion', visuality: 'abstract-symbolic', eligibility: 'support-only', emitted: true, pixabay: false },
  }),
])

if (VISUAL_CONCEPT_HYGIENE_CALIBRATION_V1.length !== 12)
  throw new Error('El corpus de calibración de Concept Hygiene debe permanecer congelado en 12 casos')

module.exports = { VISUAL_CONCEPT_HYGIENE_CALIBRATION_V1 }
