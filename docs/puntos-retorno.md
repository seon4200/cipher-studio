# PUNTOS DE RETORNO

Etiquetas a las que se puede volver, y qué está probado de cada una.

## Regla de etiquetas inmutables

Una etiqueta se crea sólo después de merge, cierre documental, clon nuevo,
suites y `git status --porcelain` limpio. Una vez creada no se mueve: una
corrección posterior recibe una etiqueta nueva (`-fix1`, `-r2`, `-hardened` o
nueva versión). `v-openmoji-catalog-v1` tuvo un movimiento local histórico antes
de publicarse; queda registrado como excepción previa a esta regla y conserva su
target final `a9d109ece77c9b552a8e84e3cd248e25ba7fa3a8`. No se reescriben etiquetas
históricas ni se reutilizan sus nombres.

## Ronda D — rama sin checkpoint

`motion-graphics-productivo-v15` parte de
`754ac864bab05f9cecd13702a1426ce0b2ac795d`, HEAD de C. El commit productivo
`3b310af` contiene SceneSpec/Bindings V2, renderer multiasset y el único salto
`VERSION_PLANTILLAS=14 → 15`; `c29996f` contiene pruebas y evidencia. Las puertas
técnicas pasan: 17/17 familias, secuencia 20/20, Pixabay preparado como
ProjectAsset antes de bloquear red, separación V14/V15 de caché y `pixelDiff=0`
para V14 y legacy.

No es todavía un punto de retorno etiquetado. La revisión estética corresponde a
Jairo (`visualVerdict=PENDING_HUMAN_REVIEW`) y el holdout congelado deja una
deuda explícita de Retrieval C: Top-1 0/72 y Top-5 5/72. No hay merge, tag ni
push hasta esa revisión.

## Ronda 4B — rama sin checkpoint

`visual-composition-repair-v1` parte de
`d701b5ba3de52a0437bfb56250ff8beb521dc75e`
(`v-semantic-decision-repair-v1`). Cambia la composición productiva de una misma
`sceneSpec`, por lo que el commit `693af0f` contiene simultáneamente todos los
cambios de píxel y la única subida `VERSION_PLANTILLAS=12 → 13`. La aceptación
real-like iniciada en `5c3a6f3` reproduce 50 solicitudes: 50 materializadas, 0
rechazadas/sustituidas, 0 legacy nuevas, 0 huecos de Hero y 0 densidades
saturadas. La medición final incluye la barrera de pintura que elimina la carrera
entre ocultar los glifos y capturar el fondo para contraste local, sin rebajar QC.

Las puertas automáticas, la separación de caché V12/V13 y la regresión legacy
pasan. La hoja y el vídeo viven en
`tests/aceptacion/visual-composition-v2/`, pero la estética no está aprobada:
`visualVerdict=pending-human-review`. No hay merge, tag ni punto de retorno de 4B
hasta el veredicto de Jairo.

## `v-semantic-decision-repair-v1`

El merge local **`d701b5ba3de52a0437bfb56250ff8beb521dc75e`** cerró 4A y la
etiqueta inmutable apunta al mismo commit. Implementa contexto semántico
local temporizado, keyword V2, reglas de evidencia concreta, fallback
`editorial-text` sin retorno nuevo a legacy y diagnóstico atómico de decisiones
por generación. El renderer, hash, canonización, QC, layout y
`VERSION_PLANTILLAS=12` quedan intactos.

Está comprobado técnicamente en un corpus de 22 escenas: 0 retornos nuevos a
legacy por input y 14/14 oportunidades concretas con decisión/rechazo trazable.
La corrección temporal conserva `INDIGNACIÓN` cuando el transcript la
alinea al subclip, sin elegir `EMOCIÓN` de la cláusula vecina. Sigue pendiente la
composición visual, no la decisión semántica.
La hoja `tests/aceptacion/semantic-decision-repair-v1/contact-sheet-before-after.png`
fue revisada por Jairo antes del merge/tag. La aprobación cubre la corrección
semántica de 4A; tratamiento, composición, densidad, decoradores y QC quedaron
fuera y se trabajan separadamente en 4B.

## `v-asset-resolver-v1`

Merge local **`de9f6087eb89ec02fbfd23b333abe5bc49e56ef7`** de
`asset-resolver-v1`; la etiqueta apunta al cierre documental posterior al merge.
No mueve `v-visual-asset-mvp-v1` ni ninguna etiqueta histórica.

**Qué contiene:** `AssetIntentV1` narrativo, reglas de metáfora antes de asset,
scoring cerrado 0–3, ProjectAsset-first, búsqueda OpenMoji local, Solar
procedimental y editorial-text; una sesión acotada de continuidad/variedad,
traza diagnóstica y avisos, más un único compilador a
`VisualSceneSpecV1 + RenderBindingsV1`. El renderer recibe sólo la decisión ya
materializada: no busca proveedores ni interpreta aliases. La integración usa la
semántica existente antes de hash/render y produce un vídeo automático por el
camino real.

