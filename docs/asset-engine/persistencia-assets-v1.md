# Persistencia de proyectos y assets V1 — 3.4A

Base: master 0444fea / v-scene-recipe-editorial-v1. Implementación en
asset-persistence-3-4a, candidatos 3338991 y 6b8dddf. Sin merge, tag ni push.
No se implementan selección editorial, descarga, OpenMoji, Hero, RenderSpec ni
movimiento. VERSION_PLANTILLAS permanece 12; la persistencia no alimenta el hash.

## Autoridades y contratos reales

- src/shared/project-state.ts es la única autoridad de
  PROJECT_STATE_SCHEMA_VERSION=1 y ASSET_MANIFEST_VERSION=1.
- project-state.json mantiene editor/timeline/campos desconocidos y
  projectSubstrate: ProjectSubstrate | null. No contiene el inventario ni la ruta
  al manifiesto; ésta es una convención fija.
- materiales/assets/manifest.json contiene assetManifestVersion y assets.
  Cada ProjectAssetRecord guarda id/provider/relativeFile/SHA/MIME/byteLength,
  source y validation. La forma mínima 3.4A agrupa procedencia/validación por
  archivo; NO implementa las tablas sources/validations con referencias que el
  ejemplo conceptual 3.3.5 dejaba abiertas. No duplica los mismos datos en estado.
- El disco contiene bytes. La auditoría física V1 verifica presencia/tamaño y
  confinamiento, NO SHA real, MIME/magic, SVG ni alpha. Un status declarado
  accepted no demuestra esas comprobaciones futuras.

ProjectSubstrate conserva exactamente los enums de la especificación y versión 1.
brandMarkId, si existe, debe ser ID alfanumérico con guion/underscore; se rechazan
campos extra, CSS, URLs, paths y colores. Null significa aún no seleccionado.
Proyectos nuevos y legacy sin el campo usan null; ninguna elección aleatoria.

## Migración y guardado sin pérdida de campos

migrateProjectState(raw) es pura: state, sourceVersion, targetVersion, migrated,
warnings. Ausencia de schemaVersion es legacy 0; conserva todos sus campos,
incluidas rutas absolutas de clips, añade versión 1 y substrate null si faltaba.
No escribe al cargar. Una versión explícita 0, strings, null o fracciones es
inválida; una versión futura produce PROJECT_STATE_UNSUPPORTED_VERSION con
found/supported, sin intentar esconderla mediante backup.

V1 válido se conserva. Un substrate inválido produce PROJECT_SUBSTRATE_INVALID:
se rechaza la carga/guardado sin borrar el archivo ni el resto de sus campos.
No se normaliza silenciosamente a null. La UI no ofrece aún reparación de schema.

El renderer actual no conoce ni envía estos campos nuevos. saveProjectFile
combina el estado previo validado con el payload del editor y lo migra/valida;
los campos desconocidos ausentes del payload sobreviven. No se modificó React
ni se añadió otra autoridad de schema. Date conserva la actualización normal.
Guardar como usa el archivo de origen capturado ANTES del diálogo, incluso si
cambia el proyecto activo durante la espera. El destino también se valida antes
de reemplazarlo; una versión futura no se sobrescribe.

## Integración real, sin IPC de assets nuevo

| Camino existente | Consumidor nuevo |
|---|---|
| create-project | createProjectFiles: estado V1 + ensureAssetStorage vacío; activa sólo después de crearlos |
| load-project / open-project | loadProjectFile: migración y recovery en memoria, auditoría de manifest separada |
| load-project-state | misma carga recuperable, también en fallback histórico de cwd |
| save-project-state (manual/autosave/cierre) | saveProjectFile + writeJsonAtomic |
| save-project-as | mismo helper y origen capturado antes del diálogo |

Los IPC devuelven code/details en errores y persistence con status/warnings y
auditoría de assets al cargar. No se añadieron pantallas ni eventos de búsqueda.
El renderer existente no presenta aún un aviso específico de recuperación:
la traza tipada queda en la respuesta; su presentación queda pendiente.
list-projects sigue leyendo el JSON para listar metadatos, no migra ni recupera
el listado desde backup. No confundir listado con los caminos de apertura.

Legacy sin manifest: status absent, abre normalmente, sin crear assets/ por abrir.
ensureAssetStorage es explícito e idempotente; crea un manifest vacío sólo si no
hay principal ni backup reconocible. Un manifest inválido/futuro se devuelve
como auditoría invalid/unsupported-version, no bloquea timeline sin uso de assets.
No se produce ningún fallback visual.

## Manifest y rutas

Formato vacío real:

