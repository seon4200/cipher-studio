// MAPA — la segunda composicion: un mapa conceptual que se construye, colapsa hacia el centro
// y se resuelve en un emoji grande.
//
// Portado de docs/motion/generador-clips.html. TODA la aritmetica —paletas, layouts, retardos,
// receta— vive ya en src/shared/mapa.ts y NO se reimplementa aqui. Este fichero solo hace tres
// cosas: muestrear funciones a @keyframes, montar el arbol de React, y emitir el <style>.
//
// ── LAS OCHO ADAPTACIONES RESPECTO A LA REFERENCIA ──────────────────────────────────────────
//
//  1. EMOJI, no iconos Solar. `fuente()` y el objeto ICONOS no se portan: DeepSeek no devuelve
//     nombres de icono, y pedirlos costaria un campo nuevo en `extra` — o sea, invalidar la
//     cache entera. Se pierde el trazo vectorial (stroke-dashoffset del icono final) porque un
//     glifo de color no tiene `stroke`. En su lugar el emoji entra con rebote y respira, y el
//     "duotone" pasa a ser una copia desenfocada detras (ver `.cm-brillo`).
//  2. `kf()` SIN ESTADO DE MODULO. La referencia lleva `let _k = 0, reglas = []` a nivel de
//     fichero: dos Visuales en la misma pagina se pisarian los nombres. Aqui el emisor se crea
//     POR RENDER y los nombres salen de la semilla de `value`, no de un contador.
//  3. El <style> va DENTRO del arbol de React. `pintar()` usa flushSync, asi que un
//     `document.head.appendChild` o un useEffect llegarian DESPUES del pintado y
//     `getAnimations()` no veria ninguna regla: el frame saldria congelado, en silencio.
//  4. CERO SEGUNDOS LITERALES — y por eso el pie tambien pasa por `kf`. La referencia lo anima
//     con `animation-duration:.55s; animation-delay:2.31s`. Traducirlo a
//     `calc(var(--ciclo)*0.1833)` quitaria el literal pero NO seria legal: `ajustar()` exige
//     que la duracion divida el ciclo un numero entero de veces, y 0.1833 lo divide 5.45. Cada
//     Visual escupiria un aviso CORREGIDO. Asi que el retardo y la duracion del pie viven
//     DENTRO de la funcion de muestreo, y la unica duracion que existe en todo el fichero es
//     `var(--ciclo)`. Una sola, y divide el ciclo una vez exacta.
//  5. SIN TOPES EN PX. El unico `clamp()` de la referencia es
//     `.etq{font:700 clamp(7px,2.9cqw,15px)}`, calibrado para la vista previa de 268 px. A
//     1080 px el tope de 15px dejaria la etiqueta en la mitad de su tamaño. Aqui es `2.9cqw`
//     pelado, y en todo el fichero no queda ni un `clamp`.
//     TAMPOCO queda ningun `px` EN EL CSS DE LA ESCENA, y hubo que quitar dos que se habian
//     colado al portar: `backdrop-filter:blur(2px)` —que a 268 px y a 1080 px son desenfoques
//     distintos, no el mismo dibujo a otra escala— y el `border-radius:99px` de la barra.
//     El unico `px` que queda esta DENTRO del `transform` del pulso, y ahi no es un pixel de
//     pantalla: es una unidad de usuario del viewBox 100x177.78, que escala con el marco. Se
//     deja porque `translate()` no admite unidades de usuario sin sufijo.
//  6. La caja de concepto se mide aparte (ver docs / informe del paso 3). El `dx < 33` de
//     `separados()` NO se toca en este paso.
//  7. `M` POR FASE, no global — ver `REJILLAS`.
//  8. NI `transition` NI requestAnimationFrame NI Math.random NI Date.now. Si algo no esta en
//     un @keyframes, para el exportador no existe.
//
// ── ESTA COMPOSICION IGNORA EL SISTEMA DE COLOR, Y CASI DEL TODO ─────────────────────────────
//
// Sus colores salen de sus CINCO PALETAS, sorteadas por `value` en `receta()`. NO salen de
// SISTEMA_VISUAL. Cambiar el sistema de 'voltaje' a otro no cambia ni un nodo, ni una arista,
// ni el fondo, ni el halo.
//
// La UNICA excepcion es `.cm-pal`, la palabra del pie, que usa `color:var(--texto)` — y esa
// variable SI la publica AnimatedGraphic desde el sistema. Asi que al cambiar de sistema la
// palabra cambia de color y el mapa entero no. Es incoherente y esta anotado a proposito: el
// dia que alguien toque SISTEMA_VISUAL y no vea cambiar nada, que sepa por que antes de
// ponerse a buscar el bug en la fontaneria.
//
// No se arregla en este paso. Arreglarlo es elegir entre dos cosas que no estan decididas: o
// las paletas se derivan del sistema —y se pierden las cinco, que son el motor de variedad— o
// la palabra deja de usar var(--texto) y coge el color de la paleta.
//
// ── LO QUE ESTE PASO **NO** ARREGLA (se ve, se dice, y se sigue) ─────────────────────────────
//
//  · `src/renderer/grafico.html` no carga ninguna fuente: Archivo y Anton NO existen en la
//    ventana de render y todo cae a la sans del sistema. Las pilas llevan respaldo por eso.

