// ESCENA — la composicion GENERICA: combina piezas de vocabularios cerrados en vez de ser una
// escena escrita a mano. AQUI SOLO HAY ARITMETICA: ni JSX, ni document, ni <style>. Mismo motivo
// que shared/mapa.ts: probarla entera sin montar React ni abrir una ventana.
//
// ESTE PASO (FASE 1, el esqueleto) declara UNA SOLA PIEZA POR EJE, a proposito. El objetivo no
// es que se vea bien: es que el MECANISMO funcione -- que los ejes MULTIPLIQUEN en vez de sumar
// escenas enteras a mano, como hace mapa. Cuando la Fase 7 amplie cada vocabulario a varias
// piezas, este fichero es el UNICO sitio que crece.
//
// mapa.ts NO SE TOCA, y esta es una composicion nueva y paralela, no un reemplazo. Lo UNICO que
// se le toma prestado es `acotar()`, que es una garantia de zona segura ya medida y probada: no
// se reescribe una segunda version de algo asi.

import { generador, entre } from './semilla';
import { acotar, anchoCaja, cl, type Layout, type Punto } from './mapa';

const TAU = 6.283185307;

// ── VOCABULARIOS CERRADOS ────────────────────────────────────────────────────────────
//
// Union + array, igual que Familia/FAMILIAS en shared/mapa.ts. Hoy cada array tiene UN
// elemento a proposito. Anadir una pieza en la Fase 7 es anadir una linea en el tipo, una en
// el array, y una rama en el switch que la dibuja en composiciones/escena.tsx. Nada mas.
//
// ═══ SI AMPLIAS CUALQUIERA DE ESTOS VOCABULARIOS, SUBE VERSION_PLANTILLAS EN main/index.ts ═══
// `direccionDe` sortea con `elige(rnd, ARRAY)`: anadir un elemento cambia que indice le toca a
// una semilla que YA tenia una direccion asignada. Sin subir la version, la cache devolveria el
// .mp4 viejo pensando que la clave -- que solo depende de `value` -- sigue describiendolo.

export type Fondo = 'ondas';
export const FONDOS: readonly Fondo[] = ['ondas'];

export type Estructura = 'constelacion';
export const ESTRUCTURAS: readonly Estructura[] = ['constelacion'];

export type Camara = 'deriva';
export const CAMARAS: readonly Camara[] = ['deriva'];

/** Por nombre y no por numero: vocabulario cerrado, no un slider. */
export type Densidad = 'media';
export const DENSIDADES: readonly Densidad[] = ['media'];

/**
 * Cuantos decoradores por densidad.
 *
 * ⚠️ HOY LA DENSIDAD ESTA FIJA EN 'media', Y ESO ES DE LA FASE 1, NO EL DESTINO.
 *
 * `direccionDe` la "sortea" de un array de un solo elemento, asi que sale 'media' siempre. Es
 * correcto para este paso -- lo que se prueba es el mecanismo, no la variedad-- pero LA FASE 5
 * ES LA QUE TIENE QUE DERIVARLA DEL CONTENIDO: una frase densa pide mas elementos que una
 * frase de una sola idea, y esa decision no puede quedarse en 'media' por olvido.
 *
 * Quien llegue a la Fase 5 y vea esto: el cambio es que `densidad` deje de venir de
 * `direccionDe` y venga del analisis del texto. No hace falta tocar nada mas de este fichero.
 */
export const DENSIDAD_A_N: Record<Densidad, number> = { media: 5 };

export type Ritmo = 'regular';
export const RITMOS: readonly Ritmo[] = ['regular'];

// ── LA DIRECCION ──────────────────────────────────────────────────────────────────────
//
// Un objeto PLANO, serializable a JSON sin perder nada: es literalmente la forma que tendra
// `extra.direccion` en la Fase 7. Por eso ningun campo es una funcion ni una referencia --
// solo los nombres de las piezas elegidas.
export type Direccion = {
  fondo: Fondo;
  estructura: Estructura;
  camara: Camara;
  densidad: Densidad;
  ritmo: Ritmo;
};

/** Un elemento de la lista. Nunca undefined. Copia deliberada de `elige` en shared/mapa.ts:
 *  tres lineas, y duplicarlas es mas barato que acoplar los dos ficheros por una funcion. */
function elige<X>(rnd: () => number, a: readonly X[]): X {
  return a[Math.floor(rnd() * a.length)] ?? a[0];
}

