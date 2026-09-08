# 3.4B — catálogo OpenMoji oficial, local y offline

**Estado:** integrado localmente en `master` mediante merge `5bf8635`; el retorno
`v-openmoji-catalog-v1` apunta al cierre documental posterior. No crea
ProjectAssetRecord, no escribe AssetManifest, no copia SVG a un proyecto, no abre
IPC y no dibuja Hero.

## Fuente y pin

La única fuente es el paquete oficial npm **openmoji@17.0.0**, incorporado como
**devDependency exacta**. Sólo participa durante predev/prebuild para generar un
recurso de aplicación: no es una dependencia del usuario final ni se consulta
por red durante búsqueda, selección, render o reapertura.

| Medido antes de instalar | Valor |
|---|---:|
| tarball | 4.339.458 bytes |
| integridad npm | sha512-EBnYrNGdcdw+OSXmENeNE1yBNRu6tOraTmoOyUbJkTmvT/+XETp8RZLSJFzD3lrPc5N9CzsyPnRTk0Vp4UaI9w== |
| archivos / bytes descomprimidos | 11.539 / 43.405.090 |
| data/openmoji.json | 2.193.231 bytes, 4.495 entradas |
| color/svg | 4.495 SVG / 14.173.685 bytes |
| licencia | LICENSE.txt, CC BY-SA-4.0 |

El paquete declara el repositorio oficial https://github.com/hfg-gmuend/openmoji
y la página https://openmoji.org/. La integridad queda anclada en package-lock;
no se afirma haber verificado la firma npm.

| Alternativa | Resultado |
|---|---|
| A · dependencia runtime completa | Despacharía los 43.405.090 bytes y 11.539 archivos, incluidos formatos, fuentes, tests y helpers que Cipher no usa. Se descarta. |
| **B · devDependency + recurso selectivo** | Copia durante build sólo metadata, SVG color, licencia y un manifiesto derivado. Es la opción implementada. |
| C · release oficial pinneada | Mantendría offline, pero adelanta un downloader/release manager que aún no hace falta. No se implementa. |

## Recurso local y empaquetado

**scripts/prepare-openmoji-catalog.cjs** parte de su propio directorio, no de
process.cwd(). Es la validación exhaustiva de preparación/build: rechaza paquete
distinto de 17.0.0, metadata no-array o con conteo distinto de 4.495, hexcode
duplicado, licencia incompatible, ruta fuera de `color/svg`, archivo no regular,
SVG vacío o preámbulo que no sea SVG/XML. Recorre los 4.495 SVG sólo aquí y luego
genera, fuera de Git:

    dist-electron/openmoji/
      catalog-resource.json       # derivado: versión, conteos y rutas fijas
      data/openmoji.json          # metadata oficial sin modificar
      color/svg/<HEX>.svg         # sólo SVG color oficial
      LICENSE.txt                 # licencia del paquete oficial

No copia black, PNG 72/618, fuentes, sprites, tests, src ni helpers de OpenMoji.
El manifiesto derivado fija esquema, versión, conteos, rutas fijas, SHA-256 de
metadata, SHA-256 de la lista ordenada ruta+tamaño, revisión del generador y un
fingerprint determinista de esos campos. No lleva timestamp de identidad. El
recurso generado medido contiene 4.498 archivos y 16.387.737 bytes: 4.495 SVG,
metadata, licencia y manifiesto derivado. Está ignorado por Git.

En desarrollo, tests y build, resolveOpenMojiCatalogResourceRoot resuelve
dist-electron/openmoji desde el directorio compilado del main. En la aplicación
empaquetada resuelve process.resourcesPath/openmoji; package.json excluye el
directorio generado de app.asar y lo declara como build.extraResources. No hay
CDN, fetch, http.request, https.request, ruta absoluta del PC ni dependencia de
node_modules/openmoji en tiempo de consulta.

La inclusión se comprobó en dos niveles: la suite comprueba el recurso construido
y un empaquetado Windows temporal comprobó `resources/openmoji` con manifiesto,
metadata, licencia y `1F382.svg`. El consumidor compilado cargó explícitamente
esa raíz empaquetada, obtuvo las 4.495 entradas y resolvió `birthday cake` /
`1F382.svg`. Eso certifica presencia, rutas y carga del recurso; no es una sesión
interactiva de la aplicación instalada.

