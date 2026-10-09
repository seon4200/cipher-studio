# Fase 1 — integridad y recuperación de Construir

## Base y alcance

Rama local: `work/construir-integridad-20261008` (publicación remota bloqueada).
Base comprobada en GitHub: `work/animation-auto-visuals-20261007`, commit
`98521ebbd140fbbd5a87efac9b29e2eca8b155d3`.
Se creó un worktree propio desde `cipher-animation-unified-v1` (`0b706109`) y se integró
esa continuación mediante fast-forward antes de editar.
Checkpoints locales: `checkpoint/construir-integridad-before-20261008`, sobre `98521eb`,
y `checkpoint/construir-integridad-code-20261008`, sobre el commit de código `aa23b78`.
La revisión del 9 de octubre añade `checkpoint/construir-integridad-recovery-20261009`.
La rama contiene además correcciones de documentación. No hay checkpoints nuevos publicados en GitHub.
Git directo no dispone de credenciales y el conector rechaza escritura de blobs con
`403 Resource not accessible by integration`. El árbol intentado no se encontró en GitHub.
Se entrega `cipher-fase1.bundle` con la rama y el checkpoint de código, además del parche de la fase.
No se actualiza `master`, no se despliega ni se cambia la instalación del usuario.

Esta fase corrige el contrato de construcción. No migra proveedores ni introduce Estilos.
DeepSeek y MiniMax conservan su ruta actual; Vibes y Animation se conservan.

## Comportamiento implementado

1. **Porcentajes.** Cuatro pesos explícitos; reparto por restos mayores entre fuentes
   habilitadas. Desempate fijo: Original, Stock, IA, Visuales. Los enteros suman el total
   y un cero nunca recibe un espacio. `[0,0,50,50]` con tres espacios produce
   `{original:0,stock:0,ia:2,visual:1}`. La colocación usa el mayor déficit acumulado
   para distribuir las cuotas. No se recalculan timelines al abrirlos; sigue siendo
   reparto por número de clips, no por duración. Una petición sin pesos positivos falla.
2. **Audio.** `audioProvenance` y `narrationSegments` pertenecen al clip de narración.
   Las voces nuevas conservan también sus segmentos en la versión generada. El IPC recibe
   separadamente la transcripción fuente, las ventanas de narración y su procedencia.
   Listas coincidentes y nombres visibles no deciden identidad. Solo audio identificado
   explícitamente como original realinea los recortes a ese reloj. Para datos antiguos,
   un registro de generación con la misma ruta identifica una voz generada; sin evidencia
   se presenta un selector de procedencia. Los segmentos antiguos no vinculados requieren
   confirmación expresa del usuario. No se transforma el contenido ni los tiempos al abrir.
3. **Plan antes de medios.** `generate-timeline-assets` devuelve espacios planificados.
   Studio guarda el montaje preliminar antes de enviar peticiones de medios. Cada espacio
   tiene UUID, origen solicitado, texto, inicio, duración y parámetros de producción.
4. **Un trabajador y una cola recuperable.** Se extrajo el trabajador existente de
   Original/Stock/MiniMax para usarlo tanto en primera ejecución como al reintentar.
   La cola admite hasta tres solicitudes simultáneas, serializa los guardados y aplica
   resultados únicamente al mismo ID, intervalo y plan. Stock/IA fallidos no pasan a
   Original. Los huecos no copian vecinos ni desplazan clips posteriores.
5. **Persistencia y caché del mismo trabajo.** Los archivos nuevos usan el UUID del espacio,
   evitando sobrescribir `clip_001.mp4` de otro montaje. Después de materializar se escribe
   un recibo en `materiales/build-results/<id>.json`. Si el MP4 es válido y el plan coincide,
   un reintento recupera ese resultado sin volver a pedirlo al proveedor. Dos solicitudes
   simultáneas del mismo espacio comparten el trabajo en curso. Esto es recuperación del
   mismo trabajo; no es reutilización de escenas entre vídeos.
