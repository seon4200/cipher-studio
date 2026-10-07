/*
 * Frozen before D-Final production changes from two read-only V15 diagnostics.
 * Only the minimum semantic evidence needed to reproduce retrieval is retained.
 *
 * Source SHA-256:
 * - video-a: 69040FAF672D413DEDF844D57A3A0889DC5EE2237AD664DA7ED1188F2C16373F
 * - video-b: 9C754BE12EB6EC2CE0CCF5AEF19E09D3809E3B15A0EFEC4F0A84BA319592638B
 */

function scene (value) {
  return Object.freeze({
    ...value,
    concepts: Object.freeze((value.concepts || []).map(concept => Object.freeze(concept))),
    keywordCandidates: Object.freeze((value.keywordCandidates || []).map(candidate => Object.freeze(candidate))),
    before: Object.freeze(value.before),
  })
}

const PRODUCTION_RETRIEVAL_REAL_V15 = Object.freeze([
  scene({
    id: 'video-a-vas', source: 'video-a', sceneId: 'visual-1:0', start: 3.72, end: 6.2,
    localText: 'Cuando te vas a dar cuenta de que tener potencial para algo, y ser', textKeyword: 'vas', relation: 'conecta',
    keywordCandidates: [{ keyword: 'lightbulb moment', source: 'scene-semantic' }, { keyword: 'potencial', source: 'legacy-timed' }],
    concepts: [{ label: 'idea', emoji: '💡', canonicalHint: 'lightbulb' }, { label: 'persona', emoji: '🧑', canonicalHint: 'user' }, { label: 'momento', emoji: '⏰', canonicalHint: 'clock-circle' }],
    before: { concepts: ['vas', 'cuando', 'te'], assetCount: 0, classification: 'BAD_EDITORIAL' },
  }),
  scene({
    id: 'video-a-persona', source: 'video-a', sceneId: 'visual-8:0', start: 29.32, end: 31.4,
    localText: 'sentirte cómoda con la persona que podrías llegar a ser. Pero lo que tú y Mejumi entienden', textKeyword: 'persona', relation: 'expande',
    keywordCandidates: [{ keyword: 'future self vision', source: 'scene-semantic' }, { keyword: 'persona', source: 'legacy-timed' }],
    concepts: [{ label: 'persona', emoji: '🧍', canonicalHint: 'user' }, { label: 'llegar', emoji: '🚀', canonicalHint: 'rocket' }, { label: 'ser', emoji: '⭐', canonicalHint: 'star' }],
    before: { concepts: ['persona', 'llegar', 'ser'], assetCount: 0, classification: 'BAD_EDITORIAL' },
  }),
  scene({
    id: 'video-a-sentirte', source: 'video-a', sceneId: 'visual-18:1', start: 63.18, end: 65.6,
    localText: 'dejes de sentirte cómoda pensando en lo que podrías llegar a ser.', textKeyword: 'sentirte',
    keywordCandidates: [{ keyword: 'stepping out door', source: 'scene-semantic' }],
    concepts: [{ label: 'mujer', emoji: '🚶‍♀️', canonicalHint: 'user' }, { label: 'puerta', emoji: '🚪', canonicalHint: 'home' }, { label: 'exterior', emoji: '☀️', canonicalHint: 'sun' }],
    before: { concepts: ['sentirte', 'comoda', 'pensando'], assetCount: 0, classification: 'BAD_EDITORIAL' },
  }),
  scene({
    id: 'video-a-talento', source: 'video-a', sceneId: 'visual-19:1', start: 69.94, end: 73.92,
    localText: 'esa persona. Que no te importa si tienes talento o potencial. El problema con el potencial es que su naturaleza', textKeyword: 'talento',
    keywordCandidates: [{ keyword: 'broll', source: 'scene-semantic' }], concepts: [],
    before: { concepts: ['talento', 'que', 'no'], assetCount: 0, classification: 'BAD_EDITORIAL' },
  }),
  scene({
    id: 'video-a-potencial', source: 'video-a', sceneId: 'visual-20:1', start: 73.04, end: 75.72,
    localText: 'El problema con el potencial es que su naturaleza es estar incompleta.', textKeyword: 'potencial',
    keywordCandidates: [{ keyword: 'seed sprouting', source: 'scene-semantic' }],
    concepts: [{ label: 'brote', emoji: '🌱', canonicalHint: 'leaf' }, { label: 'agua', emoji: '💧', canonicalHint: 'water' }, { label: 'luz', emoji: '☀️', canonicalHint: 'sun' }],
    before: { concepts: ['potencial', 'con', 'el'], assetCount: 0, classification: 'BAD_EDITORIAL' },
  }),
  scene({
    id: 'video-a-tu', source: 'video-a', sceneId: 'visual-21:0', start: 75.84, end: 78.86,
    localText: 'No vaya a ser que tu vida se vuelve una mera proyección de lo que pudo ser y', textKeyword: 'tu',
    keywordCandidates: [{ keyword: 'projector casting shadow', source: 'scene-semantic' }, { keyword: 'proyección', source: 'legacy-timed' }],
    concepts: [{ label: 'proyector', emoji: '📽️', canonicalHint: 'monitor' }, { label: 'sombra', emoji: '👤', canonicalHint: 'user' }, { label: 'pared', emoji: '🖼️', canonicalHint: 'home' }],
    before: { concepts: ['tu', 'no', 'vaya'], assetCount: 0, classification: 'BAD_EDITORIAL' },
  }),
  scene({
    id: 'video-b-redes-sociales', source: 'video-b', sceneId: 'visual-0:1', start: 2.11, end: 4.22,
    localText: 'tendencia en redes sociales, las cosas que hacen los adolescentes.', textKeyword: 'redes', relation: 'expande',
    keywordCandidates: [{ keyword: 'viral hashtag on phone', source: 'scene-semantic' }, { keyword: 'adolescentes', source: 'legacy-timed' }],
    concepts: [{ label: 'móvil', emoji: '📱', canonicalHint: 'monitor' }, { label: 'viral', emoji: '🔗', canonicalHint: 'link' }, { label: 'popular', emoji: '⭐', canonicalHint: 'star' }],
    before: { concepts: ['redes', 'sociales', 'las'], assetCount: 0, classification: 'BAD_EDITORIAL' },
  }),
  scene({
    id: 'video-b-mujer-presa', source: 'video-b', sceneId: 'visual-2:1', start: 10.24, end: 12.76,
    localText: 'de todos los nombrados en los documentos de Epstein solo su mujer fue presa?', textKeyword: 'nombrados', relation: 'contrasta',
    keywordCandidates: [{ keyword: 'only wife jailed among named', source: 'scene-semantic' }, { keyword: 'documentos', source: 'legacy-timed' }],
    concepts: [{ label: 'esposa', emoji: '👩', canonicalHint: 'user' }, { label: 'expediente', emoji: '📁', canonicalHint: 'folder' }, { label: 'encarcelada', emoji: '🔒', canonicalHint: 'lock' }],
    before: { concepts: ['nombrados', 'en', 'los'], assetCount: 0, classification: 'BAD_EDITORIAL' },
  }),
  scene({
    id: 'video-b-conflictos', source: 'video-b', sceneId: 'visual-3:0', start: 12.88, end: 15.83,
    localText: 'O que actualmente hay entre 110 a 130 conflictos armados en el mundo de', textKeyword: 'conflictos', relation: 'conecta',
    keywordCandidates: [{ keyword: 'world map with conflict zones', source: 'scene-semantic' }, { keyword: 'conflictos', source: 'legacy-timed' }],
    concepts: [{ label: 'mundo', emoji: '🗺️', canonicalHint: 'map' }, { label: 'conflicto', emoji: '🚩', canonicalHint: 'flag' }, { label: 'estados', emoji: '🏢', canonicalHint: 'buildings' }],
    before: { concepts: ['conflicto', 'o', 'que'], assetCount: 1, classification: 'HAS_ASSET' },
  }),
  scene({
    id: 'video-b-hambre', source: 'video-b', sceneId: 'visual-3:2', start: 18.78, end: 21.73,
    localText: 'estados. O que por ejemplo el hambre aguda alcanza 266 millones de personas', textKeyword: 'ejemplo',
    keywordCandidates: [{ keyword: 'broll', source: 'scene-semantic' }], concepts: [],
    before: { concepts: ['ejemplo', 'estados', 'o'], assetCount: 0, classification: 'BAD_EDITORIAL' },
  }),
  scene({
    id: 'video-b-inteligencia-artificial', source: 'video-b', sceneId: 'visual-7:0', start: 32.54, end: 36.28,
    localText: 'redes sociales está en los causón deterioro y que el uso excesivo del inteligencia artificial está teniendo', textKeyword: 'sociales', relation: 'conecta',
    keywordCandidates: [{ keyword: 'brain with AI circuit', source: 'scene-semantic' }, { keyword: 'inteligencia', source: 'legacy-timed' }],
    concepts: [{ label: 'mente', emoji: '🧠', canonicalHint: 'lightbulb' }, { label: 'IA', emoji: '⚙️', canonicalHint: 'settings' }, { label: 'conexión', emoji: '🔗', canonicalHint: 'link' }],
    before: { concepts: ['sociales', 'esta', 'en'], assetCount: 0, classification: 'BAD_EDITORIAL' },
  }),
  scene({
    id: 'video-b-chatgpt-escritura', source: 'video-b', sceneId: 'visual-8:1', start: 38.61, end: 40.94,
    localText: 'pero nosotros lo que hacemos es suvemos a la tendencia de pedir la chatchipitique que nos escribieron', textKeyword: 'hacemos', relation: 'anota',
    keywordCandidates: [{ keyword: 'typing prompt on keyboard', source: 'scene-semantic' }, { keyword: 'chatchipitique', source: 'legacy-timed' }],
    concepts: [{ label: 'escribir', emoji: '⌨️', canonicalHint: 'pen' }, { label: 'texto', emoji: '📝', canonicalHint: 'document' }, { label: 'pantalla', emoji: '🖥️', canonicalHint: 'monitor' }],
    before: { concepts: ['hacemos', 'que', 'es'], assetCount: 0, classification: 'BAD_EDITORIAL' },
  }),
])

module.exports = { PRODUCTION_RETRIEVAL_REAL_V15 }
