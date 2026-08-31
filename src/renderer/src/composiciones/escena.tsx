// ESCENA — la composicion GENERICA. FASE 1: el esqueleto, una pieza por eje.
//
// A diferencia de `mapa`, que es una escena escrita a mano, esta composicion COMBINA piezas de
// vocabularios cerrados (shared/escena.ts). El objetivo de este paso no es que se vea
// espectacular: es que el mecanismo -- direccionDe, las cuatro capas con su camara, la cache de
// arbol -- funcione con datos reales antes de que la Fase 7 multiplique cada vocabulario.
//
// mapa.tsx NO SE TOCA. Prefijo de clases `es-` (no `cm-`, no `cx-`) para no chocar con ninguna.
//
// ── LAS DOS REGLAS QUE ESTE FICHERO NO PUEDE ROMPER ─────────────────────────────────────────
//
//  1. TODO LO QUE EMITA @keyframes SE EJECUTA ANTES DEL `return`, y la hoja se serializa la
//     ULTIMA. Ver el bloque de `construir()`: no es una recomendacion, es la unica razon por la
//     que las camaras se mueven. Es la regla que documenta composiciones/index.ts:15-29, y este
//     fichero ya la incumplio una vez -- las cuatro capas salian QUIETAS y no fallaba nada.
//  2. NI UN NUMERO DE SEGUNDOS en el <style>. Toda duracion es `calc(var(--ciclo) / n)`. Si el
//     arbol llevara segundos calculados en JS, pasaria a depender de `ciclo` -- y `claveDe`, mas
//     abajo, no lo sabe: dos clips con la misma palabra y distinta duracion compartirian arbol.
//     Y con DIVISION y no multiplicacion: `/ n` no puede expresar una duracion ilegal, `* 0.333`
//     si.
//
// ESTA COMPOSICION SI LEE `sistema`, a diferencia de mapa -- que lo ignora casi del todo, deuda
// ya anotada en docs/deuda-graficos.md. Aqui el color sale de `var(--acento)` etc, que
// AnimatedGraphic YA publica sobre un ancestro: la composicion no necesita saber que sistema
// esta activo, y el arbol cacheado sigue siendo el mismo para cualquiera de los cuatro.

import React from 'react'
import { ajustar, type DuracionUsada } from '../../../shared/ciclo'
import { generador, semillaDe } from '../../../shared/semilla'
import { CUANTOS_CONCEPTOS, type Concepto } from '../../../shared/conceptos'
import {
  direccionDe, PROFUNDIDAD, camaraDeriva, constelacionDe, retardosDecoradores,
  posicionDecorador, DENSIDAD_A_N, ANILLOS_FONDO, faseAnillo, cabeEnElPie, cabeLaEtiqueta,
  type Direccion, type PuntoEscena
} from '../../../shared/escena'
import type { Composicion, PropsComposicion } from './index'

const TAU = 6.283185307

// ── LA UNICA DURACION ───────────────────────────────────────────────────────────────────────
//
// Un solo divisor, igual que mapa.tsx: todo el movimiento vive en @keyframes por-porcentaje, y
// la FORMA de la curva -- no una duracion mas corta -- es lo que separa "entra y se queda" de
// "se repite". Si un futuro decorador necesita su propio ciclo mas rapido, ESE es el momento de
// anadir un segundo divisor, con `ajustar()` protegiendolo igual que a este.
const DIVISORES = [{ que: 'escena', n: 1 }] as const

