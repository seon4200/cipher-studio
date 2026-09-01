// Punto de entrada AISLADO para renderizar un grafico fuera de la app.
// Lo carga una ventana offscreen del proceso principal, que llama a __montar y __setT.
// No monta nada al cargar: la ventana se reutiliza para todos los graficos, que es lo
// que hace que su arranque (~150 ms medidos) se amortice entre todos.
import React from 'react'
import { createRoot, Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { AnimatedGraphic } from './AnimatedGraphic'
import { NombreSistema } from './sistemas'
import { FUENTES_RENDER, MUESTRA_FUENTES, faltaLaFuentePorAncho } from './fuentes-render'
import './styles/globals.css'

// Franja de la SONDA, encima del lienzo. El proceso principal codifica ahi el indice de
// frame y solo acepta el bitmap cuyo indice coincide con el que acaba de fijar: sin ese
// lazo cerrado, 'paint' entrega un frame ~4 atrasado (medido, 0 de 90 exactos).
// La franja NO viaja a ffmpeg: se recorta del buffer con un subarray, coste cero.
const SONDA_ALTO = 8

// ── LOS DOS NUMEROS DEL ENCUADRE ─────────────────────────────────────────────────────
// Juntos y arriba para poder iterar sin buscarlos por el fichero.
//
// FACTOR_ESCALA se aplica con transform sobre la tarjeta, no reescribiendo los templates:
// conserva la proporcion interna EXACTA —emoji grande, texto acompañando— y no toca ninguno
// de los 88 sitios con tamaños fijos repartidos por los 17 tipos, 53 de ellos concentrados en
// cuatro tipos que casi no aparecen. Escala tambien el blur, el borde y la sombra, que es lo
// correcto: una tarjeta del doble de grande con la sombra del tamaño original se veria mal.
//
// MARGEN_INFERIOR_PCT es porcentaje del ALTO del lienzo y se convierte a px aqui. NO se usa un
// padding en % de CSS porque el porcentaje se resuelve contra el ANCHO del contenedor, no
// contra el alto: el `pb-[20%]` anterior no eran 384px sobre 1920 sino 216px sobre 1080, y
// cualquiera que lea "20%" entiende otra cosa.
//
// SI CAMBIAS CUALQUIERA DE LOS DOS, SUBE VERSION_PLANTILLAS EN main/index.ts. Sin eso el hash
// del MOV es identico, la cache devuelve el viejo y el export dice ACIERTO con el diseño
// antiguo — verde y equivocado.
// 1.6, elegido con las medidas delante y no a ojo. Sin escalar, decorativo_emoji —el 76-94%
// de lo que genera el modelo— ocupa el 31.9% del ancho y pasos_proceso el 51.9%, que es el
// mas ancho de los 17 tipos. Sobre lienzo de 1080x1920, caja envolvente del canal alfa:
//
//   factor   decorativo_emoji   pasos_proceso   margen lateral de pasos_proceso
//    1.5          516 px            838 px            121 px    <- medido
//    1.6          552 px            892 px             94 px    <- medido, EL QUE SE USA
//    1.75        ~602 px           ~978 px            ~51 px    <- extrapolado
//    1.9         ~654 px          ~1064 px             ~8 px    <- extrapolado, rozaria
//
// 1.75 daria los ~600 px que se buscaban para el tipo dominante, pero deja pasos_proceso con
// ~51 px por lado. Se prefiere 1.6 y subirlo mas adelante con datos antes que descubrir un
// recorte en un video ya publicado: el recorte seria SILENCIOSO, como el de la ventana a 1032.
//
// ranking_top3 mide lo MISMO que decorativo_emoji (552 px) y no es un error de medida: su
// podio son tres cajas de ancho fijo con truncate, ~216 px en total, asi que quien manda en su
// ancho es el min-w-[320px] del contenedor. Su texto no lo ensancha; se recorta.
const FACTOR_ESCALA = 1.6
const MARGEN_INFERIOR_PCT = 14

type Opciones = {
  ancho: number; alto: number
  modo: 'overlay' | 'pantalla'
  sistema: NombreSistema
  // EL CICLO. Es la duracion del Visual, y de el salen TODAS las duraciones de animacion de una
  // composicion. Sin esto la pagina no lo sabia: renderGraphicClip conoce `duracion` —la usa
  // para totalFrames y para el hash— pero no se la decia a nadie aqui dentro.
  duracion: number
}
let opciones: Opciones = { ancho: 1080, alto: 1920, modo: 'overlay', sistema: 'voltaje', duracion: 2 }

// Los avisos del candado del ciclo, para que se los lleve el proceso principal.
//
// NO se usa console.warn: esta ventana es OFFSCREEN y su consola no la abre nadie. Ya paso —un
// console.log puesto aqui para diagnosticar la colocacion de las tarjetas nunca aparecio en
// generation-debug.log y hubo que deducir el dato de otra parte. Un aviso que nadie puede leer
// no es un aviso.
;(window as any).__avisosCiclo = [] as string[]

const sonda = document.getElementById('sonda') as HTMLDivElement
const lienzo = document.getElementById('lienzo') as HTMLDivElement
let raiz: Root | null = null
let datos: any = null

// La escala va en un ENVOLTORIO propio, no sobre la tarjeta.
//
// Se intento primero con una regla CSS sobre `#lienzo > *` y NO funcionaba: los 17 tipos
// llevan animate-pop o animate-slide-up, que animan `transform` con animation-fill-mode:
// forwards, y una animacion retenida PISA cualquier declaracion normal de la cascada. El
// transform computado salia matrix(1,0,0,1,0,0) —identidad— con la regla presente en la hoja
// de estilos. Medido, no deducido.
//
// Con un envoltorio no compiten: la animacion sigue mandando en el transform de la TARJETA y
// la escala manda en el del PADRE, que son dos elementos distintos.
//
// origin center bottom: el borde inferior queda fijo, asi que la tarjeta crece hacia arriba y
// quien manda en el margen sigue siendo MARGEN_INFERIOR_PCT. Los dos numeros no se estorban.
const ESTILO_ENVOLTORIO: React.CSSProperties = {
  transform: `scale(${FACTOR_ESCALA})`,
  transformOrigin: 'center bottom'
}

function pintar(t?: number) {
  if (!raiz || !datos) return
  // flushSync: sin esto React renderiza de forma diferida y el frame capturado podria
  // llevar el estado anterior aunque el lazo cerrado diga que el indice es correcto.
  // El envoltorio solo lleva la escala. AnimatedGraphic sigue siendo su hijo directo, asi que
  // el getAnimations({subtree:true}) que usa desde su propia raiz para posicionar el reloj
  // alcanza lo mismo que antes: el envoltorio esta POR ENCIMA de esa raiz, no en medio.
  const hijo = React.createElement(AnimatedGraphic,
    { graphic: datos, t, modo: opciones.modo, sistema: opciones.sistema,
      ciclo: opciones.duracion })
  flushSync(() => raiz!.render(
    // EN PANTALLA NO HAY ENVOLTORIO DE ESCALA. El scale(1.6) existe para agrandar una TARJETA
    // dentro de un cuadro mas grande; aplicado a un Visual que ya ocupa el cuadro entero lo
    // sacaria fuera por los cuatro lados, fondo incluido.
    opciones.modo === 'pantalla'
      ? hijo
      : React.createElement('div', { style: ESTILO_ENVOLTORIO }, hijo)
  ))
}

;(window as any).__montar = (graphicData: any, op: Partial<Opciones> = {}) => {
  opciones = { ...opciones, ...op }
  sonda.style.cssText = `height:${SONDA_ALTO}px;width:100%;background:#000;opacity:1`
  // El margen se calcula en PIXELES desde el alto. Ojo con la tentacion de volver a una clase
  // de Tailwind con plantilla —`pb-[${x}%]`—: el JIT no la ve, no genera CSS, y el margen se
  // quedaria en cero sin que nada lo dijera.
  const margenPx = Math.round(opciones.alto * MARGEN_INFERIOR_PCT / 100)
  lienzo.style.cssText = `width:${opciones.ancho}px;height:${opciones.alto}px` +
    (opciones.modo === 'pantalla' ? '' : `;padding-bottom:${margenPx}px;box-sizing:border-box`)
  // 'overlay': la tarjeta abajo al centro, al MARGEN_INFERIOR_PCT del alto.
  // 'pantalla': el Visual ocupa el lienzo entero, asi que el hijo lleva w-full h-full y aqui
  // NO se centra nada: centrarlo dejaria el fondo sin cubrir los bordes.
  lienzo.className = opciones.modo === 'pantalla'
    ? 'flex'
    : 'flex items-end justify-center'
  datos = graphicData

  // ── SE DESMONTA Y SE VUELVE A MONTAR EN CADA CLIP ────────────────────────────────────
  //
  // Antes era `if (!raiz) raiz = createRoot(lienzo)`: la raiz se creaba UNA vez y se reutilizaba
  // para todos los clips. Asi React reconciliaba el clip nuevo contra el anterior en vez de
  // construirlo, y los elementos del DOM sobrevivian de un Visual al siguiente.
  //
  // Y con ellos sobrevivia el objeto CSSAnimation que `__setT` ya habia pausado y al que le
  // habia fijado `currentTime` a mano. MEDIDO: cuando el clip nuevo trae NOMBRE de keyframes
  // distinto Y duracion distinta en la misma reconciliacion, la animacion reporta lo nuevo
  // —`animationName` correcto, `effect.duration` correcto, `currentTime` correcto— y APLICA lo
  // viejo: los valores interpolados salen de la curva del clip anterior.
  //
  // Hacen falta LAS DOS cosas a la vez. Solo cambiar el value (nombre nuevo, misma duracion) va
  // bien; solo cambiar el ciclo (mismo nombre, duracion nueva) va bien. Por eso no se veia.
  //
  // NO ERA UN FALLO DE NINGUNA COMPOSICION. Medido en las dos: `visual_extrusion` sale con 47
  // de 63 frames distintos segun cual sea el clip que lo precede, y `visual_mapa` con 53 de 63.
  // Todos los Visuales que hay hoy en disco estan renderizados asi. Ver el 10 septies de
  // docs/AUDITORIA.md.
  //
  // POR QUE AQUI Y NO EN LAS COMPOSICIONES. Tambien se arregla poniendo el `value` en la `key`
  // de cada elemento animado, y funciona. Pero es una regla que CADA composicion futura tiene
  // que acordarse de cumplir, y si alguien la olvida el fallo es MUDO: el Visual sale desfasado
  // y las nueve guardas dan verde. `__montar` es el punto UNICO por donde pasa todo clip de
  // toda composicion. Una puerta, no una por composicion.
  //
  // Y basta con esto: esta medido que desmontar el subarbol arregla el frame. No hace falta
  // recargar la pagina ni tirar la ventana, que es lo caro —~150 ms de arranque— y es
  // justamente lo que la ventana reutilizada existe para evitar.
  if (raiz) raiz.unmount()
  raiz = createRoot(lienzo)
  ;(window as any).__setT(0)
}

;(window as any).__setT = (t: number) => {
  // La sonda se pinta por DOM directo y de forma sincrona, fuera de React.
  const v = Math.round((t * 30) % 255)
  sonda.style.background = `rgb(${v},${v},${v})`
  pintar(t)

  // BLINDAJE: se posiciona TODO el documento, no solo el subarbol de AnimatedGraphic.
  //
  // El muestreo de siempre vive en el useLayoutEffect de AnimatedGraphic y alcanza
  // `raizRef.current.getAnimations({subtree:true})`. Eso cubre lo que cuelga del componente y
  // hoy basta — esta comprobado que el render es determinista—, pero deja fuera un portal de
  // React, una animacion sobre `body` o sobre el `<html>`, y cualquier elemento que una
  // composicion futura monte fuera de esa raiz. Lo que quede fuera corre con el RELOJ DE PARED
  // y pasa todas las guardas: los frames salen distintos entre si, la sonda valida el `t` y no
  // el contenido, y el MOV dura lo correcto. Es el mismo patron del canvas en blanco.
  //
  // VA DESPUES DE `pintar`, NO ANTES, y no es un detalle de estilo: antes de pintar el DOM es
  // todavia el del frame ANTERIOR, asi que un elemento creado en ESTE render —justo el caso que
  // se quiere cubrir— no existiria aun y se quedaria sin posicionar. `pintar` usa flushSync, de
  // modo que al volver el arbol esta comprometido y los layout effects ya han corrido: aqui
  // getAnimations() lo ve todo.
  //
  // Es redundante con el useLayoutEffect y se deja a proposito: cuesta un recorrido de una
  // lista corta y quita la obligacion de que cada composicion se acuerde de colgarse del sitio
  // correcto. Antes de escribir veintitantos mecanismos, esa obligacion es una trampa.
  for (const a of document.getAnimations()) {
    try { a.pause(); a.currentTime = t * 1000 } catch (e) { /* una animacion sin tiempo activo */ }
  }
}

// ── LAS FUENTES QUE EL RENDER NECESITA ────────────────────────────────────────────────
//
// Outfit la usan las 17 tarjetas por `--font-sans`; Archivo y Anton las pide `mapa.tsx`.
//
// EL TEXTO DE MUESTRA NO ES DECORATIVO. Con `unicode-range`, el navegador solo descarga los
// rangos que el texto necesita, asi que `load()` con la cadena por defecto podria dejar fuera
// las mayusculas acentuadas. Lleva las cinco vocales acentuadas, la enye en las dos cajas y
// digitos: es lo que de verdad aparece en un guion en español.
/**
 * ¿Esta esa familia REALMENTE disponible? Dos comprobaciones, y hacen falta las dos.
 *
 * `document.fonts.check()` NO BASTA, y esta medido que responde justo al reves de lo que hace
 * falta en los dos casos que importan:
 *   · con Outfit 400 y 600 YA CARGADAS, `check('700 16px Outfit')` devolvia FALSE, porque el
 *     peso 700 aun no se habia usado;
 *   · y `check('700 16px Archivo')` devolvia TRUE con Archivo SIN EXISTIR — no hay ninguna
 *     cara declarada que cargar, asi que la respuesta es vacuamente cierta.
 * Solo sirve DESPUES de declarar el @font-face y de forzar la carga, y aun asi solo detecta
 * "declarada pero no cargada".
 *
 * Por eso el cinturon es el ANCHO: se mide la misma cadena con la familia pedida y con una
 * familia que no existe. Si coinciden al pixel, lo que se esta pintando es el respaldo. Eso SI
 * detecta el caso que de verdad duele —el fichero no llego— y no depende de la semantica de
 * check().
 */
function faltaLaFuente (familia: string, peso: number): string | null {
  const porAncho = faltaLaFuentePorAncho(familia, peso)
  if (porAncho) return porAncho
  if (!document.fonts.check(`${peso} 16px "${familia}"`)) {
    return `${familia}: declarada pero fonts.check dice que el peso ${peso} no esta cargado`
  }
  return null
}

;(window as any).__listo = async () => {
  // FORZAR LA CARGA, no esperarla. `document.fonts.ready` sola NO sirve aqui y esta medido:
  // se resuelve en 0 ms sobre la pagina vacia —que es cuando el proceso principal llama a
  // __listo, ANTES de __montar— porque una webfont solo se carga cuando algo la usa. Con
  // contenido montado tarda 22.8 ms, y esa es exactamente la ventana en la que el primer frame
  // podria capturarse con la sans de respaldo: un fallo silencioso E INTERMITENTE.
  //
  // `fonts.load()` es la unica API que la carga sin que nadie la use todavia. Por eso __montar
  // se queda SINCRONO: el problema se resuelve aqui, antes, y no hay que cambiar el momento en
  // que se monta ningun grafico.
  const avisos: string[] = []
  try {
    await Promise.all(FUENTES_RENDER.map(f =>
      (document as any).fonts.load(`${f.peso} 1em "${f.familia}"`, MUESTRA_FUENTES)))
  } catch (e) {
    avisos.push(`fonts.load lanzo: ${String(e)}`)
  }
  await document.fonts.ready

  for (const f of FUENTES_RENDER) {
    const fallo = faltaLaFuente(f.familia, f.peso)
    if (fallo) avisos.push(`FUENTE AUSENTE: ${fallo}`)
  }
  // Se DEPOSITAN en el mismo canal que los avisos del candado del ciclo, por la misma razon:
  // esta ventana es offscreen y su consola no la abre nadie. Un console.warn aqui no llegaria
  // a generation-debug.log — esta medido.
  if (avisos.length) {
    const w = window as any
    if (!Array.isArray(w.__avisosCiclo)) w.__avisosCiclo = []
    for (const a of avisos) if (!w.__avisosCiclo.includes(a)) w.__avisosCiclo.push(a)
  }

  return {
    w: window.innerWidth,
    h: window.innerHeight,
    fuentes: document.fonts.status,
    // Las que el proceso principal tiene que poder registrar. Vacio = las tres cargadas.
    avisosFuentes: avisos,
    sondaAlto: SONDA_ALTO
  }
}
