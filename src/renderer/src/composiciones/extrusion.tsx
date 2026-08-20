// EXTRUSION — la primera composicion, y la elegida por ser la mas barata de verificar.
//
// Es de lab-volumen.html. Se eligio A PROPOSITO la mas simple y no la mas vistosa: no estrena
// ningun motor —no hay proyeccion, ni Lambert, ni culling, ni clip-path, ni canvas—, solo
// `preserve-3d` y una pila de copias en translateZ. Si esto sale bien, lo demostrado es el
// MECANISMO: que el ciclo llega, que las duraciones se derivan de el y que el bucle cierra.
//
// EL AJUSTE HACIA MAS AUTORIDAD, y las tres decisiones que lo componen:
//
//   1. SIN CHISPAS. El anillo de 8 puntos orbitando era decoracion: no significaba nada y le
//      quitaba peso al solido. Lo decorativo resta autoridad, asi que fuera. La escena es
//      ahora una sola pieza.
//   2. VAIVEN CONTENIDO. Se baja de +-52 grados a la banda 22-30. Lo lento se lee como
//      control; lo agitado, como nervio. Es el cambio que mas se nota de los tres.
//   3. NADA DE BLUR NI GLOW. No habia y no se añade: ni un `filter`, ni una sombra, ni un
//      degradado de resplandor en todo el fichero. Los cantos salen de la pila de copias, que
//      son bordes duros de verdad. La nitidez se lee como precision.

import React from 'react'
import { ajustar } from '../../../shared/ciclo'
import { generador, entre, entero } from '../../../shared/semilla'
import type { Composicion, PropsComposicion } from './index'

const HEX = 'polygon(50% 2%,94% 26%,94% 74%,50% 98%,6% 74%,6% 26%)'

// LAS DOS DURACIONES, como DIVISORES y nunca como segundos.
//
// `n` es el divisor: la animacion dura ciclo/n. Escrito asi es legal para cualquier ciclo por
// construccion — que es justo lo que un `1.5s` literal no puede prometer.
//
// Dos escalas de tiempo, no una: el giro ocupa el ciclo entero y la respiracion la mitad. Que
// no coincidan es lo que evita que el conjunto se lea como un unico latido mecanico.
const DIVISORES = [
  { que: 'vaiven', n: 1 },
  { que: 'respira', n: 2 }
] as const

/** Las duraciones ya corregidas, mas los avisos de lo que hubo que corregir. */
function duracionesDe(ciclo: number) {
  const d: Record<string, number> = {}
  const avisos: string[] = []
  for (const x of DIVISORES) {
    // Se pasa por `ajustar` aunque ciclo/n sea legal por construccion. No es ceremonia: el dia
    // que alguien escriba aqui un 1.5 en vez de un divisor, esta linea lo corrige y lo dice.
    // Un candado que solo se aplica cuando sospechas no es un candado.
    const r = ajustar(ciclo, x.que, ciclo / x.n)
    d[x.que] = r.d
    if (r.aviso) avisos.push(r.aviso)
  }
  return { d, avisos }
}

/**
 * LO QUE VARIA CON LA SEMILLA, y por que estas cuatro cosas y no otras.
 *
 * El criterio es que la diferencia SE VEA al comparar dos Visuales seguidos. Variar el numero
 * de chispas —o cualquier detalle pequeño— habria dado variedad que no se nota, que es lo
 * mismo que no tener variedad y encima cuesta lo mismo.
 *
 *   capas    28-52  cambia el GROSOR del solido: se ve de canto, es lo primero que se percibe
 *   ancho    34-50  cambia cuanto OCUPA en el cuadro
 *   amplitud 22-30  cambia cuanto GIRA, dentro de la banda contenida
 *   cabeceo  -8/-18 cambia desde donde se MIRA: mas o menos picado
 *
 * El paso en Z se DERIVA de las capas para que el grosor total no se dispare: 52 capas al paso
 * de 40 harian un solido el doble de profundo, y con la perspectiva a 80cqw la cara trasera se
 * saldria del encuadre.
 */
function formaDe(semilla: number) {
  const rnd = generador(semilla)
  const capas = entero(rnd, 28, 52)
  const ancho = entre(rnd, 34, 50)
  const amplitud = entre(rnd, 22, 30)
  const cabeceo = entre(rnd, -18, -8)
  const grosor = 13.6                       // cqw totales de profundidad, constante
  return { capas, ancho, amplitud, cabeceo, paso: grosor / capas }
}