/**
 * LAS DURACIONES Y SUS AVISOS, DE UNA SOLA LLAMADA A `ajustar()`.
 *
 * No son dos caminos paralelos: `duraciones` devuelve el valor YA CORREGIDO y `avisos` devuelve
 * lo que hubo que corregir para llegar a el, y los dos salen de este mismo bucle. Calcular
 * `ciclo / n` por un lado y `ajustar()` por otro deja que las dos verdades se separen -- el
 * candado avisaria de una correccion que `duraciones` no refleja, y quien leyera `duraciones`
 * creeria una duracion que no es la que se usa.
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
//
// Mismo patron que mapa.tsx: sin estado de modulo, prefijo desde la semilla, deterministico.
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

// LA UNICA FORMA DE USAR UNA ANIMACION AQUI, y en propiedades LARGAS y no en el atajo
// `animation:`. El atajo obliga a interpolar la duracion dentro de una cadena, que es
// exactamente el sitio donde se cuela un `${d}s` sin que nadie lo vea. Con las largas, la
// duracion tiene su propia propiedad y `animationDuration` no puede ser otra cosa que este
// calc(). Cero segundos literales, por construccion y no por disciplina.
const usa = (nom: string, n = 1): React.CSSProperties => ({
  animationName: nom,
  animationDuration: `calc(var(--ciclo) / ${Math.max(1, Math.round(n))})`,
  animationTimingFunction: 'linear',
  animationIterationCount: 'infinite',
  animationFillMode: 'both'
})

// ── EL CSS FIJO ─────────────────────────────────────────────────────────────────────────────
//
// Prefijo `es-`. TODO en cqmin, y NI UN `px`: en vertical (9:16) cqmin === cqw -- el ancho ya es
// el menor -- pero en 16:9 cqmin escala con el ALTO, que es la dimension que manda. Usar cqw
// aqui haria que una escena vista en horizontal escalara con el eje que sobra.
//
// El `border-radius` de la barra va en cqmin y no en el `99px` del laboratorio. Hoy los dos
// producen la misma pastilla -- el navegador acota el radio a la mitad del lado menor -- asi que
// el cambio no mueve un pixel; se hace porque es la misma regla que mapa.tsx ya aplico al
// portar, y un `px` suelto es el que sobrevive al siguiente copiar y pegar.
//
// EL PIE PRESUPUESTA DOS LINEAS SIEMPRE (`min-height`), no cuando hacen falta. Si el alto
// dependiera de si la palabra parte o no, el pie subiria y bajaria de un Visual a otro y la
// escena se recolocaria sola. `overflow-wrap:anywhere` es lo que permite partir una palabra sin
// espacios -- sin el, una palabra larga no puede envolverse y SE SALE por los lados.
const CSS_FIJO = `
.es-capa{position:absolute;inset:0}
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

// ── PIEZAS ──────────────────────────────────────────────────────────────────────────────────

/**
 * FONDO — 'ondas': un fondo neutro de baja energia. Gradiente base + tres anillos.
 *
 * UN KEYFRAME POR ANILLO, con su fase propia (`faseAnillo`). Compartir uno solo los hace
 * respirar EN FASE, y tres circulos concentricos que laten a la vez se leen como un unico
 * objeto: se pierde toda la profundidad y no falla nada, que es el peor tipo de fallo.
 */
function fondoOndas(kf: ReturnType<typeof emisor>['kf']): React.ReactNode {
  const anillos: React.ReactNode[] = []
  for (let i = 0; i < ANILLOS_FONDO; i++) {
    const fase = faseAnillo(i)
    const nom = kf('ondas' + i, 33, u => {
      const p = (u + fase) % 1
      const s = 1 + 0.05 * Math.sin(p * TAU)
      const o = 0.20 + 0.10 * Math.sin(p * TAU)
      return `transform:translate(-50%,-50%) scale(${s.toFixed(4)});opacity:${o.toFixed(3)}`
    })
    anillos.push(
      <div key={i} className="es-anillo" style={{
        ...usa(nom),
        width: `${50 + i * 18}cqmin`,
        height: `${50 + i * 18}cqmin`
      }} />
    )
  }
  return (
    <>
      <div className="es-capa" style={{
        background: 'radial-gradient(ellipse 70% 50% at 50% 42%, var(--sup) 0%, transparent 62%),' +
          'linear-gradient(170deg, var(--fondo), var(--fondo))'
      }} />
      {anillos}
    </>
  )
}

/** ESTRUCTURA — 'constelacion': tres nodos de concepto unidos al ancla, y en el ancla la
 *  RANURA DEL HEROE. Hoy un emoji (el del primer concepto); mañana un `<img>` recortado en el
 *  MISMO sitio, con el MISMO factor de camara -- este bloque es exactamente lo que cambia. */