6. **Continuar y cancelar.** Construir continúa medios comunes pendientes y después Animation.
   No vuelve a planificar ni a cortar los medios terminados. Cancelar detiene nuevos despachos;
   las peticiones comunes ya enviadas terminan y guardan sus resultados. Animation mantiene
   su cancelación y recuperación de borrador. El proyecto y la versión activa protegen
   las aplicaciones tardías; la escritura IPC comprueba la ruta del proyecto.
7. **Estados y exportación.** Planificado → medios en preparación → montaje preliminar →
   Animation → pendientes/listo. El resumen compara realizados y solicitados por origen.
   El hito «Timeline listo» se emite después del guardado y la comprobación de medios.
   Construir inspecciona archivos perdidos en un montaje existente y recupera los que tienen
   plan. Exportar rechaza medios pendientes o archivos ausentes. El MP4 final sigue siendo
   una acción aparte. Los mensajes de DeepSeek ya no prometen reemplazar Visuales por Original.
8. **Métricas.** `directionMs` se captura al terminar el proveedor; ya no incluye compilación
   ni render. `compileMs` y `renderMs` conservan sus intervalos. `totalMs` incluye preparación
   adicional y escrituras; no debe interpretarse como la suma exacta de las tres métricas.
   No se ha medido una promesa de cuatro minutos ni se ha optimizado el motor.
9. **Cipher Control.** Su consumidor del IPC también envía procedencia, guarda el plan y usa
   la misma cola común. Reintenta el plan de la misma operación sin rehacer medios. Si quedan
   Visuales o medios fallidos devuelve `BUILD_MEDIA_PENDING_CONTINUE_IN_STUDIO`, conserva el
   montaje y no lo exporta como completo. Esta fase no añade una cola Animation al adaptador
   de Control ni modifica el repositorio/instalación de Control.

## Archivos principales

- `src/shared/reparto.ts`: cuotas enteras y ceros.
- `src/shared/build-integrity.ts`: procedencia, asignación, identidad, estados y cola común.
- `src/main/index.ts`: planificador, trabajador compartido, recibos/reintento, inspección y exportación.
- `src/renderer/src/main.tsx`: flujo Construir, selector de procedencia, guardado y resúmenes.
- `src/renderer/src/control-adapter.tsx`: adaptación del segundo consumidor.
- `src/preload/index.ts`, `src/preload/types.d.ts`: contratos IPC.
- `src/shared/avisos.ts`: resumen por etapa compatible con avisos anteriores.
- `src/main/services/animation-integration.ts`: medición de dirección.
- `tests/build-integrity.js`, pruebas de reparto/cola, `tests/todas.js`, `package.json`.

## Verificación ejecutada

Se usaron fixtures temporales, proveedores simulados y un vídeo sintético de color.
No se enviaron generaciones a DeepSeek, MiniMax, Vibes ni Codex. No se usaron proyectos,
credenciales, referencias o medios privados.

- `npm ci`: correcto.
- `npm run build`: TypeScript y los bundles de renderer/main/preload correctos.
- `npm run test:build-integrity`: correcto. Ejecuta funciones reales y callbacks IPC
  extraídos por AST, con dependencias controladas; no copia el algoritmo.
  - 7.084 planes: cuatro extremos al 100 % con 1, 3, 6 y 20 clips, mezclas, ceros,
    sumas exactas y determinismo.
  - Guardado/reapertura real mediante el servicio de persistencia.
  - Fallo al lado de Visual pendiente, conservación de texto/ID/origen/tiempo,
    reintento exclusivo, concurrencia máxima tres, cancelación, cambio de proyecto,
    edición del espacio y fallo de guardado antes del despacho.
  - Planificador real con listas idénticas: voz generada conserva timestamp propuesto
    por el modelo; audio original usa su reloj; procedencia desconocida se rechaza.
  - Trabajador real con fallos simulados de Stock/IA: ninguna ejecución de Original.
  - Recorte Original con FFmpeg/ffprobe reales sobre un MP4 sintético.
  - IPC real: deduplicación de reintentos concurrentes, recuperación del recibo, rechazo
    de otro proyecto o intervalo, archivo ausente y exportación pendiente.
  - Adaptador Control real con IPC simulado: versión preliminar persistida, conservación de
    versiones previas, cero cortes con Original desactivado, reintento exclusivo y recuperación
    de la operación terminada sin nuevas solicitudes.
  - Servicio Animation real con reloj/proveedor/render simulados: dirección 100 ms,
    compilación 7 ms y render 40 ms, sin contar render dentro de dirección.
