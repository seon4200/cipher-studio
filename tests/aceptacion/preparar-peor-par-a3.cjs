// A.3: peor par que la puerta admite en el tamaño que se está probando.
// Importa la puerta del bundle compilado; no fabrica ni reimplementa su cota.
const {app}=require('electron')
const fs=require('fs'),path=require('path'),os=require('os')
const repo=path.resolve(process.argv[2]),out=path.resolve(process.argv[3])
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'cipher-a3-peor-par-')))
process.chdir(app.getPath('userData'))
global.fetch=async()=>{throw new Error('Sin red')}
app.whenReady().then(()=>{
  try {
    const bundle=require(path.join(repo,'dist-electron/main/index.js'))
    const previo=JSON.parse(fs.readFileSync(path.join(repo,'tests/aceptacion/plan-a3-20260905/aplicado.json')))
    const referencia=previo.capturas.find(c=>c.id==='referencia-17')?.graphicData
    if(!referencia)throw Error('Falta la referencia A.3')
    const etiqueta='@'.repeat(bundle.MAX_CARACTERES_ETIQUETA)
    if(!bundle.cabeLaEtiqueta(etiqueta))throw Error('La puerta no admite su propio maximo')
    const direccion={...referencia.extra.direccion,estructura:'constelacion'}
    const conceptos=['🧠','📁','🔗'].map(emoji=>({emoji,etiqueta}))
    fs.mkdirSync(out,{recursive:true})
    fs.writeFileSync(path.join(out,'corpus-posiciones.json'),JSON.stringify({
      procedencia:{tipo:'peor-par-admisible-a3',origen:'MAX_CARACTERES_ETIQUETA y cabeLaEtiqueta del bundle compilado',etiqueta,longitud:etiqueta.length,puerta:bundle.MAX_CARACTERES_ETIQUETA,direccion},
      casos:[{linea:'peor-par-admisible',value:referencia.value,conceptos,direccion}]
    },null,2)+'\n')
    console.log(JSON.stringify({etiqueta,longitud:etiqueta.length,direccion}))
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