import React from 'react'
import { ajustar } from '../../../shared/ciclo'
import { generador, semillaDe } from '../../../shared/semilla'
import { CUANTOS_CONCEPTOS, type Concepto } from '../../../shared/conceptos'
import {
  SY, FOCO, T, cl, ent, receta, RETARDO_ANCLA, retardoArista,
  type Punto, type Receta
} from '../../../shared/mapa'
import type { Composicion, PropsComposicion } from './index'

const PI = Math.PI

/** La curva de la referencia: `easeInOutCubic`. No se importa porque no es del dominio del
 *  mapa —es una curva de animacion— y meterla en shared/mapa.ts seria ensuciarlo. */
const suave = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// ── LA UNICA DURACION ───────────────────────────────────────────────────────────────────────
//
// Una sola, y es el ciclo entero. Todo el movimiento vive en @keyframes gobernados por el mismo
// reloj: `animation: <nombre> var(--ciclo) linear infinite both`. Con `linear` y el muestreo
// hecho a mano, la curva REAL de cada elemento esta en los propios keyframes — que es lo que
// permite que `getAnimations().currentTime = t*1000` reproduzca el frame exacto.
const DIVISORES = [{ que: 'escena', n: 1 }] as const

function duracionesDe (ciclo: number) {
  const d: Record<string, number> = {}
  const avisos: string[] = []
  for (const x of DIVISORES) {
    const r = ajustar(ciclo, x.que, ciclo / x.n)
    d[x.que] = r.d
    if (r.aviso) avisos.push(r.aviso)
  }
  return { d, avisos }
}

// ── EL MUESTREADOR: M POR FASE (adaptacion 7) ───────────────────────────────────────────────
//
// El problema de la referencia: `kf(fn, 33)` reparte 33 muestras UNIFORMEMENTE por el ciclo.
// A 3 s y 30 fps eso es una muestra cada 2.8 frames. En la construccion —que dura el 40% del
// ciclo y es lenta— no se nota. En el COLAPSO, que dura el 18% y mueve cada nodo de su sitio al
// foco, se ve a saltos. Y en el DESTELLO, que es un pico de anchura 0.052 en u, la referencia
// mete 4 muestras con M=81: el flash sale escalonado.
//
// La solucion NO es subir M global —eso multiplica el <style> por tres para ganar precision
// donde no hace falta— sino muestrear DENSO donde el movimiento es rapido. Cada rejilla es una
// lista de tramos {hasta, paso} en fraccion de ciclo, y cada elemento usa la suya.
type Tramo = { hasta: number; paso: number }

/** Los `u` de una rejilla, de 0 a 1, ordenados y sin repetir. */
function rejilla (tramos: readonly Tramo[]): number[] {
  const out: number[] = [0]
  let u = 0
  for (const t of tramos) {
    while (u < t.hasta - 1e-9) {
      u = Math.min(t.hasta, u + t.paso)
      out.push(u)
    }
  }
  if (out[out.length - 1] < 1 - 1e-9) out.push(1)
  return out
}

// EL TECHO DE LA DENSIDAD, y de donde sale el numero.
//
// Muestrear mas fino que UN FRAME no se ve: el exportador solo lee en `t = f/30`, y entre dos
// stops la interpolacion es lineal. El ciclo mas largo medido en este repo es 3.82 s = 115
// frames, asi que un frame son 1/115 = 0.0087 en fraccion de ciclo. Ese es el paso mas fino que
// tiene sentido, y pasar de ahi solo engorda el <style>.
//
// Medido antes de fijarlo: con paso .005 en el colapso salian 2.22 muestras por frame y el
// <style> pesaba 67 KB de media. Es trabajo tirado.
const PASO_FRAME = 0.008

// Los cortes salen de T: conFin .400, traFin .583, flash .545, icoIni .560, icoFin .730,
// palabra .770. No hay ni un numero magico que no venga de ahi.
const REJILLAS = {
  // Fondo, malla y halo: cambian despacio y de forma monotona. Uniforme basta.
  lento: rejilla([{ hasta: 1, paso: 0.05 }]),
  // Nodos: entran despacio, COLAPSAN rapido. Denso en [conFin, icoIni+].
  nodo: rejilla([{ hasta: 0.40, paso: 0.025 }, { hasta: 0.62, paso: PASO_FRAME }, { hasta: 1, paso: 0.05 }]),
  // Aristas: se dibujan en 0.17 y se RETRAEN en 0.11. El retraimiento es lo caro.
  arista: rejilla([{ hasta: 0.40, paso: 0.030 }, { hasta: 0.58, paso: PASO_FRAME }, { hasta: 1, paso: 0.06 }]),
  // Pulsos: viajan solo mientras el mapa esta en pie; despues de conFin son opacity:0 plano.
  pulso: rejilla([{ hasta: 0.41, paso: 0.012 }, { hasta: 1, paso: 0.12 }]),
  // Destello: un pico de anchura 0.052 centrado en flash. Es lo UNICO que se muestrea por
  // debajo del frame, y con motivo: el pico entero dura 4.7 frames y su forma es una potencia
  // de 2.4, asi que con un stop por frame el flash sale escalonado. La referencia le daba 4
  // muestras (M=81 uniforme); aqui son 34, y fuera del pico la funcion vale cero plano.
  flash: rejilla([{ hasta: 0.50, paso: 0.06 }, { hasta: 0.60, paso: 0.003 }, { hasta: 1, paso: 0.06 }]),
  // Icono: nace en icoIni con rebote y respira a partir de icoFin.
  icono: rejilla([{ hasta: 0.55, paso: 0.06 }, { hasta: 0.77, paso: PASO_FRAME }, { hasta: 1, paso: 0.03 }]),
  // Pie: entra en palabra (.770) y la barra un poco despues.
  pie: rejilla([{ hasta: 0.75, paso: 0.06 }, { hasta: 0.93, paso: PASO_FRAME }, { hasta: 1, paso: 0.03 }])
} as const

