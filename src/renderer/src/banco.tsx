import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AnimatedGraphic, type GraphicData } from './AnimatedGraphic'
import { composicion } from './composiciones'
import { recortarTexto } from '../../shared/texto'
import { semillaDe } from '../../shared/semilla'
import {
  FONDOS, ESTRUCTURAS, CAMARAS, DENSIDADES, RITMOS, direccionDesde, instanciaDe,
  ZONA_X_MIN, ZONA_X_MAX, ZONA_Y_MIN,
  type Direccion, type IdFondo, type IdEstructura, type IdCamara
} from '../../shared/escena'
import type { Concepto } from '../../shared/conceptos'
import { FUENTES_RENDER, MUESTRA_FUENTES, faltaLaFuentePorAncho } from './fuentes-render'
import fixtureHoja from '../../../tests/aceptacion/fixtures/hoja-contactos-instancias.json'
import './styles/globals.css'
import './styles/banco.css'

const ANCHO = 1080
const ALTO = 1920
const CICLO = 3

type NombreBanco = 'mapa' | 'escena'
type ModoTiempo = 'correr' | 'posicionar'
type VistaBanco = 'individual' | 'hoja'
type FilaConcepto = { emoji: string; etiqueta: string }
type RitmoRaf = { media: number; p95: number; max: number; mayores25: number }

const CONCEPTOS_INICIALES: FilaConcepto[] = [
  { emoji: '🧠', etiqueta: 'recuerdo' },
  { emoji: '🗂️', etiqueta: 'archivo' },
  { emoji: '🔗', etiqueta: 'conexion' }
]

const DIRECCION_HOJA = fixtureHoja.identidad as Direccion

function graphicHoja(palabra: string, conceptos: Concepto[]): GraphicData {
  return {
    type: 'visual_escena', value: palabra,
    extra: { conceptos, direccion: DIRECCION_HOJA }
  }
}

function MiniaturaHoja({ caso, t, conceptos, zona, zonaVisible }: {
  caso: (typeof fixtureHoja.casos)[number]
  t: number
  conceptos: Concepto[]
  zona: React.CSSProperties
  zonaVisible: boolean
}) {
  // La hoja no deriva nada: pregunta a la MISMA funcion pura que usa escena.tsx.
  const instancia = instanciaDe(caso.palabra, DIRECCION_HOJA)
  const esControl = fixtureHoja.control.casillas.includes(caso.casilla)
  return (
    <article className={`hoja-celda${esControl ? ' es-control' : ''}`}
      data-hoja-indice={caso.casilla} data-palabra={caso.palabra}>
      <header className="hoja-etiqueta">
        <strong>{caso.casilla}. {caso.palabra}</strong>
        <span>{caso.roles.join(' · ')}</span>
        <code>principal {instancia.semillas.principal}</code>
        <code>#pts {instancia.semillas.puntos}</code>
        <code>#deco {instancia.semillas.decoradores}</code>
        <code>#params {instancia.semillas.parametros}</code>
      </header>
      <div className="hoja-marco">
        <div className="hoja-escala">
          <div className="flex" style={{ width: ANCHO, height: ALTO }}>
            <AnimatedGraphic graphic={graphicHoja(caso.palabra, conceptos)} t={t}
              modo="pantalla" sistema="voltaje" ciclo={CICLO} />
          </div>
          {zonaVisible && <div className="banco-zona hoja-zona" style={zona} />}
        </div>
      </div>
    </article>
  )
}

