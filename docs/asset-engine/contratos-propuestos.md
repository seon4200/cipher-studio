# Contratos conceptuales — autoridad documental 3.3.5

Los bloques inferiores conservan la especificación conceptual 3.3.5, no tipos
importados desde Markdown. Actualización 3.4A en rama asset-persistence-3-4a:
ProjectSubstrate, ProjectStateV1, ProjectAssetRecord y AssetManifestV1 tienen
autoridad productiva en src/shared/project-state.ts. El manifest mínimo usa
source/validation anidados por archivo, no las tablas con refs del ejemplo futuro.
Estado y manifest no duplican metadata. Ver persistencia-assets-v1.md.
La propuesta individual extra.hero sigue sustituida por una única proyección
`extra.sceneSpec`. Desde el Visual MVP productivo, su subconjunto V1 tiene
autoridad ejecutable en `src/shared/visual-scene-spec.ts`. El Resolver V1
materializa `AssetIntentV1 → ResolvedSceneDecisionV1 → sceneSpec + bindings`
antes del hash. Recipe completo, adquisición remota y providers posteriores
continúan fuera del código productivo.

## Catálogo de aplicación OpenMoji — 3.4B

3.4B añade un catálogo de **aplicación**, no un inventario de proyecto. Su
autoridad ejecutable está en `src/main/assets/openmoji/`; usa la distribución
oficial exacta `openmoji@17.0.0` durante build y publica un recurso local
selectivo fuera de Git. `OpenMojiCatalogEntry` separa metadata oficial
(hexcode/emoji/annotation/group/subgroup), datos derivados (stableId,
normalización, tags y ruta color SVG) y aliases de Cipher. La atribución tiene
una única autoridad en `attribution.ts`.

El catálogo sólo devuelve candidatos y una ruta local confinada. No crea
`ProjectAssetRecord`, no escribe `materiales/assets/manifest.json`, no devuelve
una URL remota de render y no contiene geometría, SceneRecipe, motion, timeline
ni RenderSpec. 3.4C publica un SVG concreto y el Resolver V1 lo puede reutilizar:
SHA, estado y tinte efectivo pasan a identidad visual; su ruta relativa sigue
siendo sólo un locator.
Ver `openmoji-catalog-v1.md` para la API, errores y recurso offline.

## 3.4C — ProjectAsset OpenMoji materializado, sin escena

3.4C añade la única operación interna que puede pasar de catálogo de aplicación
a asset de un **proyecto temporal**: `publishOpenMojiAsset({ projectRoot,
stableId })`. Reutiliza ProjectAssetRecord y AssetManifestV1 existentes, no los
amplía. El archivo final es `materiales/assets/openmoji/<sha256>.svg`; el locator
relativo sirve para abrirlo, mientras que SHA, MIME, tamaño y revisión de
validación acreditan el contenido. La atribución/vía de procedencia se toma de
`attribution.ts`; no se hace fetch.

La verificación de bytes se llama `verifyProjectAssetContent`. Esta fase no
crea SceneAssetSlot, ResolvedScenePlan, RenderAssetIdentity, RenderBindings ni
`extra.sceneSpec`; por tanto no modifica `graphicData`, `hashGrafico` ni los
píxeles. Cuando se llegue a render, sólo resultado materializado (presente o
ausente, SHA, tint, fit, revisión y motion efectivos) será PixelIdentity. URL,
provider, licencia, path, candidato y AttentionIntent continúan siendo datos de
provenance/decisión, no identidad visual.

La forma actual de ProjectAssetRecord sigue siendo la autoridad; no se convierte
el ejemplo relacional de abajo en schema productivo. Ver
`openmoji-asset-roundtrip-v1.md` para la política SVG, errores, orden atómico e
idempotencia.

## Visual MVP — RenderSpec y RenderBindings materializados

El Visual MVP implementa el mínimo certificado de RenderSpec como
`VisualSceneSpecV1`, proyectado únicamente en `graphicData.extra.sceneSpec`.
Ausencia de ese campo conserva la vía legacy; presencia inválida se rechaza. El
spec incluye sólo estado visual efectivo, SHA, MIME, kind, SubjectBounds, fit,
tratamiento, motion, texto, sistema/dirección y revisiones.

`RenderBindingsV1` conserva `slotId`, `assetId` y `relativeFile` fuera de
PixelIdentity. Main resuelve el locator contra un `projectRoot` explícito,
verifica el ProjectAsset y entrega bytes efímeros; React recibe una Blob URL, no
una ruta ni procedencia. `sceneSpecPixelIdentity` gobierna tanto `hashGrafico`
como `sceneSpecReactKey`. Provider, URL, licencia, atribución, fecha, path,
candidato y AttentionIntent no entran al hash.

