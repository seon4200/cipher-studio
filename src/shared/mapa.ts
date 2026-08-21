// LA MATEMATICA DEL VISUAL DE MAPA CONCEPTUAL.
//
// Portado de docs/motion/generador-clips.html. AQUI SOLO HAY ARITMETICA: ni JSX, ni document,
// ni <style>, ni requestAnimationFrame. Eso permite probarlo entero sin montar React ni abrir
// una ventana, que es lo que ha hecho utiles a reparto.ts, exclusion.ts y ciclo.ts.
//
// NO se portan en este paso —son del paso 3, y necesitan el motor de keyframes—:
//   nodo()  flecha()  pulso()  kf()  fuente()
//
// CINCO DIFERENCIAS DELIBERADAS CON LA REFERENCIA. Ninguna es un descuido:
//
//   1. NO hay PRNG propio. La referencia lleva `let _s = 1` a nivel de modulo, y con estado
//      compartido añadir un elemento a una escena CAMBIA TODAS LAS SIGUIENTES. Aqui cada
//      funcion recibe un `rnd` creado con `generador(semilla)`, que lleva su propio estado.
//   2. La semilla sale SOLO de `value`. La referencia usa palabra + variante, y la variante es
//      un control del laboratorio que no existe en la app. Y no puede existir: `value` esta en
//      la clave del hash y nada mas lo esta, asi que sembrar con otra cosa daria dos dibujos
//      distintos bajo el mismo nombre de fichero.
//   3. CERO segundos literales. La referencia tiene `const CICLO = 3`, que es del laboratorio.
//      En la app el ciclo llega como parametro y toda duracion sale de `fraccion(ciclo, n)`.
//      La tabla T ya viene en fracciones en la referencia: se porta tal cual.
//   4. La zona segura se CORRIGE, no se hereda. Ver ZONA.
//   5. `layoutSeguro` conserva sus 50 intentos y su repliegue.

import { generador, semillaDe } from './semilla';
import type { Concepto } from './conceptos';

// ── TIPOS ──────────────────────────────────────────────────────────────────────────

export type Punto = { x: number; y: number };
/** [desde, hasta] en indices de `pts`. -1 = el ancla. */
export type Arista = [number, number];
export type Layout = { ancla: Punto; pts: Punto[]; aristas: Arista[]; curva: number };
export type Paleta = { a: string; b: string; ac: string; f1: string; f2: string };
export type Familia = 'radial' | 'malla' | 'capas' | 'cascada';
export type Orden = 'secuencial' | 'alterno' | 'inverso';
export type Transicion = 'implosion' | 'espiral' | 'barrido';

// ── CONSTANTES DE ENCUADRE ─────────────────────────────────────────────────────────

/** 1% de alto son 1.7778 cqw en un marco 9:16. Convierte desplazamientos verticales. */
export const SY = 16 / 9;

/** Donde colapsa el mapa y nace el icono. TODO converge aqui, no al ancla: si convergiera al
 *  ancla, el colapso apuntaria a un sitio y el icono apareceria en otro.
 *
 *  y = 45 Y NO 38 desde el paso 9. Va ENCADENADO con ZONA.yMax: si el mapa se reparte hasta el
 *  77% y el foco se quedara en el 38%, el colapso tiraria de todo hacia arriba y el remate
 *  apareceria descentrado, con medio cuadro vacio debajo. El 45 es el centro de la banda que
 *  ocupan de verdad los nodos —13.54 a 77— redondeado a la posicion del ancla de las familias.
 *
 *  Y hay tres sitios mas clavados a este numero, en el CSS de mapa.tsx: `.cm-destello`,
 *  `.cm-halo` y `.cm-icono` llevan `top`. Los cuatro se mueven juntos o el icono nace donde el
 *  mapa no colapso. */
export const FOCO: Punto = { x: 50, y: 45 };

