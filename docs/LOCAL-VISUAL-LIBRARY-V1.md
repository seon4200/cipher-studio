# Local Visual Library V1 — extensión de Modern Pack

Base: `baad60548afed7cb21a8d0575e0041bc45d71cfa`.
Rama: `v15-local-visual-library-v1`. VERSION_PLANTILLAS=15.
No catálogo paralelo, nuevo renderer, reglas semánticas ni descargas.

## Seguridad y reanudación

Bundle completo verificado: `%CIPHER_LOCAL_ROOT%/_safety-backups/cipher-before-local-visual-library-20260919-070119.bundle`.
337290499 bytes; SHA256 `6C7E7609727434A28A96BDEE56BD3D6F727786BFE817456C4504997A3B71E668`.
Misma unidad C: no es redundancia física. Copia externa del .bak:
`%CIPHER_LOCAL_ROOT%/_safety-backups/local-library-20260919-070119-project-state.json.bak`.
Original y copia: `F24A2BF434DB6601785AA5F62B0427E67DA85655B22C9776A6DEE8BE984FF66B`.
No modificar/incluir el original en commits. No proyectos reales, .env, inventario ni userData reales.

Estado de cierre: implementación, build, pruebas dirigidas, UI y runner completo PASS.
Resultado real del runner: 36/36, exit 0; exclusión histórica test:ventana intacta.

## Una API, dos proveedores

`src/main/assets/modern-visual-pack.ts` conserva sus cuatro funciones públicas de 3.2.
Sus argumentos anteriores siguen significando **embedded-only**. Se añaden argumentos
opcionales, no un segundo camino de selección/publicación.

`CatalogProviderV1`: `search`, `getById`, `getVariants`, `resolveAsset`, `entries`.
`EmbeddedManifestCatalog` y `LocalManifestCatalog` reutilizan `LiteralManifestIndex`.
`CompositeVisualCatalog` reúne ambos y elimina duplicados por SHA, con preferencia
del embebido. Un ID duplicado es error; no se permite sobrescribir un asset del pack.
`origin=embedded|local` queda en metadata; `identity.id` identifica pack/biblioteca.
El renderer sigue recibiendo ProjectAsset/RenderBindings y no conoce esos proveedores.

No se introdujo SQLite/FTS5: no era obligatorio y la búsqueda contractual es literal,
no textual difusa. El índice invertido de formas reutiliza `narrativeTermFormsV1` una
vez en carga: no recorre todo el catálogo ante cada fallo. Las mediciones registradas
de 100/500/1500/5000 entradas están en `results.json`. Son metadata sintética, no
5000 imágenes validadas. Un futuro backend SQLite puede implementar la misma interfaz
sin SQL en resolver/renderer ni otro ranking; **no está implementado en V1**.

Las colecciones se declaran explícitamente en el manifest y requieren aprobación
de licencia, responsable, fecha y styleFamily coincidente. V1 sólo admite SVG estático,
fuentes fluent/iconify/tabler, estilos modern-color/modern-line/modern-solid y
licencias MIT/ISC/Apache-2.0. Esto valida el contrato de curación, no prueba por sí solo
que alguien tenga derechos sobre un archivo. La curación/procedencia sigue siendo humana.

## Activación y carpeta externa

UI → Biblioteca de Visuales → **Pack 100 + biblioteca local (experimental)**.
Es independiente del perfil de presentación. Proyecto antiguo/sin opción: V15 clásica.
Opción Pack 100 existente: sólo sus 95 assets, aunque haya biblioteca externa.
No hay migración automática.

Directorio por defecto: `C:\CipherAssets\VisualLibrary`.
Override opcional del proceso principal: `CIPHER_VISUAL_LIBRARY_PATH` (ruta absoluta
local). No modificar ni versionar .env para usar esta entrega; no contiene credenciales.
No se escribe nada al cargar o consultar una biblioteca; no se copia el seed de 95 SVG.
La ubicación predeterminada no existía durante esta ejecución. Se probó en carpetas
temporales externas; **no se instala una biblioteca curada adicional**.

Para crear una biblioteca propia: copiar la plantilla vacía de
`docs/examples/local-visual-library/manifest.json` a esa carpeta, añadir `assets/`
y `notices/` y completar assets/colecciones después de curación. Puede cambiarse la
carpeta externa sin cambiar el repo. El proceso toma una instantánea de metadata
por sesión de resolución; los cambios se leen en la siguiente generación.

Cada asset conserva los campos de 3.2 y añade `quality` (1–3). Los IDs locales deben
empezar por `local-`; packId también. La revisión debe ser explícita y no debe mutarse
una revisión publicada. Ejemplo de **estructura**, no asset utilizable:

```json
{
  "assetId": "local-library-camera-v1", "canonicalConcept": "camera",
  "aliasesEs": ["cámara"], "aliasesEn": [], "source": "iconify",
  "collection": "COLECCION_REVISADA", "license": "MIT",
  "licenseNotice": "notices/coleccion.txt", "format": "svg",
  "sha256": "REEMPLAZAR_POR_SHA256_REAL", "originalColor": false,
  "styleFamily": "modern-line", "heroAllowed": true, "supportAllowed": true,
  "priority": 80, "quality": 3, "localRelativePath": "assets/camera.svg"
}
```

