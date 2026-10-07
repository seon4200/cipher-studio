# Visual MVP productivo V1

## Decisión

**MERGE realizado localmente (`471476ac`).** La hoja y el vídeo productivos
conservan o mejoran la puerta visual experimental. El primer Visual de Cipher
con imagen externa persistida, texto editorial y movimiento funciona por el
renderer real, sin resolver automático y sin alterar la vía legacy. El retorno
inmutable de este cierre es `v-visual-asset-mvp-v1`.

Este cierre no convierte OpenMoji en respuesta universal. Se certifica como
Hero para objetos, comida, ciencia y símbolos concretos. Para una silueta simple
gana `accent-mask`; para una ilustración con piezas pequeñas gana `duotone`.
`none` permanece disponible cuando el color original aporta significado.

## Alcance exacto

La vía nueva sólo se activa cuando `graphicData.extra.sceneSpec` existe y pasa
el validador productivo V1. Si el campo está ausente, AnimatedGraphic recorre la
misma vía legacy que la base `b735f05`. Un `sceneSpec` presente pero inválido no
se disfraza de legacy: se rechaza.

```text
ProjectAssetRecord + projectRoot explícito + RenderBindings
→ verifyProjectAssetContent / bytes exactos
→ RenderSpec efectivo o fallback editorial con otra identidad
→ PixelIdentity compartida por hashGrafico y clave React
→ Blob URL efímera
→ AnimatedGraphic / visual_escena
→ QC sobre el DOM que alimenta FFmpeg
→ MP4/MOV del Visual
→ timeline/export existente
```

No hay overlay SVG/PNG paralelo, segundo renderer, IPC nuevo, UI de assets,
provider lookup durante render ni lectura directa del catálogo por React.

## Autoridades

| Responsabilidad | Autoridad productiva |
|---|---|
| Contrato visual determinista | `src/shared/visual-scene-spec.ts` |
| Localización de bytes | `RenderBindingsV1` |
| Registro/procedencia del archivo | `ProjectAssetRecord` en AssetManifest V1 |
| Verificación y preparación | `src/main/assets/visual-render.ts` |
| QC geométrico y contraste local | `src/main/assets/visual-qc.ts` |
| Dibujo de Hero/texto | `src/renderer/src/composiciones/VisualAssetMvp.tsx` |
| Geometría, fondos, cámaras y decoradores | registros existentes de `visual_escena` |

## RenderSpec productivo mínimo

`VisualSceneSpecV1` contiene sólo decisiones capaces de mover píxeles:

- `renderSpecVersion`, `visualMode` y `renderTier`;
- sistema y dirección efectivos;
- texto editorial efectivo;
- como máximo un slot Hero;
- estado `present`, `missing` u `omitted`;
- SHA, MIME, clase, SubjectBounds, fit, tratamiento y motion cuando está
  `present`;
- revisiones explícitas de layout, texto, motion, tratamiento, bounds, fuentes
  y paleta;
- fallback `editorial-text`.

`RenderBindingsV1` contiene `slotId`, `assetId` y `relativeFile`. Es locator y
queda fuera de `graphicData` y de PixelIdentity. `projectRoot`, ruta absoluta,
provider, URLs, licencia, atribución, fecha, candidato, score y AttentionIntent
tampoco entran en el hash.

Sí entran en identidad: SHA/estado, tratamiento, fit, bounds, motion, texto,
sistema/dirección efectivos, revisiones, tier y parámetros de render. Por eso:

- SHA A ≠ SHA B;
- `present` ≠ `missing`;
- `duotone` ≠ `accent-mask`;
- motion distinto ≠ identidad anterior;
- mismos bytes/spec con otro path = misma identidad visual.

`sceneSpecPixelIdentity()` es la proyección canónica y
`sceneSpecReactKey()` deriva de ella. `hashGrafico()` consume esa misma
proyección; no existe el estado peligroso “hash nuevo + clave React vieja”.

## ProjectAsset y fallback

El main exige `projectRoot` explícito, carga el AssetManifest real, verifica que
el binding corresponda al registro y llama la verificación de contenido antes de
capturar. V1 sólo certifica `provider=openmoji`, `mime=image/svg+xml`.

Los bytes verificados se mantienen como una Blob URL efímera hasta terminar el
clip. No se usa una data URI ni se lee `dist-electron/openmoji` desde el renderer.
Si el archivo falta o cambió, no se dibuja un Hero bajo estado `present`: se
materializa `editorial-text`, se retira la SHA y cambia la identidad. Un contrato,
MIME o binding inválido se rechaza con código tipado.

## Tratamientos, texto y estructuras

Tratamientos V1:

- `accent-mask`: conserva alpha y aplica el acento efectivo; recomendado para
  iconos/siluetas simples.
- `duotone`: conserva luminancia y la interpola entre apoyo y acento efectivos;
  recomendado para ilustraciones complejas.
- `none`: conserva el color original.

Revisión de tratamiento: `asset-treatment-v1`. Los bytes originales del
ProjectAsset no se modifican.

Texto V1: máximo ocho palabras y dos líneas, con `connector`, `keyword`
obligatoria y `closing` opcional. La keyword es la única voz dominante. Se usan
dos pares existentes, sin descargar fuentes:

- `technical-black`: Space Mono + Archivo Black;
- `editorial-black`: DM Serif Display + Archivo Black.

Estructuras inicialmente certificadas:

- `constelacion`;
- `marcoPoster`;
- `editorial`.

