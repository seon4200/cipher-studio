# Entrega 1B — Plan y recuperación de Original + Stock

Base: `ad1b0f422027b41bfe128607045c71535820fe1e`, rama remota
`repair/graficos-render-ok-playwright-20261009`.

Estado: implementación preparada para revisión. Nueve pruebas del motor aprobadas.
La compilación completa con las dependencias del proyecto y la aceptación en la
interfaz Windows siguen pendientes. Este documento no declara cerrada 1A ni 1B.
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
7. Guarda cada resultado antes de marcarlo completo. Un fallo Stock sigue en Stock.
8. Solo monta automáticamente cuando todos los medios están completos. Si hay
   pendientes, mantiene el montaje anterior y conserva los archivos terminados.
9. Continuar verifica los archivos guardados y procesa lo pendiente o dañado.

Los formatos de la interfaz `horizontal`, `vertical` y `square` están admitidos.
La mezcla nueva usa `[Original, Stock, IA]`, con IA en cero. El valor inicial es
Original 30 %, Stock 70 %. Los proyectos antiguos conservan sus ajustes al abrir;
si contienen cuotas IA/formato antiguo de cuatro pesos, deben elegir explícitamente
la mezcla Original + Stock antes de usar esta entrega.

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
NASA se consulta solo para keywords espaciales. No se han validado credenciales reales.

## Verificación realizada

Nueve pruebas aprobadas, sin credenciales ni proyectos del usuario:

1. Reparto exacto por fotogramas para 909 combinaciones de duración/cuota; cobertura
   de frases de 3–4 segundos y silencios sin superar tres segundos por clip.
2. Recortes FFmpeg reales, incluidos un fotograma, límite final de fuente, rutas con
   espacios/acentos/#, tres formatos y conservación del hash del audio.
3. Stock fallido conserva categoría; un motor nuevo continúa sin regenerar vecinos
   completos ni borrar un archivo preexistente en `materiales/originales`.
4. Cancelación con resultados guardados y rechazo de ejecuciones simultáneas.
5. Rechazo de entradas/plan obsoletos, conservación del JSON y exportación de un plan archivado.
6. Proveedor simulado: primera descarga corrupta, segunda válida; descarte registrado.
7. Reparación exclusiva de un clip completo que posteriormente se corrompió.
8. Escrituras JSON serializadas, recuperación desde backup y conservación del estado original.
9. Terminación real de un proceso hijo con SIGKILL después de un checkpoint, reapertura
   y continuación. Es una prueba del motor, no del cierre de la interfaz Electron.

Se usó FFmpeg/FFprobe local y TypeScript 5.4.5, obtenido del repositorio oficial para
la verificación. Los módulos nuevos y el componente de estado pasan comprobación
estricta con noUnusedLocals/noUnusedParameters. `git diff --check` pasa.

La comprobación completa de TypeScript está bloqueada aquí por dependencias no
instaladas: Electron, @fal-ai/client y lucide-react. Se reprodujeron también esos
errores en la base original bajo el mismo entorno. No se presenta esto como un
build completo aprobado ni se modificó el lockfile para sortearlo.

## Puerta de aceptación en Windows

Ejecutar en una copia/worktree nuevo de la entrega, conservando el worktree restaurado
y su `dist/index.html` local. Instalar con el lockfile existente y comprobar:

```powershell
npm ci
npx tsc --noEmit
npm run test:build-recovery
npm run build
npm run dev
```

Requiere Node compatible con las dependencias bloqueadas, FFmpeg y FFprobe en PATH.
El test usa un directorio temporal propio y no lee credenciales ni toca proyectos reales.

Ensayo desde la interfaz:

1. Proyecto nuevo; importar un vídeo corto autorizado y transcribir.
2. Usar Transcripción y Usar Audio Original; Original 30 %, Stock 70 %, IA 0 %.
3. Gráficos 0 y Transiciones 0. Verificar que Construir exige todos los requisitos.
4. Construir, comprobar errores reales de proveedores y reproducir los clips completos.
5. Cancelar con varios resultados guardados; cerrar y reabrir; Continuar pendientes.
6. Comprobar que los IDs/hashes terminados se conservan y que Stock pendiente no
   se ha convertido en Original. Repetir con una interrupción abrupta de la app.
7. Cambiar de proyecto durante una ejecución y comprobar que no recibe el montaje ajeno.
8. Terminar, guardar, reabrir y exportar una prueba; medir archivos, timeline y audio.

Hasta pasar esta puerta, 1B permanece pendiente de aceptación de producto. No avanzar
a 1C/1D ni incorporar Vibes dando por demostrada la ejecución real de esta copia.

## Publicación y retorno

`CLAUDE.md` exige aprobación del usuario antes de crear commits. El usuario ya
autorizó el commit y la publicación. Rama de entrega:
`work/reinicio-1b-plan-recuperacion-20261010`, partiendo del SHA base indicado arriba.
El intento de publicar desde esta sesión fue rechazado por GitHub con HTTP 403,
`Resource not accessible by integration`. No se creó el commit ni la rama remota.
Se entrega un parche completo para aplicarlo y publicarlo desde el equipo autorizado.
No mezclar con master ni sobrescribir el worktree restaurado. El retorno consiste
en usar el worktree/base anterior; los proyectos de aceptación deben ser nuevos.
