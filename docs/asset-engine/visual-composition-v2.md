# Ronda 4B — composición visual V2

## Estado

Esta evidencia pertenece a la rama `visual-composition-repair-v1`, creada desde
`d701b5ba3de52a0437bfb56250ff8beb521dc75e`
(`v-semantic-decision-repair-v1`). Los cambios productivos y la aceptación
automática están completos, pero la rama no está fusionada ni etiquetada. La
decisión estética corresponde a Jairo:

    visualVerdict = pending-human-review

No se autoriza un checkpoint hasta esa revisión. No se añadieron providers,
fondos, IA, ByPeople ni semántica nueva; la decisión aprobada en 4A permanece.

## Revisión de plantilla e identidad

El commit `693af0f` contiene en una sola unidad todos los cambios productivos de
píxel y la única subida de `VERSION_PLANTILLAS`, de 12 a 13. La composición sigue
siendo `visual_escena`.

Una misma escena y `sceneSpec` producen hashes distintos entre revisiones:

| revisión | hash del control |
|---|---|
| V12 | `aa33a377598d` |
| V13 | `54248358d464` |

El render devolvió el hash V13 esperado y conservó intacto un centinela escrito
en la ruta de caché V12. Por tanto, un clip V12 no satisface una solicitud V13.
La clave React sigue usando la misma identidad visual que `hashGrafico`.
`sceneSpec`/PixelIdentity conserva SHA, estado, tratamiento, geometría, texto,
motion y revisiones; trace, URL del provider, licencia, path, debug y report QC
siguen fuera.

## Editorial V2

`editorial-text` es una composición de primera clase. El texto visible se deriva
de `localText`, sin slogans ni contenido inventado, y se divide en connector,
keyword dominante y closing opcional. Se usan solamente los dos pares
tipográficos ya certificados. La composición prefiere dos líneas y permite una
tercera sólo cuando el contrato la declara; las keywords de una sola palabra no
se parten a mitad y su escala se ajusta de forma determinista.

Una escena editorial o con Hero ausente usa la estructura `editorial`. En la vía
V2, `marcoPoster` sólo dibuja marco cuando hay Hero real y `constelacion` sólo
dibuja órbitas/nodos cuando existen conceptos materializados. La vía legacy sin
`sceneSpec` no se modificó.

## Density V2 y decoradores

`resolveSceneDensityV2` usa `localText`, modo visual, Hero presente, elementos
reales, líneas/palabras, ritmo y Support actual (cero). Ya no deriva la densidad
del párrafo global. `saturada` requiere una escena realmente poblada y deja de
ser el valor implícito.

El presupuesto V2 separa editorial y asset-led:

| densidad | editorial/no Hero | asset-led |
|---|---:|---:|
| mínima | 0 | 0 |
| baja | 0 | 1 |
| media | 1 | 2 |
| alta | 2 | 3 |
| saturada | 3 | 4 |

Los presupuestos históricos siguen intactos para legacy.

## Tratamiento OpenMoji

Los candidatos semánticos de 4A no cambian. La revisión V2 elige tratamiento con
una regla pequeña y determinista:

- silueta simple que conserva reconocimiento: `accent-mask`;
- ilustración compleja: `duotone`;
- asset con detalle interior necesario: `duotone`;
- `none`: sólo por decisión explícita.

El control crítico mantiene `openmoji:26bd` para fútbol y su SHA
`f3d7e883a1d7a0776e5aa16ea857530884a3c12b192475fb116d351241f0bc8a`.
El SVG tiene 14 elementos de forma y cuatro valores de pintura. V12 convertía
toda capa opaca en una única superficie de acento; V13 usa transferencia duotono
que preserva separación de luminancia. Esta es evidencia estructural de la ruta
de detalle, no un veredicto humano sobre su calidad estética.

## QC V2

No se redujeron los umbrales de contraste: menos de 3 sigue siendo error y menos
de 4,5 sigue marcando revisión. El report añade `decoratorCount`,
`emptyHeroFrames` y la comprobación horizontal de keyword. También rechaza una
reserva de Hero muerta, exceso sobre el presupuesto V2 y overflow horizontal.

Las causas observadas en la reproducción 4A fueron:

