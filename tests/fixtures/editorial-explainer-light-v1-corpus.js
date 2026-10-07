// Synthetic, frozen presentation pilot. Values are fiction for testing, not user-video facts.
module.exports = Object.freeze([
  Object.freeze({ id: 'hero-chip', keyword: 'CHIP', text: 'Un chip transforma una idea.',
    concepts: [{ label: 'chip', canonicalHint: 'chip' }], mode: 'auto' }),
  Object.freeze({ id: 'relation-transfer', keyword: 'ROBOT', text: 'Un robot envía una señal a una herramienta.', relation: 'causa',
    concepts: [{ label: 'robot', canonicalHint: 'robot' },
      { label: 'herramienta', canonicalHint: 'tool' }], mode: 'auto' }),
  Object.freeze({ id: 'count-12', keyword: '12', text: '12 participantes construyen una red.',
    concepts: [], mode: 'editorial-text' }),
  Object.freeze({ id: 'editorial-close', keyword: 'IDEA', text: 'Una idea cambia la forma de mirar.',
    concepts: [], mode: 'editorial-text' }),
])