/**
 * El emisor de keyframes. UNO POR RENDER (adaptacion 2).
 *
 * El nombre es `<prefijo>-<clave>` y el prefijo sale de la semilla de `value`: deterministas y
 * sin contador global. Dos Visuales distintos montados a la vez no pueden chocar, y el MISMO
 * Visual re-renderizado produce exactamente los mismos nombres — que es lo que hace que el
 * fichero cacheado y el recien pintado sean el mismo dibujo.
 */
function emisor (prefijo: string) {
  const reglas: string[] = []
  const kf = (clave: string, grid: readonly number[], fn: (u: number) => string): string => {
    const nom = prefijo + '-' + clave
    let c = ''
    for (const u of grid) c += (u * 100).toFixed(3) + '%{' + fn(u) + '}'
    reglas.push('@keyframes ' + nom + '{' + c + '}')
    return nom
  }
  return { kf, reglas }
}

/** La UNICA forma de usar una animacion aqui. `var(--ciclo)` lo publica AnimatedGraphic. */
const usa = (nom: string): React.CSSProperties => ({
  animation: `${nom} var(--ciclo) linear infinite both`
})

// ── EL CSS FIJO DE LA ESCENA ────────────────────────────────────────────────────────────────
//
// Prefijo `cm-` (composicion mapa) para no chocar con globals.css ni con extrusion.
//
// NI UN `px` NI UN `clamp`: cada medida es `cqw` o `%`, asi que el dibujo es EL MISMO a 268 px
// de vista previa y a 1080 px de export, solo que a otra escala (adaptacion 5).
//
// El blur del cristal era `2px` en la referencia y aqui son `.19cqw`, que a 1080 px dan 2.05 px
// —el mismo aspecto que tenia— pero a 268 px dan .51 px en vez de 2. Con el literal, la vista
// previa llevaba un desenfoque casi cuatro veces mas fuerte en proporcion: el laboratorio y el
// export no estaban enseñando lo mismo.
const CSS_FIJO = `
.cm-capa{position:absolute;inset:0}
.cm-nodo{position:absolute;display:flex;align-items:center;white-space:nowrap}
.cm-caja{display:flex;align-items:center;gap:1.3cqw;padding:1.5cqw 2.4cqw;border-radius:1.7cqw;
  background:rgba(9,12,24,.9);border:.3cqw solid;backdrop-filter:blur(.19cqw)}
.cm-mini{font-size:4.4cqw;line-height:1;flex:none}
.cm-etq{font:700 2.9cqw Archivo,system-ui,sans-serif;letter-spacing:.01em}
.cm-destello{position:absolute;left:50%;top:38%;width:86cqw;height:86cqw;border-radius:50%;
  pointer-events:none;z-index:8;mix-blend-mode:screen}
.cm-halo{position:absolute;left:50%;top:38%;width:64cqw;height:64cqw;border-radius:50%;z-index:5}
.cm-icono{position:absolute;left:50%;top:38%;width:40cqw;height:40cqw;z-index:6;
  display:flex;align-items:center;justify-content:center}
.cm-glifo{font-size:30cqw;line-height:1}
.cm-brillo{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:30cqw;line-height:1;filter:blur(2.4cqw)}
.cm-pie{position:absolute;left:8.33%;right:8.33%;bottom:11%;z-index:9;text-align:center}
.cm-pal{font:400 var(--cm-fs)/0.95 Anton,Archivo,system-ui,sans-serif;text-transform:uppercase;
  color:var(--texto);white-space:nowrap}
.cm-barra{height:.8cqw;width:15cqw;border-radius:99cqw;margin:2.6cqw auto 0}
`

// ── PIEZAS ──────────────────────────────────────────────────────────────────────────────────

type ArgsNodo = {
  x: number; y: number; etq: string; emoji: string; col: string
  ret: number; tra: Receta['transicion']; ancla: boolean
}

/**
 * Un nodo: entra con rebote, espera, y en la transicion converge AL FOCO.
 *
 * Converge al foco y no al ancla —lo dice la referencia y se porta tal cual—: si convergiera al
 * ancla, el colapso apuntaria a un sitio y el emoji apareceria en otro.
 */