V1 certifica un solo Hero OpenMoji, tres estructuras, tres tratamientos, dos
pares tipográficos, motion acotado y fallback editorial. El Resolver V1 posterior
usa este subconjunto sin ampliarlo; no implementa el compiler completo de
SceneRecipe. Evidencia y límites: `visual-asset-mvp-v1.md`.

## Resolver V1 — decisión materializada antes de render

`AssetIntentV1` tiene autoridad ejecutable en `src/shared/asset-intent.ts` y
contiene sólo la necesidad narrativa (`sceneId`, phrase opcional, keyword,
conceptos, relación, ancla, términos y modo preferido). No contiene provider,
URL, path, SHA, assetId, tratamiento ni geometría.

`ResolvedSceneDecisionV1` vive en `src/main/assets/asset-resolver.ts`. Separa
metáfora, candidatos, selección, reuse, estructura, tratamiento, fallback y
avisos. Sólo su compilador único produce `VisualSceneSpecV1 + RenderBindingsV1`.
La traza detallada es diagnóstica: no está en `graphicData.extra.sceneSpec`, no
participa en `hashGrafico` y no llega al renderer.

El renderer continúa sin semántica: no busca OpenMoji, aliases, providers ni
metáforas. Para un ProjectAsset recibe bytes ya verificados desde el binding; para
Solar recibe el nombre canónico ya elegido como `procedural` en el spec. Sólo los
valores visuales materializados (estado, SHA si aplica, tratamiento, fit, bounds,
motion, texto y revisiones) determinan PixelIdentity. Locator, provider, URL,
licencia, atribución, candidatos y score no lo hacen.

## Responsabilidades separadas

| Contrato | Autoridad | No contiene |
|---|---|---|
| SceneIntent | idea, frase, metáfora, keyword semántica | proveedor, bytes, geometría |
| SceneRecipe | dirección de arte/roles sin resolver, motion/timing deseados | SHA, URL, paths, proveedor, coordenadas |
| ProjectSubstrate | estilo estable por vídeo, paleta/par tipográfico por ID | inventario de assets o hex por escena |
| SceneAssetSlot | rol, intención, clase preferida, importancia, opcionalidad, fallback | asset real/posición |
| AssetMotionRecipe | entry/sustain/emphasis/exit/visibility normalizados | segundos, CSS, amplitudes libres |
| AssetIntentV1 | necesidad narrativa ejecutable del resolver | provider, URL, path, SHA, tratamiento, geometría |
| AssetCandidate | posibilidad remota | aprobación o uso en escena |
| DownloadRequest | URL candidata y límites de una operación | composición |
| DownloadedAsset | temporal recibido, tamaño/estado de descarga | aprobación/identidad visual |
| AssetValidation | mediciones de archivo/seguridad | política o montaje |
| AssetSourceRecord | proveedor, URLs, versión, licencia, atribución, fecha/riesgo | motion o escena |
| ProjectAsset | archivo aprobado con refs de validación y procedencia | listado de escenas, motion o uso |
| AssetManifest | inventario de assets/validaciones/procedencia por proyecto | ProjectSubstrate/timeline |
| SubjectBounds | contenido visible dentro del archivo, revisión de medición | posición de escena |
| ResolvedScenePlan | assets por slot, refs, SHA/MIME/bounds y decisiones/fallback | React/CSS libre o geometría paralela |
| ResolvedSceneDecisionV1 | resultado local de metáfora, candidatos, reuse, fallback y avisos | traza dentro de PixelIdentity o CSS/React |
| RenderSpec | resultado visual efectivo y revisiones; único input visual nuevo | selección semántica/proveedor/ruta |
| RenderAssetIdentity | estado/SHA/ajuste/tinte/motion efectivo | assetId administrativo/ruta |
| RenderAssetLocator | slotId/assetId/relativeFile para bytes | identidad visual |
| RenderBindings | locators operativos verificados contra spec | decisiones de render |
| NullAssetStrategy | respuesta explícita a ausencia/riesgo/concepto no ilustrable | presente ficticio |
| ProviderPolicy | capacidad, verificación y política habilitada separadas | un asset concreto |

Formas canónicas: [scene-recipe-v1.md](scene-recipe-v1.md),
[motion-contract-v1.md](motion-contract-v1.md),
[project-substrate-v1.md](project-substrate-v1.md),
[layouts-editoriales-v1.md](layouts-editoriales-v1.md) y
[null-asset-strategy-v1.md](null-asset-strategy-v1.md).
No mantener otra copia de sus tipos aquí.

## Adquisición y persistencia: contrato ampliado propuesto, separado del schema V1

