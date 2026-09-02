// ESCENA — EL ENCHUFE. No es "una composicion que se ve bien": es el sitio donde entran las
// piezas de cada eje sin que `render` se entere.
//
// EL OBJETIVO ES MULTIPLICAR, NO SUMAR. Con llamadas directas por nombre --`fondoOndas(kf)`,
// `estructuraConstelacion(kf, ...)`-- meter la segunda estructura obliga a reescribir `render`,
// y la tercera otra vez: eso SUMA. Con registros, meter una pieza es anadir una entrada aqui y
// su dibujo en composiciones/escena.tsx, y las combinaciones se multiplican solas.
//
// AQUI SOLO HAY ARITMETICA Y METADATOS: ni JSX, ni document, ni <style>. El DIBUJO de cada pieza
// vive en composiciones/escena.tsx, y los dos registros estan ATADOS POR EL TIPO: `IdFondo` sale
// de las claves de este fichero, y el registro de dibujos se declara
// `Record<IdFondo, DibujoFondo>`. Anadir una pieza aqui y olvidar su dibujo NO COMPILA. Es la
// misma eleccion que `puedeDibujar`: fallar ruidoso -- tsc -- en vez de mudo.
//
// mapa.ts NO SE TOCA. Se le toma prestado `acotar()`, `anchoCaja`, `altoCaja` y `cl`, que son
// garantias ya medidas: no se reescribe una segunda version de algo asi.

import { generador, entre, semillaDe } from './semilla';
import { acotar, anchoCaja, altoCaja, cl, type Layout, type Punto } from './mapa';
import { CUANTOS_CONCEPTOS } from './conceptos';

const TAU = 6.283185307;

// ── LA ZONA SEGURA, y la conversion de unidades ──────────────────────────────────────
//
// La zona segura son 900x1400 centrados en 1080x1920: (1080-900)/2/1080 = 8.33 % a los lados y
// (1920-1400)/2/1920 = 13.54 % arriba y abajo. Misma aritmetica que ZONA en shared/mapa.ts.
export const ZONA_X_MIN = 8.33;
export const ZONA_X_MAX = 91.67;
export const ZONA_Y_MIN = 13.54;
export const ZONA_ANCHO_UTIL = ZONA_X_MAX - ZONA_X_MIN;

/**
 * Cuanto vale 1 cqmin como % del ALTO, en 9:16.
 *
 * `cqmin` es el menor lado del contenedor: en 1080x1920 es el ancho, 10.8 px. Como % del alto
 * son 10.8/1920 = 0.5625 = 9/16. Hace falta para pasar el alto del pie -- declarado en cqmin en
 * el CSS -- a la unidad en la que se colocan los nodos, que es % del alto.
 */
export const CQMIN_EN_PCT_ALTO = 9 / 16;

// ── EL PIE, Y LA FRANJA QUE RESERVA ──────────────────────────────────────────────────
//
// El pie NO encoge la letra y NO trunca: un Visual con letra pequeña deja de ser un Visual
// (misma regla que shared/texto.ts) y truncar inventa una palabra que no se dijo. Parte en DOS
// lineas, y las dos estan PRESUPUESTADAS siempre, no como excepcion.
//
// LOS NUMEROS SON UN ESTIMADOR, no una medida del DOM como la recta de `anchoCaja`:
//   ancho util   ZONA_ANCHO_UTIL = 83.34 % del ancho
//   fuente       9 cqmin, la de `.es-pie-tit`
//   em/caracter  0.58, Archivo 800
// => 83.34 / (9*0.58) = 15.97 caracteres por linea, y con dos lineas 31.93.
export const PIE_ANCHO_UTIL = ZONA_ANCHO_UTIL;
export const PIE_FUENTE_CQMIN = 9;
export const PIE_EM_POR_CARACTER = 0.58;
export const PIE_LINEAS = 2;
export const PIE_INTERLINEA = 0.95;
export const PIE_BARRA_MARGEN_CQMIN = 2.6;
export const PIE_BARRA_ALTO_CQMIN = 0.9;
/** Lo que el pie separa del borde inferior, en % del alto. Es el `bottom` de `.es-pie`. */
export const PIE_BOTTOM_PCT = 16;

export const PIE_CARACTERES_POR_LINEA = PIE_ANCHO_UTIL / (PIE_FUENTE_CQMIN * PIE_EM_POR_CARACTER);
export const MAX_CARACTERES_PIE = Math.floor(PIE_LINEAS * PIE_CARACTERES_POR_LINEA);

/** ¿Cabe este texto en el pie sin encoger ni truncar? */
export function cabeEnElPie(texto: unknown): boolean {
  const s = String(texto ?? '').trim();
  return s.length > 0 && s.length <= MAX_CARACTERES_PIE;
}

