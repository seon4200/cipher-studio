# QC Scene Recipe V1 — puertas futuras

Estado: especificación. Validar JSON documental no acredita legibilidad, metáfora correcta, movimiento o render. En implementación, las pruebas importarán consumidores reales; no reimplementarán geometría ni lógica de selección.

| Puerta | Evidencia / respuesta al fallo |
|---|---|
| 1. Metáfora concreta | relación defendible frase↔objeto; sin ella permitir receta tipográfica sin Hero |
| 2. No stock genérico | candidato corresponde a metáfora, no primer resultado de palabra |
| 3. Hero dominante | evaluación visual al tamaño de salida; exento fallback tipográfico |
| 4. Roles sin competencia | jerarquía visible, apoyos no ocultan Hero/texto |
| 5. Máximo de elementos | conteo de entidades semánticas según densidad; textura no es escondite |
| 6. Texto legible | glifos, líneas, tiempo de lectura y fuente reales; no basta contar palabras |
| 7. Contraste exacto | medir detrás de texto sobre fondo/asset/tinte en intervalos visibles |
| 8. Bounds completos | entrada, overshoot, sustain, emphasis, salida y extremos de cámara; intervalos de salida deliberada separados de lectura |
| 9. Archivo presente | resolver antes de hash y garantizar disponibilidad hasta captura |
| 10. SHA correcta | verificar bytes finales, incluido derivado, y bounds/revisión usados |
| 11. Riesgo aceptable | procedencia y licencia por asset; no aprobación por extensión |
| 12. Fallback definido | todos motivos llevan a decisión trazable, presente/ausente no comparten identidad |
| 13. Motion semántico | motivo ligado a narración; no amplitud libre |
| 14. Shake motivado | reason concreto y máximo un énfasis por escena |
| 15. Tiempo normalizado | valores finitos 0..1, ventanas válidas, sustain ciclo/divisor cerrado |
| 16. Geometría única | estructura produce placement y envelope; Recipe no coordenadas de escena |
| 17. Recipe limpia | ninguna URL/path/proveedor ni bytes/SHA resueltos; sólo slots/intenciones |

## Comprobaciones documentales de este encargo

El JSON de ejemplos debe tener 18 entradas (3 por perfil), referencias válidas, texto <=8 palabras, uno o cero emphasis en toda escena, ventanas dentro de visibility, tres scale-in/overshoot, tres slides, tres floats, tres punch/shake con motivo, tres salidas y tres tipos de transición. Ningún asset de ejemplo está resuelto; no URLs/paths/hex/hashes inventados.

Estos conteos prueban cobertura de la especificación, no acierto visual. Motion, contraste, safe zones, lectura, coste y metáforas deberán comprobarse sobre renderer real más revisión humana en las fases previstas.

## Integración y cachés

Antes de implementar, ampliar de forma coherente hash de archivo y clave del árbol React de escena, no sólo extra. Guardar renderTier y timing efectivo. Si coste exige tier distinto, nueva identidad y aviso; no reducir silenciosamente contenido. Medir caché existente antes de proponer render incremental.

## Evidencia documental 3.3.5

Conteo sobre `ejemplos-scene-recipe-v1.json` de esta rama, base `291069e`:
18 ejemplos, tres por cada uno de seis perfiles; 8 Hero scale-in/overshoot, 6
slide-in, 5 float, 7 punch/shake con motivo, 18 salidas y cinco transitionIntent
(cuatro distintos de none). Ninguna escena tiene más de un énfasis. No se
midieron píxeles ni se llamó al renderer.

Reproducción desde raíz del repo: ejecutar este bloque JavaScript con Node.
Sólo lee el JSON documental; no descarga, modifica archivos ni reimplementa
funciones de producción. Sirve para chequear ejemplos, no para aprobar el motor.