- Contratos de cola Animation, navegación, chat y bundle: correctos.
- `CIPHER_TEST_HEADLESS=1 npm test`: **10/16 suites aprobadas; conjunto completo no aprobado**.
  Pasan Animation queue/chat/bundle/panel, integridad, reparto, ciclo, exclusión, mapa y Vibes.
  `assets-persistencia`, `avisos`, `graficos`, `materiales`, `persistencia` y `via4`
  terminan con `SIGSEGV` en Electron sin ventana en este entorno. No se consideran
  verificadas ni se desactivan. Hay también errores del entorno gráfico/DBus.
  Una prueba aislada con una ventana Electron mínima no terminó dentro de 20 s;
  no basta para atribuir inequívocamente todos los fallos al entorno.
- El ejecutor del conjunto ahora reconoce la suite de navegación que ya estaba declarada
  y registra 16 suites, incluida la nueva. `CIPHER_TEST_HEADLESS=1` es optativo y solo
  cambia los procesos de prueba; no el inicio de la aplicación.
- `test:ventana` continúa con su exclusión previa documentada; las suites de motores
  heredados mantienen su estado anterior.

**Pendiente de aceptación:** recorrido visible en Electron/Windows con una copia de proyecto,
proveedores reales y reproducción/exportación final. El equipo del usuario estaba desconectado.
Los contratos y el recorte sintético no acreditan calidad visual, velocidad real ni esa aceptación.

## Continuación del 9 de octubre: cierre de tareas y cambio de montaje

Se mantuvo el alcance de fase 1 y se corrigieron dos límites de la recuperación:

- Si un guardado falla cuando ya hay tres proveedores trabajando, la cola espera a que
  terminen todos antes de devolver el error y liberar el bloqueo de Construir. Detiene
  nuevos despachos y conserva el primer error. Los recibos ya guardados siguen disponibles
  para recuperar resultados en el siguiente intento. La prueba nueva reprodujo la salida
  prematura antes del cambio y pasa después de corregirla.
- Después de esperar a la cola común se comprueban de nuevo proyecto y versión antes de
  continuar Animation o preparar gráficos/transiciones. También se comprueban después
  de generar/renderizar gráficos y de inspeccionar medios antes de mostrar el resumen.
  Las pruebas ejecutan las funciones reales de Studio con IPC controlado: cambiar de
  proyecto o versión impide iniciar Animation y publicar un resumen de otro montaje.

Verificación de esta revisión: `npm run build`, `test:build-integrity`,
`test:animation-build-queue`, `test:animation-panel-flow` y `test:animation-chat-bundle`
aprobados. No se repitió el conjunto completo sin resolver primero su bloqueo gráfico.
Se intentó preparar Xvfb, pero la actualización de paquetes fue rechazada por permisos
del contenedor (`setgroups`/`seteuid`). Las seis suites Electron anteriores permanecen
sin verificar; no se modificó el arranque de producción ni se omitieron sus pruebas.
La publicación remota y la aceptación visible siguen pendientes. El bundle y el parche
de entrega incluyen esta continuación.

## Prueba manual sobre una copia

1. Crear una copia autocontenida de un proyecto y abrirla desde esta rama, sin sustituir la instalación activa.
2. Probar las cuatro cuotas puras y una mezcla `[0,0,50,50]`; comprobar que no hay solicitudes
   de medios a categorías desactivadas. En esta fase aún hacen falta los prerrequisitos antiguos
   indicados abajo; no confundir esta prueba con soporte completo sin original.
3. Usar voz original y generada con ventanas que empiecen en cero. Guardar/reabrir y comprobar
   la procedencia. En un proyecto antiguo sin metadatos, resolverla explícitamente en el selector.