Entrada correspondiente en `collections`:
`source`, `collection`, `license`, `licenseNotice`, `styleFamily`,
`licenseApproved: true`, `reviewedBy` y `reviewedAt` (fecha válida).
No marcar aprobación sin revisar la fuente/notice. No convertir aliases en metáforas
para rellenar cobertura: no alimentan ConceptLexicon.

## Ranking y límites

La política de representación/foto y los gates se ejecutan donde ya se ejecutaban.
El catálogo sólo participa en la oportunidad icon/symbolic existente. Bypasses directos
OpenMoji/Solar, roles, foto/cutout y presupuestos no cambian.

Se recuperan términos literales del concepto, no sus aliases metafóricos de retrieval.
Exactos de todas las capas antes de variantes singular/plural. Relevance Gate existente
y admisión de rol son obligatorios. Orden único: clase de relevancia, estilo/colección
preferidos en la sesión local, licencia aprobada (puerta obligatoria), calidad/prioridad,
antirrepetición y assetId como desempate determinista. La primera elección local/compuesta
establece la preferencia estilística de la sesión. Si no existe coincidencia compatible,
prevalece relevancia: no se inventan Supports ni se ocultan los fallbacks.

Fluent modern-color original; mono system-tint. Tabler no puede declarar Hero ni color
original. Solar conserva su prioridad simbólica y OpenMoji su fallback. Máximo 1+2 assets.
Un mismo SHA local/embebido se expone sólo una vez. No hay selección por cuota.

## Integridad, ausencia y regeneración

Manifest limitado a 32 MiB/20000 entradas/32 colecciones; SVG a 2 MiB; notices a 256 KiB.
Rutas relativas estrictas, sin UNC, traversal, ADS ni junction/symlink en la cadena.
SHA y SVG se verifican al resolver/materializar; prohibidos scripts, referencias externas,
fuentes, text/image y animación. La indexación no abre todos los SVG.

Ausencia de manifest: `LOCAL_CATALOG_UNAVAILABLE`, fallback a embedded.
Manifest/curación inválidos: `LOCAL_CATALOG_INVALID` + código seguro cuando exista,
fallback a embedded. Archivo individual inválido: razón persistida y siguiente candidato
mediante el resolver existente. Diagnósticos sin rutas/JSON arbitrario.

Una selección local añade su id/revisión/assetId a `catalogAsset`, junto al SHA y tint
que ya forman parte de PixelIdentity. ProjectAsset conserva una instantánea validada
de política/identidad en `source.catalogSnapshot`, **fuera de PixelIdentity**.
Retirar la biblioteca no impide restaurar/renderizar el ProjectAsset publicado.
Si falta o se altera ese ProjectAsset: `MOTION_GRAPHICS_LOCKED_ASSET_INVALID` antes de
consultar render cache. No reconstrucción silenciosa de la selección congelada.
Si bytes ya publicados pertenecen a otra identidad/revisión local, se rechaza el conflicto
de publicación y se usa una alternativa; no se reescribe el manifest del proyecto.

## Cobertura honesta del baseline

No se agregaron assets productivos en 3.3. Los 95 y sus SHA permanecen como seed embebido.
El SVG de cámara geométrica de tests es explícitamente sintético, no un asset de Iconify
oficial ni evidencia de curación/estilo premium. No cuenta como cobertura nueva.

Clasificación de los 11 términos registrados, según la traza congelada 3.2 y paridad actual:

| Término | Clasificación | Evidencia/matiz |
|---|---|---|
| maquina | STILL_MISSING | Sin recurso defendible para ese concepto; motor no equivale a máquina |
| resultado | STILL_MISSING | Fallback editorial, no selección editorial explícita del usuario |
| scientist | RESOLVED_BY_EXISTING_FALLBACK | OpenMoji científico EXACT |
| archivo | STILL_MISSING | Sin recurso defendible en su rol de Support |
| peligro | RESOLVED_BY_EXISTING_FALLBACK | OpenMoji advertencia EXACT |
| proyecto | STILL_MISSING | Fallback editorial, no asset inventado |
| plan | STILL_MISSING | Fallback editorial, no asset inventado |
| incertidumbre | RESOLVED_BY_EXISTING_FALLBACK | OpenMoji interrogación EXACT |
| violin | RESOLVED_BY_EXISTING_FALLBACK | OpenMoji violín EXACT |
| 1f382 | AUXILIARY_QUERY | Resolución directa OpenMoji preservada |
| birthday cake | AUXILIARY_QUERY | Alias auxiliar de esa misma resolución directa |

RESOLVED_BY_NEW_LOCAL_ASSET=0; INTENTIONALLY_EDITORIAL=0 en esos once términos.
No se confunde editorial por agotamiento con una decisión explícita editorial. Historia,
fuera de esa lista, sí tiene preferencia editorial en la traza existente.

