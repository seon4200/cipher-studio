// RESOLUCION DE NOMBRES SOLAR. Los cuerpos SVG viven solo en el renderer; main necesita
// comprobar nombres sin arrastrar 10 MB de paths a su bundle.
import { NOMBRES_SOLAR } from './solar-nombres';

export type EstiloSolar = 'linear' | 'bold-duotone';

const NOMBRES = new Set<string>(NOMBRES_SOLAR);

export function normalizarNombreSolar(valor: unknown): string {
  return String(valor ?? '').trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^solar[:/]/, '')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .replace(/-(?:linear|bold-duotone|line-duotone|bold|outline|broken)$/u, '');
}

/**
 * Acepta "bridge", "solar:bridge" o "bridge linear". Primero usa la variante pedida,
 * despues una coincidencia por palabras completas: tolerante con nombres humanos, nunca
 * inventa un icono que no exista.
 */
export function resolverNombreSolar(valor: unknown, estilo: EstiloSolar): string | null {
  const base = normalizarNombreSolar(valor);
  if (!base) return null;
  const exacto = `${base}-${estilo}`;
  if (NOMBRES.has(exacto)) return exacto;
  const candidatos = NOMBRES_SOLAR.filter(n => n.endsWith(`-${estilo}`) &&
    (n.replace(`-${estilo}`, '') === base || n.startsWith(base + '-') || base.startsWith(n.replace(`-${estilo}`, '') + '-')));
  return candidatos.length === 1 ? candidatos[0] : null;
}

export function existeNombreSolar(valor: unknown): boolean {
  return resolverNombreSolar(valor, 'linear') !== null || resolverNombreSolar(valor, 'bold-duotone') !== null;
}
