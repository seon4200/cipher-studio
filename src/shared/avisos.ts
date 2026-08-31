// LOS AVISOS: eventos TIPADOS, no lineas de log.
//
// EL CASO QUE JUSTIFICA ESTE FICHERO. El 25/8 DeepSeek fallo cinco veces por saldo agotado, se
// perdieron 21 clips de stock y 10 Visuales, y la app dijo "exito, 78 de 78". Media hora de
// video degradada en silencio y el log en verde. El log DECIA lo que pasaba -- cinco lineas de
// `DeepSeek HTTP 402` -- pero nadie lee un fichero de 15 MB, y `logMessage` solo escribe a
// disco: no emite nada hacia la ventana.
//
// LO QUE HACE FALTA NO ES EL LOG, SON AVISOS. Volcar el fichero entero a la interfaz seria
// inutil y caro. Un aviso es un evento con codigo estable, severidad y contador, que se puede
// agregar, contar y buscar.
//
// ── LAS TRES REGLAS QUE ESTE FICHERO EXISTE PARA CUMPLIR ────────────────────────────────────
//
//  1. AGREGACION. El mismo codigo 200 veces es UNA linea con un contador, no 200 mensajes. Sin
//     esto la fase EMPEORA la app: enterrar el 402 bajo doscientas lineas es otra forma de
//     esconderlo.
//  2. INDEPENDENCIA DE LA COLA DEL LOG. `writeDebugLog` es asincrono y va en cola -- medido:
//     leyendo el log justo despues de un lote se recogian 2 de 3 tiradas porque la ultima no
//     habia bajado a disco. Un aviso NO puede depender de esa cola: se acumula en memoria, de
//     forma sincrona, y si el log se atasca o se pierde el aviso llega igual.
//  3. AQUI NO SE PINTA NADA Y NO SE ENVIA NADA. Este modulo es puro: sin Electron, sin React,
//     sin fs. Asi la suite puede ejercitarlo entero, que es lo que hace utiles a reparto.ts,
//     exclusion.ts y ciclo.ts.

export type Severidad = 'error' | 'aviso' | 'info';

/**
 * UN AVISO YA AGREGADO.
 *
 * `codigo` es ESTABLE y no una frase: es lo que permite agrupar, contar y buscar en el log seis
 * meses despues. `mensaje` es lo contrario -- una frase para el usuario, en castellano y sin
 * jerga -- y puede reescribirse sin romper nada. Separarlos es lo que evita que "arreglar la
 * redaccion" rompa la agregacion.
 */
export type Aviso = {
  severidad: Severidad;
  codigo: string;
  /** Quien lo produjo: 'deepseek', 'pexels', 'reparto', 'lote', 'render'... */
  origen: string;
  mensaje: string;
  detalle?: string;
  veces: number;
};

/**
 * LA CLAVE DE AGREGACION ES `origen|codigo`, NO SOLO EL CODIGO.
 *
 * Un 402 de DeepSeek y un 402 de Pexels son dos problemas distintos con dos arreglos distintos,
 * y juntarlos en una linea perderia justo la informacion que hace falta para actuar. Agrupar
 * solo por codigo seria mas simple y diria menos.
 */
const claveDe = (origen: string, codigo: string): string => origen + '|' + codigo;

export type Coleccion = {
  /** Anade un aviso. Si su `origen|codigo` ya existe, SUMA al contador. Devuelve si es NUEVO. */
  anadir: (a: Omit<Aviso, 'veces'>, veces?: number) => boolean;
  /** Los avisos agregados, los errores primero. Copia: nadie de fuera muta el estado. */
  lista: () => Aviso[];
  /** Cuantos avisos distintos hay. */
  cuantos: () => number;
  /** Vacia la coleccion. */
  limpiar: () => void;
};

