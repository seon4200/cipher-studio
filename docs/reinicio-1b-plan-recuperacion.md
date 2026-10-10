# Entrega 1B — Plan y recuperación de Original + Stock

Base: continuación de `255c23a` en el worktree separado
`C:\graphify\_worktrees\cipher-1b-plan-recuperacion-20261010`, rama
`work/reinicio-1b-plan-recuperacion-20261010`.

Estado: corrección de duración/encuadre implementada; TypeScript y 11 pruebas
focalizadas aprobados. El build de producción a carpeta aislada pasó sin alterar
`dist/index.html`. La aceptación manual de recuperación y exportación sigue pendiente;
este documento no declara cerrada 1B.
El usuario autorizó crear el commit y publicar una rama separada el 10 de octubre
de 2026 (UTC). Esta entrega no modifica su instalación local de Windows.

## Problema y comportamiento nuevo

El recorrido anterior borraba la carpeta de Original antes de reconstruir, mantenía
el avance solo en memoria, admitía clips de más de tres segundos y convertía Stock
fallido en Original. Al cerrar o fallar no había un plan recuperable por escena.

El recorrido principal `generate-timeline-assets` ahora delega en un motor persistente:

1. Guarda los ajustes del proyecto antes de empezar.
2. Comprueba entradas e identidad del audio/vídeo mediante SHA-256.
3. Guarda un plan con IDs estables, referencia al guion, intervalos enteros a 30 fps
   y mezcla por tiempo de pantalla. Incluye los silencios sin estirar otros clips.
4. Obtiene las búsquedas/timestamps mediante un adaptador de DeepSeek. ChatGPT queda
   reservado para 1C; el motor de ejecución no depende de su API.
5. Ejecuta escenas secuencialmente con intentos limitados y registro persistente.
6. Recodifica cada salida, verifica fotogramas, duración, decodificación y hash.
   Los clips nuevos de vídeo ocupan entre 60 y 90 fotogramas (2–3 s, inclusive);
   el audio principal conserva su archivo y duración completa en una sola pista.
7. Guarda cada resultado antes de marcarlo completo. Un fallo Stock sigue en Stock.
8. Solo monta automáticamente cuando todos los medios están completos. Si hay
   pendientes, mantiene el montaje anterior y conserva los archivos terminados.
9. Continuar verifica los archivos guardados y procesa lo pendiente o dañado.

Los formatos de la interfaz `horizontal`, `vertical` y `square` están admitidos.
El recorte de vídeo ahora escala proporcionalmente hasta llenar el lienzo y recorta
centrado; no deforma ni añade barras. El seguimiento avanzado del sujeto queda para 1D.
La mezcla nueva usa `[Original, Stock, IA]`, con IA en cero. El valor inicial es
Original 30 %, Stock 70 %. Los proyectos antiguos conservan sus ajustes al abrir;
si contienen cuotas IA/formato antiguo de cuatro pesos, deben elegir explícitamente
la mezcla Original + Stock antes de usar esta entrega.

Si el porcentaje pedido no se puede representar con clips completos de 2–3 s, el
planificador busca el reparto temporal más cercano y la interfaz debe confirmarlo
antes de guardar o iniciar la construcción. Para 5 s con Original 30 % / Stock 70 %,
propone Stock 3 s y Original 2 s (60/40 por tiempo; 50/50 por cantidad de clips).
Si la duración total, redondeada a fotogramas de 30 fps, no admite una cobertura
completa con esos límites, Construir queda bloqueado y explica el conflicto.

## Responsabilidades

| Archivo | Responsabilidad |
|---|---|
| `src/shared/build-plan.ts` | Contrato, entradas, escenas, reparto temporal y validación de cobertura. |
| `src/main/build/storage.ts` | JSON atómico, recuperación, archivo histórico y exclusión entre instancias. |
| `src/main/build/runner.ts` | Identidad de ejecución, estados, checkpoints, cancelación, continuación y validación para exportar. |
| `src/main/build/media.ts` | Procesos sin shell, sondeo, recorte por fotogramas, decodificación y hash. |
| `src/main/build/providers.ts` | Adaptadores DeepSeek y Stock, peticiones acotadas, descarga y candidatos. |
| `src/main/index.ts` | Adaptación IPC, guardado seguro y banco Original separado. |
| `src/preload/index.ts` y `types.d.ts` | Contratos IPC para construir, consultar estado y cancelar. |
| `src/renderer/src/main.tsx` | Captura del proyecto, guardado de entrada, montaje y rechazo de respuestas antiguas. |
| `src/renderer/src/components/BuildStatus.tsx` | Estado y errores por escena, continuar y cancelar en ambos paneles existentes. |
| `tests/build-recovery.cjs` | Pruebas aisladas con archivos FFmpeg reales y proveedores simulados. |

