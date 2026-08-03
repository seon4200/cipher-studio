// Punto de entrada AISLADO para renderizar un grafico fuera de la app.
// Lo carga una ventana offscreen del proceso principal, que llama a __montar y __setT.
// No monta nada al cargar: la ventana se reutiliza para todos los graficos, que es lo
// que hace que su arranque (~150 ms medidos) se amortice entre todos.
import React from 'react'
import { createRoot, Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { AnimatedGraphic } from './AnimatedGraphic'
import './styles/globals.css'

// Franja de la SONDA, encima del lienzo. El proceso principal codifica ahi el indice de
// frame y solo acepta el bitmap cuyo indice coincide con el que acaba de fijar: sin ese
// lazo cerrado, 'paint' entrega un frame ~4 atrasado (medido, 0 de 90 exactos).
// La franja NO viaja a ffmpeg: se recorta del buffer con un subarray, coste cero.
const SONDA_ALTO = 8

type Opciones = { ancho: number; alto: number; modo: 'overlay' | 'pantalla' }
let opciones: Opciones = { ancho: 1080, alto: 1920, modo: 'overlay' }

const sonda = document.getElementById('sonda') as HTMLDivElement
const lienzo = document.getElementById('lienzo') as HTMLDivElement
let raiz: Root | null = null
let datos: any = null

function pintar(t?: number) {
  if (!raiz || !datos) return
  // flushSync: sin esto React renderiza de forma diferida y el frame capturado podria
  // llevar el estado anterior aunque el lazo cerrado diga que el indice es correcto.
  flushSync(() => raiz!.render(React.createElement(AnimatedGraphic, { graphic: datos, t })))
}

;(window as any).__montar = (graphicData: any, op: Partial<Opciones> = {}) => {
  opciones = { ...opciones, ...op }
  sonda.style.cssText = `height:${SONDA_ALTO}px;width:100%;background:#000;opacity:1`
  lienzo.style.cssText = `width:${opciones.ancho}px;height:${opciones.alto}px`
  // 'overlay': la misma posicion que el preview (abajo al centro, al 20%).
  // 'pantalla': centrado, para los graficos de pantalla completa del Proyecto B.
  lienzo.className = opciones.modo === 'pantalla'
    ? 'flex items-center justify-center'
    : 'flex items-end justify-center pb-[20%]'
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
