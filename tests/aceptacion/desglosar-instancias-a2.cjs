// Diagnostico: cada fila la cuenta el bundle, sin una segunda combinacionesLegales.
const path = require('path'), fs = require('fs'), os = require('os')
const repo = path.resolve(process.argv[2] || path.join(__dirname, '../..'))
const { app } = require('electron')
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-conteo-')))
process.chdir(app.getPath('userData'))
delete process.env.VITE_DEV_SERVER_URL
try {
  const b = require(path.join(repo, 'dist-electron/main/index.js'))
  const fondos = Object.values(b.FONDOS_ESCENA), camaras = Object.values(b.CAMARAS_ESCENA)
  const piezas = [...fondos, ...camaras]
  const originales = piezas.map(p => ({ p, prueba: p.prueba, tiene: Object.hasOwn(p, 'prueba') }))
  const energia = b.CAMARAS_ESCENA.deriva.energia
  const restaurar = () => originales.forEach(({p,prueba,tiene}) => { if(tiene) p.prueba=prueba; else delete p.prueba })
  const informe = { actual: b.combinacionesLegales(), pesos: {}, filas: [] }
  for (const [eje, registro] of Object.entries({fondos:b.FONDOS_ESCENA, camaras:b.CAMARAS_ESCENA, estructuras:b.ESTRUCTURAS_ESCENA}))
    informe.pesos[eje] = Object.values(registro).filter(p=>!p.prueba).map(p=>({id:p.id, pasos:p.rangos.map(r=>r.pasos), instancias:b.instanciasDe(p.rangos)}))
  try {
    for (const e of [2, 1]) {
      restaurar(); b.CAMARAS_ESCENA.deriva.energia=e
      informe['energia'+e]=b.combinacionesLegales()
      const fsReales=fondos.filter(p=>!p.prueba), csReales=camaras.filter(p=>!p.prueba)
      for (const f of fsReales) for (const c of csReales) {
        restaurar()
        for (const p of fondos) if(p!==f) p.prueba=true
        for (const p of camaras) if(p!==c) p.prueba=true
        informe.filas.push({energia:e,fondo:f.id,camara:c.id,...b.combinacionesLegales()})
      }
    }
  } finally { restaurar(); b.CAMARAS_ESCENA.deriva.energia=energia }
  if(process.argv[3]) fs.writeFileSync(process.argv[3],JSON.stringify(informe,null,2)+'\n')
  console.log(JSON.stringify(informe,null,2)); app.exit(0)
} catch(e) { console.error(e); app.exit(1) }