/** El alto del bloque del pie -- dos lineas mas la barra -- en cqmin. */
export const PIE_ALTO_CQMIN =
  PIE_LINEAS * PIE_FUENTE_CQMIN * PIE_INTERLINEA + PIE_BARRA_MARGEN_CQMIN + PIE_BARRA_ALTO_CQMIN;

/**
 * LA FRANJA DEL TEXTO: la `y` (en % del alto, desde arriba) por debajo de la cual NINGUNA pieza
 * puede colocar nada.
 *
 * ES ESTRUCTURAL, no un ajuste. El pie reserva DOS lineas SIEMPRE, asi que la colision con el
 * nodo de abajo pasaba hasta con la palabra "agua": no se arregla moviendo ese nodo a mano,
 * porque la siguiente estructura que alguien escriba volveria a pisarlo. Se declara UNA vez
 * aqui, cada estructura lo publica en `presupuestoTexto`, y lo heredan todas.
 */
export const FRANJA_TEXTO_Y = 100 - PIE_BOTTOM_PCT - PIE_ALTO_CQMIN * CQMIN_EN_PCT_ALTO;

// ── EL TOPE DE LA ETIQUETA DE UN CONCEPTO ────────────────────────────────────────────
//
// Simetrico al del pie: lo que no cabe no se encoge ni se trunca, se cae al respaldo. La
// diferencia es el modelo de ancho -- una caja de concepto tiene el suyo MEDIDO en el DOM real,
// y esa medida ya vive en `anchoCaja`.
//
// SE DERIVA DE LA PROPIA FUNCION MEDIDA. `anchoCaja` recibe LA ETIQUETA, no su longitud: mide
// `String(etiqueta).length` por dentro. Pasarle el numero medía `String(57).length` = 2, el
// ancho salia siempre 14.7 % y el tope quedaba en la guarda de 500 sin que nada fallara.
export const MAX_CARACTERES_ETIQUETA = (() => {
  let c = 0;
  while (c < 500 && anchoCaja('x'.repeat(c + 1), true) <= ZONA_ANCHO_UTIL) c++;
  return c;
})();

/** ¿Cabe esta etiqueta en la zona segura, aunque haya que centrarla? */
export function cabeLaEtiqueta(etiqueta: unknown): boolean {
  return String(etiqueta ?? '').length <= MAX_CARACTERES_ETIQUETA;
}

// ── EL CONTRATO DE UNA PIEZA ─────────────────────────────────────────────────────────
//
// Se escribe AHORA, con dos piezas por eje, porque con 65 seria un rediseño.
//
// LOS CAMPOS QUE NO APLICAN A UN EJE NO ESTAN. `tono` solo lo tienen los fondos; `minConceptos`
// y `presupuestoTexto` solo las estructuras. Poner los mismos campos en los tres ejes seria
// uniformidad falsa: obligaria a inventar un `tono` para una camara.

export type Formato = '9:16' | '16:9';

// ── IDENTIDAD E INSTANCIA: DOS ESPACIOS, NO UNO ──────────────────────────────────────
//
// IDENTIDAD es la combinacion de ejes: que fondo, que estructura, que camara. Es lo que impide
// que dos Visuales SE VEAN IGUAL.
//
// INSTANCIA es como se dibuja esa identidad concreta segun la semilla. Es lo que impide volver
// a ver ESTA ESCENA EXACTA.
//
// SON DOS COSAS Y NO SE SUSTITUYEN. El fallo de `formaDe(semilla)` en extrusion fue creer que
// las instancias hacian el trabajo de las identidades: cuatro rangos barridos y los quintiles
// salian planos, porque mover un parametro NO cambia lo que la pieza ES. Y al reves tampoco: con
// ejes y sin rangos, dos videos que cayeran en la misma combinacion saldrian identicos.
//
// ═══ LA REGLA QUE SALE DE AQUI ═══
// UN RANGO ES DE INSTANCIA, NUNCA DE IDENTIDAD. Un parametro no puede convertir `constelacion`
// en otra estructura. Si un rango llega tan lejos que cambia lo que la pieza es, ahi hay DOS
// PIEZAS y no un rango -- y meterlas como rango las esconde del recuento de identidades, que es
// justo el numero que dice si el motor da variedad de verdad.

export type Rango = {
  id: string;
  /** Que mueve, en una frase. Tambien para la IA: un rango es algo que puede pedir. */
  descripcion: string;
  min: number;
  max: number;
  /**
   * Cuantos valores DISTINGUIBLES tiene el rango a ojo.
   *
   * No es la resolucion del numero -- es continuo -- sino cuantos escalones se notan al mirar
   * dos clips seguidos. Es lo unico honesto que se puede multiplicar para contar instancias:
   * decir "infinitas porque es un real" seria contar variedad que nadie percibe.
   */
  pasos: number;
  /** Si el valor tiene que salir entero (un numero de anillos no puede ser 2.7). */
  entero?: boolean;
};

