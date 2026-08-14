// EL REPARTO DE CLIPS POR ORIGEN. Vive aqui, en UNA funcion, porque la aritmetica estaba
// DUPLICADA en dos sitios de main/index.ts —el total estimado y el total real— y añadir un
// origen en uno solo era el error facil de cometer y dificil de ver: el reparto salia distinto
// segun el sitio y nada lo decia.
//
// Sin dependencias a proposito: funciones puras que se pueden probar sin montar React ni abrir
// una ventana. Es la unica forma de barrer miles de combinaciones de pesos en una prueba.

export type Objetivos = { original: number; stock: number; ia: number; visual: number };

// Indices de `pesos`: [0] original, [1] stock, [2] IA, [3] Visuales.
const leer = (pesos: number[] | null | undefined, i: number): number => {
  const v = pesos ? pesos[i] : undefined;
  // DEFENSA, no migracion: evita que un array corto meta un undefined en una division y
  // propague NaN por todo el reparto. No pretende dar soporte a proyectos antiguos.
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};

/**
 * Cuantos clips de cada origen para un total dado.
 *
 * TRES pesos explicitos —stock, IA, Visuales— y `original` como RESIDUO. No es un descuido:
 * el algoritmo de rachas que corre despues gasta sus cortes hasta agotarlos y su comentario
 * dice "los conteos son exactos". Con cuatro Math.round independientes la suma podria salir
 * total±2 y ese reparto fallaria en silencio. Un residuo garantiza el cuadre por construccion.
 *
 * `original` puede ser 0 y puede ser todo: el usuario elige. Lo que NO puede es ser negativo.
 */
export function repartoObjetivos(pesos: number[] | null | undefined, total: number): Objetivos {
  const t = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  if (t === 0) return { original: 0, stock: 0, ia: 0, visual: 0 };

  let ia = Math.round((leer(pesos, 2) / 100) * t);
  let stock = Math.round((leer(pesos, 1) / 100) * t);
  let visual = Math.round((leer(pesos, 3) / 100) * t);

  // Reescalado a TRES terminos. El anterior solo contemplaba dos, asi que con un tercero
  // `original` podia salir NEGATIVO — y eso no lanza nada: produce un reparto imposible que se
  // descubre mucho despues, o no se descubre.
  //
  // El ORDEN importa y no es arbitrario: se truncan `ia` y `visual`, y `stock` se lleva el
  // resto. Asi, con visual = 0, esto da EXACTAMENTE lo mismo que la formula de antes, que
  // truncaba ia y daba el resto a stock. Repartir el resto de otra forma cambiaria el montaje
  // de los proyectos que no usan Visuales.
  const suma = ia + stock + visual;
  if (suma > t) {
    ia = Math.floor((ia / suma) * t);
    visual = Math.floor((visual / suma) * t);
    stock = t - ia - visual;
  }

  return { original: t - ia - stock - visual, stock, ia, visual };
}

/**
 * Mueve un peso y reparte la diferencia entre los otros, manteniendo la suma en 100.
 *
 * Pura y exportada para poder probar "suma 100 siempre" sin montar React: el manejador del
 * slider solo la envuelve con setState.
 */
export const PESOS_POR_DEFECTO: number[] = [40, 30, 30, 0];

/**
 * Deja SIEMPRE cuatro numeros finitos. Es la defensa que faltaba, y no es teorica: un proyecto
 * guardado antes de que existiera el cuarto peso trae TRES posiciones, y mover el slider de
 * Visuales hacia el indice 3 hacia `nuevo - undefined` = NaN, que contaminaba los cuatro pesos
 * y se guardaba como [null,null,null,null]. Tres proyectos reales acabaron asi.
 *
 * `null` cuenta como NO numerico a proposito: es lo que JSON.stringify escribe para un NaN, o
 * sea lo que hay en los proyectos ya corrompidos. Sin eso no se recuperarian solos y habria que
 * borrarlos.
 *
 * Si no queda ni un valor utilizable se cae al reparto por defecto; si quedan algunos, los que
 * falten van a 0 —que es lo correcto para un proyecto de tres pesos: Visuales no estaba y su
 * peso era cero—.
 */
export function normalizarPesos(pesos: unknown): number[] {
  const entrada = Array.isArray(pesos) ? pesos : [];
  const util = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  if (!entrada.some(util)) return [...PESOS_POR_DEFECTO];
  const r = [0, 1, 2, 3].map(i => (util(entrada[i]) ? entrada[i] as number : 0));
  return r;
}

export function repartirPesos(pesos: number[], index: number, nuevo: number): number[] {
  // Se normaliza a la ENTRADA, no en los llamadores: asi ninguno puede olvidarse. Es el mismo
  // criterio del `?? 0` de repartoObjetivos, que es la razon de que el backend nunca diera NaN
  // mientras el frontend si.
  const r = normalizarPesos(pesos);
  // Un indice fuera de rango o un valor no numerico —parseInt("") da NaN— no cambian nada, en
  // vez de propagar basura. Devolver los pesos normalizados sigue siendo una mejora: repara el
  // array aunque el movimiento se ignore.
  if (!Number.isInteger(index) || index < 0 || index >= r.length) return r;
  if (!Number.isFinite(nuevo)) return r;

  const diff = nuevo - r[index];
  r[index] = nuevo;

  // Los indices se enumeran a partir de la longitud del array y NO se escriben a mano: con
  // [0,1,2] escrito a mano, añadir un slider al JSX y olvidar esta linea dejaria el nuevo
  // fuera del reparto y la suma dejaria de ser 100 sin que nada avisara. Ya paso una vez.
  const otros = r.map((_, i) => i).filter(i => i !== index);
  const sumaOtros = otros.reduce((s, i) => s + r[i], 0);

  // Proporcional al valor actual de cada uno, y el ULTIMO se lleva el RESTO en vez de su parte
  // redondeada: asi los redondeos de los anteriores no se pierden. Con tres repartidores el
  // error acumulado puede llegar a 2 puntos, uno mas que con dos.
  let resto = diff;
  otros.forEach((i, k) => {
    const parte = sumaOtros > 0
      ? Math.round((r[i] / sumaOtros) * diff)
      : Math.round(diff / otros.length);
    const quitar = k === otros.length - 1 ? resto : parte;
    r[i] = Math.max(0, r[i] - quitar);
    resto -= quitar;
  });

  // La red de seguridad. Hace falta porque el Math.max(0, ...) de arriba puede COMER parte del
  // ajuste: si a un peso se le quitan 5 y solo tiene 3, se queda en 0 y los 2 restantes no se
  // han restado de ningun sitio. Se busca un indice que pueda absorberlo SIN bajar de cero, no
  // el primero que haya — con el primero, la suma podia quedarse sin cuadrar.
  const suma = r.reduce((a, b) => a + b, 0);
  if (suma !== 100) {
    const ajuste = 100 - suma;
    const donde = otros.find(i => r[i] + ajuste >= 0);
    if (donde !== undefined) r[donde] = r[donde] + ajuste;
    else r[index] = Math.max(0, r[index] + ajuste);
  }

  return r;
}