```javascript
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('docs/asset-engine/ejemplos-scene-recipe-v1.json','utf8'));
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
const count={scale:0,slide:0,float:0,emphasis:0,exit:0,transitions:new Set(),profiles:{}};
const unit=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
const window=(o,where)=>assert(unit(o.start)&&unit(o.duration)&&o.duration>0&&o.start+o.duration<=1+1e-9,where);
assert(d.examples.length===18,'18 ejemplos');
for(const e of d.examples){
 const r=e.SceneRecipe, intent=e.SceneIntent, sub=d.ProjectSubstrates[r.projectSubstrateRef];
 assert(sub&&r.sceneIntentRef===intent.id,'referencias');
 count.profiles[sub.primaryStyle]=(count.profiles[sub.primaryStyle]||0)+1;
 const words=[r.text.connector,intent.keyword,r.text.closing].filter(Boolean).join(' ').trim().split(/\s+/).length;
 assert(words<=8,'palabras '+e.id);
 assert(r.text.timing.connectorStart<=r.text.timing.keywordStart,'texto');
 if(r.text.closing)assert(r.text.timing.keywordStart<=r.text.timing.closingStart,'cierre');
 assert(r.assetSlots.filter(s=>s.role==='hero').length===1,'hero');
 assert(r.assetSlots.filter(s=>s.role!=='texture').length<=4,'semanticos');
 let emph=0;
 assert(new Set(r.assetSlots.map(s=>s.id)).size===r.assetSlots.length,'slot IDs');
 for(const s of r.assetSlots){
   assert(['hero','support','decorator','badge','texture'].includes(s.role),'role');
   assert(typeof s.optional==='boolean' && s.intent.trim(),'slot contract');
   assert(s.fallback.every(f=>['next-candidate','generic-illustration','solar','omit','editorial-text'].includes(f)),'fallback');
   assert(s.optional || !s.fallback.includes('omit'),'required slot omit');
   const m=s.motion;
   assert(['fade-in','fade-slide','slide-left','slide-right','slide-up','slide-down','scale-in','scale-overshoot','whip-in'].includes(m.entry.preset),'entry preset');
   assert(['float','breathe','soft-rotate','parallax-drift','slow-zoom','sway','hold','none'].includes(m.sustain.preset),'sustain preset');
   assert(['fade-out','scale-down','scale-cover','slide-out-left','slide-out-right','slide-out-up','slide-out-down','whip-out','none'].includes(m.exit.preset),'exit preset');
   assert(m.visibility.start>=0&&m.visibility.end<=1&&m.visibility.end>m.visibility.start,'visibility');
   window(m.entry,'entry'); if(m.exit.preset!=='none')window(m.exit,'exit');
   if(m.sustain.preset!=='none'){window(m.sustain,'sustain');assert(m.sustain.start>=m.entry.start+m.entry.duration-1e-9,'sustain entry');}
   if(m.sustain.cycleDivisor)assert([2,3,4,5,6,8,10,12].includes(m.sustain.cycleDivisor),'divisor');
   if(m.sustain.preset==='hold')assert(['manual','narration-pause','dramatic-emphasis'].includes(m.sustain.reason),'hold reason');
   for(const hit of m.emphasis){
    emph++; assert(hit.reason.trim(),'reason');
    assert(m.sustain.preset!=='hold','emphasis en hold'); assert(unit(hit.duration)&&hit.duration>0,'duration');
    const time=hit.trigger.kind==='hero-entry'?r.assetSlots.find(x=>x.role==='hero').motion.entry.start+r.assetSlots.find(x=>x.role==='hero').motion.entry.duration:hit.trigger.normalizedTime;
    assert(unit(time)&&time+hit.duration<=m.visibility.end,'hit');
    if(m.exit.preset!=='none')assert(time+hit.duration<=m.exit.start,'hit exit');
   }
 }
 assert(emph<=1,'max un emphasis');
 const h=r.assetSlots.find(s=>s.role==='hero').motion;
 if(['scale-in','scale-overshoot'].includes(h.entry.preset))count.scale++;
 if(h.entry.preset.startsWith('slide-'))count.slide++;
 if(h.sustain.preset==='float')count.float++;
 if(h.emphasis.some(x=>['punch','shake-short'].includes(x.preset)))count.emphasis++;
 if(h.exit.preset!=='none')count.exit++;
 count.transitions.add(r.transitionIntent);
 function walk(o){if(!o||typeof o!=='object')return; for(const [k,v] of Object.entries(o)){
 assert(!['url','path','sha256','provider','sourceUrl','localFile','x','y'].includes(k),'campo prohibido '+k);
 if(typeof v==='string')assert(!/https?:\/\/|#[0-9a-f]{6}\b|[a-f0-9]{64}/i.test(v),'valor prohibido'); else walk(v);
 }}
 walk(r);walk(intent);
}
assert(Object.keys(count.profiles).length===6&&Object.values(count.profiles).every(n=>n===3),'3 por perfil');
for(const key of ['scale','slide','float','emphasis','exit'])assert(count[key]>=3,key);
assert(count.transitions.size>=3,'transiciones');
console.log(JSON.stringify({...count,transitions:[...count.transitions]},null,2));
```