El empaquetado final medido dejó 4.498 archivos y 16.387.404 bytes en
`resources/openmoji`, cero entradas OpenMoji en `app.asar`, y conserva el main,
preload y dependencias de producción dentro del ASAR. La regla de empaquetado
excluye expresamente `dist/win-unpacked/**` para no empaquetar su propia salida.

## Metadata oficial y campos derivados

La forma real de cada entrada de data/openmoji.json incluye emoji, hexcode, group,
subgroups, annotation, tags, openmoji_tags, autor/fecha, skintone, Unicode y
orden. 3.4B consume los campos necesarios y no muta ese JSON.

| Campo de OpenMojiCatalogEntry | Procedencia |
|---|---|
| hexcode, emoji, annotation, group, subgroup | oficial; subgroups se expone singular |
| tags | derivado de tags + openmoji_tags, separado y deduplicado |
| stableId | derivado determinista: openmoji:<hexcode normalizado en minúscula> |
| normalizedAnnotation | derivado para comparar, no para mostrar |
| aliases | aliases controlados de Cipher |
| svgRelativeFile | derivado fijo color/svg/<HEX>.svg |

catalog-resource.json también es derivado: transporta versión, conteos y
fingerprints de preparación. No es metadata oficial ni identidad de un asset de
proyecto.

La validación queda separada explícitamente:

| Momento | Responsable | Qué comprueba | Qué no hace |
|---|---|---|---|
| preparación/build | `prepare-openmoji-catalog.cjs` | paquete exacto, 4.495 metadata/SVG, rutas, archivos, tamaños, preámbulos, licencia y fingerprints | no se usa durante búsqueda de usuario |
| carga runtime | `loadOpenMojiCatalog()` | manifiesto, versión, metadata SHA, conteos, IDs/hexcodes, aliases y rutas derivables confinadas | no abre, enumera, hace stat, lstat o realpath de `color/svg` |
| resolución lazy | `resolveOpenMojiSvgCatalogPath()` | sólo el SVG elegido: confinamiento, realpath, archivo regular, extensión, tamaño y preámbulo | no valida el resto del catálogo |

En 17.0.0 no hubo hexcode duplicado, SVG declarado faltante ni warning. Una
excepción futura sólo puede excluirse si está declarada explícitamente en el
manifiesto; un SVG solicitado pero ausente falla con código estable, sin mantener
la falsa pretensión de haber revalidado los otros 4.494.

## API y búsqueda

**src/main/assets/openmoji/catalog.ts** es un módulo de proceso principal sin IPC
ni escrituras. Expone loadOpenMojiCatalog, searchOpenMoji, getOpenMojiEntry,
getOpenMojiEntryByHexcode, listOpenMojiGroups, listOpenMojiSubgroups,
resolveOpenMojiSvgCatalogPath, resolveOpenMojiCatalogResourceRoot y
getOpenMojiCatalogInfo.

La normalización aplica trim, minúscula, NFKD sin diacríticos y equivalencia de
espacios/guiones/guiones bajos. No traduce libremente, no usa Levenshtein ni fuzzy
matching. La prioridad es:

1. emoji exacto (600);
2. hexcode exacto (500);
3. annotation exacta (400);
4. alias exacto (300);
5. todos los tokens presentes en annotation/tags/aliases (200);
6. prefijo de token sólo si produce un único candidato (100).

El desempate estable es score descendente, annotation normalizada, hexcode y
stableId. Consulta vacía, filtro inválido o limit fuera de 1–50 fallan con
OPENMOJI_QUERY_INVALID. La API devuelve candidatos, no selecciona un asset
ambiguo.

Errores tipados: OPENMOJI_CATALOG_NOT_FOUND, OPENMOJI_METADATA_INVALID,
OPENMOJI_VERSION_MISMATCH, OPENMOJI_DUPLICATE_ID, OPENMOJI_SVG_NOT_FOUND,
OPENMOJI_PATH_OUTSIDE_CATALOG, OPENMOJI_QUERY_INVALID y OPENMOJI_ALIAS_INVALID.

## Food-drink / food-sweet y aliases iniciales

