# Auditoría 3.3 — pipeline existente de proyectos, materiales y stock

**Base auditada:** `c0a9c78` / `v-spike-proveedores-limpio`, 07/09/2026.
**Método:** lectura de código, estado y 61 proyectos locales; no se llamó a proveedores, no se descargó ni se exportó nada. Las rutas y líneas son evidencia; los límites V1 son propuestas, no mediciones.

## Conclusión operativa

Hoy los clips se guardan bajo el proyecto, pero el timeline persiste rutas **absolutas**. No existe `materiales/assets/`, `asset-manifest.json`, schema version ni migración de `project-state.json`. El JSON es la fuente de verdad de timeline/editor; el disco sólo confirma existencia. Un Photo Hero V1 debe ser material interno de `visual_escena` y terminar dentro de su MP4/MOV: el timeline acepta vídeo, audio o graphic, no PNG/SVG.

## Mapa del proyecto

| Área | Archivo / función | Entrada → salida | Disco / persistencia | Quién llama | Riesgo |
|---|---|---|---|---|---|
| Crear proyecto | `src/main/index.ts:604–699`, `initProjectDirs`, `create-project` | nombre → estado inicial | `proyectos/<slug>-<Date.now()>/project-state.json`; crea `materiales/{audio,voices,originales,stock,ia,pista-v2,visual}` y `cache/thumbnails` | UI/preload | Sin `assets/`, manifiesto ni schema. |
| Abrir/cargar | `src/main/index.ts:702–755`, `1798–1853` | JSON → estado | lee estado y asegura dirs | UI | `sanitizeProjectState` (`617–619`) es identidad; abrir y cargar no auditan igual. |
| Guardar | `src/renderer/src/main.tsx:1715–1809`; `src/main/index.ts:1736–1776` | React → JSON | escritura directa en ruta activa (fallback `process.cwd()`) | autosave, guardar, guardar como | Sin atomicidad, schema ni validación. |
| Auditoría | `src/main/index.ts:524–588` | clips + raíz → faltan/sinRuta/fuera | no modifica | cargar/export (`702`, `2993`) | Sólo existencia; `fuera` no bloquea. |
| Materiales/caché | `src/main/index.ts:477–488`, `590–615` | dirs fijos | materiales persisten; limpia sólo thumbnails | proyecto/cierre | Sin metadata por archivo. |
| Banco global | `src/main/index.ts:180–205`, `2306–2369` | categoría → clips vídeo | `banco-clips/{originales,stock,veo3,thumbnails}` | biblioteca | No indexa imágenes, SHA ni licencias. |
| Corte | `src/main/index.ts:2377–2580` | vídeo + marcas → MP4 | `materiales/originales/clip_###.mp4` | UI | No es importador de assets. |
| Stock | `generate-timeline-assets`, `src/main/index.ts:3803–5100` | consulta → URL → corte | bruto en banco global, copia a `materiales/stock` | generación | Timeline puede conservar ruta del corte en `originales`: categoría/ruta divergen. |
| Visual | `src/main/index.ts:1081–1576`, `4733–4900` | graphicData → MP4 | `materiales/visual` modo pantalla | lote de Visuales | `graphicData` se descarta del timeline final; no hay Hero de archivo. |
| Export | `src/main/index.ts:2947–3790` | timeline → MP4 | ruta elegida | UI | Sólo paths de vídeo; no PNG/SVG como clip. |
| FFmpeg | `src/main/services/ffmpeg.ts:6–73` | vídeo → dimensión/duración/thumb | rutas recibidas | main | No MIME/alpha/SVG/imagen. |
| IPC/preload | `src/preload/index.ts`; `main.tsx` | UI → main | N/A | renderer | No API de asset/manifiesto. |

## Schema real de `project-state.json`

No existe un tipo/schema central versionado. El renderer construye estado (`src/renderer/src/main.tsx:1730–1760`) y main lo escribe sin transformación (`src/main/index.ts:1736–1747`). En 61 estados inspeccionados aparecen `clips`, `timelineVideoClips`, `timelineVersions`, `transcriptSegments`, `aiScript`, voces, ajustes y pesos; no aparece `schemaVersion`, `assets`, `assetManifest` ni migración.

