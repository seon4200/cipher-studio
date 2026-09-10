# Visual Retrieval Engine V1 — Ronda C

> Estado: implementado en `visual-retrieval-engine-v1`, sin merge ni tag al redactar este documento.

## Propósito y frontera

Esta capa recupera evidencia visual antes del resolver/materializador existente:

```text
semántica local existente
→ VisualConceptSetV1 (primary, secondary, tertiary)
→ ConceptLexicon ES/EN
→ SearchPlan específico por proveedor
→ candidatos y ranking explicable
→ Hero / Support / editorial como decisión de recuperación
```

No dibuja, no cambia `VisualSceneSpecV1`, `RenderBindingsV1`, `PixelIdentity`,
`hashGrafico`, la clave React, el renderer ni `VERSION_PLANTILLAS`. Por tanto,
una `sceneSpec` V14 idéntica conserva identidad, hash y píxeles idénticos.

El renderer V14 sigue limitado a un Hero certificado. Los conceptos secundarios y
terciarios quedan como candidatos `support` trazables; no se materializan como
capas visuales hasta la Ronda D.

## Contratos

- `src/shared/visual-concepts.ts`: `VisualConceptSetV1` conserva como máximo
  tres conceptos de la narración local. Cada uno tiene término original,
  normalización, aliases, emoji opcional, tipo de sujeto, relación, importancia,
  rol preferido y procedencia de evidencia. El texto global no inventa sujetos.
- `src/shared/concept-lexicon.ts`: `ConceptLexiconV1` reusable ES/EN. Sus
  expansiones son `exact`, `synonym`, `related` y `context`. Hero favorece los
  dos primeros; related sirve como alternativa y context no desplaza una
  representación concreta.
- `src/main/assets/visual-retrieval.ts`: construye planes, consulta sólo índices
  locales de OpenMoji/Solar, rankea candidatos y deja Pixbay como preparación
  on-demand. La traza se adjunta al diagnóstico, nunca al spec visual.
- `src/main/assets/solar-index.ts`: indexa todos los nombres Solar instalados por
  concepto base y separa variantes (`linear`, `outline`, `bold-duotone`, etc.).
  La selección visual existente permanece restringida a variantes que el
  renderer ya certifica.
- `src/main/assets/pixabay-images.ts`: genera consultas oficiales, recibe un
  máximo de 40 resultados por petición explícita, rankea evidencia conocida y
  valida/publica sólo bytes del recurso finalmente descargado.

## OpenMoji y Solar

OpenMoji conserva catálogo local 17.0.0. La recuperación indexa `stableId`,
hexcode, emoji, annotation, tags, OpenMoji tags, group, subgroup y aliases
españoles. Un emoji directo o un hexcode resuelven sin búsqueda incierta; leer
metadata no inspecciona SVG. El SVG se mantiene bajo la validación/publish ya
existente sólo para el recurso elegido.

Solar se indexa desde el catálogo local completo. Primero se busca el concepto
base y después una variante compatible con el renderer; una coincidencia Solar
débil no desplaza un OpenMoji literal fuerte.

## Pixabay Images

Pixabay Images es una vía de preparación **explícita**, no una llamada desde el
renderer ni una exploración masiva. Los planes usan los parámetros oficiales
`q`, `lang`, `image_type`, `orientation`, `safesearch`, `per_page` y, cuando la
intención es aislada, `colors=transparent`.

`colors=transparent` sólo expresa una preferencia de búsqueda. No prueba alpha:

1. se descarga como máximo el candidato elegido;
2. se inspeccionan magic bytes, MIME, dimensiones y límites;
3. PNG se decodifica para comprobar alpha útil; JPEG declara que no tiene alpha;
   WebP conserva una advertencia si requiere decode más profundo;
4. una consulta que pidió aislamiento no puede publicar bytes sin alpha útil;
5. bytes válidos se publican de forma atómica en
   `materiales/assets/pixabay/<sha256>.<ext>` dentro de un proyecto explícito;
6. el `AssetManifest V1` se escribe después y el archivo nuevo se revierte sólo
   ante fallo normal de manifest.

El ranking conserva únicamente evidencia verificable: fuerza semántica,
nivel léxico, tipo de sujeto, rol Hero/Support, resolución, transparencia
solicitada/verificada, confianza del provider y la ausencia explícita de una
evaluación de composición. No inventa una puntuación de visión artificial.

Antes de descargar, `findReusablePixabayImageAssetV1` busca un ProjectAsset
válido por URLs de procedencia y revalida bytes/SHA/MIME. Así una preparación
futura puede reutilizar el asset sin otra consulta. La vía normal de generación
V14 no descarga ni publica Pixabay automáticamente.

## Trazabilidad e identidad

La generación registra `visualConcepts`, `searchPlans`, candidatos locales,
support seleccionado, candidatos diferidos y motivo editorial en el diagnóstico
existente `materiales/diagnostics/visual-decisions/<generationId>.json`.

Provider, URL, path, licencia, timestamps, planes, scores, ranking y traza no
entran en `extra.sceneSpec` ni PixelIdentity. Sólo la decisión visual que el
compilador existente ya materializa puede cambiar píxeles y cache.

## ByPeople posterior

`BYPEOPLE_PROVIDER_STATUS = 'planned-not-audited'`. El registro de providers
reconoce ese estado pero el resolver no genera plan ni candidato ByPeople. La
futura auditoría debe comprobar biblioteca local, estructura, metadata,
licencia, descarga, alpha, resoluciones, duplicados y permiso de índice local
antes de activar un adapter. Nunca debe llevar URL directa al renderer ni copiar
una biblioteca completa a proyectos.

## Límites para Ronda D

Pendiente, sin implementar aquí:

- binding/render de raster Pixabay;
- elección y render de Support/múltiples assets;
- OpenMoji original-color por defecto y sus decisiones de tratamiento;
- 17 familias, VideoVisualStyle y motion narrativo;
- ByPeople, archivo, IA o providers adicionales.

La extensión de `VisualSceneSpecV1`, RenderBindings, hash/cache o renderer para
esos puntos corresponde a la Ronda D y requiere revisión explícita.