function nodo (
  kf: ReturnType<typeof emisor>['kf'], clave: string, a: ArgsNodo
): React.ReactNode {
  // Desplazamiento hasta el foco, en cqw. La `y` va en % de ALTO y hay que pasarla a cqw: en un
  // marco 9:16 un 1% de alto son 16/9 cqw. Es lo que hace `SY`.
  const dx = FOCO.x - a.x
  const dy = (FOCO.y - a.y) * SY
  const nom = kf(clave, REJILLAS.nodo, u => {
    let s: number, o: number, tx = 0, ty = 0
    if (u < T.conFin) {
      const ph = cl((u - a.ret) / 0.13, 0, 1), e = suave(ph)
      const sob = ph < 1 ? Math.sin(ph * PI) * 0.10 : 0
      s = 0.35 + e * 0.65 + sob
      o = e
    } else {
      const ph = cl((u - T.conFin) / (T.traFin - T.conFin), 0, 1), e = suave(ph)
      s = 1 - e * 0.86
      o = 1 - cl((ph - 0.12) / 0.62, 0, 1)
      if (a.tra === 'implosion') { tx = dx * e; ty = dy * e }
      else if (a.tra === 'espiral') {
        const ang = e * PI * 0.85, ca = Math.cos(ang), sa = Math.sin(ang)
        const nx = -dx * ca + dy * sa, ny = -dx * sa - dy * ca
        tx = dx + nx * (1 - e)
        ty = dy + ny * (1 - e)
      } else { tx = dx * e * 0.55; ty = dy * e - 16 * e * e }   // barrido
    }
    return 'transform:translate(-50%,-50%) translate(' + tx.toFixed(2) + 'cqw,' + ty.toFixed(2) + 'cqw) '
      + 'scale(' + s.toFixed(3) + ');opacity:' + o.toFixed(3)
  })
  return (
    <div key={clave} className="cm-nodo"
      style={{ ...usa(nom), left: a.x.toFixed(2) + '%', top: a.y.toFixed(2) + '%' }}>
      <div className="cm-caja" style={{
        borderColor: a.col,
        boxShadow: `0 0 2.2cqw ${a.col}55, inset 0 0 1.6cqw ${a.col}22`
      }}>
        {a.emoji ? <span className="cm-mini">{a.emoji}</span> : null}
        <span className="cm-etq" style={{ color: a.ancla ? '#fff' : a.col }}>{a.etq}</span>
      </div>
    </div>
  )
}

type ArgsArista = { A: Punto; B: Punto; col: string; ret: number; curva: number }

/**
 * La curva del pulso, SIN recortar las puntas.
 *
 * Y no es la misma que la de la flecha, a proposito: la flecha recorta sus dos extremos para
 * que no queden tapados por las cajas, y el pulso NO —tiene que salir del centro de una caja y
 * entrar en el centro de la otra—. La referencia hace lo mismo y por eso las calcula por
 * separado; unificarlas dejaria el pulso arrancando en el aire.
 */
function geometria (a: ArgsArista) {
  const X1c = a.A.x, Y1c = a.A.y * SY, X2c = a.B.x, Y2c = a.B.y * SY
  const cx = (X1c + X2c) / 2 - (Y2c - Y1c) * a.curva
  const cy = (Y1c + Y2c) / 2 + (X2c - X1c) * a.curva
  return { X1c, Y1c, X2c, Y2c, cx, cy }
}

/** Una flecha: se dibuja hacia el destino y se retrae en la transicion. */
function flecha (
  kf: ReturnType<typeof emisor>['kf'], clave: string, a: ArgsArista
): React.ReactNode {
  let X1 = a.A.x, Y1 = a.A.y * SY, X2 = a.B.x, Y2 = a.B.y * SY
  // Recorta las puntas para que no queden tapadas por las cajas.
  const lg = Math.hypot(X2 - X1, Y2 - Y1) || 1
  const k1 = Math.min(10, lg * 0.26) / lg, k2 = Math.min(17, lg * 0.34) / lg
  const ux = X2 - X1, uy = Y2 - Y1
  X1 += ux * k1; Y1 += uy * k1; X2 -= ux * k2; Y2 -= uy * k2
  const cx = (X1 + X2) / 2 - (Y2 - Y1) * a.curva
  const cy = (Y1 + Y2) / 2 + (X2 - X1) * a.curva
  const d = `M ${X1.toFixed(1)},${Y1.toFixed(1)} Q ${cx.toFixed(1)},${cy.toFixed(1)} ${X2.toFixed(1)},${Y2.toFixed(1)}`

  const nomL = kf(clave + 'l', REJILLAS.arista, u => {
    const k = u < T.conFin
      ? suave(cl((u - a.ret) / 0.17, 0, 1))
      : 1 - suave(cl((u - T.conFin) / 0.11, 0, 1))
    return 'stroke-dashoffset:' + (1 - k).toFixed(4)
  })
  const ang = Math.atan2(Y2 - cy, X2 - cx) * 180 / PI
  const nomP = kf(clave + 'p', REJILLAS.arista, u => {
    const k = u < T.conFin
      ? cl((u - a.ret - 0.15) / 0.06, 0, 1)
      : 1 - cl((u - T.conFin) / 0.06, 0, 1)
    return 'opacity:' + k.toFixed(3) + ';transform:scale(' + (0.4 + k * 0.6).toFixed(2) + ')'
  })

  // LA PUNTA VA EN DOS GRUPOS, y no es un capricho: el de fuera coloca y rota con el ATRIBUTO
  // transform, el de dentro anima con CSS. Si se mezclan en el mismo elemento, el transform de
  // CSS pisa al atributo y la punta se va al origen del viewBox. Es el bug clasico de animar
  // SVG con CSS, y esta anotado como tal en la referencia.
  return (
    <React.Fragment key={clave}>
      <path style={usa(nomL)} d={d} fill="none" stroke={a.col} strokeWidth=".5"
        strokeLinecap="round" pathLength={1} strokeDasharray="1" opacity=".72" />
      <g transform={`translate(${X2.toFixed(1)},${Y2.toFixed(1)}) rotate(${ang.toFixed(1)})`}>
        <g style={usa(nomP)}>
          <path d="M -2.6,-1.7 L 0,0 L -2.6,1.7" fill="none" stroke={a.col} strokeWidth=".55"
            strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    </React.Fragment>
  )
}

