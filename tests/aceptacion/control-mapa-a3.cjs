// Control causal: ejecutar LA suite existente con un solo valor restaurado en memoria.
const {app}=require('electron')
const fs=require('fs'),path=require('path'),os=require('os')
process.on('uncaughtException',e=>{console.error(e);app.exit(1)})
const repo=path.resolve(process.argv[2]),tamano=Number(process.argv[3])
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'cipher-a3-mapa-control-')))
process.chdir(app.getPath('userData'));delete process.env.VITE_DEV_SERVER_URL
global.fetch=async()=>{throw new Error('Sin red')}
const b=require(path.join(repo,'dist-electron/main/index.js'))
b.METRICAS_ETIQUETA[b.METRICA_ETIQUETA].fuenteCqmin=tamano
console.log('CONTROL SOLO EN MEMORIA fuenteCqmin='+tamano)
require(path.join(repo,'tests/mapa.js'))