Se sustituye el bloque monolítico del recorrido principal; no se modifica el motor
secundario de sincronía perfecta, Whisper, reescritura, generación de voz, Canvas,
Vibes ni Cipher Control. Los gráficos/transiciones existentes se mantienen después
de completar los medios. Su procesamiento histórico no tiene la recuperación por
escena del nuevo motor de vídeo; el ensayo de 1B debe usar ambos en cero.

## Datos y protección de archivos

- `build/plan.json`: estado actual independiente del autoguardado de la interfaz.
- `build/history/<planId>.json`: planes anteriores conservados al crear otro.
- `build/locks/`: reservas por proceso; una salida abrupta se reconoce al reabrir.
- `build/stock-cache/`: descargas reutilizables del proyecto, fuera de la limpieza histórica.
- `materiales/builds/<planId>/<sceneId>.mp4`: resultados finales exclusivos de ese plan.
- `materiales/originales/bank-<batchId>-<n>.mp4`: segmentos manuales con nombres únicos;
  la presegmentación ya no vacía la carpeta.
- Cada JSON se escribe en temporal y se renombra tras sincronizarlo. Se conservan
  `.bak` (último estado válido) y `.before-1b` (estado anterior al primer reemplazo).
- Los archivos de audio principal no se segmentan ni modifican en este recorrido.

La identidad incluye guion, mezcla, formato, segmentos, rutas y contenido de fuentes.
Si cambia, Continuar lo explica y exige crear otro plan; no mezcla versiones.
La respuesta IPC y los eventos llevan la identidad del proyecto/solicitud. Una
respuesta antigua no se monta tras cambiar de proyecto o editar las entradas.

Los clips pueden reordenarse manualmente manteniendo cobertura y duraciones. Antes
de exportar una versión producida por 1B, se comprueban cobertura, identidad, mezcla,
archivos y duraciones; un montaje con huecos, solapamientos o vídeos ajenos a ese
plan requiere corrección. Los planes completos archivados siguen exportándose.
La exportación histórica de timelines sin identificador de plan conserva su recorrido.

## Reintentos y límites

Las peticiones tienen timeout y como máximo un reintento automático. Credenciales
rechazadas bloquean al proveedor; 429 respeta Retry-After cuando cabe en el presupuesto,
o deja el trabajo pendiente. Hay hasta dos intentos de dirección por lote en cada
ejecución y un máximo persistido de seis. La preparación de cada escena está limitada
a tres minutos, tres candidatos por ejecución y seis registros de intentos de medios.
Los candidatos descartados se guardan. Agotar el presupuesto exige revisar la causa y
crear otro plan; no se borra el historial al pulsar Continuar.

La búsqueda mantiene un keyword por escena y proveedores conocidos. Se añadió el
siguiente candidato ante un archivo inválido. La expansión semántica de consultas,
la inspección visual y la selección editorial más avanzada pertenecen a 1D.
NASA se consulta solo para keywords espaciales.

### Verificación real de proveedores

Se hicieron consultas y descargas reales desde el `.env` ignorado de este worktree;
la prueba recibió claves solo en memoria y no registró valores ni URLs con credenciales.
Pexels permaneció sin configurar. NASA usó su biblioteca pública sin clave; Wikimedia
no está implementado en esta rama.