Los valores oficiales medidos son literalmente food-drink y food-sweet. Contienen
14 entradas en 17.0.0. birthday cake es 1F382 y su SVG local es
color/svg/1F382.svg.

Los aliases de Cipher están separados en
**src/main/assets/openmoji/openmoji-aliases.es.json**, revisión 1. Las consultas
pastel, torta, tarta, pastel de cumpleaños, cumpleaños, cupcake, dona, donut,
rosquilla, galleta, chocolate, caramelo, dulce, piruleta y helado están cubiertas
por metadata o alias. Los términos ambiguos (pastel, torta, tarta, dulce,
helado) devuelven más de un candidato cuando corresponde; no se convierten en una
selección silenciosa.

## Atribución

**src/main/assets/openmoji/attribution.ts** es la única autoridad de atribución:
OpenMoji 17.0.0, CC BY-SA-4.0, atribución requerida, página oficial, repositorio
y revisión openmoji-catalog-v1. El texto recomendado por Cipher es:

> OpenMoji 17.0.0 — CC BY-SA 4.0 — https://openmoji.org/

La URL y la versión son procedencia, no identidad visual. 3.4C deberá guardar la
atribución y la SHA real del SVG que publique en un proyecto.

## Offline, pruebas y mediciones

**tests/openmoji-catalog.js** importa el consumidor compilado real desde
dist-electron/main/index.js. Bloquea global.fetch, http.request y https.request;
sus 30 casos terminan con `CASOS_COMPLETADOS=30` y
`CASOS_ESPERADOS=30`, o fallan. Una instrumentación de `stat`, `lstat`,
`realpath`, `readdir`, lectura y apertura falla si carga, búsqueda, consulta o
lista toca `color/svg`; `birthday cake` (`1F382`) demuestra después una única
inspección lazy. Cubre además caché reiniciable, manifiesto/fingerprint inválido,
metadata SHA, aliases, traversal, SVG ausente o inválido, scoring, orden,
atribución y ausencia de red. El runner conserva 11 suites.

La línea histórica de 808,5 ms se tomó en un host con estado de filesystem no
controlado; se conserva como medida histórica, pero no sirve como baseline de
clon. El baseline pertinente antes de separar las capas fue **36,2 s** en un
clon nuevo: `loadOpenMojiCatalog()` recorría 4.495 SVG y hacía como mínimo
realpath + stat + open + read + close por cada uno (22.475 operaciones SVG,
además de metadata/manifiesto). Esa es la causa, no el scoring.

Tras la separación, tres procesos Electron independientes en este host midieron
la carga de primer proceso en **62,7 / 68,5 / 77,5 ms** (mínimo / mediana /
máximo), sin inspecciones SVG. No se llama "cold filesystem": la caché del SO no
se controló. Dos accesos consecutivos cached en el mismo proceso tardaron 0,005
ms y leyeron metadata una sola vez; dos búsquedas filtradas `sweet` tardaron
3,652 ms; la validación lazy de `1F382.svg` tardó 0,924 ms e inspeccionó un solo
SVG. La preparación exhaustiva de build tomó 4.740,5 ms, generando 4.498
archivos / 16.387.737 bytes. Son mediciones de este host, no presupuestos
universales.

La certificación desde clon nuevo de `b747573`, creado sin `node_modules`, repitió
`npm ci`, typecheck, build, la suite OpenMoji y las 11/11 suites. Sus tres cargas
de primer proceso fueron **60,1 / 61,1 / 71,4 ms** (mínimo / mediana / máximo),
también con cero inspecciones SVG durante carga/búsqueda. El commit posterior a
esa certificación, si sólo cambia documentación, conserva el mismo árbol de
código probado.

## Límites y siguiente paso

No hay descarga por vídeo, búsqueda de proveedor, ProjectAsset, AssetManifest
real, SHA de asset publicado, validación profunda/sanitización/rasterización de
SVG, data URI, tinte, Hero, RenderSpec, SceneIntent ni cambio de píxeles.
VERSION_PLANTILLAS permanece en 12.

**3.4C** debe hacer un solo round trip autorizado: resolver birthday cake,
validar el SVG elegido de verdad, calcular SHA-256, copiarlo atómicamente a
materiales/assets/openmoji, registrarlo en AssetManifest y comprobar reapertura
offline. No debe dibujarlo todavía.
