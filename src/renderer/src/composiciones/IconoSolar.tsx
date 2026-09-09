import solar from '@iconify-json/solar/icons.json';
import type { Concepto } from '../../../shared/conceptos';
import { resolverNombreSolar, type EstiloSolar } from '../../../shared/iconos-solar';

type Props = { concepto?: Concepto; estilo: EstiloSolar; className?: string; titulo?: string; canonicalId?: string };

/** Solar primero; emoji (`ic`) es un respaldo explícito y visible, nunca un hueco silencioso. */
export function IconoSolar({ concepto, estilo, className = '', titulo, canonicalId }: Props) {
  // A sceneSpec may already contain an exact catalog ID. In that path no alias lookup or
  // semantic resolution happens in the renderer; legacy callers retain their historic route.
  const id = canonicalId ?? resolverNombreSolar(concepto?.icono, estilo);
  const icono = id ? (solar.icons as Record<string, { body: string; width?: number; height?: number }>)[id] : undefined;
  if (!icono) return <span className={className} aria-label={titulo ?? concepto?.etiqueta}>{concepto?.emoji ?? ''}</span>;
  // Solar linear usa paths con stroke; normalizar pathLength permite que el CSS dibuje el trazo
  // sin depender de la longitud concreta de cada icono. Duotone conserva su relleno y entra con
  // opacidad, pero tambien recibe pathLength para una futura animacion uniforme.
  const body = icono.body.replace(/<path\b/g, '<path pathLength="1"');
  return <svg className={className} viewBox={`0 0 ${icono.width ?? solar.width} ${icono.height ?? solar.height}`}
    role="img" aria-label={titulo ?? concepto?.etiqueta}
    dangerouslySetInnerHTML={{ __html: body }} />;
}