| Proveedor | Búsqueda HTTP / resultados | Candidatos del adaptador | Descarga/reproducción | Revisión de fotograma |
|---|---|---:|---|---|
| Pixabay | `running person`; HTTP 200; 5 resultados | 3 candidatos válidos; 1 intentado | Descarga real y FFmpeg válidos; 2.00 s, 1080×1920, 3,313,687 bytes | Campo de hierba y persona cortada al borde izquierdo; relación débil con correr. |
| Coverr | `running person`; HTTP 200; 2 resultados | 2 candidatos válidos; 1 intentado | Descarga real y FFmpeg válidos; 2.00 s, 1080×1920, 1,354,579 bytes | Imagen naranja y borrosa, sin acción reconocible; pertinencia incierta. |
| NASA | `astronaut space`; búsqueda 200 con 3 elementos; 2 solicitudes de assets, todas HTTP 200 | El adaptador tomó 2 MP4 (los dos manifiestos enumeraban 13 MP4 en total); 1 intentado | Descarga real y FFmpeg válidos; 2.00 s, 1080×1920, 334,390 bytes | Primer fotograma: hombre en interior, sin indicios visuales claros de espacio; pertinencia débil. |

En cada caso se descargó un candidato, se recortó y FFprobe/FFmpeg verificaron el
archivo resultante. Los dos candidatos restantes de Pixabay, uno de Coverr y uno de
NASA quedaron en el pool pero no se descargaron porque el primer candidato fue válido.
No hubo errores de configuración, conexión, límite ni ausencia de resultados en esta
ronda. La salida temporal está en `%TEMP%\cipher-provider-counts-81d6c780b31e4c1199989a68142d6b74`.
Los fotogramas muestran que HTTP 200 y reproducción no garantizan pertinencia: la
selección por consulta/aspecto sigue siendo básica; el análisis visual editorial se
mantiene fuera de alcance.

## Verificación realizada

Once pruebas aprobadas (`npm run test:build-recovery`, 11/11), con medios temporales
aislados y sin borrar ni leer proyectos existentes:

1. Asignación de clips de 2–3 s por fotogramas, cobertura sin residuos cortos, rechazo
   de duraciones inviables y vista previa Stock 3 s / Original 2 s para un total de 5 s.
2. Recortes FFmpeg reales y límites de fotogramas, límite final de fuente, rutas con
   espacios/acentos/#, tres formatos, prueba de píxeles sin barras en 9:16 y hash
   inalterado del audio de prueba.
3. Exportación de un plan legado completo que contiene clips cortos.
4. Bloqueo de la continuación de un plan legado incompleto, conservando sus archivos.
5. Stock fallido conserva categoría; un motor nuevo continúa sin regenerar vecinos
   completos ni borrar un archivo preexistente en `materiales/originales`.
6. Cancelación con resultados guardados, rechazo de ejecuciones simultáneas y continuación.
7. Rechazo de entradas/plan obsoletos, conservación del JSON, exportación de plan archivado
   y reordenamiento permitido.
8. Proveedor simulado: primera descarga corrupta, segunda válida; descarte registrado.
9. Reparación exclusiva de un clip completo que posteriormente se corrompió.
10. Escrituras JSON serializadas, recuperación desde backup y conservación del estado original.
11. Terminación real de un proceso hijo con SIGKILL después de un checkpoint, reapertura
    y continuación. Es una prueba del motor, no del cierre de la interfaz Electron.

`npx tsc --noEmit` pasó. El build completo del renderer Vite pasó en un directorio
temporal aislado; el plugin también compiló main y preload en `dist-electron/`.
`dist/index.html` mantuvo el SHA-256
`1D7A675E01AA3B60A22034BE181AD10C28133D6CEE7D0C19133FE09BFB79D860` antes y después.
`git diff --check` pasó.

El comando `npm run build` fue rechazado por la revisión automática porque su
`outDir` elimina y regenera `dist/`, donde reside el `dist/index.html` que se pidió
conservar. Se evitó esa escritura y se validó Vite con un `outDir` temporal dedicado.
`npm run dev` inició Electron desde este worktree y compiló el main/preload actuales;
el proceso abrió ventanas `CIPHER Studio`. Se registraron errores de Chromium al crear
la caché (`Acceso denegado`, código 0x5); la ventana abrió y la aceptación manual sigue
pendiente. Esta sesión no puede leer/controlar las ventanas nativas.

## Puerta de aceptación en Windows

El worktree separado es `C:\graphify\_worktrees\cipher-1b-plan-recuperacion-20261010`,
rama `work/reinicio-1b-plan-recuperacion-20261010`, HEAD antes de estas correcciones
`8390c2aa` (continuación de la entrega basada en `255c23a`). `npm run dev` abrió la ventana `CIPHER Studio`
desde esa ruta; Vite usó el puerto 5174 porque 5173 ya estaba ocupado y leyó el `.env`
local sin imprimir secretos. La utilidad de control de ventanas de esta sesión devuelve
`apps: []`, así que la aceptación de la interfaz debe hacerse manualmente.

