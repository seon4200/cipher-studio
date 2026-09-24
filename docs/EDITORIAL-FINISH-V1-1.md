# Acabado editorial V1.1 — alcance verificable

Perfil opt-in `editorial-modular-finish-v1-1`, revisión de píxeles `editorial-modular-finish-2026-09-v1-1`. La ausencia del perfil conserva la ruta V1. No se migran escenas ni se amplía el catálogo de 250 recursos.

## Lo implementado

| Capacidad | Estado y autoridad |
| --- | --- |
| Seis familias | Se reutilizan `marcoPoster`, `editorial`, `partidoVertical`, `cuaderno`, `constelacion` y `cascada`. Cada una tiene una variante `base` y una `focus` para 9:16 y 16:9. La geometría vive en `src/shared/editorial-finish-v1-1.ts`; `focus` no es una nueva familia. |
| Tipografía | Fraunces (principal), Instrument Serif y Bricolage Grotesque como displays locales. DM Sans y IBM Plex Sans Condensed acompañan. El contrato congela nombre, peso y SHA de archivo. El render espera las fuentes antes de capturar. La elección manual se guarda por escena; la selección narrativa automática por sección aún no existe. |
| Color | Titular, keyword, cuerpo/labels y efectos tienen roles separados y resueltos en el SceneSpec. El teal de objeto `#238C87` usa `#176A66` como keyword por defecto sobre papel para evitar el aviso de contraste; una elección explícita no se cambia silenciosamente. |
| Partículas y ambiente | Eventos locales deterministas por ID de Hero, Support o llegada; marcas de tinta y acento con semilla, tamaño, cantidad, inicio, duración y opacidad congelados. Dos intensidades y apagado. El ambiente es independiente y se reduce durante relaciones. No se ilumina de nuevo el RGB interno de un raster. |
| Relaciones | ID, extremos, significado, dirección, rutas certificadas por formato, representación (`arrow`, `dotted`, `dot-flow`, `light-pulse`, `accent-link`) y respuesta (`none`, `accent`, `halo`, `pulse`, `scale`). La sexta receta es escala de recepción combinada con una ruta. No cambia los slots ni la geometría al cambiar sólo receta/color. |
| Router | Prueba todo el recorrido contra título, otras tarjetas y zona de labels. Usa recta, curva o codos; un caso sin ruta se rechaza con `EDITORIAL_FINISH_ROUTE_BLOCKED`. El objetivo Hero es una región óptica derivada, todavía no una segmentación por píxel de cada silueta. |
| Cámara y relaciones | Con relaciones V1.1, la cámara se congela explícitamente en `fixed` en el SceneSpec. Las rutas aún no siguen un Hero con `quiet-drift`; evitar su desanclaje tiene prioridad. Las escenas sin relaciones pueden conservar la cámara heredada. |
| UI/persistencia | Selector opt-in y controles de fuente, composición, intensidad local/ambiente, representación, respuesta y cuatro roles de color. Generación, edición por clip, guardado, reapertura, regeneración y exportación consumen el contrato. Un Support sustituido elimina relaciones que perderían sentido. |
| Identidad | El plan visible completo, rutas, timing, colores, eventos y fuentes entran en PixelIdentity. Rutas absolutas y procedencia no. El render, como en V1, utiliza ProjectAssets materializados y después trabaja offline. |

## Evidencia reproducible

`tests/aceptacion/editorial-finish-v1-1/corpus.cjs` fija 12 escenas: dos por cada familia, con pausa tipográfica, 2/3/4 Supports y relaciones curadas. `generar.cjs` produce 24 MP4, keyframes de entrada/pico/lectura, galería y montajes en `C:\graphify\_cipher-editorial-finish-v1-1\evidence`. Los A/B de F11 conservan texto, assets, extremos, rutas y posiciones al variar representación/respuesta, intensidad o display. `comparisons.cjs` verifica esas invariantes y prepara vistas de 360 px.

Resultados del corte: 24/24 MP4, 0 hallazgos QC, 0 `visual-sin-fichero`, 0 intentos de red tras materialización. V1 pasó su contrato de catálogo e identidad. V1.1 rechazó rutas imposibles y campos falsificados; una escena renderizada dos veces en fixtures distintos produjo el mismo SHA-256 de MP4. La prueba temporal de la ruta real guardó/reabrió, regeneró, cambió fuente y Support, retiró relaciones obsoletas y exportó. Estos resultados técnicos no sustituyen la aprobación visual.

La galería es un corpus sintético de composiciones; no certifica selección automática de familias y recetas para cualquier guion. El A/B de efectos muestra marcas visibles a 360 px en el pico y su retirada en el tramo estable. El caso de cuatro Supports acaba el último efecto a `u=0.765`, dejando 0,5 s sin evento antes del comienzo de salida en un clip de 4 s. Los Supports pueden leerse antes de ese instante; el margen no debe confundirse con toda la ventana de lectura.

## Pendiente respecto al prompt maestro

- Continuidad de identidad/pose entre tres clips, reencuadre por estados e invalidación de caché vecina: no implementados.
- Planificador de video largo que elija variación por contenido, secciones y escenas anteriores: no implementado; el corpus está curado a mano.
- Variación de tipografía por sección con continuidad automática: no implementada. El usuario puede elegir display, pero no hay un planificador narrativo de fuentes.
- Router: valida contra rectángulos y objetivos ópticos, no contra máscaras de foco semánticas de cada Hero. Una relación con un Hero excepcional todavía requiere curación.
- Color claro sobre una superficie de acento pequeña y cambio de estado mantenido entre escenas: no demostrado.
- Benchmark comparable de coste por frame apagado/activado y prueba de audio sincronizado: no medidos en este corte.
- Iluminación dinámica verdadera y cámara 3D: no existen; los raster conservan su luz incorporada.

No se cambiaron flechas o escenas históricas por defecto. No se añadieron imágenes, fuentes, familias ni servicios externos. Las decisiones nuevas sólo afectan a la revisión opt-in.