/**
 * LA ZONA SEGURA, y aqui la referencia estaba MAL.
 *
 * Su `separados` exige `y > 9`, y el margen superior de CIPHER empieza en 13.54%: un nodo a
 * y=10 cae en zona prohibida y en un movil se lo come la interfaz.
 *
 * Los numeros salen de la aritmetica, no de una preferencia: la zona segura son 900x1400
 * centrados en 1080x1920, asi que (1080-900)/2/1080 = 8.33% a los lados y
 * (1920-1400)/2/1920 = 13.54% arriba y abajo.
 *
 * xMin/xMax se quedan en 13/87, MAS estrictos que el 8.33/91.67 de la zona: son de la
 * referencia y aprietan mas, asi que relajarlos seria empeorar.
 *
 * yMax SUBE DE 68 A 77 en el paso 9, y el numero sale de la aritmetica, no de una preferencia.
 *
 * El 68 existia porque abajo iba la palabra del Visual. Esa palabra ya no esta —se quito el pie
 * de la composicion— asi que ese limite dejo de tener dueno. Pero NO se sube a 86.46, que es el
 * borde de la zona segura, por dos razones:
 *
 *   1. ESTO ACOTA EL CENTRO DEL NODO, NO LA CAJA. Una caja de concepto mide 4.47% de alto, asi
 *      que su borde inferior cae en `centro + 2.235`. Con yMax = 77 el borde llega a 79.2, que
 *      deja 7.2 puntos de holgura hasta el 86.46 de la zona segura.
 *   2. ABAJO VA LA INTERFAZ DE LAS PLATAFORMAS —el texto del pie de TikTok, los botones de
 *      Reels— y esa interfaz no respeta ninguna zona segura nuestra. Mejor quedarse corto.
 *
 * El espacio que se libera es MENOS de lo que parece: el pie estaba en `bottom: 11%`, o sea POR
 * DEBAJO del 13.54% de la zona segura. Ese trozo nunca fue del mapa.
 */
export const ZONA = { xMin: 13, xMax: 87, yMin: 13.54, yMax: 77 };

/**
 * LA LINEA DE TIEMPO, EN FRACCIONES DEL CICLO. Nunca en segundos.
 *
 * Estos seis numeros NO se aleatorizan: son lo que hace que dos clips cualesquiera se lean
 * como el mismo lenguaje. La referencia los anota con su equivalente a 3 s —conFin 0.400 son
 * 1.20 s— y ese comentario es justo lo que NO se porta: en la app el ciclo es la duracion del
 * sub-clip, entre 2.10 y 3.82 s medidos, y un literal en segundos seria un bucle que salta
 * sin que nada lo diga.
 *
 * Para un INSTANTE: ciclo * T.conFin. Para una DURACION: fraccion(ciclo, n) de ./ciclo.
 */
export const T = {
  conFin: 0.400,   // el mapa termino de construirse
  traFin: 0.583,   // la transicion termino
  flash: 0.545,    // el destello que tapa el corte
  icoIni: 0.560,   // el icono empieza a dibujarse
  icoFin: 0.730,   // el icono esta completo
  palabra: 0.770   // entra la palabra
} as const;

// ── AYUDANTES. Todos reciben `rnd`: no hay estado de modulo. ───────────────────────

export const cl = (v: number, a: number, b: number): number => (v < a ? a : (v > b ? b : v));

/** Entero en [a,b], los dos incluidos. */
export const ent = (rnd: () => number, a: number, b: number): number =>
  a + Math.floor(rnd() * (b - a + 1));

/** Un elemento de la lista. Devuelve el primero si el sorteo se sale, nunca undefined. */
export function elige<X>(rnd: () => number, a: readonly X[]): X {
  return a[Math.floor(rnd() * a.length)] ?? a[0];
}

/** Ruido simetrico en [-m, m]. */
export const jit = (rnd: () => number, m: number): number => (rnd() * 2 - 1) * m;

/** Ninguna familia produce un dibujo legible con mas nodos que esto. */
export const N_MAX = 12;

/**
 * Acota `n` a un entero usable. NO es ceremonia defensiva: sin esto, `LAYOUTS.radial(rnd,
 * Infinity)` entra en un `for (let i = 0; i < n; i++)` que no termina nunca y se come la
 * memoria del proceso. Lo cazo la suite con `n = Infinity` entre los degenerados, y el sintoma
 * fue un "JavaScript heap out of memory" que tumbo el runner entero — no una excepcion que se
 * pudiera atrapar.
 *
 * Un NaN o un negativo dan 0, que produce un layout vacio: feo, pero devuelve.
 */
