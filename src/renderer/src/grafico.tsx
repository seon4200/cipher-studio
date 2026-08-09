// Punto de entrada AISLADO para renderizar un grafico fuera de la app.
// Lo carga una ventana offscreen del proceso principal, que llama a __montar y __setT.
// No monta nada al cargar: la ventana se reutiliza para todos los graficos, que es lo
// que hace que su arranque (~150 ms medidos) se amortice entre todos.
import React from 'react'
import { createRoot, Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { AnimatedGraphic } from './AnimatedGraphic'
import { NombreSistema } from './sistemas'
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
}
let opciones: Opciones = { ancho: 1080, alto: 1920, modo: 'overlay', sistema: 'voltaje' }

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
    { graphic: datos, t, modo: opciones.modo, sistema: opciones.sistema })
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
  if (!raiz) raiz = createRoot(lienzo)
  ;(window as any).__setT(0)
}

;(window as any).__setT = (t: number) => {
  // La sonda se pinta por DOM directo y de forma sincrona, fuera de React.
  const v = Math.round((t * 30) % 255)
  sonda.style.background = `rgb(${v},${v},${v})`
  pintar(t)
}

;(window as any).__listo = async () => {
  await document.fonts.ready
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    fuentes: document.fonts.status,
    sondaAlto: SONDA_ALTO
  }
}