/** Un pulso viajando por la arista — solo mientras el mapa esta en pie. */
function pulso (
  kf: ReturnType<typeof emisor>['kf'], clave: string, a: ArgsArista & { vel: number }
): React.ReactNode {
  const g = geometria(a)
  const nom = kf(clave, REJILLAS.pulso, u => {
    const desde = a.ret + 0.16
    if (u < desde || u > T.conFin) return 'opacity:0'
    const ph = ((u - desde) * a.vel) % 1, m = 1 - ph
    const px = m * m * g.X1c + 2 * m * ph * g.cx + ph * ph * g.X2c
    const py = m * m * g.Y1c + 2 * m * ph * g.cy + ph * ph * g.Y2c
    // Las unidades son las del viewBox (100 x 177.78), asi que `px` aqui NO es un pixel de
    // pantalla: es una unidad de usuario SVG, que escala con el marco. Por eso no rompe la
    // adaptacion 5.
    return 'transform:translate(' + px.toFixed(2) + 'px,' + py.toFixed(2) + 'px);'
      + 'opacity:' + (ph < 0.14 ? ph * 7 : cl((1 - ph) * 1.4, 0, 1)).toFixed(3)
  })
  return <circle key={clave} style={usa(nom)} r="1.1" fill={a.col} />
}

// ── EL RENDER ───────────────────────────────────────────────────────────────────────────────

/**
 * EL ARBOL ENTERO. Funcion PURA de (value, conceptos) — y de nada mas.
 *
 * NO recibe `ciclo`, y no es un olvido: todas las duraciones se escriben `var(--ciclo)`, que es
 * un NOMBRE y no un numero interpolado, asi que el arbol producido es identico para cualquier
 * ciclo. Tampoco recibe `t`: el instante lo fija `getAnimations().currentTime` desde fuera, no
 * el arbol. Es exactamente lo que permite cachearlo por `value` y conceptos.
 *
 * SI ALGUN DIA ESTA FUNCION NECESITA `ciclo` O `t`, hay que meterlos en la clave de la cache de
 * abajo. Sin eso la cache devolveria el arbol de otro ciclo y nadie se enteraria.
 *
 * El candado del ciclo NO se llama aqui: vive en `avisos()`, que AnimatedGraphic invoca una vez
 * por montaje. Llamarlo aqui seria ademas inutil, porque esta funcion no corre por frame.
 */