export function nSeguro (n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(v, N_MAX);
}

// ── PALETAS ────────────────────────────────────────────────────────────────────────
//
// Duo base + acento. Nunca mas de tres colores en pantalla: `a` y `b` para nodos y aristas,
// `ac` para el pulso, `f1` y `f2` para los dos degradados del fondo.
//
// LAS CINCO, no un subconjunto. Con Visuales al 100% un video de 9 minutos son ~200 escenas,
// y cada paleta que falte multiplica la sensacion de repeticion.
export const PALETAS: readonly Paleta[] = [
  { a: '#00E5FF', b: '#FF2E7E', ac: '#E8FF3C', f1: '#06283c', f2: '#3a0620' },
  { a: '#7B3DFF', b: '#00E5FF', ac: '#E8FF3C', f1: '#1a0a3c', f2: '#052a3a' },
  { a: '#FF2E7E', b: '#E8FF3C', ac: '#00E5FF', f1: '#2a0632', f2: '#2e2a06' },
  { a: '#00E5FF', b: '#E8FF3C', ac: '#FF2E7E', f1: '#052a3a', f2: '#1e2a06' },
  { a: '#7B3DFF', b: '#FF2E7E', ac: '#00E5FF', f1: '#20063a', f2: '#3a0620' }
];

// ── FAMILIAS DE LAYOUT ─────────────────────────────────────────────────────────────
//
// Cada una devuelve {ancla, pts, aristas, curva}. Coordenadas en % del marco.
// LAS CUATRO de la referencia, sin omitir ninguna: son el motor de variedad.