El proyecto de ensayo ya contiene la construcción anterior y se conserva como evidencia:

- Plan legado completo `825018f5-057d-4872-b4bc-4f84ca928bb6`, 150 fotogramas/5 s,
  Stock 105 fotogramas/3.5 s y Original 45/1.5 s. Sus clips eran Stock 3.0 s,
  Original 0.667 s, Original 0.833 s y Stock 0.5 s.
- Instantánea previa a la nueva asignación en `cipher-studio/proyectos/aaaaa-1791607208911/build/evidence-before-min2-825018f5-057d-4872-b4bc-4f84ca928bb6/`;
  los medios originales permanecen en su carpeta exclusiva de plan.
- En la captura aportada, ambos clips Stock horizontales mostraban grandes franjas
  negras en el lienzo vertical. La búsqueda `person looking in mirror` produjo un
  corredor en un puente; `confused person thinking` produjo un hombre mirando desde
  una cerca. El primer resultado es una discordancia clara con la consulta y el segundo
  tiene relación débil. La relevancia no queda resuelta por el recorte; selección visual
  avanzada queda fuera de esta corrección.

La siguiente construcción debe ser un plan nuevo dentro del proyecto de ensayo, después
de confirmar el reparto 3 s Stock / 2 s Original y comprobar que Gráficos y Transiciones
persisten en 0 %. La ruta del audio principal no se divide ni se reemplaza. El runner
archivará el plan anterior y usará otro ID/carpeta de salida.

### Criterios de aceptación actualizados

1. Cada clip de vídeo de montaje (Original o Stock) dura entre 2 y 3 s inclusive; a
   30 fps son 60–90 fotogramas. Los clips del banco de Original no son clips del montaje.
2. Para el audio de 5 s y la mezcla pedida 30/70, la vista previa presenta Stock 3 s /
   Original 2 s antes de construir; la construcción no empieza hasta aceptar el ajuste.
   Se compara mezcla pedida, planificada y obtenida por segundos y por número de clips.
3. No se crea un residuo <2 s. Una duración total incompatible con cobertura completa
   bloquea la construcción con explicación; una mezcla incompatible pero duración viable
   presenta el reparto más cercano antes de construir.
4. El render 9:16 llena el cuadro por escala proporcional y recorte centrado, sin
   deformación ni barras negras. El audio maestro permanece completo e intacto.
5. Cerrar/reabrir y Continuar no duplican escenas completas ni convierten Stock en
   Original silenciosamente; planes legados completos se pueden exportar, los incompletos
   con la regla antigua requieren un plan nuevo.
6. Guardar, reabrir, reproducir y exportar se prueban en la interfaz Electron real. Las
   pruebas de motor o del proveedor no cuentan como aceptación de interfaz.

```powershell
npx tsc --noEmit
npm run test:build-recovery
$out = Join-Path $env:TEMP ("cipher-1b-vite-" + [guid]::NewGuid().ToString("N"))
npx vite build --outDir $out
npm run dev
```

Requiere Node compatible con las dependencias bloqueadas, FFmpeg y FFprobe en PATH.
El test usa un directorio temporal propio y no lee credenciales ni toca proyectos reales.

Ensayo desde la interfaz:

1. Proyecto nuevo; importar un vídeo corto autorizado y transcribir.
2. Usar Transcripción y Usar Audio Original; Original 30 %, Stock 70 %, IA 0 %.
3. Verificar Gráficos 0 y Transiciones 0. Pulsar Construir: revisar la propuesta 3/2
   y aceptar; comprobar los IDs, categorías y duraciones de los archivos creados.
4. Reproducir, cancelar con medios guardados, cerrar y reabrir; continuar y comprobar
   IDs/hashes sin duplicados, con Stock pendiente en su categoría.
5. Guardar, reabrir, continuar hasta completar y exportar. Reproducir el resultado y
   verificar duración/códec/encuadre/audio maestro. Hacer cada acción manual un paso a la vez.

Hasta pasar esta puerta, 1B permanece pendiente de aceptación de producto. No avanzar
a 1C/1D ni incorporar Vibes dando por demostrada la ejecución real de esta copia.

