// Frozen controlled synthetic inputs, not reconstructed user-video evidence.
const rows = [
  ['camera','CÁMARA','Una cámara registra una imagen.',[['cámara','camera','📷']]],
  ['robot-wallet','ROBOT','El robot observa una billetera.',[['robot','robot','🤖'],['billetera','wallet']]],
  ['chip-engine','CHIP','El chip controla el motor.',[['chip','chip'],['motor','engine']]],
  ['factory-student','FÁBRICA','Un estudiante visita la fábrica.',[['fábrica','factory','🏭'],['estudiante','student']]],
  ['teacher-chart','PROFESOR','El profesor explica un gráfico.',[['profesor','teacher'],['gráfico','chart']]],
  ['symbol-clock','TIEMPO','El reloj representa el paso del tiempo.',[['reloj','clock']]],
  ['football','FÚTBOL','El balón es parte del fútbol.',[['fútbol','football','⚽']]],
  ['microscope-drone','CIENCIA','Un microscopio y un dron son herramientas diferentes.',[['microscopio','microscope'],['dron','drone']]],
  ['house-book','CASA','En la casa hay un libro abierto.',[['casa','house','🏠'],['libro','book','📖']]],
  ['city','CIUDAD','La ciudad reúne edificios y personas.',[['ciudad','city','🏙️']]],
  ['construction','CONSTRUYERON','Construyeron una escuela con una grúa.',[['escuela','school'],['grúa','crane']]],
  ['machine','MÁQUINA','El motor es parte de una máquina.',[['motor','engine'],['máquina','machine']]],
  ['photo-person','PERSONA','Una mujer observa el paisaje.',[['mujer','woman','👩']]],
  ['photo-context','PROTESTA','La protesta ocupa la plaza.',[['protesta','protest']]],
  ['result','RESULTADO','El resultado alcanza el 72%.',[['resultado','result']]],
  ['scientist','CIENTÍFICO','El científico estudia una muestra.',[['científico','scientist','🧑‍🔬']]],
  ['history','HISTORIA','La historia conserva archivos.',[['historia','history'],['archivo','archive']]],
  ['danger','PELIGRO','Una advertencia señala el peligro.',[['peligro','danger','⚠️']]],
  ['project','PROYECTO','El proyecto sigue un plan.',[['proyecto','project'],['plan','plan']]],
  ['uncertainty','INCERTIDUMBRE','La incertidumbre permanece sin una respuesta.',[['incertidumbre','uncertainty','❓']]],
  ['long-word','INCONSTITUCIONALIDAD','La palabra inconstitucionalidad necesita espacio.',[], 'editorial-text'],
  ['three','TECNOLOGÍA','La cámara, el robot y el teléfono permiten observar y comunicar.',[['cámara','camera','📷'],['robot','robot','🤖'],['teléfono','phone','📱']]],
  ['no-hero','PENSAR','Pensar antes de actuar.',[], 'editorial-text'],
  ['missing-modern','VIOLÍN','El violín produce música.',[['violín','violin','🎻']]],
  ['ambiguous','BANCO','La palabra banco necesita contexto.',[], 'editorial-text'],
  ['direct-openmoji','PASTEL','Un pastel acompaña la celebración.',[['1F382','1F382']]],
  ['long-phrase','RESPUESTA','Una respuesta completa conserva cada palabra, cada cifra y cada negación sin inventar una conclusión.',[], 'editorial-text'],
  ['support-only','DINERO','El robot encuentra dinero y una billetera.',[['robot','robot','🤖'],['dinero','money'],['billetera','wallet']]],
].map(([id,keyword,text,concepts,mode],i)=>({id,keyword,text,concepts:concepts.map(([label,canonicalHint,emoji])=>({label,canonicalHint,emoji})),mode:mode??'auto',duration:2,stress:i>=20}));
function context(bundle,row,i,modern=true) {
  const localSemantic=bundle.createLocalSceneSemanticV1({sceneId:row.id,start:0,end:2,
    transcriptSegments:[{start:0,end:2,text:row.text}],concepts:row.concepts.map(c=>({...c,start:.05,end:1.9,scope:'scene'})),
    anchor:row.concepts[0]?.label,globalText:row.text,globalHints:[],globalContextRef:'synthetic:modern-pack'});
  return bundle.createModernVisualGenerationContextV2({sceneId:row.id,duration:row.duration,localSemantic,
    keywordCandidates:[{keyword:row.keyword,source:'scene-semantic'}],preferredVisualMode:row.mode,sistema:'editorial',
    direction:{fondo:'ondas',estructura:'marcoPoster',camara:'quieto',densidad:'media',ritmo:'simultaneo',semilla:32001+i},
    videoStyleId:'cream-editorial',presentationProfile:bundle.PREMIUM_TYPE_COLOR_PROFILE_V1,
    colorPalettePlan:{version:1,primaryFamily:'blue-tech',compatibleFamilies:[],revision:bundle.COLOR_PALETTE_REVISION_V1},
    ...(modern?{visualAssetPack:bundle.MODERN_VISUAL_PACK_V1}:{})});
}
module.exports={rows,context};