export const LAYOUTS: Record<Familia, (rnd: () => number, n: number) => Layout> = {
  /** Los conceptos en elipse alrededor del ancla. La direccion del giro tambien se sortea. */
  radial (rnd, n) {
    // cy 38 -> 45 y ry 17 -> 21: el centro baja al centro visual de la zona nueva y la elipse
    // se estira, porque con yMax en 77 hay 9 puntos mas de alto que repartir.
    const cx = 50, cy = 45;
    n = nSeguro(n);
    const rx = 27 + jit(rnd, 3), ry = 21 + jit(rnd, 2);
    const a0 = rnd() * 360;
    const dir = rnd() < 0.5 ? 1 : -1;
    const pts: Punto[] = [];
    for (let i = 0; i < n; i++) {
      const a = (a0 + dir * i * 360 / n + jit(rnd, 10)) * Math.PI / 180;
      pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
    }
    return {
      ancla: { x: cx, y: cy }, pts,
      aristas: pts.map((_, i) => [-1, i] as Arista), curva: 0.05
    };
  },

  /** Posiciones fijas con ruido, y aristas ENTRE conceptos ademas de las del ancla: es la
   *  unica familia donde los conceptos se relacionan entre si. */
  malla (rnd, n) {
    // Las posiciones base se estiran de la banda 19-66 a la 20-74, y el ancla baja de 38 a 45.
    const cx = 50, cy = 45;
    n = nSeguro(n);
    const base: Punto[] = [
      { x: 25, y: 20 }, { x: 75, y: 25 }, { x: 20, y: 62 }, { x: 78, y: 65 }, { x: 50, y: 74 }
    ];
    const pts = base.slice(0, n).map(p => ({ x: p.x + jit(rnd, 5), y: p.y + jit(rnd, 4) }));
    const ar: Arista[] = pts.map((_, i) => [-1, i] as Arista);
    for (let i = 0; i < n - 1; i++) if (rnd() < 0.75) ar.push([i, i + 1]);
    if (n > 2 && rnd() < 0.6) ar.push([0, n - 1]);
    return { ancla: { x: cx, y: cy }, pts, aristas: ar, curva: 0.10 };
  },

  /** Entradas arriba, salidas abajo, el ancla en medio. La unica con aristas en las DOS
   *  direcciones: arriba entra al ancla, el ancla sale abajo. */
  capas (rnd, n) {
    const cx = 50, cy = 38;
    n = nSeguro(n);
    const arriba = Math.ceil(n / 2);
    const pts: Punto[] = [];
    for (let i = 0; i < arriba; i++) {
      pts.push({
        x: 50 + (arriba === 1 ? 0 : (i / (arriba - 1) - 0.5) * 52) + jit(rnd, 3),
        y: 17 + jit(rnd, 2)
      });
    }
    const abajo = n - arriba;
    for (let i = 0; i < abajo; i++) {
      pts.push({
        x: 50 + (abajo === 1 ? 0 : (i / (abajo - 1) - 0.5) * 52) + jit(rnd, 3),
        y: 72 + jit(rnd, 2)
      });
    }
    const ar: Arista[] = [];
    for (let i = 0; i < arriba; i++) ar.push([i, -1]);      // entradas -> ancla
    for (let i = arriba; i < n; i++) ar.push([-1, i]);      // ancla -> salidas
    return { ancla: { x: cx, y: cy }, pts, aristas: ar, curva: 0.04 };
  },

  /** En zigzag hacia abajo, encadenados. El ancla queda ARRIBA, no en el centro.
   *
   *  cy = 15 Y NO 12, QUE ES LO QUE DICE LA REFERENCIA. Es consecuencia de haber subido yMin
   *  de 9 a 13.54: con el ancla en 12, `separados` la rechaza SIEMPRE —12 > 13.54 es falso—,
   *  los 50 intentos fallan los 50 y cascada replegaba a `capas` en el 100% de los casos.
   *  Medido antes de arreglarlo: 0 de 500 cascadas crudas pasaban la comprobacion.
   *
   *  De cuatro disposiciones quedaban tres, y `capas` salia el doble que las demas. El motor
   *  de variedad perdia un cuarto de su repertorio sin dar un solo error.
   *
   *  Subir el ancla 3 puntos no toca nada mas: los nodos empiezan en y=29 y con n=3 el ultimo
   *  cae en 49.6-54.4, muy por debajo de yMax=68. */
  cascada (rnd, n) {
    // El paso vertical sube de 11.5 a 14.5: con tres nodos, el ultimo pasa de ~52 a ~62 y la
    // cascada llega mas abajo en vez de amontonarse en el tercio superior.
    const cx = 50, cy = 15;
    n = nSeguro(n);
    const pts: Punto[] = [];
    const lado = rnd() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      pts.push({
        x: 50 + lado * (i % 2 ? -1 : 1) * (19 + jit(rnd, 4)),
        y: 31 + i * (14.5 + jit(rnd, 1.2))
      });
    }
    const ar: Arista[] = [[-1, 0]];
    for (let i = 0; i < n - 1; i++) ar.push([i, i + 1]);
    return { ancla: { x: cx, y: cy }, pts, aristas: ar, curva: 0.09 };
  }
};

export const FAMILIAS: readonly Familia[] = ['radial', 'malla', 'capas', 'cascada'];

// ── LEGIBILIDAD ────────────────────────────────────────────────────────────────────

// -- EL TAMANO DE UNA CAJA ----------------------------------------------------------
//
// MEDIDO EN EL DOM REAL, a 1080 px y con Archivo YA CARGADA (paso 5). No es una estimacion:
// se midio `.cm-caja` con etiquetas de 3, 5, 7, 9, 12 y 15 caracteres y se ajusto una recta.
//
//   concepto (minusculas + emoji)   1.257 * c + 12.18    alto 4.47 % del ALTO
//   ancla    (minusculas sin emoji) 1.257 * c +  6.48    alto 3.77 % del ALTO
//
// LA PENDIENTE ES LA MISMA en los dos: el emoji y su gap son 5.70 puntos de intercepto y nada
// mas, que es lo que dice el CSS -- `.cm-mini` 5cqw mas `gap` 1.3cqw.
//
// MINUSCULAS, y esta medido por que: de 3.670 palabras candidatas del ultimo guion, el 92.3%
// vienen en minusculas, el 6.4% con inicial mayuscula -- que mide igual, 1.245 * c + 6.88 -- y
// el 1.2% en mayusculas, que son siglas de tres letras. La fila de MAYUSCULAS enteras, que
// seria 1.817 * c, es teorica y no se usa.
//
// SI CAMBIA LA FUENTE HAY QUE VOLVER A MEDIR ESTO. El modelo anterior -- 1.44 * c + 12.7 --
// estaba medido contra la sans del sistema, y calibrar con el habria dado cajas un 15% mas
// anchas de lo que son. Ver el paso 5 en docs/deuda-graficos.md.
const CAJA = {
  porCaracter: 1.257,
  baseConEmoji: 12.18,
  baseSinEmoji: 6.48,
  altoConEmoji: 4.47,
  altoSinEmoji: 3.77
} as const;