function estructuraConstelacion(
  kf: ReturnType<typeof emisor>['kf'], pts: PuntoEscena[], cs: Concepto[]
): React.ReactNode {
  const nomEntrada = pts.map((_, i) => kf('nodo' + i, 33, u => {
    const a = 0.06 + (i / pts.length) * 0.30
    const p = Math.min(1, Math.max(0, (u - a) / 0.26))
    const e = 1 - Math.pow(1 - p, 3)
    return `opacity:${e.toFixed(3)};transform:translate(-50%,-50%) scale(${(0.7 + 0.3 * e).toFixed(3)})`
  }))
  const nodos = pts.map((p, i) => (
    <div key={i} className="es-nodo" style={{ ...usa(nomEntrada[i]), left: p.x + '%', top: p.y + '%' }}>
      <div className="es-caja">
        <span className="es-mini">{cs[i].emoji}</span>
        <span className="es-etq">{cs[i].etiqueta}</span>
      </div>
    </div>
  ))

  // Las aristas: viewBox 0..100 en X, 0..100 en Y -- SIN la correccion SY de mapa.ts (16/9).
  // Simplificacion deliberada: con jitter pequeno sobre tres posiciones fijas, las lineas salen
  // legibles aunque no geometricamente perfectas. Ver el comentario en shared/escena.ts.
  const nomArista = pts.map((_, i) => kf('arista' + i, 33, u => {
    const a = 0.10 + (i / pts.length) * 0.24
    const p = Math.min(1, Math.max(0, (u - a) / 0.30))
    return `stroke-dashoffset:${((1 - p) * 90).toFixed(2)};opacity:${(p * 0.8).toFixed(3)}`
  }))
  const aristas = (
    <svg className="es-capa" viewBox="0 0 100 100" preserveAspectRatio="none">
      {pts.map((p, i) => (
        <path key={i} d={`M50,45 Q${((50 + p.x) / 2).toFixed(2)},${((45 + p.y) / 2 - 4).toFixed(2)} ${p.x.toFixed(2)},${p.y.toFixed(2)}`}
          fill="none" stroke="var(--acento)" strokeWidth=".5"
          strokeDasharray="90" style={usa(nomArista[i])} />
      ))}
    </svg>
  )

  const nomHero = kf('hero', 41, u => {
    const y = Math.sin(u * TAU) * 1.3
    return `transform:translate(-50%,-50%) translateY(${y.toFixed(3)}cqmin)`
  })
  const hero = <div className="es-hero" style={usa(nomHero)}>{cs[0].emoji}</div>

  return <>{aristas}{nodos}{hero}</>
}

/** DECORADORES — particulas neutras, sin vocabulario propio de forma este paso. `densidad`
 *  decide cuantas; `ritmo` decide cuando entra cada una. */
function decoradores(
  kf: ReturnType<typeof emisor>['kf'], n: number, retardos: number[], rndPos: () => number
): React.ReactNode {
  const salida: React.ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const p = posicionDecorador(rndPos)
    const ret = retardos[i] ?? 0
    const nom = kf('deco' + i, 25, u => {
      const e = Math.min(1, Math.max(0, (u - ret) / 0.20))
      return `opacity:${(e * 0.7).toFixed(3)};transform:translate(-50%,-50%) scale(${(0.5 + 0.5 * e).toFixed(3)})`
    })
    salida.push(
      <div key={i} className="es-deco" style={{ ...usa(nom), left: p.x + '%', top: p.y + '%' }} />
    )
  }
  return salida
}

/** TEXTO — la palabra, con su barra de acento. Vive DENTRO del arbol de la composicion (no en
 *  AnimatedGraphic, como el pie de siempre) porque solo asi recibe el factor de camara 0.20:
 *  el pie de AnimatedGraphic es HERMANO del arbol de render(), no esta dentro. */
function textoPie(kf: ReturnType<typeof emisor>['kf'], palabra: string): React.ReactNode {
  const nom = kf('pie', 25, u => {
    const p = Math.min(1, u / 0.22)
    const e = 1 - Math.pow(1 - p, 3)
    return `opacity:${e.toFixed(3)};transform:translateY(${((1 - e) * 3).toFixed(2)}cqmin)`
  })
  return (
    <div className="es-pie" style={usa(nom)}>
      <p className="es-pie-tit">{palabra}</p>
      <div className="es-pie-barra" />
    </div>
  )
}

/** Envuelve una capa con la camara al factor de profundidad `f`. Portado de
 *  docs/motion/lab-camara.html (`conCamara`). En Fase 1 `direccion.camara` es siempre
 *  'deriva'; el switch queda listo para cuando deje de serlo.
 *
 *  EMITE UN @keyframes, asi que TIENE que llamarse antes del return. Ver `construir()`. */
function conCamara(
  kf: ReturnType<typeof emisor>['kf'], contenido: React.ReactNode, f: number, z: number,
  camara: Direccion['camara']
): React.ReactNode {
  const fn = (u: number): string => {
    switch (camara) {
      case 'deriva':
      default:
        return camaraDeriva(u, f)
    }
  }
  const nom = kf('cam' + z, 41, fn)
  return (
    <div key={z} className="es-capa" style={{ ...usa(nom), zIndex: z, willChange: 'transform' }}>
      {contenido}
    </div>
  )
}

