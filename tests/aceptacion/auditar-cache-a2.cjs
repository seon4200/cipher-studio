const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto')
const { spawn } = require('child_process')
const repo = path.resolve(process.argv[2]), salida = path.resolve(process.argv[3])
const proyectos = path.join(repo, 'proyectos')
fs.mkdirSync(salida, { recursive: true })
function inventario() {
  const entradas = []
  function andar(dir) {
    if (!fs.existsSync(dir)) return
    for (const d of fs.readdirSync(dir, {withFileTypes:true})) {
      const p=path.join(dir,d.name)
      if(d.isSymbolicLink()) throw new Error('No se audita un enlace: '+p)
      if(d.isDirectory()) andar(p)
      else {
        const s=fs.statSync(p)
        entradas.push({ruta:path.relative(proyectos,p),bytes:s.size,mtimeMs:s.mtimeMs,
          sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')})
      }
    }
  }
  for(const p of fs.readdirSync(proyectos,{withFileTypes:true}).filter(p=>p.isDirectory())) {
    andar(path.join(proyectos,p.name,'cache','graficos'))
    andar(path.join(proyectos,p.name,'materiales','visual'))
  }
  return entradas.sort((a,b)=>a.ruta.localeCompare(b.ruta))
}
// El hash inicial lee ficheros y puede actualizar atime. Se hace antes de vigilar
// el render: no mezclar notificaciones del inventario con escrituras del motor.
const antes=inventario()
const eventos=[]
const vigia=fs.watch(proyectos,{recursive:true},(evento,nombre)=>{
  const n=String(nombre||'').replace(/\\/g,'/')
  if(!nombre || /\/(cache\/graficos|materiales\/visual)(\/|$)/.test(n)) eventos.push({evento,nombre:n})
})
vigia.on('error',e=>eventos.push({error:String(e)}))
const log=fs.openSync(path.join(salida,'m7.log'),'w')
const hijo=spawn(process.execPath,[path.join(repo,'node_modules/electron/cli.js'),
  path.join(repo,'tests/rendimiento/escena-m7.cjs'),repo,path.join(salida,'m7')],
  {cwd:os.tmpdir(),stdio:['ignore',log,log],windowsHide:true})
const reloj=setTimeout(()=>hijo.kill(),150000)
hijo.on('exit',(codigo,signal)=>setTimeout(()=>{
  clearTimeout(reloj); fs.closeSync(log)
  vigia.close(); const despues=inventario()
  const r=JSON.parse(fs.readFileSync(path.join(salida,'m7/resultado.json'),'utf8'))
  const dentro=(p,base)=>{const rel=path.relative(base,p);return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)}
  const temporal=dentro(r.runtime,os.tmpdir()) && dentro(r.proyecto,r.runtime) &&
    r.muestras.length===6 && r.muestras.every(m=>dentro(m.ruta,r.runtime)&&!dentro(m.ruta,proyectos))
  const sinCambios=JSON.stringify(antes)===JSON.stringify(despues)
  const informe={fechaUTC:new Date().toISOString(),repo,proyectos,codigo,signal,
    antes,despues,eventos,temporal,sinCambios,runtime:r.runtime,proyecto:r.proyecto,
    destinos:r.muestras.map(m=>m.ruta),criteriosM7:r.criteriosM7,
    pasa:codigo===0&&temporal&&sinCambios&&eventos.length===0}
  fs.writeFileSync(path.join(salida,'auditoria.json'),JSON.stringify(informe,null,2)+'\n')
  const resumir=xs=>({entradas:xs.length,bytes:xs.reduce((n,f)=>n+f.bytes,0),
    sha256Inventario:crypto.createHash('sha256').update(JSON.stringify(xs)).digest('hex')})
  fs.writeFileSync(path.join(salida,'resumen.json'),JSON.stringify({...informe,antes:resumir(antes),despues:resumir(despues)},null,2)+'\n')
  console.log(JSON.stringify({...informe,antes:antes.length,despues:despues.length},null,2))
  process.exitCode=informe.pasa?0:1
},1000))
