// Control negativo sin editar el bundle: la suite REAL debe rechazar ambos contadores corruptos.
// electron tests/aceptacion/mvp-guardias.cjs nominal|controles   -> exit 1 esperado.
const Module=require('module'),path=require('path')
const repo=path.resolve(__dirname,'../..'),modo=process.argv[2]
if(!['nominal','controles'].includes(modo))throw Error('Mutacion requerida')
const cargar=Module._load
Module._load=function(padre,...args){
  const b=cargar.call(this,padre,...args)
  if(String(padre).replace(/\\/g,'/').endsWith('/dist-electron/main/index.js'))return {...b,
    combinacionesLegales:op=>{
      const r=b.combinacionesLegales(op)
      return modo==='nominal'&&!op?.incluirPruebas?{...r,instancias:r.instancias+1}:
        modo==='controles'&&op?.incluirPruebas?{...r,identidades:r.identidades+1}:r
    }}
  return b
}
require(path.join(repo,'tests/ciclo.js'))