- `VISUAL_QC_TEXT_BOUNDS`: 17;
- `VISUAL_QC_TEXT_OVERFLOW`: 15;
- `VISUAL_QC_CONTRAST_LOCAL`: 5.

La primera verificación final reveló una carrera en la medición: el QC ocultaba
los glifos y pedía `capturePage()` antes de que Chromium hubiese publicado esa
mutación en la superficie offscreen. Cuando recibía el frame anterior, los
propios píxeles claros de la keyword contaminaban el fondo y producían el mismo
p10 2,6241 visto de forma intermitente en la suite y en la aceptación.

La corrección no cambia umbrales ni píxeles productivos: espera dos barreras de
pintura antes de capturar el fondo local y antes de restaurar los glifos. El caso
pasó 10/10 procesos independientes y la aceptación completa quedó en cero
findings/rechazos QC.

## Aceptación real-like

El arnés `tests/aceptacion/visual-composition-v2/generar.cjs` toma la evidencia
forense `audit-last-real-video-20260909` sólo en lectura. Reproduce 50 solicitudes
con `LocalSceneSemanticV1`, decisión 4A, `sceneSpec`, renderer V13 y QC, todo en
un proyecto temporal marcado bajo `%TEMP%`, con red bloqueada. No selecciona IDs
de assets manualmente para hacer pasar la muestra.

| medida | V12 forense | V13 real-like |
|---|---:|---:|
| Visuales solicitados | 50 | 50 |
| materializados | 34 | 50 |
| rechazados por QC | 16 | 0 |
| sustituidos por original | 16 | 0 |
| resolver degradado | no medido | 0 |
| `saturada` | 33/34 | 0/50 |
| decoradores totales | 467 | 83 |
| decoradores por escena | 13,74 | 1,66 |
| decoradores por editorial V13 | — | 1,23 |
| `emptyHeroFrames` | 5 | 0 |
| estructuras con reserva muerta | 21 | 0 |
| escenas nuevas que vuelven a legacy | 6 históricas | 0 |

Distribución V13 sobre las 50 decisiones y materializaciones: baja 3, media 31 y
alta 16. Son 30 editorial-text, 19 OpenMoji y 1 Solar. Los OpenMoji usan 11
`accent-mask` y 8 `duotone`.

La hoja de comparación contiene construir, partidos, fútbol, estando, iglesia,
religioso, accidente e indignación con provider, candidato, estructura,
densidad, decoradores y QC. El vídeo de aceptación tiene 12 clips, 25,23 s,
720×1280, H.264 a 30 fps, y recorre el camino productivo hasta timeline/export.
Incluye un ProjectAsset faltante controlado que recompila a editorial y un caso
Solar sintético correcto. Hubo cero intentos de red durante la aceptación.

## Legacy y rendimiento

La comparación directa contra
`tests/aceptacion/visual-asset-mvp/legacy-baseline-b735.png` dio razón de píxeles
distintos 0 y delta absoluto medio por canal 0, dentro de los límites existentes
de 3 % y 2. Es una prueba de regresión de la vía sin `sceneSpec`, no una promesa
universal sobre todos los Visuales históricos.

El probe V13, a 540×960 y 10 fps, midió 50 renders aceptados no cacheados:
34.808 ms totales, mediana 28,875 ms/frame, p95 37,042 ms/frame y media 1,232
intentos/frame. Los logs V12 disponibles son 1080×1920 (mediana 38,269 y p95
53 ms/frame), por lo que no constituyen una comparación A/B controlada.

## Puertas automáticas

Pasaron las puertas de versión 13 exacta, cero `marcoPoster` editorial vacío,
cero reserva de Hero muerta, densidad saturada no masiva, decoradores editoriales
reducidos, menor rechazo QC, medición explícita de solicitado/materializado/
sustituido, separación de caché V12/V13, cero legacy nuevo, ruta de detalle del
balón, hoja y vídeo presentes, cero red, proyectos reales intactos y regresión
legacy dentro de la tolerancia existente.

Estas puertas prueban integridad y comportamiento medible. No prueban que el
resultado sea bonito, profesional o visualmente aprobado. La rama debe permanecer
sin merge y sin tag hasta la revisión de Jairo.
