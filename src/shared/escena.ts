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
// T8: solo se comparten acotar/altoCaja/cl con mapa. El ancho de escena procede de
// SU cota por fuente; el ajuste historico de mapa no gobierna esta composicion.

import { generador, entre, semillaDe } from './semilla';
import { acotar, altoCaja, cl, type Layout, type Punto } from './mapa';
import { anchoCaja } from './metricas-caja';
import { CUANTOS_CONCEPTOS } from './conceptos';
import { ajustar } from './ciclo';

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
// La metrica procede de medir CADA caracter con la fuente real, fuera de shared/.
// TIPOGRAFIAS guarda el maximo, no el promedio: una palabra de puras W tambien debe caber.
// El antiguo 0.58 para Archivo era una estimacion; medido, el maximo es 0.979.
export const PIE_ANCHO_UTIL = ZONA_ANCHO_UTIL;
export const PIE_FUENTE_CQMIN = 9;
export const PIE_LINEAS = 2;
export const PIE_INTERLINEA = 0.95;
export const PIE_BARRA_MARGEN_CQMIN = 2.6;
export const PIE_BARRA_ALTO_CQMIN = 0.9;
/** Lo que el pie separa del borde inferior, en % del alto. Es el `bottom` de `.es-pie`. */
export const PIE_BOTTOM_PCT = 16;

export function maxCaracteresPie(tipografia: IdTipografia): number {
  // Redondear DESPUES de multiplicar por dos puede admitir un caracter de una tercera linea.
  return PIE_LINEAS * Math.floor(PIE_ANCHO_UTIL /
    (PIE_FUENTE_CQMIN * TIPOGRAFIAS[tipografia].emPorCaracter));
}

