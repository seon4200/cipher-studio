# Contratos conceptuales — autoridad documental 3.3.5

Sólo especificación. Ningún tipo se importa por src/; no hay almacenamiento,
descarga ni renderer nuevo. Sustituye la propuesta individual SceneHeroReference
de 3.3: extra.hero no coexistirá con extra.sceneSpec.

## Responsabilidades separadas

| Contrato | Autoridad | No contiene |
|---|---|---|
| SceneIntent | idea, frase, metáfora, keyword semántica | proveedor, bytes, geometría |
| SceneRecipe | dirección de arte/roles sin resolver, motion/timing deseados | SHA, URL, paths, proveedor, coordenadas |
| ProjectSubstrate | estilo estable por vídeo, paleta/par tipográfico por ID | inventario de assets o hex por escena |
| SceneAssetSlot | rol, intención, clase preferida, importancia, opcionalidad, fallback | asset real/posición |
| AssetMotionRecipe | entry/sustain/emphasis/exit/visibility normalizados | segundos, CSS, amplitudes libres |
| AssetIntent | solicitud de adquisición derivada del slot e intención | píxeles, geometría |
| AssetCandidate | posibilidad remota | aprobación o uso en escena |
| DownloadRequest | URL candidata y límites de una operación | composición |
| DownloadedAsset | temporal recibido, tamaño/estado de descarga | aprobación/identidad visual |
| AssetValidation | mediciones de archivo/seguridad | política o montaje |
| AssetSourceRecord | proveedor, URLs, versión, licencia, atribución, fecha/riesgo | motion o escena |
| ProjectAsset | archivo aprobado con refs de validación y procedencia | listado de escenas, motion o uso |
| AssetManifest | inventario de assets/validaciones/procedencia por proyecto | ProjectSubstrate/timeline |
| SubjectBounds | contenido visible dentro del archivo, revisión de medición | posición de escena |
| ResolvedScenePlan | assets por slot, refs, SHA/MIME/bounds y decisiones/fallback | React/CSS libre o geometría paralela |
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

## Adquisición y persistencia: propuesta mínima, no schema productivo

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
Manifest vive propuesto en materiales/assets/manifest.json. relativeFile
relativo a raíz del proyecto. Estado versionado guarda schemaVersion,
projectSubstrate y referencias de uso/timeline, no otra copia de archivos.
3.4A debe probar migración/default legacy, guardado atómico y recuperación;
no hay manifest productivo ni materiales/assets/ por escribir estos contratos.

## Lifecycle y hash

1. SceneIntent + ProjectSubstrate → Recipe (metáfora/slots o editorial-text).
2. Adquisición deriva AssetIntent; busca inventario local válido antes de provider.
3. Candidate → DownloadRequest → temporal, sin publicar aún.
4. Validar MIME/magic, límites, dimensiones, SVG/alpha, SHA y riesgo.
5. Publicar archivo + inventario recuperables de forma atómica por proyecto.
6. ResolvedScenePlan registra slots y decisiones de densidad/paleta/fuentes/fallback.
7. Compilar RenderSpec + RenderBindings: identidad y localización separadas.
8. Verificar locators contra SHA, retener bytes verificados, hashear
   graphicData.extra.sceneSpec y clave React correspondiente.
9. visual_escena pinta el resultado ya elegido dentro de geometría de estructura;
   el Visual termina como vídeo en timeline, no clip PNG paralelo.
10. Si faltan/cambian bytes, aviso y rechazo de captura o recompilación/fallback
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

No ResolvedAsset gigante ni inventario global nuevo. OpenMoji primero; PurePNG
condicionado, PNGImages pendiente, APIs/removedor/ByPeople/IA posteriores.