**Qué está comprobado:** el corpus físico de 42 escenas resolvió 20 asset-led
(8 OpenMoji y 12 Solar) y 22 editorial-text, sin lookup de las decisiones humanas
previas; hay un empate editorial explícito y cero falsos positivos críticos
conocidos (`mobile phone off`/termodinámica, `no pedestrians`/peatones y
`mastodon`/mástil). El resolver funciona sin red, no recorre todos los SVG y
publica/reutiliza sólo el OpenMoji seleccionado en proyectos temporales. La
aceptación genera once Visuales y un MP4 real con ProjectAsset, Solar,
editorial-text, tres estructuras, dos tratamientos, texto y motion; no hay
selección manual. La suite nueva pasa 40/40; catálogo 30/30, Visual MVP 40/40 y
runner 14/14 pasaron en el repo y en un clon nuevo del árbol ejecutable final.
Legacy sin `sceneSpec` no se re-resuelve al abrir y conserva su identidad
registrada. Los tres proyectos reales mantuvieron ruta, SHA, tamaño y fecha; no
recibieron SVG ni manifest.

**Qué NO está comprobado:** calidad y selección sobre vídeos reales de usuario,
ByPeople/photo-cutout, nuevos providers, AttentionIntent, Support/collage,
archivo/vintage, sincronía de voz, transiciones, 16:9, UI de assets ni rendimiento
universal. `BYPEOPLE_PROVIDER_STATUS = 'planned-not-audited'`: sólo podrá entrar
después de auditar la biblioteca adquirida, no como candidato actual.

**Volver aquí:** conserva el flujo offline semántica → decisión → ProjectAsset o
Solar/editorial-text → `sceneSpec`/bindings → render, sin ampliar proveedores.
Después de este punto no se abre otra ronda automáticamente: se usa Cipher en
vídeos reales y se registra evidencia de selección antes de ampliar el sistema.

---

## `v-visual-asset-mvp-v1`

Merge local **`471476acbf1053796374d231fde54164aa917a45`** de
`visual-mvp-productivo`; la etiqueta apunta al commit documental final posterior
al merge. No mueve ni reutiliza los tags de catálogo o round trip OpenMoji.

**Qué contiene:** `VisualSceneSpecV1` productivo en `extra.sceneSpec`,
RenderBindings fuera del hash, verificación previa de ProjectAsset, transporte
efímero por Blob URL, Hero OpenMoji, tratamientos `none`/`accent-mask`/`duotone`,
texto editorial con dos pares incluidos, tres estructuras certificadas, siete
presets mínimos de motion y QC de contenido/bounds/texto/contraste. La vía termina
en el MOV/MP4 del Visual y timeline existentes; no crea overlay ni renderer
paralelo.

**Qué está comprobado:** birthday cake, astronaut y compass publicados sólo en
proyecto temporal; hoja productiva de doce celdas revisada; vídeo de siete
escenas/11,2 s por el export real; missing recompila a editorial-text con nueva
identidad; SHA/estado/tratamiento/motion cambian identidad y path no; hash y clave
React comparten la proyección canónica; cero red/provider lookup durante render;
QC de doce casos sin findings y contraste local p10 16,49–17,80; salida legacy
del fixture idéntica visualmente a `b735f05` bajo el mismo runtime; coste mediano
observado +4,97%, bajo +25%. La suite específica pasó 40/40 y el runner 13/13 en
el repo y en un clon nuevo real de `8650885`; typecheck y build también pasaron.
El merge no modifica ese árbol de código. Los tres proyectos actuales conservaron
ruta/SHA/tamaño/fecha y contienen cero SVG nuevos.

**Qué NO está comprobado:** Asset Resolver, selección automática, AttentionIntent,
Photo/cutout, archivo/vintage productivo, providers adicionales, segundo Support,
collage, sincronía exacta con voz, transiciones entre escenas, 16:9, UI de assets,
calidad fuera de los tres assets/estructuras certificados ni rendimiento universal.

**Volver aquí:** conserva el primer Hero externo persistido y renderizado con
texto/motion/QC, pero todavía exige que el fixture o consumidor elija manualmente
el ProjectAsset y compile `sceneSpec`. El siguiente bloque es Asset Resolver
mínimo automático.

---

## `v-openmoji-asset-roundtrip-v1`

Merge local **`04cba197a92dad52aead4fc303811a2a47ecedbc`** de
`openmoji-asset-roundtrip-3-4c`; esta etiqueta apunta al cierre documental final
posterior al merge. No mueve `v-openmoji-catalog-v1` ni reutiliza ninguna etiqueta
histórica.