La forma relacional siguiente sigue siendo una propuesta para la adquisición y el
resolver futuros; no sustituye el schema productivo mínimo de 3.4A. El V1 actual
usa `ProjectStateV1`, `ProjectSubstrate`, `ProjectAssetRecord` y
`AssetManifestV1` de `src/shared/project-state.ts`, con `source` y `validation`
anidados por archivo.

```ts
type AssetIntent = {
  id: string; slotRef: string; query: string
  kind: 'icon' | 'illustration' | 'transparent-png' | 'photo'
  allowedProviders: string[] // política del resolver, nunca SceneRecipe
}
type AssetCandidate = {
  provider: string; remoteId?: string; sourceUrl: string; fileUrl?: string
  declaredMime?: string; sourceRef: string
}
type DownloadRequest = { candidateRef: string; limitsPolicyId: string }
type DownloadedAsset = {
  candidateRef: string; temporaryFile: string; byteLength: number
  state: 'complete' | 'failed'
}
type AssetValidation = {
  id: string; accepted: boolean; mime: string; byteLength: number
  width?: number; height?: number; hasAlpha?: boolean; alphaUseful?: boolean
  sha256?: string; reason?: string; validatedAt: string; policyRevision: string
}
type AssetSourceRecord = {
  id: string; provider: string; sourceUrl: string; fileUrl: string
  providerVersion?: string; openmojiCatalogVersion?: string; fetchedAt: string
  licenseClaim: string; licenseEvidenceUrl: string | null
  attribution: string; requiresAttribution: boolean
  rightsRisk: 'low' | 'medium' | 'high'
}
type ProjectAsset = {
  id: string; relativeFile: string; sha256: string; mime: string
  sourceRef: string; validationRef: string
}
type AssetManifest = {
  assetManifestVersion: 1
  assets: ProjectAsset[]
  sources: AssetSourceRecord[]
  validations: AssetValidation[]
}
```

OpenMoji exige openmojiCatalogVersion no vacía y atribución desde 3.4.
ProjectAsset referencia registros, no duplica proveedor/licencia/QC/uso/motion.
El manifest V1 vive en `materiales/assets/manifest.json`; `relativeFile` es
relativo a la raíz del proyecto. El estado versionado guarda `schemaVersion`,
`projectSubstrate` y referencias de uso/timeline, no otra copia de archivos.
3.4A ya comprobó migración/default legacy, guardado recuperable y recuperación
por backup. La forma ampliada de adquisición remota continúa propuesta. Hoy sí
existen catálogo OpenMoji local, publicación sin red y un Hero productivo; el
Resolver V1 sólo selecciona ProjectAsset, OpenMoji local, Solar o editorial-text.

## Lifecycle y hash

1. Semántica saneada → AssetIntentV1 → metáfora concreta o editorial-text.
2. Resolver V1 busca inventario ProjectAsset válido antes del catálogo OpenMoji local.
3. Sólo el candidato OpenMoji seleccionado se publica con la validación/SHA de 3.4C;
   Solar queda procedural y no se descarga.
4. ResolvedSceneDecisionV1 registra selección, reuse, estructura, tratamiento,
   fallback y avisos fuera de PixelIdentity.
5. El compilador único materializa RenderSpec + RenderBindings: identidad y
   localización separadas.
6. Verificar locators contra SHA, retener bytes verificados, hashear
   graphicData.extra.sceneSpec y clave React correspondiente.
7. visual_escena pinta el resultado ya elegido dentro de geometría de estructura;
   el Visual termina como vídeo en timeline, no clip PNG paralelo.
8. Si faltan/cambian bytes, aviso y rechazo de captura o recompilación/fallback
    con nueva identidad. Nunca present sin archivo bajo el mismo hash.

SHA final representa bytes dibujados, original en procedencia si hubo derivado.
Las revisiones de algoritmo/tinte/bounds/texto/motion y tier también determinan
píxeles. Una nueva licencia/URL no cambia imagen salvo texto visible materializado.
La ruta y assetId son operativos, no identidad.

## Seguridad y política

relativeFile debe quedar confinado tras resolve/realpath, sin absolutos,
traversal ni symlinks externos. HTTPS, límites y respuesta validada antes de
publicar. SVG sólo OpenMoji pinneado y política contra scripts/recursos externos;
sanitización/rasterización determinista si corresponde, SHA de bytes finales.
ProviderPolicy permanece ejemplo separado en ../spike-hero/provider-contract.ts.example;
capacidad técnica, permiso y habilitación no son equivalentes.

No ResolvedAsset gigante ni inventario global nuevo. OpenMoji es el único
provider de archivo activo; PurePNG/PNGImages/APIs/removedor/IA siguen fuera del
resolver. ByPeople es la primera expansión post-MVP, pero permanece
`planned-not-audited` hasta inspeccionar la biblioteca real.