// Los @keyframes viajan en un <style> DENTRO del JSX, no inyectados en un useEffect.
//
// El motivo es de orden, y es exacto: `pintar()` usa flushSync, asi que React compromete el
// arbol entero de forma SINCRONA —el <style> incluido—, luego corre useLayoutEffect (donde
// AnimatedGraphic posiciona el reloj con getAnimations) y solo despues pinta. Con un useEffect
// las reglas llegarian DESPUES del pintado: getAnimations no veria nada y el frame saldria sin
// animar, en silencio.
//
// El vaiven se emite POR SEMILLA porque su amplitud varia; la respiracion es fija y se declara
// una sola vez. El prefijo `cx-` evita chocar con las animaciones de globals.css.
const CSS_FIJO = `
@keyframes cx-respira{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
`
const cssVaiven = (nom: string, amp: number, cab: number) =>
  `@keyframes ${nom}{0%,100%{transform:rotateX(${cab.toFixed(2)}deg) rotateY(${(-amp).toFixed(2)}deg)}` +
  `50%{transform:rotateX(${cab.toFixed(2)}deg) rotateY(${amp.toFixed(2)}deg)}}`

function render({ ciclo, semilla }: PropsComposicion): React.ReactNode {
  const { d } = duracionesDe(ciclo)
  const f = formaDe(semilla)
  // El nombre lleva la semilla: dos Visuales distintos en la misma pagina no pueden pisarse la
  // regla. Hoy la ventana monta uno cada vez, pero eso es una propiedad del llamador, no de
  // esta funcion, y depender de ella seria una trampa esperando al dia que se monten dos.
  const nomVaiven = `cx-vaiven-${semilla >>> 0}`

  // container-type:inline-size hace que `cqw` se resuelva contra el ancho de ESTE div. Es lo
  // que permite copiar los numeros del laboratorio tal cual, en vez de traducirlos a pixeles
  // de 1080 y que dejen de valer el dia que se renderice a otra resolucion.
  const raiz: React.CSSProperties = {
    position: 'absolute', inset: 0,
    containerType: 'inline-size',
    perspective: '80cqw', perspectiveOrigin: '50% 44%'
  }
  const mundo: React.CSSProperties = { position: 'absolute', inset: 0, transformStyle: 'preserve-3d' }

  const capas = []
  const mitad = f.ancho / 2
  for (let i = 0; i < f.capas; i++) {
    const u = i / (f.capas - 1)
    // El frente lleva el acento del sistema y el fondo se apaga hacia el negro. Ese degradado
    // ES el volumen: no hay geometria, hay repeticion. Sin glow ni sombra: el canto sale de
    // que cada copia es un poco mas oscura que la anterior, y eso da un borde duro.
    const b = 1 - u
    const col = i === 0
      ? 'var(--acento)'
      : `rgb(${Math.round(22 + b * 118)},${Math.round(22 + b * 106)},${Math.round(22 + b * 86)})`
    capas.push(
      <div key={i} style={{
        position: 'absolute', left: '50%', top: '42%',
        width: `${f.ancho.toFixed(2)}cqw`, height: `${f.ancho.toFixed(2)}cqw`,
        margin: `-${mitad.toFixed(2)}cqw 0 0 -${mitad.toFixed(2)}cqw`,
        clipPath: HEX, background: col,
        transform: `translateZ(${(6.8 - i * f.paso).toFixed(3)}cqw)`
      }} />
    )
  }

  return (
    <div style={raiz}>
      <style dangerouslySetInnerHTML={{
        __html: CSS_FIJO + cssVaiven(nomVaiven, f.amplitud, f.cabeceo)
      }} />
      <div style={{ ...mundo, animation: `cx-respira ${d.respira}s ease-in-out infinite both` }}>
        <div style={{ ...mundo, animation: `${nomVaiven} ${d.vaiven}s ease-in-out infinite both` }}>
          {capas}
        </div>
      </div>
    </div>
  )
}

export const extrusion: Composicion = {
  nombre: 'extrusion',
  duraciones: (ciclo) => DIVISORES.map(x => ({ que: x.que, d: ciclo / x.n })),
  avisos: (ciclo) => duracionesDe(ciclo).avisos,
  render
}