/** Los valores concretos de esta instancia. La clave es el `id` del rango. */
export type Parametros = Record<string, number>;

/**
 * Sortea los parametros de una pieza. Deterministico: el `rnd` sale de la semilla.
 *
 * EL ORDEN DE LOS RANGOS IMPORTA y no se puede reordenar sin cambiar todos los dibujos: cada
 * llamada avanza el generador. Mismo motivo que el orden de sorteos de `receta()`.
 */
export function parametrosDe(rangos: readonly Rango[], rnd: () => number): Parametros {
  const out: Parametros = {};
  for (const r of rangos) {
    const v = entre(rnd, r.min, r.max);
    out[r.id] = r.entero ? Math.round(v) : v;
  }
  return out;
}

export type SemillasInstancia = {
  principal: number;
  puntos: number;
  decoradores: number;
  parametros: number;
};

export type InstanciaEscena = {
  semillas: SemillasInstancia;
  fondo: Parametros;
  estructura: Parametros;
  camara: Parametros;
};

/**
 * La derivacion completa de una instancia REAL a partir de la palabra.
 *
 * Vive aqui para que el render y las herramientas de inspeccion no puedan discrepar sobre los
 * cuatro streams ni sobre el orden fondo -> estructura -> camara. No admite una semilla
 * inventada: recibe la misma palabra que entra en `graphicData.value` y, por tanto, en el hash.
 */
export function instanciaDe(value: string, direccion: Direccion): InstanciaEscena {
  const semillas: SemillasInstancia = {
    principal: semillaDe(value),
    puntos: semillaDe(value + '#pts'),
    decoradores: semillaDe(value + '#deco'),
    parametros: semillaDe(value + '#params')
  };
  const rnd = generador(semillas.parametros);
  return {
    semillas,
    fondo: parametrosDe(FONDOS[direccion.fondo].rangos, rnd),
    estructura: parametrosDe(ESTRUCTURAS[direccion.estructura].rangos, rnd),
    camara: parametrosDe(CAMARAS[direccion.camara].rangos, rnd)
  };
}

/** Cuantas instancias distinguibles produce una lista de rangos. Sin rangos, una. */
export function instanciasDe(rangos: readonly Rango[]): number {
  return rangos.reduce((n, r) => n * Math.max(1, Math.round(r.pasos)), 1);
}

/** Lo que TODA pieza declara, sea del eje que sea. */
export type PiezaBase = {
  id: string;
  /**
   * Una frase, en español, escrita PARA LA IA de la Fase 7.
   *
   * Vive aqui y no en un fichero de prompt aparte a proposito: el prompt tiene que DERIVARSE
   * del vocabulario. Con las descripciones en otro sitio, anadir una pieza y olvidar su linea
   * en el prompt deja a la IA eligiendo de un vocabulario que no es el que existe, y eso no da
   * ningun error.
   */
  descripcion: string;
  /**
   * 0..3. Cuanto movimiento y ruido visual aporta la pieza.
   *
   * LA REGLA: `fondo.energia + camara.energia <= 3`. Un fondo agitado con una camara agitada da
   * una escena ilegible, y esa combinacion no debe EXISTIR en el espacio -- no basta con
   * "evitarla": la Fase 7 elige de un vocabulario, y lo que este dentro saldra.
   */
  energia: number;
  /** En que relaciones de aspecto es valida. Hoy casi todo es solo vertical. */
  formatos: readonly Formato[];
  /**
   * LOS PARAMETROS DE INSTANCIA, con sus limites declarados.
   *
   * Declararlos -- en vez de sortear numeros sueltos dentro del dibujo -- es lo que permite
   * CONTAR las instancias sin ejecutar la pieza, y es lo que obliga a decidir si algo es un
   * rango o es otra pieza. Una pieza sin rangos es legitima: `liso` y `quieto` no tienen nada
   * que variar, y fingir que si lo tienen inflaria el recuento con variedad que no existe.
   */
  rangos: readonly Rango[];
  /**
   * Pieza TONTA, escrita solo para probar que el registro es de verdad un enchufe.
   *
   * Se quedan en el codigo a proposito: son la prueba viva de que cambiar `direccion.fondo`
   * cambia el fondo sin tocar `render`. Marcadas para que nadie las confunda con repertorio, y
   * `direccionDe` no las sortea nunca.
   */
  prueba?: boolean;
};

