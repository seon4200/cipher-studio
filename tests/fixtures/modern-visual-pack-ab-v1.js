// Supplementary presentation-controlled comparisons, not a semantic holdout.
// Frozen before their first execution; the original 20+8 corpus remains unchanged.
module.exports = [
  ['phone','TELÉFONO','El teléfono permite comunicarse.','teléfono','phone','📱'],
  ['laptop','PORTÁTIL','El portátil muestra un documento.','portátil','laptop','💻'],
  ['tree','ÁRBOL','El árbol crece junto al camino.','árbol','tree','🌳'],
  ['book','LIBRO','El libro conserva una historia.','libro','book','📖'],
  ['fire','FUEGO','El fuego ilumina la escena.','fuego','fire','🔥'],
  ['rocket','COHETE','El cohete inicia su viaje.','cohete','rocket','🚀'],
].map(([id,keyword,text,label,canonicalHint,emoji])=>({id,keyword,text,
  concepts:[{label,canonicalHint,emoji}],mode:'auto',duration:2,stress:false}));
