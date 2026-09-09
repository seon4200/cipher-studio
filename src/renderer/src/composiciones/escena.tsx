// ESCENA — el DIBUJO de las piezas. Los metadatos y la aritmetica viven en shared/escena.ts.
//
// ── LO QUE `render` NO HACE, Y ES EL PUNTO DE TODO ESTE FICHERO ──────────────────────────────
//
// `render` NO llama a ninguna pieza por su nombre. Resuelve por `direccion.fondo`,
// `direccion.estructura` y `direccion.camara` contra los tres registros de abajo. Anadir la
// estructura numero 18 es anadir una entrada en shared/escena.ts y su dibujo aqui: `render` no
// se toca. Con llamadas directas -- `fondoOndas(kf)` -- cada pieza nueva obligaba a reescribirlo,
// y eso SUMA donde hace falta MULTIPLICAR.
//
// LOS DOS REGISTROS ESTAN ATADOS POR EL TIPO. `DIBUJO_FONDOS` es `Record<IdFondo, ...>`, e
// `IdFondo` sale de las claves de shared/escena.ts. Anadir una pieza alli y olvidar su dibujo
// aqui NO COMPILA: fallar ruidoso -- tsc -- en vez de mudo, igual que `puedeDibujar`.
//
// ── LAS DOS REGLAS QUE ESTE FICHERO NO PUEDE ROMPER ─────────────────────────────────────────
//
//  1. TODO LO QUE EMITA @keyframes SE EJECUTA ANTES DEL `return`, y la hoja se serializa la
//     ULTIMA. Este fichero ya la incumplio una vez: las cuatro capas salian QUIETAS, la hoja
//     llevaba 16 reglas donde la aritmetica decia 20, y no fallaba nada.
//  2. NI UN NUMERO DE SEGUNDOS en el <style>. Toda duracion es `calc(var(--ciclo) / n)`, con
//     DIVISION y no multiplicacion: `/ n` no puede expresar una duracion ilegal, `* 0.333` si.

import React from 'react'
import { IconoSolar } from './IconoSolar'
import { coloresEscena } from '../sistemas'
import { FONDOS } from '../../../shared/escena'
import { anchoCaja, METRICAS_ETIQUETA, METRICA_ETIQUETA, GEOMETRIA_CAJA } from '../../../shared/metricas-caja'
import { ajustar, type DuracionUsada } from '../../../shared/ciclo'
import { generador, semillaDe } from '../../../shared/semilla'
import { CUANTOS_CONCEPTOS, type Concepto } from '../../../shared/conceptos'
import {
  ESTRUCTURAS, CAMARAS, direccionDesde, PROFUNDIDAD, entradaRitmo, RITMOS,
  posicionDecorador, DENSIDAD_A_N, cabeEnElPie, cabeLaEtiqueta, instanciaDe,
  TIPOGRAFIAS, ZONA_X_MIN, ZONA_X_MAX, type IdTipografia,
  type IdFondo, type IdEstructura, type IdCamara, type PuntoEscena, type Parametros,
  type MetaEstructura, type Direccion
} from '../../../shared/escena'
import {
  decoratorBudgetV2,
  sceneSpecReactKey,
  type PresentHeroSlotV1,
  type ProceduralHeroSlotV1,
  type RuntimeRenderAssetV1,
  type VisualSceneSpecV1,
} from '../../../shared/visual-scene-spec'
import type { Composicion, PropsComposicion } from './index'
import { EditorialText, ProceduralSolarHero, ProjectAssetHero } from './VisualAssetMvp'

const TAU = 6.283185307

// ── LA UNICA DURACION ───────────────────────────────────────────────────────────────────────
const DIVISORES = [{ que: 'escena', n: 1 }] as const

/**
 * LAS DURACIONES Y SUS AVISOS, DE UNA SOLA LLAMADA A `ajustar()`. No son dos caminos paralelos:
 * `duraciones` devuelve el valor YA CORREGIDO y `avisos` lo que hubo que corregir para llegar a
 * el, y los dos salen de este mismo bucle.
 */
function duracionesDe(ciclo: number): { usadas: DuracionUsada[]; avisos: string[] } {
  const usadas: DuracionUsada[] = []
  const avisos: string[] = []
  for (const x of DIVISORES) {
    const r = ajustar(ciclo, x.que, ciclo / x.n)
    usadas.push({ que: x.que, d: r.d })
    if (r.aviso) avisos.push(r.aviso)
  }
  // Cada ritmo solicita su entrada mediante `ciclo / n` y pasa por el mismo candado que el
  // resto. Asi una futura edicion de un ritmo no puede introducir una duracion ilegal muda.
  for (const ritmo of RITMOS) {
    const entrada = entradaRitmo(14, ritmo, ciclo)
    usadas.push({ que: `ritmo ${ritmo}`, d: entrada.duracion })
    if (entrada.aviso) avisos.push(entrada.aviso)
  }
  return { usadas, avisos }
}

// ── EL EMISOR DE KEYFRAMES, UNO POR RENDER ─────────────────────────────────────────────────
function emisor(prefijo: string) {
  const reglas: string[] = []
  const kf = (clave: string, M: number, fn: (u: number) => string): string => {
    const nom = prefijo + '-' + clave
    let c = ''
    for (let i = 0; i < M; i++) {
      const u = i / (M - 1)
      c += (u * 100).toFixed(3) + '%{' + fn(u) + '}'
    }
    reglas.push('@keyframes ' + nom + '{' + c + '}')
    return nom
  }
  return { kf, reglas }
}
export type Kf = ReturnType<typeof emisor>['kf']

// LA UNICA FORMA DE USAR UNA ANIMACION AQUI, y en propiedades LARGAS y no en el atajo
// `animation:`. El atajo obliga a interpolar la duracion dentro de una cadena, que es
// exactamente donde se cuela un `${d}s` sin que nadie lo vea.
const usa = (nom: string, n = 1): React.CSSProperties => ({
  animationName: nom,
  animationDuration: `calc(var(--ciclo) / ${Math.max(1, Math.round(n))})`,
  animationTimingFunction: 'linear',
  animationIterationCount: 'infinite',
  animationFillMode: 'both'
})

// ── EL CSS FIJO ─────────────────────────────────────────────────────────────────────────────
//
// TODO en cqmin y NI UN `px`: en 9:16 cqmin === cqw, pero en 16:9 cqmin escala con el ALTO, que
// es la dimension que manda.
//
// `.es-svg` LLEVA width Y height EXPLICITOS, y ese es el arreglo A. Un `<svg>` con viewBox y sin
// alto explicito es un elemento REEMPLAZADO: `inset:0` no lo estira, resuelve su alto por la
// relacion del viewBox y se queda CUADRADO anclado arriba. Con viewBox 0 0 100 100 sobre un
// marco 1080x1920, un `y=30` caia en 30 % de 1080 = 16.9 % del cuadro, y las aristas morian muy
// por encima de sus nodos sin dar un error. Esta en el CSS COMPARTIDO y no dentro de
// `constelacion` a proposito: lo hereda toda estructura que use SVG, que seran casi todas.
const metricaEtiqueta = METRICAS_ETIQUETA[METRICA_ETIQUETA]
const geometriaCaja = GEOMETRIA_CAJA
const CSS_FIJO = `
.es-capa{position:absolute;inset:0}
.es-svg{position:absolute;inset:0;width:100%;height:100%}
.es-nodo{position:absolute;transform:translate(-50%,-50%);white-space:nowrap}
.es-caja{display:flex;align-items:center;gap:${geometriaCaja.gapCqmin}cqmin;padding:1.5cqmin ${geometriaCaja.paddingXCqmin}cqmin;
  border-radius:1.7cqmin;background:var(--caja,var(--sup));border:${geometriaCaja.bordeCqmin}cqmin solid color-mix(in srgb,var(--acento) 42%,var(--apoyo));
  backdrop-filter:blur(.19cqmin)}
.es-mini{font-size:4.4cqmin;line-height:1;flex:none;width:${geometriaCaja.emojiAnchoCqmin}cqmin;text-align:center;color:var(--apoyo)}
.es-icono{width:1em;height:1em;vertical-align:middle;fill:none;stroke:currentColor;stroke-width:1.5}
.es-icono path{stroke-dasharray:1;stroke-dashoffset:0}
/* La cota suma avances individuales: no puede convivir con kerning ni ligaduras
   contextuales que cambien esa suma. La medicion usa ESTAS propiedades reales. */
.es-etq{font:${metricaEtiqueta.peso} ${metricaEtiqueta.fuenteCqmin}cqmin ${metricaEtiqueta.familia},system-ui,sans-serif;
  letter-spacing:${metricaEtiqueta.espaciadoEm}em;font-kerning:none;font-variant-ligatures:none;color:var(--texto)}
.es-hero{position:absolute;transform:translate(-50%,-50%);font-size:26cqmin;line-height:1;
  color:var(--acento);filter:drop-shadow(0 2cqmin 2.6cqmin rgba(0,0,0,.7))}
.es-deco{position:absolute;width:1.6cqmin;height:1.6cqmin;border-radius:50%;
  transform:translate(-50%,-50%);background:var(--apoyo)}
.es-anillo{position:absolute;left:50%;top:45%;border-radius:50%;
  border:.3cqmin solid var(--acento)}
.es-pie{position:absolute;left:8.33%;right:8.33%;bottom:16%;text-align:center}
/* overflow-wrap permite partir una palabra, pero NO limita el pie a dos lineas:
   ese limite lo comprueba cabeEnElPie. Si se quita, la aritmetica de dos lineas
   deja de describir el dibujo sin que TypeScript ni el CSS den error. */
.es-pie-tit{font:800 9cqmin/0.95 Archivo,sans-serif;color:var(--texto);margin:0;
  min-height:17.1cqmin;overflow-wrap:anywhere;
  text-shadow:0 .3cqmin 2cqmin var(--sombra-pie,rgba(0,0,0,.85))}
.es-pie-barra{height:.9cqmin;width:14cqmin;margin:2.6cqmin auto 0;border-radius:99cqmin;
  background:var(--acento)}
`