/**
 * Una coleccion de avisos con agregacion.
 *
 * SE LIMPIA AL EMPEZAR CADA GENERACION, y el razonamiento ya esta escrito y justificado en
 * `anunciarExclusion` (renderer/src/main.tsx): "un aviso viejo colgado de una generacion previa
 * miente igual que no avisar". Es la misma regla y no se reinventa.
 *
 * EL PRIMER MENSAJE GANA. Si el mismo codigo llega con textos distintos, se conserva el primero
 * y solo sube el contador: el primero suele ser el informativo y los siguientes son repeticiones
 * del mismo fallo. Sobrescribir haria que el texto cambiara bajo los pies del usuario mientras
 * mira la pantalla.
 */
export function coleccionDeAvisos(): Coleccion {
  const porClave = new Map<string, Aviso>();

  const anadir = (a: Omit<Aviso, 'veces'>, veces = 1): boolean => {
    const n = Number.isFinite(veces) && veces > 0 ? Math.floor(veces) : 1;
    const k = claveDe(a.origen, a.codigo);
    const ya = porClave.get(k);
    if (ya) { ya.veces += n; return false; }
    porClave.set(k, { ...a, veces: n });
    return true;
  };

  // Los errores primero, luego avisos, luego info. Dentro de cada grupo, por orden de aparicion:
  // el orden en que ocurrieron es informacion, y reordenar por contador la perderia.
  const PESO: Record<Severidad, number> = { error: 0, aviso: 1, info: 2 };
  const lista = (): Aviso[] =>
    [...porClave.values()].map(a => ({ ...a }))
      .sort((x, y) => PESO[x.severidad] - PESO[y.severidad]);

  return { anadir, lista, cuantos: () => porClave.size, limpiar: () => porClave.clear() };
}

// ── EL RESUMEN: OBJETIVO CONTRA REAL, POR ORIGEN ────────────────────────────────────────────
//
// Es lo que habria cazado el 25/8. La app dijo "78 de 78" y era verdad: salieron 78 clips. Lo
// que no dijo es que 21 de stock y 10 Visuales se habian convertido en 'original' por el camino.
// El total cuadraba y el CONTENIDO no.

export type FilaResumen = {
  origen: string;
  /** Lo que el reparto pidio. */
  objetivo: number;
  /** Lo que salio de verdad. */
  real: number;
};

export type MotivoRespaldo = { motivo: string; descripcion: string; veces: number };

export type Resumen = {
  total: number;
  filas: FilaResumen[];
  /** Los clips que cayeron a otro origen, desglosados POR MOTIVO. */
  respaldo: MotivoRespaldo[];
  /**
   * ¿Llego la generacion al final?
   *
   * LO CAZO LA PRUEBA DE ACEPTACION: con el resumen en un `finally`, una generacion que aborta
   * ANTES de decidir nada produce cero clips en todas las filas... y "0 pedidos, 0 salidos" en
   * todas cuadra. El resumen decia "Todo cuadra" sobre una generacion FALLIDA, que es la misma
   * mentira que "exito, 78 de 78" y de la misma familia. Sin este campo, el resumen habria
   * tranquilizado justo cuando habia que alarmar.
   */
  completa: boolean;
  /** true si ninguna fila se desvio, no hubo respaldo Y la generacion llego al final. */
  cuadra: boolean;
};

/** Cuantos clips cayeron al respaldo, sumando todos los motivos. */
export const totalRespaldo = (r: Resumen): number =>
  r.respaldo.reduce((n, m) => n + m.veces, 0);

/**
 * Arma el resumen. PURO: recibe los conteos ya hechos y no mira el timeline.
 *
 * `cuadra` es estricto a proposito: basta UNA fila desviada o UN respaldo para que sea false. Un
 * resumen que tolerara "casi cuadra" volveria a ser el "exito, 78 de 78" del 25/8.
 */
export function armarResumen(
  filas: readonly FilaResumen[], respaldo: readonly MotivoRespaldo[], total: number,
  completa: boolean
): Resumen {
  const f = filas.map(x => ({ ...x }));
  const r = respaldo.filter(m => m.veces > 0).map(x => ({ ...x }));
  return {
    total,
    filas: f,
    respaldo: r,
    completa,
    // UNA GENERACION QUE NO TERMINO NUNCA CUADRA, aunque los numeros salgan a cero: cero
    // pedidos contra cero salidos empata en todas las filas, y decir "todo cuadra" ahi seria
    // exactamente el fallo que este modulo existe para impedir.
    cuadra: completa && r.length === 0 && f.every(x => x.objetivo === x.real)
  };
}