~~~json
{"assetManifestVersion":1,"assets":[]}
~~~

Validaciones: versión exacta, array, campos cerrados, IDs no vacíos/únicos,
provider como ID, ruta confinada y carpeta coincidente con provider, MIME no vacío,
64 hex minúsculos para SHA, byteLength entero seguro no negativo, estados
accepted/needs-review/rejected, revision no vacía, warnings de strings,
dimensiones positivas si existen, booleans alpha y fechas válidas.
URLs de source, si existen, HTTPS sin credenciales. No son una licencia verificada.

Se rechazan duplicados de relativeFile con comparación insensible a mayúsculas,
y dos registros activos con misma SHA+MIME+provider. Un registro rejected puede
conservar esa combinación como historia, pero no duplicar ID ni ruta.

normalizeProjectRelativePath normaliza backslash a slash. Rechaza absoluto, UNC,
drive/ADS, URL, segmentos vacíos, punto/doble punto, controles, nombres reservados
Windows y terminaciones punto/espacio. Assets sólo bajo
materiales/assets/<provider>/<archivo>, relativo a raíz del proyecto.

resolveProjectRelativePath comprueba también ancestros existentes con lstat y
realpath cuando existe destino. Política V1 conservadora: rechazar TODOS los
symlinks/junctions en el recorrido, incluso internos, no sólo los externos.
Se probaron junctions reales de Windows. No protege frente a un proceso externo
que sustituya rutas entre comprobación y uso: no es un sandbox de filesystem ni
hay bloqueo multiproceso. La ruta jamás entra en hash/identidad.

auditAssetManifest distingue:
- estructural: sin accesos al filesystem, validación/normalización/duplicados;
- físico: añade recorrido confinado, existencia y byteLength/archivo regular.
Devuelve errors/warnings/missingAssets/outsideAssets/duplicateIds/duplicatePaths.
Un error de schema detiene esa parte al primer fallo; no promete inventario
exhaustivo de todos los errores de un JSON inválido. En schema válido, recorre
todos los registros para incidencias físicas.

## Escritura: garantía concreta en Windows

writeJsonAtomic es el ÚNICO helper para estado y manifest, sin dependencias nuevas:

1. Serializar y validar el JSON que se va a publicar.
2. Validar principal o backup anterior; rechazar versiones futuras/errores de
   seguridad o substrate en vez de reemplazarlos.
3. Crear con wx un temporal .<target>.cipher-<UUID>.tmp en el mismo directorio.
4. Escribir completo y fsync del descriptor, cerrar.
5. Si existía versión válida, conservar sus bytes exactos en un temporal de backup,
   sincronizarlo y publicar por rename como <target>.bak.
6. rename del temporal completo sobre target. NO hay unlink previo ni fallback
   que elimine el principal cuando Windows devuelve error.
7. Limpiar sólo temporales creados por ESTA operación. Restos previos se informan,
   no se eligen ni se borran automáticamente.

La prueba Windows observa reemplazo correcto sobre destino existente, backup
válido y fallo inyectado justo antes de publicar dejando principal anterior
intacto. Es reemplazo por rename + secuencia recuperable con backup: NO garantía
de transacción conjunta entre estado/manifest, ni de durabilidad perfecta frente
a corte eléctrico. No hay fsync del directorio Windows ni bloqueo entre procesos.
La secuencia síncrona serializa guardados dentro del proceso main; JSON grandes
pueden bloquearlo temporalmente (no medido). No se cambian proyectos reales
durante las pruebas.

## Recuperación y trazabilidad

readJsonRecoverable es la carga común:
principal válido/soportado → principal; JSON corrupto o schema estructural
inválido recuperable → intentar .bak; backup válido → recovered-from-backup.
No reescribe el principal al leer. Principal ausente + backup válido también
recupera. Ambos inválidos/ausentes donde se esperaba estado → error, nunca vacío.

Versiones futuras y errores de versión/substrate/confinamiento no se ocultan
con un backup más antiguo. Un guardado explícito posterior puede reparar un
principal corrupto sólo si existe copia válida, conservándola.

Códigos relevantes:
PROJECT_STATE_MIGRATED_IN_MEMORY, PROJECT_STATE_RECOVERED_FROM_BACKUP,
ASSET_MANIFEST_RECOVERED_FROM_BACKUP, PROJECT_STATE_UNSUPPORTED_VERSION,
ASSET_MANIFEST_UNSUPPORTED_VERSION, PROJECT_SUBSTRATE_INVALID,
PROJECT_STATE_INVALID_VERSION, ASSET_MANIFEST_PATH_OUTSIDE_PROJECT,
*_INVALID_JSON, *_UNRECOVERABLE, *_WRITE_FAILED, *_TEMPORARIES_PRESENT.
UNRECOVERABLE conserva en details los códigos de principal/backup.
readAssetStorage devuelve estado y warnings; no inventa que leyó el principal.
Temporales no se prefieren a un principal válido, aunque aparenten versión nueva.