// ── LA CACHE DE ARBOL ───────────────────────────────────────────────────────────────────────
//
// Mismo mecanismo que mapa.tsx: FIFO, CACHE_MAX=4, la clave es SOLO lo que el arbol necesita.
//
// `direccionDe` depende UNICAMENTE de `semilla`, que sale de `semillaDe(texto)` -- `texto` ya
// esta en `value`, que YA es la clave del hash del fichero. Y el arbol nunca hornea `ciclo` ni
// `sistema`: usa `var(--ciclo)` y `var(--acento)` simbolicos, resueltos por CSS fuera de este
// componente. Asi que `claveDe` no necesita nada mas que `value` y `conceptos` -- exactamente
// lo mismo que usa mapa.tsx, y por la misma razon.
const CACHE_MAX = 4
const cache = new Map<string, React.ReactNode>()

/** La clave: lo UNICO de lo que depende el arbol. Los separadores son caracteres de control
 *  para que no puedan aparecer dentro de una etiqueta y colar dos claves distintas en una.
 *  Se escriben con SECUENCIA DE ESCAPE y nunca literales -- igual que mapa.tsx: un caracter de
 *  control literal es invisible en el fuente, y el dia que un editor o un copiar-y-pegar se lo
 *  coma, "ab"+"c" y "a"+"bc" pasarian a dar la MISMA clave sin que nada lo dijera. */
function claveDe(value: string, cs: Concepto[]): string {
  return value + '\u0002' + cs.map(c => c.emoji + '\u0001' + c.etiqueta).join('\u0003')
}

function construir(value: string, cs: Concepto[]): React.ReactNode {
  const semilla = semillaDe(value)
  const direccion = direccionDe(semilla)

  // Tres streams de aleatoriedad INDEPENDIENTES, mismo patron que mapa.tsx con su
  // `generador(semillaDe(value + '#decorado'))`. Si no se separan, anadir una pieza a
  // FONDOS/CAMARAS mas adelante desplazaria TAMBIEN el jitter de los puntos y las posiciones
  // de los decoradores para semillas que ya tenian un dibujo asignado -- un efecto colateral
  // que nadie estaria buscando ahi.
  const rndPts = generador(semillaDe(value + '#pts'))
  const rndDeco = generador(semillaDe(value + '#deco'))

  const pref = 'es' + (semilla >>> 0).toString(36)
  const { kf, reglas } = emisor(pref)

  // Las etiquetas viajan a la geometria porque el acotado depende del ANCHO de cada caja,
  // y el ancho depende de su etiqueta. Sin ellas solo se puede acotar el centro, que es
  // exactamente lo que no bastaba.
  const constelacion = constelacionDe(rndPts, cs.map(c => c.etiqueta))
  const nDeco = DENSIDAD_A_N[direccion.densidad]
  const retardos = retardosDecoradores(nDeco, direccion.ritmo)

  // ═══ TODO LO QUE EMITE @keyframes, ANTES DEL RETURN. LAS CAMARAS TAMBIEN. ═══════════════
  //
  // Las cuatro `conCamara` estaban DENTRO del return en la primera version de este fichero, y
  // por eso ninguna capa se movia. JSX evalua sus hijos EN ORDEN y el <style> es el primero:
  // cuando `reglas.join` corria, los cuatro @keyframes de camara todavia no existian. Contado:
  // la hoja llevaba 16 reglas donde la aritmetica decia 20, y no habia ni un error.
  //
  // La forma de que no vuelva a pasar no es acordarse: es que el JSX de abajo NO PUEDA llamar a
  // nada que emita. Solo consume constantes ya construidas.
  const capaFondo = fondoOndas(kf)
  const capaEstructura = estructuraConstelacion(kf, constelacion.pts, cs)
  const capaDecoradores = decoradores(kf, nDeco, retardos, rndDeco)
  const capaTexto = textoPie(kf, value)

  const capas: React.ReactNode[] = [
    conCamara(kf, capaFondo, PROFUNDIDAD.fondo, 1, direccion.camara),
    conCamara(kf, capaEstructura, PROFUNDIDAD.estructura, 2, direccion.camara),
    conCamara(kf, capaDecoradores, PROFUNDIDAD.decoradores, 3, direccion.camara),
    conCamara(kf, capaTexto, PROFUNDIDAD.texto, 4, direccion.camara)
  ]

  // LA HOJA SE SERIALIZA AQUI, LA ULTIMA. Nada por debajo de esta linea puede emitir.
  const hoja = CSS_FIJO + reglas.join('\n')

  // `container-type: size` Y NO `inline-size`.
  //
  // Todas las medidas de esta composicion son `cqmin`, que es el MENOR de las dos dimensiones
  // del contenedor -- o sea que necesita las DOS. Con `inline-size` solo el eje en linea es
  // consultable, `cqmin` no resuelve contra este contenedor y cae a su valor de reserva: la
  // escena sale "casi bien", a una escala que no es la suya, y no falla nada.
  //
  // mapa.tsx usa `inline-size` y esta CORRECTO: sus medidas son `cqw`, que solo necesita el
  // ancho. La unidad decide el container-type, no al reves.
  //
  // `size` implica `contain: size`, o sea que el tamaño no puede salir del contenido. Aqui sale
  // del `inset: 0` sobre el marco, asi que la condicion se cumple por construccion.
  const raiz: React.CSSProperties = { position: 'absolute', inset: 0, containerType: 'size' }

  return (
    <div style={raiz}>
      <style dangerouslySetInnerHTML={{ __html: hoja }} />
      {capas}
    </div>
  )
}