/** ¿Cabe este texto en el pie sin encoger ni truncar? */
export function cabeEnElPie(texto: unknown, tipografia: IdTipografia): boolean {
  const original = String(texto ?? '').trim();
  const s = TIPOGRAFIAS[tipografia].transformacion === 'uppercase' ? original.toUpperCase() : original;
  return s.length > 0 && s.length <= maxCaracteresPie(tipografia);
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

// A.4: `deriva` desplaza estructura y pie a profundidades 0.50 / 0.20.
// La medicion a 1080x1920 dio 9.72 px de deriva RELATIVA hacia abajo; sin esta
// reserva el recorte estatico puede aceptar una caja que la camara mete en el pie.
// 9.72 / 1920 * 100 = 0.50625 % del alto. Se guarda en la misma unidad que los puntos.
export const MARGEN_CAMARA_PIE_Y = 9.72 / 1920 * 100;

// ── EL TOPE DE LA ETIQUETA DE UN CONCEPTO ────────────────────────────────────────────
//
// Simetrico al del pie: lo que no cabe no se encoge ni se trunca, se cae al respaldo. La
// diferencia es la cota por fuente de metricas-caja.ts. El viejo ajuste medio
// subestimaba hasta palabras normales; A.2 lo sustituyo por el maximo medido.
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
  return anchoCaja(etiqueta, true) <= ZONA_ANCHO_UTIL;
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

/** Modula solo la palabra del pie. No tiene energia ni rangos de instancia. */
export type MetaTipografia = Pick<PiezaBase, 'id' | 'descripcion' | 'formatos' | 'prueba'> & {
  familia: string;
  rol: RolTipografico;
  peso: number;
  transformacion: 'none' | 'uppercase';
  emPorCaracter: number;
  caracterMasAncho: string;
};

/** Clasificar una fuente evita reabrir las 17 estructuras cuando entre una nueva familia. */
export type RolTipografico = 'neutral' | 'condensada' | 'editorial' | 'tecnica' | 'manuscrita';

// Medicion: tests/aceptacion/medir-tipografias.js y fixtures/metricas-tipografias.json.
// Electron 31.7.7 / Chromium 126, 1000 px, alfabeto castellano + digitos, maximo individual.
// Las cajas NO usan este registro: conservan Archivo y su aritmetica medida.
export const TIPOGRAFIAS = {
  archivo: {
    id: 'archivo', descripcion: 'Palabra en Archivo negrita, conservando mayusculas y minusculas.',
    formatos: ['9:16', '16:9'], familia: 'Archivo', rol: 'neutral', peso: 800, transformacion: 'none',
    emPorCaracter: 0.979, caracterMasAncho: 'W'
  },
  anton: {
    id: 'anton', descripcion: 'Palabra en Anton condensada y en versal.',
    formatos: ['9:16', '16:9'], familia: 'Anton', rol: 'condensada', peso: 400, transformacion: 'uppercase',
    emPorCaracter: 0.74609375, caracterMasAncho: 'M'
  },
  archivoBlack: {
    id: 'archivoBlack', descripcion: 'Titular macizo en Archivo Black para énfasis frontal.',
    formatos: ['9:16', '16:9'], familia: 'Archivo Black', rol: 'neutral', peso: 400, transformacion: 'uppercase',
    emPorCaracter: 1, caracterMasAncho: 'W'
  },
  barlowCondensed: {
    id: 'barlowCondensed', descripcion: 'Titular estrecho en Barlow Condensed.',
    formatos: ['9:16', '16:9'], familia: 'Barlow Condensed', rol: 'condensada', peso: 700, transformacion: 'uppercase',
    emPorCaracter: 0.689, caracterMasAncho: 'W'
  },
  bebasNeue: {
    id: 'bebasNeue', descripcion: 'Titular alto y estrecho en Bebas Neue.',
    formatos: ['9:16', '16:9'], familia: 'Bebas Neue', rol: 'condensada', peso: 400, transformacion: 'uppercase',
    emPorCaracter: 0.557, caracterMasAncho: 'W'
  },
  caveat: {
    id: 'caveat', descripcion: 'Palabra manuscrita en Caveat.',
    formatos: ['9:16', '16:9'], familia: 'Caveat', rol: 'neutral', peso: 700, transformacion: 'none',
    emPorCaracter: 0.729, caracterMasAncho: 'M'
  },
  dmSerifDisplay: {
    id: 'dmSerifDisplay', descripcion: 'Palabra editorial de alto contraste en DM Serif Display.',
    formatos: ['9:16', '16:9'], familia: 'DM Serif Display', rol: 'neutral', peso: 400, transformacion: 'none',
    emPorCaracter: 0.921, caracterMasAncho: 'W'
  },
  ibmPlexCondensed: {
    id: 'ibmPlexCondensed', descripcion: 'Titular técnico compacto en IBM Plex Sans Condensed.',
    formatos: ['9:16', '16:9'], familia: 'IBM Plex Sans Condensed', rol: 'condensada', peso: 700, transformacion: 'uppercase',
    emPorCaracter: 0.884, caracterMasAncho: 'W'
  },
  playfairDisplay: {
    id: 'playfairDisplay', descripcion: 'Palabra editorial serif en Playfair Display.',
    formatos: ['9:16', '16:9'], familia: 'Playfair Display', rol: 'neutral', peso: 800, transformacion: 'none',
    emPorCaracter: 0.989, caracterMasAncho: 'W'
  },
  spaceMono: {
    id: 'spaceMono', descripcion: 'Palabra monoespaciada técnica en Space Mono.',
    formatos: ['9:16', '16:9'], familia: 'Space Mono', rol: 'condensada', peso: 700, transformacion: 'uppercase',
    emPorCaracter: 0.612, caracterMasAncho: 'A'
  }
} as const satisfies Record<string, MetaTipografia>;
export type IdTipografia = keyof typeof TIPOGRAFIAS;

export type MetaFondo = PiezaBase & {
  /** Sobre que se lee: escena selecciona la tinta del sistema para los fondos claros. */
  tono: 'oscuro' | 'claro';
};

export type AjusteDensidadEstructura = {
  elementos: number;
  escala: number;
  separacion: number;
  opacidadSecundaria: number;
};

export type DisposicionCajas = {
  lectura: 'radial' | 'apilada' | 'orbital' | 'cronologica' | 'estratos' | 'cruzada';
  /** UNICA ruta de posiciones: la usan renderer y suite. */
  puntos: (rnd: () => number, etiquetas: readonly string[], p: Parametros) => PuntoEscena[];
  /** Preparada para 1..14; se consumira cuando entren las cinco densidades. */
  adaptarDensidad: (elementos: number) => AjusteDensidadEstructura;
};

function ajusteDensidad(elementos: number, escalaBase: number, separacionBase: number): AjusteDensidadEstructura {
  const n = Math.max(1, Math.min(14, Math.round(elementos)));
  const presion = (n - 1) / 13;
  return { elementos: n, escala: escalaBase * (1 - presion * 0.28),
    separacion: separacionBase * (1 + presion * 0.35), opacidadSecundaria: 1 - presion * 0.42 };
}

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
  tipografias: readonly RolTipografico[];
  disposicion: DisposicionCajas;
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
  tramaTejida: {
    id: 'tramaTejida',
    descripcion: 'Textil claro con hilos cruzados: textura tranquila que sostiene el contenido.',
    energia: 0,
    tono: 'claro',
    formatos: ['9:16'],
    // Fuente aprobada: docs/motion/lab-fondos-2.html:318-333. Sin rangos inventados.
    rangos: []
  },
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
  amanecer: {
    id: 'amanecer', descripcion: 'Bandas de luz cálida que se desplazan sobre un cielo pálido.',
    energia: 0, tono: 'claro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos-2.html:301-315.
  },
  causticas: {
    id: 'causticas', descripcion: 'Reflejos líquidos que ondulan como luz bajo el agua.',
    energia: 0, tono: 'claro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos-2.html:271-298.
  },
  cristales: {
    id: 'cristales', descripcion: 'Facetas poligonales cuyo brillo gira por turnos.',
    energia: 1, tono: 'oscuro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos-2.html:144-159.
  },
  panal: {
    id: 'panal', descripcion: 'Hexágonos que se encienden por una oleada diagonal.',
    energia: 1, tono: 'oscuro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos-2.html:217-233.
  },
  mallaDeformada: {
    id: 'mallaDeformada', descripcion: 'Rejilla que se hunde alrededor de un pozo que viaja.',
    energia: 2, tono: 'oscuro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos.html:159-201.
  },
  circuito: {
    id: 'circuito', descripcion: 'Pistas de placa con pulsos que avanzan a velocidades distintas.',
    energia: 2, tono: 'oscuro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos.html:204-228.
  },
  cuerdas: {
    id: 'cuerdas', descripcion: 'Hilos verticales que vibran como un instrumento tensado.',
    energia: 2, tono: 'oscuro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos-2.html:196-214.
  },
  mosaico: {
    id: 'mosaico', descripcion: 'Teselas que giran una por una y dan textura sin ruido.',
    energia: 2, tono: 'oscuro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos.html:254-274.
  },
  warpEstelar: {
    id: 'warpEstelar', descripcion: 'Estrellas que se estiran desde el centro como un salto al hiperespacio.',
    energia: 3, tono: 'oscuro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos.html:277-292.
  },
  lluviaDatos: {
    id: 'lluviaDatos', descripcion: 'Columnas de caracteres que caen con una cabeza brillante.',
    energia: 3, tono: 'oscuro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos-2.html:162-193.
  },
  multitud: {
    id: 'multitud', descripcion: 'Multitud de figuras que pulsa como una masa urbana.',
    energia: 2, tono: 'oscuro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos-3.html:154-177.
  },
  ordenEspontaneo: {
    id: 'ordenEspontaneo', descripcion: 'Partículas que encuentran orden sin una cuadrícula impuesta.',
    energia: 2, tono: 'oscuro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos-3.html:178-205.
  },
  demolicion: {
    id: 'demolicion', descripcion: 'Fragmentos que se desprenden y caen de una estructura.',
    energia: 3, tono: 'oscuro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos-3.html:206-224.
  },
  comidaFamilia: {
    id: 'comidaFamilia', descripcion: 'Platos alrededor de una mesa cálida vistos desde arriba.',
    energia: 1, tono: 'claro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos-3.html:226-245.
  },
  viaLactea: {
    id: 'viaLactea', descripcion: 'Una banda galáctica y estrellas que laten en profundidad.',
    energia: 2, tono: 'oscuro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos-3.html:247-260.
  },
  reinoAnimal: {
    id: 'reinoAnimal', descripcion: 'Manchas orgánicas y trama de piel animal que respiran.',
    energia: 2, tono: 'oscuro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos-3.html:261-273.
  },
  leyDarwin: {
    id: 'leyDarwin', descripcion: 'Ramas evolutivas que crecen desde una raíz común.',
    energia: 2, tono: 'oscuro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos-3.html:274-286.
  },
  ecosistemaMarino: {
    id: 'ecosistemaMarino', descripcion: 'Corrientes azules y capas profundas de un ecosistema marino.',
    energia: 2, tono: 'oscuro', formatos: ['9:16'], rangos: []
    // Fuente aprobada: docs/motion/lab-fondos-3.html:287-301.
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
    tipografias: ['neutral', 'condensada'],
    // NINGUNO de estos cambia lo que la estructura ES: sigan los valores que sigan, esto es
    // "tres conceptos alrededor de un centro". El numero de puntos NO es un rango -- lo fija
    // `minConceptos` y cambiarlo seria otra estructura.
    rangos: [
      { id: 'dispersionX', descripcion: 'Cuanto se desvian los nodos en horizontal.', min: 1, max: 5, pasos: 5 },
      { id: 'dispersionY', descripcion: 'Cuanto se desvian en vertical.', min: 1, max: 4, pasos: 4 },
      { id: 'curva', descripcion: 'Cuanto se arquean las lineas hacia arriba.', min: 2, max: 8, pasos: 4 },
      { id: 'escalaHero', descripcion: 'Tamaño del elemento central, en cqmin.', min: 22, max: 30, pasos: 5 }
    ],
    disposicion: { lectura: 'radial', adaptarDensidad: n => ajusteDensidad(n, 1, 1.12),
    puntos: (rnd: () => number, etiquetas: readonly string[], pa: Parametros) => acotarPuntos(
      [{ x: 28, y: 30 }, { x: 72, y: 32 }, { x: 50, y: 70 }].map(p => ({
        x: p.x + entre(rnd, -(pa.dispersionX ?? 3), pa.dispersionX ?? 3),
        y: p.y + entre(rnd, -(pa.dispersionY ?? 2.5), pa.dispersionY ?? 2.5)
      })), etiquetas, FRANJA_TEXTO_Y) }
  },
  capasApiladas: {
    id: 'capasApiladas',
    descripcion: 'Tres planos isometricos etiquetados, suspendidos uno sobre otro.',
    energia: 1,
    formatos: ['9:16'],
    minConceptos: 1,
    presupuestoTexto: FRANJA_TEXTO_Y,
    tipografias: ['neutral', 'condensada'],
    rangos: [
      { id: 'anchoPlano', descripcion: 'Tamano de cada plano isometrico, en cqmin.', min: 38, max: 48, pasos: 4 },
      { id: 'inclinacion', descripcion: 'Inclinacion vertical de los planos, en grados.', min: 52, max: 64, pasos: 4 },
      { id: 'flotacion', descripcion: 'Amplitud de la flotacion entre planos, en cqmin.', min: 0.5, max: 1.5, pasos: 4 }
    ],
    disposicion: { lectura: 'apilada', adaptarDensidad: n => ajusteDensidad(n, 0.94, 1.28),
    puntos: (rnd: () => number, etiquetas: readonly string[]) => {
      const n = Math.min(CUANTOS_CONCEPTOS, etiquetas.length);
      if (n === 0) return [];
      const inicio = n === 1 ? 43 : 29;
      const paso = n === 1 ? 0 : 14;
      return acotarPuntos(Array.from({ length: n }, (_, i) => ({
        x: 72,
        y: inicio + i * paso + entre(rnd, -0.8, 0.8)
      })), etiquetas, FRANJA_TEXTO_Y);
    } }
  },
  redNodos: {
    id: 'redNodos',
    descripcion: 'Esfera giratoria de veintidos puntos con profundidad, sin aristas.',
    energia: 1,
    formatos: ['9:16'],
    // La esfera existe con independencia de las etiquetas. El lab enseña tres conceptos, pero
    // eso es su caso de muestra, no un requisito geometrico de la pieza.
    minConceptos: 1,
    presupuestoTexto: FRANJA_TEXTO_Y,
    tipografias: ['neutral', 'condensada'],
    // Fuente aprobada: docs/motion/lab-estructuras.html:314-331.
    // `sem(23)` no altera la pieza del lab: sus nodos no consumen `rnd()`.
    rangos: [],
    disposicion: { lectura: 'orbital', adaptarDensidad: n => ajusteDensidad(n, 0.90, 1.22),
    puntos: (_rnd: () => number, etiquetas: readonly string[]) => acotarPuntos(
      [{ x: 12, y: 18 }, { x: 88, y: 24 }, { x: 50, y: 50 }]
        .slice(0, Math.min(CUANTOS_CONCEPTOS, etiquetas.length)),
      etiquetas, FRANJA_TEXTO_Y) }
  },
  // Fuente: docs/motion/lab-estructuras.html:297-312.
  lineaTiempo: {
    id: 'lineaTiempo', descripcion: 'Conceptos sucesivos sobre un eje vertical: un evento sigue a otro.',
    energia: 1, formatos: ['9:16'], minConceptos: 1,
    presupuestoTexto: FRANJA_TEXTO_Y, rangos: [],
    tipografias: ['neutral', 'condensada'],
    disposicion: { lectura: 'cronologica', adaptarDensidad: n => ajusteDensidad(n, 0.88, 1.36),
    puntos: (_rnd: () => number, etiquetas: readonly string[]) => acotarPuntos(
      etiquetas.slice(0, CUANTOS_CONCEPTOS).map((etiqueta, i) => ({
        x: 27 + anchoCaja(etiqueta, true) / 2, y: 30 + i * 17
      })), etiquetas, FRANJA_TEXTO_Y) }
  },
  // Fuente: docs/motion/lab-estructuras.html:284-295.
  corteTransversal: {
    id: 'corteTransversal', descripcion: 'Estratos horizontales etiquetados que componen un mismo conjunto.',
    energia: 1, formatos: ['9:16'], minConceptos: 1,
    presupuestoTexto: FRANJA_TEXTO_Y, rangos: [],
    tipografias: ['neutral', 'condensada'],
    disposicion: { lectura: 'estratos', adaptarDensidad: n => ajusteDensidad(n, 0.91, 1.31),
    puntos: (_rnd: () => number, etiquetas: readonly string[]) => acotarPuntos(
      etiquetas.slice(0, CUANTOS_CONCEPTOS).map((_, i) => ({ x: 50, y: 30 + i * 16 })),
      etiquetas, FRANJA_TEXTO_Y) }
  },
  // Fuente: docs/motion/lab-estructuras-2.html:145-163.
  partidoVertical: {
    id: 'partidoVertical', descripcion: 'Dos campos verticales contrastados: los conceptos cruzan su division.',
    energia: 1, formatos: ['9:16'], minConceptos: 1,
    presupuestoTexto: FRANJA_TEXTO_Y, rangos: [],
    tipografias: ['neutral', 'condensada'],
    disposicion: { lectura: 'cruzada', adaptarDensidad: n => ajusteDensidad(n, 0.93, 1.24),
    puntos: (_rnd: () => number, etiquetas: readonly string[]) => acotarPuntos(
      etiquetas.slice(0, CUANTOS_CONCEPTOS).map((_, i) => ({ x: 50 + i * 2, y: [20, 42, 60][i] })),
      etiquetas, FRANJA_TEXTO_Y) }
  },
  cintaDiagonal: {
    id: 'cintaDiagonal', descripcion: 'Una banda inclinada cruza el cuadro y los conceptos cuelgan de ella.',
    energia: 2, formatos: ['9:16'], minConceptos: 1, presupuestoTexto: FRANJA_TEXTO_Y,
    tipografias: ['neutral', 'condensada'], rangos: [],
    // Fuente aprobada: docs/motion/lab-estructuras-2.html:99-120.
    disposicion: { lectura: 'cruzada', adaptarDensidad: n => ajusteDensidad(n, .91, 1.30),
    puntos: (_rnd, etiquetas) => acotarPuntos(etiquetas.slice(0, CUANTOS_CONCEPTOS).map((_, i) =>
      ([{x:15,y:65},{x:35,y:48},{x:60,y:32}][i])), etiquetas, FRANJA_TEXTO_Y) }
  },
  marcoPoster: {
    id: 'marcoPoster', descripcion: 'Marco grueso de cartel serigrafiado con contenido que respira dentro.',
    energia: 0, formatos: ['9:16'], minConceptos: 1, presupuestoTexto: FRANJA_TEXTO_Y,
    tipografias: ['neutral', 'condensada'], rangos: [],
    // Fuente aprobada: docs/motion/lab-estructuras-2.html:122-143.
    disposicion: { lectura: 'estratos', adaptarDensidad: n => ajusteDensidad(n, .93, 1.26),
    puntos: (_rnd, etiquetas) => acotarPuntos(etiquetas.slice(0, CUANTOS_CONCEPTOS).map((_, i) =>
      ([{x:85,y:65},{x:75,y:45},{x:65,y:25}][i])), etiquetas, FRANJA_TEXTO_Y) }
  },
  anillosConcentricos: {
    id: 'anillosConcentricos', descripcion: 'Círculos que se abren desde el centro y sostienen los conceptos.',
    energia: 1, formatos: ['9:16'], minConceptos: 1, presupuestoTexto: FRANJA_TEXTO_Y,
    tipografias: ['neutral', 'condensada'], rangos: [],
    // Fuente aprobada: docs/motion/lab-estructuras-2.html:166-191.
    disposicion: { lectura: 'radial', adaptarDensidad: n => ajusteDensidad(n, .92, 1.22),
    puntos: (_rnd, etiquetas) => acotarPuntos([{x:15,y:50},{x:30,y:25},{x:70,y:55}]
      .slice(0, Math.min(CUANTOS_CONCEPTOS, etiquetas.length)), etiquetas, FRANJA_TEXTO_Y) }
  },
  abanicoTarjetas: {
    id: 'abanicoTarjetas', descripcion: 'Tarjetas desplegadas como una mano de cartas desde el centro.',
    energia: 1, formatos: ['9:16'], minConceptos: 1, presupuestoTexto: FRANJA_TEXTO_Y,
    tipografias: ['neutral', 'condensada'], rangos: [],
    // Fuente aprobada: docs/motion/lab-estructuras-2.html:194-217.
    disposicion: { lectura: 'radial', adaptarDensidad: n => ajusteDensidad(n, .90, 1.20),
    puntos: (_rnd, etiquetas) => acotarPuntos([{x:85,y:50},{x:50,y:62},{x:20,y:42}]
      .slice(0, Math.min(CUANTOS_CONCEPTOS, etiquetas.length)), etiquetas, FRANJA_TEXTO_Y) }
  },
  rayosImpacto: {
    id: 'rayosImpacto', descripcion: 'Rayos que estallan desde el centro y reciben los conceptos.',
    energia: 3, formatos: ['9:16'], minConceptos: 1, presupuestoTexto: FRANJA_TEXTO_Y,
    tipografias: ['neutral', 'condensada'], rangos: [],
    // Fuente aprobada: docs/motion/lab-estructuras-2.html:341-368.
    disposicion: { lectura: 'radial', adaptarDensidad: n => ajusteDensidad(n, .88, 1.18),
    puntos: (_rnd, etiquetas) => acotarPuntos([{x:15,y:35},{x:80,y:64},{x:50,y:16}]
      .slice(0, Math.min(CUANTOS_CONCEPTOS, etiquetas.length)), etiquetas, FRANJA_TEXTO_Y) }
  },
  engranajes: {
    id: 'engranajes', descripcion: 'Ruedas dentadas encajadas que giran como un mecanismo.',
    energia: 2, formatos: ['9:16'], minConceptos: 1, presupuestoTexto: FRANJA_TEXTO_Y,
    tipografias: ['neutral', 'condensada'], rangos: [],
    // Fuente aprobada: docs/motion/lab-estructuras-2.html:371-398.
    disposicion: { lectura: 'orbital', adaptarDensidad: n => ajusteDensidad(n, .89, 1.24),
    puntos: (_rnd, etiquetas) => acotarPuntos([{x:85,y:35},{x:65,y:58},{x:35,y:45}]
      .slice(0, Math.min(CUANTOS_CONCEPTOS, etiquetas.length)), etiquetas, FRANJA_TEXTO_Y) }
  },
  cuaderno: {
    id: 'cuaderno', descripcion: 'Página de cuaderno con renglones, anotaciones y subrayado.',
    energia: 0, formatos: ['9:16'], minConceptos: 1, presupuestoTexto: FRANJA_TEXTO_Y,
    tipografias: ['neutral', 'condensada'], rangos: [],
    // Fuente aprobada: docs/motion/lab-estructuras-2.html:401-425.
    disposicion: { lectura: 'cronologica', adaptarDensidad: n => ajusteDensidad(n, .94, 1.33),
    puntos: (_rnd, etiquetas) => acotarPuntos(etiquetas.slice(0, CUANTOS_CONCEPTOS).map((_, i) =>
      ([{x:35,y:65},{x:72,y:50},{x:82,y:28}][i])), etiquetas, FRANJA_TEXTO_Y) }
  },
  cascada: {
    id: 'cascada', descripcion: 'Cajas que caen en escalones, una detrás de otra.',
    energia: 1, formatos: ['9:16'], minConceptos: 1, presupuestoTexto: FRANJA_TEXTO_Y,
    tipografias: ['neutral', 'condensada'], rangos: [],
    // Fuente aprobada: docs/motion/lab-estructuras.html:215-224.
    disposicion: { lectura: 'cronologica', adaptarDensidad: n => ajusteDensidad(n, .91, 1.29),
    puntos: (_rnd, etiquetas) => acotarPuntos(etiquetas.slice(0, CUANTOS_CONCEPTOS).map((_, i) =>
      ([{x:85,y:20},{x:55,y:52},{x:22,y:64}][i])), etiquetas, FRANJA_TEXTO_Y) }
  },
  editorial: {
    id: 'editorial', descripcion: 'Bloque pesado a la izquierda con conceptos alineados a la derecha.',
    energia: 0, formatos: ['9:16'], minConceptos: 1, presupuestoTexto: FRANJA_TEXTO_Y,
    tipografias: ['neutral', 'condensada'], rangos: [],
    // Fuente aprobada: docs/motion/lab-estructuras.html:240-249.
    disposicion: { lectura: 'estratos', adaptarDensidad: n => ajusteDensidad(n, .92, 1.35),
    puntos: (_rnd, etiquetas) => acotarPuntos(etiquetas.slice(0, CUANTOS_CONCEPTOS).map((_, i) =>
      ({ x: [{x:65,y:65},{x:72,y:42},{x:68,y:20}][i].x,
        y: [{x:65,y:65},{x:72,y:42},{x:68,y:20}][i].y })), etiquetas, FRANJA_TEXTO_Y) }
  },
  mundoIsometrico: {
    id: 'mundoIsometrico', descripcion: 'Mundo de tiles isométricos que se construye paso a paso.',
    energia: 1, formatos: ['9:16'], minConceptos: 1, presupuestoTexto: FRANJA_TEXTO_Y,
    tipografias: ['neutral', 'condensada'], rangos: [],
    // Fuente aprobada: docs/motion/lab-estructuras.html:251-283.
    disposicion: { lectura: 'estratos', adaptarDensidad: n => ajusteDensidad(n, .90, 1.24),
    puntos: (_rnd, etiquetas) => acotarPuntos([{x:50,y:65},{x:20,y:20},{x:80,y:45}]
      .slice(0, Math.min(CUANTOS_CONCEPTOS, etiquetas.length)), etiquetas, FRANJA_TEXTO_Y) }
  },
  pilaVertical: {
    id: 'pilaVertical', descripcion: 'Bloques que descienden y se apilan formando una torre.',
    energia: 1, formatos: ['9:16'], minConceptos: 1, presupuestoTexto: FRANJA_TEXTO_Y,
    tipografias: ['neutral', 'condensada'], rangos: [],
    // Fuente aprobada: docs/motion/lab-estructuras.html:334-351.
    disposicion: { lectura: 'apilada', adaptarDensidad: n => ajusteDensidad(n, .93, 1.32),
    puntos: (_rnd, etiquetas) => acotarPuntos(etiquetas.slice(0, CUANTOS_CONCEPTOS).map((_, i) =>
      ([{x:35,y:50},{x:52,y:40},{x:70,y:65}][i])), etiquetas, FRANJA_TEXTO_Y) }
  },
  unaCaja: {
    id: 'unaCaja',
    descripcion: 'Un solo concepto en una caja centrada, sin lineas. Pieza de prueba.',
    energia: 0,
    formatos: ['9:16', '16:9'],
    minConceptos: 1,
    presupuestoTexto: FRANJA_TEXTO_Y,
    prueba: true,
    tipografias: ['neutral', 'condensada'],
    rangos: [
      { id: 'desviacionY', descripcion: 'Cuanto sube o baja la caja del centro.', min: 1, max: 3, pasos: 3 }
    ],
    disposicion: { lectura: 'apilada', adaptarDensidad: n => ajusteDensidad(n, 1, 1),
    puntos: (rnd: () => number, etiquetas: readonly string[], pa: Parametros) => acotarPuntos(
      [{ x: 50, y: 40 + entre(rnd, -(pa.desviacionY ?? 2), pa.desviacionY ?? 2) }],
      etiquetas, FRANJA_TEXTO_Y) }
  }
} as const satisfies Record<string, MetaEstructura>;