// ── LO QUE RECIBE CADA PIEZA AL DIBUJARSE ───────────────────────────────────────────────────
// `params` sale de los RANGOS de la pieza mas la semilla: es su instancia. Va en el contexto y
// no como argumento suelto para que anadir un dato mas tarde no cambie la firma de las 17.
export type CtxFondo = { kf: Kf; params: Parametros }
export type CtxEstructura = { kf: Kf; puntos: PuntoEscena[]; conceptos: Concepto[]; params: Parametros;
  densidad: { elementos: number; escala: number; separacion: number; opacidadSecundaria: number } }

export type DibujoFondo = (c: CtxFondo) => React.ReactNode
export type DibujoEstructura = (c: CtxEstructura) => React.ReactNode

// ── EL REGISTRO DE DIBUJOS: FONDOS ──────────────────────────────────────────────────────────

const DIBUJO_FONDOS: Record<IdFondo, DibujoFondo> = {
  // Fuente aprobada: docs/motion/lab-fondos-2.html:318-333. Mismo tejido y desplazamiento.
  tramaTejida: ({ kf }) => {
    const nom = kf('tramaTejida', 21, u =>
      `background-position:${(u * 6).toFixed(3)}cqmin ${(u * 6).toFixed(3)}cqmin`)
    return <>
      <div className="es-capa" style={{ background: '#F2ECE0' }} />
      <div className="es-capa" style={{ ...usa(nom), background:
        'repeating-linear-gradient(90deg,rgba(120,105,85,.16) 0 .5cqmin,transparent .5cqmin 3cqmin),' +
        'repeating-linear-gradient(0deg,rgba(120,105,85,.13) 0 .5cqmin,transparent .5cqmin 3cqmin)',
        backgroundSize: '6cqmin 6cqmin' }} />
      {/* El grano de .7px del lab a su ancho minimo de 238px equivale a .294cqmin.
          Aqui escala con el contenido, no con la pantalla de quien abre el banco. */}
      <div className="es-capa" style={{
        backgroundImage: 'radial-gradient(rgba(120,105,85,.30) .294cqmin,transparent .294cqmin)',
        backgroundSize: '1.7cqmin 1.7cqmin', opacity: .6 }} />
      <div className="es-capa" style={{ boxShadow: 'inset 0 0 16cqmin rgba(140,124,100,.35)' }} />
    </>
  },
  // Fuente aprobada: docs/motion/lab-fondos.html:90-108.
  ondas: ({ kf }) => {
    const lineas = Array.from({ length: 11 }, (_, i) => {
      const y0 = 12 + i * 13.5
      const amp = 4 + (i % 3) * 1.6
      const nom = kf('ondas' + i, 33, u => {
        let d = `M0,${y0.toFixed(2)}`
        for (let x = 0; x <= 90; x += 6) {
          const y = y0 + Math.sin((x / 90) * TAU * 1.6 + u * TAU + i * 0.5) * amp
          d += ` L${x},${y.toFixed(2)}`
        }
        return `d:path("${d}")`
      })
      return <path key={i} style={usa(nom)} fill="none" stroke="var(--acento)"
        strokeWidth=".34" opacity={(0.18 + 0.05 * (i % 4)).toFixed(2)} />
    })
    return <>
      <div className="es-capa" style={{
        background: 'linear-gradient(180deg,var(--fondo),var(--sup),var(--fondo))'
      }} />
      <svg className="es-svg" viewBox="0 0 90 160" preserveAspectRatio="none">{lineas}</svg>
    </>
  },

  tunel: ({ kf, params }) => {
    const n = Math.max(1, Math.round(params.anillos ?? 10))
    const profundidad = params.profundidad ?? 2.1
    const giro = params.giro ?? 22
    const anillos = Array.from({ length: n }, (_, i) => {
      const nom = kf('tunel' + i, 41, u => {
        const p = (i / n + u) % 1
        const escala = Math.pow(p, profundidad) * 2.6 + 0.06
        const opacidad = p < 0.08 ? p / 0.08 : (1 - p) * 0.85
        return `transform:translate(-50%,-50%) scale(${escala.toFixed(4)}) ` +
          `rotate(${(p * giro).toFixed(2)}deg);opacity:${opacidad.toFixed(3)}`
      })
      return <div key={i} style={{
        ...usa(nom), position: 'absolute', left: '50%', top: '46%',
        width: '70cqmin', height: '70cqmin',
        border: '.55cqmin solid var(--acento)',
        borderRadius: i % 2 ? '50%' : '14%'
      }} />
    })
    return (
      <>
        <div className="es-capa" style={{
          background: 'radial-gradient(circle at 50% 46%,var(--sup) 0%,var(--fondo) 62%,#010404)'
        }} />
        {anillos}
      </>
    )
  },

  // Fuente aprobada: docs/motion/lab-fondos-2.html:237-251. `generador(29)` es el mismo
  // Lehmer del lab; alturas y fases quedan deterministas sin abrir otro camino de dibujo.
  skyline: ({ kf }) => {
    const rnd = generador(29)
    const ancho = 100 / 22
    const barras = Array.from({ length: 22 }, (_, i) => {
      const altura = 14 + rnd() * 44
      const fase = rnd()
      const nom = kf('skyline' + i, 25, u =>
        `transform:scaleY(${(0.72 + 0.28 * Math.sin((u + fase) * TAU)).toFixed(3)})`)
      return <div key={i} style={{
        ...usa(nom), position: 'absolute', left: `${(i * ancho).toFixed(2)}%`,
        bottom: 0, width: `${(ancho * 0.86).toFixed(2)}%`,
        height: `${altura.toFixed(1)}%`, transformOrigin: '50% 100%',
        background: 'linear-gradient(180deg,' +
          'color-mix(in srgb,var(--acento) 52%,var(--sup)),' +
          'color-mix(in srgb,var(--acento) 12%,var(--fondo)))',
        borderTop: '.2cqmin solid color-mix(in srgb,var(--apoyo) 45%,transparent)'
      }} />
    })
    return <>
      <div className="es-capa" style={{
        background: 'linear-gradient(180deg,var(--fondo) 0%,var(--sup) 52%,var(--fondo))'
      }} />
      <div className="es-capa">{barras}</div>
    </>
  },
  amanecer: ({ kf }) => {
    const bandas = Array.from({ length: 6 }, (_, i) => {
      const nom = kf('amanecer' + i, 25, u => `transform:translateX(${(Math.sin(u * TAU + i) * 7).toFixed(2)}cqmin);opacity:${(.16 + i * .045).toFixed(3)}`)
      return <div key={i} style={{ ...usa(nom), position: 'absolute', left: '-12%', right: '-12%', top: `${16 + i * 12}%`, height: '11%', background: 'rgba(255,255,240,.52)', filter: 'blur(2cqmin)' }} />
    })
    return <><div className="es-capa" style={{ background: 'linear-gradient(180deg,#FFE7C2,#FFD1A8 42%,#FFBE95 72%,#F7A98A)' }} />{bandas}</>
  },
  causticas: ({ kf }) => {
    const nom = kf('causticas', 33, u => `background-position:${(u * 18).toFixed(2)}cqmin ${(Math.sin(u * TAU) * 7).toFixed(2)}cqmin`)
    return <><div className="es-capa" style={{ background: 'linear-gradient(160deg,#d6f5ed,#9bdcd4)' }} /><div className="es-capa" style={{ ...usa(nom), opacity: .46, backgroundImage: 'repeating-radial-gradient(ellipse at 30% 40%,rgba(255,255,255,.8) 0 .35cqmin,transparent .45cqmin 4.5cqmin)', backgroundSize: '18cqmin 13cqmin' }} /></>
  },
  cristales: ({ kf }) => {
    const poligonos = Array.from({ length: 13 }, (_, i) => { const nom = kf('cristal' + i, 25, u => `opacity:${(.16 + .42 * Math.max(0, Math.sin(u * TAU + i * .73))).toFixed(3)}`); return <polygon key={i} style={usa(nom)} points={`${(i * 17) % 100},${(i * 31) % 100} ${((i * 17 + 30) % 110)},${((i * 31 + 18) % 100)} ${((i * 17 + 12) % 100)},${((i * 31 + 47) % 105)}`} fill="var(--acento)" /> })
    return <><div className="es-capa" style={{ background: 'linear-gradient(150deg,#0d1226,#04060f)' }} /><svg className="es-svg" viewBox="0 0 100 100" preserveAspectRatio="none">{poligonos}</svg></>
  },
  panal: ({ kf }) => {
    const hex = Array.from({ length: 48 }, (_, i) => { const x = (i % 7) * 16 + (Math.floor(i / 7) % 2) * 8; const y = Math.floor(i / 7) * 13; const nom = kf('panal' + i, 25, u => `opacity:${(.10 + .55 * Math.max(0, Math.sin(u * TAU - (x + y) * .045))).toFixed(3)}`); return <polygon key={i} style={usa(nom)} points={`${x},${y-5} ${x+6},${y-2} ${x+6},${y+5} ${x},${y+8} ${x-6},${y+5} ${x-6},${y-2}`} fill="none" stroke="var(--acento)" strokeWidth=".45"/> })
    return <><div className="es-capa" style={{ background: '#0d0a02' }} /><svg className="es-svg" viewBox="0 0 100 100" preserveAspectRatio="none">{hex}</svg></>
  },
  mallaDeformada: ({ kf }) => {
    const lineas = Array.from({ length: 13 }, (_, i) => { const nom = kf('mallaFila' + i, 33, u => { const cx = 50 + Math.sin(u * TAU) * 18; const y = 8 + i * 7; return `d:path(\"M0,${y} Q${cx},${(y + 15 * Math.exp(-Math.pow((i - 6) / 2.3, 2))).toFixed(2)} 100,${y}\")` }); return <path key={i} style={usa(nom)} fill="none" stroke="var(--acento)" strokeWidth=".32" opacity=".42"/> })
    return <><div className="es-capa" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 44%,#1a0b30,#07040f 66%)' }} /><svg className="es-svg" viewBox="0 0 100 100" preserveAspectRatio="none">{lineas}</svg></>
  },
  circuito: ({ kf }) => {
    const pistas = Array.from({ length: 9 }, (_, i) => { const nom = kf('circuito' + i, 33, u => `background-position:${((u * 100 + i * 17) % 100).toFixed(2)}% 0`); return <div key={i} style={{ ...usa(nom), position: 'absolute', left: `${7 + i * 11}%`, top: `${12 + (i % 3) * 22}%`, width: `${38 + (i % 4) * 9}%`, height: '.55cqmin', background: 'linear-gradient(90deg,transparent 0 35%,var(--acento) 42% 51%,transparent 58%)', borderRadius: '9cqmin' }} /> })
    return <><div className="es-capa" style={{ background: 'linear-gradient(150deg,#04140b,#020705)' }} />{pistas}</>
  },
  cuerdas: ({ kf }) => {
    const hilos = Array.from({ length: 14 }, (_, i) => { const nom = kf('cuerda' + i, 33, u => `transform:translateX(${(Math.sin(u * TAU * (1 + i % 3) + i) * 1.2).toFixed(2)}cqmin)`); return <div key={i} style={{ ...usa(nom), position: 'absolute', left: `${5 + i * 7}%`, top: 0, bottom: 0, width: '.34cqmin', background: 'linear-gradient(var(--acento),transparent 78%)', opacity: .22 + (i % 4) * .11 }} /> })
    return <><div className="es-capa" style={{ background: 'linear-gradient(180deg,#140a1e,#050208)' }} />{hilos}</>
  },
  mosaico: ({ kf }) => {
    const tiles = Array.from({ length: 60 }, (_, i) => { const nom = kf('mosaico' + i, 25, u => `transform:rotateY(${(Math.sin(u * TAU + i * .41) * 25).toFixed(2)}deg);opacity:${(.12 + .35 * Math.max(0, Math.sin(u * TAU + i))).toFixed(3)}`); return <div key={i} style={{ ...usa(nom), position: 'absolute', left: `${(i % 6) * 17}%`, top: `${Math.floor(i / 6) * 11}%`, width: '15%', height: '10%', border: '.17cqmin solid var(--acento)', transformStyle: 'preserve-3d' }} /> })
    return <><div className="es-capa" style={{ background: '#170804' }} />{tiles}</>
  },
  warpEstelar: ({ kf }) => {
    const rayos = Array.from({ length: 38 }, (_, i) => { const nom = kf('warp' + i, 25, u => `transform:translate(-50%,-50%) rotate(${(i * 9.47).toFixed(2)}deg) scaleY(${(.2 + ((u + i / 38) % 1) * 1.4).toFixed(3)});opacity:${(.12 + ((u + i / 38) % 1) * .6).toFixed(3)}`); return <div key={i} style={{ ...usa(nom), position: 'absolute', left: '50%', top: '46%', width: '.28cqmin', height: '70cqmin', background: 'linear-gradient(var(--apoyo),transparent)', transformOrigin: '50% 0' }} /> })
    return <><div className="es-capa" style={{ background: 'radial-gradient(circle at 50% 46%,#0b1430,#03050e 60%,#010208)' }} />{rayos}</>
  },
  lluviaDatos: ({ kf }) => {
    const cols = Array.from({ length: 18 }, (_, i) => { const nom = kf('datos' + i, 33, u => `transform:translateY(${(((u + i / 18) % 1) * 120 - 20).toFixed(2)}%);opacity:${(.2 + .65 * ((u + i / 18) % 1)).toFixed(3)}`); return <div key={i} style={{ ...usa(nom), position: 'absolute', left: `${i * 5.8}%`, top: '-25%', color: 'var(--acento)', font: '2.2cqmin monospace', writingMode: 'vertical-rl' }}>01·10·01·11·</div> })
    return <><div className="es-capa" style={{ background: '#020604' }} />{cols}</>
  },
  multitud: ({ kf }) => {
    const gente = Array.from({ length: 91 }, (_, i) => { const x = (i % 13) * 8 + 3; const y = 20 + Math.floor(i / 13) * 10; const nom = kf('gente' + i, 25, u => `transform:translate(-50%,-50%) scale(${(.65 + .25 * Math.sin(u * TAU + i)).toFixed(3)});opacity:${(.16 + .45 * Math.max(0, Math.sin(u * TAU + i * .31))).toFixed(3)}`); return <div key={i} style={{ ...usa(nom), position: 'absolute', left: `${x}%`, top: `${y}%`, width: '2.2cqmin', height: '2.2cqmin', borderRadius: '50% 50% 42% 42%', background: 'var(--acento)' }} /> })
    return <><div className="es-capa" style={{ background: 'linear-gradient(180deg,#171b28,#080a10)' }} />{gente}</>
  },
  ordenEspontaneo: ({ kf }) => {
    const puntos = Array.from({ length: 44 }, (_, i) => { const a = i * 2.399; const r = 6 + (i % 11) * 3.6; const nom = kf('orden' + i, 33, u => `transform:translate(-50%,-50%) rotate(${(u * 360).toFixed(2)}deg) translateX(${r.toFixed(2)}cqmin);opacity:${(.18 + .55 * Math.max(0, Math.sin(u * TAU + i))).toFixed(3)}`); return <div key={i} style={{ ...usa(nom), position: 'absolute', left: '50%', top: '45%', width: '.85cqmin', height: '.85cqmin', borderRadius: '50%', background: 'var(--acento)', transform: `rotate(${a}deg)` }} /> })
    return <><div className="es-capa" style={{ background: 'radial-gradient(circle at 50% 45%,var(--sup),var(--fondo))' }} />{puntos}</>
  },
  demolicion: ({ kf }) => {
    const trozos = Array.from({ length: 26 }, (_, i) => { const nom = kf('demolicion' + i, 25, u => { const p = (u + i / 26) % 1; return `transform:translate(${((i % 7 - 3) * p * 6).toFixed(2)}cqmin,${(p * p * 58).toFixed(2)}cqmin) rotate(${(p * (i * 31)).toFixed(2)}deg);opacity:${(1-p).toFixed(3)}` }); return <div key={i} style={{ ...usa(nom), position: 'absolute', left: `${10 + (i * 19) % 78}%`, top: `${20 + (i * 13) % 32}%`, width: `${2 + i % 4}cqmin`, height: `${1 + i % 3}cqmin`, background: 'color-mix(in srgb,var(--acento) 45%,var(--sup))' }} /> })
    return <><div className="es-capa" style={{ background: 'linear-gradient(180deg,#2a2520,#0d0b09)' }} />{trozos}</>
  },
  comidaFamilia: ({ kf }) => {
    const platos = [[50,46,26],[24,30,15],[76,32,15],[27,66,14],[73,68,14],[50,80,13]]; return <><div className="es-capa" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%,#F7E2C2,#D9A96E 74%,#A9743F)' }} />{platos.map(([x,y,d],i) => { const nom=kf('plato'+i,25,u=>`transform:translate(-50%,-50%) scale(${(1+.02*Math.sin(u*TAU+i)).toFixed(3)})`); return <div key={i} style={{...usa(nom),position:'absolute',left:x+'%',top:y+'%',width:d+'cqmin',height:d+'cqmin',borderRadius:'50%',border:'.65cqmin solid rgba(255,255,255,.66)'}}/> })}</>
  },
  viaLactea: ({ kf }) => { const estrellas=Array.from({length:36},(_,i)=>{const nom=kf('estrella'+i,25,u=>`opacity:${(.22+.7*Math.max(0,Math.sin(u*TAU+i))).toFixed(3)}`);return <div key={i} style={{...usa(nom),position:'absolute',left:`${(i*37)%100}%`,top:`${(i*59)%90}%`,width:'.55cqmin',height:'.55cqmin',borderRadius:'50%',background:'#EAF0FF'}}/>});return <><div className="es-capa" style={{background:'radial-gradient(ellipse 120% 60% at 30% 30%,#131a3d,#04060f 62%,#010206)'}}/><div className="es-capa" style={{background:'linear-gradient(62deg,transparent 30%,rgba(180,190,255,.28) 50%,transparent 70%)',filter:'blur(5cqmin)'}}/>{estrellas}</> },
  reinoAnimal: ({ kf }) => { const manchas=Array.from({length:34},(_,i)=>{const nom=kf('animal'+i,33,u=>`opacity:${(.25+.45*Math.max(0,Math.cos(u*TAU+i))).toFixed(3)}`);return <div key={i} style={{...usa(nom),position:'absolute',left:`${(i*23)%100}%`,top:`${(i*41)%100}%`,width:`${5+i%7}cqmin`,height:`${5+i%7}cqmin`,borderRadius:'50%',background:'#C9862E'}}/>});return <><div className="es-capa" style={{background:'#2a1c0c'}}/>{manchas}</> },
  leyDarwin: ({ kf }) => { const ramas=Array.from({length:24},(_,i)=>{const nom=kf('darwin'+i,25,u=>`transform:rotate(${((i-12)*7).toFixed(2)}deg) scaleY(${Math.min(1,u/.45).toFixed(3)});opacity:${(.18+.48*Math.min(1,u/.45)).toFixed(3)}`);return <div key={i} style={{...usa(nom),position:'absolute',left:'50%',top:'78%',width:'.38cqmin',height:`${12+i%5*7}cqmin`,transformOrigin:'50% 100%',background:'linear-gradient(var(--acento),transparent)'}}/>});return <><div className="es-capa" style={{background:'radial-gradient(ellipse 80% 60% at 50% 86%,#0d2018,#03080a 70%)'}}/>{ramas}</> },
  ecosistemaMarino: ({ kf }) => { const corrientes=Array.from({length:6},(_,i)=>{const nom=kf('marino'+i,33,u=>`transform:translateX(${(Math.sin(u*TAU+i*.8)*5).toFixed(2)}cqmin) skewX(-12deg);opacity:${(.1+.1*Math.sin(u*TAU+i*1.3)).toFixed(3)}`);return <div key={i} style={{...usa(nom),position:'absolute',left:`${i*18-10}%`,top:'15%',height:'70%',width:'28%',background:'linear-gradient(90deg,transparent,color-mix(in srgb,var(--apoyo) 40%,transparent),transparent)',filter:'blur(2cqmin)'}}/>});return <><div className="es-capa" style={{background:'linear-gradient(180deg,#0d5f7a,#084357 34%,#03202d 68%,#010c12)'}}/>{corrientes}</> },

  /** PIEZA DE PRUEBA. Fea a proposito: existe para demostrar que cambiar `direccion.fondo`
   *  cambia el fondo SIN tocar `render`. Si esto no bastara, el registro seria decorativo. */
  liso: () => <div className="es-capa" style={{ background: 'var(--sup)' }} />
}

