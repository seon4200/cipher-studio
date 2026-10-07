// Frozen synthetic structural corpus. These are not scenes from a user project.
// Relation and the three literal subjects are declared together; no relation is
// inferred from an isolated keyword. The resolver still chooses the family.
const subjects = [
  { label: 'cámara', canonicalHint: 'camera', emoji: '📷' },
  { label: 'robot', canonicalHint: 'robot', emoji: '🤖' },
  { label: 'teléfono', canonicalHint: 'phone', emoji: '📱' },
]
const familyCases = [
  ['editorial','', 'La incertidumbre exige una respuesta honesta.', 'INCERTIDUMBRE', []],
  ['marcoPoster','documenta','La cámara documenta al robot y al teléfono.','CÁMARA',subjects],
  ['partidoVertical','compara','Comparamos cámara, robot y teléfono.','COMPARACIÓN',subjects],
  ['cintaDiagonal','impulsa','La cámara impulsa al robot y al teléfono en la demostración.','IMPULSO',subjects],
  ['anillosConcentricos','enfoca','La cámara enfoca al robot mientras el teléfono registra la imagen.','ENFOQUE',subjects],
  ['rayosImpacto','impacta','La cámara capta el impacto; robot y teléfono reciben la señal.','IMPACTO',subjects],
  ['cuaderno','documenta','La cámara documenta la prueba del robot y del teléfono.','PRUEBA',subjects],
  ['constelacion','conecta','La cámara conecta robot y teléfono.','CONEXIÓN',subjects],
  ['capasApiladas','compone','La cámara, el robot y el teléfono componen un sistema.','SISTEMA',subjects],
  ['redNodos','red','La cámara envía datos al robot y al teléfono en una red.','RED',subjects],
  ['lineaTiempo','secuencia','Primero la cámara registra, después el robot procesa y finalmente el teléfono muestra.','SECUENCIA',subjects],
  ['corteTransversal','parte','La cámara, el robot y el teléfono son partes de una instalación.','INSTALACIÓN',subjects],
  ['abanicoTarjetas','alternativas','Cámara, robot y teléfono son tres alternativas para esta demostración.','ALTERNATIVAS',subjects],
  ['engranajes','coopera','La cámara, el robot y el teléfono cooperan para registrar la prueba.','COOPERACIÓN',subjects],
  ['cascada','causa','La cámara registra; el robot procesa y el teléfono muestra el resultado.','RESULTADO',subjects],
  ['mundoIsometrico','sistema','Cámara, robot y teléfono forman un sistema de observación.','OBSERVACIÓN',subjects],
  ['pilaVertical','niveles','Cámara, robot y teléfono forman tres niveles de la instalación.','NIVELES',subjects],
].map(([family,relation,text,keyword,concepts])=>Object.freeze({id:`family-${family}`,targetFamily:family,
  relation,text,keyword,concepts:Object.freeze(concepts.map(item=>Object.freeze({...item})))}))

const narrativeCases = [
  ['object','La cámara registra la escena.','CÁMARA','documenta',[subjects[0]]],
  ['support','El robot recibe la imagen de la cámara.','ROBOT','conecta',[subjects[1],subjects[0]]],
  ['person','Una científica opera la cámara.','CIENTÍFICA','documenta',[
    {label:'científica',canonicalHint:'scientist',emoji:'👩‍🔬'},subjects[0]]],
  ['place','La ciudad contiene edificios y calles.','CIUDAD','contexto',[
    {label:'ciudad',canonicalHint:'city',emoji:'🏙️'}]],
  ['symbol','La pregunta sigue abierta.','PREGUNTA','documenta',[
    {label:'pregunta',canonicalHint:'question',emoji:'❓'}]],
  ['datum','El resultado confirmado alcanza el 72%.','RESULTADO','documenta',[
    {label:'resultado',canonicalHint:'result'}]],
  ['compare','Comparamos cámara y teléfono.','DISTINTAS','compara',[subjects[0],subjects[2]]],
  ['process','Primero cámara registra, luego robot procesa, finalmente teléfono muestra.','PROCESO','secuencia',subjects],
  ['timeline','La cámara registró antes; el robot procesó después; el teléfono mostró el resultado.','ANTES','antes despues',subjects],
  ['relationship','Cámara, robot y teléfono intercambian información.','CONEXIÓN','conecta',subjects],
  ['statement','Una respuesta todavía no está confirmada.','INCERTIDUMBRE','',[]],
  ['warning','La señal advierte de un peligro concreto.','PELIGRO','advierte',[
    {label:'señal',canonicalHint:'signal',emoji:'⚠️'}]],
].map(([id,text,keyword,relation,concepts])=>Object.freeze({id:`narrative-${id}`,text,keyword,relation,
  concepts:Object.freeze(concepts.map(item=>Object.freeze({...item})))}))

const stressCases = [
  ['long-word','La extraordinariamente larga palabra inconstitucionalidad conserva su significado.','INCONSTITUCIONALIDAD',[]],
  ['long-text','Una respuesta completa mantiene la negación, el contexto y cada palabra importante sin inventar una conclusión.','RESPUESTA',[]],
  ['short-scene','Cuidado.','CUIDADO',[]],
  ['two-supports','La cámara, el robot y el teléfono muestran proporciones diferentes.','PROPORCIONES',subjects],
  ['no-support','La cámara registra.','CÁMARA',[subjects[0]]],
  ['no-asset','No hay respuesta confirmada.','INCERTIDUMBRE',[]],
  ['date','La cámara registró el evento en 2026.','2026',[subjects[0]]],
  ['punctuation','¿Qué pasó realmente? Nadie lo sabe todavía.','¿QUÉ PASÓ?',[]],
].map(([id,text,keyword,concepts])=>Object.freeze({id:`stress-${id}`,text,keyword,
  relation:'',concepts:Object.freeze(concepts.map(item=>Object.freeze({...item})))}))

module.exports = Object.freeze({familyCases:Object.freeze(familyCases),
  narrativeCases:Object.freeze(narrativeCases),stressCases:Object.freeze(stressCases)})