export type MetaFondo = PiezaBase & {
  /** Sobre que se lee el texto. Lo necesitara la Fase 7 para no poner texto claro sobre claro. */
  tono: 'oscuro' | 'claro';
};

export type MetaEstructura = PiezaBase & {
  /** Cuantos conceptos necesita para dibujarse. Por debajo, `puedeDibujar` cae al respaldo. */
  minConceptos: number;
  /**
   * La `y` por debajo de la cual esta estructura NO coloca nada, en % del alto.
   *
   * Lo declara la PIEZA y no lo impone `render`, porque una estructura futura sin pie propio
   * podria usar el cuadro entero. Hoy las dos declaran `FRANJA_TEXTO_Y`.
   */
  presupuestoTexto: number;
  /** La geometria, PURA. Devuelve los centros ya acotados a zona y a presupuesto. */
  puntos: (rnd: () => number, etiquetas: readonly string[], p: Parametros) => PuntoEscena[];
};

export type MetaCamara = PiezaBase & {
  /**
   * La camara NO tiene `emite`, y no es un olvido.
   *
   * Un fondo y una estructura PRODUCEN nodos; una camara MODULA los que ya hay. Lo que declara
   * es la funcion de muestreo `(u, f) -> declaracion CSS`, que el envoltorio generico de
   * composiciones/escena.tsx pasa por `kf`. Darle un `emite` de mentira para que los tres ejes
   * se parezcan seria la uniformidad falsa que este contrato evita.
   *
   * `null` = camara quieta: el envoltorio no emite @keyframes ni pone `will-change`.
   */
  transform: ((u: number, f: number, p: Parametros) => string) | null;
};

// ── LOS TRES REGISTROS ───────────────────────────────────────────────────────────────
//
// `as const satisfies` da las DOS cosas a la vez: las claves quedan como literales -- de ahi
// salen `IdFondo` y compañia, y de ahi que el registro de dibujos no pueda olvidarse ninguna --
// y ademas tsc comprueba que cada entrada cumple el contrato.

export const FONDOS = {
  ondas: {
    id: 'ondas',
    descripcion: 'Once lineas sinusoidales oscuras que se desplazan con fases distintas.',
    energia: 1,
    tono: 'oscuro',
    formatos: ['9:16'],
    // Fuente aprobada: docs/motion/lab-fondos.html:90-108. Los rangos anteriores describian
    // ANILLOS y pertenecian a otra geometria; conservarlos inflaria instancias que no existen.
    rangos: []
  },
  tunel: {
    id: 'tunel',
    descripcion: 'Tunel de anillos que avanza hacia la camara y crea profundidad frontal.',
    energia: 2,
    tono: 'oscuro',
    formatos: ['9:16'],
    rangos: [
      { id: 'anillos', descripcion: 'Cuantos anillos atraviesan el tunel.', min: 8, max: 12, pasos: 5, entero: true },
      { id: 'profundidad', descripcion: 'Cuanto acelera el crecimiento hacia la camara.', min: 1.8, max: 2.4, pasos: 4 },
      { id: 'giro', descripcion: 'Cuanto gira cada anillo durante el avance, en grados.', min: 14, max: 26, pasos: 4 }
    ]
  },
  skyline: {
    id: 'skyline',
    descripcion: 'Barras verticales que crecen y bajan como un ecualizador urbano.',
    energia: 2,
    tono: 'oscuro',
    formatos: ['9:16'],
    // Fuente aprobada: docs/motion/lab-fondos-2.html:237-251. No declara pasos hasta que sus
    // extremos se hayan mirado: inventarlos inflaria el numero que mide la variedad del motor.
    rangos: []
  },
  liso: {
    id: 'liso',
    descripcion: 'Fondo plano de un solo color, sin movimiento. Pieza de prueba.',
    energia: 0,
    tono: 'oscuro',
    formatos: ['9:16', '16:9'],
    prueba: true,
    // SIN RANGOS, y es honesto: un plano de un color no tiene nada que variar. Inventarle un
    // rango inflaria el recuento de instancias con variedad que nadie veria.
    rangos: []
  }
} as const satisfies Record<string, MetaFondo>;