// ── EL REGISTRO DE DIBUJOS: ESTRUCTURAS ─────────────────────────────────────────────────────

/** La caja de un concepto. Compartida: la usan las dos estructuras y la heredaran las 17. */
function caja(cs: Concepto[], i: number): React.ReactNode {
  return (
    <div className="es-caja">
      <IconoSolar concepto={cs[i]} estilo="linear" className="es-mini es-icono" />
      <span className="es-etq">{cs[i]?.etiqueta ?? ''}</span>
    </div>
  )
}

/** Entrada comun de cajas: ninguna estructura dibuja su propio átomo caja+emoji. */
function cajasConEntrada(kf: Kf, prefijo: string, puntos: PuntoEscena[], conceptos: Concepto[],
  densidad: CtxEstructura['densidad'], desde = .08): React.ReactNode {
  const nombres = puntos.map((_, i) => kf(prefijo + '-caja' + i, 33, u => {
    const p = Math.min(1, Math.max(0, (u - desde - i * .11) / .25))
    const e = 1 - Math.pow(1 - p, 3)
    return `opacity:${(e * densidad.opacidadSecundaria).toFixed(3)};transform:translate(-50%,-50%) scale(${((.78 + .22 * e) * densidad.escala).toFixed(3)})`
  }))
  return puntos.map((p, i) => <div key={i} className="es-nodo" style={{ ...usa(nombres[i]), left: `${p.x}%`, top: `${p.y}%` }}>{caja(conceptos, i)}</div>)
}