function render({ texto, conceptos }: PropsComposicion): React.ReactNode {
  const value = texto ?? ''
  const cs: Concepto[] = Array.isArray(conceptos) ? conceptos.slice(0, CUANTOS_CONCEPTOS).filter(Boolean) : []
  const clave = claveDe(value, cs)
  const visto = cache.get(clave)
  if (visto !== undefined) return visto
  const arbol = construir(value, cs)
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
   * DOS CONDICIONES, y las dos caen al respaldo que ya existe en vez de pintar algo peor.
   *
   * 1. AL MENOS TRES CONCEPTOS -- 'minimo 3', no 'exactamente 3' como mapa. Hoy da lo mismo en
   *    la practica porque `sanearConceptos` devuelve exactamente 3 o null, pero el `>=` no le
   *    cierra la puerta a una estructura futura que acepte mas.
   *
   * 2. QUE CADA ETIQUETA QUEPA EN LA ZONA aunque haya que centrarla. Por debajo del tope la
   *    caja se acota por su BORDE en `constelacionDe` y cabe siempre; por encima no hay
   *    posicion que la salve, asi que no se pinta a medias: se cae al respaldo.
   *
   * 3. QUE LA PALABRA QUEPA EN EL PIE, en las DOS lineas presupuestadas. No se encoge la letra
   *    -- un Visual con letra pequeña deja de ser un Visual -- y no se trunca -- truncar inventa
   *    una palabra que nadie dijo. Lo que no cabe cae al Visual de texto, que es el patron del
   *    proyecto. El tope sale de `MAX_CARACTERES_PIE`, que se DERIVA del ancho util, del tamaño
   *    de la fuente y del numero de lineas: si cambia el tamaño del pie, el tope cambia solo.
   *
   * ═══ SI CAMBIAS CUALQUIERA DE LAS DOS, SUBE VERSION_PLANTILLAS EN main/index.ts ═══
   * La condicion NO esta en la clave del hash: el `type` sigue diciendo `visual_escena` tanto
   * si se dibuja la escena como si cae a texto. Relajarla o endurecerla haria que LA MISMA
   * CLAVE diera pixeles distintos. Es el mismo aviso que lleva `mapa`.
   */
  puedeDibujar: (d) => {
    const cs = d.conceptos
    if (!Array.isArray(cs) || cs.length < CUANTOS_CONCEPTOS) return false
    if (!cs.slice(0, CUANTOS_CONCEPTOS).every(c => !!c && !!c.emoji && !!c.etiqueta)) return false
    if (!cs.slice(0, CUANTOS_CONCEPTOS).every(c => cabeLaEtiqueta(c.etiqueta))) return false
    return cabeEnElPie(d.texto)
  },
  // TRUE: la composicion pinta su propio texto (capaTexto, con factor de camara 0.20). El pie
  // de AnimatedGraphic es HERMANO del arbol de render(), no hijo -- si se dejara en false, la
  // palabra de AnimatedGraphic aparecería SIN camara, y ademas dos veces.
  pintaPie: true,
  render
}
