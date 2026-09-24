# Banco editorial local V2 — estado de integración

Base: `0dca4084a36c70204c16e1c30b91d61da2e8e549` (`v15-editorial-finish-v1-1`). Rama de trabajo: `v15-editorial-local-17-families-v2`.

## Alcance implementado y verificable

- Perfil nuevo `editorial-local-bank-v2`, revisión de píxeles `editorial-local-bank-2026-09-v2`. Los proyectos sin ese perfil conservan el dispatch histórico.
- Diecisiete geometrías separadas para 9:16 y 16:9 sobre el compositor V15 existente. Hero, dos a seis Supports y capas `rear/accent/front` independientes se congelan en SceneSpec y RenderBindings. El relleno alpha afecta al acento y a los iconos autorizados, no al RGB del Hero.
- Selector por concepto/relación del contenido, con memoria inmediata de las tres últimas familias. Los 17 IDs son alcanzables con contenido sintético adecuado; esto no demuestra cobertura universal del lenguaje natural.
- Entradas finitas, tres beats normalizados, pequeñas reubicaciones previas al trazado, relaciones dirigidas y efectos de llegada del acabado V1.1. La cámara 2D suave se limita a ciertas familias y se estabiliza antes de sus conectores. No es cámara 3D ni continuidad entre clips.
- La ruta ordinaria de generación puede materializar ProjectAssets, renderizar, insertar Visuales, guardar, reabrir, regenerar y exportar V2. Esta comprobación usa un proyecto temporal y una respuesta semántica **simulada**; no es una interacción humana con la UI ni una llamada real a DeepSeek.
- El botón de biblioteca de V2 verifica los 250 PNG por bytes, SHA, dimensiones y alpha. La lista del manifiesto sola no se presenta como salud de archivos.
- El panel de mezcla V2 usa el alto disponible de la columna izquierda y scroll propio. Una instancia aislada de Electron comprobó que el botón Construir queda alcanzable, sin recorte del padre, a 1366×768, 1920×1080 y zoom 125 %. Capturas y medidas: `C:\graphify\_cipher-editorial-local-bank-v2\evidence\ui-panel`.

## Evidencia y cómo arrancar

Desde `C:\graphify\cipher-studio-round-d`, ejecutar `npm run build` y el comando habitual `npm run dev`. En un proyecto **nuevo**, seleccionar «Editorial local — dirección automática», indicar una vez la carpeta `C:\graphify\_cipher-editorial-catalog-v1-250` (contiene `inventory.json`), pulsar «Verificar manifiesto, PNG y SHA», dejar el acento en Automático o escoger uno, y construir con guion, audio y tiempos por palabra. Visuales sigue siendo cuota de clips; Gráficos y Transiciones son fases distintas.

Corpus dirigido: `C:\graphify\_cipher-editorial-local-bank-v2\evidence\editorial-local-bank-v2-gallery.html`, montajes `editorial-local-bank-v2-portrait.mp4` y `editorial-local-bank-v2-landscape.mp4`, 34 MP4 individuales, SceneSpecs/identidades JSON y contactos `contact-portrait-v2.jpg` y `contact-landscape-v2.jpg`. Los montajes son clips sintéticos de 3 s, no un video producido desde el selector humano de la UI.

Cada fila E tiene `E##-portrait.mp4`, `E##-landscape.mp4` y fotogramas estables homónimos en esa carpeta. `result.json` registra los IDs exactos de Hero, Supports y capas, el texto, orientación, color, identidad, eventos y QC por render.

