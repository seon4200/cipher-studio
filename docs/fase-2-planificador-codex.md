# Fase 2 — planificador Codex para Construir

## Base y alcance

La fase parte del commit `121c39da` de fase 1, que quedó en la rama publicada
`work/construir-integridad-20261008`. El primer avance de fase 2 quedó guardado en
`b88e1bc`; la continuación permanece aislada en `work/fase2-openai-planificador-20261008`.

Esta fase activa Codex como planificador de Construir y admite proyectos sin narración
cuando se indica una duración. Conserva Original, Stock, IA y Visuales, el plan de fase 1,
la recuperación por ID, la cancelación, el guardado preliminar y el bloqueo de exportación
incompleta. No cambia proveedores de vídeo, estilos, Vibes ni motores heredados.

## Implementado

- `src/main/services/build-planner.ts` usa el `CodexAppServerProvider` que ya emplea
  Animation y la misma autenticación local de Codex. Divide las frases en lotes de seis,
  solicita JSON con esquema estricto y valida cantidad, texto, keyword y timestamp antes
  de crear el plan.
- El perfil `build-planner` abre una sesión app-server con el servicio `cipher-build-planner`
  y deshabilita en ese proceso los servidores MCP enumerados en la configuración local
  (incluidos Animation, `node_repl` y `cua_repl`). La sesión usa sandbox de solo lectura,
  sin acceso de red, y un directorio temporal como cwd. No escribe la configuración del
  usuario. Si Codex falla, Construir devuelve el error y no recurre a DeepSeek ni inventa
  slots Original.
- La asignación conserva las cuatro cuotas enteras y sus extremos. Solo exige archivo fuente
  si Original tiene cuota o si se eligió el audio original. Una voz generada no exige el
  vídeo original cuando Original está en 0.
- Sin narración, Studio muestra y guarda `buildDurationSeconds`. Main distribuye palabras del
  guion sobre ese reloj; con Visuales crea ventanas de Animation de tres segundos y pliega la
  cola corta en la última. El estado se restaura al reabrir el proyecto.
- Cipher Control acepta `voice.mode: "none"` con duración y sin `sourceRelativePath` cuando
  Original y audio original no se solicitan. Conserva el guardado de versión preliminar y el
  contrato pendiente de Visuales: si quedan slots Visuales, Control devuelve
  `BUILD_MEDIA_PENDING_CONTINUE_IN_STUDIO` en vez de exportar.
- Cancelar durante la planificación aborta la petición Codex activa. Después del plan,
  permanece el contrato de fase 1: detener nuevos despachos, guardar resultados que ya
  terminaron y permitir continuar solo los pendientes.
- Los **Gráficos dentro de Construir** usan `plan-build-graphics`, un planificador Codex con
  esquema y validación estrictos, compartiendo la misma instancia app-server y autenticación.
  Solo recibe clips Original/Stock elegibles; la colocación sigue usando el timeline completo
  para descartar gráficos que se solapen con Visuales. Conserva `graphicData`,
  `graphicAbsoluteStart`, duración y render sellado. Un lote inválido, fallido o cancelado
  falla completo y se muestra como error.
- Cipher Control usa la misma ruta Codex para Gráficos y las mismas ventanas sintéticas/
  Animation; conserva el guardado preliminar y devuelve pendientes Visuales a Studio. La acción
  independiente de regenerar Gráficos mantiene su ruta anterior.
- Los registros de Construir separan proveedor, llamadas y tiempo de planificación y de
  Gráficos, incluso cuando Codex falla o se cancela. Animation informa dirección,
  compilación y render por separado; exportación mantiene sus etapas en el log de exportación.
  La comprobación visual requiere la aceptación real y no se estima desde mocks.
- El campo `buildDurationSeconds` queda incluido en el contrato de persistencia y en la
  muestra de round-trip de Windows.

La ruta de Gráficos dentro de Construir no invoca DeepSeek ni recurre a esa integración si
Codex falla. La integración antigua permanece para la acción independiente de regenerar
Gráficos. Reescritura, Vibes, optimización de prompts y `generate-perfect-sync` conservan sus
rutas previas y no se activan como fallback de Construir.

## Verificación ejecutada