/** El ancho de la caja, en % del ANCHO del marco. */
export function anchoCaja (etiqueta: unknown, conEmoji: boolean): number {
  const c = String(etiqueta === null || etiqueta === undefined ? '' : etiqueta).length;
  return (conEmoji ? CAJA.baseConEmoji : CAJA.baseSinEmoji) + CAJA.porCaracter * c;
}

/** El alto de la caja, en % del ALTO del marco. No depende del texto: es una sola linea. */
export function altoCaja (conEmoji: boolean): number {
  return conEmoji ? CAJA.altoConEmoji : CAJA.altoSinEmoji;
}

/** Lo que `separados` necesita de cada nodo. Ancho en % de ANCHO, alto en % de ALTO. */
export type Caja = { ancho: number; alto: number };

/** Las cajas de un layout, en el MISMO orden que `pts.concat([ancla])`. */
export function cajasDe (etiquetas: readonly unknown[], valueAncla: unknown): Caja[] {
  const cs: Caja[] = (Array.isArray(etiquetas) ? etiquetas : [])
    .map(e => ({ ancho: anchoCaja(e, true), alto: altoCaja(true) }));
  cs.push({ ancho: anchoCaja(valueAncla, false), alto: altoCaja(false) });
  return cs;
}

// -- EL MARGEN, y de donde sale el numero -------------------------------------------
//
// Si el umbral fuera el contacto EXACTO, dos cajas que se ROZAN pasarian como separadas: el
// dibujo saldria apelotonado y todas las pruebas en verde.
//
// MARGEN_H = 2.4 es EL PADDING HORIZONTAL DE LA PROPIA CAJA (`padding: 1.5cqw 2.4cqw`). Asi el
// aire ENTRE dos cajas es el mismo que el aire DENTRO de cada una, y el ritmo del dibujo es uno
// solo. Un numero inventado no tendria de donde re-derivarse el dia que cambie el padding.
//
// MARGEN_V = 2.24 es LA MITAD DE UN ALTO DE CAJA. En vertical el ojo tolera mucho menos: a
// media caja ya se leen como dos renglones, y a menos se leen como un bloque. El padding
// vertical (1.5cqw = 0.84% del alto) es demasiado pequeno para eso.
//
// LAS UNIDADES NO SON LAS MISMAS: MARGEN_H va en % del ANCHO y MARGEN_V en % del ALTO, igual
// que `ancho` y `alto` de la caja. Mezclarlas daria un margen vertical 1.78 veces el que se
// pretende.
//
// MEDIDO: con 2.4/2.24 las cuatro familias aciertan al PRIMER intento -- 1.000 de media sobre
// 828 valores -- asi que el margen no consume sorteos y produce exactamente los mismos dibujos
// que un margen cero. Hoy es una garantia que no cuesta nada; el dia que los layouts se
// aprieten, actua. Con 4.0/3.4 radial sube a 1.029 intentos, o sea que ya cambiaria el dibujo.
export const MARGEN_H = 2.4;
export const MARGEN_V = 2.24;