## Verificación reproducible

~~~powershell
npm ci --no-audit --no-fund
npx tsc --noEmit
npm run build
npm run test:assets-persistencia
npm test
git diff --check
~~~

La nueva suite importa los exports de los consumidores REALES del bundle main,
como las suites existentes; no copia migración, confinamiento ni escritura.
25 grupos de casos, fixtures creados con mkdtemp en os.tmpdir(): schema legacy/V1/
futuro/inválido, unknown fields, substrate, manifest vacío/idempotencia/duplicados,
rutas, SHA declarada, size, junction externa, backup/corrupción/fallo inyectado,
temporales propios/ajenos e IPC. Guardar como se prueba también con cambio de
proyecto mientras el diálogo está pendiente. Round trip independiente con estado,
substrate y manifest vacío; fixture físico de cinco bytes, no asset de terceros.

El runner real incorpora test:assets-persistencia y ESPERADAS=10. test:ventana
sigue excluida por el fallo histórico documentado, sin alterar sus aserciones.
No se usa la frase 9/9 para este cierre.

### Evidencia de cierre (07/09/2026)

Código final verificado: **6b8dddfa9a0ac500d77202061272dab143ab0a12**.
Clon real nuevo: C:\cipher-verifications\asset-3-4a-6b8dddf, creado con
git clone --no-local --single-branch. Árbol limpio antes de npm ci; ausencia
comprobada de C:\node_modules y C:\cipher-verifications\node_modules.
Sin borradores ni fixtures antes de comenzar; el clon quedó consumido por pruebas.

- npm ci --no-audit --no-fund: exit 0, 413 paquetes del lock existente.
- npx tsc --noEmit: exit 0; npm run build: exit 0.
- Build por ficheros: dist 17 archivos / 11.092.262 bytes; main/index.js 633.939,
  main/index.js.map 1.221.298; preload/index.js 4.981, map 8.512 bytes.
- npm test: **10/10**, exit 0. Nueva suite específica repetida: **25 grupos**,
  exit 0 en win32; Node del host v24.15.0 / npm 11.12.1.
- Fixture de última tirada: directorio temporal cipher-assets-persistence-1gKZty
  en os.tmpdir(), no un proyecto real. Fixtures inválidos son deliberados y las
  pruebas esperan rechazo; los estados/manifests válidos se parsean y comparan.
- 61 project-state.json reales: SHA-256, byteLength y mtime antes/después
  idénticos. No se usaron como fixtures ni se abrieron con la app.
- Diff vacío frente a 0444fea en renderer, preload, shared/escena, semilla,
  sistemas, package-lock y Vite. hashGrafico, canonizar, renderGraphicClip,
  sistemaDeGeneracion y dimensionesDeExport idénticos al extraer sus nodos TS
  normalizando CRLF/LF. La comparación inicial sin normalizar marcó una diferencia
  de saltos; también se amplió la extracción para incluir const canonizar.
  No eran cambios productivos. SHA textual LF de hashGrafico:
  406f835752dbc955341159ff73ac2586b4320bd0c3ca7a41f1bae29a4593f1dd.

El primer candidato 3338991 también pasó 10/10 en otro clon; no se reutilizó
ese clon para certificar la corrección de Guardar como. El build inicial en
sandbox falló por permisos del directorio padre de Vite; se ejecutó de nuevo con
acceso autorizado. No se interpretó ese fallo de permisos como fallo de código.
Warnings heredados de paquetes obsoletos y tamaño del bundle quedan sin tocar.
El commit de cierre posterior sólo añade documentación; no altera este código.

## Límites y siguiente paso

Migración/portabilidad de rutas absolutas de clips sigue como deuda separada:
no se reescribieron ni copiaron archivos existentes. Guardar como conserva el
comportamiento histórico de guardar JSON, no copia el proyecto/materiales.
No hay selector de Substrate, manifest en renderer, SHA de archivos verificado,
validación de imagen, descargas ni dibujo. No se promete quality/contraste/motion.

3.4B: seleccionar catálogo OpenMoji pinneado, metadata local, atribución,
nombres/grupos/aliases y offline. 3.4C: un SVG real y round trip offline.
Ninguno se inició en 3.4A.