export const ESTRUCTURAS = {
  constelacion: {
    id: 'constelacion',
    descripcion: 'Tres conceptos alrededor de un elemento central, unidos por lineas curvas.',
    energia: 1,
    formatos: ['9:16'],
    minConceptos: CUANTOS_CONCEPTOS,
    presupuestoTexto: FRANJA_TEXTO_Y,
    // NINGUNO de estos cambia lo que la estructura ES: sigan los valores que sigan, esto es
    // "tres conceptos alrededor de un centro". El numero de puntos NO es un rango -- lo fija
    // `minConceptos` y cambiarlo seria otra estructura.
    rangos: [
      { id: 'dispersionX', descripcion: 'Cuanto se desvian los nodos en horizontal.', min: 1, max: 5, pasos: 5 },
      { id: 'dispersionY', descripcion: 'Cuanto se desvian en vertical.', min: 1, max: 4, pasos: 4 },
      { id: 'curva', descripcion: 'Cuanto se arquean las lineas hacia arriba.', min: 2, max: 8, pasos: 4 },
      { id: 'escalaHero', descripcion: 'Tamaño del elemento central, en cqmin.', min: 22, max: 30, pasos: 5 }
    ],
    puntos: (rnd: () => number, etiquetas: readonly string[], pa: Parametros) => acotarPuntos(
      [{ x: 28, y: 30 }, { x: 72, y: 32 }, { x: 50, y: 70 }].map(p => ({
        x: p.x + entre(rnd, -(pa.dispersionX ?? 3), pa.dispersionX ?? 3),
        y: p.y + entre(rnd, -(pa.dispersionY ?? 2.5), pa.dispersionY ?? 2.5)
      })), etiquetas, FRANJA_TEXTO_Y)
  },
  capasApiladas: {
    id: 'capasApiladas',
    descripcion: 'Tres planos isometricos etiquetados, suspendidos uno sobre otro.',
    energia: 1,
    formatos: ['9:16'],
    minConceptos: 1,
    presupuestoTexto: FRANJA_TEXTO_Y,
    rangos: [
      { id: 'anchoPlano', descripcion: 'Tamano de cada plano isometrico, en cqmin.', min: 38, max: 48, pasos: 4 },
      { id: 'inclinacion', descripcion: 'Inclinacion vertical de los planos, en grados.', min: 52, max: 64, pasos: 4 },
      { id: 'flotacion', descripcion: 'Amplitud de la flotacion entre planos, en cqmin.', min: 0.5, max: 1.5, pasos: 4 }
    ],
    puntos: (rnd: () => number, etiquetas: readonly string[]) => {
      const n = Math.min(CUANTOS_CONCEPTOS, etiquetas.length);
      if (n === 0) return [];
      const inicio = n === 1 ? 43 : 29;
      const paso = n === 1 ? 0 : 14;
      return acotarPuntos(Array.from({ length: n }, (_, i) => ({
        x: 72,
        y: inicio + i * paso + entre(rnd, -0.8, 0.8)
      })), etiquetas, FRANJA_TEXTO_Y);
    }
  },
  redNodos: {
    id: 'redNodos',
    descripcion: 'Esfera giratoria de veintidos puntos con profundidad, sin aristas.',
    energia: 1,
    formatos: ['9:16'],
    minConceptos: CUANTOS_CONCEPTOS,
    presupuestoTexto: FRANJA_TEXTO_Y,
    // Fuente aprobada: docs/motion/lab-estructuras.html:314-331.
    // `sem(23)` no altera la pieza del lab: sus nodos no consumen `rnd()`.
    rangos: [],
    puntos: (_rnd: () => number, etiquetas: readonly string[]) => acotarPuntos(
      [{ x: 22, y: 24 }, { x: 78, y: 32 }, { x: 50, y: 74 }]
        .slice(0, Math.min(CUANTOS_CONCEPTOS, etiquetas.length)),
      etiquetas, FRANJA_TEXTO_Y)
  },
  unaCaja: {
    id: 'unaCaja',
    descripcion: 'Un solo concepto en una caja centrada, sin lineas. Pieza de prueba.',
    energia: 0,
    formatos: ['9:16', '16:9'],
    minConceptos: 1,
    presupuestoTexto: FRANJA_TEXTO_Y,
    prueba: true,
    rangos: [
      { id: 'desviacionY', descripcion: 'Cuanto sube o baja la caja del centro.', min: 1, max: 3, pasos: 3 }
    ],
    puntos: (rnd: () => number, etiquetas: readonly string[], pa: Parametros) => acotarPuntos(
      [{ x: 50, y: 40 + entre(rnd, -(pa.desviacionY ?? 2), pa.desviacionY ?? 2) }],
      etiquetas, FRANJA_TEXTO_Y)
  }
} as const satisfies Record<string, MetaEstructura>;