### Checkpoint real de cancelación en Windows — 2026-10-10

En el proyecto `zzz-1791610251337` (`<<<<<zzz`), la interfaz indicó **8/28 clips
guardados** después de pulsar Cancelar. El plan actual es
`f611f4e5-40d8-4eda-ac84-6f014b2d4d7b`: estado `paused`, 28 escenas, 8 `complete` y
20 `pending`, con mensaje de cancelación recuperable. Los archivos de salida están en
`cipher-studio/proyectos/zzz-1791610251337/materiales/builds/f611f4e5-40d8-4eda-ac84-6f014b2d4d7b/`.

Se tomó esta línea base antes de Continuar. FFprobe encontró H.264, 1080×1920 en los
8 archivos; todas las duraciones reales están entre 2 y 3 s inclusive. Cada SHA-256
calculado coincide con el hash de resultado guardado en la escena correspondiente del
plan. Los ocho IDs son distintos. La mezcla parcial observada es 5 Stock (15 s
planificados) y 3 Original (8.167 s planificados); no representa la mezcla final de
70/30 porque faltan 20 escenas.

| Archivo | Fuente | Fotogramas del plan | Duración FFprobe | Bytes | SHA-256 |
|---|---:|---:|---:|---:|---|
| `f611f4e5-40d8-4eda-ac84-6f014b2d4d7b-s00001.mp4` | Stock | 90 | 3.000000 s | 1,590,046 | `877634F1247DB139A79C3E0BEA6A508764698D66FDAF8072D80E0190E85A4FFD` |
| `f611f4e5-40d8-4eda-ac84-6f014b2d4d7b-s00002.mp4` | Original | 82 | 2.733008 s | 1,392,650 | `F10902C680B423950C6F1864CEC6290BD8C818DFD9F04890645302B224D029B2` |
| `f611f4e5-40d8-4eda-ac84-6f014b2d4d7b-s00003.mp4` | Stock | 90 | 3.000000 s | 796,527 | `D8177F1DC083B98FE9262FD36ACB2965DCB3492A63FBE01F290A2D598C4429CB` |
| `f611f4e5-40d8-4eda-ac84-6f014b2d4d7b-s00004.mp4` | Stock | 90 | 3.000000 s | 6,587,591 | `45E731C875B06D48C9C7ACFB44D6FF3DF34ECB2E85F247A0B99B52448D41439A` |
| `f611f4e5-40d8-4eda-ac84-6f014b2d4d7b-s00005.mp4` | Original | 82 | 2.733333 s | 1,402,075 | `CAA89E3C79672CC45567936699711F07A099D6520CF83D1F39603CAD79BE3582` |
| `f611f4e5-40d8-4eda-ac84-6f014b2d4d7b-s00006.mp4` | Stock | 90 | 3.000000 s | 1,052,895 | `87D709D09429B2417CBF922065FE342FE4ED40E21A62F51EDDE304E2C01D343E` |
| `f611f4e5-40d8-4eda-ac84-6f014b2d4d7b-s00007.mp4` | Stock | 90 | 3.000000 s | 1,592,905 | `1E59085D5FAED8A7B952D113616536B11D2ED9377F7EDDF2084984F83ADF2A83` |
| `f611f4e5-40d8-4eda-ac84-6f014b2d4d7b-s00008.mp4` | Original | 81 | 2.700000 s | 1,536,803 | `52D5EBA55C359DFCAFDE975B5438A0B9467D00D844F390F4A80034A4D936956A` |

El archivo de estado del proyecto sigue apuntando a `v-ai-1d952ff5-43c6-4813-a649-e1893e9f90d3`
(`Versión IA 2`); también conserva Timeline Original e IA1. El plan parcial no sustituyó
la versión activa. Al reanudar se comprobarán estas ocho rutas y hashes contra la línea
base, los 28 IDs y categorías, y que no aparezcan archivos de escena duplicados.

### Resultado posterior: IA3 corresponde a un plan nuevo, no a Continuar

Después de que la interfaz mostrara IA3 con 28/28, el estado guardado confirmó el plan
`0a3fc0f0-86aa-43db-98ab-eccff363c298`, completo, con 28 IDs de escena únicos (19 Stock y
9 Original), en una carpeta propia con 28 MP4. IA3 (`v-ai-0a3fc0f0-86aa-43db-98ab-eccff363c298`)
es la versión activa; IA1 e IA2 siguen en la lista.