function Banco() {
  const [vista, setVista] = useState<VistaBanco>('individual')
  const [nombre, setNombre] = useState<NombreBanco>('escena')
  const [palabra, setPalabra] = useState('memoria')
  const [filas, setFilas] = useState<FilaConcepto[]>(CONCEPTOS_INICIALES)
  const [fondo, setFondo] = useState<IdFondo>('ondas')
  const [estructura, setEstructura] = useState<IdEstructura>('constelacion')
  const [camara, setCamara] = useState<IdCamara>('deriva')
  const [modoTiempo, setModoTiempo] = useState<ModoTiempo>('correr')
  const [t, setT] = useState(0)
  const [zonaVisible, setZonaVisible] = useState(true)
  const [fallosFuente, setFallosFuente] = useState<string[] | null>(null)
  const [ritmoRaf, setRitmoRaf] = useState<RitmoRaf | null>(null)
  const tRef = useRef(t)

  useEffect(() => { tRef.current = t }, [t])

  // EL BANCO SIEMPRE PASA `t`. En correr, rAF solo produce la sucesion de tiempos exactos; en
  // posicionar, el control fija uno. AnimatedGraphic sigue siendo el UNICO emisor de pixeles y
  // aplica el mismo pause()+currentTime del render real en ambos casos.
  useEffect(() => {
    if (modoTiempo !== 'correr') return
    let raf = 0
    const inicio = performance.now() - tRef.current * 1000
    let anterior = performance.now()
    let muestras: number[] = []
    const avanzar = (ahora: number) => {
      const delta = ahora - anterior
      anterior = ahora
      if (delta > 0) muestras.push(delta)
      if (muestras.length >= 120) {
        const ordenadas = [...muestras].sort((a, b) => a - b)
        const suma = muestras.reduce((a, b) => a + b, 0)
        setRitmoRaf({
          media: suma / muestras.length,
          p95: ordenadas[Math.floor(ordenadas.length * 0.95)] ?? 0,
          max: ordenadas[ordenadas.length - 1] ?? 0,
          mayores25: muestras.filter(x => x > 25).length
        })
        muestras = []
      }
      setT(((ahora - inicio) / 1000) % CICLO)
      raf = requestAnimationFrame(avanzar)
    }
    raf = requestAnimationFrame(avanzar)
    return () => cancelAnimationFrame(raf)
  }, [modoTiempo])

  const revisarFuentes = useCallback(() => {
    setFallosFuente(FUENTES_RENDER
      .map(f => faltaLaFuentePorAncho(f.familia, f.peso))
      .filter((x): x is string => !!x))
  }, [])

  useEffect(() => {
    revisarFuentes()
    const alTerminar = () => revisarFuentes()
    document.fonts.addEventListener('loadingdone', alTerminar)
    document.fonts.addEventListener('loadingerror', alTerminar)
    void document.fonts.ready.then(revisarFuentes)
    const demora = window.setTimeout(revisarFuentes, 500)
    return () => {
      window.clearTimeout(demora)
      document.fonts.removeEventListener('loadingdone', alTerminar)
      document.fonts.removeEventListener('loadingerror', alTerminar)
    }
  }, [revisarFuentes])

  const conceptos: Concepto[] = useMemo(() => filas
    .filter(c => c.emoji.length > 0 || c.etiqueta.length > 0)
    .map(c => ({ emoji: c.emoji, etiqueta: c.etiqueta })), [filas])

  const palabraRender = recortarTexto(palabra)
  const semilla = semillaDe(palabraRender)
  const direccionPedida: Direccion = {
    fondo, estructura, camara, densidad: DENSIDADES[0], ritmo: RITMOS[0]
  }
  const direccionResuelta = direccionDesde(direccionPedida, semilla)
  const comp = composicion(nombre)
  const datosPuerta = nombre === 'escena'
    ? { texto: palabraRender, conceptos, direccion: direccionPedida }
    : { texto: palabraRender, conceptos }
  const puede = comp?.puedeDibujar(datosPuerta) ?? false

  const graphic: GraphicData = useMemo(() => ({
    type: nombre === 'escena' ? 'visual_escena' : 'visual_mapa',
    value: palabra,
    extra: nombre === 'escena'
      ? { conceptos, direccion: direccionPedida }
      : { conceptos }
  }), [nombre, palabra, conceptos, fondo, estructura, camara])

  const cambiaConcepto = (i: number, campo: keyof FilaConcepto, valor: string) => {
    setFilas(anteriores => anteriores.map((c, j) => j === i ? { ...c, [campo]: valor } : c))
  }

  const zona: React.CSSProperties = {
    left: `${ZONA_X_MIN}%`,
    top: `${ZONA_Y_MIN}%`,
    width: `${ZONA_X_MAX - ZONA_X_MIN}%`,
    height: `${100 - 2 * ZONA_Y_MIN}%`
  }

  const cambiaVista = (siguiente: VistaBanco) => {
    setVista(siguiente)
    if (siguiente === 'hoja') {
      setModoTiempo('posicionar')
      setT(fixtureHoja.tiempoSegundos)
    }
  }

  const erroresFixture = fixtureHoja.casos.flatMap(caso => {
    const actual = instanciaDe(caso.palabra, DIRECCION_HOJA)
    return JSON.stringify(actual.semillas) === JSON.stringify(caso.semillas) &&
      JSON.stringify(actual.estructura) === JSON.stringify(caso.parametrosEstructura)
      ? [] : [`casilla ${caso.casilla}: ${caso.palabra}`]
  })

  if (vista === 'hoja') return (
    <main className="banco-app hoja-app">
      <div className="banco-sondas-fuente" aria-hidden="true">
        {FUENTES_RENDER.map(f => <span key={f.familia} style={{ fontFamily: f.familia, fontWeight: f.peso }}>{MUESTRA_FUENTES}</span>)}
      </div>

      <section className="hoja-controles">
        <div>
          <h1>Hoja de contactos · instancias</h1>
          <p className="banco-nota">Doce AnimatedGraphic reales · un instante · una identidad</p>
        </div>
        <div className="banco-campo">
          <label htmlFor="vista-banco-hoja">Vista</label>
          <select id="vista-banco-hoja" value={vista} onChange={e => cambiaVista(e.target.value as VistaBanco)}>
            <option value="individual">Una combinacion</option>
            <option value="hoja">Hoja de contactos</option>
          </select>
        </div>
        <div className="banco-campo hoja-tiempo">
          <label htmlFor="t-hoja">t = {t.toFixed(3)} s</label>
          <input id="t-hoja" type="range" min="0" max={CICLO} step="0.001" value={t}
            onChange={e => setT(Number(e.target.value))} />
        </div>
        <label className="banco-check"><input type="checkbox" checked={zonaVisible}
          onChange={e => setZonaVisible(e.target.checked)} /> Superponer zona segura</label>
        <p className="hoja-control-aviso">CONTROL: casillas {fixtureHoja.control.casillas.join(' y ')}
          {' '}repiten exactamente “{fixtureHoja.control.palabra}”, con las mismas semillas y parametros.
          A tamano completo dan IGUAL. En miniatura pueden dar EQUIVALENTE por rasterizado subpixel:
          al moverlas de 9/12 a 10/11 se midieron 0 px con delta &gt; 64, maximo 51 y media 5.8.
          La hoja sirve para MIRAR variedad; no para exigir igualdad pixel a pixel entre posiciones.</p>
        <p className="banco-nota">A este tamano se juzga si las escenas SE DISTINGUEN, no si el texto se lee.</p>
        <pre className="banco-datos hoja-condiciones">{JSON.stringify({
          composicion: fixtureHoja.composicion,
          identidad: fixtureHoja.identidad,
          t,
          miniatura: fixtureHoja.miniatura,
          busqueda: fixtureHoja.busqueda
        }, null, 2)}</pre>
        <div className={`hoja-fixture ${erroresFixture.length ? 'miente' : 'ok'}`}>
          {erroresFixture.length
            ? `FIXTURE DESFASADO: ${erroresFixture.join(', ')}`
            : `Fixture verificado contra instanciaDe: ${fixtureHoja.casos.length} de ${fixtureHoja.casos.length}`}
        </div>
      </section>

      <section className="hoja-rejilla" data-composicion={fixtureHoja.composicion}
        data-tiempo={t.toFixed(3)}>
        {fixtureHoja.casos.map(caso => <MiniaturaHoja key={caso.casilla} caso={caso} t={t}
          conceptos={conceptos} zona={zona} zonaVisible={zonaVisible} />)}
      </section>
    </main>
  )

  return (
    <main className="banco-app">
      {/* Estas sondas fuerzan la descarga sin bloquear la pagina. El banco AVISA mientras falte
          una cara; no intenta resolver la carrera de captura que solo existe en grafico.tsx.
          El emoji sigue siendo el del sistema. Si se empaqueta Noto Color Emoji, hay que añadirlo
          a la misma fuente compartida o banco y render discreparan en el heroe. */}
      <div className="banco-sondas-fuente" aria-hidden="true">
        {FUENTES_RENDER.map(f => <span key={f.familia} style={{ fontFamily: f.familia, fontWeight: f.peso }}>{MUESTRA_FUENTES}</span>)}
      </div>

      <div className="banco-grid">
        <section className="banco-panel">
          <div>
            <h1>Banco de Visuales</h1>
            <p className="banco-nota">AnimatedGraphic real · 1080×1920 · ciclo {CICLO}s</p>
          </div>

          <div className="banco-campo">
            <label htmlFor="vista-banco">Vista</label>
            <select id="vista-banco" value={vista} onChange={e => cambiaVista(e.target.value as VistaBanco)}>
              <option value="individual">Una combinacion</option>
              <option value="hoja">Hoja de contactos</option>
            </select>
          </div>

          <div className={`banco-fuentes ${fallosFuente === null ? 'comprobando' : fallosFuente.length ? 'miente' : 'ok'}`}>
            <strong>{fallosFuente === null ? 'Comprobando fuentes por geometria…' : fallosFuente.length ? 'ADVERTENCIA: el banco miente sobre el texto' : 'Fuentes verificadas por geometria'}</strong>
            {fallosFuente === null
              ? <span>Aun no se da por fiable el texto.</span>
              : fallosFuente.length
                ? <ul>{fallosFuente.map(f => <li key={f}>{f}</li>)}</ul>
                : <span>{FUENTES_RENDER.map(f => `${f.familia} ${f.peso}: presente`).join(' · ')}</span>}
          </div>

          <div className="banco-campo">
            <label htmlFor="composicion">Composicion</label>
            <select id="composicion" value={nombre} onChange={e => setNombre(e.target.value as NombreBanco)}>
              <option value="mapa">mapa</option>
              <option value="escena">escena</option>
            </select>
          </div>

          <div className="banco-ejes">
            <div className="banco-campo"><label htmlFor="fondo">Fondo</label><select id="fondo" value={fondo} onChange={e => setFondo(e.target.value as IdFondo)}>{Object.values(FONDOS).map(x => <option key={x.id} value={x.id}>{x.id}</option>)}</select></div>
            <div className="banco-campo"><label htmlFor="estructura">Estructura</label><select id="estructura" value={estructura} onChange={e => setEstructura(e.target.value as IdEstructura)}>{Object.values(ESTRUCTURAS).map(x => <option key={x.id} value={x.id}>{x.id}</option>)}</select></div>
            <div className="banco-campo"><label htmlFor="camara">Camara</label><select id="camara" value={camara} onChange={e => setCamara(e.target.value as IdCamara)}>{Object.values(CAMARAS).map(x => <option key={x.id} value={x.id}>{x.id}</option>)}</select></div>
          </div>

          <div className="banco-campo">
            <label htmlFor="palabra">Palabra</label>
            <input id="palabra" value={palabra} onChange={e => setPalabra(e.target.value)} />
          </div>

          <div className="banco-campo">
            <label>Conceptos: emoji y etiqueta</label>
            {filas.map((c, i) => <div className="banco-fila" key={i}>
              <input aria-label={`Emoji ${i + 1}`} value={c.emoji} onChange={e => cambiaConcepto(i, 'emoji', e.target.value)} />
              <input aria-label={`Etiqueta ${i + 1}`} value={c.etiqueta} onChange={e => cambiaConcepto(i, 'etiqueta', e.target.value)} />
            </div>)}
          </div>

          <div className="banco-tiempo">
            <div className="banco-campo"><label htmlFor="modo-tiempo">Tiempo</label><button id="modo-tiempo" onClick={() => setModoTiempo(m => m === 'correr' ? 'posicionar' : 'correr')}>{modoTiempo}</button></div>
            <div className="banco-campo"><label htmlFor="t">t = {t.toFixed(3)} s</label><input id="t" type="range" min="0" max={CICLO} step="0.001" value={t} disabled={modoTiempo === 'correr'} onChange={e => setT(Number(e.target.value))} /></div>
          </div>
          <p className="banco-nota">{ritmoRaf
            ? `rAF dirigido: media ${ritmoRaf.media.toFixed(2)} ms · p95 ${ritmoRaf.p95.toFixed(2)} ms · max ${ritmoRaf.max.toFixed(2)} ms · >25 ms ${ritmoRaf.mayores25}/120`
            : 'rAF dirigido: reuniendo 120 muestras…'}</p>

          <label className="banco-check"><input type="checkbox" checked={zonaVisible} onChange={e => setZonaVisible(e.target.checked)} /> Superponer zona segura</label>

          <pre className="banco-datos">{JSON.stringify({
            direccion: nombre === 'escena' ? direccionResuelta : 'no aplica: mapa no lee direccion',
            semilla,
            puedeDibujar: puede
          }, null, 2)}</pre>
          <p className="banco-nota">La semilla sale exclusivamente de la palabra. Los parametros de instancia no se reproducen aqui.</p>
        </section>

        <section>
          <div className="banco-marco">
            <div className="banco-escala">
              {/* EL LIENZO REAL: exactamente las propiedades que grafico.tsx aplica en modo
                  pantalla. La escala y la superposicion son HERMANAS, nunca contenedores. */}
              <div id="lienzo" className="flex" style={{ width: ANCHO, height: ALTO }}>
                <AnimatedGraphic graphic={graphic} t={t} modo="pantalla" sistema="voltaje" ciclo={CICLO} />
              </div>
              {zonaVisible && <div className="banco-zona" style={zona} />}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

const host = document.getElementById('banco-root')
if (!host) throw new Error('Falta #banco-root')
createRoot(host).render(<Banco />)