4. Interrumpir disponibilidad de Stock/IA en el entorno de prueba: el espacio mantiene origen,
   texto y tiempos. Restaurar el proveedor y pulsar Construir. Los clips terminados no se repiten.
5. Cancelar con espacios pendientes y continuar; cambiar de proyecto/versión durante una tarea
   y verificar que no recibe resultados tardíos. Simular un fallo de guardado sin usar el proyecto original.
6. Completar Animation, guardar y reabrir; verificar MP4 reproducibles en sus intervalos.
   Retirar únicamente un MP4 de la copia de prueba y verificar recuperación del mismo espacio.
7. Exportar con un pendiente debe bloquearse. Con medios válidos, probar la exportación separada
   y comprobar audio, duración, gráficos y transiciones.

## Compatibilidad, límites y siguientes fases

- El redondeo cambia para **planes nuevos**. Timelines existentes conservan sus decisiones y tiempos.
- Los fallos antiguos sin `buildPlan` no obtienen un plan inventado: requieren recuperar su archivo
  o reparar el espacio. No se reconstruye automáticamente un montaje histórico.
- Una palabra clave, prompt o timestamp ausente deja un error en su origen; reintentar un proveedor
  no inventa información editorial que no estaba en el plan. La futura dirección deberá resolver
  esos errores de planificación; no se encubren con búsquedas genéricas o metraje original.
- Persisten como prerrequisitos de un montaje nuevo el archivo original, DeepSeek y narración con
  segmentos; Visuales requiere tiempos por palabra y ventanas compatibles con Animation.
  **No se declara aún soporte completo de 100 % Stock/IA/Visuales sin original ni del modo sin voz.**
- Continúan pendientes la inspección semántica de Stock y la paralelización de sus proveedores.
  Los reintentos no prometen evitar cargos si el proveedor terminó remotamente pero falló la
  descarga antes de poder guardar un recibo local.
- La procedencia de audio antigua sin registro fiable necesita confirmación humana. La confirmación
  vincula los segmentos disponibles; no verifica por sí sola que correspondan a ese archivo.
- No se han optimizado PNG por fotograma ni el arranque de app-server por escena.

Acuerdos futuros conservados: OpenAI/Codex como planificador activo; DeepSeek retenido e inactivo;
Vibes activo con selector de proveedor y MiniMax inactivo; cuatro porcentajes funcionales y modo
sin voz/original cuando corresponda; Canvas nuevo para cada vídeo; botón **Estilos**, referencias
subidas y editadas por chat, carpetas/versiones/selección/renombrado/borrado con una copia de la
versión usada por proyecto; reutilización entre vídeos pospuesta; eliminación de motores exclusivos
antiguos solo tras validar el reemplazo y preservar infraestructura compartida y medios del usuario.
Nada de esa migración se presenta como implementado en esta fase.

## Retorno

Conservar la copia de aceptación separada. Para revisar la versión anterior sin borrar cambios:

```powershell
git fetch origin
git worktree add ..\cipher-retorno-fase1 98521ebbd140fbbd5a87efac9b29e2eca8b155d3
```

No usar `reset --hard` sobre carpetas compartidas ni restaurar proyectos de usuario desde Git.
Los archivos nuevos de recuperación quedan dentro de la copia de proyecto, fuera del repositorio.

## Recuperar la entrega sin publicación remota

El bundle es incremental: necesita el commit base público `98521eb`. Desde un clon del
repositorio, sin cambiar de rama ni tocar el directorio activo:

```powershell
git fetch origin work/animation-auto-visuals-20261007
git bundle verify C:\ruta\cipher-fase1.bundle
git fetch C:\ruta\cipher-fase1.bundle refs/heads/work/construir-integridad-20261008:refs/heads/work/construir-integridad-20261008
git worktree add ..\cipher-fase1-aceptacion work/construir-integridad-20261008
```

Si ya existe una rama con ese nombre, elige otro nombre local como destino del fetch;
no uses force. El parche es una alternativa para revisión/aplicación sobre la base, no
se debe aplicar encima de la rama importada. La entrega sigue pendiente de publicación
con una conexión que tenga permisos de escritura y de la aceptación descrita arriba.
