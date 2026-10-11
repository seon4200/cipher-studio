# 1C-A — Contrato común del director

Fecha: 2026-10-10. Base: `90158f418ef489e9059e32282d76d4ab4253a0a8`.
Rama de trabajo local: `work/reinicio-1c-a-director-contract`.

## Resultado y alcance

Implementada y verificada la separación del director editorial en una copia Linux
aislada del repositorio. DeepSeek sigue siendo el proveedor predeterminado. No se
hicieron llamadas externas de generación, no se usaron claves reales y no se modificaron
proyectos de Windows. Esta entrega no conecta todavía ChatGPT ni cierra 1C.

El respaldo de 1B está publicado en `90158f4`. Su informe mantiene pendientes la
inspección del MP4 exportado y la comprobación en Windows de cerrar/reabrir mientras
un plan está pausado. Las pruebas automatizadas de esta entrega no sustituyen esa
aceptación manual. No se modifica el informe histórico de 1B.

## Qué cambia

| Archivo | Responsabilidad |
|---|---|
| `src/shared/director.ts` | Contrato independiente del proveedor: entrada editorial, propuesta y adaptador. |
| `src/main/build/director.ts` | Copia inmutable de la entrada, selección actual de DeepSeek, cancelación y validación antes de devolver decisiones al runner. |
| `src/main/director/deepseek.ts` | Petición DeepSeek existente y traducción de `timestamp` a `sourceStart`. |
| `src/main/director/validate.ts` | Validación común de toda la respuesta y selección explícita de campos permitidos. |
| `src/main/build/request.ts` | Transporte HTTP extraído con los mismos límites de espera y reintentos de 1B; compartido con Stock. |
| `src/main/build/providers.ts` | Conserva búsqueda, descarga y preparación Stock/Original; deja de alojar el director. |
| `src/main/build/runner.ts` | Importa el director desde su módulo propio. |
| `tests/director-contract.cjs` | Ocho pruebas del contrato, adaptación, errores y cancelación. |
| `tests/build-recovery.cjs` | Las pruebas existentes inyectan su director simulado a través del contrato común. |
| `package.json` | Añade `npm run test:director-contract`. |

## Contrato inicial

Entrada `DirectorInput`, versión 1:

- Guion y fotogramas por segundo.
- Escenas ya asignadas por Cipher: ID, índice de frase, texto, categoría, inicio y
  duración en fotogramas.
- Copia de datos editoriales, sin rutas del proyecto, archivos de audio/vídeo,
  resultados guardados, intentos ni credenciales. El guion sí se enviará al proveedor
  cuando la aplicación ejecute una construcción que requiera dirección.

Salida normalizada `DirectorProposal`:

- Una decisión por cada ID solicitado: `id`, `keyword` y `sourceStart`.
- El contrato de adaptadores devuelve `unknown` deliberadamente: una respuesta de
  proveedor solo se convierte en decisiones utilizables tras validación en Cipher.
- La búsqueda debe ser texto no vacío, de hasta 180 caracteres; se eliminan espacios
  de los extremos. El inicio sugerido debe ser numérico, finito y no negativo.
- Se rechazan respuestas incompletas, duplicadas, IDs ajenos y entradas mal formadas.
  Se restaura el orden de escenas de Cipher, aunque el proveedor responda desordenado.
- Campos adicionales no se aplican al plan. El director no puede sobrescribir
  duración, categoría, rutas de medios ni estado de ejecución.

La respuesta completa se valida antes de devolver ninguna decisión. Cancelar antes
de solicitarla impide la llamada; cancelar durante la espera descarta una respuesta
tardía incluso si el adaptador no atiende la señal. Los controles existentes del runner
sobre ejecución activa y huella del proyecto permanecen vigentes.

El inicio es una sugerencia textual, no una afirmación de haber visto el vídeo. El
runner conserva la comprobación contra la duración real de la fuente y el tratamiento
especial del audio original. La validación editorial de pertinencia no queda resuelta
por comprobar este contrato.

## Compatibilidad preservada

