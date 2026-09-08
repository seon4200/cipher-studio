# 3.4C — round trip de un SVG OpenMoji por proyecto

**Estado de esta rama:** implementación y prueba local completas en
openmoji-asset-roundtrip-3-4c; la integración y el checkpoint se cierran sólo
después de la certificación en clon nuevo. Esta fase publica únicamente el SVG
oficial ya incluido en el catálogo local: openmoji:1f382 / birthday cake / 1F382.
No selecciona assets por semántica, no llama a red y no dibuja nada.

## API interna y raíz explícita

El módulo src/main/assets/openmoji/publish.ts expone, sin IPC ni UI,
publishOpenMojiAsset({ projectRoot, stableId }) y
verifyProjectAssetContent(projectRoot, assetRecord).

projectRoot es obligatorio, absoluto y se valida antes de tocar el catálogo o el
disco del proyecto. La API rechaza undefined, null, vacío, relativo,
process.cwd(), la raíz del repositorio, .git, raíz enlazada/junction, estado
ausente/no regular/inválido/futuro y cualquier ruta de asset que salga del
proyecto. No consulta activeProjectPath, no hereda el fallback histórico a cwd y
no introduce uno nuevo.

La validación de raíz usa los consumidores reales loadProjectFile,
readAssetStorage, resolveProjectRelativePath y saveAssetManifest. Así no aparece
un segundo schema, lector de manifest ni escritor JSON.

## SVG seleccionado: bytes exactos y validación profunda

La publicación resuelve una entrada del catálogo local OpenMoji 17.0.0 y usa
resolveOpenMojiSvgCatalogPath para el único SVG solicitado; no enumera ni abre
los otros 4.494. Luego lee los bytes una vez, calcula SHA-256 y aplica la
revisión openmoji-svg-v1:

- archivo regular, .svg, UTF-8, no vacío y máximo 512 KiB;
- preámbulo XML/SVG, raíz svg y viewBox de cuatro números finitos con ancho y
  alto positivos;
- sin NUL, DOCTYPE, ENTITY, script, foreignObject, iframe, object, embed, on*,
  @import, href/xlink:href/src externos ni url(...) externo;
- recorrido de todos los nodos XML, incluidos hijos anidados.

La fase declara @xmldom/xmldom@0.9.10 como dependencia runtime exacta. Ya estaba
en el lockfile de forma transitiva, pero validación de seguridad no puede
depender de esa coincidencia accidental. Se usa sólo para parsear el SVG elegido
después de rechazar las construcciones prohibidas; no se añade un parser propio,
no se sanitiza y no se modifica el byte. Válido significa publicar los bytes
exactos; inválido significa rechazar.

El viewBox se comprueba, pero no se guarda como width/height: AssetManifest V1 no
tiene un campo para sus cuatro componentes y 3.4C no amplía ese schema.

## Publicación, identidad y manifest real

El archivo final se publica en:

    <proyecto>/materiales/assets/openmoji/<sha256>.svg

La escritura crea un temporal propio en el mismo directorio con wx, escribe y
sincroniza el descriptor, verifica SHA/tamaño del temporal y usa rename para
publicar. Nunca hace unlink preventivo del destino. Si el destino ya existe,
debe ser archivo regular con el mismo tamaño y SHA; entonces se reutiliza. Bytes
distintos con el mismo nombre SHA son error, nunca sobrescritura silenciosa.

El registro usa AssetManifestV1 real en materiales/assets/manifest.json, con id
openmoji-1f382-<sha12>, provider, relativeFile, SHA, MIME image/svg+xml, tamaño,
fuente, versión 17.0.0, licencia CC BY-SA 4.0, URL de licencia y texto de
atribución desde attribution.ts. sourceUrl identifica el repositorio oficial y
fileUrl el archive npm oficial exacto; son procedencia documental del catálogo
local pinneado, no evidencia de una descarga hecha por esta operación. El campo
existente fetchedAt registra cuándo se materializó el registro local; no afirma
una petición de red durante 3.4C.

Dos publicaciones del mismo contenido producen un único archivo final y un
único registro activo. La segunda devuelve status: reused, incluso si el stableId
llegó con distinto uso de mayúsculas.

## Orden de error y recuperación real

La secuencia es: resolver catálogo → leer → validar → SHA → preparar registro →
publicar archivo → escribir manifest con writeJsonAtomic → reabrir y auditar.

Si la escritura de manifest falla durante un error normal, su principal anterior
queda válido. Si esta operación creó el SVG final, intenta borrar sólo ese archivo
exacto después de comprobar su SHA. Un archivo que ya existía nunca se borra. No
se promete una transacción perfecta frente a corte eléctrico entre archivo y
manifest: puede quedar un archivo huérfano válido; su inventario/reparación global
queda para 3.16. Un temporal incompleto nunca entra al manifest.

verifyProjectAssetContent reaplica confinamiento, archivo regular, extensión,
tamaño, SHA, MIME y la política openmoji-svg-v1 al reabrir. Sus errores incluyen
PROJECT_ASSET_MISSING, PROJECT_ASSET_SIZE_MISMATCH, PROJECT_ASSET_SHA_MISMATCH,
PROJECT_ASSET_MIME_MISMATCH, PROJECT_ASSET_SVG_INVALID y
PROJECT_ASSET_OUTSIDE_PROJECT.

## Round trip offline comprobado

tests/openmoji-asset-roundtrip.js importa el bundle main compilado real. Crea un
proyecto V1 bajo os.tmpdir mediante createProjectFiles, con marcador
.cipher-test-fixture; no utiliza ninguno de los tres proyectos actuales. Bloquea
fetch, http.request y https.request, publica 1F382, descarta la caché de
catálogo, reabre el manifest desde disco y verifica otra vez bytes/SHA/atribución.

La suite tiene 50 casos y termina con CASOS_COMPLETADOS=50 y
CASOS_ESPERADOS=50, o falla. Cubre raíces peligrosas, schema futuro, stableId
inexistente, SVG malicioso, junctions, rutas con traversal, falta/cambio de
archivo, idempotencia, manifest fallido con rollback limitado, temporal huérfano
no aceptado, ausencia de red y huella intacta de los proyectos reales. El runner
real pasa de 11 a 12 suites.

## Lo que 3.4C no hace

- No hay Hero, renderer, visual_escena, timeline, FFmpeg, Motion, RenderSpec,
  hash de gráfico ni subida de VERSION_PLANTILLAS (permanece en 12).
- No hay búsqueda automática, Asset Resolver, provider remoto, download, PNG,
  Photo Hero, AttentionIntent, UI ni IPC nuevo.
- No se publica SVG en los tres proyectos reales ni se crea un manifest real en
  ellos; el único asset vive y se limpia dentro de los fixtures temporales.

Cuando una fase futura llegue a dibujar el asset, el resultado materializado
(estado presente/ausente, SHA, tinte, ajuste, revisión y motion efectivos) deberá
entrar en RenderSpec/PixelIdentity. Provider, URL, licencia, path,
AttentionIntent y candidatos permanecen fuera de extra.sceneSpec y fuera de la
identidad de píxeles. Esta fase documenta la regla; no cambia aún esa proyección.