**Qué contiene:** publicación interna, sin IPC ni UI, de un único SVG OpenMoji
local (`openmoji:1f382`, birthday cake) dentro de un proyecto temporal explícito;
validación profunda `openmoji-svg-v1`, SHA-256 de bytes exactos, publicación
atómica en `materiales/assets/openmoji/<sha>.svg`, `ProjectAssetRecord` real en
AssetManifest V1, idempotencia y reapertura offline. Añade la duodécima suite y
la regla de etiquetas inmutables.

**Qué está comprobado:** projectRoot ausente, relativo, cwd, repositorio, `.git`,
junction y estado inválido/futuro se rechazan; `1F382` se resuelve localmente;
un SVG válido se copia con SHA/MIME/tamaño/procedencia/atribución correctos;
segunda publicación reutiliza un solo archivo y registro; manifest fallido no
queda parcial y no borra un archivo previo; falta, alteración, tamaño erróneo,
traversal y SVG malicioso se detectan; no hubo red. Catálogo 30/30, round trip
50/50 y runner 12/12 pasaron desde clon nuevo. Los tres proyectos actuales
mantuvieron ruta, SHA-256, tamaño y fecha antes/después; no se creó estado en la
raíz, fixture dentro del repositorio, manifest real ni SVG en esos proyectos.

**Qué NO está comprobado:** publicación sobre un proyecto real del usuario,
resolver automático, Hero, renderer, RenderSpec/PixelIdentity, hash de gráfico,
motion, calidad visual, PNG, PurePNG/PNGImages, AttentionIntent ni descarga por
vídeo. El único archivo materializado por 3.4C vive y se limpia en un fixture
temporal.

**Volver aquí:** conserva persistencia, catálogo OpenMoji y el primer round trip
seguro de un asset en proyecto temporal, pero ningún píxel ni proyecto real se
altera. Volver a `v-openmoji-catalog-v1` pierde esta publicación y la duodécima
suite, no la historia ni las etiquetas anteriores.

---

## `v-openmoji-catalog-v1`

Merge local **`5bf8635280b2623ef3f3d47e4e0d8dc83fa6a111`** de
`openmoji-catalog-3-4b`, más cierre de aislamiento **`23ed2c2`**. La etiqueta
apunta al cierre documental posterior a ambos merges: resolver con
`git rev-parse v-openmoji-catalog-v1^{commit}`. El target local anterior
`5223b0c0538f0750cbdb10cb237dad7ff59c3508` quedó registrado antes de recrearla;
la etiqueta no estaba publicada.

**Qué contiene:** `openmoji@17.0.0` exacto como devDependency de build; recurso
selectivo local con metadata, 4.495 SVG color, licencia y manifiesto derivado;
aliases españoles, food-sweet, atribución centralizada y búsqueda determinista
offline. La validación exhaustiva vive en preparación/build; la carga runtime es
ligera y la validación del SVG es lazy. El recurso se empaqueta fuera de ASAR; el
runner conserva 11 suites. Todos los arneses mutables usan raíces marcadas bajo
`%TEMP%`; el runner vigila los estados reales después de cada suite.

**Qué está comprobado:** 4.495 entradas y 4.495 SVG color; `birthday cake` es
`1F382`; aliases, scoring y desempate estables; red bloqueada; cero inspecciones
de `color/svg` en carga, búsqueda y listas; una inspección al resolver `1F382`;
recurso local/pin/atribución; build; paquete temporal con `resources/openmoji`
fuera de ASAR y sin duplicado; 30/30 casos de catálogo; 11/11 suites; y clon
nuevo con `npm ci`, typecheck, build y pruebas. La comprobación de paquete cubre
presencia, rutas y carga/búsqueda offline del recurso, no una sesión interactiva
instalada. El clon final de `92a069a` dejó 26 grupos de persistencia, 30/30 casos
OpenMoji y 11/11 suites; no creó estados, fixtures ni carpetas de datos dentro del
clon. Tres procesos independientes midieron first-process load en 61,5 / 62,0 /
71,7 ms (mínimo / mediana / máximo), frente al baseline histórico de 36,2 s.
Los tres proyectos actuales conservaron exactamente ruta, SHA-256, tamaño y fecha
antes/después de la ejecución controlada.

**Aclaración de recuento:** 61 estados en una certificación antigua y 56 en una
medición posterior son evidencia histórica. La línea base actual son tres
proyectos que el usuario decidió conservar; la reducción fue manual y no se
atribuye a `npm test` ni a OpenMoji. Se hizo backup externo previo. Los dos estados
vacíos hallados en la raíz fueron preservados en cuarentena externa; no coincidían
con esos tres proyectos y su origen concreto no pudo demostrarse.