export const CAMARAS = {
  deriva: {
    id: 'deriva',
    descripcion: 'Panoramica lenta en diagonal, con un acercamiento minimo.',
    energia: 2,
    formatos: ['9:16'],
    rangos: [
      { id: 'amplitudX', descripcion: 'Cuanto recorre en horizontal, en cqmin.', min: 2, max: 4, pasos: 4 },
      { id: 'amplitudY', descripcion: 'Cuanto recorre en vertical, en cqmin.', min: 1.5, max: 3, pasos: 4 },
      { id: 'zoom', descripcion: 'Cuanto se acerca a lo largo del ciclo.', min: 0.02, max: 0.06, pasos: 3 }
    ],
    transform: (u: number, f: number, pa: Parametros) => {
      const x = Math.sin(u * TAU) * (pa.amplitudX ?? 3.2) * f;
      const y = Math.cos(u * TAU) * (pa.amplitudY ?? 2.0) * f;
      return `transform:translate(${x.toFixed(3)}cqmin,${y.toFixed(3)}cqmin) ` +
        `scale(${(1 + (pa.zoom ?? 0.04) * f).toFixed(4)})`;
    }
  },
  quieto: {
    id: 'quieto',
    descripcion: 'Sin movimiento de camara. El plano fijo.',
    energia: 0,
    formatos: ['9:16', '16:9'],
    // NULL, y es lo que convierte esta pieza en el CONTROL de la medicion de coste: con
    // `quieto` el envoltorio no emite un solo @keyframes ni pone `will-change`, o sea
    // exactamente la version "sin camara". La medicion se hace CAMBIANDO UNA PIEZA, no
    // parcheando el codigo y acordandose de no commitear el parche.
    //
    // SIN RANGOS: no hay nada que variar en no moverse. Es la unica pieza cuyo espacio de
    // instancias es exactamente 1, y eso es correcto.
    rangos: [],
    transform: null
  },
  derivaMinima: {
    id: 'derivaMinima',
    descripcion: 'Deriva apenas perceptible, la decima parte de la normal. Pieza de prueba.',
    energia: 1,
    formatos: ['9:16'],
    prueba: true,
    rangos: [
      { id: 'amplitud', descripcion: 'Cuanto recorre, en cqmin.', min: 0.2, max: 0.5, pasos: 3 }
    ],
    transform: (u: number, f: number, pa: Parametros) =>
      `transform:translateX(${(Math.sin(u * TAU) * (pa.amplitud ?? 0.32) * f).toFixed(3)}cqmin)`
  }
} as const satisfies Record<string, MetaCamara>;

export type IdFondo = keyof typeof FONDOS;
export type IdEstructura = keyof typeof ESTRUCTURAS;
export type IdCamara = keyof typeof CAMARAS;

/** Por nombre y no por numero: vocabulario cerrado, no un slider. */
export type Densidad = 'media';
export const DENSIDADES: readonly Densidad[] = ['media'];

/**
 * Cuantos decoradores por densidad.
 *
 * ⚠️ HOY LA DENSIDAD ESTA FIJA EN 'media', Y ESO ES DE LA FASE 1, NO EL DESTINO. LA FASE 5 ES
 * LA QUE TIENE QUE DERIVARLA DEL CONTENIDO: una frase densa pide mas elementos que una de una
 * sola idea, y esa decision no puede quedarse en 'media' por olvido. El cambio sera que
 * `densidad` deje de venir de `direccionDe` y venga del analisis del texto.
 */
export const DENSIDAD_A_N: Record<Densidad, number> = { media: 5 };

export type Ritmo = 'regular';
export const RITMOS: readonly Ritmo[] = ['regular'];

// ── LA DIRECCION ──────────────────────────────────────────────────────────────────────
//
// Un objeto PLANO, serializable a JSON sin perder nada: es la forma que tendra
// `extra.direccion` en la Fase 7.
export type Direccion = {
  fondo: IdFondo;
  estructura: IdEstructura;
  camara: IdCamara;
  densidad: Densidad;
  ritmo: Ritmo;
};

function elige<X>(rnd: () => number, a: readonly X[]): X {
  return a[Math.floor(rnd() * a.length)] ?? a[0];
}

/** Las claves de un registro, SIN las piezas de prueba. Es lo que se sortea de verdad. */
function repertorio<T extends Record<string, PiezaBase>>(reg: T): (keyof T)[] {
  return (Object.keys(reg) as (keyof T)[]).filter(k => !reg[k as string].prueba);
}

/**
 * TODO LO QUE LA SEMILLA DECIDE, en un solo sitio -- el mismo contrato que `receta()`.
 *
 * SORTEA SOLO EL REPERTORIO, nunca las piezas de prueba: estan en el registro para demostrar
 * que el enchufe funciona, no para salir en un video.
 *
 * LA FIRMA ES LA DEFINITIVA. En la Fase 7 la IA rellenara `extra.direccion` con esta MISMA
 * forma y `direccionDe` pasa a ser el RESPALDO, el mismo papel que `formaDe(semilla)` en
 * extrusion.tsx.
 */