/**
 * EL TEXTO DEL RESUMEN, EN UN SOLO SITIO.
 *
 * Devuelve lineas y no una cadena para que la interfaz decida como pintarlas y el log las
 * escriba tal cual. Mismo motivo que `avisoDeExclusion`: si cada consumidor redactara lo suyo,
 * se llega a que la ventana dice una cosa y el fichero otra.
 *
 * SALE SIEMPRE, TAMBIEN CUANDO TODO CUADRA. Un resumen que solo aparece cuando hay problemas
 * entrena al usuario a no leerlo, y entonces el dia que aparezca tampoco lo lee.
 */
export function textoResumen(r: Resumen): string[] {
  const out: string[] = [];
  if (!r.completa) {
    out.push('La generación NO llegó a terminar. Esto es lo que había hecho hasta que se cortó:');
  }
  out.push(`Resumen de la generación: ${r.total} clips.`);
  for (const f of r.filas) {
    const d = f.real - f.objetivo;
    const marca = d === 0 ? '' : (d > 0 ? `  (+${d})` : `  (${d})`);
    out.push(`  ${f.origen}: se pidieron ${f.objetivo} y salieron ${f.real}${marca}`);
  }
  const caidos = totalRespaldo(r);
  if (caidos > 0) {
    out.push(`${caidos} clips no salieron como se pidió y se rellenaron con otra cosa:`);
    for (const m of r.respaldo) out.push(`  ${m.veces} — ${m.descripcion}`);
  }
  out.push(r.cuadra
    ? 'Todo cuadra: no hubo ningún reemplazo y cada origen salió como se pidió.'
    : (r.completa
        ? 'El vídeo NO salió como se pidió. Revisa los avisos de arriba antes de exportar.'
        : 'El vídeo está incompleto. NO lo exportes: revisa los avisos de arriba.'));
  return out;
}

// ── LOS MOTIVOS DE RESPALDO, CON SU CODIGO ESTABLE ──────────────────────────────────────────
//
// Cinco motivos porque son CINCO SITIOS distintos donde un clip cambia de origen, y cada uno
// tiene un arreglo distinto. "10 clips cayeron" no es accionable; "10 Visuales cayeron porque
// DeepSeek no dio palabra con significado" lleva directo a la causa.
//
// El codigo es estable y la descripcion se puede reescribir: por eso van separados.
export const MOTIVOS = {
  'visual-sin-palabra': 'Visuales sin ninguna palabra con significado en su tramo de audio',
  'visual-sin-fichero': 'Visuales cuyo vídeo no llegó a generarse',
  'ia-fallida': 'clips de IA que fallaron al generarse',
  // SEXTO MOTIVO, y lo encontro la PRUEBA DE ACEPTACION: con los cinco puntos de respaldo el
  // resumen decia 'stock: se pidieron 11 y salieron 0' y NO decia por que -- el desglose salia
  // vacio. La causa principal del 25/8 no esta en ninguno de los cinco: los slots de stock se
  // degradan ANTES, en el reparto, porque sin DeepSeek no hay keyword propio y una busqueda
  // generica no ilustraria nada. Sin este motivo, el resumen enseñaba el sintoma y escondia la
  // causa.
  'stock-sin-keyword': 'clips de stock que se quedaron sin palabra clave y se dejaron como vídeo original',
  'stock-sin-resultados': 'clips de stock sin resultados en ningún proveedor',
  'stock-error': 'clips de stock que fallaron al descargarse'
} as const;

export type CodigoMotivo = keyof typeof MOTIVOS;

/** La descripcion de un motivo. Un codigo desconocido no rompe el resumen: se muestra crudo. */
export const describirMotivo = (c: string): string =>
  (MOTIVOS as Record<string, string>)[c] ?? `clips reemplazados (${c})`;