**Qué NO está comprobado:** ProjectAsset OpenMoji; copia al proyecto; SHA del
asset publicado; validación profunda/sanitización de SVG; AssetManifest con
OpenMoji; reapertura de un asset publicado; Hero; RenderSpec; motion; calidad
visual; PurePNG/PNGImages; ni AttentionIntent.

**Volver aquí:** conserva persistencia y catálogo OpenMoji local/offline, pero
ningún SVG fue publicado dentro de un proyecto ni dibujado. Volver al checkpoint
anterior pierde el catálogo y su undécima suite, no los puntos históricos.

---

## `v-persistencia-assets-v1`

Merge local **`87604917960b1e511707f4203e94a4a8de445bad`** de
`asset-persistence-3-4a`. La etiqueta apunta al cierre documental final posterior
al merge: resolver con `git rev-parse v-persistencia-assets-v1^{commit}`. No mueve
ni reutiliza etiquetas anteriores.

**Qué contiene:** `project-state` schema 1; migración legacy en memoria;
ProjectSubstrate nullable; AssetManifest V1 en `materiales/assets/manifest.json`
para proyectos nuevos; rutas relativas confinadas; escritura JSON recuperable con
backup; auditoría mínima; integración con crear/abrir/guardar/autoguardar/Guardar
como; y décima suite de persistencia/assets.

**Qué está comprobado:** legacy abre sin reescritura y conserva campos desconocidos
y rutas históricas; una versión futura se rechaza sin sobrescribir; ProjectSubstrate
válido hace round trip; un proyecto nuevo crea manifest vacío; legacy sin manifest
abre; traversal/UNC/drive/junction se rechazan; corrupción recupera desde backup
válido; fallo antes de publicar conserva principal; Guardar como conserva el origen;
10/10 suites pasan; la certificación de rama registró 61 estados reales intactos.
Otra medición posterior registró 56 y verificó sus huellas. Ambos recuentos son
históricos: el usuario confirmó que eliminó manualmente la mayoría y que los tres
proyectos presentes el 08/09/2026 son la nueva línea base operativa. La reducción
no se atribuye a las pruebas. Un clon nuevo verificó el árbol ejecutable final.

**Qué NO está comprobado:** portabilidad de rutas antiguas; copia de materiales en
Guardar como; transacción conjunta estado+manifest; bloqueo multiproceso;
rendimiento con JSON grande; aviso específico de recuperación en UI; SHA real de
archivo; MIME/magic de imágenes; SVG seguro real; alpha; OpenMoji; Asset Resolver;
Hero; RenderSpec; ni motion.

**Volver aquí:** conserva todo el motor visual actual y añade el cimiento
persistente de assets, pero todavía no descarga ni dibuja imágenes. Volver al
checkpoint anterior pierde ese cimiento y su décima suite, no los tags históricos.

---

## `v-scene-recipe-editorial-v1`

Base `291069ea6edaf59a06c8717c270ba21ecd0ae06e`, corrección documental
`140ed8ef569676adef86ced1b01b0febd4a6811c` sobre `74d1572`.
Merge local **`1d8415a86dfc4358c8e627ca894bfe411640ae7e`**, sin squash.
La etiqueta apunta al commit documental final que contiene esta nota, no al
merge intermedio: resolver `git rev-parse v-scene-recipe-editorial-v1^{commit}`.
Confirmación con `git ls-remote . refs/tags/v-scene-recipe-editorial-v1*` (local,
no publicación remota). No se mueve ninguna etiqueta anterior.

**Qué contiene:** SceneIntent, SceneRecipe, ResolvedScenePlan, RenderSpec;
separación identidad visual/locator/RenderBindings; ProjectSubstrate;
Motion Contract, NullAssetStrategy, layout intents, SubjectBounds, texto editorial,
seis perfiles, veinte metáforas, QC, 18 ejemplos y validador documental reproducible;
plan 3.4A–3.17. ProjectSubstrate propuesto en estado versionado; inventario propuesto
en materiales/assets/manifest.json. No archivos productivos creados.

**Qué está comprobado documentalmente:** revisión de contratos y JSON válido,
referencias/modos/roles, máximos de texto/énfasis, ventanas/divisores y cobertura.
Medido por validar-scene-recipe-v1.cjs sobre corpus de `140ed8e`: 18 (tres por perfil),
16 asset-led, 2 editorial-text, 6 hard cuts, 5 Hero exit none, 11 sin emphasis,
1 hold, 3 Supports opcionales omitibles, 1 Hero sin Support, 1 no-metaphor y
1 providers-exhausted. Cinco tipos de transición; 8 entradas scale, 6 slide,
5 float, 7 punch/shake motivados. Sin URL/path/proveedor/SHA resueltos en Recipe.
Controles negativos documentados en qc-scene-recipe-v1.md. Diff sin cambios
en src/, tests/, paquetes ni Vite contra `291069e`; versión 12 y visual_escena intactas.