/**
 * Estan las cajas separadas entre si Y dentro de la zona.
 *
 * DOS RECTANGULOS NO SE PISAN si la distancia entre sus CENTROS supera la SEMISUMA de sus
 * tamanos -- la condicion geometrica exacta -- mas el margen.
 *
 * Antes era `dx < 33 && dy < 9.5`: dos constantes del laboratorio que no sabian cuanto mide
 * ninguna caja. Medido, una caja de concepto de 12 caracteres son 27.9% y el ancla 22.2%, asi
 * que 33 rechazaba parejas que no se tocaban -- radial replegaba en el 45% de los casos -- y
 * 9.5 era mas del doble del alto real, que es 4.47 y 3.77.
 *
 * OJO, Y ESTA SIN RESOLVER: la comprobacion de zona mira EL CENTRO del nodo, no la caja. Una
 * caja de 30% centrada en x=86 llega a x=101, fuera del cuadro. Ver la medicion en
 * docs/deuda-graficos.md antes de tocarlo: exigir que la caja entera quepa en la zona segura
 * dejaria a `radial` sin sitio.
 */
export function separados (pts: Punto[], ancla: Punto, cajas: Caja[]): boolean {
  const todos = pts.concat([ancla]);
  // Sin cajas no se puede decidir, y decir que SI dejaria pasar cualquier solape. La respuesta
  // segura es que no: `layoutSeguro` cae a su repliegue, que es legible por construccion.
  if (!Array.isArray(cajas) || cajas.length !== todos.length) return false;
  // Y cada entrada tiene que ser una caja de verdad. Con la longitud correcta pero un null
  // dentro, la comparacion lanzaba —lo cazo la suite— y una excepcion aqui mata el render del
  // Visual entero, que en este pipeline significa que desaparece del video sin decir nada.
  for (const c of cajas) {
    if (!c || !Number.isFinite(c.ancho) || !Number.isFinite(c.alto)) return false;
  }
  for (let i = 0; i < todos.length; i++) {
    for (let j = i + 1; j < todos.length; j++) {
      const dx = Math.abs(todos[i].x - todos[j].x);
      const dy = Math.abs(todos[i].y - todos[j].y);
      if (dx < (cajas[i].ancho + cajas[j].ancho) / 2 + MARGEN_H &&
          dy < (cajas[i].alto + cajas[j].alto) / 2 + MARGEN_V) return false;
    }
  }
  return todos.every(p =>
    p.x > ZONA.xMin && p.x < ZONA.xMax && p.y > ZONA.yMin && p.y < ZONA.yMax);
}

// -- EL RECORTE DE LA FLECHA --------------------------------------------------------

/**
 * Cuanto hay que recortar una flecha para que salga del BORDE de su caja y no del centro.
 *
 * `dirX`/`dirY` van EN UNIDADES DEL viewBox, donde X es % de ancho e Y ya viene multiplicada
 * por SY. Por eso `altoViewBox` tiene que llegar tambien en esas unidades: una caja de 4.47%
 * de alto son 4.47 * SY = 7.95 aqui. Pasar el 4.47 recortaria casi la mitad de lo que toca.
 *
 * LA FORMULA es la interseccion de un rayo desde el centro con el rectangulo:
 *     t = min( a / |cos T| , b / |sin T| )      a = ancho/2,  b = altoViewBox/2
 * Para una flecha horizontal manda `a`; para una vertical, `b`. Eso es lo que un recorte
 * isotropo no puede hacer: con el `k2 = 17` fijo de la referencia y una caja de 30 x 8, una
 * flecha casi vertical se recortaba mas de tres veces de mas y arrancaba en el aire. Medido
 * sobre una caja de 27.9 x 7.95: horizontal 14.55, diagonal 6.22, vertical 4.58.
 *
 * La guarda de los ceros no es ceremonia: una flecha exactamente vertical tiene cos = 0, y
 * `a / 0` es Infinity, que es la respuesta CORRECTA -- ese lado no limita -- mientras el otro
 * termino sea finito. `Math.min` se queda con el bueno.
 */
export function recorteCaja (
  dirX: number, dirY: number, ancho: number, altoViewBox: number, margen = 0.6
): number {
  const lg = Math.hypot(dirX, dirY);
  if (!Number.isFinite(lg) || lg === 0) return 0;
  const cos = Math.abs(dirX) / lg, sin = Math.abs(dirY) / lg;
  const tx = cos > 1e-6 ? (ancho / 2) / cos : Infinity;
  const ty = sin > 1e-6 ? (altoViewBox / 2) / sin : Infinity;
  const t = Math.min(tx, ty);
  return Number.isFinite(t) && t >= 0 ? t + margen : 0;
}

