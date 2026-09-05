const {app}=require('electron')
const fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm'),crypto=require('crypto')
process.on('uncaughtException',e=>{console.error(e);app.exit(1)})
const repo=path.resolve(process.argv[2]),out=path.resolve(process.argv[3])
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'cipher-a3-pares-')));process.chdir(app.getPath('userData'))
global.fetch=async()=>{throw new Error('Sin red')};delete process.env.VITE_DEV_SERVER_URL
const sha=x=>crypto.createHash('sha256').update(x).digest('hex')
const proyecto=path.join(repo,'proyectos/video-3-1788402898964/project-state.json')
const fixture=path.join(repo,'tests/aceptacion/plan-a2-impacto-20260905/etiquetas.json')
const guardado=path.join(repo,'tests/aceptacion/plan-a3-pares-20260905/corpus-posiciones.json')
const original=fs.existsSync(proyecto)
const copia=original?null:JSON.parse(fs.readFileSync(guardado))
const s=original?JSON.parse(fs.readFileSync(proyecto)).transcriptSegments:copia.segmentos
const f=JSON.parse(fs.readFileSync(fixture))
const lineas=f.lineas.filter(x=>x.texto.includes('CONCEPTOS lote='))
for(const l of lineas){const i=+l.texto.match(/pos=(\d+):/)[1];if(s[i].text.trim().replace(/\s+/g,' ').slice(0,80)!==l.texto.match(/frase="(.*)"$/)[1])throw new Error('No coincide la frase '+i)}
const items=lineas.filter(l=>l.texto.includes('saneado=OK')).map(l=>{
  const pos=l.texto.match(/pos=(\d+):(\d+)/)
  return {phraseIndex:+pos[1],clipIndexInPhrase:+pos[2],linea:l.linea,
    conceptos:l.texto.match(/saneado=OK  (.+)  frase=/)[1].split(' | ').map(c=>({emoji:c.slice(0,c.indexOf(' ')),etiqueta:c.slice(c.indexOf(' ')+1)}))}
})
const bundlePath=path.join(repo,'dist-electron/main/index.js'),codigo=fs.readFileSync(bundlePath,'utf8'),b=require(bundlePath)
const ts=require(path.join(repo,'node_modules/typescript')),ast=ts.createSourceFile('bundle.js',codigo,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS)
function unica(nombre,funcion=false){const ns=[];function visita(n){if((funcion?ts.isFunctionDeclaration(n):ts.isVariableDeclaration(n))&&n.name?.getText(ast)===nombre)ns.push(n);ts.forEachChild(n,visita)}visita(ast);if(ns.length!==1)throw Error('AST ambiguo '+nombre);return funcion?ns[0].getText(ast):ns[0].initializer.getText(ast)}
// Se ejecuta el callback COMPILADO del handler: no se copia el reparto de sus intervalos.
const seleccion=unica('conPalabra'),recorte=unica('recortarTexto',true),maximo=unica('MAX_CARACTERES_VISUAL')
const ctx={visuales:items,newAudioSegments:s,palabraDelTramo:b.palabraDelTramo}
const elegidas=vm.runInNewContext(seleccion,ctx)
const cortar=vm.runInNewContext('const MAX_CARACTERES_VISUAL='+maximo+';'+recorte+';recortarTexto',{})
const casos=elegidas.map(({item,palabra})=>{const value=palabra?cortar(palabra):null;return {...item,value,direccion:value?b.direccionDe(b.semillaDe(value)):null}})
fs.mkdirSync(out,{recursive:true})
const datos={procedencia:{proyecto:path.relative(repo,proyecto),proyectoSHA256:original?sha(fs.readFileSync(proyecto)):copia.procedencia.proyectoSHA256,origenLectura:original?'proyecto original':'extracto versionado (sin configuracion ni credenciales)',fixtureSHA256:sha(fs.readFileSync(fixture)),bundleSHA256:sha(fs.readFileSync(bundlePath)),seleccionCompilada:seleccion,recorteCompilado:recorte,maximoCompilado:maximo},segmentos:s.map(({text,start,end,words})=>({text,start,end,words:words.map(({word,start,end})=>({word,start,end}))})),casos}
fs.writeFileSync(path.join(out,'corpus-posiciones.json'),JSON.stringify(datos,null,2)+'\n')
console.log(JSON.stringify({frasesCoincidentes:lineas.length,segmentos:s.length,casos:casos.length,sinPalabra:casos.filter(c=>!c.value).map(c=>c.linea),estructuras:casos.reduce((a,c)=>{const e=c.direccion?.estructura||'sin-palabra';a[e]=(a[e]||0)+1;return a},{})}))
app.exit(0)
