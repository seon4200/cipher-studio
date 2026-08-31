// EL REGISTRO DE COMPOSICIONES.
//
// Meter la segunda composicion debe ser AÑADIR UNA ENTRADA, no tocar un switch. El switch de
// `AnimatedGraphic` ya tiene 17 ramas por tipo de tarjeta y es exactamente el sitio donde nadie
// quiere entrar a añadir la decimoctava.
//
// Hay TRES entradas: EXTRUSION, MAPA y ESCENA. Quien decide cual se pinta no es este fichero
// sino el
// `type` del guion, que AnimatedGraphic resuelve quitandole el prefijo `visual_`.
//
// Y que quede dicho, porque en este repo ya paso una vez (la PIEZA 2 estuvo escrita, probada y
// con handler mientras los graficos NO salian en el video, porque nadie la invocaba):
// REGISTRAR UNA COMPOSICION NO LA PINTA. Con COMPOSICION_VISUAL fijo en 'visual_extrusion',
// `mapa` esta registrada y no aparece en ningun video.
//
// ═══ LA REGLA QUE TIENE QUE LEER QUIEN ESCRIBA LA TERCERA ══════════════════════════════════
//
//   TODO LO QUE EMITA @keyframes SE EJECUTA ANTES DEL `return`.
//
// JSX evalua sus hijos EN ORDEN, y el <style> es el primero. Si una pieza que emite keyframes
// se escribe EN LINEA dentro del return —`{nodo(...)}`, `{barra(...)}`— sus reglas se emiten
// DESPUES de que el <style> haya serializado la lista, y no entran en la hoja.
//
// El sintoma no es un error: es un elemento que sale SIN ANIMAR, quieto, y como el transform
// suele vivir dentro del propio keyframe, ademas descolocado. Paso de verdad al portar `mapa`:
// cuatro nodos con su @keyframes ausente. No lo cazo leer el codigo —el fallo esta en CUANDO se
// evalua, no en lo que dice— sino CONTAR las reglas de la hoja: salian 16 donde la aritmetica
// decia 20.
//
// Construye las piezas en variables antes del return, y en el JSX pon solo la variable.

import type { ReactNode } from 'react';
import { comprobarCiclo, type DuracionUsada } from '../../../shared/ciclo';
import type { Concepto } from '../../../shared/conceptos';
import type { NombreSistema } from '../sistemas';
import { extrusion } from './extrusion';
import { mapa } from './mapa';
import { escena } from './escena';

/**
 * LOS DATOS DEL VISUAL: lo que trae el guion, sin nada del reloj ni del render.
 *
 * Va aparte de `PropsComposicion` porque es exactamente lo que necesita `puedeDibujar` para
 * decidir, y decide ANTES de que exista un frame. Pedirle los props enteros la obligaria a
 * recibir un `u` y un `ciclo` que no mira.
 */
export type DatosVisual = {
  /** El texto del Visual, si la composicion lo pinta. */
  texto?: string;
  /**
   * LOS TRES CONCEPTOS, ya saneados, o null.
   *
   * Es OPCIONAL a proposito: `extrusion` no los mira y no tiene por que. Null significa "el
   * guion no trajo conceptos", que es un caso normal —1 de 82 sub-clips en la ultima
   * generacion— y no un error.
   *
   * Vienen de `sanearConceptos`, no crudos de DeepSeek: son exactamente 3 {emoji, etiqueta} o
   * null, y son los MISMOS que viajan en `extra.conceptos` dentro de la clave del hash. Si lo
   * que se pinta deja de ser lo que se hashea, la cache devolvera un fichero que no
   * corresponde al dibujo diciendo ACIERTO.
   */
  conceptos?: Concepto[] | null;
  /**
   * LA DIRECCION, cruda, tal como viene de `extra.direccion`. Sin validar a proposito: quien
   * la consume la valida contra SUS registros, que son los que saben que piezas existen.
   *
   * Opcional porque `mapa` y `extrusion` no la miran y no tienen por que. `undefined` significa
   * "el guion no trajo direccion", y entonces la composicion la deriva de la semilla.
   */
  direccion?: unknown;
};

export type PropsComposicion = DatosVisual & {
  /** Avance dentro del ciclo, 0..1. Es `t / ciclo` ya normalizado. */
  u: number;
  /** Duracion del Visual en segundos. TODA duracion de animacion sale de aqui. */
  ciclo: number;
  sistema: NombreSistema;
  /**
   * La semilla de la disposicion, derivada de la PALABRA (`semillaDe`).
   *
   * Tiene que salir de la palabra y de nada mas: la palabra esta en la clave del hash, asi que
   * la clave describe el dibujo. Sembrar con el indice del clip o con el instante daria dos
   * dibujos distintos bajo el MISMO hash, y la cache devolveria el primero diciendo ACIERTO.
   */
  semilla: number;
};