const DIBUJO_ESTRUCTURAS: Record<IdEstructura, DibujoEstructura> = {
  constelacion: ({ kf, puntos, conceptos, params, densidad }) => {
    const curva = params.curva ?? 4
    const nomEntrada = puntos.map((_, i) => kf('nodo' + i, 33, u => {
      const a = 0.06 + (i / puntos.length) * 0.30
      const p = Math.min(1, Math.max(0, (u - a) / 0.26))
      const e = 1 - Math.pow(1 - p, 3)
      return `opacity:${(e * densidad.opacidadSecundaria).toFixed(3)};transform:translate(-50%,-50%) scale(${((0.7 + 0.3 * e) * densidad.escala).toFixed(3)})`
    }))
    const nodos = puntos.map((p, i) => (
      <div key={i} className="es-nodo" style={{ ...usa(nomEntrada[i]), left: p.x + '%', top: p.y + '%' }}>
        {caja(conceptos, i)}
      </div>
    ))
    const nomArista = puntos.map((_, i) => kf('arista' + i, 33, u => {
      const a = 0.10 + (i / puntos.length) * 0.24
      const p = Math.min(1, Math.max(0, (u - a) / 0.30))
      return `stroke-dashoffset:${(1 - p).toFixed(4)};opacity:${(p * 0.8).toFixed(3)}`
    }))
    const aristas = (
      <svg className="es-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        {puntos.map((p, i) => (
          <path key={i} pathLength={1}
            d={`M50,45 Q${((50 + p.x) / 2).toFixed(2)},${((45 + p.y) / 2 - curva).toFixed(2)} ${p.x.toFixed(2)},${p.y.toFixed(2)}`}
            fill="none" stroke="var(--acento)" strokeWidth=".5"
            strokeDasharray="1" style={usa(nomArista[i])} />
        ))}
      </svg>
    )
    // B.1 se valida sobre esta pieza: los CUATRO campos de adaptarDensidad llegan al dibujo.
    // A 14 elementos aparecen más puntos secundarios, más separados y menos opacos; las tres
    // cajas siguen siendo conceptos, no decoradores inventados.
    const secundarios = Array.from({ length: densidad.elementos }, (_, i) => {
      const a = i * TAU / Math.max(1, densidad.elementos)
      const r = 10 + densidad.separacion * 7
      const nom = kf('constelacionSecundario' + i, 25, u =>
        `transform:translate(-50%,-50%) rotate(${(u * 360 + i * 19).toFixed(2)}deg) translateX(${r.toFixed(2)}cqmin);opacity:${(densidad.opacidadSecundaria * .42).toFixed(3)}`)
      return <div key={i} style={{ ...usa(nom), position: 'absolute', left: '50%', top: '45%',
        width: `${(.7 * densidad.escala).toFixed(2)}cqmin`, height: `${(.7 * densidad.escala).toFixed(2)}cqmin`,
        borderRadius: '50%', background: 'var(--apoyo)', transform: `rotate(${a}rad)` }} />
    })
    return <>{aristas}{secundarios}{nodos}</>
  },

  capasApiladas: ({ kf, puntos, conceptos, params }) => {
    const ancho = params.anchoPlano ?? 44
    const inclinacion = params.inclinacion ?? 58
    const flotacion = params.flotacion ?? 1.2

    const nomPlano = puntos.map((_, i) => kf('capaPlano' + i, 33, u => {
      const a = 0.05 + (i / Math.max(1, puntos.length)) * 0.24
      const p = Math.min(1, Math.max(0, (u - a) / 0.30))
      const e = 1 - Math.pow(1 - p, 3)
      const fl = Math.sin(u * TAU + i * 0.9) * flotacion
      return `opacity:${(e * 0.9).toFixed(3)};transform:translate(-50%,-50%) ` +
        `rotateX(${inclinacion.toFixed(2)}deg) rotateZ(45deg) ` +
        `translateZ(${((1 - e) * 10 + fl).toFixed(2)}cqmin)`
    }))
    const nomEtiqueta = puntos.map((_, i) => kf('capaEtiqueta' + i, 33, u => {
      const a = 0.10 + (i / Math.max(1, puntos.length)) * 0.24
      const p = Math.min(1, Math.max(0, (u - a) / 0.26))
      const e = 1 - Math.pow(1 - p, 3)
      return `opacity:${e.toFixed(3)};transform:translate(-50%,-50%) ` +
        `translateX(${((1 - e) * 5).toFixed(2)}cqmin)`
    }))

    return (
      <div className="es-capa" style={{ perspective: '120cqmin', transformStyle: 'preserve-3d' }}>
        {puntos.map((p, i) => <div key={'plano' + i} style={{
          ...usa(nomPlano[i]), position: 'absolute', left: '50%', top: `${p.y}%`,
          width: `${ancho.toFixed(2)}cqmin`, height: `${ancho.toFixed(2)}cqmin`,
          background: 'linear-gradient(135deg,var(--acento),transparent)',
          border: '.25cqmin solid var(--acento)', transformStyle: 'preserve-3d'
        }} />)}
        {puntos.map((p, i) => <div key={'etiqueta' + i} className="es-nodo" style={{
          ...usa(nomEtiqueta[i]), left: `${p.x}%`, top: `${p.y}%`
        }}>{caja(conceptos, i)}</div>)}
      </div>
    )
  },

  // Fuente aprobada: docs/motion/lab-estructuras.html:314-331.
  redNodos: ({ kf, puntos, conceptos }) => {
    const nodos = Array.from({ length: 22 }, (_, i) => {
      const y = 1 - (i / 21) * 2
      const radio = Math.sqrt(Math.max(0, 1 - y * y))
      const theta = i * 2.399963
      const nom = kf('redNodo' + i, 41, u => {
        const a = theta + u * TAU
        const x = Math.cos(a) * radio * 30
        const z = Math.sin(a) * radio * 30
        const yy = y * 20
        const profundidad = (z + 30) / 60
        return `transform:translate(-50%,-50%) translate(${x.toFixed(2)}cqmin,${yy.toFixed(2)}cqmin) ` +
          `scale(${(0.5 + profundidad).toFixed(3)});opacity:${(0.25 + profundidad * 0.7).toFixed(3)};` +
          `filter:blur(${((1 - profundidad) * 0.12).toFixed(3)}cqmin)`
      })
      return <div key={i} style={{
        ...usa(nom), position: 'absolute', left: '50%', top: '44%',
        width: '1.9cqmin', height: '1.9cqmin', borderRadius: '50%',
        background: 'var(--acento)',
        boxShadow: '0 0 1.8cqmin color-mix(in srgb,var(--acento) 67%,transparent)'
      }} />
    })
    const nomCaja = puntos.map((_, i) => kf('redCaja' + i, 33, u => {
      const a = 0.06 + (i / Math.max(1, puntos.length)) * 0.34
      const p = Math.min(1, Math.max(0, (u - a) / 0.26))
      const e = 1 - Math.pow(1 - p, 3)
      return `opacity:${e.toFixed(3)};transform:translate(-50%,-50%) scale(${(0.72 + 0.28 * e).toFixed(3)})`
    }))
    const cajas = puntos.map((p, i) => (
      <div key={i} className="es-nodo" style={{
        ...usa(nomCaja[i]), left: `${p.x}%`, top: `${p.y}%`
      }}>{caja(conceptos, i)}</div>
    ))
    return <>{nodos}{cajas}</>
  },

  // Fuente: docs/motion/lab-estructuras.html:297-312. Eje, hitos y entrada lateral.
  // El pie y las cajas son los compartidos; el eje termina antes de su franja reservada.
  lineaTiempo: ({ kf, puntos, conceptos }) => {
    const eje = kf('lineaTiempo-eje', 25, u => {
      const e = 1 - Math.pow(1 - Math.min(1, u / .34), 3)
      return `transform:scaleY(${e.toFixed(3)})`
    })
    const entradas = puntos.map((p, i) => {
      // Margen de entrada segun el modelo compartido; no es una medicion de glifos.
      const margen = Math.min(6, Math.max(0,
        p.x - anchoCaja(conceptos[i].etiqueta, true) / 2 - ZONA_X_MIN))
      return kf('lineaTiempo-caja' + i, 33, u => {
        const a = .14 + i / puntos.length * .40
        const e = 1 - Math.pow(1 - Math.min(1, Math.max(0, (u - a) / .26)), 3)
        return `opacity:${e.toFixed(3)};transform:translate(-50%,-50%) translateX(${(-(1 - e) * margen).toFixed(3)}cqmin)`
      })
    })
    return <>
      <div style={{ ...usa(eje), position: 'absolute', left: '22%', top: '22%',
        height: '45%', width: '.5cqmin', transformOrigin: '50% 0',
        background: 'linear-gradient(180deg,var(--acento),color-mix(in srgb,var(--acento) 20%,transparent))' }} />
      {puntos.map((p, i) => <React.Fragment key={i}>
        <div style={{ position: 'absolute', left: '22%', top: `${p.y}%`,
          width: '1.7cqmin', height: '1.7cqmin', borderRadius: '50%',
          transform: 'translate(-50%,-50%)', background: 'var(--acento)' }} />
        <div className="es-nodo" style={{ ...usa(entradas[i]), left: `${p.x}%`, top: `${p.y}%` }}>
          {caja(conceptos, i)}
        </div>
      </React.Fragment>)}
    </>
  },

  // Fuente: docs/motion/lab-estructuras.html:284-295. Estratos frontales, no planos isometricos.
  corteTransversal: ({ kf, puntos, conceptos }) => {
    const bandas = puntos.map((_, i) => kf('corteTransversal-banda' + i, 33, u => {
      const a = .05 + i / puntos.length * .44
      const e = 1 - Math.pow(1 - Math.min(1, Math.max(0, (u - a) / .26)), 3)
      return `transform:scaleX(${e.toFixed(3)});opacity:${(.30 + e * .5).toFixed(3)}`
    }))
    const entradas = puntos.map((_, i) => kf('corteTransversal-caja' + i, 33, u => {
      const a = .06 + i / puntos.length * .30
      const e = 1 - Math.pow(1 - Math.min(1, Math.max(0, (u - a) / .26)), 3)
      return `opacity:${e.toFixed(3)};transform:translate(-50%,-50%) scale(${(.8 + .2 * e).toFixed(3)})`
    }))
    return <>
      {puntos.map((p, i) => <React.Fragment key={i}>
        <div style={{ ...usa(bandas[i]), position: 'absolute', left: `${ZONA_X_MIN}%`,
          right: `${100 - ZONA_X_MAX}%`, top: `${p.y - 6.5}%`, height: '13%',
          transformOrigin: '0 50%', background: 'linear-gradient(90deg,' +
            'color-mix(in srgb,var(--acento) 40%,transparent),' +
            'color-mix(in srgb,var(--acento) 6%,transparent))' }} />
        <div className="es-nodo" style={{ ...usa(entradas[i]), left: `${p.x}%`, top: `${p.y}%` }}>
          {caja(conceptos, i)}
        </div>
      </React.Fragment>)}
    </>
  },

  // Fuente: docs/motion/lab-estructuras-2.html:145-163. Dos mitades y corte animado al 52%.
  // El campo es LOCAL a la estructura: no tapa el pie ni reemplaza la paleta/tipografia.
  partidoVertical: ({ kf, puntos, conceptos }) => {
    const corte = kf('partidoVertical-corte', 25, u => {
      const e = 1 - Math.pow(1 - Math.min(1, u / .34), 3)
      return `clip-path:inset(0 ${(100 - e * 52).toFixed(3)}% 0 0)`
    })
    const entradas = puntos.map((_, i) => kf('partidoVertical-caja' + i, 33, u => {
      const a = .36 + i / puntos.length * .28
      const e = 1 - Math.pow(1 - Math.min(1, Math.max(0, (u - a) / .26)), 3)
      return `opacity:${e.toFixed(3)};transform:translate(-50%,-50%) scale(${(.8 + .2 * e).toFixed(3)})`
    }))
    return <>
      <div style={{ position: 'absolute', left: `${ZONA_X_MIN}%`, right: `${100 - ZONA_X_MAX}%`,
        top: '18%', height: '49%', background: 'var(--sup)' }}>
        <div className="es-capa" style={{ ...usa(corte), background: 'var(--acento)' }} />
        <div className="es-capa" style={{ background:
          'repeating-linear-gradient(0deg,rgba(0,0,0,.14) 0 .3cqmin,transparent .3cqmin 3cqmin)' }} />
      </div>
      {puntos.map((p, i) => <div key={i} className="es-nodo"
        style={{ ...usa(entradas[i]), left: `${p.x}%`, top: `${p.y}%` }}>{caja(conceptos, i)}</div>)}
    </>
  },

  cintaDiagonal: ({ kf, puntos, conceptos, densidad }) => {
    const cinta = kf('cintaDiagonal', 25, u => { const p = Math.min(1, u / .32); return `transform:translateY(${((1-p)*-18).toFixed(2)}cqmin) rotate(-13deg);opacity:${p.toFixed(3)}` })
    return <><div style={{ ...usa(cinta), position: 'absolute', left: '-14%', right: '-14%', top: '38%', height: '20cqmin', background: 'var(--acento)', boxShadow: '0 2cqmin 4cqmin rgba(0,0,0,.55)' }} />{cajasConEntrada(kf, 'cintaDiagonal', puntos, conceptos, densidad, .24)}</>
  },
  marcoPoster: ({ kf, puntos, conceptos, densidad }) => {
    const marco = kf('marcoPoster', 25, u => `transform:scale(${Math.min(1,u/.3).toFixed(3)});opacity:${Math.min(1,u/.3).toFixed(3)}`)
    return <><div style={{ ...usa(marco), position:'absolute',left:'12%',right:'12%',top:'13%',bottom:'30%',border:'1.2cqmin solid var(--acento)',boxShadow:'inset 0 0 0 .45cqmin var(--sup)' }}/>{cajasConEntrada(kf, 'marcoPoster', puntos, conceptos, densidad, .18)}</>
  },
  anillosConcentricos: ({ kf, puntos, conceptos, densidad }) => {
    const anillos = [16,31,47].map((d,i)=>{const nom=kf('anilloEstructura'+i,33,u=>`transform:translate(-50%,-50%) scale(${(1+.08*Math.sin(u*TAU+i)).toFixed(3)});opacity:${(.25+i*.13).toFixed(3)}`);return <div key={i} style={{...usa(nom),position:'absolute',left:'50%',top:'43%',width:d+'cqmin',height:d+'cqmin',borderRadius:'50%',border:'.42cqmin solid var(--acento)'}}/>})
    return <>{anillos}{cajasConEntrada(kf,'anillosConcentricos',puntos,conceptos,densidad,.15)}</>
  },
  abanicoTarjetas: ({ kf, puntos, conceptos, densidad }) => {
    const cartas=puntos.map((_,i)=>{const nom=kf('abanicoCarta'+i,25,u=>{const e=Math.min(1,Math.max(0,(u-.08-i*.1)/.3));return `transform:translate(-50%,-50%) rotate(${((-1+i)*17*e).toFixed(2)}deg) translateY(${((1-e)*12).toFixed(2)}cqmin);opacity:${e.toFixed(3)}`});return <div key={i} style={{...usa(nom),position:'absolute',left:'50%',top:'44%',width:'34cqmin',height:'18cqmin',border:'.3cqmin solid var(--acento)',background:'color-mix(in srgb,var(--sup) 88%,transparent)',borderRadius:'2cqmin'}}/>})
    return <>{cartas}{cajasConEntrada(kf,'abanicoTarjetas',puntos,conceptos,densidad,.2)}</>
  },
  rayosImpacto: ({ kf, puntos, conceptos, densidad }) => {
    const rayos=Array.from({length:18},(_,i)=>{const nom=kf('rayoImpacto'+i,25,u=>{const e=Math.min(1,u/.28);return `transform:rotate(${i*20}deg) scaleY(${e.toFixed(3)});opacity:${(.25+.55*e).toFixed(3)}`});return <div key={i} style={{...usa(nom),position:'absolute',left:'50%',top:'44%',width:`${3+i%3}cqmin`,height:'85cqmin',transformOrigin:'50% 0',background:'linear-gradient(var(--acento),transparent 70%)'}}/>})
    return <>{rayos}{cajasConEntrada(kf,'rayosImpacto',puntos,conceptos,densidad,.18)}</>
  },
  engranajes: ({ kf, puntos, conceptos, densidad }) => {
    const ruedas=[[33,43,19],[67,42,16],[50,58,14]].map(([x,y,d],i)=>{const nom=kf('engranaje'+i,33,u=>`transform:translate(-50%,-50%) rotate(${(u*360*(i%2?1:-1)).toFixed(2)}deg)`);return <div key={i} style={{...usa(nom),position:'absolute',left:x+'%',top:y+'%',width:d+'cqmin',height:d+'cqmin',borderRadius:'50%',border:'1.7cqmin dotted var(--acento)',boxShadow:'0 0 0 .35cqmin var(--sup)'}}/>})
    return <>{ruedas}{cajasConEntrada(kf,'engranajes',puntos,conceptos,densidad,.16)}</>
  },
  cuaderno: ({ kf, puntos, conceptos, densidad }) => {
    const subrayado=kf('cuadernoSubrayado',25,u=>`transform:scaleX(${Math.min(1,u/.35).toFixed(3)})`)
    return <><div className="es-capa" style={{left:'13%',right:'13%',top:'15%',bottom:'29%',background:'repeating-linear-gradient(180deg,transparent 0 7cqmin,color-mix(in srgb,var(--acento) 25%,transparent) 7cqmin 7.3cqmin)',borderLeft:'.5cqmin solid var(--acento)'}}/><div style={{...usa(subrayado),position:'absolute',left:'20%',right:'20%',top:'56%',height:'.5cqmin',background:'var(--acento)',transformOrigin:'0 50%'}}/>{cajasConEntrada(kf,'cuaderno',puntos,conceptos,densidad,.15)}</>
  },
  cascada: ({ kf, puntos, conceptos, densidad }) => {
    const escalones=puntos.map((p,i)=>{const nom=kf('cascadaEscalon'+i,25,u=>{const e=Math.min(1,Math.max(0,(u-i*.1)/.3));return `transform:translate(${((1-e)*-14).toFixed(2)}cqmin,${((1-e)*-8).toFixed(2)}cqmin);opacity:${e.toFixed(3)}`});return <div key={i} style={{...usa(nom),position:'absolute',left:`${p.x-10}%`,top:`${p.y-5}%`,width:'29cqmin',height:'13cqmin',background:'linear-gradient(135deg,color-mix(in srgb,var(--acento) 38%,transparent),transparent)',borderLeft:'.4cqmin solid var(--acento)'}}/>})
    return <>{escalones}{cajasConEntrada(kf,'cascada',puntos,conceptos,densidad,.22)}</>
  },
  editorial: ({ kf, puntos, conceptos, densidad }) => {
    const bloque=kf('editorialBloque',25,u=>`transform:translateX(${((1-Math.min(1,u/.3))*-9).toFixed(2)}cqmin);opacity:${Math.min(1,u/.3).toFixed(3)}`)
    return <><div style={{...usa(bloque),position:'absolute',left:'15%',top:'24%',width:'27%',height:'36%',borderTop:'1cqmin solid var(--acento)',borderBottom:'.28cqmin solid var(--acento)'}}><span style={{font:'800 14cqmin/1 Archivo,sans-serif',color:'var(--apoyo)'}}>+</span></div>{cajasConEntrada(kf,'editorial',puntos,conceptos,densidad,.16)}</>
  },
  mundoIsometrico: ({ kf, puntos, conceptos, densidad }) => {
    const tiles=Array.from({length:15},(_,i)=>{const nom=kf('tileIso'+i,25,u=>{const e=Math.min(1,Math.max(0,(u-i*.035)/.28));return `transform:rotateX(58deg) rotateZ(45deg) scale(${e.toFixed(3)});opacity:${e.toFixed(3)}`});return <div key={i} style={{...usa(nom),position:'absolute',left:`${31+(i%5)*9}%`,top:`${31+Math.floor(i/5)*9}%`,width:'11cqmin',height:'11cqmin',background:'color-mix(in srgb,var(--acento) 30%,transparent)',border:'.22cqmin solid var(--acento)'}}/>})
    return <div className="es-capa" style={{perspective:'120cqmin',transformStyle:'preserve-3d'}}>{tiles}{cajasConEntrada(kf,'mundoIsometrico',puntos,conceptos,densidad,.22)}</div>
  },
  pilaVertical: ({ kf, puntos, conceptos, densidad }) => {
    const bloques=puntos.map((p,i)=>{const nom=kf('pilaBloque'+i,25,u=>{const e=Math.min(1,Math.max(0,(u-i*.12)/.28));return `transform:translate(-50%,${((1-e)*-18).toFixed(2)}cqmin);opacity:${e.toFixed(3)}`});return <div key={i} style={{...usa(nom),position:'absolute',left:'50%',top:`${p.y}%`,width:'38cqmin',height:'12cqmin',marginTop:'-6cqmin',background:'color-mix(in srgb,var(--acento) 24%,var(--sup))',border:'.3cqmin solid var(--acento)'}}/>})
    return <>{bloques}{cajasConEntrada(kf,'pilaVertical',puntos,conceptos,densidad,.18)}</>
  },

  /** PIEZA DE PRUEBA. Una sola caja centrada, sin aristas ni heroe. */
  unaCaja: ({ kf, puntos, conceptos }) => {
    const nom = kf('caja0', 25, u => {
      const e = 1 - Math.pow(1 - Math.min(1, u / 0.3), 3)
      return `opacity:${e.toFixed(3)};transform:translate(-50%,-50%) scale(${(0.8 + 0.2 * e).toFixed(3)})`
    })
    const p = puntos[0] ?? { x: 50, y: 40 }
    return (
      <div className="es-nodo" style={{ ...usa(nom), left: p.x + '%', top: p.y + '%' }}>
        {caja(conceptos, 0)}
      </div>
    )
  }
}