export function direccionDe(semilla: number): Direccion {
  const rnd = generador(semilla);
  return {
    fondo: elige(rnd, repertorio(FONDOS)),
    estructura: elige(rnd, repertorio(ESTRUCTURAS)),
    camara: elige(rnd, repertorio(CAMARAS)),
    densidad: elige(rnd, DENSIDADES),
    ritmo: elige(rnd, RITMOS)
  };
}

/**
 * LA DIRECCION QUE LLEGA DE FUERA, validada contra los registros -- y `direccionDe` de respaldo.
 *
 * ES LA COSTURA DE LA FASE 7. Alli la IA rellenara `extra.direccion` y llegara aqui como un objeto
 * cualquiera: puede venir a medias, con un nombre de pieza que ya no existe, o no venir. Cada
 * campo se comprueba por separado contra su registro y lo que no valga cae al sorteo por
 * semilla, que siempre da algo dibujable. NUNCA lanza: un dato malo no puede costar un Visual.
 *
 * `extra` ESTA EN LA CLAVE DEL HASH, asi que dos direcciones distintas son dos ficheros distintos
 * por construccion. No hace falta anadir nada a la clave.
 *
 * UNA DIRECCION EXPLICITA PUEDE PEDIR UNA PIEZA DE PRUEBA; el SORTEO no. Son dos cosas
 * distintas: pedir una pieza a mano es deliberado, y es lo que permite demostrar que el
 * registro es un enchufe de verdad. `direccionDe` solo reparte repertorio.
 */
export function direccionDesde(crudo: unknown, semilla: number): Direccion {
  const base = direccionDe(semilla);
  if (!crudo || typeof crudo !== 'object') return base;
  const c = crudo as Record<string, unknown>;
  const val = <K extends string>(v: unknown, reg: Record<string, unknown>, porDefecto: K): K =>
    (typeof v === 'string' && Object.prototype.hasOwnProperty.call(reg, v)) ? (v as K) : porDefecto;
  return {
    fondo: val<IdFondo>(c.fondo, FONDOS, base.fondo),
    estructura: val<IdEstructura>(c.estructura, ESTRUCTURAS, base.estructura),
    camara: val<IdCamara>(c.camara, CAMARAS, base.camara),
    densidad: (DENSIDADES as readonly string[]).includes(String(c.densidad))
      ? (c.densidad as Densidad) : base.densidad,
    ritmo: (RITMOS as readonly string[]).includes(String(c.ritmo))
      ? (c.ritmo as Ritmo) : base.ritmo
  };
}

// ── CUANTOS ESTILOS HAY, CALCULADO ───────────────────────────────────────────────────

export type OpcionesCombinaciones = {
  /** Cuantos conceptos hay disponibles. Por defecto los que garantiza `sanearConceptos`. */
  conceptos?: number;
  formato?: Formato;
  /** Contar tambien las piezas de prueba. Por defecto NO: no son repertorio. */
  incluirPruebas?: boolean;
};

/**
 * CUANTAS COMBINACIONES LEGALES EXISTEN. Lo calcula el codigo, no una cuenta en un documento.
 *
 * Se re-exporta desde main/index.ts para que una suite lo ejercite sobre el BUNDLE COMPILADO.
 * Y esta en una suite por un motivo concreto: el dia que una regla nueva recorte el espacio,
 * este numero baja SOLO y la suite lo grita. Sin eso el espacio se encogeria en silencio y
 * seguiriamos creyendo la aritmetica vieja.
 */
export type EspacioDeEstilos = {
  /**
   * Combinaciones legales de EJES. Lo que impide que dos Visuales SE VEAN IGUAL.
   *
   * Es el numero pequeño, y es el que importa vigilar: es finito por construccion y solo crece
   * escribiendo piezas nuevas.
   */
  identidades: number;
  /**
   * Identidades x los rangos discretizados de las piezas que participan. Lo que impide volver a
   * ver ESTA ESCENA EXACTA.
   *
   * NO SE SUMA NI SE MEZCLA CON EL ANTERIOR. Un millon de instancias sobre dos identidades
   * siguen siendo dos cosas distintas de ver -- que es exactamente el fallo que se midio en
   * `formaDe(semilla)`: cuatro rangos barridos y los quintiles planos.
   */
  instancias: number;
};

/**
 * EL ESPACIO DE ESTILOS, calculado por el codigo y no por una multiplicacion en un documento.
 *
 * Se re-exporta desde main/index.ts para que una suite lo ejercite sobre el BUNDLE COMPILADO. Y
 * esta en una suite por un motivo concreto: el dia que una regla nueva recorte el espacio, estos
 * numeros bajan SOLOS y la suite lo grita. Sin eso el espacio se encogeria en silencio.
 *
 * LAS INSTANCIAS SE SUMAN POR COMBINACION, no se multiplican en bloque: cada terna legal tiene
 * SUS piezas y por tanto SUS rangos. Multiplicar "todos los rangos" por "todas las identidades"
 * contaria instancias de piezas que no coinciden nunca en la misma escena.
 */
