// EL CANDADO DEL CICLO.
//
// Regla 1 del manual de motion: toda duracion de una animacion debe dividir el ciclo un numero
// ENTERO de veces. Si no, el ultimo frame no empata con el primero y el corte del bucle se ve.
//
// Y el ciclo NO es un numero fijo: es la duracion del Visual, o sea la de su sub-clip. La
// mediana medida son 2.6 s. Por eso un `animation-duration: 1.5s` escrito a mano es CORRECTO
// para un ciclo de 3 s y FALSO para uno de 2.6 s — y el fallo es silencioso: el video sale, el
// bucle salta, y nada lo dice.
//
// Este fichero existe para que esa regla no viva en un comentario. Es puro a proposito: sin
// React, sin DOM y sin Electron, para que la suite pueda ejercitarlo entero.

/** Coma flotante: 2.6/2*2 no da exactamente 2.6. Se compara con holgura, no con ===. */
export const TOLERANCIA_S = 1e-9;

/** Un ciclo sirve si es un numero finito y positivo. Todo lo demas no es un ciclo. */
export function cicloValido(ciclo: unknown): boolean {
  return typeof ciclo === 'number' && Number.isFinite(ciclo) && ciclo > 0;
}

/**
 * La forma CORRECTA de escribir una duracion: una fraccion del ciclo.
 *
 * `fraccion(ciclo, 2)` es legal para CUALQUIER ciclo, por construccion. Escribir `1.5` no lo es
 * para ninguno en particular. Todo `animation-duration` de una composicion deberia salir de
 * aqui y no de un literal.
 */
export function fraccion(ciclo: number, n: number): number {
  if (!cicloValido(ciclo)) return 0;
  if (!Number.isFinite(n) || n < 1) return ciclo;
  return ciclo / Math.round(n);
}

/** ¿`d` divide el ciclo un numero entero de veces? */
export function esLegal(ciclo: number, d: number): boolean {
  if (!cicloValido(ciclo)) return false;
  if (!Number.isFinite(d) || d <= 0) return false;
  if (d > ciclo + TOLERANCIA_S) return false;
  const n = ciclo / d;
  return Math.abs(n - Math.round(n)) < 1e-6;
}

/**
 * EL CANDADO QUE CORRIGE. Devuelve SIEMPRE una duracion legal.
 *
 * Avisar no basta: un aviso que nadie mira deja el bucle saltando igual. Esto acota al divisor
 * mas cercano, asi que **por construccion el bucle no puede saltar**, y ademas dice que hizo
 * para que el literal se arregle en el codigo en vez de quedarse ahi para siempre.
 *
 * No lanza. Lanzar mataria el render del grafico, y el pipeline trata un render fallido como
 * "sin MOV": el Visual desapareceria del video sin decir nada. Cambiar un bucle que salta por
 * un Visual que no aparece no es una mejora.
 */
export function ajustar(ciclo: number, que: string, d: number): { d: number; aviso: string | null } {
  if (!cicloValido(ciclo)) {
    return { d: 0, aviso: `"${que}": ciclo invalido (${ciclo}), no hay duracion que valga` };
  }
  if (!Number.isFinite(d) || d <= 0) {
    return { d: ciclo, aviso: `"${que}" pidio ${d}, que no es una duracion: se usa el ciclo entero (${ciclo}s)` };
  }
  if (esLegal(ciclo, d)) return { d, aviso: null };
  // El divisor entero mas cercano. Nunca menor que 1: una duracion mayor que el ciclo se acota
  // al ciclo entero, que es lo mas parecido que existe.
  const n = Math.max(1, Math.round(ciclo / d));
  const corregida = ciclo / n;
  return {
    d: corregida,
    aviso: `"${que}" pidio ${d}s con ciclo ${ciclo}s: no lo divide entero ` +
      `(${(ciclo / d).toFixed(4)} veces). CORREGIDO a ${corregida.toFixed(4)}s ` +
      `= fraccion(ciclo, ${n}). Arreglalo en el codigo: usa fraccion(), no un literal.`
  };
}

/**
 * Las duraciones legales de un ciclo, de la mas larga a la mas corta.
 *
 * `maxDivisor` acota la lista, no la regla: ciclo/50 tambien es legal, pero una lista infinita
 * no sirve para elegir. 8 cubre las tres escalas de tiempo que usan los laboratorios —el ciclo
 * entero, la mitad y un sexto— con margen.
 */
export function divisoresDe(ciclo: number, maxDivisor = 8): number[] {
  if (!cicloValido(ciclo)) return [];
  const tope = Math.max(1, Math.round(maxDivisor));
  const out: number[] = [];
  for (let n = 1; n <= tope; n++) out.push(ciclo / n);
  return out;
}

export type DuracionUsada = { que: string; d: number };

/**
 * Comprueba una lista de duraciones contra el ciclo y devuelve los avisos en TEXTO.
 *
 * Devuelve texto y no lanza a proposito. Lanzar mataria el render del grafico, y el pipeline
 * trata un render fallido como "sin MOV": el Visual desapareceria del video sin decir nada.
 * Cambiar un salto de bucle silencioso por un Visual ausente silencioso no es una mejora.
 *
 * Quien llame decide que hacer con los avisos. En el render van al log del proceso principal,
 * que es el unico sitio que alguien lee: la ventana de graficos es offscreen y su consola no la
 * abre nadie — medido, un console.log puesto ahi para diagnosticar nunca llego a
 * generation-debug.log.
 */
export function comprobarCiclo(ciclo: number, usadas: DuracionUsada[]): string[] {
  if (!cicloValido(ciclo)) return [`ciclo invalido: ${ciclo}`];
  if (!Array.isArray(usadas)) return [];
  const avisos: string[] = [];
  for (const u of usadas) {
    if (!u) { avisos.push('una entrada de la lista de duraciones es nula'); continue; }
    const r = ajustar(ciclo, u.que, u.d);
    if (r.aviso) avisos.push(r.aviso);
  }
  return avisos;
}