/**
 * El heroe y el verbo visual son comunes; la PIEZA declara posicion y relacion. Asi las 17
 * estructuras no pueden olvidar el sujeto ni degradar la relacion a cajas co-presentes.
 */
function heroeRelacionado(
  kf: Kf, meta: MetaEstructura, puntos: PuntoEscena[], ancla: Concepto, params: Parametros
): React.ReactNode {
  const { x, y, relacion } = meta.heroe
  const entrada = kf(`hero-${relacion}`, 33, u => {
    const e = 1 - Math.pow(1 - Math.min(1, u / .28), 3)
    return `opacity:${e.toFixed(3)};transform:translate(-50%,-50%) translateY(${(Math.sin(u * TAU) * .9).toFixed(3)}cqmin) scale(${(.82 + .18 * e).toFixed(3)})`
  })
  const trazos = puntos.map((_, i) => kf(`rel-${relacion}-${i}`, 33, u => {
    const inicio = .1 + i * .08
    const e = Math.min(1, Math.max(0, (u - inicio) / .24))
    return `stroke-dashoffset:${(1 - e).toFixed(3)};opacity:${(.22 + e * .58).toFixed(3)}`
  }))
  const lineas = relacion === 'contiene' || relacion === 'expande' || relacion === 'orbita'
    ? <ellipse cx={x} cy={y} rx="14" ry="10" fill="none" stroke="var(--acento)" strokeWidth=".45"
        pathLength="1" strokeDasharray="1" style={usa(trazos[0] ?? entrada)} />
    : puntos.map((p, i) => <path key={i} pathLength="1" fill="none" stroke="var(--acento)" strokeWidth=".45"
        strokeDasharray="1" d={`M${x},${y} L${p.x.toFixed(2)},${p.y.toFixed(2)}`}
        style={usa(trazos[i] ?? entrada)} />)
  return <>
    <svg className="es-svg" viewBox="0 0 100 100" preserveAspectRatio="none">{lineas}</svg>
    <div className="es-hero" style={{ ...usa(entrada), left: `${x}%`, top: `${y}%`,
      // `escalaHero` sigue siendo un rango de instancia de la estructura. El icono sustituyo
      // al emoji, no la geometria: quitar este consumo haria que el rango contara sin pixel.
      fontSize: `${(params.escalaHero ?? 26).toFixed(2)}cqmin` }}>
      <IconoSolar concepto={ancla} estilo="bold-duotone" className="es-icono" titulo={ancla.etiqueta} />
    </div>
  </>
}

