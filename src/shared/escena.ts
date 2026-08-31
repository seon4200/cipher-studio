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

import { generador, entre } from './semilla';
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
  puntos: (rnd: () => number, etiquetas: readonly string[]) => PuntoEscena[];
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
  transform: ((u: number, f: number) => string) | null;
};

// ── LOS TRES REGISTROS ───────────────────────────────────────────────────────────────
//
// `as const satisfies` da las DOS cosas a la vez: las claves quedan como literales -- de ahi
// salen `IdFondo` y compañia, y de ahi que el registro de dibujos no pueda olvidarse ninguna --
// y ademas tsc comprueba que cada entrada cumple el contrato.

export const FONDOS = {
  ondas: {
    id: 'ondas',
    descripcion: 'Fondo oscuro y sereno con anillos concentricos que respiran despacio.',
    energia: 1,
    tono: 'oscuro',
    formatos: ['9:16']
  },
  liso: {
    id: 'liso',
    descripcion: 'Fondo plano de un solo color, sin movimiento. Pieza de prueba.',
    energia: 0,
    tono: 'oscuro',
    formatos: ['9:16', '16:9'],
    prueba: true
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
    puntos: (rnd: () => number, etiquetas: readonly string[]) => acotarPuntos(
      [{ x: 28, y: 30 }, { x: 72, y: 32 }, { x: 50, y: 70 }].map(p => ({
        x: p.x + entre(rnd, -3, 3),
        y: p.y + entre(rnd, -2.5, 2.5)
      })), etiquetas, FRANJA_TEXTO_Y)
  },
  unaCaja: {
    id: 'unaCaja',
    descripcion: 'Un solo concepto en una caja centrada, sin lineas. Pieza de prueba.',
    energia: 0,
    formatos: ['9:16', '16:9'],
    minConceptos: 1,
    presupuestoTexto: FRANJA_TEXTO_Y,
    prueba: true,
    puntos: (rnd: () => number, etiquetas: readonly string[]) => acotarPuntos(
      [{ x: 50, y: 40 + entre(rnd, -2, 2) }], etiquetas, FRANJA_TEXTO_Y)
  }
} as const satisfies Record<string, MetaEstructura>;

export const CAMARAS = {
  deriva: {
    id: 'deriva',
    descripcion: 'Panoramica lenta en diagonal, con un acercamiento minimo.',
    energia: 2,
    formatos: ['9:16'],
    transform: (u: number, f: number) => {
      const x = Math.sin(u * TAU) * 3.2 * f;
      const y = Math.cos(u * TAU) * 2.0 * f;
      return `transform:translate(${x.toFixed(3)}cqmin,${y.toFixed(3)}cqmin) ` +
        `scale(${(1 + 0.04 * f).toFixed(4)})`;
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
    transform: null
  },
  derivaMinima: {
    id: 'derivaMinima',
    descripcion: 'Deriva apenas perceptible, la decima parte de la normal. Pieza de prueba.',
    energia: 1,
    formatos: ['9:16'],
    prueba: true,
    transform: (u: number, f: number) =>
      `transform:translateX(${(Math.sin(u * TAU) * 0.32 * f).toFixed(3)}cqmin)`
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
export function combinacionesLegales(op: OpcionesCombinaciones = {}): number {
  const conceptos = op.conceptos ?? CUANTOS_CONCEPTOS;
  const formato: Formato = op.formato ?? '9:16';
  const vale = (p: PiezaBase) => (op.incluirPruebas ? true : !p.prueba) &&
    (p.formatos as readonly Formato[]).includes(formato);

  const fondos = (Object.values(FONDOS) as MetaFondo[]).filter(vale);
  const camaras = (Object.values(CAMARAS) as MetaCamara[]).filter(vale);
  const estructuras = (Object.values(ESTRUCTURAS) as MetaEstructura[])
    .filter(e => vale(e) && e.minConceptos <= conceptos);

  let paresFondoCamara = 0;
  for (const f of fondos) for (const c of camaras) {
    if (f.energia + c.energia <= 3) paresFondoCamara++;   // LA REGLA DE LA ENERGIA
  }
  return paresFondoCamara * estructuras.length * DENSIDADES.length * RITMOS.length;
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