1. **¿Registra assets externos?** No como inventario/procedencia: conserva paths de clips, no SHA, licencia, alpha o asset ID.
2. **¿Campo extensible?** JSON admite campos, pero sin schema/migración no es contrato seguro.
3. **¿Rutas?** Son mayoritariamente absolutas: 3.308 referencias dentro y 133 fuera de proyecto en la muestra física.
4. **¿Falta archivo?** `auditarClips` lo reporta; export puede avisar/cancelar. No repara ni busca sustituto.
5. **¿Mover/copiar?** Crea dirs faltantes, pero no reescribe rutas absolutas: puede romperse.
6. **¿Schema/migración?** No/no.
7. **¿Fuente de verdad?** JSON para montaje; disco para existencia. No hay fuente para inventario de asset.

## Materiales existentes

En los 61 proyectos existen `audio` (52 archivos), `originales` (3.059), `stock` (1.376), `visual` (1.363) y directorios vacíos `voices`, `ia`, `pista-v2`. No existen `assets`, `images`, `videos` ni `asset-manifest.json`.

| Carpeta | Creador/contenido | Reuso, timeline, auditoría | Riesgo |
|---|---|---|---|
| `audio` | creación/voz | estado/timeline | rutas absolutas |
| `originales` | corte y procesamiento; `clip_###.mp4` | sí | puede ser ruta real de resultado stock |
| `stock` | copia de corte de stock | se copia, pero timeline puede usar `originales` | duplicación semántica |
| `visual` | MP4 hasheado de Visual | timeline como `video/category:visual` | semántica de escena no persiste |
| `ia` / `pista-v2` | MiniMax / sincronía V2 | usos específicos | sin inventario de procedencia |
| `cache/thumbnails` | biblioteca/render | regenerable; se limpia | no portable |

**Propuesta, no implementación:** SVG OpenMoji y PNG transparente son insumos de escena, no B-roll; deben ser categoría hermana de stock en `materiales/assets/<provider>/`, con una política de persistencia común pero sin confundirse con clips de timeline.

## Proveedores y banco global

| Recurso | Código | Estado | Persistencia / límites observados |
|---|---|---|---|
| Pexels, Pixabay, Coverr, NASA | bloque inline de `generate-timeline-assets` | **Implementado y llamado** cuando aplica | resultado efímero → banco global/corte; no sourceUrl, licencia ni SHA en estado. |
| Banco local | `load-bank-clips` | **Implementado y llamado** | sólo extensiones de vídeo; sin índice/deduplicación. |
| MiniMax | `generate-minimax-video` | **Implementado y llamado** | `materiales/ia`; valida duración/thumb. |
| Nano Banana | `src/main/providers/nanoBananaProvider.ts` | **Implementado pero desconectado** | helper no importado por producción. |
| Vibes | `src/main/providers/vibes-bot.ts` | **Experimento desconectado** | Playwright/navegador, no apto para el Asset Engine. |

No hay interfaz común de provider, cancelación transaccional, deduplicación por contenido ni metadatos persistidos de licencia. El flujo stock usa reintentos/fallback de resultados, no un downloader genérico reutilizable.

## Trazado de una descarga existente

`renderer` → preload → IPC `generate-timeline-assets` (`src/main/index.ts:3803`) → análisis de guion/transcripción y cuota → consultas inline → candidatos/ranking → URL → bruto en `banco-clips/stock` → FFmpeg recorta/escala → copia parcial a `materiales/stock` → `timelineVideoClips` → autosave `project-state.json` → export FFmpeg.

- Progreso y avisos salen por eventos main→renderer; no queda manifiesto persistente de decisión.
- No se observó token de cancelación/`AbortController`, escritura temporal atómica, límite de bytes, comprobación MIME/magic ni SHA antes de publicar.
- Reutilizables: proyecto activo, directorios por proyecto, IPC/progreso, selección de candidatos y herramientas FFmpeg de vídeo.
- No reutilizable tal cual: descarga, validación y persistencia genérica.

## Timeline, Hero e intención visual