/**
 * TODO LO QUE LA SEMILLA DECIDE, en un solo sitio y sin pintar nada -- el mismo contrato que
 * `receta()` en shared/mapa.ts.
 *
 * LA FIRMA ES LA DEFINITIVA, no la de este paso. Hoy es la UNICA fuente: cada vocabulario tiene
 * una pieza y el sorteo no tiene entre que elegir. En la Fase 7 la IA rellenara
 * `extra.direccion` con esta MISMA forma -- fondo, estructura, camara, densidad, ritmo -- y
 * `direccionDe` pasa a ser el RESPALDO para cuando `extra.direccion` no llegue o no sea valido,
 * el mismo papel que ya cumple `formaDe(semilla)` en extrusion.tsx. Nada de lo que lee esta
 * funcion cambia entonces; cambia SOLO quien la llama, en composiciones/escena.tsx.
 *
 * EL ORDEN DE LOS SORTEOS IMPORTA, igual que en `receta()`: fondo, estructura, camara,
 * densidad, ritmo, en ese orden fijo.
 */
export function direccionDe(semilla: number): Direccion {
  const rnd = generador(semilla);
  return {
    fondo: elige(rnd, FONDOS),
    estructura: elige(rnd, ESTRUCTURAS),
    camara: elige(rnd, CAMARAS),
    densidad: elige(rnd, DENSIDADES),
    ritmo: elige(rnd, RITMOS)
  };
}

// ── LAS CUATRO CAPAS Y SU PROFUNDIDAD ────────────────────────────────────────────────
//
// El factor de parallax de cada capa: 1 = se mueve TANTO como la camara pide, 0 = quieta.
// Vive aqui y no en composiciones/escena.tsx porque es un numero, no JSX.
export const PROFUNDIDAD = {
  fondo: 1.00,
  estructura: 0.50,
  decoradores: 0.55,
  texto: 0.20
} as const;

// ── LA ZONA SEGURA EN X, la constante de la que cuelga todo lo demas ──────────────────
//
// La zona segura son 900x1400 centrados en 1080x1920, asi que a los lados quedan
// (1080-900)/2/1080 = 8.33 %. NO es una preferencia: es la misma aritmetica que documenta
// ZONA en shared/mapa.ts, y de aqui salen los DOS topes -- el del pie y el de la etiqueta --
// para que no puedan decir cosas distintas.
export const ZONA_X_MIN = 8.33;
export const ZONA_X_MAX = 91.67;
export const ZONA_ANCHO_UTIL = ZONA_X_MAX - ZONA_X_MIN;

// ── EL PIE: CUANTO TEXTO CABE, Y DE DONDE SALE EL NUMERO ─────────────────────────────
//
// El pie NO encoge la letra y NO trunca: un Visual con letra pequeña deja de ser un Visual
// (misma regla que documenta shared/texto.ts) y truncar inventa una palabra que no se dijo.
//
// En vez de eso PARTE EN DOS LINEAS, y las dos lineas estan PRESUPUESTADAS en el encuadre
// desde el principio -- no son una excepcion que aparece con las palabras largas. Lo que no
// cabe en dos lineas hace que `puedeDibujar` devuelva false y entre el respaldo que ya existe,
// que es el patron del proyecto: cuando falta sitio se cae a algo que si funciona.
//
// LOS NUMEROS, y son un ESTIMADOR, no una medida del DOM como la recta de `anchoCaja`:
//   ancho util   100 - 8.33*2 = 83.34 % del ancho (la zona segura a los lados)
//   fuente       9 cqmin, la de `.es-pie-tit`
//   em/caracter  0.58, Archivo 800 -- del mismo orden que la pendiente medida de mapa
// => 83.34 / (9 * 0.58) = 15.97 caracteres por linea, y con dos lineas 31.93.
//
// SI SE CAMBIA EL TAMAÑO DE LA FUENTE DEL PIE HAY QUE REHACER ESTA CUENTA, y por eso los tres
// numeros estan aqui y no dentro de una constante ya resuelta.
export const PIE_ANCHO_UTIL = ZONA_ANCHO_UTIL;
export const PIE_FUENTE_CQMIN = 9;
export const PIE_EM_POR_CARACTER = 0.58;
export const PIE_LINEAS = 2;

/** Caracteres que caben en UNA linea del pie. */
export const PIE_CARACTERES_POR_LINEA = PIE_ANCHO_UTIL / (PIE_FUENTE_CQMIN * PIE_EM_POR_CARACTER);

/** El tope: lo que cabe en las dos lineas presupuestadas. Por encima, `puedeDibujar` dice no. */
export const MAX_CARACTERES_PIE = Math.floor(PIE_LINEAS * PIE_CARACTERES_POR_LINEA);

/** ¿Cabe este texto en el pie sin encoger ni truncar? */
export function cabeEnElPie(texto: unknown): boolean {
  const s = String(texto ?? '').trim();
  return s.length > 0 && s.length <= MAX_CARACTERES_PIE;
}

