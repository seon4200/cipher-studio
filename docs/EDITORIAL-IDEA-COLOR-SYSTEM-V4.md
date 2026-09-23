# IDEA Assembly V4 — Color Pilot

## Alcance y activación

Esta revisión es opt-in: `editorial-idea-assembly-2026-09-v4` (sistema de color `editorial-color-system-2026-09-v1`). V1/V2/V3 conservan sus rutas de composición y filtros. No cambia `VERSION_PLANTILLAS`, la selección semántica ni el catálogo general.

En un proyecto nuevo o temporal, seleccionar **IDEA Assembly V4 — Color Pilot** en el control de perfil visual, indicar la carpeta que contiene los diez PNG runtime aprobados de IDEA y configurar la tinta de Supports. Pulsar **Generar IDEA V4 en timeline**. El botón materializa los ProjectAssets en el proyecto activo, compila `VisualSceneSpecV2`/`RenderBindingsV2`, renderiza con `MotionGraphicV15` y añade un clip `category=visual`. El proyecto guarda la intención de UI, el SceneSpec con los colores resueltos, los bindings y la orientación original. Regenerar el clip utiliza estos últimos, no los controles actuales.

La generación normal de guiones largos **no** usa este piloto de una escena: con el perfil seleccionado devuelve un error explícito y dirige al botón dedicado. Los proyectos antiguos no lo activan automáticamente.

## Contrato y seguridad

`supportTint` congela `revision`, `source` y `resolvedColor`. Las fuentes son `ink` (`#11110F`), `video-primary` (el naranja editorial V4 `#A83B19`), `hero-primary`, `hero-secondary` y `custom`. El HEX final debe coincidir con `^#[0-9A-F]{6}$`. El render usa únicamente el valor resuelto del SceneSpec; no consulta la paleta global ni vuelve a resolver la UI. `heroPalette` congela `mode`, `primary` y, cuando exista una segunda capa, `secondary`. Los campos visibles, capacidades, SHA, geometría y revisión forman parte de `PixelIdentity`. Rutas absolutas, procedencia y diagnósticos permanecen fuera.

La ruta de producción V4 autoriza exactamente los diez PNG IA del piloto por SHA-256. Sólo `personas-v2`, `datos`, `soluciones` e `impacto` se marcan `alpha-mask` y se usan como `simple-icon` con alpha útil. La capa `accent-paper` es el único `accent-primary` autorizado. Busto, bombilla, piedra, papeles neutros, fondo, tarjetas, tipografía y conectores no reciben tint. Las pruebas de contrato rechazan un raster no autorizado, una capa neutra declarada como acento, un soporte modificado y HEX no normalizado.

El contenido fijo de los Supports se transforma mediante máscara del canal alfa y relleno HEX exacto en Chromium. El Hero usa la primitiva SVG de máscara alfa derivada de `MotionGraphicV15`; los cuatro iconos pequeños usan máscara alfa CSS, porque las capturas independientes con máscara SVG mostraron deriva reproducible sólo en sus bordes (39.469 canales RGB, y 10.339 tras recrear la ventana). Con máscara CSS y la ventana offscreen reutilizada, el replay del fotograma estable produjo `pixelDiff=0`. V4 no usa `hue-rotate` ni `saturate`; V1/V2/V3 mantienen sus filtros históricos.

`dual-accent` requiere una segunda capa física `idea-accent-secondary` y la rechaza claramente si falta. `fixed-spectrum` requiere un asset autorizado como tal. Ambas opciones se muestran deshabilitadas para este Hero de un solo acento; el contrato ya distingue los modos, pero no inventa una segunda máscara ni presenta el papel naranja como un CRT multicolor.

## Assets y frontera futura

Los diez masters runtime existentes proceden de imágenes de ChatGPT del piloto IDEA V2/V3 y se reutilizan sin regeneración: busto, bombilla, collage trasero, papel de acento, collage delantero neutro, cuatro iconos y fondo. Sus SHA exactos están en `evidence.json` de la aceptación V4. El piloto sigue la ruta `ProjectAsset/raster`; no amplía `LocalManifestCatalog` ni importa assets nuevos. Antes de un catálogo grande, cada Support recoloreable debe tener metadata `colorCapability=alpha-mask`, monocromía, transparencia real y alfa útil. Uno de dos colores necesita `inkMask` y `accentMask` separados.

## Evidencia y resultados

La aceptación `npm run accept:editorial-idea-color-v4` genera MP4 9:16 en tinta negra, naranja, teal, crimson y HEX personalizado, más MP4 16:9 naranja, keyframes, contacto HTML y `evidence.json` bajo `C:\graphify\_cipher-idea-color-v4\runs\<run>`. Cada MP4 tiene 80 frames a 24 fps (3⅓ s), QC sin errores y `visual-sin-fichero=0`; red bloqueada tras materialización. La comparación cuantifica papel y busto frente al acento: el H.264 con pérdida puede cambiar unos pocos valores neutros por compresión entre temas, aunque el PNG fuente, su SHA y el tratamiento sin tint no cambian. El color resuelto exacto se comprueba en el SceneSpec y mediante píxeles visibles de los cuatro iconos dentro de la tolerancia de decodificación del MP4; no se confunde la compresión con un recolor del material.

`npm run accept:editorial-idea-color-v4-ui` abre una instancia con `userData` y proyecto temporales, activa el perfil desde el selector, establece un HEX personalizado desde la UI, pulsa el botón, verifica el clip en timeline/autosave, lo regenera mediante preload/IPC y bloquea la red. Las suites `accept:editorial-idea-assembly-v1`, `v2` y `v3` verifican las revisiones anteriores. En la comparación disponible, los 20 keyframes V3 fueron idénticos por SHA-256 a la evidencia previa a V4.

La aprobación estética continúa pendiente de revisión humana. Este piloto no construye el catálogo de 100 ni ofrece todavía Heroes duales/fixed-spectrum reales.

En esta máquina de pruebas no había `ffmpeg.exe` en `PATH`; las aceptaciones utilizaron un binario aislado mediante `CIPHER_FFMPEG_EXE`, sin modificar la configuración de Windows ni los proyectos del usuario. La app requiere que su ruta de FFmpeg esté disponible como en las fases anteriores. Los videos de evidencia no contienen narración; la sincronización con voz no fue validada aquí.
