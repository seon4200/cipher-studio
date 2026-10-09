# Fase 2 — planificador Codex para Construir

## Base y alcance

La fase parte del commit `121c39da` de fase 1, que quedó en la rama publicada
`work/construir-integridad-20261008`. Esta continuación está aislada en
`work/fase2-openai-planificador-20261008`.

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
- El campo `buildDurationSeconds` queda incluido en el contrato de persistencia y en la
  muestra de round-trip de Windows.

El paso heredado de **Gráficos** permanece separado del plan de las cuatro cuotas y no se
migró en esta fase. Cuando `graphicsPercent` es positivo, el paso posterior de Construir aún
invoca ese generador por su ruta anterior, que puede requerir DeepSeek. Esto no es un fallback
del planificador: si Codex falla, esa fase no empieza. Las acciones independientes de
reescritura, Vibes y optimización de prompts también permanecen intactas. Por tanto, esta fase
quita DeepSeek del plan obligatorio de medios, pero no retira todas sus llamadas del producto.

## Verificación ejecutada

- `npm ci --no-audit --no-fund`: 411 paquetes instalados en este worktree.
- `npm run build`: TypeScript, bundles de Studio/Control, main y preload compilados.
- `npm run test:build-integrity`: aprobado. Incluye 7.084 repartos, conservación de cuotas,
  plan con y sin narración, ventanas Visuales sintéticas, gates de fuente, cancelación del
  planificador, fallo cerrado sin solicitud a DeepSeek, worker de medios con MP4 sintético,
  recibos/reintentos, gate de exportación y adaptación Control.
- `npm test`: **16/16 suites configuradas verdes**, incluidas las seis suites Electron que
  antes estaban pendientes: `assets-persistencia`, `avisos`, `graficos`, `materiales`,
  `persistencia` y `via4`. Se actualizó `tests/persistencia.js` para que su muestra cubra la
  nueva duración. El conjunto sigue excluyendo `test:ventana` por su fallo conocido y deja
  inactivas las suites heredadas que ya estaban desconectadas.
- El chequeo local de conexión encontró Codex CLI `0.160.1`, pero no autenticado
  (`available: true`, `authenticated: false`, `status: not-authenticated`). No se envió una
  solicitud al modelo, ni se usaron DeepSeek, MiniMax, Vibes o proveedores de vídeo reales.

Las pruebas de flujo ejecutan funciones reales y callbacks IPC extraídos del código con
proveedores simulados; no reproducen la interfaz visual ni acreditan la calidad de una
respuesta del modelo.

## Pendiente

- Autenticar la conexión Codex existente y ejecutar un Build real con un proyecto temporal,
  incluido el guion sin narración y la cuota Visuales. La respuesta del proveedor, su calidad
  editorial y su latencia aún no están verificadas.
- Hacer la aceptación visible en Studio: construir, guardar/reabrir, abrir Animation, cancelar
  y continuar, y exportar una copia con medios listos. La aceptación visual pendiente de fase 1
  también sigue pendiente.
- Validar disponibilidad, coste, calidad y tiempos reales de los proveedores Original/Stock/IA.
- El generador heredado de Gráficos y las acciones independientes de DeepSeek conservan su
  estado anterior; esta fase no migra esos motores ni proveedores.

No se publicó ni se creó un commit para esta rama de fase 2.