`TimelineClip` en `src/renderer/src/main.tsx:45–69` acepta `video | audio | graphic`. Producción usa `COMPOSICION_VISUAL='visual_escena'` (`src/main/index.ts:4733`), la renderiza a MP4 en `materiales/visual` y coloca ese MP4 en timeline como vídeo. Por evidencia, un Photo Hero V1 debe quedar encapsulado en el MP4 del Visual; no hay soporte probado de imagen/overlay de timeline.

La geometría ya pertenece a cada estructura: `HeroEstructura` (`src/shared/escena.ts:362–393`) está declarada en las 17 (`573–793`). El renderer pinta hoy `IconoSolar` en esa ranura (`src/renderer/src/composiciones/escena.tsx:603–632`); no hay `<img>` ni path externo.

La IA/pipeline conserva palabra, timestamp, tres conceptos, relación, ancla y términos. `sanearConceptos` (`src/shared/conceptos.ts:56–84`) y `sanearSemanticaVisual` (`src/shared/semantica.ts:22–57`) los cierran; Solar devuelve candidatos/motivo (`src/shared/iconos-solar.ts:46–93`). Hay base para derivar una primera intención de búsqueda sin nueva llamada de IA, pero un `AssetIntent` debe impedir que el modelo invente ruta/URL/nombre de fichero.

## Hash, caché y archivo faltante

`hashGrafico` (`src/main/index.ts:1157–1190`) incluye todo `extra`, `sistema`, versión y parámetros de render; `canonizar` ordena claves recursivamente (`988–1015`). Así, `extra.hero.sha256` entraría solo si se resuelve antes de hashear. `localFile` no debe entrar: una ruta no es identidad visual.

Para no producir el mismo hash con píxeles distintos: resolver/validar antes de `graphicData`; hashear `hero.state:'present'` + SHA/mime/kind/tinte; ante ausencia, crear `hero.state:'missing'` o fallback explícito y aviso; resolver la ruta relativa al proyecto sólo para dibujar. Hoy no hay Hero de archivo, por lo que esta protección no existe aún.

## Seguridad, costes y límites

La auditoría actual sólo mira existencia. El futuro audit debe distinguir faltante, MIME/magic, tamaño, dimensiones, alpha útil, SVG no permitido, SHA distinto y archivo fuera del proyecto usando el canal de avisos existente.

Riesgos: rutas absolutas; traversal/symlinks; URL no HTTPS/redirección; HTML con extensión PNG; parcial/grande; SVG con scripts/recursos externos; duplicados, limpieza y `read-file-as-blob` sin confinamiento. SVG: permitir sólo OpenMoji pinneado, bloquear scripts/recursos externos y sanitizar o rasterizar antes de data URI.

| Métrica | Estado |
|---|---|
| solicitudes por vídeo | **No conocido**, depende de subclips/pesos |
| candidatos de stock | **Calculado:** top 3 Pexels/Pixabay/Coverr, top 2 NASA; no mide imágenes |
| tiempo/almacenamiento/hash de imagen | **No medido** |
| render Hero | **No conocido** |

**Límites V1 propuestos, no activados:** 1 intención por Visual, 3 candidatos/intención, 1 descarga aceptada/intención y 20/vídeo, 10 MiB y lado 4096 px/asset, 15 s y un reintento. Son contención inicial, no cifras universales.

## Respuestas que fijan el siguiente paso

1. Vive propuesto en `materiales/assets/<provider>/`; no existe hoy.
2. JSON es timeline, disco existencia; manifest propuesto sería inventario de asset.
3. Hoy reabre por path absoluto; V1 debe usar rutas relativas al proyecto.
4. Sólo se reutiliza la orquestación, no el downloader sin validar.
5. Pexels/Pixabay/Coverr/NASA/banco/MiniMax conectados; Nano/Vibes no.
6. OpenMoji: pin oficial offline, metadata y copia por vídeo al proyecto.
7. PNG: temporal → validar → SHA → manifest → Hero.
8. Hero entra dentro de `visual_escena` y su MP4.
9. Hash: SHA + estado + propiedades que mueven píxel; no ruta.
10. Faltante: aviso/fallback/identidad distinta.
11. Mover PC hoy puede romper; V1 resuelve asset relativo.
12. Primer código futuro: contrato/manifiesto/validador mínimo, después OpenMoji.
