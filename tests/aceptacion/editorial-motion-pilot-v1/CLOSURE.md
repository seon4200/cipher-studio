# Cierre técnico Fase 2A — piloto editorial

Base: `db0353f28b281463d6bb4ee264a2e7716e771350`. Piloto inicial: `3512ab3a42763e70f385de90de9a1441af7f9549`. Este cierre no altera proyectos reales ni activa el perfil por defecto.

## Atribución de regresiones

La [matriz de 16 fallos](regression-attribution.md) se obtuvo antes de modificar la presentación: worktrees separados, mismo `package-lock`, `node_modules` sólo en lectura, builds independientes, userData temporal y DPI fijado a 1 en ambos. Catorce suites fueron precondición/contaminación del arnés (estado raíz supuesto ausente o captura con DPI distinto); `persistencia` fue una regresión real del fixture al omitir `visualPresentationProfile`; el fallo exact-pixel de `v15-color-system-v1` se reprodujo en base pero no en piloto en esa comparación. No se atribuye causalmente a GPU. El runner actualizado terminó **30/30**, código 0. La suite `test:ventana` sigue excluida explícitamente por el runner preexistente.

Los archivos raíz `project-state.json` y `project-state.json.bak` se comprobaron por separado; el primero está ignorado y es leído por los mecanismos de persistencia, el segundo es una copia sin seguimiento que no se consume productivamente. Ambos conservan sus bytes. La copia externa de `.bak` está en `C:\cipher-safety-backups\cipher-project-state-bak-before-editorial-20260916-210105.bak` (970 bytes; SHA-256 `F24A2BF434DB6601785AA5F62B0427E67DA85655B22C9776A6DEE8BE984FF66B`).

## Revisión y aceptación

El selector de la app mantiene el ID opt-in `editorial-hybrid-v1`; las nuevas generaciones materializan la revisión `editorial-hybrid-pilot-2026-09-v2`. La revisión v1 persiste y se despacha sin cambios en su rama de render. La relación de movimiento `editorialMotionCue` se congela dentro de cada SceneSpec v2 y de PixelIdentity. `VERSION_PLANTILLAS` permanece en 15. Regeneración v2: misma identidad con el mismo contexto. UI: se creó un proyecto desechable mediante la portada en una ventana Electron oculta y se comprobó el selector V2; **no** se verificó su accesibilidad física en la TV. Esa exploración de UI provocó una escritura no deseada en el `project-state.json` raíz del checkout pese al proyecto temporal. Se restauró de la copia externa byte por byte (SHA original verificado), se retiró la interacción del test automatizado y se añadió un guard de integridad de los dos estados raíz; la ejecución posterior pasó sin modificarlos. La ruta de UI necesita aislamiento adicional antes de automatizarse de nuevo.

Se reutilizó exactamente el corpus sintético de 12+4 escenas de `editorial-motion-pilot-corpus-v1.js`. Los primeros ocho A/B mantienen texto, duración, roles, proveedor y SHA iguales. No hubo sustituciones de assets en las 16 escenas. Sólo la escena 12 recupera del texto local el final literal truncado, «sola respuesta»; está fuera del A/B bloqueado y figura separada en `evidence.json`. Respuestas Pixabay capturadas, búsqueda de red bloqueada, render offline, 24 FPS. Las hojas y MP4 de la revisión están en `revision-v2/`; `revision-v1-recheck/` contiene el control histórico bajo el build actual.

Cambios de composición v2: comparación espacial con Hero/Support enfrentados; agrupación más compacta en split/cuaderno; Hero numérico subordinado al 72% confirmado; full-raster contextual en `contain` para preservar la misma fuente; Supports algo mayores sin dominar al Hero. No se añadieron tarjetas/halos/partículas ni se alteró semántica o selección de recursos. El encuadre de PROTESTA mantiene la fuente capturada y la imagen completa; la relación de aspecto limita su tamaño aparente en 9:16. La jerarquía semántica imperfecta de HISTORIA/PROYECTO y CONSTRUYERON sigue siendo visible: el perfil no cambia quién ganó Hero/Support.

Coreografía v2: comparación con entrada emparejada, proceso escalonado, causa y apoyos posteriores al Hero, dato con entrada posterior del icono, protagonista primero. La muestra `editorial-pilot-reading-5-vertical.mp4` reutiliza cinco SceneSpecs existentes a 3,8 s por escena para observar entrada, tramo estable y salida. No contiene audio ni valida sincronía de palabra. No se alargan automáticamente escenas productivas.

## Compatibilidad y rendimiento

Las 16 identidades de SceneSpec v1 re-materializadas coinciden exactamente con `evidence.json` previo. Ambas versiones del control reabren y renderizan. **No se declara pixelDiff=0 contra PNG extraídos de MP4 antiguos**: en `motion-stable.png` hubo 107421 píxeles distintos de 518400, delta medio máximo por canal 0,59 y máximo 26; dos hojas comparadas sí coincidieron exactamente. Estas diferencias de artefactos comprimidos no prueban una regresión de composición, pero impiden certificar paridad exacta de esos PNG. La rama de JSX para v1 y sus reglas de geometría se mantuvieron inalteradas.

Medición serial con mismo checkout/dependencias/viewport/24 FPS, ocho escenas A/B, tiempo por frame: revisión v1 recheck 42,64 ms; revisión v2 44,70 ms (+4,8%). Los controles estándar medidos en esas mismas pasadas fueron 42,25 y 43,40 ms respectivamente: hay deriva entre pasadas, por lo que la diferencia no es una atribución causal exacta. RSS máximo del proceso principal: v1 160,17 MB; v2 157,09 MB. No representa memoria pico de todos los procesos Electron.

La evidencia de layout no demuestra elegancia; requiere revisión visual humana. Siguen pendientes la selección semántica en casos conocidos, licencia de pesos de cutout antes de distribución y accesibilidad del selector en la TV. No se inició Fase 2B ni el rediseño de UI.

## Reanudar sin rehacer

Ejecutar `npm run build` antes de pruebas. `npm test` ejecuta 30 suites con el factor de escala de captura fijado para ambos entornos. `npm run test:editorial-motion-pilot-v1 -- --force-device-scale-factor=1` cubre v1/v2, QC, MP4 y selector UI en un proyecto temporal. Para regenerar la evidencia V2 con las fuentes locales ya validadas: `$env:CIPHER_PILOT_REVISION='v2'; .\node_modules\.bin\electron.cmd tests\aceptacion\editorial-motion-pilot-v1\generar.cjs --force-device-scale-factor=1`. La aceptación bloquea solicitudes externas y no simula contenido del video del usuario.