## Reproducción y evidencia

Después de build nuevo, serialmente:

```powershell
npm run test:local-visual-library-v1
npm run test:modern-visual-pack-v1
.\node_modules\.bin\electron.cmd tests/aceptacion/modern-visual-pack-v1/ui-check.cjs --local-library
npm test
```

La línea base `tests/fixtures/local-visual-library-baseline.json` se capturó **antes**
de reconstruir, del bundle de 3.2 SHA
`fb33cedc6628d056a67bcaa90593dd8366b785e654946e74247c1956dc1aea5f`.
No se regenera para acomodar fallos. Compara 95 SHA, orden de candidatos para los 63
conceptos y PixelIdentity de las 28 escenas del corpus original, sin editar sus inputs.

Artefactos: `%CIPHER_LOCAL_ROOT%/_local-visual-library-evidence/`.
`results-first.json`/`directed-first.log`: primera pasada, consulta de voces ajena al catálogo
bloqueada por el arnés; no petición HTTP real. No se oculta esa incidencia.
`results.json`/`directed-final.log`: UI de voces aislada, red completamente denegada y
contador de intentos exigido a cero; Hero y Support locales por materializador real.
`local-library-offline.mp4`, `local-library-support-offline.mp4`: fixtures sintéticos,
540×960, 24 fps, 2 s, escala 2.25, sin audio. No prometen mejora estética.

Deudas semánticas, licencias de pesos rembg e intermitencias históricas de píxeles no se
declaran resueltas por esta extensión. No se hizo merge, tag ni push.

## Resultados dirigidos — 19/09/2026

Typecheck y build: exit 0. Artefactos verificados: dist/index.html 613 bytes,
main/index.js 1412442 bytes, preload/index.js 4981 bytes. SHA del bundle probado:
`ba5f3c2c04ee1ef6a69c4a2f920040ecbb2f19f13ff2f2d73b40e873cca623a9`.
Medición sobre la base indicada más los cambios de esta rama, no atribuida al bundle
antiguo. Electron 31.7.7, Windows 10.0.26200 x64, Ryzen AI 9 365, 20 hilos lógicos.

- Prueba dirigida y suite original Modern Pack: PASS, exit 0.
- 95 archivos/SHA y 63 búsquedas Hero/Support preservados; 28 identidades iguales
  a la línea base. Renderer, assets embebidos y VERSION_PLANTILLAS no cambiados.
- Local Hero + Local Support mediante materializador productivo: PASS.
- Retirar biblioteca conserva regeneración; quitar ProjectAsset produce rechazo
  explícito antes de caché. Dos MP4 válidos, QC sin errores, visual-sin-fichero=0.
- Render repetido del contexto restaurado devuelve el mismo archivo/SHA de caché;
  esto no se presenta como nueva medición independiente de rasterizado.
- Cero intentos de red en la prueba final aislada. UI real compilada: selector
  experimental y persistencia PASS; default legacy y perfil independiente PASS.
- Fotogramas estables inspeccionados: hero-frame.png y support-frame.png. La cámara
  geométrica sintética aparece como silueta monocroma, sin pretensión de calidad
  ilustrativa; valida alpha/tint/binding, no selección estética de un recurso real.

Índice (results.json del runner): una carga y 2000 búsquedas por tamaño, mitad
aciertos literales y mitad misses, sin red ni render dentro de la medición. Son
metadatos sintéticos y assertions incluidas; no inferir p95 ni capacidad de curación.

| Entradas | Carga ms | 2000 búsquedas ms | Manifest bytes |
|---|---:|---:|---:|
| 100 | 9.41 | 2.37 | 48603 |
| 500 | 13.21 | 2.81 | 243003 |
| 1500 | 21.40 | 1.80 | 730503 |
| 5000 | 50.88 | 2.99 | 2442003 |

La pasada standalone previa se conserva en directed-final.log: 5000 entradas,
48.29 ms de carga y 3.08 ms de consultas. No se elige sólo la cifra menor.
No hay promesa de rendimiento con disco frío, imágenes masivas o otro equipo.

Runner global ejecutado una vez tras el build final: **36/36, exit 0**,
`global-final.log`. Incluye D-Final, Hygiene, Relevance, Photo Cutout/Representation,
Modern Pack, biblioteca local, DPI-safe, Editorial Pilot, Text Fit/Visual Recovery,
Porcelain, Black Foundation y Color System. Conserva sin modificaciones la exclusión
histórica `test:ventana`; no se certifica esa suite ni desaparece su deuda.
La huella de project-state/.bak/proyectos del runner permaneció intacta.
No apareció fallo histórico de píxeles en esta ejecución; no equivale a resolver la
intermitencia conocida. Sólo project-state.json.bak queda fuera de Git deliberadamente.

technicalVerdict=PASS. visualVerdict=PENDING_HUMAN_REVIEW.
No expansión automática de contenido ni fase posterior.