**Qué NO está comprobado:** calidad visual, render de assets, movimiento real,
contraste local/bounds reales, compatibilidad geométrica de layouts, OpenMoji
integrado, persistencia/migración/manifest productivo, Photo Hero, PurePNG/PNGImages,
APIs, removedor, ByPeople ni IA/FLUX. El validador no certifica esas propiedades.
No se ejecutaron las nueve suites: excepción explícita del encargo para este
cierre exclusivamente documental. No hubo render, descargas, APIs ni push.

**Volver aquí:** conserva motor actual, densidad/Solar, auditoría del pipeline y
especificación de dirección de arte, sin motor de imágenes. Volver al checkpoint
anterior v-auditoria-pipeline-assets pierde esta especificación/correcciones,
no funciones productivas. Siguiente: 3.4A persistencia mínima; no iniciada aquí.

---

## `v-auditoria-pipeline-assets`

Merge local `993a1231aaf7d365c3ffe4a79943507c87dcaee9` integra `19d3ce3` y
`3d99f45`. La etiqueta señala el commit documental final que contiene esta nota
(resolver con `git rev-parse v-auditoria-pipeline-assets^{commit}`). No mueve tags anteriores.

**Qué contiene:** auditoría de proyectos, materiales, stock, providers, downloader,
timeline y hash; almacenamiento propuesto, contratos conceptuales y plan V1.

**Hechos comprobados:** base `c0a9c78`; sin schemaVersion/migraciones en el estado,
rutas mayormente absolutas, sin manifiesto productivo ni `materiales/assets/` en
la muestra auditada; timeline tipado video/audio/graphic; descarga actual sin
validación específica de assets de imagen. Código sin cambios: versión 12 y
`visual_escena` activa. Diff, sintaxis del validador y ejecución offline comprobados.

**Conclusiones de arquitectura, no funciones verificadas:** Hero de archivo
dentro de `visual_escena`; OpenMoji como primer provider recomendado; SHA/estado
representados en la clave y ruta excluida de identidad. Son contratos propuestos.

**Qué no está comprobado:** schema del manifiesto, implementación OpenMoji,
Photo Hero, nuevo movimiento, Scene Recipe, PurePNG/PNGImages integrados,
APIs fallback de imagen, removedor, ByPeople ni IA/FLUX.

**Volver aquí:** conserva densidad/Solar y toda la auditoría documental, sin motor
de imágenes. Volver a `v-spike-proveedores-limpio` pierde esta auditoría y sus
correcciones documentales, sin cambiar producción. El encargo exime suites al
no modificar producción: este checkpoint no acredita una nueva ejecución 9/9.

---

---

## `v-densidad-solar-instrumentado`

**Merge local `9d99103`** de `encargo-3-1-densidad-solar`; la etiqueta nombra
este punto de retorno y se crea sobre el cierre documental que sigue.

**Qué contiene.** `visual_escena` sigue activa con `VERSION_PLANTILLAS=12`.
La densidad usa frase, palabra y etiquetas; Solar recibe un vocabulario curado,
aliases conservadores y escribe la traza de solicitud/candidatos/decisión/fallback
en semántica completa y en el contrato histórico. Incluye el corpus reproducible
de 158 solicitudes y la preparación documental —sin renderer— del spike de héroe.

**Qué está comprobado.** En la traza de 42 Visuales de `mvp-paso7`, la densidad
grabada como `alta 42` se recalcula a `media 2 · alta 26 · saturada 14`; no es una
promesa para otros guiones. El corpus nuevo Solar mide `43/158 → 72/158`; no se
compara con el agregado histórico no recuperable `68/188`. TypeScript, build y las
nueve suites pasan antes de este merge.

**Qué NO está comprobado.** La calibración perceptiva de densidad y Solar no está
cerrada; `bridge`, `pedestrians`, `rope` y `sync` siguen a emoji por falta de un
equivalente inequívoco. El spike necesita `openmoji-food-sweet`,
`bypeople-person` y `bypeople-object` manuales antes de implementar dibujo de
assets. No contiene Photo Hero ni Asset Engine.

**Volver aquí:** vuelve al motor productivo con densidad no colapsada y Solar
instrumentado; al volver a `v-visuales-produccion-usable` se pierden esos cambios
y se recupera `VERSION_PLANTILLAS=11`.

---

## `v-visuales-produccion-usable`

**`44ca34adbcc53c871198e8fddc68543a29a926bf`** · merge de
`ajuste-contraste-global` (`c7f3777`). Es el punto de retorno funcional auditado
antes de sincronizar la documentación con GitHub.