export function combinacionesLegales(op: OpcionesCombinaciones = {}): EspacioDeEstilos {
  const conceptos = op.conceptos ?? CUANTOS_CONCEPTOS;
  const formato: Formato = op.formato ?? '9:16';
  const vale = (p: PiezaBase) => (op.incluirPruebas ? true : !p.prueba) &&
    (p.formatos as readonly Formato[]).includes(formato);

  const fondos = (Object.values(FONDOS) as MetaFondo[]).filter(vale);
  const camaras = (Object.values(CAMARAS) as MetaCamara[]).filter(vale);
  const estructuras = (Object.values(ESTRUCTURAS) as MetaEstructura[])
    .filter(e => vale(e) && e.minConceptos <= conceptos);

  const ejesSueltos = DENSIDADES.length * RITMOS.length;
  let identidades = 0, instancias = 0;
  for (const f of fondos) for (const c of camaras) {
    if (f.energia + c.energia > 3) continue;        // LA REGLA DE LA ENERGIA
    for (const e of estructuras) {
      identidades += ejesSueltos;
      instancias += ejesSueltos *
        instanciasDe(f.rangos) * instanciasDe(e.rangos) * instanciasDe(c.rangos);
    }
  }
  return { identidades, instancias };
}

// ── LAS CUATRO CAPAS Y SU PROFUNDIDAD ────────────────────────────────────────────────
export const PROFUNDIDAD = {
  fondo: 1.00,
  estructura: 0.50,
  decoradores: 0.55,
  texto: 0.20
} as const;

// ── FONDO: LOS ANILLOS Y SU DESFASE ──────────────────────────────────────────────────
//
// Cada anillo con su PROPIA fase: compartir una sola animacion los hace respirar a la vez y el
// ojo los lee como UN objeto que late. La fase solo desplaza el muestreo dentro de `u`, asi que
// el bucle sigue cerrando exacto.
export const ANILLOS_FONDO = 3;

export function faseAnillo(i: number, total: number = ANILLOS_FONDO): number {
  const n = Math.max(1, Math.floor(total));
  return (((Math.floor(i) % n) + n) % n) / n;
}

// ── GEOMETRIA COMPARTIDA ─────────────────────────────────────────────────────────────

export type PuntoEscena = Punto;

/**
 * Acota una lista de centros: por el BORDE de su caja en X, por el PRESUPUESTO DEL TEXTO en Y,
 * y por `acotar()` como cinturon final.
 *
 * ES GENERICA A PROPOSITO: la usan las dos estructuras y la heredaran las 17. Si cada una
 * acotara por su cuenta, la que se olvidara pisaria la palabra sin dar un error.
 *
 * EN X: `acotar()` acota CENTROS a ZONA, y lo que se sale es el BORDE, que esta a
 * `centro ± semiancho`. Con una etiqueta de 17 caracteres el borde derecho llegaba a 91.8 con
 * el centro en 75, que `acotar` considera correcto. Si el intervalo queda VACIO -- una caja mas
 * ancha que la zona entera -- se centra en 50, porque `cl(v, lo, hi)` con lo > hi devuelve `hi`
 * y pegaria la caja al borde izquierdo. `MAX_CARACTERES_ETIQUETA` hace que ese caso ni llegue.
 *
 * EN Y: el borde inferior de la caja no puede entrar en la franja del pie.
 */
export function acotarPuntos(
  crudos: readonly PuntoEscena[], etiquetas: readonly string[], presupuestoTexto: number
): PuntoEscena[] {
  const pts = crudos.map((p, i) => {
    const etq = etiquetas[i] ?? '';
    const semiX = anchoCaja(etq, true) / 2;
    const semiY = altoCaja(true) / 2;
    const loX = ZONA_X_MIN + semiX, hiX = ZONA_X_MAX - semiX;
    const loY = ZONA_Y_MIN + semiY, hiY = presupuestoTexto - semiY;
    return {
      x: loX <= hiX ? cl(p.x, loX, hiX) : 50,
      y: loY <= hiY ? cl(p.y, loY, hiY) : (loY + hiY) / 2
    };
  });
  // `acotar()` de mapa.ts, sin tocar: el cinturon. Las aristas y la curva no le importan.
  const L: Layout = { ancla: { x: 50, y: 45 }, pts, aristas: [], curva: 0 };
  return acotar(L).pts;
}

// ── DECORADORES ──────────────────────────────────────────────────────────────────────
export function retardosDecoradores(n: number, ritmo: Ritmo): number[] {
  const total = Math.max(0, Math.floor(n));
  switch (ritmo) {
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
