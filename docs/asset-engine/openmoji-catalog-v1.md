# 3.4B — catálogo OpenMoji oficial, local y offline

**Estado:** implementado en la rama **openmoji-catalog-3-4b**; no está mergeado ni
etiquetado. No crea ProjectAssetRecord, no escribe AssetManifest, no copia SVG a
un proyecto, no abre IPC y no dibuja Hero.

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
process.cwd(). Rechaza paquete distinto de 17.0.0, metadata no-array, hexcode
duplicado o SVG color ausente. Genera, fuera de Git:

    dist-electron/openmoji/
      catalog-resource.json       # derivado: versión, conteos y rutas fijas
      data/openmoji.json          # metadata oficial sin modificar
      color/svg/<HEX>.svg         # sólo SVG color oficial
      LICENSE.txt                 # licencia del paquete oficial

No copia black, PNG 72/618, fuentes, sprites, tests, src ni helpers de OpenMoji.
El recurso generado medido contiene 4.498 archivos y 16.387.404 bytes: 4.495
SVG, metadata, licencia y manifiesto derivado. Está ignorado por Git.

En desarrollo, tests y build, resolveOpenMojiCatalogResourceRoot resuelve
dist-electron/openmoji desde el directorio compilado del main. En la aplicación
empaquetada resuelve process.resourcesPath/openmoji; package.json excluye el
directorio generado de app.asar y lo declara como build.extraResources. No hay
CDN, fetch, http.request, https.request, ruta absoluta del PC ni dependencia de
node_modules/openmoji en tiempo de consulta.

La inclusión se comprobó en dos niveles: la suite comprueba el recurso construido
y un empaquetado Windows temporal comprobó resources/openmoji con manifest,
metadata, licencia y 1F382.svg. Esa comprobación certifica presencia y rutas; no
es una sesión interactiva de la aplicación instalada.

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

catalog-resource.json también es derivado: transporta versión y conteos desde el
package.json oficial. No es metadata oficial ni identidad de un asset de proyecto.

El cargador valida versión exacta, shape array, IDs/hexcodes únicos, aliases a
IDs existentes, confinamiento/realpath, extensión, tamaño y preámbulo SVG/XML de
cada SVG indexado. En 17.0.0 no hubo hexcode duplicado, SVG faltante ni warning.
Una excepción futura sólo puede excluirse si está declarada explícitamente en el
manifiesto de recurso; un faltante inesperado falla con código estable.

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
dist-electron/main/index.js. Bloquea global.fetch, http.request y https.request,
y los 25 casos pasan sin intento de red. Cubre metadata, IDs, SVG locales,
confinamiento, annotation, emoji, hex, tokens, grupos, aliases españoles,
food-sweet, birthday cake, versiones/aliases/SVG inválidos, traversal, atribución,
orden y recurso build. El runner sube a 11 suites.

Mediciones de primera pasada fría en el host de cierre: carga y validación de
4.495 entradas/SVG en 808,5 ms; dos búsquedas sweet filtradas en 4,238 ms. Son
mediciones de ese host, no presupuestos universales. El generador añadió 2.511,4
ms en la última corrida de build; no se afirma una diferencia total de build sin
un A/B controlado.

## Límites y siguiente paso

No hay descarga por vídeo, búsqueda de proveedor, ProjectAsset, AssetManifest
real, SHA de asset publicado, validación profunda/sanitización/rasterización de
SVG, data URI, tinte, Hero, RenderSpec, SceneIntent ni cambio de píxeles.
VERSION_PLANTILLAS permanece en 12.

**3.4C** debe hacer un solo round trip autorizado: resolver birthday cake,
validar el SVG elegido de verdad, calcular SHA-256, copiarlo atómicamente a
materiales/assets/openmoji, registrarlo en AssetManifest y comprobar reapertura
offline. No debe dibujarlo todavía.