**Qué contiene.** `visual_escena` es la composición de producción;
`VERSION_PLANTILLAS=11`; hay 17 estructuras, 22 fondos, 16 cámaras, 5 densidades,
5 ritmos, 10 tipografías y 4 paletas por proyecto. Incluye el catálogo completo,
selección semántica/relación con respaldo determinista, la dirección en el hash y
la corrección de contraste global. La evidencia de producción versionada más
cercana es `tests/aceptacion/mvp-paso7/`: 42 Visuales en un MP4 real de `1f1a6cb`.

**Qué está comprobado.** El catálogo y las guardias están cubiertos por las suites;
el MP4 citado prueba que el camino real funcionó en ese commit. El cambio de
contraste está protegido por la guardia 3:1 contra caja y fondo dominante.

**Qué NO está comprobado.** No hay una generación real nueva específica de
`44ca34a`; no se certifican variedad perceptual, legibilidad/vecindad de todas las
cajas, coste en las mismas condiciones de la referencia, paridad exacta de emoji
ni calidad semántica humana. Imágenes/recortes, acabado y 16:9 quedan fuera.

**Volver aquí:** conserva el motor activo y todo el trabajo funcional posterior a
`v-fase3-banco`; se perderían los commits posteriores de documentación/sincronía,
no el código del motor. La etiqueta no mueve ninguno de los checkpoints previos.

---

## `v-antes-del-interruptor`

**`94685f2c9097d5afcb64342d4eff7b3210b4f7e7`** · ultimo `master` con
`COMPOSICION_VISUAL='visual_mapa'` y `VERSION_PLANTILLAS=8`.

Es el retorno inmediato si activar `visual_escena` degrada una generacion real. Conserva el
motor combinatorio registrado, el tono claro y las 36 identidades verificadas, pero deja el
motor nuevo apagado.

**Que queda despues de esta etiqueta:** el paso `v-fase4f-interruptor` resuelve la direccion
completa antes de renderizar, la incorpora a `graphicData.extra` —y por tanto al hash— y cambia
el selector a `visual_escena`. No persiste la especificacion: reabrir conserva el MP4; regenerar
el timeline vuelve a sortear con el catalogo vigente, por decision de producto.

---

## `v-fase4d-tono-claro`

Merge `--no-ff` del lote de tono claro y parejas: tinta declarada por cada sistema,
`tramaTejida` portada de `lab-fondos-2.html:318-333`, parejas desacopladas de constelacion
y guardia del orden de sorteo sobre el bundle. Produccion sigue en `visual_mapa`, version 8.
Repertorio medido: **36 identidades / 166.470 instancias**, con 4/4/4 de capasApiladas
todavia provisionales. La excepcion del emoji del heroe fuera de `caja()` queda anotada.

**Verificacion exigida para etiquetar:** clon nuevo de master, `npm ci`, typecheck,
build por ficheros de renderer/main/preload y las nueve suites con `npm test`.
La etiqueta es local: este cierre NO autoriza push.

**Que queda despues de esta etiqueta:** calibrar los pasos pendientes, completar vocabulario
y mover el interruptor EN EL MISMO PASO que incorpora la direccion resuelta al hash.
Volver aqui conserva tono claro y parejas, pero NO activa `visual_escena` ni resuelve
la tasa real de respaldo del pie. Ver la precondicion en `deuda-graficos.md`.

---

## `v-fase4a-primeras-piezas`

La primera estructura nueva (`capasApiladas`) y dos fondos nuevos (`tunel`, `skyline`) entran
junto con `ondas` corregida contra su lab. La hoja de seis identidades demuestra que el eje
fondo y el eje estructura producen geometrias distintas. `visual_escena` sigue registrada e
inactiva: `COMPOSICION_VISUAL='visual_mapa'`, `VERSION_PLANTILLAS=8`.

**Qué hay después de la etiqueta:** faltan las piezas restantes del vocabulario minimo, la
conexion de fondos claros con tinta y el interruptor de la Fase 4. Volver aqui conserva el
primer lote real y deja fuera todo eso.

---

## Sobre la reproducibilidad del render — versión definitiva

Esta sección se ha escrito tres veces. Las dos primeras estaban mal, y el motivo
de las dos es el mismo error: **`n=2` no es evidencia.**

**Lo medido, con seis tiradas del mismo clip:**

| tirada | resultado |
|---|---|
| `c11226f` · `3b24804` · `BIS` · `P1` · `P2` | **idénticas al byte** en los tres frames |
| `5cb7d33` | difiere en dos frames |

**Cinco de seis coinciden.** El render **es determinista con una anomalía
intermitente**, no "no reproducible".