// ── PIEZAS COMUNES A TODAS LAS ESCENAS ──────────────────────────────────────────────────────

function decoradores(kf: Kf, n: number, entrada: ReturnType<typeof entradaRitmo>, rndPos: () => number): React.ReactNode {
  const salida: React.ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const p = posicionDecorador(rndPos)
    const ret = entrada.retardos[i] ?? 0
    const nom = kf('deco' + i, 25, u => {
      const bruto = Math.min(1, Math.max(0, (u - ret) / entrada.ventana))
      const e = entrada.curva === 'acelerar' ? bruto * bruto
        : entrada.curva === 'frenar' ? 1 - Math.pow(1 - bruto, 2)
          : entrada.curva === 'golpe' ? 1 - Math.pow(1 - bruto, 4) : bruto
      return `opacity:${(e * 0.7).toFixed(3)};transform:translate(-50%,-50%) scale(${(0.5 + 0.5 * e).toFixed(3)})`
    })
    salida.push(<div key={i} className="es-deco" style={{ ...usa(nom), left: p.x + '%', top: p.y + '%' }} />)
  }
  return salida
}

/** El pie vive DENTRO del arbol de la composicion -- no en AnimatedGraphic -- porque solo asi
 *  recibe el factor de camara 0.20: el pie de AnimatedGraphic es HERMANO de este arbol. */