/** Como maximo se recorta esta fraccion de la cuerda. El resto es la flecha que se ve. */
export const FRACCION_MAXIMA_RECORTE = 0.85;

/**
 * Los dos recortes, GARANTIZANDO que quede flecha.
 *
 * La suite cubre 828 casos; esto cubre el 829. Dos cajas grandes y cercanas pueden sumar mas
 * recorte que cuerda, y entonces la arista sale de longitud cero o negativa: una flecha que no
 * existe, sin error y sin log. Cuando pasa se escalan LOS DOS proporcionalmente, que conserva
 * la asimetria -- la caja grande sigue recortando mas -- en vez de sacrificar un extremo.
 */
export function recortesArista (
  tA: number, tB: number, cuerda: number
): { tA: number; tB: number } {
  const a = Number.isFinite(tA) && tA > 0 ? tA : 0;
  const b = Number.isFinite(tB) && tB > 0 ? tB : 0;
  const tope = (Number.isFinite(cuerda) && cuerda > 0 ? cuerda : 0) * FRACCION_MAXIMA_RECORTE;
  if (a + b <= tope || a + b === 0) return { tA: a, tB: b };
  const k = tope / (a + b);
  return { tA: a * k, tB: b * k };
}

/**
 * Mete un layout dentro de la zona segura, a la fuerza.
 *
 * GARANTIZA, no comprueba. `separados` puede decir que no y `layoutSeguro` agotar sus 50
 * intentos; el repliegue tampoco esta obligado a caer dentro con cualquier `n`. Sin esto la
 * unica salvaguarda seria una comprobacion que ya fallo — y un nodo fuera de la zona NO da
 * error: sale en el video, medio tapado, y nadie se entera hasta verlo.
 *
 * El margen interior de 0.01 existe porque `separados` compara con desigualdades ESTRICTAS:
 * acotar exactamente a 13.54 dejaria `p.y > 13.54` en falso y el resultado no pasaria su
 * propia comprobacion.
 */
export function acotar (L: Layout): Layout {
  const dentro = (p: Punto): Punto => ({
    x: cl(p.x, ZONA.xMin + 0.01, ZONA.xMax - 0.01),
    y: cl(p.y, ZONA.yMin + 0.01, ZONA.yMax - 0.01)
  });
  return { ancla: dentro(L.ancla), pts: L.pts.map(dentro), aristas: L.aristas, curva: L.curva };
}

/**
 * Un layout legible, siempre.
 *
 * 50 intentos con la familia pedida y, si ninguno vale, REPLIEGUE a `capas`, que por
 * construccion reparte en dos filas y no puede solaparse consigo misma. El repliegue es lo que
 * convierte "casi siempre" en "siempre", y por eso no se simplifica.
 *
 * El `acotar` final es el cinturon: pase lo que pase, lo devuelto cae en la zona.
 */
export function layoutSeguro (
  rnd: () => number, familia: Familia, n: number, cajas: Caja[]
): Layout {
  n = nSeguro(n);
  for (let i = 0; i < 50; i++) {
    const L = LAYOUTS[familia](rnd, n);
    if (separados(L.pts, L.ancla, cajas)) return acotar(L);
  }
  // El `Math.min(n, 4)` viene de la referencia. Con sanearConceptos devolviendo exactamente 3
  // conceptos o null, `n` es SIEMPRE 3 y este min nunca recorta: RAMA MUERTA. Se porta para no
  // perderla si algun dia el numero de conceptos deja de ser fijo.
  return acotar(LAYOUTS.capas(rnd, Math.min(n, 4)));
}

// ── REPARTO DE RETARDOS ────────────────────────────────────────────────────────────

/**
 * Cuando entra cada concepto, en fraccion del ciclo.
 *
 * El orden de lectura cambia CUANDO entra cada nodo, no DONDE esta. Es variedad gratis: la
 * misma disposicion contada en tres ritmos distintos.
 *
 * Devuelve un array indexado por concepto —`retardos(...)[i]` es el retardo del concepto i—,
 * no un objeto: el orden posicional es lo que consume el paso 3.
 */