**Cuánto difiere la anómala** (frame 77, el peor):
delta **máximo 37**, **medio 2,0**, el **99 % de los píxeles que cambian tienen
delta ≤ 4**, y **cero** píxeles con delta > 64.

**El discriminador que sale de ahí, y que sustituye a la igualdad byte a byte:**

| firma | qué significa |
|---|---|
| pocos píxeles, delta enorme | **algo se movió de sitio** — cambio real |
| muchos píxeles, delta ≤ 4, ninguno > 64 | **rasterizado** — ruido, no cambio |

**Pista, no conclusión:** la tirada anómala fue el **primer render en un clon
recién instalado**, con cachés de fuentes y shaders en frío. Una sola observación.

**Lo que NO es, y yo dije que sí:** no es el cimiento de la Fase 3. El verificador
compara frames **dentro de un mismo vídeo** —no vacíos, distintos entre sí, capas
cíclicas que cierran, contenido en zona segura—; ninguna de esas cuatro cosas
necesita que dos renders coincidan. Era una molestia de herramientas, no un
cimiento.

**Lo que sí queda tocado:** cualquier comparación entre renders se hace **con
tolerancia**, nunca por igualdad de bytes.

**Descartado con línea:** `grafico.tsx:193` pausa cada animación y le fija
`currentTime = t*1000` **absoluto**; `index.ts:1408` llama a `__setT(t)` **una vez
por frame, fuera del lazo de reintentos**. Un reintento repite `capturePage()`
sobre el mismo DOM. **El tiempo no es la causa, y la hipótesis del lazo de
reintentos está muerta.**

**Sospechosos vivos, de rasterizado:** `backdrop-filter` (`mapa.tsx:202`),
`mix-blend-mode` (206), `filter:blur` (212), el SVG (537), ocho gradientes. Y un
detalle del mecanismo: **la sonda valida su propia franja de 8 px, no el frame
entero** — que esa franja llegue al compositor no prueba que una capa de GPU haya
acabado de repintarse.

---

## `v-fase3-banco`

**Merge `581ac6b804edb9607a2c935fcf5f1c6b4a3bb305`** · `--no-ff`.

El banco monta el mismo `AnimatedGraphic` que el render real y permite mirar una
combinación sin captura ni FFmpeg. Se abre con `npm run banco` y la URL
`http://127.0.0.1:5174/banco.html`. El modo `banco` vive en el único
`vite.config.ts`, excluye los plugins que arrancan Electron y produce **cero**
`banco-*.js` en `dist/`.

Incluye la comprobación compartida de fuentes, dirección y semilla visibles, zona
segura, reloj dirigido, registros de piezas y la normalización de aristas SVG con
`pathLength=1`. La composición nueva sigue inactiva:
`COMPOSICION_VISUAL='visual_mapa'` y `VERSION_PLANTILLAS=8`.

**Qué hay después de la etiqueta:** nada de las fases posteriores. El siguiente
paso es 3.6, la hoja de contactos y la calibración perceptiva de `pasos`. Volver a
esta etiqueta conserva el banco y deja fuera ese trabajo.

---

## `v-puente-suelo` — último checkpoint ejecutable

**`4157e0c81687caf4ae263a7e3cd6a239c908e2df`** · merge `--no-ff`.

Añade el suelo de pruebas sin tocar `src/`: `npm test` con nueve suites y seguro de
conteo, arneses de aceptación versionados y comparador de capturas con tolerancia.

**Qué hay después de la etiqueta:** `97cad34` retira el porcentaje del veredicto del
comparador; `56f02ba` incorpora los cuatro documentos canónicos; `86045c6` archiva el
contexto que quedó falso desde la Fase 1; y el commit documental que contiene esta nota
corrige las deudas cerradas y los nombres canónicos. Volver a la etiqueta deja atrás
todo eso, aunque no cambia el código de la app.

---

## `v-fase2-avisos`

**`1db2f487dacbd78bc48e0150cca2985a7135b162`** · merge `--no-ff`.
Etiqueta anotada `046fdaf`, confirmada en remoto.

La app ya **no puede** decir *"éxito, 78 de 78"* mientras la mitad del vídeo se
degrada.

| commit | qué |
|---|---|
| `6bc3695` | `shared/avisos.ts` puro + la novena suite, con el 25/8 congelado |
| `0d1d67c` | los seis puntos de anotación + el arrastre en el aplanado |
| `406b4d6` | canal `generation-aviso`, emisor, preload y ventana |
| `5cb7d33` | **aislado**: borrar `graphicsDecision` (−85/+12) |
| `6c70748` | la nota del determinismo, sin una línea de código |

**Verificado desde clon nuevo:** `npm ci` 0 · `tsc` 0 · `build` 0 en tres pasos por
ficheros · nueve suites verdes · hash `db7cb15ea714` · el texto del 25/8 idéntico
palabra por palabra.

