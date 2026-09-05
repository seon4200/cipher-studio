const fs=require('fs'),path=require('path');const repo=process.argv[2],out=process.argv[3];
const f=JSON.parse(fs.readFileSync(path.join(repo,'tests/aceptacion/plan-a3-20260905/aplicado.json')));
const g=f.capturas.find(c=>c.id==='referencia-17').graphicData;
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'corpus-posiciones.json'),JSON.stringify({procedencia:{tipo:'control-fuera-de-muestra',origen:'plan-a3-20260905/aplicado.json: referencia-17; NO forma parte de las 321'},casos:[{linea:'referencia-17',value:g.value,conceptos:g.extra.conceptos,direccion:g.extra.direccion}]},null,2)+'\n');