// ── EL TOPE DE LA ETIQUETA DE UN CONCEPTO ────────────────────────────────────────────
//
// Simetrico al del pie y por el mismo motivo: lo que no cabe no se encoge ni se trunca, se
// cae al respaldo. La diferencia es el modelo de ancho -- el pie es texto suelto y se estima
// por caracteres; una caja de concepto tiene su ancho MEDIDO en el DOM real, y esa medida ya
// vive en `anchoCaja` de shared/mapa.ts.
//
// SE DERIVA DE LA PROPIA FUNCION MEDIDA, no de copiar sus dos constantes: el dia que alguien
// vuelva a medir la caja -- y el comentario de mapa.ts dice que HAY que remedirla si cambia la
// fuente -- este tope se mueve solo. Copiar 12.18 y 1.257 aqui los dejaria desincronizados en
// silencio, que es el patron de las dos puertas.
//
// La condicion es la del caso (b): si NI SIQUIERA CENTRADA la caja cabe en la zona, no hay
// posicion que la salve.
export const MAX_CARACTERES_ETIQUETA = (() => {
  // OJO: `anchoCaja` recibe LA ETIQUETA, no su longitud -- mide `String(etiqueta).length` por
  // dentro. Pasarle el numero `c + 1` medía `String(57).length` = 2 caracteres, el ancho salia
  // siempre 14.7 % y el bucle llegaba a la guarda de 500: el tope quedaba en 500 y la puerta no
  // se disparaba nunca. No fallaba nada; lo cazo el render, con una etiqueta de 60 caracteres
  // dibujandose y saliendose del cuadro. Se le pasa una CADENA de la longitud que se prueba.
  let c = 0;
  while (c < 500 && anchoCaja('x'.repeat(c + 1), true) <= ZONA_ANCHO_UTIL) c++;
  return c;
})();

/** ¿Cabe esta etiqueta en la zona segura, aunque haya que centrarla? */
export function cabeLaEtiqueta(etiqueta: unknown): boolean {
  return String(etiqueta ?? '').length <= MAX_CARACTERES_ETIQUETA;
}

// ── CAMARA: LA FUNCION DE MUESTREO, PURA ─────────────────────────────────────────────
//
// Recibe `u` (0..1) y `f` (el factor de PROFUNDIDAD de la capa que la usa) y devuelve la
// declaracion CSS `transform`. NO llama a `kf`: `kf` vive en composiciones/escena.tsx porque
// necesita el emisor de @keyframes, que es estado por-render. Esta funcion es la pieza que
// `kf` muestrea -- exactamente como `LAYOUTS.radial` en shared/mapa.ts es la pieza que
// `nodo()` anima en composiciones/mapa.tsx. MISMO PATRON, verificado contra el precedente.
//
// Portada de docs/motion/lab-camara.html (CAMARAS.deriva), `cqw` -> `cqmin`: en 9:16 dan el
// mismo numero -- el ancho ya es el menor -- pero en 16:9 `cqmin` escala con el ALTO, que es
// la dimension que manda cuando el marco es mas ancho que alto.
export function camaraDeriva(u: number, f: number): string {
  const x = Math.sin(u * TAU) * 3.2 * f;
  const y = Math.cos(u * TAU) * 2.0 * f;
  const s = 1 + 0.04 * f;
  return `transform:translate(${x.toFixed(3)}cqmin,${y.toFixed(3)}cqmin) scale(${s.toFixed(4)})`;
}

// ── FONDO: LOS ANILLOS Y SU DESFASE ──────────────────────────────────────────────────
//
// TRES anillos, y cada uno con su PROPIA fase. Con una sola animacion compartida los tres
// respiran a la vez y el ojo los lee como UN objeto que late, no como tres: la profundidad se
// pierde entera y no falla nada. El desfase se reparte por el ciclo completo.
//
// La fase solo DESPLAZA el muestreo dentro de `u`, asi que los tres siguen durando un ciclo
// exacto y el bucle sigue cerrando: no toca la regla del ciclo.
export const ANILLOS_FONDO = 3;

/** La fase del anillo `i`, en fraccion de ciclo (0..1). Repartida uniformemente. */
export function faseAnillo(i: number, total: number = ANILLOS_FONDO): number {
  const n = Math.max(1, Math.floor(total));
  return (((Math.floor(i) % n) + n) % n) / n;
}