function textoPie(kf: Kf, palabra: string, tipografia: IdTipografia): React.ReactNode {
  const fuente = TIPOGRAFIAS[tipografia]
  const nom = kf('pie', 25, u => {
    const e = 1 - Math.pow(1 - Math.min(1, u / 0.22), 3)
    return `opacity:${e.toFixed(3)};transform:translateY(${((1 - e) * 3).toFixed(2)}cqmin)`
  })
  return (
    <div className="es-pie" style={usa(nom)}>
      <p className="es-pie-tit" style={{ fontFamily: `${fuente.familia},sans-serif`,
        fontWeight: fuente.peso, textTransform: fuente.transformacion }}>{palabra}</p>
      <div className="es-pie-barra" />
    </div>
  )
}

/**
 * EL ENVOLTORIO DE CAMARA, generico: no sabe que camara es, se la pregunta al registro.
 *
 * Con `transform: null` -- la pieza `quieto` -- NO emite @keyframes y NO pone `will-change`.
 * Eso la convierte en el CONTROL de la medicion de coste: la version "sin camara" es una pieza
 * registrada, no un parche que hay que acordarse de no commitear.
 *
 * EMITE, asi que TIENE que llamarse antes del return. Ver `construir()`.
 */
function conCamara(
  kf: Kf, contenido: React.ReactNode, f: number, z: number, idCamara: IdCamara, params: Parametros
): React.ReactNode {
  const fn = CAMARAS[idCamara].transform
  if (!fn) {
    return <div key={z} className="es-capa" style={{ zIndex: z }}>{contenido}</div>
  }
  const nom = kf('cam' + z, 41, u => fn(u, f, params))
  return (
    <div key={z} className="es-capa" style={{ ...usa(nom), zIndex: z, willChange: 'transform' }}>
      {contenido}
    </div>
  )
}

// ── LA CACHE DE ARBOL ───────────────────────────────────────────────────────────────────────
//
// `direccionDe` depende UNICAMENTE de `semilla`, que llega desde `extra` y YA forma parte de la
// clave del hash del fichero. Y el arbol nunca hornea `ciclo` ni `sistema`: usa
// `var(--ciclo)` y `var(--acento)` simbolicos. Asi que la clave no necesita nada mas.
const CACHE_MAX = 4
const cache = new Map<string, React.ReactElement<{ style: React.CSSProperties }>>()

/** Los separadores son caracteres de control, escritos con SECUENCIA DE ESCAPE y nunca
 *  literales: un caracter de control literal es invisible en el fuente, y el dia que un editor
 *  se lo coma, "ab"+"c" y "a"+"bc" darian la MISMA clave sin que nada lo dijera. */
function claveDe(value: string, cs: Concepto[], ancla: Concepto | null, dir: unknown, semilla: number): string {
  // LA DIRECCION ENTRA EN LA CLAVE. El arbol depende de ella -- otra pieza es otro dibujo -- y
  // esta cache es por proceso: sin esto, dos Visuales con la misma palabra y direcciones
  // distintas se servirian el mismo arbol y el segundo saldria con las piezas del primero.
  const d = dir && typeof dir === "object" ? JSON.stringify(dir) : String(dir ?? "")
  const a = ancla ? ancla.emoji + '\u0001' + ancla.etiqueta + '\u0001' + (ancla.icono ?? '') : ''
  return value + '\u0002' + cs.map(c => c.emoji + '\u0001' + c.etiqueta + '\u0001' + (c.icono ?? '')).join('\u0003') +
    '\u0004' + d + '\u0005' + String(semilla) + '\u0006' + a
}

function construir(value: string, cs: Concepto[], ancla: Concepto | null, dirCruda: unknown, semilla: number) {
  // La direccion que trajo el guion, validada contra los registros; lo que falte o no exista,
  // sorteado por semilla. Es la costura de la Fase 7 y hoy ya es el camino real.
  const direccion = direccionDesde(dirCruda, semilla, { texto: value, conceptos: cs })

  // Streams de aleatoriedad INDEPENDIENTES, mismo patron que mapa.tsx: si no se separan, anadir
  // una pieza a un registro desplazaria TAMBIEN el jitter de los puntos y las posiciones de los
  // decoradores para semillas que ya tenian un dibujo asignado.
  const instancia = instanciaDe(value, direccion, semilla)
  const rndPts = generador(instancia.semillas.puntos)
  const rndDeco = generador(instancia.semillas.decoradores)

  const pref = 'es' + (semilla >>> 0).toString(36)
  const { kf, reglas } = emisor(pref)

  // ═══ RESOLUCION POR REGISTRO: aqui esta el enchufe ══════════════════════════════════════
  // Ni un nombre de pieza escrito a mano. Anadir la estructura 18 no toca ninguna linea de aqui.
  const metaEstructura = ESTRUCTURAS[direccion.estructura]

  // LOS PARAMETROS DE INSTANCIA. Un stream propio, separado del de los puntos y del de los
  // decoradores: si compartieran generador, anadir un rango a una pieza desplazaria TAMBIEN la
  // disposicion de las otras dos capas para semillas que ya tenian un dibujo asignado.
  //
  // EL ORDEN -- fondo, estructura, camara -- ES PARTE DEL RESULTADO: cada `parametrosDe` avanza
  // el generador, asi que reordenar estas tres lineas cambia todos los dibujos.
  const parFondo = instancia.fondo
  const parEstructura = instancia.estructura
  const parCamara = instancia.camara

  const puntos = metaEstructura.disposicion.puntos(rndPts, cs.map(c => c.etiqueta), parEstructura)
  const nDeco = DENSIDAD_A_N[direccion.densidad]
  const densidadEstructura = metaEstructura.disposicion.adaptarDensidad(nDeco)
  // Un ciclo normalizado conserva las mismas fracciones que el ciclo real; la lista de
  // duraciones de arriba vuelve a pasar estos cinco perfiles por `ajustar(ciclo, ...)`.
  const entrada = entradaRitmo(nDeco, direccion.ritmo, 1)

  // ═══ TODO LO QUE EMITE @keyframes, ANTES DEL RETURN. LAS CAMARAS TAMBIEN. ═══════════════
  // Las cuatro `conCamara` estaban DENTRO del return en la primera version de este fichero, y
  // por eso ninguna capa se movia: JSX evalua sus hijos EN ORDEN y el <style> es el primero.
  // La forma de que no vuelva a pasar no es acordarse: es que el JSX de abajo NO PUEDA llamar a
  // nada que emita. Solo consume constantes ya construidas.
  const capaFondo = DIBUJO_FONDOS[direccion.fondo]({ kf, params: parFondo })
  const capaEstructura = <>
    {DIBUJO_ESTRUCTURAS[direccion.estructura]({ kf, puntos, conceptos: cs, params: parEstructura, densidad: densidadEstructura })}
    {heroeRelacionado(kf, metaEstructura, puntos, ancla ?? cs[0] ?? { emoji: '?', etiqueta: 'ancla' }, parEstructura)}
  </>
  const capaDecoradores = decoradores(kf, nDeco, entrada, rndDeco)
  const capaTexto = textoPie(kf, value, direccion.tipografia)

  const capas: React.ReactNode[] = [
    conCamara(kf, capaFondo, PROFUNDIDAD.fondo, 1, direccion.camara, parCamara),
    conCamara(kf, capaEstructura, PROFUNDIDAD.estructura, 2, direccion.camara, parCamara),
    conCamara(kf, capaDecoradores, PROFUNDIDAD.decoradores, 3, direccion.camara, parCamara),
    conCamara(kf, capaTexto, PROFUNDIDAD.texto, 4, direccion.camara, parCamara)
  ]

  // LA HOJA SE SERIALIZA AQUI, LA ULTIMA. Nada por debajo de esta linea puede emitir.
  const hoja = CSS_FIJO + reglas.join('\n')

  // `container-type: size` Y NO `inline-size`: todas las medidas son `cqmin`, que es el MENOR de
  // las dos dimensiones y necesita las DOS. Con `inline-size` no resuelve y cae a su valor de
  // reserva: la escena sale "casi bien", a una escala que no es la suya, y no falla nada.
  // mapa.tsx usa `inline-size` y esta CORRECTO: sus medidas son `cqw`. La unidad decide el
  // container-type, no al reves.
  const raiz: React.CSSProperties = { position: 'absolute', inset: 0, containerType: 'size' }

  return (
    <div style={raiz}>
      <style dangerouslySetInnerHTML={{ __html: hoja }} />
      {capas}
    </div>
  )
}

/** SceneSpec-only structure marks. Legacy continues to use DIBUJO_ESTRUCTURAS unchanged. */
function estructuraMvpV2(kf: Kf, spec: VisualSceneSpecV1, hasHero: boolean): React.ReactNode {
  if (!hasHero || spec.visualMode === 'editorial-text' || spec.direccion.estructura === 'constelacion') return null
  const entrada = kf('estructura-v2', 25, value => {
    const p = Math.min(1, value / .3)
    return `opacity:${(.12 + p * .3).toFixed(3)};transform:scale(${(.94 + p * .06).toFixed(3)})`
  })
  if (spec.direccion.estructura === 'marcoPoster') {
    return <div data-qc-structure-mark="frame-with-hero" style={{
      ...usa(entrada), position: 'absolute', left: '15%', top: '18%', width: '58%', height: '48%',
      boxSizing: 'border-box', transformOrigin: '44% 42%',
      border: '.55cqmin solid var(--acento)',
      boxShadow: 'inset 0 0 0 .18cqmin color-mix(in srgb,var(--apoyo) 48%,transparent)',
    }} />
  }
  return <div data-qc-structure-mark="editorial-rail-with-hero" style={{
    ...usa(entrada), position: 'absolute', left: '13%', top: '20%', width: '.65cqmin', height: '43%',
    transformOrigin: '50% 50%', background: 'var(--acento)',
    boxShadow: '2cqmin 0 0 color-mix(in srgb,var(--apoyo) 20%,transparent)',
  }} />
}

