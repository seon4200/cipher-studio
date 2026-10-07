// Controlled synthetic corpus. Stress text was isolated after the first acceptance run showed
// that the semantic keyword selector correctly preferred a different structured concept.
const pilot = require('./editorial-motion-pilot-corpus-v1').slice(0, 12)
// Coverage seeds choose only among V4-eligible families, using the productive selector.
const main = pilot.map(row => row.id === '01-object-hero'
  ? { ...row, targetFamily: 'cintaDiagonal', targetSupportCount: 1 }
  : row.id === '08-process'
    ? { ...row, targetFamily: 'lineaTiempo', targetSupportCount: 2 } : row)
const stress = [
  { id: '13-long-word', kind: 'long-word', text: 'INCONSTITUCIONALIDAD',
    keyword: 'INCONSTITUCIONALIDAD', concepts: [], preferredVisualMode: 'editorial-text' },
  { id: '14-long-adverb', kind: 'long-word', text: 'EXTRAORDINARIAMENTE',
    keyword: 'EXTRAORDINARIAMENTE', concepts: [], preferredVisualMode: 'editorial-text' },
  { id: '15-ai-phrase', kind: 'multiword-keyword', text: 'La inteligencia artificial procesó los datos del experimento',
    keyword: 'INTELIGENCIA ARTIFICIAL', concepts: [{ label: 'inteligencia artificial', emoji: '🤖' }] },
  { id: '16-confirmed-percent', kind: 'percentage', text: 'El resultado confirmado alcanzó el 72%',
    keyword: '72%', concepts: [{ label: 'resultado', emoji: '📊' }] },
  { id: '17-date', kind: 'date', text: '2026',
    keyword: '2026', concepts: [], preferredVisualMode: 'editorial-text' },
  { id: '18-question', kind: 'punctuation', text: '¿QUÉ PASÓ REALMENTE?',
    keyword: '¿QUÉ PASÓ REALMENTE?', concepts: [], preferredVisualMode: 'editorial-text' },
  { id: '19-long-secondary', kind: 'long-secondary', text: 'El documento cambió la historia de la ciudad para siempre',
    keyword: 'DOCUMENTO', concepts: [{ label: 'documento', emoji: '📄' }, { label: 'ciudad', emoji: '🏙️' }] },
  { id: '20-editorial-no-asset', kind: 'editorial', text: 'Nadie pudo responder con certeza',
    keyword: 'CERTEZA', concepts: [{ label: 'certeza' }], preferredVisualMode: 'editorial-text' },
]
module.exports = Object.freeze([...main, ...stress.map(value => Object.freeze({
  ...value, source: 'synthetic-visual-recovery', duration: 1.6,
  concepts: Object.freeze(value.concepts.map(concept => Object.freeze(concept))),
}))])
