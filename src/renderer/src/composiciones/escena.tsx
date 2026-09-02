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
import { ajustar, type DuracionUsada } from '../../../shared/ciclo'
import { generador, semillaDe } from '../../../shared/semilla'
import { CUANTOS_CONCEPTOS, type Concepto } from '../../../shared/conceptos'
import {
  ESTRUCTURAS, CAMARAS, direccionDesde, PROFUNDIDAD, retardosDecoradores,
  posicionDecorador, DENSIDAD_A_N, cabeEnElPie, cabeLaEtiqueta, instanciaDe,
  TIPOGRAFIAS, type IdTipografia,
  type IdFondo, type IdEstructura, type IdCamara, type PuntoEscena, type Parametros
} from '../../../shared/escena'
import type { Composicion, PropsComposicion } from './index'

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
const CSS_FIJO = `
.es-capa{position:absolute;inset:0}
.es-svg{position:absolute;inset:0;width:100%;height:100%}
.es-nodo{position:absolute;transform:translate(-50%,-50%);white-space:nowrap}
.es-caja{display:flex;align-items:center;gap:1.3cqmin;padding:1.5cqmin 2.4cqmin;
  border-radius:1.7cqmin;background:rgba(9,12,20,.9);border:.3cqmin solid var(--acento);
  backdrop-filter:blur(.19cqmin)}
.es-mini{font-size:4.4cqmin;line-height:1;flex:none}
.es-etq{font:700 2.9cqmin Archivo,system-ui,sans-serif;letter-spacing:.01em;color:var(--texto)}
.es-hero{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);
  font-size:26cqmin;line-height:1;filter:drop-shadow(0 2cqmin 2.6cqmin rgba(0,0,0,.7))}
.es-deco{position:absolute;width:1.6cqmin;height:1.6cqmin;border-radius:50%;
  transform:translate(-50%,-50%);background:var(--apoyo)}
.es-anillo{position:absolute;left:50%;top:45%;border-radius:50%;
  border:.3cqmin solid var(--acento)}
.es-pie{position:absolute;left:8.33%;right:8.33%;bottom:16%;text-align:center}
.es-pie-tit{font:800 9cqmin/0.95 Archivo,sans-serif;color:var(--texto);margin:0;
  min-height:17.1cqmin;overflow-wrap:anywhere;
  text-shadow:0 .3cqmin 2cqmin rgba(0,0,0,.85)}
.es-pie-barra{height:.9cqmin;width:14cqmin;margin:2.6cqmin auto 0;border-radius:99cqmin;
  background:var(--acento)}
`

// ── LO QUE RECIBE CADA PIEZA AL DIBUJARSE ───────────────────────────────────────────────────
// `params` sale de los RANGOS de la pieza mas la semilla: es su instancia. Va en el contexto y
// no como argumento suelto para que anadir un dato mas tarde no cambie la firma de las 17.
export type CtxFondo = { kf: Kf; params: Parametros }
export type CtxEstructura = { kf: Kf; puntos: PuntoEscena[]; conceptos: Concepto[]; params: Parametros }

export type DibujoFondo = (c: CtxFondo) => React.ReactNode
export type DibujoEstructura = (c: CtxEstructura) => React.ReactNode

// ── EL REGISTRO DE DIBUJOS: FONDOS ──────────────────────────────────────────────────────────

const DIBUJO_FONDOS: Record<IdFondo, DibujoFondo> = {
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

  /** PIEZA DE PRUEBA. Fea a proposito: existe para demostrar que cambiar `direccion.fondo`
   *  cambia el fondo SIN tocar `render`. Si esto no bastara, el registro seria decorativo. */
  liso: () => <div className="es-capa" style={{ background: 'var(--sup)' }} />
}

// ── EL REGISTRO DE DIBUJOS: ESTRUCTURAS ─────────────────────────────────────────────────────

/** La caja de un concepto. Compartida: la usan las dos estructuras y la heredaran las 17. */
function caja(cs: Concepto[], i: number): React.ReactNode {
  return (
    <div className="es-caja">
      <span className="es-mini">{cs[i]?.emoji ?? ''}</span>
      <span className="es-etq">{cs[i]?.etiqueta ?? ''}</span>
    </div>
  )
}

