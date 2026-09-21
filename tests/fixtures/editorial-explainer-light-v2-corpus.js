// Fixed synthetic narrative. These are fictional pilot examples, not claims about a user's video.
module.exports = Object.freeze([
  Object.freeze({ id:'idea', duration:3.5, keyword:'IDEA', text:'Una idea enciende posibilidades.',
    concepts:[{label:'idea',canonicalHint:'idea'}], hero:'idea-lightbulb', cue:'hero' }),
  Object.freeze({ id:'signal', duration:3.2, keyword:'SEÑAL', text:'La señal conecta robot y cámara.',
    concepts:[{label:'señal',canonicalHint:'signal'},{label:'robot',canonicalHint:'robot'},
      {label:'cámara',canonicalHint:'camera'}], hero:'signal-relay', supports:['robot','camera'], cue:'hero' }),
  Object.freeze({ id:'transfer', duration:3.5, keyword:'CONEXIÓN', text:'Una conexión lleva datos al siguiente paso.',
    concepts:[{label:'conexión',canonicalHint:'connection'},{label:'datos',canonicalHint:'data'}],
    hero:'connection-bridge', supports:['data'], relation:'causa', cue:'transfer' }),
  Object.freeze({ id:'people', duration:3.4, keyword:'12', text:'12 participantes construyen una red.',
    concepts:[], mode:'editorial-text', cue:'count', confirmedValue:12, unit:'participantes' }),
  Object.freeze({ id:'build', duration:3.5, keyword:'PIEZAS', text:'Las piezas construyen la fábrica, paso a paso.',
    concepts:[{label:'piezas',canonicalHint:'parts'},{label:'fábrica',canonicalHint:'factory'}],
    hero:'process-stack', supports:['factory'], relation:'secuencia', cue:'process' }),
  Object.freeze({ id:'close', duration:2.9, keyword:'IDEA', text:'Una idea puede moverlo todo.',
    concepts:[], mode:'editorial-text', cue:'statement' }),
])