export type Composicion = {
  nombre: string;
  /**
   * Las duraciones que la composicion usa, declaradas SIN ejecutarla.
   *
   * No es documentacion: es lo que hace posible el candado. Si las duraciones solo existieran
   * dentro del `render`, comprobarlas exigiria renderizar, y para entonces el frame ya esta
   * pintado. Declararlas aparte permite avisar ANTES, y permite que la suite las compruebe
   * para un abanico de ciclos sin montar React.
   *
   * El precio es que se pueden desincronizar del render. Por eso la regla al escribir una
   * composicion es que el `render` LEA de aqui, no que repita los numeros.
   */
  duraciones: (ciclo: number) => DuracionUsada[];
  /** Lo que el candado tuvo que CORREGIR al montarla con este ciclo. Vacio = nada. */
  avisos: (ciclo: number) => string[];
  /**
   * ¿PUEDE esta composicion dibujar con estos datos? OBLIGATORIO.
   *
   * Existe porque el despacho es por `type`, y `type` no sabe nada de los datos: un Visual con
   * `visual_mapa` y `conceptos: null` encontraba su composicion igual y se pintaba a medias —
   * fondo, estrellas, malla y el ancla sola, sin aristas ni emoji final. No fallaba: salia mal
   * y parecia intencionado. Devolviendo false aqui, AnimatedGraphic cae al Visual de texto de
   * siempre, que es el respaldo que ya existia.
   *
   * NO ES OPCIONAL, y no por ceremonia: con `?` una composicion futura puede no declararlo y
   * el fallo seria mudo. Obligatorio, tsc obliga a decidir.
   *
   * ═══ SI CAMBIAS ESTA CONDICION, SUBE VERSION_PLANTILLAS EN src/main/index.ts ═══
   *
   * La condicion NO ESTA EN LA CLAVE DEL HASH. El `type` sigue diciendo `visual_mapa` tanto si
   * se dibuja el mapa como si se cae a texto, asi que relajar o endurecer `puedeDibujar` —el
   * dia que el mapa acepte 2 conceptos, por ejemplo— haria que LA MISMA CLAVE diera pixeles
   * distintos, y la cache devolveria los MOV viejos diciendo ACIERTO. Verde y equivocado.
   *
   * Es el precio de tener la regla aqui en vez de en el backend: si el backend eligiera el
   * `type` segun los datos, la regla se auto-invalidaria sola porque el type esta en la clave.
   * Se prefiere tenerla aqui —el requisito vive con quien lo tiene, y una composicion nueva no
   * obliga al backend a conocer los requisitos de todas— y pagar este recordatorio.
   */
  puedeDibujar: (d: DatosVisual) => boolean;
  /**
   * ¿Pinta la composicion su propio pie (la palabra + la barra)? OBLIGATORIO.
   *
   * AnimatedGraphic pinta un pie para cualquier composicion, porque un Visual existe para poner
   * una palabra a pantalla completa. Una composicion que ademas pinte el suyo produce DOS
   * palabras. Con este campo hay UNA puerta: la composicion declara, AnimatedGraphic obedece.
   *
   * Obligatorio por lo mismo que el anterior. Se descarto extraer un `<PieVisual>` compartido
   * que pintaran todas: quien lo olvidara perderia la palabra sin un solo error. El booleano
   * obligatorio falla ruidoso —tsc—, el componente compartido falla mudo.
   *
   * ═══ SI CAMBIAS ESTE VALOR, SUBE VERSION_PLANTILLAS EN src/main/index.ts ═══
   *
   * Exactamente por lo mismo que `puedeDibujar`, y COMPROBADO: `hashGrafico` proyecta seis
   * campos de `graphicData` —type, value, label, unit, emoji, extra— mas ancho, alto, duracion,
   * fps, VERSION_PLANTILLAS, modo, codec y sistema. `pintaPie` NO es un campo de `graphicData`:
   * vive en el objeto `Composicion`, en el renderer. Grep sobre main/index.ts: cero usos fuera
   * de un comentario. Asi que cambiarlo mueve PIXELES SIN MOVER LA CLAVE, y la cache devolveria
   * para siempre los MOV con el pie que ya no toca.
   *
   * ⚠️ Y EL NOMBRE MIENTE — deuda anotada en docs/deuda-graficos.md. Desde el paso 9, `mapa` lo
   * declara `true` y NO PINTA NINGUN PIE: lo que el campo pregunta de verdad es "¿se salta
   * AnimatedGraphic el suyo?". Quien lea `pintaPie: true` y busque el pie del mapa no lo va a
   * encontrar. El nombre honesto seria `omitePieDeAnimatedGraphic`; renombrarlo no mueve un
   * pixel, pero toca este contrato y las dos composiciones.
   */
  pintaPie: boolean;
  render: (p: PropsComposicion) => ReactNode;
};

// La CLAVE es el nombre SIN el prefijo `visual_`: AnimatedGraphic hace
// `composicion(type.replace(/^visual_/, ''))`, asi que el tipo `visual_mapa` del guion resuelve
// a la entrada `mapa`, igual que `visual_extrusion` resuelve a `extrusion`.
export const COMPOSICIONES: Record<string, Composicion> = { extrusion, mapa, escena };

/**
 * Devuelve la composicion o NULL. Nunca lanza y nunca inventa una por defecto.
 *
 * Null es la respuesta correcta y no un descuido: quien pregunta tiene que poder caer al Visual
 * de texto de siempre. Devolver una composicion cualquiera pintaria algo que el guion no pidio,
 * y lanzar mataria el render — que en este pipeline significa que el Visual desaparece del
 * video sin que nada lo diga.
 */
export function composicion(nombre: unknown): Composicion | null {
  if (typeof nombre !== 'string' || !nombre) return null;
  return Object.prototype.hasOwnProperty.call(COMPOSICIONES, nombre)
    ? COMPOSICIONES[nombre]
    : null;
}

/**
 * Los avisos del candado para una composicion y un ciclo concretos.
 *
 * Vacio = todas sus duraciones dividen el ciclo. Se devuelve texto en vez de lanzar por la
 * razon que explica `comprobarCiclo`: matar el render cambiaria un bucle que salta por un
 * Visual que no aparece.
 */
export function avisosDeComposicion(nombre: string, ciclo: number): string[] {
  const c = composicion(nombre);
  if (!c) return [`no existe la composicion "${nombre}"`];
  return comprobarCiclo(ciclo, c.duraciones(ciclo)).map(a => `[${nombre}] ${a}`);
}
