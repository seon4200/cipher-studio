# Captura offscreen DPI-safe V15

Base: `25d5390ef73492afb9f2f096e79b98af39d45d47`. Electron 31.7.7 / Chromium 126.0.6478.234. La ventana visible conserva la escala de Windows; el compositor sigue usando el mismo SceneSpec, RenderBindings y renderer. `VERSION_PLANTILLAS` permanece en 15.

## Causa y estrategia

Con la TV a escala 2,25, `capturePage()` devolvía 2430×4338 al solicitar 1080×1928. La guarda anti-recorte abortaba el render y la generación reemplazaba cada Visual por `visual-sin-fichero`. En Electron 31, `webPreferences.offscreen` está tipado como booleano; una prueba con `{ deviceScaleFactor: 1 }` no cambió ni la captura ni los eventos `paint`. No se aplica el switch de escala a la aplicación visible.

Las SceneSpecs modernas se capturan en un proceso Electron auxiliar aislado con `--force-device-scale-factor=1`. Comparte el mismo módulo principal y el mismo compositor; el proceso sólo usa `userData` temporal y no inicia la UI. La ruta legacy a escala 1 conserva la captura anterior; a escala distinta de 1 también usa el auxiliar. Cada bitmap sigue sujeto a la guarda de dimensiones exactas, vacío y longitud BGRA. No hay reescalado de imágenes en producción. El trabajo temporal se crea en un directorio hijo validado de `os.tmpdir()` y se elimina al terminar.

La alternativa de reducir un bitmap sobredimensionado se descartó: en el control 1080×1928 tardó aproximadamente 20–43 ms según escala, y produjo diferencias RGBA extensas frente a una captura nativa 1×. Así no puede prometer `pixelDiff=0` para la misma identidad.

## Reproducción aislada

Resoluciones pedidas: vertical productiva 1080×1928, vertical de control 540×968 y horizontal de control 1280×728. `captureMethod=webContents.capturePage`, zoomFactor=1, `displayScaleFactor` y `window.devicePixelRatio` iguales a la escala simulada. Capturas iniciales de una ventana offscreen sin aislamiento:

| Escala | 1080×1928 | 540×968 | 1280×728 | Ratio X/Y |
| --- | --- | --- | --- | --- |
| 1,00 | 1080×1928 | 540×968 | 1280×728 | 1,00 |
| 1,25 | 1350×2410 | 675×1210 | 1600×910 | 1,25 |
| 1,50 | 1620×2892 | 810×1452 | 1920×1092 | 1,50 |
| 2,00 | 2160×3856 | 1080×1936 | 2560×1456 | 2,00 |
| 2,25 | 2430×4338 | 1215×2178 | 2880×1638 | 2,25 |

La primera actualización de tamaño en Windows puede dar un ancho transitorio distinto. Por eso se verifica `getContentSize()` tras `setContentSize()` y se reintenta hasta tres veces, sin aceptar una dimensión incorrecta. El clasificador distingue tamaño exacto, escala DPI uniforme, aspecto distinto, escala no uniforme, tamaño inferior y captura vacía. Los diagnósticos incluyen tamaños y ratios pero nunca entran en PixelIdentity.

## Determinismo y aceptación

La captura de una misma SceneSpec histórica a escalas simuladas 1, 1,25, 1,5, 2 y 2,25 produjo el mismo hash de identidad y el mismo SHA-256 de PNG de frame (`4b2a9285e7a6a4fc0a130f4cd47f08ce062bb6930e8c12a65295bd0758124e79`); `pixelDiff=0` para ese control. No se modificaron SceneSpec, RenderBindings, PixelIdentity ni renderer.

Proyecto temporal con narración “Cámara, robot, resultado, peligro y ciudad.”, respuesta semántica capturada y red bloqueada durante el render: en escalas 1 y 2,25, 3 Visuales planeados, 3 SceneSpecs, 3 archivos de 1080×1920, 3 clips visuales en timeline y cero `visual-sin-fichero`. La exportación generó un MP4 de 6 s a 720×1280 en ambos casos. La primera escena tiene asset de cámara; las otras escenas del fixture son principalmente tipográficas. Esta prueba verifica el trayecto de generación/captura/exportación, no la riqueza semántica del fixture.

El cambio de escala 1→2,25→1 se simuló mediante arranques separados; no se cambió la configuración de Windows en caliente. Las SceneSpecs modernas siempre usan el auxiliar 1×, por lo que no necesitan recrear la ventana visible al cambiar de pantalla. La ruta legacy directa durante un cambio de escala en caliente no se evaluó de forma independiente.

TypeScript y build pasaron. La prueba dirigida pasó a 1 y 2,25. El runner global terminó 31/31. Una ejecución aislada de `v15-color-system-v1` falló en su aserción exact-pixel histórica (47854 píxeles diferentes); la repetición aislada y la ejecución del runner pasaron. La base pasó una ejecución equivalente. No se atribuye ese fallo intermitente a GPU ni se regenera el baseline; queda registrado para seguimiento.

Evidencia fuera del repositorio: `C:\graphify\_dpi-safe-probe\acceptance-dpi-1.mp4`, `acceptance-dpi-2.25.mp4`, sus JSON y `global-runner-20260917.log`. No se tocaron proyectos reales ni `project-state.json.bak`.
