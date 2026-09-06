// Inventario y cadena del hash desde el bundle; no ejecuta ningun render.
const {app,session}=require('electron')
const fs=require('fs'),path=require('path'),os=require('os')
const {execFileSync}=require('child_process')
const repo=path.resolve(__dirname,'../..'),salida=path.join(__dirname,'mvp-paso7')
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'cipher-inventario-')))
global.fetch=async()=>{throw Error('Inventario sin red')}
app.whenReady().then(()=>{
  session.defaultSession.webRequest.onBeforeRequest((r,cb)=>cb({cancel:/^https?:/.test(r.url)}))
  const b=require(path.join(repo,'dist-electron/main/index.js'))
  const activo=reg=>Object.values(reg).filter(p=>!p.prueba&&p.formatos.includes('9:16'))
  const fondos=activo(b.FONDOS_ESCENA),camaras=activo(b.CAMARAS_ESCENA),estructuras=activo(b.ESTRUCTURAS_ESCENA),fuentes=activo(b.TIPOGRAFIAS)
  const porEnergia=ps=>ps.reduce((a,p)=>(a[p.energia]=(a[p.energia]||0)+1,a),{})
  const pares=[]
  for(const f of fondos)for(const c of camaras)if(f.energia+c.energia<=3){
    let nominal=0,identidades=0
    for(const e of estructuras){
      const n=fuentes.filter(t=>e.tipografias.includes(t.rol)).length*Object.keys(b.DENSIDAD_A_N).length*b.RITMOS.length
      identidades+=n;nominal+=n*b.instanciasDe(f.rangos)*b.instanciasDe(e.rangos)*b.instanciasDe(c.rangos)
    }
    pares.push({fondo:f.id,camara:c.id,identidades,nominal})
  }
  const ids=['video-a','video-b','video-c','video-d','video-e','video-f',path.join(repo,'proyectos/video-3-1788402898964')]
  const g={type:'visual_escena',value:'memoria',extra:{conceptos:[{emoji:'🧠',etiqueta:'recuerdo'},{emoji:'🗂️',etiqueta:'archivo'},{emoji:'🔗',etiqueta:'conexion'}]}}
  g.extra.direccion=b.direccionDe(b.semillaDe(g.value),{texto:g.value,conceptos:g.extra.conceptos})
  const cadena=ids.map(id=>({id,sistema:b.sistemaDeGeneracion(id),hash:b.hashGrafico(g,1080,1920,3,30,'pantalla',b.sistemaDeGeneracion(id))}))
  const estado=JSON.parse(fs.readFileSync(path.join(repo,'proyectos/video-3-1788402898964/project-state.json'),'utf8'))
  const palabras=[...new Set(estado.transcriptSegments.flatMap(s=>s.words||[]).map(w=>b.recortarPuntuacion(w.word)).filter(b.tieneSignificado))]
  const ilegal=[]
  for(const palabra of palabras){
    const s=b.semillaDe(palabra),d=b.direccionDe(s,{texto:palabra,conceptos:g.extra.conceptos})
    if(b.FONDOS_ESCENA[d.fondo].energia+b.CAMARAS_ESCENA[d.camara].energia>3)ilegal.push({palabra,semilla:s,direccion:d})
  }
  const documento={commit:execFileSync('git',['-c',`safe.directory=${repo.replace(/\\/g,'/')}`,'rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
    inventario:{estructuras:estructuras.map(p=>p.id),fondos:fondos.map(p=>p.id),camaras:camaras.map(p=>p.id),tipografias:fuentes.map(p=>p.id),densidades:b.DENSIDAD_A_N,ritmos:b.RITMOS},
    energia:{fondos:porEnergia(fondos),camaras:porEnergia(camaras),paresLegales:pares.length,paresCrudos:fondos.length*camaras.length},
    combinaciones:b.combinacionesLegales(),incluyendoControles:b.combinacionesLegales({incluirPruebas:true}),
    esperado:{identidades:pares.reduce((a,p)=>a+p.identidades,0),nominal:pares.reduce((a,p)=>a+p.nominal,0)},
    repartoNominalPorPar:pares,
    hash:{graphicData:g,antesSistemaFijo:b.hashGrafico(g,1080,1920,3,30,'pantalla','voltaje'),despues:cadena},
    sorteoFueraDeEnergia:{muestra:'palabras significativas unicas de la transcripcion de video 3',total:palabras.length,casos:ilegal.length,ejemplos:ilegal.slice(0,5)}}
  fs.mkdirSync(salida,{recursive:true});fs.writeFileSync(path.join(salida,'inventario.json'),JSON.stringify(documento,null,2))
  console.log(JSON.stringify({combinaciones:documento.combinaciones,energia:documento.energia,sorteoFueraDeEnergia:documento.sorteoFueraDeEnergia}))
  app.exit(0)
}).catch(e=>{console.error(e);app.exit(1)})