function construir (value: string, cs: Concepto[]): React.ReactNode {
  const R = receta(value, cs.length)
  const P = R.paleta
  const { ancla, pts, aristas, curva } = R.layout

  // El prefijo de los keyframes sale de la semilla de `value`. Deterministico y sin contador.
  const pref = 'cm' + (semillaDe(value) >>> 0).toString(36)
  const { kf, reglas } = emisor(pref)

  // LA DECORACION TIENE SU PROPIO GENERADOR, y a proposito.
  //
  // La referencia sortea las estrellas y los centros del degradado con el MISMO `rnd` que la
  // receta. Aqui la receta ya se cerro en shared/mapa.ts, asi que la decoracion necesita un
  // stream propio. Se siembra con `value + '#decorado'` en vez de con `value`: sembrar con lo
  // mismo daria los mismos sorteos que la receta ya consumio, y las estrellas caerian
  // correlacionadas con la disposicion. Sigue siendo deterministico y sigue saliendo SOLO de
  // `value`, que es lo unico que esta en la clave del hash.
  const rndDec = generador(semillaDe(value + '#decorado'))
  const gx1 = ent(rndDec, 35, 65), gy1 = ent(rndDec, 28, 46)
  const gx2 = ent(rndDec, 20, 80), gy2 = ent(rndDec, 60, 82)
  const estrellas: React.ReactNode[] = []
  for (let i = 0; i < R.estrellas; i++) {
    estrellas.push(<div key={i} style={{
      position: 'absolute',
      left: (rndDec() * 98).toFixed(1) + '%', top: (rndDec() * 70).toFixed(1) + '%',
      width: '.3cqw', height: '.3cqw', borderRadius: '50%', background: '#cfe8ff',
      opacity: +(0.15 + rndDec() * 0.45).toFixed(2)
    }} />)
  }

  const col = (i: number): string => [P.a, P.b, P.ac, P.a][i % 4]
  const pt = (i: number): Punto => (i < 0 ? ancla : pts[i])

  // La malla reacciona en el instante del colapso.
  const nomMalla = kf('ma', REJILLAS.lento, u => {
    const g = u < T.conFin ? 1 : 1 + suave(cl((u - T.conFin) / 0.18, 0, 1)) * 0.22
    const o = u < T.icoIni ? 0.5 : 0.5 - cl((u - T.icoIni) / 0.2, 0, 1) * 0.22
    return 'transform:scale(' + g.toFixed(3) + ');opacity:' + o.toFixed(3)
  })

  // Aristas y pulsos.
  const trazos: React.ReactNode[] = []
  aristas.forEach(([a, b], i) => {
    const args = { A: pt(a), B: pt(b), col: i % 2 ? P.b : P.a, ret: retardoArista(i), curva: curva * (i % 2 ? 1 : -1) }
    // La velocidad del pulso la sortea la referencia con `1.5+rnd()*0.9`. Aqui NO hay rnd
    // disponible sin gastar el stream de la decoracion (y gastarlo movería las estrellas), asi
    // que se deriva de la semilla y del indice: mismo efecto —velocidades distintas por
    // arista— y sigue siendo funcion pura de `value`.
    const vel = 1.5 + (((semillaDe(value) >>> (i % 8)) & 7) / 7) * 0.9
    trazos.push(flecha(kf, 'f' + i, args))
    trazos.push(pulso(kf, 'u' + i, { ...args, col: P.ac, vel }))
  })

  // EL ANCLA Y LOS CONCEPTOS.
  //
  // Se construyen AQUI y no dentro del JSX, y esta es la razon exacta: JSX evalua sus hijos EN
  // ORDEN, y el <style> es el primero. Con los `nodo(...)` escritos en linea dentro del return,
  // `reglas.join('\n')` se serializaba ANTES de que se emitieran sus cuatro @keyframes, y la
  // hoja salia sin ellos: los nodos se pintaban sin animacion, sin el translate(-50%,-50%) que
  // vive en el keyframe, descolocados y sin colapsar nunca.
  //
  // Lo cazo la medicion —16 reglas donde la aritmetica decia 20— y no lo habria cazado mirar el
  // codigo: el fallo esta en CUANDO se evalua, no en lo que dice.
  //
  // Regla general que deja: TODO lo que emita keyframes se ejecuta antes del `return`.
  const nodos: React.ReactNode[] = [
    nodo(kf, 'na', {
      x: ancla.x, y: ancla.y, etq: value, emoji: '', col: P.a,
      ret: RETARDO_ANCLA, tra: R.transicion, ancla: true
    }),
    ...cs.slice(0, R.n).map((c, i) => nodo(kf, 'n' + i, {
      x: pts[i].x, y: pts[i].y, etq: c.etiqueta, emoji: c.emoji, col: col(i),
      ret: R.retardos[i] ?? 0.09, tra: R.transicion, ancla: false
    }))
  ]

  // El destello que tapa el corte.
  const nomFlash = kf('fl', REJILLAS.flash, u => {
    const d = Math.abs(u - T.flash)
    const k = d < 0.026 ? Math.pow(1 - d / 0.026, 2.4) : 0
    return 'opacity:' + (k * 0.8).toFixed(3)
      + ';transform:translate(-50%,-50%) scale(' + (0.3 + k * 0.95).toFixed(3) + ')'
  })

  // El emoji final: nace en icoIni con rebote y respira a partir de icoFin.
  const nomIcono = kf('ic', REJILLAS.icono, u => {
    if (u < T.icoIni) return 'opacity:0;transform:translate(-50%,-50%) scale(.45)'
    const ph = cl((u - T.icoIni) / 0.095, 0, 1), e = suave(ph)
    const sob = ph < 1 ? Math.sin(ph * PI) * 0.13 : 0
    const resp = u > T.icoFin ? 1 + Math.sin((u - T.icoFin) * PI * 2 * 2.2) * 0.016 : 1
    return 'opacity:1;transform:translate(-50%,-50%) scale(' + ((0.45 + e * 0.55 + sob) * resp).toFixed(4) + ')'
  })
  // El sustituto del duotone: una copia desenfocada detras del glifo. El original era el relleno
  // solido del icono Solar al 24%, que un emoji de color no puede tener.
  const nomBrillo = kf('br', REJILLAS.icono, u => {
    const k = cl((u - T.icoIni - 0.05) / 0.15, 0, 1)
    const lat = u > T.icoFin ? 1 + Math.sin((u - T.icoFin) * PI * 2 * 2.2) * 0.18 : 1
    return 'opacity:' + (k * 0.55 * lat).toFixed(4)
  })
  const nomHalo = kf('ha', REJILLAS.lento, u => {
    const k = cl((u - T.icoIni) / 0.12, 0, 1)
    const lat = u > T.icoFin ? 1 + Math.sin((u - T.icoFin) * PI * 2 * 2.2) * 0.25 : 1
    return 'opacity:' + (k * 0.5 * lat).toFixed(4)
      + ';transform:translate(-50%,-50%) scale(' + (0.7 + k * 0.35).toFixed(3) + ')'
  })

  // EL PIE, dentro del motor de keyframes (adaptacion 4).
  //
  // La referencia usa `animation-name:pop; animation-duration:.55s; animation-delay:2.31s`.
  // Los dos numeros son fracciones del ciclo de 3 s del laboratorio —.55/3 = 0.1833 y
  // 2.31/3 = T.palabra— pero traducirlos a `calc(var(--ciclo)*0.1833)` NO valdria: `ajustar()`
  // exige que la duracion divida el ciclo un numero entero de veces, y 0.1833 lo divide 5.45.
  // Cada Visual escupiria un aviso CORREGIDO en el log. Asi que el retardo y la duracion viven
  // DENTRO de la funcion, la animacion dura el ciclo entero, y no hay aviso posible.
  const nomPal = kf('pa', REJILLAS.pie, u => {
    const ph = cl((u - T.palabra) / 0.1833, 0, 1)
    // El `pop` de la referencia: 0% scale .6 opacity 0 / 64% scale 1.04 / 100% scale 1.
    const s = ph < 0.64 ? 0.6 + (ph / 0.64) * 0.44 : 1.04 - ((ph - 0.64) / 0.36) * 0.04
    return 'opacity:' + cl(ph / 0.64, 0, 1).toFixed(3) + ';transform:scale(' + s.toFixed(4) + ')'
  })
  const nomBarra = kf('ba', REJILLAS.pie, u => {
    const ph = cl((u - 0.84) / 0.14, 0, 1), e = suave(ph)
    return 'opacity:' + e.toFixed(3) + ';transform:scaleX(' + (0.2 + e * 0.8).toFixed(4) + ')'
  })

  // El tamaño de la palabra se calcula por LONGITUD, no con un clamp: una palabra larga nunca
  // desborda y una corta no se queda pequeña. Es cqw puro, sin tope en px (adaptacion 5).
  const fs = Math.min(10.5, 130 / Math.max(1, value.length))

  const raiz: React.CSSProperties = { position: 'absolute', inset: 0, containerType: 'inline-size' }

  return (
    <div style={raiz}>
      <style dangerouslySetInnerHTML={{ __html: CSS_FIJO + reglas.join('\n') }} />

      {/* fondo */}
      <div className="cm-capa" style={{
        background:
          `radial-gradient(ellipse 74% 44% at ${gx1}% ${gy1}%, ${P.f1} 0%, transparent 62%),` +
          `radial-gradient(ellipse 60% 40% at ${gx2}% ${gy2}%, ${P.f2} 0%, transparent 58%),` +
          `linear-gradient(${R.angFondo}deg,#070818,#05060E)`
      }} />
      <div className="cm-capa">{estrellas}</div>

      {/* la malla */}
      <div className="cm-capa" style={{
        ...usa(nomMalla),
        backgroundImage:
          `linear-gradient(${P.a}12 1px,transparent 1px),` +
          `linear-gradient(90deg,${P.a}12 1px,transparent 1px)`,
        backgroundSize: `${R.escMalla.toFixed(2)}cqw ${R.escMalla.toFixed(2)}cqw`
      }} />

      {/* aristas y pulsos */}
      <svg className="cm-capa" viewBox="0 0 100 177.78">{trazos}</svg>

      {/* el ancla y los conceptos — construidos arriba, ver el comentario de `nodos` */}
      {nodos}

      {/* el destello que tapa el corte */}
      <div className="cm-destello" style={{
        ...usa(nomFlash),
        background: `radial-gradient(circle,#fff 0%,${P.a}dd 14%,${P.a}44 30%,transparent 52%)`
      }} />

      {/* el emoji final */}
      <div className="cm-halo" style={{
        ...usa(nomHalo),
        background: `radial-gradient(circle,${P.a}55,transparent 66%)`
      }} />
      <div className="cm-icono" style={usa(nomIcono)}>
        <div className="cm-brillo" style={usa(nomBrillo)}>{cs[0]?.emoji ?? ''}</div>
        <div className="cm-glifo">{cs[0]?.emoji ?? ''}</div>
      </div>

      {/* EL PIE. Ojo: AnimatedGraphic ya pinta su propio pie para cualquier composicion, asi
          que con visual_mapa activo se verian DOS palabras. Es del paso siguiente. */}
      <div className="cm-pie">
        <div className="cm-pal" style={{
          ...usa(nomPal),
          ['--cm-fs' as any]: fs.toFixed(2) + 'cqw',
          textShadow: `0 0 3cqw ${P.a}66, 0 .3cqw 2cqw rgba(0,0,0,.95)`
        }}>{value}</div>
        <div className="cm-barra" style={{
          ...usa(nomBarra),
          background: `linear-gradient(90deg,${P.a},${P.b})`,
          boxShadow: `0 0 1.8cqw ${P.a}bb`
        }} />
      </div>
    </div>
  )
}