// ── ESTRUCTURA: CONSTELACION, LA GEOMETRIA PURA ──────────────────────────────────────
//
// Tres puntos alrededor de un ancla -- la RANURA DEL HEROE.
//
// NO se porta la maquinaria de `separados`/`layoutSeguro` de shared/mapa.ts: con EXACTAMENTE
// tres puntos sobre posiciones fijas y jitter pequeno, dos cajas no pueden solaparse. Esa
// justificacion vale para el SOLAPE ENTRE NODOS y solo para eso.
//
// LO QUE SI SE PORTA ES `acotar()`, que es otra cosa: la garantia de que ningun centro se sale
// de la zona. No comprueba, GARANTIZA -- y un nodo fuera de zona no da error, sale en el video
// medio tapado por la interfaz de la plataforma y nadie se entera hasta verlo.
//
// SIMPLIFICACION DELIBERADA: sin la correccion SY (16/9) que usa mapa.ts para que las aristas
// salgan rectas en un marco no cuadrado. Aceptable para probar el mecanismo; si "constelacion"
// crece en exigencia visual, portar esa correccion es el primer paso, no un rediseño.
export type PuntoEscena = Punto;
export type Constelacion = { ancla: PuntoEscena; pts: PuntoEscena[] };

/** Siempre tres puntos: `puedeDibujar` en composiciones/escena.tsx exige al menos eso antes de
 *  llamar aqui -- la misma puerta que usa `mapa` con `CUANTOS_CONCEPTOS`. */
export function constelacionDe(rnd: () => number, etiquetas: readonly string[] = []): Constelacion {
  const cx = 50, cy = 45; // mismo foco visual que documenta FOCO en shared/mapa.ts (y = 45)
  const base: PuntoEscena[] = [
    { x: 28, y: 30 }, { x: 72, y: 32 }, { x: 50, y: 70 }
  ];
  const pts = base.map((p, i) => {
    // EL ORDEN DE LAS LLAMADAS A `rnd` NO CAMBIA: primero la x, luego la y, igual que antes.
    // Mover una sola desplazaria todos los sorteos siguientes y cambiaria TODOS los dibujos.
    const x0 = p.x + entre(rnd, -3, 3);
    const y0 = p.y + entre(rnd, -2.5, 2.5);
    // EL ACOTADO POR EL BORDE DE LA CAJA, y no por su centro.
    //
    // `acotar()` -- que sigue abajo como cinturon -- acota CENTROS a ZONA. Eso no basta: lo
    // que se sale de la zona segura es el BORDE, que esta a `centro +- semiancho`, y con una
    // etiqueta de 17 caracteres el borde derecho llegaba a 91.8 con el centro en 75, dentro.
    // Medido antes de arreglarlo.
    const semi = anchoCaja(etiquetas[i] ?? '', true) / 2;
    const lo = ZONA_X_MIN + semi;
    const hi = ZONA_X_MAX - semi;
    // (a) EL INTERVALO PUEDE QUEDAR VACIO: una caja mas ancha que la zona entera no tiene
    // ninguna posicion valida, y `cl(v, lo, hi)` con lo > hi devuelve `hi`, que es peor que
    // no hacer nada -- pegaria la caja al borde izquierdo. Centrada es lo menos malo, y
    // `MAX_CARACTERES_ETIQUETA` hace que este caso no llegue a pintarse: `puedeDibujar` ya
    // habra dicho que no. Esto es el cinturon del cinturon.
    const x = lo <= hi ? cl(x0, lo, hi) : 50;
    return { x, y: y0 };
  });
  // `acotar` trabaja sobre un Layout completo. Las aristas y la curva no le importan -- solo
  // toca `ancla` y `pts` -- asi que se le pasa la forma minima y se recogen los dos que usa.
  const L: Layout = { ancla: { x: cx, y: cy }, pts, aristas: [], curva: 0 };
  const seguro = acotar(L);
  return { ancla: seguro.ancla, pts: seguro.pts };
}

// ── DECORADORES: LA CUENTA Y EL RITMO, PUROS ─────────────────────────────────────────
//
// `densidad` decide CUANTOS y `ritmo` decide CUANDO entra cada uno. Sin vocabulario propio de
// FORMA en este paso: son particulas neutras, no emoji -- para no inventar un eje que nadie
// pidio todavia. Densidad y ritmo son justamente los dos ejes que este paso tiene que probar.
export function retardosDecoradores(n: number, ritmo: Ritmo): number[] {
  const total = Math.max(0, Math.floor(n));
  switch (ritmo) {
    // 'regular' es el UNICO ritmo hoy: reparto lineal, cada decorador en su turno exacto. El
    // switch de una rama es el precio de tener la firma lista para cuando deje de serlo.
    case 'regular':
    default:
      return [...Array(total)].map((_, i) => 0.10 + (i / Math.max(1, total)) * 0.55);
  }
}

export function posicionDecorador(rnd: () => number): PuntoEscena {
  const a = rnd() * TAU;
  const r = entre(rnd, 22, 34);
  return { x: 50 + Math.cos(a) * r, y: 45 + Math.sin(a) * r * 0.56 };
}
