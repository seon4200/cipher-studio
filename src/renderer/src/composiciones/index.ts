// EL REGISTRO DE COMPOSICIONES.
//
// Meter la segunda composicion debe ser AÑADIR UNA ENTRADA, no tocar un switch. El switch de
// `AnimatedGraphic` ya tiene 17 ramas por tipo de tarjeta y es exactamente el sitio donde nadie
// quiere entrar a añadir la decimoctava.
//
// De momento esta VACIO. La primera entrada —EXTRUSION— va en el paso siguiente. Se deja el
// contrato escrito y probado antes porque es lo que decide como se escriben todas las demas.
//
// Y que quede dicho, porque en este repo ya paso una vez (la PIEZA 2 estuvo escrita, probada y
// con handler mientras los graficos NO salian en el video, porque nadie la invocaba):
// ESTO ES INFRAESTRUCTURA, NO FUNCIONALIDAD. Con el registro vacio no se ve nada nuevo en
// ningun video.

import type { ReactNode } from 'react';
import { comprobarCiclo, type DuracionUsada } from '../../../shared/ciclo';
import type { NombreSistema } from '../sistemas';
import { extrusion } from './extrusion';

export type PropsComposicion = {
  /** Avance dentro del ciclo, 0..1. Es `t / ciclo` ya normalizado. */
  u: number;
  /** Duracion del Visual en segundos. TODA duracion de animacion sale de aqui. */
  ciclo: number;
  sistema: NombreSistema;
  /** El texto del Visual, si la composicion lo pinta. */
  texto?: string;
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
  render: (p: PropsComposicion) => ReactNode;
};

export const COMPOSICIONES: Record<string, Composicion> = { extrusion };

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
