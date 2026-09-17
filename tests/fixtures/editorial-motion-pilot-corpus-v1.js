// Curated design inputs for the 2A pilot. All sixteen are synthetic narration examples,
// not claimed to be scenes from a user's video. No provider winner or asset ID is encoded.
const cases = [
  { id: '01-object-hero', kind: 'object-hero', text: 'la cámara registró el momento decisivo', keyword: 'CÁMARA', concepts: [['cámara', '📷'], ['momento', '⏱️']] },
  { id: '02-object-support', kind: 'object-support', text: 'la mujer levantó la cámara para mostrar la historia', keyword: 'HISTORIA', concepts: [['mujer', '👩'], ['cámara', '📷']] },
  { id: '03-person', kind: 'person-cutout', text: 'una trabajadora explicó el proyecto a sus colegas', keyword: 'PROYECTO', concepts: [['trabajadora', '👷'], ['proyecto', '📋']] },
  { id: '04-place', kind: 'contextual-place', text: 'la protesta reunió a una multitud en la plaza', keyword: 'PROTESTA', concepts: [['protesta', '✊'], ['multitud', '👥']] },
  { id: '05-symbol', kind: 'symbol', text: 'una idea conecta a todo el equipo', keyword: 'IDEA', concepts: [['idea', '💡'], ['equipo', '👥']] },
  { id: '06-data', kind: 'confirmed-data', text: 'el resultado confirmado fue 72%', keyword: '72%', concepts: [['resultado', '📊']] },
  { id: '07-comparison', kind: 'comparison', text: 'el teléfono y la computadora cumplen tareas distintas', keyword: 'DISTINTAS', relation: 'compara', concepts: [['teléfono', '📱'], ['computadora', '💻']] },
  { id: '08-process', kind: 'three-step-process', text: 'primero la idea, luego el diseño y finalmente la publicación', keyword: 'PROCESO', relation: 'secuencia', concepts: [['idea', '💡'], ['diseño', '✒️'], ['publicación', '📄']] },
  { id: '09-cause', kind: 'cause-effect', text: 'el incendio destruyó árboles y cortó el suministro de agua', keyword: 'INCENDIO', relation: 'causa', concepts: [['incendio', '🔥'], ['árboles', '🌳'], ['agua', '💧']] },
  { id: '10-timeline', kind: 'temporal-sequence', text: 'la semilla brotó y con los años se hizo árbol', keyword: 'CRECIÓ', relation: 'secuencia', concepts: [['semilla', '🌱'], ['brote', '🌿'], ['árbol', '🌳']] },
  { id: '11-relation', kind: 'three-way-relation', text: 'trabajadores construyeron un estadio para el fútbol', keyword: 'CONSTRUYERON', relation: 'conecta', concepts: [['trabajadores', '👷'], ['estadio', '🏟️'], ['fútbol', '⚽']] },
  { id: '12-editorial', kind: 'legitimate-editorial', text: 'la incertidumbre no desaparece con una sola respuesta', keyword: 'INCERTIDUMBRE', concepts: [['incertidumbre', '']], preferredVisualMode: 'editorial-text' },
  { id: '13-long', kind: 'stress-long-text', text: 'el trabajo cotidiano cambia cuando las herramientas acompañan ideas humanas', keyword: 'HERRAMIENTAS', concepts: [['herramientas', '🛠️'], ['ideas', '💡']] },
  { id: '14-short', kind: 'stress-short-scene', text: 'el tren partió', keyword: 'PARTIÓ', duration: .85, concepts: [['tren', '🚆']] },
  { id: '15-proportions', kind: 'stress-three-scales', text: 'una persona sostiene un teléfono frente a un edificio', keyword: 'PERSONA', concepts: [['persona', '🧑'], ['teléfono', '📱'], ['edificio', '🏢']] },
  { id: '16-fallback', kind: 'stress-no-support', text: 'la puerta quedó abierta', keyword: 'ABIERTA', concepts: [['puerta', '🚪']] },
]
module.exports = Object.freeze(cases.map(value => Object.freeze({
  ...value, source: 'synthetic-pilot', duration: value.duration ?? 1.7,
  concepts: Object.freeze(value.concepts.map(([label, emoji]) => Object.freeze({ label, ...(emoji ? { emoji } : {}) }))),
})))