// ── LA CACHE DE RENDER ──────────────────────────────────────────────────────────────────────
//
// MEDIDO, no supuesto: `__setT` llama a `pintar(t)`, y `pintar` hace
// `flushSync(raiz.render(...))`. Es UNA llamada a `render()` POR FRAME. Un clip de 3 s a 30 fps
// son 90 frames mas el `__setT(0)` que dispara `__montar` = 91 reconstrucciones de ~21 reglas
// @keyframes y ~48 KB de <style>, todas ellas identicas.
//
// Devolver EL MISMO objeto elemento entre frames no solo ahorra construirlo: con la misma
// referencia React SE SALTA la reconciliacion del subarbol entero. El nodo <style> no se toca,
// y esa es la parte que importa — si el string cambiara, aunque fuera en un decimal, React
// reemplazaria el nodo y el navegador re-parsearia 48 KB de CSS EN MITAD DE LA CAPTURA.
//
// Es estado de modulo, si, y en este mismo fichero hay dos parrafos explicando por que el
// `let _k = 0` de la referencia era un defecto. La diferencia es real y no es una excusa: aquel
// contador CAMBIABA el resultado —los nombres dependian del orden de las llamadas—, y esto es
// una cache pura de una funcion determinista, que solo puede evitar recalcular.
//
// CUATRO ENTRADAS. La ventana de graficos monta un Visual cada vez, asi que con una bastaria;
// cuatro cubren el dia que se monten varios sin que la cache se convierta en una fuga.
//
// ES FIFO, NO LRU: `cache.get` no reinserta la clave, asi que lo que se desaloja es lo que
// entro primero, se este usando o no. Con un Visual montado cada vez da exactamente igual —el
// que se sirve es el ultimo que entro—, pero que nadie lo tome por LRU: con cuatro Visuales
// vivos a la vez, el mas usado podria ser el primero en caer.
const CACHE_MAX = 4
const cache = new Map<string, React.ReactNode>()

