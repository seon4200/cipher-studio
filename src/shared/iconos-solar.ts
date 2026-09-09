// RESOLUCION DE NOMBRES SOLAR. Los cuerpos SVG viven solo en el renderer; main necesita
// comprobar nombres sin arrastrar 10 MB de paths a su bundle.
import { NOMBRES_SOLAR } from './solar-nombres';

export type EstiloSolar = 'linear' | 'bold-duotone';

const NOMBRES = new Set<string>(NOMBRES_SOLAR);

/**
 * Vocabulario pequeno y comprobable que recibe DeepSeek. Son bases que existen con
 * variante `linear` y `bold-duotone`; el modelo elige una, no inventa un slug.
 */
export const NOMBRES_SOLAR_CURADOS = [
  'archive', 'bell', 'book', 'buildings', 'calendar', 'camera', 'chart', 'clock-circle',
  'compass', 'document', 'eye', 'flag', 'folder', 'heart', 'home', 'leaf', 'lightbulb',
  'link', 'map', 'microphone', 'monitor', 'music-note', 'planet', 'rocket', 'ruler',
  'settings', 'shield', 'star', 'sun', 'telescope', 'user', 'users-group-rounded', 'water',
  'stopwatch', 'hourglass', 'glasses', 'pen'
] as const;

/** Alias curados solo cuando el significado conserva el objeto pedido; ambigüedad = emoji. */
const ALIASES_SOLAR: Readonly<Record<string, string>> = {
  clock: 'clock-circle',
  pendulum: 'clock-circle',
  compass: 'compass',
  leaf: 'leaf',
  sun: 'sun',
  stopwatch: 'stopwatch',
  lightbulb: 'lightbulb',
  document: 'document',
  ruler: 'ruler',
  hourglass: 'hourglass',
  glasses: 'glasses',
  pencil: 'pen',
  sound: 'soundwave',
  gear: 'settings',
  'scattered-papers': 'document',
  sparkles: 'star',
  'scattered-stars': 'star',
  river: 'water',
  crowd: 'users-group-rounded',
  queue: 'users-group-rounded',
  medicine: 'document-medicine'
};

export function normalizarNombreSolar(valor: unknown): string {
  return String(valor ?? '').trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^solar[:/]/, '')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .replace(/-(?:linear|bold-duotone|line-duotone|bold|outline|broken)$/u, '');
}

export type ResolucionSolar = {
  solicitado: string;
  normalizado: string;
  candidatoCanonico: string;
  candidatos: readonly string[];
  resultado: string | null;
  motivo: 'vacio' | 'exacto' | 'alias' | 'unico' | 'ambiguo' | 'ausente';
};

/** Detalle serializable para el log de generación: nunca elige entre candidatos ambiguos. */
export function resolverSolarDetallado(valor: unknown, estilo: EstiloSolar): ResolucionSolar {
  const solicitado = String(valor ?? '');
  const normalizado = normalizarNombreSolar(valor);
  if (!normalizado) return { solicitado, normalizado, candidatoCanonico: '', candidatos: [], resultado: null, motivo: 'vacio' };
  const candidatoCanonico = ALIASES_SOLAR[normalizado] ?? normalizado;
  const exacto = `${candidatoCanonico}-${estilo}`;
  if (NOMBRES.has(exacto)) return {
    solicitado, normalizado, candidatoCanonico, candidatos: [exacto], resultado: exacto,
    motivo: candidatoCanonico === normalizado ? 'exacto' : 'alias'
  };
  const candidatos = NOMBRES_SOLAR.filter(n => n.endsWith(`-${estilo}`) &&
    (n.replace(`-${estilo}`, '') === candidatoCanonico || n.startsWith(candidatoCanonico + '-') ||
      candidatoCanonico.startsWith(n.replace(`-${estilo}`, '') + '-')));
  return {
    solicitado, normalizado, candidatoCanonico, candidatos, resultado: candidatos.length === 1 ? candidatos[0] : null,
    motivo: candidatos.length === 1 ? 'unico' : candidatos.length > 1 ? 'ambiguo' : 'ausente'
  };
}

/**
 * Acepta prefijos/espacios/estilos, aliases conservadores y un único candidato por palabras
 * completas. Si no hay equivalencia inequívoca, conserva el emoji de respaldo.
 */
export function resolverNombreSolar(valor: unknown, estilo: EstiloSolar): string | null {
  return resolverSolarDetallado(valor, estilo).resultado;
}

/** A materialized renderer spec may accept only an exact catalog ID, never an alias. */
export function esNombreSolarCanonico(valor: unknown, estilo: EstiloSolar): boolean {
  const id = typeof valor === 'string' ? valor.trim() : '';
  return id.endsWith(`-${estilo}`) && NOMBRES.has(id);
}

export function existeNombreSolar(valor: unknown): boolean {
  return resolverNombreSolar(valor, 'linear') !== null || resolverNombreSolar(valor, 'bold-duotone') !== null;
}