/** A bounded SceneSpec decorator layer. The legacy 1/3/5/8/14 budget remains untouched. */
function decoradoresMvpV2(
  kf: Kf,
  n: number,
  entrada: ReturnType<typeof entradaRitmo>,
  rndPos: () => number,
  visualMode: VisualSceneSpecV1['visualMode'],
): React.ReactNode {
  const output: React.ReactNode[] = []
  const maxOpacity = visualMode === 'editorial-text' ? .24 : .34
  for (let index = 0; index < n; index++) {
    const point = posicionDecorador(rndPos)
    const delay = entrada.retardos[index] ?? 0
    const animation = kf('deco-v2-' + index, 25, value => {
      const raw = Math.min(1, Math.max(0, (value - delay) / entrada.ventana))
      const eased = entrada.curva === 'acelerar' ? raw * raw
        : entrada.curva === 'frenar' ? 1 - Math.pow(1 - raw, 2)
          : entrada.curva === 'golpe' ? 1 - Math.pow(1 - raw, 4) : raw
      return `opacity:${(eased * maxOpacity).toFixed(3)};transform:translate(-50%,-50%) scale(${(.72 + .28 * eased).toFixed(3)})`
    })
    output.push(<div key={index} className="es-deco" data-qc-decorator="true" style={{
      ...usa(animation), left: `${point.x}%`, top: `${point.y}%`,
      width: visualMode === 'editorial-text' ? '.78cqmin' : '.95cqmin',
      height: visualMode === 'editorial-text' ? '.78cqmin' : '.95cqmin',
      boxShadow: 'none',
    }} />)
  }
  return output
}

/**
 * Productive asset-led/editorial path. It deliberately reuses the current background,
 * structure, camera and decorator registries: sceneSpec selects a certified structure but does
 * not carry a second set of coordinates. Hero placement still comes from HeroEstructura.
 */
function construirMvp(
  spec: VisualSceneSpecV1,
  runtimeAssets: readonly RuntimeRenderAssetV1[],
  u: number,
): React.ReactElement {
  // instanciaDe only consumes fondo/estructura/camara ranges. The legacy typography field is a
  // required part of Direccion but does not influence any of those streams; the productive text
  // pair lives exclusively in sceneSpec.text.fontPairId.
  const direccionInstancia: Direccion = { ...spec.direccion, tipografia: 'archivo' }
  const instancia = instanciaDe(spec.text.keyword, direccionInstancia, spec.direccion.semilla)
  const rndDeco = generador(instancia.semillas.decoradores)
  const prefijo = 'esmvp' + (spec.direccion.semilla >>> 0).toString(36)
  const { kf, reglas } = emisor(prefijo)
  const heroSlot = spec.slots.find(
    (slot): slot is PresentHeroSlotV1 => slot.state === 'present',
  )
  const solarHeroSlot = spec.slots.find(
    (slot): slot is ProceduralHeroSlotV1 => slot.state === 'procedural',
  )
  const hasHero = Boolean(heroSlot || solarHeroSlot)
  const nDeco = decoratorBudgetV2(spec.visualMode, spec.direccion.densidad, hasHero)
  const entrada = entradaRitmo(nDeco, spec.direccion.ritmo, 1)
  const runtimeHero = runtimeAssets.find(asset => asset.slotId === 'hero')
  if (spec.visualMode === 'asset-led' && !heroSlot && !solarHeroSlot) {
    throw new Error('VISUAL_RUNTIME_HERO_REQUIRED')
  }
  if (spec.visualMode === 'asset-led' && heroSlot && !runtimeHero) throw new Error('VISUAL_RUNTIME_HERO_REQUIRED')

  const capaFondo = DIBUJO_FONDOS[spec.direccion.fondo]({ kf, params: instancia.fondo })
  const capaEstructura = <>
    {estructuraMvpV2(kf, spec, hasHero)}
    {heroSlot && runtimeHero &&
      <ProjectAssetHero spec={spec} slot={heroSlot} runtimeAsset={runtimeHero} u={u} />}
    {solarHeroSlot && <ProceduralSolarHero spec={spec} slot={solarHeroSlot} u={u} />}
  </>
  const capaDecoradores = decoradoresMvpV2(kf, nDeco, entrada, rndDeco, spec.visualMode)
  const capaTexto = <EditorialText spec={spec} u={u} />
  const capas: React.ReactNode[] = [
    conCamara(kf, capaFondo, PROFUNDIDAD.fondo, 1, spec.direccion.camara, instancia.camara),
    conCamara(kf, capaEstructura, PROFUNDIDAD.estructura, 2, spec.direccion.camara, instancia.camara),
    conCamara(kf, capaDecoradores, PROFUNDIDAD.decoradores, 3, spec.direccion.camara, instancia.camara),
    conCamara(kf, capaTexto, PROFUNDIDAD.texto, 4, spec.direccion.camara, instancia.camara),
  ]
  const fondo = FONDOS[spec.direccion.fondo]
  const tono = 'tonoDominante' in fondo ? fondo.tonoDominante : fondo.tono
  const colores = coloresEscena(spec.sistema, tono)
  const hoja = CSS_FIJO + reglas.join('\n')

  return (
    <div key={sceneSpecReactKey(spec)} data-visual-mvp="true"
      data-visual-composition="v2"
      data-visual-density={spec.direccion.densidad}
      data-qc-decorator-count={nDeco}
      data-qc-empty-hero-frames="0"
      style={{
      position: 'absolute', inset: 0, containerType: 'size',
      '--texto': colores.texto, '--sup': colores.sup, '--acento': colores.acento,
      '--apoyo': colores.apoyo, '--caja': colores.caja,
      '--sombra-pie': tono === 'claro' ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.85)',
    } as React.CSSProperties}>
      <style dangerouslySetInnerHTML={{ __html: hoja }} />
      {capas}
    </div>
  )
}

function render({
  u, texto, conceptos, ancla, direccion, sistema, semilla, sceneSpec, runtimeAssets = [],
}: PropsComposicion): React.ReactNode {
  if (sceneSpec) return construirMvp(sceneSpec, runtimeAssets, u)
  const value = texto ?? ''
  const cs: Concepto[] = Array.isArray(conceptos) ? conceptos.slice(0, CUANTOS_CONCEPTOS).filter(Boolean) : []
  const semillaUsada = Number.isInteger(semilla) && semilla > 0 ? semilla : semillaDe(value)
  const anclaSegura = ancla && ancla.emoji && ancla.etiqueta ? ancla : cs[0] ?? null
  const clave = claveDe(value, cs, anclaSegura, direccion, semillaUsada)
  let arbol = cache.get(clave)
  if (arbol === undefined) {
    arbol = construir(value, cs, anclaSegura, direccion, semillaUsada)
    if (cache.size >= CACHE_MAX) {
      const primera = cache.keys().next().value
      if (primera !== undefined) cache.delete(primera)
    }
    cache.set(clave, arbol)
  }
  // El color se aplica FUERA de la cache: cambiar sistema no puede servir tinta vieja.
  // cloneElement conserva la misma raiz, sin introducir otro contenedor de unidades.
  const dir = direccionDesde(direccion, semillaUsada, { texto: value, conceptos: cs })
  const fondo = FONDOS[dir.fondo]
  const tono = 'tonoDominante' in fondo ? fondo.tonoDominante : fondo.tono
  const colores = coloresEscena(sistema, tono)
  return React.cloneElement(arbol, { style: { ...arbol.props.style,
    '--texto': colores.texto, '--sup': colores.sup, '--acento': colores.acento,
    '--apoyo': colores.apoyo, '--caja': colores.caja,
    '--sombra-pie': tono === 'claro' ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.85)'
  } as React.CSSProperties })
}

export const escena: Composicion = {
  nombre: 'escena',
  duraciones: (ciclo) => duracionesDe(ciclo).usadas,
  avisos: (ciclo) => duracionesDe(ciclo).avisos,
  /**
   * TRES CONDICIONES, y las tres caen al respaldo que ya existe en vez de pintar algo peor.
   *
   * 1. CONCEPTOS SUFICIENTES para la estructura que toque. El minimo lo declara la PIEZA
   *    (`minConceptos`), no esta escrito aqui: `unaCaja` se conforma con uno y `constelacion`
   *    pide tres, y `render` no tiene que saberlo.
   * 2. QUE CADA ETIQUETA QUEPA en la zona aunque haya que centrarla.
   * 3. QUE LA PALABRA QUEPA EN EL PIE, en las DOS lineas presupuestadas.
   *
   * ═══ SI CAMBIAS CUALQUIERA, SUBE VERSION_PLANTILLAS EN main/index.ts ═══
   * La condicion NO esta en la clave del hash: el `type` sigue diciendo `visual_escena` tanto si
   * se dibuja como si cae a texto.
   */
  puedeDibujar: (d) => {
    const cs = d.conceptos
    if (!Array.isArray(cs)) return false
    const buenos = cs.filter(c => !!c && !!c.emoji && !!c.etiqueta)
    if (buenos.length !== cs.length) return false
    // El minimo sale de la ESTRUCTURA que va a tocar, y esa depende de la MISMA semilla que usa
    // `construir`: la puerta y el dibujo no pueden discrepar.
    const semilla = Number.isInteger(d.semilla) && Number(d.semilla) > 0
      ? Number(d.semilla) : semillaDe(d.texto ?? '')
    const dir = direccionDesde(d.direccion, semilla)
    if (buenos.length < ESTRUCTURAS[dir.estructura].minConceptos) return false
    if (!buenos.every(c => cabeLaEtiqueta(c.etiqueta))) return false
    return cabeEnElPie(d.texto, dir.tipografia)
  },
  // TRUE: la composicion pinta su propio texto (capaTexto, con factor de camara 0.20). El pie de
  // AnimatedGraphic es HERMANO del arbol de render(), no hijo -- con `false` la palabra saldria
  // SIN camara, y ademas dos veces.
  pintaPie: true,
  render
}