- Endpoint, modelo, temperatura, prompt y forma de la petición de DeepSeek de 1B.
- Reparto por tiempo, clips de 2–3 s y recorte proporcional al formato elegido.
- Audio principal, transcripción, reescritura del guion y componentes de interfaz.
- Formatos de `BuildInput`, `BuildPlan` y archivos persistidos: no hay migración.
- Reutilización de resultados completos, cancelación y recuperación existentes.
- Sin sustitución automática de director ni de Stock por Original ante errores.

Pequeña corrección en errores: un elemento nulo en la respuesta del director ahora
produce `PLAN_RESPONSE`, en lugar de un acceso inválido a propiedades. Un JSON HTTP
ilegible también se clasifica como respuesta de planificación inválida. No se registra
el contenido de la respuesta ni la clave en esos mensajes.

## Verificación realizada

Entorno: Linux, medios sintéticos temporales, sin Electron interactivo.

| Comprobación | Resultado |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | Correcta; sin actualizar dependencias ni lockfile. |
| `npx tsc --noEmit` antes y después de los cambios de código | Correcta. |
| Recuperación en la base 1B | 11/11. |
| `npm run test:director-contract` | 8/8, HTTP simulado. |
| `npm run test:build-recovery` después de la extracción | 11/11, con FFmpeg real y medios sintéticos. |
| Compilación Vite de renderer, main y preload | Correcta, con configuración temporal que redirige las tres salidas. |
| `dist/index.html` | SHA-256 conservado: `c5b22acf288b51732c3bc0823b3e26cb0fc67acb71ec3e0a17e1e278db95aab1`. |
| `git diff --check` | Correcta. |

Las ocho pruebas nuevas comprueban la petición heredada, orden de IDs, ausencia de
rutas locales en el envío, aislamiento del plan frente a cambios del adaptador,
rechazo integral de propuestas inválidas, JSON ilegible, cancelación temprana/tardía,
credenciales ausentes/rechazadas, límite de peticiones y reintento acotado ante HTTP 500.

Las once pruebas de recuperación cubren, entre otros casos, cuotas y duración,
recortes reales sin franjas, exportabilidad de planes antiguos completos, bloqueo de
planes antiguos incompletos, continuación sin regenerar vecinos válidos, cancelación,
entrada/plan obsoletos, descarga corrupta, persistencia atómica y recuperación tras
terminación abrupta de un proceso. No equivalen a probar la ventana de Windows.

## Entrega, aplicación y retorno

Cambios preparados localmente, sin commit ni push. `CLAUDE.md` exige aprobación
antes del commit. El parche de entrega incluye exclusivamente código, pruebas y este
informe; no contiene claves, proyectos, medios ni salidas compiladas.

Para aplicarlo desde Codex en Windows:

1. Verificar la base `90158f418ef489e9059e32282d76d4ab4253a0a8` y registrar cambios
   locales. Crear un worktree separado para 1C-A desde esa base; conservar el de 1B.
2. En el worktree nuevo, ejecutar `git apply --check` sobre el parche descargado y,
   si pasa, aplicarlo con `git apply`. Si hay divergencias, revisarlas sin sobrescribir
   archivos ni restablecer el worktree de 1B.
3. Ejecutar TypeScript y ambas suites; FFmpeg y FFprobe deben estar disponibles.
4. Comprobar arranque de Electron desde el worktree nuevo. Una prueba manual de
   construcción puede consultar DeepSeek y proveedores Stock; esta entrega no la
   ejecutó. No regenerar montajes existentes para verificar el arranque.
5. Registrar lo observado y publicar únicamente con autorización. El retorno sigue
   siendo el worktree de 1B y su commit `90158f4`.

## Siguiente entrega: 1C-B

Agregar el adaptador oficial de OpenAI sobre esta conexión común, configuración local
y respuesta estructurada. Antes de habilitarlo, concretar modelo y política de llamadas.
Las siguientes entregas de 1C completarán propuesta editorial enriquecida, referencias
al guion, validación correspondiente, vista previa/aprobación y persistencia de la
propuesta con identidad de proyecto y revisión. El índice de frase actual no sustituye
esa futura identidad editorial persistida.

La búsqueda avanzada de fragmentos, NASA/Wikimedia y evaluación visual permanecen
en 1D. No se incluyen en 1C-A.