export function retardos (n: number, orden: Orden): number[] {
  let idx = [...Array(nSeguro(n))].map((_, i) => i);
  if (orden === 'inverso') idx = idx.reverse();
  else if (orden === 'alterno') {
    idx = idx.filter((_, i) => i % 2 === 0).concat(idx.filter((_, i) => i % 2 === 1));
  }
  const out = new Array<number>(idx.length);
  idx.forEach((k, pos) => { out[k] = 0.09 + pos * 0.055; });
  return out;
}

/** El retardo del ancla. Entra antes que ningun concepto: es de donde salen las aristas. */
export const RETARDO_ANCLA = 0.04;

/** El retardo de la arista i. Se escalonan para que el mapa se DIBUJE, no aparezca. */
export const retardoArista = (i: number): number => 0.12 + i * 0.04;

// ── LA RECETA COMPLETA ─────────────────────────────────────────────────────────────

export const TRANSICIONES: readonly Transicion[] = ['implosion', 'espiral', 'barrido'];
export const ORDENES: readonly Orden[] = ['secuencial', 'alterno', 'inverso'];

export type Receta = {
  familia: Familia;
  transicion: Transicion;
  paleta: Paleta;
  orden: Orden;
  n: number;
  layout: Layout;
  retardos: number[];
  angFondo: number;
  estrellas: number;
  escMalla: number;
  /** Describe el dibujo en una linea, para el log y la depuracion. */
  etiqueta: string;
};

/**
 * Todo lo que la semilla decide, en un solo sitio y sin pintar nada.
 *
 * LA SEMILLA SALE SOLO DE `value`. La referencia siembra con palabra + variante, pero la
 * variante es un control del laboratorio para ver alternativas de la misma palabra. En la app
 * no puede existir: `value` es lo unico que entra en la clave del hash, asi que sembrar con
 * algo mas daria dos dibujos distintos bajo el MISMO nombre de fichero y la cache devolveria
 * el primero diciendo ACIERTO.
 *
 * `n` se pasa y no se sortea. La referencia hace `Math.min(spec.nodos.length, ent(3,4))`; aqui
 * llega de `sanearConceptos`, que devuelve exactamente 3 o null.
 *
 * EL ORDEN DE LOS SORTEOS IMPORTA y no se puede reordenar sin cambiar todos los dibujos: cada
 * llamada a `rnd` avanza el generador, asi que mover una linea desplaza todo lo que viene
 * detras. Es el mismo motivo por el que la semilla no puede ser de modulo.
 */
export function receta (value: string, conceptos: readonly Concepto[]): Receta {
  const n = nSeguro(Array.isArray(conceptos) ? conceptos.length : 0);
  const rnd = generador(semillaDe(value));
  const familia = elige(rnd, FAMILIAS);
  const transicion = elige(rnd, TRANSICIONES);
  const paleta = elige(rnd, PALETAS);
  const orden = elige(rnd, ORDENES);
  const angFondo = ent(rnd, 150, 200);
  const estrellas = ent(rnd, 14, 30);
  const escMalla = 5 + rnd() * 2.6;
  // EL ORDEN DE LAS LLAMADAS A `rnd` NO CAMBIA por recibir los conceptos: este parametro no
  // consume sorteos, solo le dice a `layoutSeguro` cuanto miden las cajas. Lo que SI cambia es
  // CUANTOS intentos hace ese bucle, porque el umbral es otro -- y por eso los dibujos cambian
  // y hubo que subir VERSION_PLANTILLAS a 7. Verificado midiendo, no suponiendo: con los
  // umbrales viejos puestos a mano, esta `receta` da byte a byte lo mismo que la anterior.
  const cajas = cajasDe(
    (Array.isArray(conceptos) ? conceptos : []).map(c => (c && c.etiqueta) || ''), value);
  const layout = layoutSeguro(rnd, familia, n, cajas);
  return {
    familia, transicion, paleta, orden, n, layout,
    retardos: retardos(n, orden),
    angFondo, estrellas, escMalla,
    etiqueta: familia + ' · ' + transicion + ' · ' + n + ' nodos · ' + orden + ' · ' + paleta.a
  };
}