| Escena | Familia real | Hero | Supports | Rear / accent / front |
| --- | --- | --- | ---: | --- |
| E01 | editorial | h001 | 4 | l001 / l036 / l021 |
| E02 | marcoPoster | h011 | 3 | l003 / l038 / l023 |
| E03 | partidoVertical | h025 | 3 | l002 / l037 / l022 |
| E04 | cintaDiagonal | h009 | 3 | l002 / l037 / l022 |
| E05 | anillosConcentricos | h035 | 3 | l003 / l038 / l023 |
| E06 | rayosImpacto | h001 | 3 | l001 / l036 / l021 |
| E07 | cuaderno | h006 | 3 | l003 / l038 / l023 |
| E08 | constelacion | h025 | 4 | l002 / l037 / l022 |
| E09 | capasApiladas | h101 | 3 | l002 / l037 / l022 |
| E10 | redNodos | h025 | 4 | l002 / l037 / l022 |
| E11 | lineaTiempo | h135 | 3 | l003 / l038 / l023 |
| E12 | corteTransversal | h101 | 3 | l002 / l037 / l022 |
| E13 | abanicoTarjetas | h041 | 4 | l002 / l037 / l022 |
| E14 | engranajes | h102 | 3 | l003 / l038 / l023 |
| E15 | cascada | h101 | 3 | l002 / l037 / l022 |
| E16 | mundoIsometrico | h120 | 3 | l001 / l036 / l021 |
| E17 | pilaVertical | h101 | 5 | l002 / l037 / l022 |

Ruta ordinaria de backend con semántica simulada: `C:\graphify\_cipher-editorial-local-bank-v2\evidence\normal-route\normal-route-vertical.mp4` y `result.json`. Son tres Visuales de 2,5 s, sin audio de narración de prueba.

Pruebas dirigidas: `tests/aceptacion/editorial-local-bank-v2/contracts.cjs`, `normal-route.cjs`, `ui-panel.cjs` y `generar.cjs`. Ejecutarlas con Electron después del build. `contracts.cjs` verifica físicamente los 250 PNG, las 17 familias, la selección alcanzable, seis Supports, las tres capas, cambio de identidad por color y preservación de la identidad base.

Verificación de cierre de esta iteración: `npx tsc --noEmit` PASS; `npm run build` PASS; corpus 34/34 PASS; ruta ordinaria temporal 3/3 Visuales con cero `visual-sin-fichero`; panel aislado en los tres tamaños/escala indicados PASS; contratos históricos V1 y V1.1 PASS; runner global `npm test` 40/40, código de salida 0. El primer intento de runner dio 39/40 por la ausencia del nuevo campo en un fixture exhaustivo de persistencia; se corrigió ese fixture y se volvió a ejecutar completo, sin cambiar baselines ni tolerancias.

## Límites que impiden certificar el encargo completo

1. El proveedor sigue fijado al inventario de 250 y a su SHA/roster V1. La verificación completa existe, pero **no** hay todavía snapshots extensibles ni importación por lote con previsualización/rollback. No se debe declarar preparada la alta productiva de 5.000 entradas.
2. La afinidad de capas usa tres recetas conservadoras por clase de forma, no compatibilidad individual de los 150 Heroes. En la revisión de contactos, algunos recortes compactos quedan alejados del sujeto (por ejemplo E03). `focalRegions` sigue sin curación semántica por asset. No corresponde aprobar automáticamente cada combinación.
3. La selección contextual es literal por conceptos proporcionados; variantes flexivas, desambiguación amplia y memoria de todo el video aún no están resueltas. Si no hay dos Supports pertinentes, vuelve explícitamente a una escena type-led. No se inventan apoyos para cubrir cuota.
4. El panel de la instancia de prueba sí se verificó a tres tamaños/escalas. Esto no prueba el flujo entero de construir con clicks desde la UI ni accesibilidad exhaustiva de todos los controles de Gráficos y Transiciones.
5. La ruta productiva probada usa un mock semántico y 7,5 s, no un proyecto de 60–90 s con DeepSeek real, audio de usuario, Gráficos y Transiciones configurados desde la UI. Tampoco se ha validado una edición por clip de V2 que permanezca tras cerrar/reabrir.
6. Los corpus comprueban salida de render; no certifican por sí mismos ritmo subjetivo, lectura en móvil ni correspondencia semántica de todos los emparejamientos. La revisión estética sigue pendiente.

La entrega V1.1 tiene un bundle y un ZIP externo verificados; su publicación en `origin` no pudo comprobarse porque GitHub:443 no era accesible desde este entorno. No se ha hecho push de esta nueva rama.
