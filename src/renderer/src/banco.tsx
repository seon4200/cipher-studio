import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AnimatedGraphic, type GraphicData } from './AnimatedGraphic'
import { composicion } from './composiciones'
import { recortarTexto } from '../../shared/texto'
import { semillaDe } from '../../shared/semilla'
import {
  FONDOS, ESTRUCTURAS, CAMARAS, DENSIDADES, RITMOS, direccionDesde,
  ZONA_X_MIN, ZONA_X_MAX, ZONA_Y_MIN,
  type Direccion, type IdFondo, type IdEstructura, type IdCamara
} from '../../shared/escena'
import type { Concepto } from '../../shared/conceptos'
import { FUENTES_RENDER, MUESTRA_FUENTES, faltaLaFuentePorAncho } from './fuentes-render'
import './styles/globals.css'
import './styles/banco.css'

const ANCHO = 1080
const ALTO = 1920
const CICLO = 3

type NombreBanco = 'mapa' | 'escena'
type ModoTiempo = 'correr' | 'posicionar'
type FilaConcepto = { emoji: string; etiqueta: string }
type RitmoRaf = { media: number; p95: number; max: number; mayores25: number }

const CONCEPTOS_INICIALES: FilaConcepto[] = [
  { emoji: '🧠', etiqueta: 'recuerdo' },
  { emoji: '🗂️', etiqueta: 'archivo' },
  { emoji: '🔗', etiqueta: 'conexion' }
]

function Banco() {
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