**Qué hay después de la etiqueta:** el puente completo (`4157e0c`), el arreglo del
comparador (`97cad34`) y toda la documentación canónica y de retorno posterior. Volver
aquí conserva los avisos, pero pierde el ejecutor del conjunto, los arneses versionados
y el comparador tolerante.

**El texto que produce:**

```
[ ERROR ] DeepSeek rechazó la petición por saldo agotado. Sin él no hay
          palabras clave…  (x5)
Resumen de la generación: 57 clips.
  original: se pidieron 28 y salieron 28
  stock:    se pidieron 11 y salieron 0  (-11)
  IA:       se pidieron 0  y salieron 0
  Visual:   se pidieron 18 y salieron 18
11 clips no salieron como se pidió y se rellenaron con otra cosa:
  11 — clips de stock que se quedaron sin palabra clave y se dejaron como
       vídeo original
El vídeo NO salió como se pidió. Revisa los avisos de arriba antes de exportar.
```

---

## `v-fase1-escena-inactiva`

**`3b248045d00e8d3a903d6518c968e3e7f1799580`**

La composición combinatoria (`escena`) **registrada, verificada e INACTIVA**.
El interruptor: `COMPOSICION_VISUAL` en `src/main/index.ts`, hoy `'visual_mapa'`,
aislado en `261269d` para la Fase 4. `VERSION_PLANTILLAS = 8`.

Cuatro capas · registro de piezas con contrato tipado · `direccionDe(semilla)` ·
ranura de héroe · `cqmin` con `container-type: size` · `calc(var(--ciclo) / n)` ·
`rangos` de instancia · `combinacionesLegales()` con **dos** números
(2 identidades, 1.176.000 instancias — el segundo, inflado).

**Qué hay después de la etiqueta:** toda la Fase 2 (`1db2f48`), el puente
(`4157e0c`) y sus correcciones y documentos posteriores. Volver aquí conserva el motor
nuevo inactivo, pero pierde los avisos y el suelo de pruebas.

---

## `v-paso9-mapa-sin-palabra`

**`757b6ccd9c7e2290d31ca024dc96f2863039b8d2`** — `mapa` funcionando, sin nada del
motor combinatorio. La red de último recurso.

**Qué hay después de la etiqueta:** la Fase 0 (`c11226f`), el motor combinatorio de
la Fase 1 (`3b24804`), los avisos de la Fase 2 (`1db2f48`), el puente (`4157e0c`) y
toda la documentación posterior. Volver aquí pierde el motor nuevo entero, aunque
`visual_mapa` sigue siendo la composición activa en ambos lados.

---

## Cómo volver

```
git checkout <etiqueta>
```

Verificar **desde clon nuevo**: `git clone` + `npm ci` sin `node_modules` padre.
Un worktree NO sirve, y **un clon con borradores dentro deja de ser un clon
limpio** — se consume.

## Lecciones que costaron tiempo

- **`n=2` no es evidencia.** Una comparación pareada no prueba reproducibilidad;
  hace falta una tercera tirada como árbitro. Dos veces se dio por buena y por mala
  la misma medición por no tenerla.
- **El código de salida es la autoridad, no el texto.** Una suite rota llegó a
  imprimir "TODO CORRECTO" y salió en rojo igualmente.
- **Un bundle viejo miente.** Un arnés falló y tenía razón: el `dist-electron` del
  repo de trabajo era anterior al commit que probaba.
## `v-spike-proveedores-limpio`

La etiqueta apunta al commit documental que contiene esta nota. Merge `c94cc3f`
integra el spike limpio de proveedores sin incorporar binarios externos.

**Qué contiene:** documentación del modelo de assets por vídeo, contrato de
proveedores, manifiesto de evidencia sin binarios, validador offline y política de
no redistribución. Conserva los resultados de OpenMoji, PNGImages y PurePNG.

**Qué está comprobado:** OpenMoji se obtuvo desde fuente oficial como SVG válido;
PurePNG produjo una muestra PNG con alpha útil; PNGImages produjo PNG válido sin
transparencia útil. Cuando las muestras locales están disponibles, el validador
comprueba SHA, MIME, dimensiones y alpha. El árbol de Git no contiene esos
binarios externos.

**Qué no está comprobado:** render, Photo Hero, Asset Engine, búsqueda por guion,
almacenamiento real de proyecto, estructura definitiva del manifiesto,
Pexels/Pixabay, Wikimedia, ByPeople, removedor de fondo o IA/FLUX.

**Volver aquí:** conserva densidad/Solar y la investigación limpia de proveedores;
no incorpora ningún motor de imágenes. La ruta `materiales/assets/` es un contrato
propuesto, pendiente de auditar `project-state.json` y los almacenes existentes.

---