El plan cancelado `f611f4e5-40d8-4eda-ac84-6f014b2d4d7b` permanece en `build/history` como
`paused`, con 8 escenas completas y 20 pendientes. Su carpeta aún contiene solo los ocho
MP4 de la línea base y los ocho SHA-256 siguen idénticos. Al comparar esos hashes con los
28 MP4 de IA3, seis contenidos tienen una coincidencia exacta (escenas 2 y 4–8); las
escenas 1 y 3 son diferentes. Las coincidencias están duplicadas físicamente bajo rutas
que incluyen el ID de IA3; igualdad de bytes por sí sola no demuestra reutilización.

La implementación confirma el resultado: `runner.ts` en modo `new` guarda el plan previo
en historial y crea un ID aleatorio nuevo; `createPlan` inicializa todas las escenas como
`pending`, y el render escribe en `materiales/builds/<nuevo-id>/`. Así, IA3 es una
construcción nueva, no la continuación de `f611...`; sus salidas se crearon en otra
carpeta, aunque seis sean byte por byte iguales. La evidencia persistida no permite
identificar qué control físico se pulsó. **La aceptación de Continuar sin regenerar
escenas sigue pendiente**; en una nueva prueba se debe usar el botón `Continuar pendientes`
del plan pausado, no iniciar un plan nuevo.

### Checkpoint de cancelación para reanudar — 2026-10-10

La nueva prueba quedó pausada en el plan activo `9da8aef7-51c8-484f-8f7e-67211cfef304`:
13 escenas `complete`, 15 `pending`, 28 IDs únicos; 9 Stock y 4 Original ya guardados.
Su carpeta es
`cipher-studio/proyectos/zzz-1791610251337/materiales/builds/9da8aef7-51c8-484f-8f7e-67211cfef304/`
y contiene 13 MP4. Los hashes de resultado del plan coinciden con los hashes calculados
en disco. FFprobe confirmó H.264 1080×1920 y duraciones dentro de 2–3 s inclusive.
Gráficos y Transiciones siguen en 0 %, mezcla 30/70/0, y la versión activa del timeline
sigue siendo IA3 mientras el plan está pausado.

Los primeros ocho hashes coinciden con los del anterior plan pausado `f611...`, pero
están bajo el ID y las rutas de este plan nuevo; se conservan ambas carpetas para comparar.
Esta tabla es la nueva línea base que se debe cotejar después de Continuar.

| Escena (prefijo `9da8aef7-51c8-484f-8f7e-67211cfef304-`) | Fuente | Duración real | Bytes | SHA-256 |
|---|---:|---:|---:|---|
| `s00001.mp4` | Stock | 3.000000 s | 1,590,046 | `877634F1247DB139A79C3E0BEA6A508764698D66FDAF8072D80E0190E85A4FFD` |
| `s00002.mp4` | Original | 2.733008 s | 1,392,650 | `F10902C680B423950C6F1864CEC6290BD8C818DFD9F04890645302B224D029B2` |
| `s00003.mp4` | Stock | 3.000000 s | 796,527 | `D8177F1DC083B98FE9262FD36ACB2965DCB3492A63FBE01F290A2D598C4429CB` |
| `s00004.mp4` | Stock | 3.000000 s | 6,587,591 | `45E731C875B06D48C9C7ACFB44D6FF3DF34ECB2E85F247A0B99B52448D41439A` |
| `s00005.mp4` | Original | 2.733333 s | 1,402,075 | `CAA89E3C79672CC45567936699711F07A099D6520CF83D1F39603CAD79BE3582` |
| `s00006.mp4` | Stock | 3.000000 s | 1,052,895 | `87D709D09429B2417CBF922065FE342FE4ED40E21A62F51EDDE304E2C01D343E` |
| `s00007.mp4` | Stock | 3.000000 s | 1,592,905 | `1E59085D5FAED8A7B952D113616536B11D2ED9377F7EDDF2084984F83ADF2A83` |
| `s00008.mp4` | Original | 2.700000 s | 1,536,803 | `52D5EBA55C359DFCAFDE975B5438A0B9467D00D844F390F4A80034A4D936956A` |
| `s00009.mp4` | Stock | 3.000000 s | 679,710 | `D7C16947FC33419C062DECFA352D25937F923F2EB64869FD9944177D532E4A01` |
| `s00010.mp4` | Stock | 3.000000 s | 1,217,936 | `2DD8248C4156E3BCFB8973E1D6CA4B08100F23A71519EA4789657B0596556E23` |
| `s00011.mp4` | Original | 2.700000 s | 1,534,507 | `217941C8564E661AE921FE416DE765B0977FC8215AD7A66C67853CB01B851C3B` |
| `s00012.mp4` | Stock | 3.000000 s | 1,144,702 | `136F03F5B69226D38EEC8A6803755D2623F73EA9E303C9BB5916AF6FDA66AA24` |
| `s00013.mp4` | Stock | 3.000000 s | 1,700,170 | `F8B2CED405F535525815E646C09B4C76BAC8A775DD1CC7D318F2C3321337C1C7` |

