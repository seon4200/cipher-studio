/*
 * Frozen before the first Photo Cutout Production V1 acceptance run.
 *
 * These are narration inputs, not provider answers: no asset ID, URL, chosen slot, or expected
 * renderer output is encoded here.  The production resolver must make each representation and
 * materialisation decision from this evidence.
 */
function scene (value) {
  return Object.freeze({
    ...value,
    concepts: Object.freeze(value.concepts.map(concept => Object.freeze(concept))),
  })
}

const PHOTO_CUTOUT_PRODUCTION_CORPUS_V1 = Object.freeze([
  scene({ id: 'person-microphone', keyword: 'VOZ', text: 'una persona alza el micrófono para contar la historia',
    concepts: [{ label: 'persona', emoji: '🧑', canonicalHint: 'user' }, { label: 'micrófono', emoji: '🎤' }] }),
  scene({ id: 'person-camera', keyword: 'MIRADA', text: 'la mujer sostiene una cámara frente a la ciudad',
    concepts: [{ label: 'mujer', emoji: '👩', canonicalHint: 'user' }, { label: 'cámara', emoji: '📷' }] }),
  scene({ id: 'animal-dog', keyword: 'COMPAÑÍA', text: 'el perro espera junto a una puerta abierta',
    concepts: [{ label: 'perro', emoji: '🐶' }, { label: 'puerta', emoji: '🚪', canonicalHint: 'home' }] }),
  scene({ id: 'object-camera', keyword: 'MEDIOS', text: 'una cámara registra a una mujer en un momento importante',
    concepts: [{ label: 'cámara', emoji: '📷' }, { label: 'mujer', emoji: '👩', canonicalHint: 'user' }] }),
  scene({ id: 'object-bicycle', keyword: 'RUTA', text: 'la bicicleta cruza el puente al amanecer',
    concepts: [{ label: 'bicicleta', emoji: '🚲' }, { label: 'puente', emoji: '🌉', canonicalHint: 'bridge' }] }),
  scene({ id: 'object-tool', keyword: 'OBRA', text: 'una herramienta transforma el taller cada mañana',
    concepts: [{ label: 'herramienta', canonicalHint: 'hammer' }, { label: 'trabajador', emoji: '👷', canonicalHint: 'user' }] }),
  scene({ id: 'object-food', keyword: 'ALIMENTO', text: 'el pan fresco llega a la mesa familiar',
    concepts: [{ label: 'pan', emoji: '🍞' }, { label: 'comida', emoji: '🍽️' }] }),
  scene({ id: 'symbol-clock', keyword: 'TIEMPO', text: 'el reloj marca una decisión que no puede esperar',
    concepts: [{ label: 'reloj', emoji: '⏱️', canonicalHint: 'clock' }, { label: 'decisión', canonicalHint: 'lightbulb' }] }),
  scene({ id: 'symbol-data', keyword: 'DATOS', text: 'los datos viajan entre la computadora y la nube',
    concepts: [{ label: 'datos', emoji: '💾', canonicalHint: 'database' }, { label: 'computadora', emoji: '🖥️' }] }),
  scene({ id: 'symbol-growth', keyword: 'CRECIMIENTO', text: 'un cohete despega mientras la idea empieza a crecer',
    concepts: [{ label: 'cohete', emoji: '🚀' }, { label: 'brote', emoji: '🌱' }] }),
  scene({ id: 'place-hospital', keyword: 'CUIDADO', text: 'el hospital recibe a quienes necesitan atención',
    concepts: [{ label: 'hospital', emoji: '🏥' }, { label: 'enfermera', emoji: '🧑‍⚕️', canonicalHint: 'user' }] }),
  scene({ id: 'place-stadium', keyword: 'ESTADIO', text: 'el estadio reúne a miles de personas para el partido',
    concepts: [{ label: 'estadio', emoji: '🏟️' }, { label: 'fútbol', emoji: '⚽' }] }),
  scene({ id: 'place-forest', keyword: 'BOSQUE', text: 'el bosque protege el agua y la vida cercana',
    concepts: [{ label: 'bosque', emoji: '🌲' }, { label: 'agua', emoji: '💧' }] }),
  scene({ id: 'event-protest', keyword: 'VOZ', text: 'la protesta avanza con banderas por la avenida',
    concepts: [{ label: 'protesta', emoji: '✊' }, { label: 'bandera', emoji: '🚩' }] }),
  scene({ id: 'event-celebration', keyword: 'CELEBRACIÓN', text: 'la celebración llena el estadio de alegría',
    concepts: [{ label: 'celebración', emoji: '🎉' }, { label: 'estadio', emoji: '🏟️' }] }),
  scene({ id: 'event-fire', keyword: 'ALERTA', text: 'el incendio obliga a proteger el barrio',
    concepts: [{ label: 'incendio', emoji: '🔥' }, { label: 'barrio', canonicalHint: 'home' }] }),
  scene({ id: 'tech-ai', keyword: 'INTELIGENCIA', text: 'la inteligencia artificial escribe una respuesta en pantalla',
    concepts: [{ label: 'inteligencia artificial', emoji: '🧠', canonicalHint: 'cpu' }, { label: 'escritura', emoji: '⌨️' }] }),
  scene({ id: 'travel-train', keyword: 'VIAJE', text: 'el tren parte con una maleta hacia otra ciudad',
    concepts: [{ label: 'tren', emoji: '🚆' }, { label: 'maleta', emoji: '🧳', canonicalHint: 'suitcase' }] }),
  scene({ id: 'editorial-recovery', keyword: 'RECUPERACIÓN', text: 'la recuperación no ocurre en una sola línea',
    preferredVisualMode: 'editorial-text', concepts: [{ label: 'recuperación' }] }),
  scene({ id: 'editorial-contradiction', keyword: 'CONTRADICCIÓN', text: 'la contradicción permanece entre dos decisiones',
    preferredVisualMode: 'editorial-text', concepts: [{ label: 'contradicción' }] }),
])

module.exports = { PHOTO_CUTOUT_PRODUCTION_CORPUS_V1 }