La ranura procede de `HeroEstructura`; el asset no declara coordenadas. Las otras
catorce estructuras no se modifican ni fuerzan Hero. Una escena fuera de esta
allowlist continúa por legacy o debe compilarse como editorial-text.

## Motion V1

Todos los tiempos son 0..1 y respetan el ciclo existente. El vocabulario mínimo
es:

- entry: `fade-slide`, `scale-in`;
- sustain: `float`, `breathe`;
- exit: `fade-out`, `scale-down`;
- emphasis: `punch`, como máximo uno.

Entry termina antes de sustain y emphasis no invade exit. Connector entra con
fade/slide sutil, keyword con scale-in y overshoot pequeño, y closing es
opcional. No hay sincronía exacta con voz, whip, shake, flash, transición A→B ni
motion avanzado.

## QC implementado

Antes del render: archivo presente, confinamiento, tamaño, SHA, MIME y política
SVG OpenMoji. Sobre el DOM productivo se muestrean inicio, fin de entry, mitad,
emphasis si existe, inicio de exit y final. Se comprueban:

- Hero y texto dentro del frame durante motion;
- safe zone, clipping, máximo de líneas y palabras;
- solape Hero/keyword visible;
- overshoot/salida accidental;
- contraste local p10 en la zona exacta de la keyword.

Contraste `<3` es error; `<4,5` requiere revisión. Las doce celdas finales
produjeron cero findings; contraste local p10 entre 16,49 y 17,80. Esto detecta
frames rotos, no sustituye juicio editorial humano.

## Hoja productiva y revisión humana

Artefacto: `tests/aceptacion/visual-asset-mvp/contact-sheet.png`.

| celda | evidencia humana | decisión |
|---|---|---|
| cake / constelacion / entrada | silueta reconocible aun entrando | apto; accent-mask |
| cake / marcoPoster / sustain | Hero dominante y texto separado | apto; accent-mask |
| cake / editorial / original | color conserva detalle, menor integración | apto como excepción |
| astronaut / constelacion / entrada | lectura clara con opacidad de entry | apto; duotone |
| astronaut / marcoPoster / sustain | mejor balance de detalle y paleta | finalista |
| astronaut / editorial / salida | salida visible sin clipping | apto; duotone |
| compass / constelacion / clínico | detalle y dirección legibles | finalista; duotone |
| compass / marcoPoster / punch | emphasis perceptible, bounds seguros | apto; duotone |
| compass / editorial / original | significado intacto, paleta menos unificada | apto condicionado |
| editorial “EVIDENCIA” | composición llena sin slot fantasma | apto |
| editorial “SIN ATAJOS” | jerarquía y espacio negativo claros | finalista |
| missing → “CONTINÚA” | ausencia controlada, sin Hero roto | apto |

La revisión humana concluye que la imagen eleva claramente el Visual cuando hay
metáfora concreta. No gana un tratamiento universal: gana por familia. La hoja
productiva mejora el spike al añadir jerarquía textual, tres geometrías reales,
motion, fallback y bytes de ProjectAsset; conserva su conclusión de color.

## Vídeo productivo

`tests/aceptacion/visual-asset-mvp/production/visual-asset-mvp-v1.mp4` contiene
siete escenas de 1,6 s: cuatro asset-led normales, dos editorial-text y un
fallback missing; además cubre tres estructuras, `accent-mask`, `duotone`,
`none`, sustain, punch y salida. Los clips pasan por `renderGraphicClip` y luego
por el canal real `export-video`/timeline.

Resultado medido: H.264, yuv420p, 720×1280, 30 fps, 336 frames y 11,2 s. Durante
la vía visual/export hubo cero peticiones de red. La petición de voces que la UI
existente intenta al arrancar quedó bloqueada y se excluye explícitamente del
contador visual.

## Regresión y rendimiento

La salida legacy del fixture `memoria` se comparó con una captura de la base
exacta `b735f05`, bajo el mismo Electron e instante. Umbrales: hasta 3% de
píxeles con delta >8 y delta medio por canal hasta 2. Resultado final: 0% y 0;
no se exige igualdad entre archivos PNG.

Medición comparable de 24 frames a 540×960, 15 fps, 1,6 s:

- legacy: 23,46 ms/frame, 1,17 intentos/frame;
- asset-led: mediana 24,63 ms/frame;
- diferencia observada: +4,97%.

Es una medición de este host, no una cifra universal. Queda por debajo de la
puerta de +25%; no se introdujo degradación automática.

## Evidencia automatizada

- `test:visual-asset-mvp`: 40/40 casos sobre consumidores compilados reales;
- runner esperado: 13 suites;
- hoja y vídeo: `npm run accept:visual-asset-mvp`;
- `evidence.json`: SHA de artefactos, assets, QC, ffprobe, rendimiento, red y
  regresión.

`VERSION_PLANTILLAS` puede permanecer en 12: ningún Visual sin `sceneSpec`
cambia, y la nueva vía queda identificada por `sceneSpec`, versión, revisiones,
SHA, tratamiento y motion. Subirla invalidaría innecesariamente la caché legacy.

## Fuera de alcance y próximo bloque

No se implementan Asset Resolver, AttentionIntent, providers nuevos, foto,
archivo/vintage, Support, collage, sincronía con voz, transición entre escenas,
16:9, UI ni IA. El próximo bloque es **GRAN RONDA 3/3 — Asset Resolver mínimo
automático**: proyecto primero, OpenMoji, continuidad/variedad, fallback trazable
y compilación al contrato ya certificado.