/** La clave: lo UNICO de lo que depende el arbol. Los separadores son caracteres de control
 *  para que no puedan aparecer dentro de una etiqueta y colar dos claves distintas en una. */
function claveDe (value: string, cs: Concepto[]): string {
  return value + '\u0002' + cs.map(c => c.emoji + '\u0001' + c.etiqueta).join('\u0003')
}

function render ({ texto, conceptos }: PropsComposicion): React.ReactNode {
  const value = texto ?? ''
  const cs: Concepto[] = Array.isArray(conceptos) ? conceptos.filter(Boolean) : []
  const clave = claveDe(value, cs)
  const visto = cache.get(clave)
  if (visto !== undefined) return visto
  const arbol = construir(value, cs)
  cache.set(clave, arbol)
  // Map conserva el orden de insercion, asi que la primera clave es siempre la mas vieja.
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string)
  return arbol
}

export const mapa: Composicion = {
  nombre: 'mapa',
  duraciones: (ciclo) => DIVISORES.map(x => ({ que: x.que, d: ciclo / x.n })),
  avisos: (ciclo) => duracionesDe(ciclo).avisos,
  /**
   * EXIGE LOS TRES CONCEPTOS. Tres o ninguno, la misma regla que `sanearConceptos`: aqui no se
   * rellena lo que falte.
   *
   * Sin ellos el mapa no es "mas pobre", es OTRA COSA: fondo, estrellas, malla y el ancla sola,
   * sin aristas, sin conceptos y sin emoji final. Parece intencionado y no lo es. Devolviendo
   * false, AnimatedGraphic cae al Visual de texto de siempre.
   *
   * `CUANTOS_CONCEPTOS` y no un 3: el numero lo decide `sanearConceptos`, y si algun dia cambia
   * alli tiene que cambiar aqui a la vez. Un literal se quedaria desincronizado en silencio.
   * (Y si cambia: SUBE VERSION_PLANTILLAS. Ver el comentario de `puedeDibujar` en ./index.)
   *
   * Se comprueban tambien emoji y etiqueta porque la lista puede llegar de un `extra` de una
   * generacion anterior, cuando el saneado no era el de hoy: un {emoji:'', etiqueta:''} pinta
   * una caja vacia, que es peor que caer a texto.
   */
  puedeDibujar: (d) => {
    const cs = d.conceptos
    if (!Array.isArray(cs) || cs.length !== CUANTOS_CONCEPTOS) return false
    return cs.every(c => !!c && !!c.emoji && !!c.etiqueta)
  },
  // SI pinta pie, y gana el suyo: conoce la paleta —la barra es un degradado de P.a a P.b— y
  // entra en su sitio del reparto de fases, en T.palabra. El de AnimatedGraphic es estatico y
  // no sabe nada de ninguna de las dos cosas.
  pintaPie: true,
  render
}
