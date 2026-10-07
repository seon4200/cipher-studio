# Photo Cutout Production V1

Estado: implementación local en `v15-photo-cutout-production-v1`. No implica
autorización de distribución comercial de pesos de modelos.

## Frontera de arquitectura

La producción reutiliza una sola ruta moderna:

```text
VisualConceptSetV1
→ decisión de representación
→ Pixabay existente / ProjectAsset de origen
→ CutoutTransform local (si corresponde)
→ ProjectAsset derivado RGBA
→ elección Hero o Support
→ VisualSceneSpecV2 + RenderBindingsV2
→ MotionGraphicV15 / QC / MP4 offline
```

No hay segundo renderer, data URI, posición paralela, ruta absoluta en el
contrato visual ni acceso a red durante el render. `VisualSceneSpecV2`,
`RenderBindingsV2`, MotionGraphicV15, las familias, el fondo y el Color System
permanecen como autoridades existentes.

## Representación

`resolveAssetRepresentationPreferenceV1` decide una clase de recurso, no un
asset ni un provider:

- persona/animal/objeto físico complejo: intenta `photo-cutout` antes de sus
  fallbacks;
- lugar o evento cuyo contexto es significado: `full-raster`;
- elección persistida/directa de icono o evidencia directa de provider: conserva
  la vía de icono;
- emoji semántico del mismo subclip: conserva el candidato iconográfico, pero
  no bloquea una oportunidad fotográfica previa cuando el concepto aporta
  evidencia física concreta;
- símbolo/técnico: Solar primero;
- concepto abstracto o contextual: editorial o símbolo, nunca una fotografía
  decorativa.

Un recurso válido del mismo subclip puede ser promovido de Support a Hero. Los
roles no son una cuota: una escena puede usar Hero solo, Hero + Support(s), o
editorial cuando corresponde.

Los tokens locales débiles no llenan slots si hay conceptos estructurados del
mismo subclip. Los nombres abstractos sin evidencia literal se limitan a la
vía simbólica/editorial antes de cualquier consulta de fotografía.

## CutoutTransform

El transform está aislado en `src/main/assets/cutout-transform.ts` y el worker
Python en `tools/photo-cutout-production/cutout_worker.py`. El modelo
provisional por defecto es `u2netp`; `isnet-general-use` queda sólo como
`optional-quality-model` y no se ejecuta automáticamente.

El runtime necesita un Python sidecar ya provisionado y un cache local de
pesos. No adivina un Python global ni descarga un modelo al generar. La clave
de cache es:

```text
source SHA-256 + modelo + revisión SHA-256 + maxDimension + revisión del transform
```

El resultado sólo se reutiliza si su ProjectAsset derivado sigue verificando
SHA, MIME, alpha y bytes locales. La cache diagnóstica vive en
`materiales/diagnostics/cutout-transforms-v1.json`, fuera de PixelIdentity.

La configuración productiva llega por el loader existente del proceso main:
`CIPHER_CUTOUT_PYTHON`, `CIPHER_CUTOUT_MODEL_CACHE` y, opcionalmente,
`CIPHER_CUTOUT_WORKER`. `diagnoseCutoutRuntimeV1` distingue configuración
ausente, intérprete/worker/modelo inexistente o irregular y runtime listo, sin
ejecutar Python ni descargar pesos. Los valores locales permanecen fuera de
Git y nunca entran en SceneSpec o PixelIdentity.

El gate barato clasifica `CUTOUT_USABLE`, `CUTOUT_SUSPICIOUS` o
`CUTOUT_FAILED` a partir de alpha útil, dimensiones, bounding box y proporción
transparente. No pretende detectar calidad de cabello. Ante fallo se intenta
otro candidato acotado; después puede conservarse un `full-raster` honesto,
otro concepto válido, OpenMoji, Solar o editorial. V1 no ejecuta ISNet como
fallback automático.

## Identidad, provenance y color

El SceneSpec final contiene únicamente bytes/SHA, estado, geometría, rol,
treatment y resto de decisiones visibles ya propias de V15. Provider, URL,
consulta, licencia, timestamps, ruta y traza permanecen en ProjectAsset y
diagnósticos, fuera de PixelIdentity.

Photo cutouts y full rasters usan `original-color`; Solar mantiene
`system-tint`. Halo, sombra, borde o backing siguen siendo acabados externos
no destructivos ya definidos por la familia/layout V15.

## Diagnóstico por vídeo

`summarizeMotionGraphicsVideoMetricsV2` registra: escenas, Hero/Support por
tipo de recurso, editorial, oportunidades/planes/peticiones/descargas de foto,
candidatos y rechazos de relevancia, inferencias reales, fuentes con alpha,
cache, errores de runtime, assets fotográficos únicos/reutilizados y tiempos.
La integración de generación adjunta el resumen al diagnóstico de decisiones,
sin inflar SceneSpec ni la identidad de píxeles.

El presupuesto compartido por escena es 4 peticiones, 4 descargas y 2
transformaciones como máximos. Los límites previos por plan/candidato siguen
aplicando. Agotar el presupuesto deja una razón persistida y utiliza la
alternativa semántica existente; no relaja Relevance Gate ni obliga a llenar
slots.

La aceptación real limitada queda en
`tests/aceptacion/photo-cutout-production-v1/`: corpus congelado de 20
escenas, cinco recorridos end-to-end reales, hoja de contactos, MP4 y
`evidence.json`. La publicación/retrieval ocurre antes de bloquear red; el
render, QC y MP4 se verifican sin red y sólo en proyecto temporal.

La aceptación acotada de la conexión productiva y la política de objetos queda
en `tests/aceptacion/photo-representation-runtime-v1/`. Usa respuestas
capturadas, dos escenas con un objeto real como Hero/Support, un control de
icono y el mismo loader de configuración del proceso main; después de
materializar ProjectAssets, renderiza offline.

## Deuda obligatoria de licencia y distribución

`CUTOUT_WEIGHT_LICENSE_GATE = PENDING_BEFORE_COMMERCIAL_DISTRIBUTION`.

La calidad y la integración local no constituyen autorización para redistribuir
pesos ni para declarar Cipher comercialmente seguro. Antes de empaquetar
Python/onnxruntime/pesos o distribuirlos comercialmente hay que auditar por
separado licencia del código, package, runtime y pesos efectivos. Hasta ese
gate, la aplicación sólo puede usar un sidecar/model cache local explícitamente
provisionado para desarrollo interno.