- `npm ci --no-audit --no-fund`: 411 paquetes instalados en este worktree.
- `npm run build`: TypeScript, bundles de Studio/Control, main y preload compilados.
- `npm run test:build-integrity`: aprobado. Incluye 7.084 repartos, conservación de cuotas,
  plan con y sin narración, ventanas Visuales sintéticas, gates de fuente, cancelación del
  planificador, fallo cerrado sin solicitud a DeepSeek, worker de medios con MP4 sintético,
  recibos/reintentos, gate de exportación, IPC de Gráficos y adaptación Control con gráficos.
- `npm run test:build-graphics`: aprobado. Verifica distribución entre escenas Original/Stock,
  salida `graphicData`, colocación temporal, exclusión de Visuales, ausencia de llamadas en un
  montaje 100 % Visual, respuesta incompleta, fallo en lotes posteriores y cancelación sin
  resultado parcial.
- Las pruebas simuladas de las rutas Studio/Control cubren también fallo y cancelación de
  Gráficos: no aceptan clips parciales, no invocan el generador heredado ni hacen peticiones a
  DeepSeek. No prueban una llamada real al proveedor.
- La prueba enfocada comprueba ventanas de Animation sin huecos ni solapamientos para un guion
  de 20 s y que Cipher Control persiste sin voz, usa Codex para Gráficos y deja Visuales
  pendientes para Studio.
- `tests/todas.js` reconoce el alias `test:build-graphics` → `tests/build-graphics-planner.js`
  y espera 17 suites activas. En esta versión, `npm test` terminó **17/17 verdes**, incluidas
  las suites Electron `assets-persistencia`, `avisos`, `graficos`, `materiales`, `persistencia`
  y `via4`. No se excluyó ninguna de las 17 suites ni se debilitó una comprobación. Se mantiene
  la exclusión previa y documentada de `test:ventana`; las suites heredadas desconectadas siguen
  marcadas como inactivas.
- La comprobación de `codexConnectionStatus()` —el mismo chequeo del proveedor que usa Studio—
  encontró Codex CLI `0.160.1`, disponible pero no autenticado (`authenticated: false`). Se
  inició el flujo oficial `codex login`, que espera el callback del navegador. No se envió una
  solicitud real al modelo ni se usaron DeepSeek, MiniMax, Vibes o proveedores de vídeo.
- Las llamadas reales a Codex para el plan de 20 s y Gráficos están en cero; planificación real,
  Animation/render, exportación y revisión visual no se ejecutaron, por lo que sus latencias son
  N/A. Los mocks y las ventanas sintéticas no se presentan como respuesta real del modelo.

Las pruebas de flujo ejecutan funciones reales y callbacks IPC extraídos del código con
proveedores simulados; no reproducen la interfaz visual ni acreditan la calidad de una
respuesta del modelo.

## Pendiente

- Completar el inicio de sesión ChatGPT en el navegador del flujo oficial ya iniciado. Luego
  ejecutar en un proyecto temporal el plan real de 20 s, sin narración ni Original, 100 % Visuales;
  revisar coherencia, cuotas, intervalos, IDs y reapertura del plan persistido. Detener el ensayo
  antes de generar Animation.
- Probar Gráficos por separado con escenas Original/Stock elegibles: respuesta real, tiempos,
  colocación y exclusión frente a Visuales. Ambos ensayos están bloqueados por la autenticación.
- La aceptación visual de la interfaz pendiente desde fase 1 sigue documentada. Crear/renderizar
  Visuales exclusivamente con Animation/Canvas, seguir estilo, producir en paralelo u optimizar
  velocidad pertenecen a fase 4; exportar no es requisito para cerrar esta fase.
- Recoger llamadas y duración reales de los dos planificadores cuando se ejecuten. Animation,
  exportación y revisión visual quedan fuera del ensayo de fase 2 y no tienen mediciones nuevas.
- Validar disponibilidad, coste, calidad y tiempos reales de los proveedores Original/Stock/IA.
- El generador heredado de la acción independiente de Gráficos y las acciones independientes de
  DeepSeek conservan su estado anterior; esta fase no migra esos motores ni proveedores.

El avance inicial de fase 2 quedó guardado en `b88e1bc`; el cierre de registro de pruebas se incluye
en el commit de continuación de esta rama. La aceptación visual de fase 1 y la aceptación real de
planificación/Gráficos de fase 2 siguen pendientes de completar el login del proveedor.