### Resultado de Continuar y verificación previa a exportar

Tras pulsar `Continuar pendientes`, el plan conserva el mismo ID
`9da8aef7-51c8-484f-8f7e-67211cfef304` y pasó a `complete`: 28/28 escenas, 28 IDs
únicos y exactamente 28 MP4 en su carpeta. Las 13 salidas del checkpoint existen y sus
hashes coinciden tanto con la tabla previa como con `result.sha256` del plan. Cada una
conserva un intento de medios; los intentos de medios terminaron entre 06:31:19.492Z y
06:31:51.709Z, antes de la pausa de 06:31:55.894Z. Las escenas Stock conservan además
un intento de dirección cada una; las Original no tuvieron intento de dirección. No hay
intentos posteriores a la pausa para las 13 escenas, así que Continuar no las regeneró.

FFprobe validó los 28 MP4 del plan: cada hash coincide con el plan, las duraciones están
en 2–3 s inclusive y todos son H.264 1080×1920; duración conjunta 81.232358 s. La
versión activa es IA4 (`v-ai-9da8aef7-51c8-484f-8f7e-67211cfef304`), con 29 IDs únicos
de timeline. Conserva un solo clip `Voz - Audio Original` de 81.248005 s; el maestro
AAC `materiales/audio/maestro.m4a` existe y también mide 81.248005 s. Gráficos y
Transiciones continúan en 0 % y la mezcla guardada es 30/70/0. La exportación de IA4
fue exportada por el usuario y reproducida completa con imagen y sonido; la ubicación e integridad del archivo siguen pendientes de verificación en disco.

## Publicación y retorno

`CLAUDE.md` exige aprobación del usuario antes de crear commits; la autorización para
commit y publicar la rama separada ya fue dada. No se ha creado todavía el commit de
estas correcciones. La rama sigue separada; no se mezclará con master ni se tocará el
worktree restaurado. La publicación se revisará después de completar la aceptación real.

### Exportación reportada por el usuario — 2026-10-10

El usuario informa que exportó `1111.mp4` al Escritorio y que lo reprodujo completo con imagen y sonido correctos. Esto acredita la observación manual comunicada por el usuario, pero la comprobación del archivo en disco sigue pendiente: Windows resuelve el Escritorio a `C:\Users\John Benites\OneDrive\Desktop`; esa carpeta existe y la búsqueda recursiva acotada del nombre exacto `1111.mp4` (hasta dos niveles) no encontró coincidencias. `C:\Users\John Benites\Desktop` no existe. No se pudo confirmar la ruta real, tamaño, hash, duración, códec ni pistas del MP4. Para completar la evidencia hace falta la ruta copiada desde el Explorador o que el archivo esté disponible en la ubicación de Escritorio resuelta por Windows.

La continuación del plan `9da8aef7-51c8-484f-8f7e-67211cfef304` ya quedó verificada en el estado del proyecto y en los archivos: mismo ID, 28/28 escenas, sin regeneración de las 13 salidas del checkpoint y sin duplicados. Sin embargo, la evidencia de esta sesión no acredita que Cipher se cerrara y reabriera mientras ese plan estaba pausado, antes de continuarlo; la comprobación anterior de cierre/reapertura correspondió a la restauración de un proyecto completo. Mantener pendiente esa parte de la puerta de aceptación de recuperación junto con la inspección del MP4 exportado.

**Estado:** 1B aún no se declara cerrada; no crear commit de cierre hasta resolver ambas comprobaciones pendientes.