export const CAMARAS = {
  deriva: {
    id: 'deriva',
    descripcion: 'Panoramica lenta en diagonal, con un acercamiento minimo.',
    // A.1: lab-camara-2.html:90-91. Envolvente medida a 1080x1920: +/-43.2 px X,
    // +/-32.4 px Y (fondo); escala CONSTANTE 1.02..1.06, sin rotacion. Energia baja.
    energia: 1,
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
  acercamiento: {
    id: 'acercamiento', descripcion: 'Zoom hacia dentro que concentra la atención.', energia: 2,
    formatos: ['9:16'], rangos: [],
    // Fuente aprobada: docs/motion/lab-camara-2.html:93-95.
    transform: (u, f) => { const k = .5 - .5 * Math.cos(u * TAU); return `transform:translateY(${(-2.2 * f * k).toFixed(3)}cqmin) scale(${(1 + .17 * f * k).toFixed(4)})`; }
  },
  alejamiento: {
    id: 'alejamiento', descripcion: 'Empieza cerca y abre el plano como un revelado.', energia: 2,
    formatos: ['9:16'], rangos: [],
    // Fuente aprobada: docs/motion/lab-camara-2.html:96-98.
    transform: (u, f) => { const k = .5 - .5 * Math.cos(u * TAU); return `transform:translateY(${(1.6 * f * k).toFixed(3)}cqmin) scale(${(1 + .18 * f * (1 - k)).toFixed(4)})`; }
  },
  rebote: {
    id: 'rebote', descripcion: 'Sube, planea y aterriza como si la escena tuviera masa.', energia: 2,
    formatos: ['9:16'], rangos: [],
    // Fuente aprobada: docs/motion/lab-camara-2.html:99-101.
    transform: (u, f) => { const e = Math.sin(u * TAU); return `transform:translateY(${(-e * 3.4 * f).toFixed(3)}cqmin) scale(${(1 + .10 * f * Math.abs(e)).toFixed(4)})`; }
  },
  orbita: {
    id: 'orbita', descripcion: 'Gira alrededor del sujeto y muestra profundidad por paralaje.', energia: 2,
    formatos: ['9:16'], rangos: [],
    // Fuente aprobada: docs/motion/lab-camara-2.html:102-104.
    transform: (u, f) => { const a = u * TAU; return `transform:translate(${(Math.cos(a) * 4 * f).toFixed(3)}cqmin,${(Math.sin(a) * 2.4 * f).toFixed(3)}cqmin) rotate(${(Math.sin(a) * 1.6 * f).toFixed(3)}deg) scale(${(1 + .06 * f).toFixed(4)})`; }
  },
  barrido: {
    id: 'barrido', descripcion: 'El mundo rota bajo el sujeto en un barrido lento.', energia: 2,
    formatos: ['9:16'], rangos: [],
    // Fuente aprobada: docs/motion/lab-camara-2.html:105-107.
    transform: (u, f) => `transform:translateX(${(Math.sin(u * TAU) * 2.2 * f).toFixed(3)}cqmin) rotate(${(Math.sin(u * TAU) * 3.4 * f).toFixed(3)}deg) scale(${(1 + .05 * f).toFixed(4)})`
  },
  travelling: {
    id: 'travelling', descripcion: 'Desplazamiento lateral puro como una vía de tren.', energia: 1,
    formatos: ['9:16'], rangos: [],
    // Fuente aprobada: docs/motion/lab-camara-2.html:108-110.
    transform: (u, f) => `transform:translateX(${(Math.sin(u * TAU) * 6.5 * f).toFixed(3)}cqmin) scale(${(1 + .03 * f).toFixed(4)})`
  },
  grua: {
    id: 'grua', descripcion: 'Desplazamiento vertical que recorre las estructuras ascendentes.', energia: 1,
    formatos: ['9:16'], rangos: [],
    // Fuente aprobada: docs/motion/lab-camara-2.html:111-113.
    transform: (u, f) => `transform:translateY(${(Math.sin(u * TAU) * 6 * f).toFixed(3)}cqmin) scale(${(1 + .03 * f).toFixed(4)})`
  },
  picado: {
    id: 'picado', descripcion: 'Inclinación hacia abajo que empequeñece la escena.', energia: 2,
    formatos: ['9:16'], rangos: [],
    // Fuente aprobada: docs/motion/lab-camara-2.html:114-117.
    transform: (u, f) => { const k = .5 - .5 * Math.cos(u * TAU); return `transform:perspective(120cqmin) rotateX(${(9 * f * k).toFixed(3)}deg) translateY(${(-2.4 * f * k).toFixed(3)}cqmin) scale(${(1 + .07 * f * k).toFixed(4)})`; }
  },
  contrapicado: {
    id: 'contrapicado', descripcion: 'Inclinación hacia arriba que engrandece la escena.', energia: 2,
    formatos: ['9:16'], rangos: [],
    // Fuente aprobada: docs/motion/lab-camara-2.html:118-121.
    transform: (u, f) => { const k = .5 - .5 * Math.cos(u * TAU); return `transform:perspective(120cqmin) rotateX(${(-9 * f * k).toFixed(3)}deg) translateY(${(2.2 * f * k).toFixed(3)}cqmin) scale(${(1 + .07 * f * k).toFixed(4)})`; }
  },
  temblor: {
    id: 'temblor', descripcion: 'Sacudida de impacto que se amortigua.', energia: 3,
    formatos: ['9:16'], rangos: [],
    // Fuente aprobada: docs/motion/lab-camara-2.html:122-127.
    transform: (u, f) => { const a = Math.exp(-u * 5.2); return `transform:translate(${(Math.sin(u * TAU * 7) * 3.2 * f * a).toFixed(3)}cqmin,${(Math.cos(u * TAU * 9) * 2.4 * f * a).toFixed(3)}cqmin) rotate(${(Math.sin(u * TAU * 11) * .9 * f * a).toFixed(3)}deg) scale(${(1 + .02 * f * a).toFixed(4)})`; }
  },
  mano: {
    id: 'mano', descripcion: 'Deriva irregular de dos frecuencias, como cámara sostenida a mano.', energia: 1,
    formatos: ['9:16'], rangos: [],
    // Fuente aprobada: docs/motion/lab-camara-2.html:128-133.
    transform: (u, f) => { const x = (Math.sin(u * TAU) * 1.5 + Math.sin(u * TAU * 3 + 1.2) * .8) * f; const y = (Math.cos(u * TAU * 2 + .4) * 1.1 + Math.sin(u * TAU) * .9) * f; return `transform:translate(${x.toFixed(3)}cqmin,${y.toFixed(3)}cqmin) rotate(${(Math.sin(u * TAU * 2 + .7) * .5 * f).toFixed(3)}deg) scale(${(1 + .02 * f).toFixed(4)})`; }
  },
  vertigo: {
    id: 'vertigo', descripcion: 'Deformación de espacio que acerca fondo y aleja primer plano.', energia: 3,
    formatos: ['9:16'], rangos: [],
    // Fuente aprobada: docs/motion/lab-camara-2.html:134-136.
    transform: (u, f) => { const k = .5 - .5 * Math.cos(u * TAU); return `transform:scale(${(1 + .26 * k * (f - .55) * 2).toFixed(4)})`; }
  },
  inclinacion: {
    id: 'inclinacion', descripcion: 'Entra torcida y se endereza con inquietud controlada.', energia: 2,
    formatos: ['9:16'], rangos: [],
    // Fuente aprobada: docs/motion/lab-camara-2.html:137-139.
    transform: (u, f) => { const k = .5 + .5 * Math.cos(u * TAU); return `transform:rotate(${(5.5 * f * k).toFixed(3)}deg) scale(${(1 + .05 * f * k).toFixed(4)})`; }
  },
  saltos: {
    id: 'saltos', descripcion: 'Zoom escalonado que marca golpes secos de ritmo.', energia: 3,
    formatos: ['9:16'], rangos: [],
    // Fuente aprobada: docs/motion/lab-camara-2.html:140-142.
    transform: (u, f) => { const paso = Math.floor(u * 4) / 4; return `transform:translateY(${(-1.6 * f * paso).toFixed(3)}cqmin) scale(${(1 + .15 * f * paso).toFixed(4)})`; }
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
export type Densidad = 'minima' | 'baja' | 'media' | 'alta' | 'saturada';
export const DENSIDADES: readonly Densidad[] = ['minima', 'baja', 'media', 'alta', 'saturada'];

/**
 * Cuantos decoradores por densidad.
 *
 * La densidad NO es otro dado de estilo: sale de la carga del contenido. Dos Visuales del mismo
 * texto reciben la misma densidad, y anadir una densidad no desplaza los cinco sorteos esteticos.
 */
export const DENSIDAD_A_N: Record<Densidad, number> = {
  minima: 1, baja: 3, media: 5, alta: 8, saturada: 14
};

export type Ritmo = 'simultaneo' | 'regular' | 'acelerando' | 'frenando' | 'golpeSeco';
export const RITMOS: readonly Ritmo[] = ['simultaneo', 'regular', 'acelerando', 'frenando', 'golpeSeco'];

/** La minima informacion de contenido que necesita el eje densidad; no depende de React ni DOM. */
export type ContenidoDensidad = { texto?: unknown; conceptos?: readonly unknown[] };

function textoConcepto(c: unknown): string {
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object') {
    const o = c as Record<string, unknown>;
    return String(o.etiqueta ?? o.label ?? o.value ?? '');
  }
  return '';
}

/**
 * El unico eje que responde al contenido y no a la semilla.
 *
 * Conceptos validos pesan primero; la longitud combinada de palabra y etiquetas separa las
 * frases breves de las cargadas. Es deliberadamente una funcion pura para que main y renderer
 * resuelvan el mismo resultado antes de que la direccion entre en la clave de cache.
 */
export function densidadDesdeContenido(contenido: ContenidoDensidad = {}): Densidad {
  const texto = String(contenido.texto ?? '').trim();
  const etiquetas = Array.isArray(contenido.conceptos)
    ? contenido.conceptos.map(textoConcepto).map(x => x.trim()).filter(Boolean) : [];
  const carga = Math.max(1, etiquetas.length * 2 + Math.ceil((texto.length + etiquetas.join('').length) / 18));
  if (carga <= 2) return 'minima';
  if (carga <= 4) return 'baja';
  if (carga <= 6) return 'media';
  if (carga <= 9) return 'alta';
  return 'saturada';
}

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
  tipografia: IdTipografia;
};

function elige<X>(rnd: () => number, a: readonly X[]): X {
  return a[Math.floor(rnd() * a.length)] ?? a[0];
}

/** Las claves de un registro, SIN las piezas de prueba. Es lo que se sortea de verdad. */
function repertorio<T extends Record<string, Pick<PiezaBase, 'id' | 'prueba'>>>(reg: T): (keyof T)[] {
  return (Object.keys(reg) as (keyof T)[]).filter(k => !reg[k as string].prueba);
}

/** El contrato de roles decide qué familias puede sortear cada estructura, sin nombres de fuentes. */
export function tipografiasPara(estructura: IdEstructura): IdTipografia[] {
  const roles = ESTRUCTURAS[estructura]?.tipografias ?? [];
  return repertorio(TIPOGRAFIAS).filter(id => roles.includes(TIPOGRAFIAS[id].rol)) as IdTipografia[];
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
export function direccionDe(semilla: number, contenido: ContenidoDensidad = {}): Direccion {
  const rnd = generador(semilla);
  // `estructura` se conserva para que el ULTIMO sorteo consulte sus roles. La densidad no
  // consume este generador: sale solo del contenido y no puede desplazar ningun estilo.
  let estructura: IdEstructura;
  return {
    fondo: elige(rnd, repertorio(FONDOS)),
    estructura: estructura = elige(rnd, repertorio(ESTRUCTURAS)),
    camara: elige(rnd, repertorio(CAMARAS)),
    densidad: densidadDesdeContenido(contenido),
    ritmo: elige(rnd, RITMOS),
    // SIEMPRE EL ULTIMO SORTEO: fondo, estructura, camara y ritmo no se desplazan.
    tipografia: elige(rnd, tipografiasPara(estructura))
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
export function direccionDesde(crudo: unknown, semilla: number, contenido: ContenidoDensidad = {}): Direccion {
  const base = direccionDe(semilla, contenido);
  if (!crudo || typeof crudo !== 'object') return base;
  const c = crudo as Record<string, unknown>;
  const val = <K extends string>(v: unknown, reg: Record<string, unknown>, porDefecto: K): K =>
    (typeof v === 'string' && Object.prototype.hasOwnProperty.call(reg, v)) ? (v as K) : porDefecto;
  const estructura = val<IdEstructura>(c.estructura, ESTRUCTURAS, base.estructura);
  const tipografias = tipografiasPara(estructura);
  return {
    fondo: val<IdFondo>(c.fondo, FONDOS, base.fondo),
    estructura,
    camara: val<IdCamara>(c.camara, CAMARAS, base.camara),
    densidad: (DENSIDADES as readonly string[]).includes(String(c.densidad))
      ? (c.densidad as Densidad) : base.densidad,
    ritmo: (RITMOS as readonly string[]).includes(String(c.ritmo))
      ? (c.ritmo as Ritmo) : base.ritmo,
    tipografia: (typeof c.tipografia === 'string' && tipografias.includes(c.tipografia as IdTipografia))
      ? c.tipografia as IdTipografia : base.tipografia
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
  const vale = (p: Pick<PiezaBase, 'formatos' | 'prueba'>) => (op.incluirPruebas ? true : !p.prueba) &&
    (p.formatos as readonly Formato[]).includes(formato);

  const fondos = (Object.values(FONDOS) as MetaFondo[]).filter(vale);
  const camaras = (Object.values(CAMARAS) as MetaCamara[]).filter(vale);
  const estructuras = (Object.values(ESTRUCTURAS) as MetaEstructura[])
    .filter(e => vale(e) && e.minConceptos <= conceptos);

  let identidades = 0, instancias = 0;
  for (const f of fondos) for (const c of camaras) {
    if (f.energia + c.energia > 3) continue;        // LA REGLA DE LA ENERGIA
    for (const e of estructuras) {
      const fuentes = tipografiasPara(e.id as IdEstructura).filter(id => vale(TIPOGRAFIAS[id]));
      const ejesSueltos = DENSIDADES.length * RITMOS.length * fuentes.length;
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
    const loY = ZONA_Y_MIN + semiY, hiY = presupuestoTexto - MARGEN_CAMARA_PIE_Y - semiY;
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
export type CurvaRitmo = 'lineal' | 'acelerar' | 'frenar' | 'golpe';
export type EntradaRitmo = {
  retardos: number[];
  /** Fraccion del ciclo que ocupa UNA entrada, ya pasada por `ajustar`. */
  ventana: number;
  curva: CurvaRitmo;
  duracion: number;
  aviso: string | null;
};

/**
 * Distribuye las entradas dentro de [0, 1]. Cada perfil pide una fraccion escrita como
 * `ciclo / n` y pasa por `ajustar`: aunque alguien cambie su divisor, no puede dejar un
 * ritmo con una duracion ilegal escondida fuera del emisor de keyframes.
 */
export function entradaRitmo(n: number, ritmo: Ritmo, ciclo: number): EntradaRitmo {
  const total = Math.max(0, Math.floor(n));
  const reparto = (i: number) => total <= 1 ? 0 : i / (total - 1);
  let divisor: number;
  let curva: CurvaRitmo;
  let retardo: (i: number) => number;
  switch (ritmo) {
    case 'simultaneo':
      divisor = 4; curva = 'lineal'; retardo = () => .10; break;
    case 'regular':
      divisor = 5; curva = 'lineal'; retardo = i => .10 + reparto(i) * .55; break;
    case 'acelerando':
      divisor = 6; curva = 'acelerar'; retardo = i => .10 + Math.pow(reparto(i), 2) * .55; break;
    case 'frenando':
      divisor = 6; curva = 'frenar'; retardo = i => .10 + Math.sqrt(reparto(i)) * .55; break;
    case 'golpeSeco':
      divisor = 8; curva = 'golpe'; retardo = i => .10 + reparto(i) * .24; break;
    default: {
      const imposible: never = ritmo;
      throw new Error(`Ritmo desconocido: ${imposible}`);
    }
  }
  const legal = ajustar(ciclo, `ritmo ${ritmo}`, ciclo / divisor);
  return { retardos: [...Array(total)].map((_, i) => retardo(i)), ventana: legal.d / ciclo,
    curva, duracion: legal.d, aviso: legal.aviso };
}

export function posicionDecorador(rnd: () => number): PuntoEscena {
  const a = rnd() * TAU;
  const r = entre(rnd, 22, 34);
  return { x: 50 + Math.cos(a) * r, y: 45 + Math.sin(a) * r * 0.56 };
}