const DIBUJO_ESTRUCTURAS: Record<IdEstructura, DibujoEstructura> = {
  constelacion: ({ kf, puntos, conceptos, params }) => {
    const curva = params.curva ?? 4
    const escalaHero = params.escalaHero ?? 26
    const nomEntrada = puntos.map((_, i) => kf('nodo' + i, 33, u => {
      const a = 0.06 + (i / puntos.length) * 0.30
      const p = Math.min(1, Math.max(0, (u - a) / 0.26))
      const e = 1 - Math.pow(1 - p, 3)
      return `opacity:${e.toFixed(3)};transform:translate(-50%,-50%) scale(${(0.7 + 0.3 * e).toFixed(3)})`
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
    const nomHero = kf('hero', 41, u =>
      `transform:translate(-50%,-50%) translateY(${(Math.sin(u * TAU) * 1.3).toFixed(3)}cqmin)`)
    // LA RANURA DEL HEROE: hoy un emoji, mañana un `<img>` recortado en el MISMO sitio y con el
    // MISMO factor de camara.
    const hero = (
      <div className="es-hero" style={{ ...usa(nomHero), fontSize: `${escalaHero.toFixed(2)}cqmin` }}>
        {conceptos[0]?.emoji ?? ''}
      </div>
    )
    return <>{aristas}{nodos}{hero}</>
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

// ── PIEZAS COMUNES A TODAS LAS ESCENAS ──────────────────────────────────────────────────────

function decoradores(kf: Kf, n: number, retardos: number[], rndPos: () => number): React.ReactNode {
  const salida: React.ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const p = posicionDecorador(rndPos)
    const ret = retardos[i] ?? 0
    const nom = kf('deco' + i, 25, u => {
      const e = Math.min(1, Math.max(0, (u - ret) / 0.20))
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
// `direccionDe` depende UNICAMENTE de `semilla`, que sale de `semillaDe(texto)`, y `texto` YA es
// la clave del hash del fichero. Y el arbol nunca hornea `ciclo` ni `sistema`: usa
// `var(--ciclo)` y `var(--acento)` simbolicos. Asi que la clave no necesita nada mas.
const CACHE_MAX = 4
const cache = new Map<string, React.ReactNode>()

/** Los separadores son caracteres de control, escritos con SECUENCIA DE ESCAPE y nunca
 *  literales: un caracter de control literal es invisible en el fuente, y el dia que un editor
 *  se lo coma, "ab"+"c" y "a"+"bc" darian la MISMA clave sin que nada lo dijera. */
function claveDe(value: string, cs: Concepto[], dir: unknown): string {
  // LA DIRECCION ENTRA EN LA CLAVE. El arbol depende de ella -- otra pieza es otro dibujo -- y
  // esta cache es por proceso: sin esto, dos Visuales con la misma palabra y direcciones
  // distintas se servirian el mismo arbol y el segundo saldria con las piezas del primero.
  const d = dir && typeof dir === "object" ? JSON.stringify(dir) : String(dir ?? "")
  return value + '\u0002' + cs.map(c => c.emoji + '\u0001' + c.etiqueta).join('\u0003') +
    '\u0004' + d
}

function construir(value: string, cs: Concepto[], dirCruda: unknown): React.ReactNode {
  const semilla = semillaDe(value)
  // La direccion que trajo el guion, validada contra los registros; lo que falte o no exista,
  // sorteado por semilla. Es la costura de la Fase 7 y hoy ya es el camino real.
  const direccion = direccionDesde(dirCruda, semilla)

  // Streams de aleatoriedad INDEPENDIENTES, mismo patron que mapa.tsx: si no se separan, anadir
  // una pieza a un registro desplazaria TAMBIEN el jitter de los puntos y las posiciones de los
  // decoradores para semillas que ya tenian un dibujo asignado.
  const instancia = instanciaDe(value, direccion)
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

  const puntos = metaEstructura.puntos(rndPts, cs.map(c => c.etiqueta), parEstructura)
  const nDeco = DENSIDAD_A_N[direccion.densidad]
  const retardos = retardosDecoradores(nDeco, direccion.ritmo)

  // ═══ TODO LO QUE EMITE @keyframes, ANTES DEL RETURN. LAS CAMARAS TAMBIEN. ═══════════════
  // Las cuatro `conCamara` estaban DENTRO del return en la primera version de este fichero, y
  // por eso ninguna capa se movia: JSX evalua sus hijos EN ORDEN y el <style> es el primero.
  // La forma de que no vuelva a pasar no es acordarse: es que el JSX de abajo NO PUEDA llamar a
  // nada que emita. Solo consume constantes ya construidas.
  const capaFondo = DIBUJO_FONDOS[direccion.fondo]({ kf, params: parFondo })
  const capaEstructura = DIBUJO_ESTRUCTURAS[direccion.estructura](
    { kf, puntos, conceptos: cs, params: parEstructura })
  const capaDecoradores = decoradores(kf, nDeco, retardos, rndDeco)
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

function render({ texto, conceptos, direccion }: PropsComposicion): React.ReactNode {
  const value = texto ?? ''
  const cs: Concepto[] = Array.isArray(conceptos) ? conceptos.slice(0, CUANTOS_CONCEPTOS).filter(Boolean) : []
  const clave = claveDe(value, cs, direccion)
  const visto = cache.get(clave)
  if (visto !== undefined) return visto
  const arbol = construir(value, cs, direccion)
  if (cache.size >= CACHE_MAX) {
    const primera = cache.keys().next().value
    if (primera !== undefined) cache.delete(primera)
  }
  cache.set(clave, arbol)
  return arbol
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
    const dir = direccionDesde(d.direccion, semillaDe(d.texto ?? ''))
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
