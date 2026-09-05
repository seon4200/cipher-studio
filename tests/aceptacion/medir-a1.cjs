/** A.1: CSS real del banco + transform/combinaciones del bundle. Sin render de video. */
console.log('A1: inicio del arnes')
const { app, BrowserWindow, session } = require('electron')
const fs = require('fs'), path = require('path'), os = require('os')
const { createHash } = require('crypto')
const { execFileSync } = require('child_process')
const raiz = path.resolve(process.argv[2] || path.join(__dirname, '../..'))
const salida = path.resolve(process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-a1-')))
const url = 'http://127.0.0.1:5174/banco.html?vista=lote'
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-a1-perfil-')))
delete process.env.VITE_DEV_SERVER_URL
const sha = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const fixture = JSON.parse(fs.readFileSync(path.join(raiz, 'tests/aceptacion/fixtures/lote-estructuras-1.json'), 'utf8'))
// Especificacion esperada, derivada de las llamadas kf de escena.tsx, no otra implementacion.
// Comun: ondas (11 sinusoidales) + 5 decoradores + 1 pie + 0 camaras (quieto).
const comun = 11 + 5 + 1 + 0
const esperadas = { constelacion: comun + 3 + 3 + 1, capasApiladas: comun + 3 + 3,
  redNodos: comun + 22 + 3, lineaTiempo: comun + 1 + 3,
  corteTransversal: comun + 3 + 3, partidoVertical: comun + 1 + 3 }
const informe = { fechaUTC: new Date().toISOString(), url, fixture,
  versiones: process.versions, plataforma: process.platform,
  fuentesSHA256: {}, esperadas, esperadoTotal: Object.values(esperadas).reduce((a, b) => a + b, 0) }
fs.mkdirSync(salida, { recursive: true })
let ventana
const guardar = () => fs.writeFileSync(path.join(salida, 'resultado.json'), JSON.stringify(informe, null, 2) + '\n')
const watchdog = setTimeout(() => { informe.error = 'watchdog 45 s'; guardar(); app.exit(124) }, 45_000)
app.whenReady().then(async () => {
  let codigo = 1
  try {
    session.defaultSession.webRequest.onBeforeRequest((_r, cb) => {
      const u = new URL(_r.url)
      cb({ cancel: !(['file:', 'data:', 'devtools:'].includes(u.protocol) ||
        (['http:', 'ws:'].includes(u.protocol) && u.hostname === '127.0.0.1' && u.port === '5174')) })
    })
    ventana = new BrowserWindow({ show: false, width: 1620, height: 2200, useContentSize: true,
      webPreferences: { sandbox: true, backgroundThrottling: false } })
    await ventana.loadURL(url)
    console.log('A1: banco cargado; preparar captura completa')
    ventana.webContents.debugger.attach('1.3')
    await ventana.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 1620, height: 2400, deviceScaleFactor: 1, mobile: false })
    // Se espera el aviso fiable DEL BANCO. No se copia su comprobacion de fuentes.
    await ventana.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const inicio = performance.now()
      const comprobar = () => {
        if (document.querySelector('.banco-fuentes.ok') && document.querySelectorAll('[data-estructura]').length === 6) resolve(true)
        else if (performance.now() - inicio > 10000) reject(new Error('El banco no confirma fuentes/6 celdas'))
        else setTimeout(comprobar, 50)
      }; comprobar()
    })`)
    informe.banco = await ventana.webContents.executeJavaScript(`(() => {
      const definiciones = new Map()
      const celdas = [...document.querySelectorAll('[data-estructura]')].map(celda => {
        const reglas = [...celda.querySelectorAll('style')].flatMap(s => [...s.sheet.cssRules])
          .filter(r => r.type === CSSRule.KEYFRAMES_RULE)
        for (const r of reglas) {
          const textos = definiciones.get(r.name) || new Set()
          textos.add(r.cssText); definiciones.set(r.name, textos)
        }
        const animados = [...celda.querySelectorAll('*')].filter(e => getComputedStyle(e).animationName !== 'none')
        const nombres = new Set(reglas.map(r => r.name))
        return { estructura: celda.dataset.estructura, reglas: reglas.length,
          nombres: [...nombres], referenciasSinRegla: animados.flatMap(e =>
            getComputedStyle(e).animationName.split(', ').filter(n => !nombres.has(n))),
          conceptos: [...celda.querySelectorAll('.es-etq')].map(e => e.textContent),
          pie: celda.querySelector('.es-pie-tit')?.textContent }
      })
      return { celdas, total: celdas.reduce((n,c) => n+c.reglas,0),
        colisionesConContenidoDistinto: [...definiciones].filter(([n,s]) => s.size > 1).map(([n,s]) => ({nombre:n, variantes:s.size})),
        fuentes: document.querySelector('.banco-fuentes')?.textContent,
        viewport: { ancho: innerWidth, alto: innerHeight, dpr: devicePixelRatio },
        titulo: document.querySelector('h1')?.textContent }
    })()`)
    const captura = await ventana.webContents.debugger.sendCommand('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true, fromSurface: true })
    fs.writeFileSync(path.join(salida, 'hoja-a1-seis-estructuras.png'), Buffer.from(captura.data, 'base64'))
    ventana.webContents.debugger.detach()
    for (const c of informe.banco.celdas) {
      if (c.reglas !== esperadas[c.estructura] || c.referenciasSinRegla.length || c.pie !== fixture.palabra || c.conceptos.length !== 3)
        throw new Error('A.1: reglas o contenido no corresponden a ' + c.estructura)
    }
    if (informe.banco.colisionesConContenidoDistinto.length) throw new Error('A.1: colision de keyframes')
    const rutaBundle = path.join(raiz, 'dist-electron/main/index.js')
    informe.bundleSHA256 = sha(rutaBundle)
    informe.rendererFuenteSHA256 = sha(path.join(raiz, 'src/renderer/src/composiciones/escena.tsx'))
    informe.commit = execFileSync('git', ['-C', raiz, 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim()
    const bundle = require(rutaBundle)
    if (fixture.estructuras.some(id => !bundle.ESTRUCTURAS_ESCENA[id]))
      throw new Error('Bundle atrasado: faltan estructuras del fixture; recompilar antes de medir')
    informe.repertorioActual = bundle.combinacionesLegales()
    const cam = bundle.CAMARAS_ESCENA.deriva
    const energiaOriginal = cam.energia
    informe.alternativasEnergia = {}
    try {
      for (const energia of [1, 2]) {
        cam.energia = energia // Solo el objeto en este proceso aislado; no se edita produccion.
        informe.alternativasEnergia[energia] = { repertorio: bundle.combinacionesLegales(),
          conPruebas: bundle.combinacionesLegales({ incluirPruebas: true }) }
      }
    } finally { cam.energia = energiaOriginal }
    const params = Object.fromEntries(cam.rangos.map(r => [r.id, r.max]))
    // Envolvente del contrato, no instancia inventada para una captura: limites declarados,
    // f=1, 401 muestras u=i/400. Se llama al transform REAL y se leen sus coordenadas.
    const transformaciones = Array.from({length:401}, (_,i) => cam.transform(i/400, 1, params))
    const coords = transformaciones.map(t => {
      const m = t.match(/translate\(([-\d.]+)cqmin,([-\d.]+)cqmin\) scale\(([-\d.]+)\)/)
      if (!m) throw new Error('Formato de transform nuevo: revisar la medicion, no interpretar a ciegas')
      return m.slice(1).map(Number)
    })
    informe.deriva = { energia:energiaOriginal, paramsLimite:params, profundidad:1, muestras:401,
      xPx:[Math.min(...coords.map(c=>c[0]))*10.8, Math.max(...coords.map(c=>c[0]))*10.8],
      yPx:[Math.min(...coords.map(c=>c[1]))*10.8, Math.max(...coords.map(c=>c[1]))*10.8],
      escala:[Math.min(...coords.map(c=>c[2])),Math.max(...coords.map(c=>c[2]))] }
    // Resultado observable del sorteo actual, sin reimplementar direccionDe.
    const corpusRuta = path.join(raiz, 'tests/aceptacion/generar-hoja-contactos.ts')
    const corpusTexto = fs.readFileSync(corpusRuta, 'utf8').match(/const PALABRAS = \[([\s\S]*?)\] as const/)?.[1]
    if (!corpusTexto) throw new Error('No se pudo leer el corpus versionado')
    const palabras = [...corpusTexto.matchAll(/'([^']+)'/g)].map(m => m[1])
    const ilegales=[]
    for(const palabra of palabras) {
      const s=bundle.semillaDe(palabra), d=bundle.direccionDe(s)
      if(bundle.FONDOS_ESCENA[d.fondo].energia+bundle.CAMARAS_ESCENA[d.camara].energia>3) ilegales.push({palabra,semilla:s,direccion:d})
    }
    informe.sorteoEnergia = { corpus: 'tests/aceptacion/generar-hoja-contactos.ts', corpusSHA256:sha(corpusRuta),
      palabras:palabras.length, excedenTres:ilegales.length, primeros:ilegales.slice(0,3),
      alcance:'Corpus corto cerrado; no estima la tasa de produccion' }
    for(const nombre of ['archivo-var.woff2','anton-400.woff2','outfit-var.woff2'])
      informe.fuentesSHA256[nombre]=sha(path.join(raiz,'dist/fonts',nombre))
    codigo=0
  } catch(e) { informe.error=e.stack||String(e); console.error(informe.error) }
  finally {
    clearTimeout(watchdog); informe.exitCode=codigo; guardar()
    console.log(JSON.stringify(informe,null,2))
    for(const v of BrowserWindow.getAllWindows()) if(!v.isDestroyed()) v.destroy()
    app.exit(codigo)
  }
})
