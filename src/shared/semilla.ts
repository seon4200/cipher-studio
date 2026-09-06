// LA SEMILLA SALE DE PALABRA + POSICION ESTABLE.
//
// Con una sola composicion todos los Visuales de un video salen identicos y solo cambia el
// texto. Derivar la semilla de la palabra da a cada uno su propia disposicion —mismo estilo,
// distinta composicion— sin escribir ni una escena mas.
//
// La posicion no puede ser un indice global ni el instante: se conserva como
// `phraseIndex:clipIndexInPhrase` DENTRO de `extra`, que entra en la clave del MOV. Si la semilla
// saliera de algo que NO esta en la clave, dos Visuales con la misma palabra tendrian dibujos
// distintos y el MISMO hash, y la cache devolveria el primero diciendo ACIERTO.
//
// Dos "puentes" de sub-clips distintos no comparten escena por accidente; repetir la misma
// generacion si conserva exactamente su palabra y posicion.

/**
 * FNV-1a de 32 bits. Determinista, sin dependencias y con buena dispersion para cadenas
 * cortas, que es exactamente el caso: una palabra.
 *
 * Devuelve SIEMPRE un entero >= 1. El cero esta excluido a proposito: el generador de abajo es
 * multiplicativo y con estado 0 se queda clavado en 0 para siempre, produciendo la misma
 * "disposicion" degenerada en todos los Visuales cuya palabra cayera ahi.
 */
export function semillaDe(texto: unknown): number {
  const s = typeof texto === 'string' ? texto : String(texto ?? '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // imul: multiplicacion de 32 bits con desbordamiento, como haria C. Sin esto el numero
    // pasa de 2^53 y pierde bits bajos, que son justo los que dan la dispersion.
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 2147483646) + 1;
}

/**
 * Semilla estable de un Visual real.
 *
 * `pos` es `phraseIndex:clipIndexInPhrase`, no el indice global: insertar un clip antes no
 * resemilla el resto del video. Viaja en `extra` junto con este entero y por eso forma parte
 * de la misma clave de cache que describe los pixeles.
 */
export function semillaVisual(value: unknown, pos: unknown): number {
  return semillaDe(String(value ?? '') + '\u0000' + String(pos ?? '0:0'));
}

/**
 * El mismo generador congruencial que usan los ficheros de referencia (16807, Lehmer).
 *
 * Se devuelve una funcion con su propio estado en vez de una variable de modulo: dos
 * composiciones en la misma pagina no pueden pisarse la secuencia. En los laboratorios eso se
 * resolvia llamando a `semilla(n)` antes de cada escena, y olvidarlo hacia que añadir un
 * elemento a una escena cambiara TODAS las siguientes.
 */
export function generador(semilla: number): () => number {
  let s = Number.isFinite(semilla) ? Math.floor(Math.abs(semilla)) % 2147483647 : 1;
  if (s <= 0) s = 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Un real en [min,max). Con min>max se devuelven ordenados, no NaN. */
export function entre(rnd: () => number, min: number, max: number): number {
  const a = Math.min(min, max), b = Math.max(min, max);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return a + rnd() * (b - a);
}

/** Un entero en [min,max], los dos incluidos. */
export function entero(rnd: () => number, min: number, max: number): number {
  const a = Math.ceil(Math.min(min, max)), b = Math.floor(Math.max(min, max));
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return a + Math.floor(rnd() * (b - a + 1));
}
