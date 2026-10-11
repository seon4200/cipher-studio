# 1C-B — Director con Sign in with ChatGPT

Fecha: 2026-10-10. Estado: trabajo técnico en curso; sin commit ni publicación. Inicio de sesión SIWC, permiso de uso del plan, catálogo real y restauración tras reinicio comprobados en Windows. No se hizo inferencia ni se construyeron medios.

## Elegibilidad para uso local y contenido monetizado

La documentación oficial respalda por separado estos puntos:

- SIWC documenta uso del plan en apps open-source y localmente alojadas. El Quickstart menciona proyectos open-source y ciertos clientes privados; el Cookbook incluye proyectos personales que se ejecutan localmente. Para ofrecer SIWC dentro de una app de pago o alojada remotamente, la documentación remite al formulario de interés de OpenAI.
- Los Términos de ChatGPT asignan al usuario sus derechos sobre el resultado, sujeto a la ley y las políticas. El Centro de ayuda dice que el resultado puede reimprimirse, venderse y comercializarse, sujeto a esos términos y a la Content Policy.
- La licencia del DevKit es distinta: prohíbe el uso comercial de las contribuciones de OpenAI, incluso para operaciones o ventaja de negocio sin tarifa; no concede derechos comerciales. Aclara que el software escrito independientemente no se vuelve una obra modificada solo por comunicarse con el DevKit.

**Incertidumbre:** no encontré una afirmación oficial que cubra expresamente la combinación «Cipher ejecutado solo por su propietario en su PC + uso del plan SIWC para producir videos monetizados». Que se permita monetizar resultados no demuestra por sí solo que este modo concreto de usar el plan esté aprobado. Tampoco basta con que Cipher no se venda ni se aloje para terceros para confirmar esa parte.

El usuario autorizó en un mensaje posterior únicamente la prueba técnica de conexión SIWC, revisión manual de permisos y consulta de catálogo, separada del uso productivo monetizado. Esta autorización permite ahora iniciar OAuth para esa prueba; no inicia inferencia ni confirma que usar el plan para producir videos monetizados esté permitido. La implementación de esta rama es independiente: no contiene ni importa el DevKit, Paste Perfect ni sus recursos licenciados.

## Base y conservación

- Repositorio: seon4200/cipher-studio.
- Base y HEAD: 90158f418ef489e9059e32282d76d4ab4253a0a8.
- Rama: work/reinicio-1c-b-siwc-20261010.
- Worktree: C:\graphify\_worktrees\cipher-1c-b-siwc-20261010.
- El worktree 1B sigue en work/reinicio-1b-plan-recuperacion-20261010, HEAD 90158f4. Su estado conserva project-state.json, project-state.json.bak y project-state.json.before-1b como archivos/cambios locales. No se operó en ese worktree durante esta revisión.
- No se creó commit ni se hizo push.
- Respaldo recuperable del estado anterior a la corrección: C:\Users\John Benites\OneDrive\Documents\ChatGPT\Cipher — Reinicio\backups\cipher-1c-b-preservation-20261010-133414.zip (SHA-256 386554BC53221DBC9ADD323209A577AF638B663AEBA35FA4118B79E100DAD2BB). Incluye diff rastreado y archivos nuevos de código/pruebas/docs; excluye secretos, .env, proyectos, medios y node_modules.
- Evidencia completa de comparación, con stdout/stderr, generation-debug.log, resultado de suite y captura EPIPE: C:\Users\John Benites\OneDrive\Documents\ChatGPT\Cipher — Reinicio\backups\cipher-1c-b-electron-evidence-20261010.
- dist/index.html conservó el SHA-256 1D7A675E01AA3B60A22034BE181AD10C28133D6CEE7D0C19133FE09BFB79D860 antes y después del build.

## Instrucciones, parche 1C-A y DevKit

Se leyó CLAUDE.md. No hay AGENTS.md del repositorio ni un mapa Graphify vigente de esta copia; el análisis se hizo directamente sobre el código. Las notas de la bóveda y graphify-out no se usaron como especificación.

El adjunto entrega-1c-a.patch tiene SHA-256 856273DFDA68BEDA4E3F09989B44F5507306DAC248C7E2A18B649B34B139EB05. git apply --check pasó sobre la base requerida y el parche se aplicó. No se reconstruyó 1C-A desde el informe.

SIWC se implementó como cliente propio del protocolo OAuth/Responses. No se asumió que @siwc/local ni @siwc/react estuvieran publicados en npm. El único paquete nuevo de ejecución es jose@6.2.12 (MIT), para validar OIDC. El DevKit no está en dependencias.

## Electron, requisitos de ejecución y build

- Se conserva Electron 44.7.0. Es la línea estable vigente en la fecha de esta revisión y forma parte de las tres líneas mantenidas por la política de Electron. La prueba comparativa corrigió la captura en 44; no fue necesario bajar a una línea antigua.
- SIWC y `jose@6.2.12` no requieren Electron 44: `jose` no declara `engines` en el paquete instalado; el proyecto upstream soporta Node LTS 20 y runtimes con Fetch y WebCrypto. Vite incorpora `jose` dentro del bundle main, por lo que no depende de `require(esm)` en tiempo de ejecución. El main de Cipher cargó bajo Electron 31/Node 20.18 durante la prueba gráfica, pero eso no fue una prueba OAuth.
- Las demás dependencias de ejecución revisadas no elevan ese mínimo: `@fal-ai/client` y `gl-transition` declaran Node >=18; React, Zustand y los renderizadores no exigen Node 22. Electron npm declara Node >=22.12 para su paquete de instalación/CLI, requisito satisfecho por el Node local 24.15.0. El Electron empaquetado trae su propio Node.
- `NativeImage.toBitmap()` existe en los tipos de Electron 31, 42 y 43; no hubo que cambiar código para ejecutar el mismo bundle. Electron 43 cambió el valor predeterminado de color a sRGB. La API `getBitmap()` está obsoleta.
- Build de producción en TEMP: Vite compiló 1603 módulos y emitió renderer, ventana gráfica, main y preload. `dist/index.html` conservó el SHA-256 `1D7A675E01AA3B60A22034BE181AD10C28133D6CEE7D0C19133FE09BFB79D860` antes y después.

## Comparación controlada y errores separados

Se ejecutó la suite de gráficos en serie, con el mismo bundle y el mismo archivo de prueba (SHA-256 `18530A11F185D1AE9E55546CA97F2EAACDA70828077A7D57635865317C8D47B3`), ventanas/`userData` y carpetas de proyectos separadas dentro de TEMP, y stdout/stderr redirigidos a archivos. La referencia final usa el mismo `toBitmap()` que el candidato. Una referencia preliminar con `getBitmap()` se descartó como comparación estricta al confirmar que Electron 31 también declara `toBitmap()`.

| Runtime | Resultado de la suite original | Observación |
| --- | --- | --- |
| Electron 31.7.7 (Node 20.18.0) | Pasa, código 0, con bundle idéntico | La línea está fuera de soporte; sirve solo como referencia. |
| Electron 42.11.2 | Falla en la primera sonda | `capturePage` devuelve `UnknownVizError`. |
| Electron 43.7.9 | Falla en la primera sonda | Mismo error; `toBitmap` está presente. |
| Electron 44.7.0 | Falla en la primera sonda antes de la corrección | `renderGraphicClip` devuelve `null`; no llega a convertir el bitmap ni a lanzar FFmpeg. |

La instrumentación temporal confirmó que falla la **primera** llamada a `webContents.capturePage()` (sonda inmediatamente posterior a montar la escena). El objeto rechazado solo expone `Error: UnknownVizError`; la traza instrumentada conserva el call site en el bundle y en `tests/graficos.js`, pero Chromium no ofrece una pila interna más profunda. En el código de Electron, `UnknownVizError` corresponde al resultado de error de copia de superficie de Viz (`CopyFromSurface`).

Una demora fija de 500 ms hizo pasar la suite completa. Esperar solo dos `requestAnimationFrame`, el evento `paint`, pasar `stayHidden/stayAwake` o desactivar GPU no bastó. Un reintento condicional tras 100 ms sí funcionó en Electron 44, con un solo reintento. Esto demuestra una falla transitoria de disponibilidad/copia del surface en la secuencia actual; queda incierto por qué Viz rechaza la primera copia en determinadas ejecuciones. No se atribuye a `toBitmap` ni se recomienda Electron 31 para producción.

### EPIPE

La captura `C:\Users\John Benites\OneDrive\Pictures\Screenshots\Captura de pantalla 2026-10-10 081303.png` apunta a `console.log`/`Socket._write` intentando escribir en un pipe roto. Su bundle es la ejecución temporal `cipher-1c-b-build-1791637843878`, no el worktree 1B. En esa misma ejecución el log registra un render correcto posterior; el proceso Electron había sobrevivido al comando que inició el test. Todas las comparaciones controladas redirigieron stdout/stderr a archivos y ninguna reprodujo EPIPE. La captura es consistente con el pipe del arnés cerrado mientras Electron seguía activo; no hay un stderr textual completo de aquella primera ejecución, solo la imagen conservada.

`UnknownVizError` y `EPIPE` son fallos distintos: el primero sucede en `capturePage`; el segundo al escribir la salida de consola.

## Cambios de 1C-B

- src/main/siwc/runtime.ts: OAuth dinámico, PKCE/state/nonce, callback loopback, verificación OIDC y scopes, renovación, perfiles y host ID estable. Tokens y perfiles se cifran con safeStorage en userData; no hay fallback en texto plano.
- src/main/director/chatgpt.ts: adaptador SIWC.
- src/shared/director-provider.ts, src/shared/director.ts, src/main/build/director.ts, src/main/build/request.ts: contrato de adaptadores, capacidades, compatibilidad de preferencias antiguas y validación integral.
- src/renderer/src/components/DirectorSettingsPanel.tsx, src/renderer/src/main.tsx y preload: selectores independientes de proveedor/modelo/cuenta y puente restringido. Claude y Gemini aparecen solo como planificados.
- src/main/build/runner.ts y src/main/index.ts: el proveedor, modelo y perfil se fijan al iniciar cada solicitud. DeepSeek sigue como opción explícita y predeterminada; no se cambia de proveedor/modelo silenciosamente.
- Preferencia proveedor/modelo por proyecto; proyectos antiguos conservan DeepSeek hasta una selección explícita.
- No se copiaron ni mostraron tokens, cookies o claves. La conexión se hizo desde el flujo oficial y el almacén cifrado persistió en el userData aislado. El informe no conserva el correo de la cuenta mostrado en la captura.

## Verificación

- `npx tsc --noEmit`: pasó.
- `npm run test:director-contract`: 8/8.
- `npm run test:build-recovery`: 11/11.
- `npm run test:director-siwc`: 6/6 con protocolo simulado; no hubo OAuth ni inferencia real.
- Build de producción temporal: pasó; el archivo local `dist/index.html` conservó su SHA-256.
- Electron 31.7.7, mismo bundle con `toBitmap()`: suite gráfica completa pasó.
- Electron 44.7.0, build final corregido: suite gráfica real aislada pasó con 51 aserciones OK más el marcador final de éxito; MOV QuickTime 1080×1920/60 frames/2 s, alpha y frames distintos; un reintento de capturePage. stdout/stderr redirigidos a archivos, sin EPIPE.
- `git diff --check`: pasó tras actualizar el informe; Git solo mostró avisos de conversión LF/CRLF en cuatro archivos.
- El análisis de dependencias reportó 24 vulnerabilidades (6 moderadas, 17 altas, 1 crítica). No se ejecutó `npm audit fix`.

## Aclaración del conteo gráfico (66 frente a 52)

La evidencia conservada contiene el archivo de prueba graphics-test-used.js con SHA-256 18530A11F185D1AE9E55546CA97F2EAACDA70828077A7D57635865317C8D47B3. El archivo invoca ok() 51 veces; tanto la referencia Electron 31 como la ejecución corregida Electron 44 muestran 51 líneas OK y el mismo marcador final TODO CORRECTO. El “52” del informe anterior contó ese marcador como si fuera otra aserción.

No se puede reproducir el conteo “66” con el código y registros preservados. No hay evidencia de que cambiara la cobertura entre Electron 31 y 44: ambos corrieron el mismo archivo de prueba y las mismas aserciones. El 66 queda corregido como cifra anterior no sustentada; el resultado verificable es 51 aserciones. No se reconstruye ni se atribuye a una variación de cobertura el origen exacto de aquel conteo.

## Prueba real de conexión SIWC y restauración (Windows)

- Se compiló la rama work/reinicio-1c-b-siwc-20261010 desde C:\graphify\_worktrees\cipher-1c-b-siwc-20261010 en una carpeta temporal separada. TypeScript pasó; Vite emitió renderer, main y preload. El SHA-256 de dist/index.html en el worktree permaneció 1D7A675E01AA3B60A22034BE181AD10C28133D6CEE7D0C19133FE09BFB79D860. Electron 44.7.0 abrió la ventana normal CIPHER Studio.
- Datos aislados: el proyecto de prueba aaa-1791645028712 quedó bajo la carpeta temporal de la build; el userData SIWC se aisló en LOCALAPPDATA\CipherStudio\siwc-probe-1c-b-20261010. No se abrió ni modificó un proyecto de 1B.
- La persona usuaria completó manualmente el inicio de sesión y revisó el permiso en el navegador. Al regresar, Cipher mostró la cuenta conectada y “permiso de plan concedido”. No se registra ni reproduce el correo visible en la captura.
- La interfaz consultó el catálogo real de ChatGPT y mostró 7 modelos disponibles. Selección observada: GPT-6-Luna, identificador gpt-6-luna. No se envió inferencia.
- Tras cerrar normalmente, no quedó proceso de esa instancia. El proyecto conservó directorProviderId=chatgpt y directorModelId=gpt-6-luna; el archivo cifrado siwc/profile-store.bin siguió presente (4018 bytes). No se leyó su contenido.
- Se reabrió la misma build con el mismo userData. La persona usuaria confirmó en la interfaz que se restauraron ChatGPT, gpt-6-luna, la cuenta conectada y el permiso del plan; seguían visibles 7 modelos. Los registros de ambos arranques/cierre no contienen EPIPE ni UnknownVizError. El único aviso de inicio fue que el directorio temporal no contiene .env; SIWC no requiere una clave de API.
## Panel «Director del montaje»: plegado y desplazamiento

- Corrección localizada aún sin commit en `src/renderer/src/components/DirectorSettingsPanel.tsx` y `src/renderer/src/main.tsx`.
- El encabezado clicable muestra proveedor, nombre legible del modelo y estado. El resumen mantiene a la vista cualquier error. La preferencia abierto/plegado se guarda en `localStorage` bajo una clave de interfaz; no contiene cuenta, permisos, tokens ni configuración del proyecto.
- Plegar solo cambia el estado visual. El componente de SIWC permanece montado y la consulta de estado/catálogo no depende de esa preferencia, por lo que el plegado no vuelve a consultar el proveedor ni desconecta la cuenta.
- La zona desplazable del panel lateral ahora incluye director, mezcla y biblioteca. El contenedor flex tiene `min-height: 0`; las pestañas quedan accesibles en ventanas de poca altura. No se ocultaron controles para resolver el desbordamiento.
- Verificación inicial: `npx tsc --noEmit` pasó; el build Vite de renderer, main y preload pasó en la carpeta temporal; Electron 44.7.0 abrió la ventana normal con el mismo userData y el proyecto de prueba `aaa-1791645028712`. El archivo fuente `dist/index.html` no aparece modificado.
- La persona usuaria confirmó en la ventana real el resumen compacto correcto; al expandir, permanecieron visibles la cuenta conectada, el permiso concedido y GPT-6-Luna. Con la ventana baja, llegó al final del panel y a los controles inferiores tanto abierta como plegada. Al plegarla, el resumen compacto mostró de nuevo proveedor, modelo y conexión.
- Tras cerrar normalmente y reabrir la misma build con el mismo userData, la persona usuaria confirmó que Director del montaje siguió plegado y se restauraron ChatGPT, GPT-6-Luna y la conexión. No se volvió a iniciar sesión.
- Los registros de ambos arranques no contienen EPIPE, UnknownVizError ni excepciones no capturadas. No se inició inferencia ni construcción. No queda pendiente la comprobación visual de este cambio; las demás pruebas de 1C-B y la aceptación de 1B siguen abiertas.

## Registro de procedencia y «Solo planificar»

Fecha: 2026-10-10. Cambios locales, sin commit ni push, en `C:\graphify\_worktrees\cipher-1c-b-siwc-20261010`, rama `work/reinicio-1c-b-siwc-20261010`, base `90158f418ef489e9059e32282d76d4ab4253a0a8`.

- `src/shared/build-plan.ts` guarda `directionAttempts` con ID de plan y revisión, escenas, proveedor, modelo solicitado, inicio/fin, resultado, error y los identificadores/modelo devueltos cuando existen. Cada intento de escena enlaza su registro. Al reabrir, un intento que quedó en curso pasa a «interrumpido».
- `src/main/build/runner.ts` persiste el intento antes de llamar al adaptador y va guardando los metadatos de respuesta al recibirlos. Las llamadas que fallan o se cancelan quedan registradas; al continuar se consultan solo escenas sin dirección guardada.
- Las propuestas nuevas registran su procedencia. Los planes anteriores sin esos campos siguen como `unrecorded`; no se rellena proveedor o modelo por el selector ni por `lastInference`.
- `src/main/siwc/runtime.ts` conserva telemetría global sin tokens: modelo pedido/devuelto, IDs de solicitud/respuesta, tiempo, uso disponible y estado (respuesta recibida, fallo o cancelación). `DirectorSettingsPanel.tsx` actualiza ese estado al acabar la operación, sin consultar otra vez el catálogo ni enviar una inferencia. Si no hay registro muestra «Última solicitud global: sin registro» y siempre indica que el registro global no acredita el origen del plan.
- «Solo planificar» crea y guarda un plan validado, obtiene y valida la dirección y retorna antes del preparador de medios. No consulta proveedores de medios, descarga, recorta ni aplica clips a la timeline. El estado queda como «Plan listo; medios pendientes»; «Construir medios pendientes» continúa usando las palabras ya guardadas. La primera acción avisa que el plan activo pasará al historial, conservando sus clips y su timeline.
- `BuildStatus.tsx` distingue «Plan listo; medios pendientes» de «Montaje completo» y presenta la procedencia vinculada al plan. El audio y los resultados ya completos siguen dentro del flujo existente de continuación.

### Verificación focalizada

- `npx tsc --noEmit`: pasó.
- `npm run test:build-recovery`: 13/13; incluye que `plan-only` no llama a preparación de medios, persiste/reabre proveedor y modelo, y que continuar construye medios sin repetir la dirección guardada.
- `npm run test:director-contract`: 8/8.
- `npm run test:director-siwc`: 6/6; respuestas completas, fallidas y canceladas conservan estado y metadatos de proveedor.
- `git diff --check`: pasó; Git mostró solo avisos de conversión LF/CRLF.
- Build Vite de renderer, proceso principal y preload en `C:\Users\John Benites\AppData\Local\Temp\cipher-1c-b-plan-only-93507a02620f45478ab454237ab43f79\cipher-studio`; los tres artefactos existen. Se usó Electron 44.7.0 del worktree. `dist/index.html` del worktree conserva SHA-256 `1D7A675E01AA3B60A22034BE181AD10C28133D6CEE7D0C19133FE09BFB79D860`.
- No se ejecutaron inferencias reales, construcción, búsquedas ni descargas. La comprobación del runner usa adaptadores y medios temporales simulados.

### Evidencia del proyecto antes de la prueba manual

- El proyecto aislado `aaa-1791645028712` conserva el plan histórico `ffed27cd-9fb5-4513-9b17-6e44569e67cf`, revisión 1, `incomplete`, con 11 de 28 escenas completas y 11 archivos `.mp4` en su carpeta. Su `plan.json` tenía SHA-256 `AAAAA68C06251F20EC8D89C004A7ADDB5E45EC9DC3338A8DFF62F9FF9D36623E` al iniciar este cambio.
- Huellas de los 11 clips antes de la prueba manual:

| Archivo | SHA-256 |
| --- | --- |
| `ffed27cd-9fb5-4513-9b17-6e44569e67cf-s00002.mp4` | `5B7EA14DCF4914E2EA44193FE037CBBC58C93D30CC06715A94CA082448D042AA` |
| `ffed27cd-9fb5-4513-9b17-6e44569e67cf-s00004.mp4` | `C976BAB576A3E9159543CEC66D3122E3C786AFC1838AD0D48C11F7F3B12F6326` |
| `ffed27cd-9fb5-4513-9b17-6e44569e67cf-s00007.mp4` | `F8D42FFA6F3CACF7145EBD66FF92DAC39AF886596E6FEE23B7CC215B0B3F7F42` |
| `ffed27cd-9fb5-4513-9b17-6e44569e67cf-s00009.mp4` | `E25736BECB51F3FE40E10B8E0F505637F90CCEF02368EC5EF10235B85122250C` |
| `ffed27cd-9fb5-4513-9b17-6e44569e67cf-s00012.mp4` | `400EDBF4668C32C328B2053F8AEBC9A8B9A158584A464A6037C13DBC4C29B884` |
| `ffed27cd-9fb5-4513-9b17-6e44569e67cf-s00014.mp4` | `2A235BFE1DACB64515F7E914AEF9D526DF1002E4CDDFF34CE6F95D8A81C1325C` |
| `ffed27cd-9fb5-4513-9b17-6e44569e67cf-s00017.mp4` | `85DC07CCE1017A7FE4F0E49C80605E6D6C9E7F7A08AA3547B7FE3C8D387C2EAF` |
| `ffed27cd-9fb5-4513-9b17-6e44569e67cf-s00020.mp4` | `F33BB5CBF6E5CD77030814B67D20B073DB1250151A47BB83FEB3C86A7E26D61F` |
| `ffed27cd-9fb5-4513-9b17-6e44569e67cf-s00022.mp4` | `51645396780722B220A717E1D94045E1837FBC33245C04CBE4732EDD86CEE849` |
| `ffed27cd-9fb5-4513-9b17-6e44569e67cf-s00025.mp4` | `234CB62063B60A37512975556DC5252F1EDF06217725768EAF2181FB2C67AE93` |
| `ffed27cd-9fb5-4513-9b17-6e44569e67cf-s00027.mp4` | `BE63F613017BD9AC6946BF449177DD3BF83BAE264C5E3EE61968443ED5769FC8` |

- El archivo cifrado del perfil SIWC aislado existe (4210 bytes). No se leyó ni mostró su contenido.
- La build corregida se abrió en una ventana normal de CIPHER Studio con Electron 44.7.0 desde `C:\Users\John Benites\AppData\Local\Temp\cipher-1c-b-plan-only-93507a02620f45478ab454237ab43f79\cipher-studio`. stdout y stderr se dirigieron a archivos; stderr solo contiene el aviso de que la carpeta temporal no tiene `.env`, sin `EPIPE` ni `UnknownVizError`. La persona usuaria confirmó visualmente el proyecto `aaa`, ChatGPT, `gpt-6-luna`, cuenta y permiso restaurados. Más tarde la carga del plan impidió usar «Solo planificar»; el hallazgo y la corrección están registrados abajo.
- Antes de abrirla, el plan `ffed27cd-9fb5-4513-9b17-6e44569e67cf` siguió idéntico al hash base y los 11 clips conservaron exactamente sus SHA-256. La persona usuaria iniciará «Solo planificar» manualmente; Codex no pulsará el botón ni iniciará inferencia. Después se comprobarán el registro enlazado al plan, el estado del panel, la reapertura del plan y que estas 11 huellas sigan iguales.

## Pendiente

- Sigue pendiente la aclaración oficial de OpenAI sobre el uso del plan SIWC para producir contenido monetizado en Cipher ejecutado localmente. Esta incertidumbre no bloquea la prueba técnica de conexión/catálogo ahora autorizada; no se hará inferencia para uso productivo.
- Conexión técnica y catálogo real SIWC en Windows: comprobados y restaurados tras cerrar/reabrir; no se hizo inferencia.
- La aceptación gráfica de 1B y las comprobaciones de inferencia, renovación y desconexión siguen fuera de este paso.
- La aceptación pendiente de 1B sigue abierta.
- Sin Claude/Gemini completos, Vibes, Canvas, 1D, commit ni push. 1C-B no está cerrada.

## Corrección: alias de ruta de Windows al cargar el plan

- La captura mostró «Leyendo el plan guardado» y «El plan pertenece a otra carpeta de proyecto»; por esa carga fallida, «Solo planificar» quedó deshabilitado.
- Evidencia del proyecto `aaa-1791645028712`: `build/plan.json` conserva el plan `ffed27cd-9fb5-4513-9b17-6e44569e67cf`, revisión 1, `incomplete`, 11/28 escenas completas. `projectPath` y las 11 rutas de medios guardadas usan `C:\Users\JOHNBE~1\...`; todas las 11 rutas existen y sus SHA-256 coinciden con los registrados. El hash del plan sigue en `AAAAA68C06251F20EC8D89C004A7ADDB5E45EC9DC3338A8DFF62F9FF9D36623E`, y `project-state.json` en `F544421926BB8F690EB20BA93A0EC482605ADC4E5A7D9B9FA3A5893B76159716`.
- Comprobación de Windows/Node: `fs.realpathSync.native` resolvió tanto la ruta `JOHNBE~1` como la ruta larga `C:\Users\John Benites\...` a la misma ubicación física (`true`). La comparación anterior solo usaba `path.resolve`, que no elimina el alias 8.3; `loadPlan` rechazaba el plan aunque pertenecía al proyecto abierto. Además, el renderer conservaba `buildStateReady=false` tras ese error, por eso el texto seguía diciendo «Leyendo». No se dedujo el proveedor/modelo del selector: este plan histórico continúa como `origen no registrado`.
- Corrección localizada: `loadPlan` compara rutas físicas mediante `fs.realpath` (con fallback que mantiene el error de proyecto distinto si una ruta ya no existe) y valida los clips respecto de la raíz que el plan registró. Un plan copiado a una carpeta realmente distinta sigue rechazándose. El estado deshabilitado ahora diferencia un error de lectura del proceso de carga aún en curso.
- Verificación: prueba de regresión de alias/junction y carpeta distinta; `npm run test:build-recovery` 14/14; `npx tsc --noEmit` correcto. Con el código corregido, una comprobación de solo lectura cargó el `plan.json` real por la ruta larga y devolvió el mismo ID, 28 escenas y 11 clips, sin modificar archivos.
- Build aislado con Electron 44.7.0 en `C:\Users\John Benites\AppData\Local\Temp\cipher-1c-b-path-fix-20261010-06c8a42e6dc14f73b78843f71bee2253`. No se copió `.env` ni `project-state.json`; el `dist/index.html` local conserva SHA-256 `1D7A675E01AA3B60A22034BE181AD10C28133D6CEE7D0C19133FE09BFB79D860`. Tras cerrar la instancia anterior se abrió esta build con el mismo perfil SIWC `C:\Users\John Benites\AppData\Local\CipherStudio\siwc-probe-1c-b-20261010`; el proceso y el título «CIPHER Studio» confirman el arranque. Los logs no contienen `EPIPE`, `UnknownVizError` ni excepciones no controladas. El plan y sus 11 clips siguen idénticos; al abrir la app solo cambió el campo `date` de `project-state.json`, y su `.bak` coincide con el hash previo. Falta la confirmación visual de que el proyecto carga y «Solo planificar» queda habilitado.

## Fuentes oficiales

- [Descripción de SIWC, uso local y apps pagas/remotas](https://developers.openai.com/siwc/token-sharing-open-source)
- [Quickstart SIWC](https://developers.openai.com/siwc/quickstart)
- [Cookbook SIWC y proyectos locales](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt)
- [Términos de uso de ChatGPT, vigentes desde 2026-01-01](https://openai.com/policies/terms-of-use/)
- [Centro de ayuda: propiedad y comercialización del resultado](https://help.openai.com/en/articles/6783457-what-is-chatgpt)
- [Licencia No Comercial del DevKit](https://github.com/openai/sign-in-with-chatgpt-devkit/blob/main/LICENSE)
- [Release oficial de Electron 31.7.7, fuera de soporte](https://releases.electronjs.org/release/v31.7.7)
- [Release oficial de Electron 44.7.0](https://releases.electronjs.org/release/v44.7.0)
- [Calendario y política de soporte de Electron](https://releases.electronjs.org/schedule)
- [Repositorio oficial de jose, runtimes requeridos](https://github.com/panva/jose)
- [Código de Electron que traduce errores de CopyFromSurface](https://github.com/electron/electron/blob/main/shell/browser/api/electron_api_web_contents.cc)
- [Electron nativeImage](https://www.electronjs.org/docs/latest/api/native-image)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)

## Reapertura tras «Solo planificar» (2026-10-10)

Esta comprobación se añade cronológicamente y sustituye los pendientes anteriores sobre la ejecución manual de «Solo planificar» y la recuperación de este plan. No cierra 1C-B ni la aceptación pendiente de 1B.

- Worktree: `C:\graphify\_worktrees\cipher-1c-b-siwc-20261010`; rama `work/reinicio-1c-b-siwc-20261010`; HEAD observado: `90158f4`.
- La persona usuaria ejecutó «Solo planificar» y luego cerró y reabrió Cipher. La misma build Electron 44.7.0 se inició con la carpeta de proyectos ya existente y el mismo `userData` SIWC aislado. La persona usuaria confirmó que `aaa` volvió a mostrar el plan listo y el registro de Luna.
- Plan activo: `a1b42151-3f35-4565-a7a6-92ec604fe77c`, revisión 2, estado `ready`, origen `recorded`. Su SHA-256 antes del cierre y después de reabrir coincide: `0B735870A4F84DD707C0D63CB6DC603003472559F05BA4FF8129C753D46B8DE5`. El validador actual aceptó el plan tras la reapertura.
- Procedencia persistida y vinculada al plan/revisión: un único intento, ChatGPT, modelo solicitado y devuelto `gpt-6-luna`, resultado `completed`. Cubrió las 17 escenas que necesitaban dirección. Las marcas de inicio y fin son válidas; la llamada tardó aproximadamente 20,1 s. Hay ID de respuesta del proveedor (su valor no se registra aquí) y no se guardó un ID de solicitud. Tras reabrir, el contador sigue en uno y la huella no sensible del ID de respuesta coincide con la previa; no se repitió la inferencia.
- El plan nuevo tiene cero resultados de medios; no se descargó ni construyó ningún clip al reabrir. Registros de arranque: sin `EPIPE`, `UnknownVizError` ni excepción no controlada.
- Plan anterior archivado: `ffed27cd-9fb5-4513-9b17-6e44569e67cf`, revisión 1, `incomplete`. Su hash sigue siendo `AAAAA68C06251F20EC8D89C004A7ADDB5E45EC9DC3338A8DFF62F9FF9D36623E`. Los 11 clips del plan existen, sus 11 SHA-256 coinciden con los metadatos archivados y las 11 rutas son distintas; las mismas huellas coinciden antes del cierre y después de reabrir.
- Precisión sobre la timeline: el estado guardado previo a «Solo planificar» y el posterior conservan `v-original` con el vídeo original y el audio, sin referencias de timeline a esos 11 resultados. Por tanto, están preservados el plan histórico y los archivos, pero no aparecen insertados en la timeline activa; este estado ya existía antes del plan nuevo y no fue cambiado por la reapertura.
- Sin commit ni push. No se inició otra inferencia ni construcción de medios.

## Auditoría del montaje Stock y estado de 1C (2026-10-10)

Esta entrada registra la revisión de solo lectura del montaje ya terminado. No se regeneró ni modificó el plan, la timeline, el proyecto ni sus medios.

### Funcionamiento técnico

- Proyecto aislado: aaa-1791645028712. Plan actual: 1b00fb57-1d54-403c-8d01-814ca43dbbf5, revisión 3, estado complete.
- La versión activa contiene 28 clips de vídeo: 11 Original y 17 Stock. Los 28 archivos existen y sus SHA-256 coinciden con el resultado guardado en el plan. Los 11 Original coinciden también, clip por clip, con las huellas registradas antes de la continuación; cada uno conserva un intento de medio. Los clips duran aproximadamente 2,9–2,933 s y la validación previa confirmó decodificación correcta.
- Los 17 resultados Stock seleccionados tienen proveedor Pixabay y sourceStart 0. Los recortes generados miden 2,9–2,933 s. No se sustituyeron en silencio por Original.
- Los registros muestran en cada escena Stock el intento de dirección enlazado al plan, un error anterior de medios CREDENTIALS cuando aún no estaba disponible la clave local y, después, el intento de medios completado. Esos fallos y reintentos no son llamadas a Luna.
- Aclaración importante sobre el número de inferencias: en este proyecto hay dos solicitudes reales distintas, una por cada plan, no dos intentos sobre el mismo plan. El plan histórico a1b42151-3f35-4565-a7a6-92ec604fe77c (revisión 2, ready) tuvo una solicitud ChatGPT/gpt-6-luna entre 17:32:25 y 17:32:46 COT y no tiene medios. El plan actual 1b00fb57-1d54-403c-8d01-814ca43dbbf5 tuvo otra solicitud independiente entre 17:58:55 y 17:59:14 COT, con otro ID de intento y distinta huella de respuesta; su dirección quedó asociada a la revisión 3 y luego se completaron sus medios. Ambos parten del mismo inputHash, pero sus huellas de keywords difieren. Por tanto, no se repitió la dirección al continuar los medios del plan 1b00; sí hubo una segunda dirección al crear ese plan distinto. Los registros no identifican qué acción de interfaz originó el nuevo plan, así que no se atribuye a un botón por suposición.
- No se encontró un registro histórico de la respuesta de búsqueda de Pixabay: no están guardados el conjunto de resultados, sus títulos o etiquetas, el orden recibido ni cuántos candidatos devolvió cada consulta. La evidencia de esta auditoría identifica el candidato seleccionado y su archivo, no permite reconstruir qué alternativas devolvió la API. La interfaz de esta auditoría se contrastó con fotogramas de inspección alrededor de 1,4 s; esas imágenes de análisis quedaron en Temp y no se incorporan al respaldo.

### Calidad editorial observada

El adaptador de ChatGPT recibe el guion y metadatos de texto de las escenas; el código explícitamente no le envía fotogramas ni vídeo. Esto limita lo que Luna puede inferir sobre el contenido visual. En el código, la búsqueda pide hasta cinco resultados por keyword, conserva hasta tres y ordena por orientación y ancho. Cipher acepta el primer candidato que puede descargar y recortar: no puntúa su relación semántica con la escena ni comprueba visualmente la acción. El recorte vertical escala proporcionalmente para llenar 9:16 y recorta desde el centro, sin seguimiento del sujeto.

| Inicio | Escena del guion | Keyword de Luna | Candidato seleccionado y observación |
| --- | --- | --- | --- |
| 00:00.00 · S01 | «Dices que tienes potencial» | person standing at crossroads | pixabay:345244: martín pescador sobre una rama; no coincide. |
| 00:05.83 · S03 | «tener potencial para algo» | unfinished staircase leading upward | pixabay:3611: escalones de escalera mecánica; metáfora parcial, no escalera inacabada. |
| 00:11.67 · S05 | «que muchas personas no ven» | person overlooked in a crowd | pixabay:1630: escenario y público de concierto; aparece una multitud, no una persona ignorada. |
| 00:14.60 · S06 | «Mejumi lo tiene todo, talento, potencial y reconocimiento» | talented young woman receiving an award | pixabay:275498: mujer patinando; la keyword inventa mujer y premio, y el clip no muestra reconocimiento. |
| 00:20.43 · S08 | «querer que con el potencial es suficiente» | person sitting beside untouched running shoes | pixabay:27539: hombre corriendo; no coincide con la acción propuesta. |
| 00:26.27 · S10 | «buscando que otros reconozcan que tienes potencial» | person seeking approval from others | pixabay:33014: toma aérea de barcos; sin relación visible. |
| 00:29.20 · S11 | «Te lo dices aquí misma para poder sentirte cómoda» | person looking into a mirror | pixabay:32443: primer plano de una placa electrónica; sin relación visible. |
| 00:35.00 · S13 | «El potencial no sirve de nada si solo existe como posibilidad» | empty seedling pot on a windowsill | pixabay:260395: tierra oscura con un brote pequeño; metáfora parcial, plano muy oscuro y sin maceta visible. |
| 00:40.80 · S15 | «lo único que le queda es aventarse al mundo» | person stepping onto a busy city street | pixabay:14476: edificio de piedra y calle; la fuente muestra una persona en el borde, pero el recorte central la elimina. No es una calle urbana concurrida. |
| 00:43.70 · S16 | «y obtener experiencia» | beginner learning a new skill hands-on | pixabay:110734: surfista ante una ola; puede sugerir reto, no aprendizaje práctico. |
| 00:49.47 · S18 | «y se pregunta qué podrían llegar a ser» | person gazing at a distant mountain peak | pixabay:305657: sendero de bosque; no aparecen persona ni montaña. |
| 00:52.37 · S19 | «la única pregunta» | person writing a goal in a notebook | pixabay:43459: mujer sentada con cuaderno; relación parcial, no se distingue una meta escrita. |
| 00:58.13 · S21 | «llevarse al límite una y otra vez» | athlete pushing through a steep uphill run | pixabay:215946: corredora en parque llano; está en la fuente horizontal, pero queda fuera del recorte vertical centrado. |
| 01:03.90 · S23 | «dejes de sentirte cómoda pensando en lo que podrías llegar a ser» | person closing a book and standing up | pixabay:43459: el mismo vídeo de S19; sigue sentada y no cierra un libro ni se levanta. |
| 01:06.80 · S24 | «atravesar las experiencias que realmente pueden convertirte en esa persona» | hiker crossing a rocky trail | pixabay:86164: terreno montañoso y rocoso; relación parcial, la persona no se distingue claramente en el fotograma revisado. |
| 01:12.57 · S26 | «el potencial… estar incompleta» | unfinished sculpture in an artist studio | pixabay:27539: el mismo corredor de S08; no aparece una escultura. |
| 01:18.33 · S28 | «una mera proyección de lo que pudo ser y no fue» | faded photograph of an abandoned dream | pixabay:163333: flores contra fondo negro; metáfora débil, no una fotografía. |

Las causas se separan así: hay keywords de dirección que añaden detalles no sustentados por el guion; hay candidatos Pixabay seleccionados cuyo contenido visible no concuerda; y la selección de Cipher carece de ranking semántico y de deduplicación global. La falta del conjunto histórico de respuestas impide determinar si Pixabay no ofreció una alternativa adecuada o si Cipher eligió la primera opción técnica entre mejores alternativas. El recorte central sí explica de forma directa que las personas de S15 y S21 desaparezcan del resultado.

### Criterios de 1C: comprobados y pendientes

| Criterio | Estado y evidencia |
| --- | --- |
| Contrato común del director, validación completa de propuestas, IDs y campos editoriales permitidos | Comprobado por TypeScript y test:director-contract (8/8); se rechazan respuestas parciales/malformadas y se conservan duraciones y medios bajo control de Cipher. |
| DeepSeek conservado como opción explícita y compatibilidad con proyectos antiguos | Comprobado por código y pruebas. No se hizo una inferencia real con DeepSeek en esta aceptación. |
| Inicio de sesión SIWC en Windows, regreso a Cipher y permiso de uso del plan | Comprobado manualmente por la persona usuaria en la ventana normal. |
| Catálogo real y selección de ChatGPT | Comprobado manualmente: siete modelos visibles; selección GPT-6-Luna/gpt-6-luna. No se inventaron identificadores. |
| Tokens fuera del renderer y almacenamiento local protegido | Comprobado por pruebas de almacenamiento/código; tras reiniciar, la misma instalación restauró conexión y modelo sin exponer tokens. |
| Preferencia de proveedor/modelo y reapertura de proyecto | Comprobado por pruebas de recuperación y reapertura real de aaa. |
| Renovación, desconexión/revocación, permiso ausente, cancelación, respuesta incompleta y cancelación tardía | Fixtures automatizados SIWC: 9/9. La desconexión/reconexión también quedó comprobada manualmente en Windows; la revocación remota no se registró por separado. |
| Inferencia real, respuesta completa y modelo solicitado/devuelto asociado al plan | Comprobado para los dos planes registrados. La respuesta llegó de Luna y quedó vinculada a ID/revisión, con dos intentos de plan distintos. El uso/consumo no aparece en el registro ligado al plan, por lo que el importe no está verificado aquí. |
| Solo planificar sin medios y recuperación tras cerrar/reabrir | Solo planificar y reabrir se observaron manualmente en a1b421… con ID, hash y procedencia intactos y cero medios. La continuación real de medios se observó en 1b00…: una sola dirección registrada, 28/28 resultados completos y los 11 Original con sus hashes previos. La prueba integrada 14/14 cubre además la continuación del mismo plan fixture aunque cambie el selector; repetir la construcción manual no es indispensable para esta comprobación técnica. |
| Tests SIWC, contrato, recuperación y arranque/render | Verificación registrada: SIWC 9/9, contrato 8/8, recuperación 14/14, ubicación de proyectos 2/2, TypeScript y build temporal. Los errores de captura de render y EPIPE se documentaron y separaron; la ejecución final registrada no los reprodujo. |
| Desconexión y reconexión desde la interfaz Windows | Comprobadas manualmente en la ventana del worktree 1C-B. Tras reconectar, la persona usuaria confirmó cuenta conectada, permiso concedido, GPT-6-Luna y 7 modelos visibles. El almacén SIWC aislado se actualizó; no se mostró ni leyó su contenido. La revocación remota no se registró separadamente. |
| Condiciones de uso SIWC para producir contenido monetizado con Cipher local | Sigue incierto. La conexión técnica no confirma elegibilidad de uso monetizado ni activa facturación de API. |
| Aceptación completa de 1B | Sigue abierta según el registro de entrega; este montaje no la cierra por sí solo. |
| Integraciones Claude/Gemini | Solo está preparada la arquitectura y se muestran como futuras; no están conectadas, tal como corresponde al alcance de 1C-B. |
| Aprobación editorial completa y persistencia ampliada de propuestas | Pendientes de siguientes entregas de 1C. |

**Estado:** 1C-B no está cerrada. La segunda dirección real produjo un plan distinto; los registros demuestran las dos solicitudes por plan, pero no guardan qué control de interfaz creó el segundo. La prueba automática confirma que continuar el mismo plan reutiliza la dirección guardada; la secuencia manual exacta de a1b requiere una comprobación separada si se necesita aceptación visual completa.

### Requisitos registrados para 1D

1. Mantener las propuestas de escenas fieles al guion; no inventar personas, acciones, objetos ni premios. Mostrar que la dirección parte de texto y no de análisis visual si no se envían fotogramas.
2. Guardar por escena la consulta exacta, proveedor, página/orden, número de candidatos recibidos y candidatos conservados, con identificador, título/etiquetas disponibles, duración y dimensiones; guardar además cuál fue elegido, rechazado o falló. No registrar claves ni URLs con credenciales.
3. Evaluar pertinencia entre guion, keyword y contenido visible del candidato antes de descargarlo o aprobarlo; distinguir coincidencia temática de coincidencia visual y pedir revisión cuando la evidencia sea débil.
4. Controlar repeticiones entre escenas usando identidad proveedor+candidato; evitar reutilizar automáticamente el mismo archivo para escenas distintas o exponerlo como repetición deliberada.
5. Elegir el fragmento temporal que contenga la acción pertinente, en vez de empezar siempre en segundo cero.
6. Adaptar a 9:16 sin deformar y conservar al sujeto dentro del encuadre: posición de recorte consciente del sujeto, vista previa y una alternativa manual cuando no sea posible mantenerlo. La selección visual avanzada permanece para 1D.
7. Usar como casos de aceptación los desajustes y recortes observados en S01, S06, S08, S10, S11, S15, S19/S23, S21 y S26. No regenerar este montaje para preparar esos criterios.

## Cierre técnico de 1C — revisión sobre f6b0ccc (2026-10-10)

### Base y conservación

- Worktree comprobado: `C:\graphify\_worktrees\cipher-1c-b-siwc-20261010`.
- Rama: `work/reinicio-1c-b-siwc-20261010`; HEAD y respaldo remoto coinciden en `f6b0cccde85c641002dffe67953eb2e986e99bc1` al inicio de esta revisión.
- No había cambios locales al comenzar. Esta revisión deja cambios locales en la ubicación de proyectos, sus pruebas y este informe; no modifica ni publica commits.
- Ninguna prueba leyó, escribió o eliminó proyectos, medios o el perfil SIWC real. Todas las fixtures escribieron bajo carpetas temporales propias y las limpiaron al finalizar.
- La build completa temporal generó renderer, main y preload fuera del worktree. `dist/index.html` conservó SHA-256 `1D7A675E01AA3B60A22034BE181AD10C28133D6CEE7D0C19133FE09BFB79D860` antes y después.

### Directorio de proyectos al cambiar la carpeta de arranque

La versión publicada aún derivaba `proyectos/` de `process.cwd()`. Abrir el proyecto por su archivo evitaba el síntoma durante esa sesión, pero no guardaba su raíz para el siguiente arranque. Por tanto, no era una corrección.

La corrección local añade `ProjectLocationStore`: guarda la carpeta que contiene los proyectos en `userData/projects-location.json`, detecta el directorio legado calculado con la regla anterior si allí existen proyectos y registra la carpeta del proyecto cuando se abre. No mueve ni vuelve a escribir `project-state.json` o medios. La ruta inicial estable, si no hay directorio legado que adoptar, es `userData/projects`.

Límite de migración: si la ubicación antigua está fuera del directorio legado del arranque actual y nunca se registró, Cipher no puede inferirla sin escanear el disco. En ese primer caso habrá que abrir una vez un `project-state.json` existente desde «Abrir Proyecto»; esa carga registra su carpeta contenedora y las siguientes aperturas ya no dependen de `process.cwd()`. Las pruebas temporales confirman adopción del legado y reapertura desde otra carpeta de arranque (2/2). No se usaron proyectos reales para probar esta corrección.

### Errores y procedencia: comprobación aislada

- `npm run test:director-siwc`: 9/9. Añade OAuth cancelado sin perfil conectado; errores simulados 401/sesión caducada, 403/cuenta o modelo, 429/límite y fallo de conexión; JSON inválido; respuesta completada que llega después de cancelar; desconexión simulada y reconexión al mismo ID de cliente/identidad de instalación. No contactó OpenAI.
- `npm run test:director-contract`: 8/8. Incluye IDs duplicados/ajenos, propuestas incompletas, campos restringidos y adaptador no cooperativo ante cancelación.
- `npm run test:build-recovery`: 14/14. La prueba «plan-only» cambia a DeepSeek/`deepseek-chat` al continuar el plan fixture y verifica que no llama al director, conserva exactamente los intentos/procedencia previa y completa solo los medios.
- `npm run test:project-location`: 2/2. Rutas de test bajo TEMP; verifica hash del medio fixture y texto de `project-state.json` sin moverlos.
- `npx tsc --noEmit`: correcto. Vite produjo ambos HTML y los bundles renderer, main y preload en un directorio temporal dedicado; `dist/index.html` quedó idéntico.

### Consumo disponible y límites

La documentación oficial de OpenAI describe `usage` en la respuesta completada con `input_tokens`, `output_tokens` y `total_tokens`; puede incluir breakdown de tokens cacheados y de razonamiento. El runtime de Cipher guarda los tres totales cuando el evento SIWC los proporciona. La [guía oficial de conteo](https://developers.openai.com/api/docs/guides/token-counting) aclara que `output_tokens` incluye tokens generados que no siempre aparecen en el texto visible.

Esto mide tokens informados por la respuesta, no precio monetario, saldo/cuota restante ni el uso total del plan. Los registros disponibles de los planes previos no vinculan un importe ni cifras de uso al plan; no se leyó el almacén SIWC para recuperar datos no capturados y no se hizo una llamada adicional.

### Criterios de cierre y pendientes separados

| Criterio técnico de 1C | Estado actual |
| --- | --- |
| Conexión real SIWC en Windows, catálogo y selección de Luna; planificación real validada y procedencia guardada/reabierta | Comprobado previamente; no repetido. |
| Continuar medios sin regenerar los 11 Original ni repetir la dirección del plan completado | Comprobado previamente; no repetido. |
| Errores SIWC, permiso ausente, sesión/conexión, cancelación, JSON inválido y respuesta tardía | Cubiertos en fixtures aislados 9/9; no sustituyen errores reales de cuenta. |
| Cambiar proveedor/modelo sin sustituir la dirección guardada | Comprobado por test del mismo plan: la continuación no llama al nuevo director y mantiene idénticos los intentos anteriores. |
| Desconexión y reconexión en la ventana real de Windows | Comprobado manualmente el 2026-10-10. La cuenta volvió conectada con permiso, catálogo de siete modelos y GPT-6-Luna seleccionado. No se inició inferencia ni construcción. |
| Proyectos tras cambiar el directorio de arranque | Corrección local y suites aisladas aprobadas. La verificación en Windows con el proyecto auditado sigue pendiente: el perfil SIWC aislado no contiene `projects-location.json`, así que no está demostrado que esta instancia haya usado el nuevo puntero al abrir/reiniciar desde otra carpeta de arranque. No se movió ningún proyecto. |
| Continuación y exportación de `Solo planificar` sobre el mismo plan en una sesión real de UI | No indispensable para esta revisión: la continuación same-plan tiene prueba integrada 14/14, y ya se observaron por separado planificación/reapertura real y medios/exportación reales en otro plan. Repetirlo requeriría otra construcción y alteraría el montaje de evidencia; no se hizo. |
| Cifras de uso vinculadas a los planes reales | No disponibles en la evidencia planificada; no se deducen de la selección Luna ni de la documentación general. |

- **1B histórico:** la aceptación completa sigue abierta según `docs/reinicio-1b-plan-recuperacion.md`; no se cambia su estado ni se regeneran montajes.
- **1D editorial:** búsquedas, pertinencia, deduplicación y encuadre consciente del sujeto siguen pendientes; este trabajo no genera ni modifica el montaje auditado.
- **Uso monetizado:** la incertidumbre sobre las condiciones aplicables a SIWC permanece. La conexión técnica y estas pruebas no constituyen autorización de uso comercial.
- **Estado actualizado más abajo:** la desconexión/reconexión manual ya se completó. Se conservan por separado los pendientes históricos de 1B, 1D editorial y condiciones de uso monetizado.

### Desconexión, reconexión e integridad posterior (2026-10-10)

- Instancia comprobada: ejecutable de Electron bajo `C:\graphify\_worktrees\cipher-1c-b-siwc-20261010\node_modules\electron\dist\electron.exe`, título `CIPHER Studio`; perfil SIWC aislado `C:\Users\John Benites\AppData\Local\CipherStudio\siwc-probe-1c-b-20261010`.
- La persona usuaria confirmó en la ventana que, tras reconectar, aparecen cuenta conectada, permiso de uso del plan concedido, `gpt-6-luna` y siete modelos. Esta es evidencia manual de la interfaz. La reconexión actualizó el catálogo; no se solicitó inferencia ni construcción.
- Sin abrir ni descifrar `siwc/profile-store.bin`, el archivo pasó a 625 bytes después de desconectar y a 4.249 bytes tras reconectar. Esto concuerda con la eliminación local y posterior restauración de credenciales cifradas. La confirmación de revocación remota no se registró; no se afirma.
- Proyecto verificado en `C:\Users\John Benites\AppData\Local\Temp\cipher-siwc-auth-probe-20261010\cipher-studio\proyectos\aaa-1791645028712`. `project-state.json` identifica `aaa`, conserva Gráficos 0 %, Transiciones 0 %, preferencia ChatGPT/`gpt-6-luna` y 29 clips de vídeo en timeline. Su SHA-256 actual es `51E795CE5EFA6879E6AB68142347CDA007C2F302DD60ACEE2C8AFEA055C89ACB`.
- Plan activo: `1b00fb57-1d54-403c-8d01-814ca43dbbf5`, revisión 3, estado `complete`, 28/28 escenas completas; hash actual `7149138BA5482D37FA39F29C6D51A0F23D9D193BAF9756D9352C0F8F01638C8F`. Conserva 11 Original y 17 Stock. Los 28 archivos de resultado existen, cada SHA-256 coincide con el registrado en el plan y sus rutas son únicas. Los 11 Original vuelven a coincidir, uno por uno, con los SHA-256 registrados antes de continuar medios. Sus duraciones guardadas van de 2,867 a 2,933 s.
- El plan mantiene un único intento de dirección: ChatGPT, modelo solicitado y devuelto `gpt-6-luna`, asociado a la revisión 3. No apareció un segundo intento. La ruta de reconexión consulta autenticación y catálogo; no llama al adaptador de dirección.
- Los hashes del plan y del estado son una nueva instantánea de integridad, no una comparación del `project-state.json` inmediatamente antes/después de reconectar. La evidencia concreta de medios sí compara los 11 Original con su manifiesto previo y los 28 resultados con el manifiesto actual del plan. No se regeneró ni cambió ningún medio.
- **Criterios técnicos de SIWC revisados:** conexión, desconexión/reconexión, permiso, catálogo, Luna y uso de la procedencia guardada quedan comprobados por ejecución manual o pruebas focalizadas según las filas anteriores. No queda una repetición indispensable de inferencia/construcción: el test integrado 14/14 cubre `Solo planificar`→continuar en el mismo plan fixture; la reapertura manual de un plan y la continuación manual de medios están verificadas en planes ya existentes. La secuencia visual íntegra en un mismo proyecto no se repitió.
- **Comprobación técnica de ubicación fuera de SIWC:** completada en Windows el 10-10-2026; la raíz del proyecto quedó registrada y aaa reapareció y abrió después del reinicio desde otro CWD. La evidencia y los hashes están en la sección Prueba de ubicación de proyectos en la ventana real.
- **Pendientes separados:** 1B conserva su estado histórico abierto; 1D mantiene pendientes calidad editorial de Stock, registro/evaluación de candidatos, deduplicación y encuadre consciente del sujeto; las condiciones de uso monetizado de SIWC siguen inciertas. Esos puntos no invalidan la prueba técnica de conexión ni quedan resueltos por ella.
- **Estado:** aceptación técnica de conexión SIWC en Windows comprobada; 1C-B no se declara cerrada mientras sigan pendientes los criterios de entrega editorial y la revisión integral definida para las siguientes fases. No se inició 1D ni se hizo commit/push.

## Prueba de ubicación de proyectos en la ventana real (10-10-2026)

- **Worktree y build abiertos:** worktree C:\graphify\_worktrees\cipher-1c-b-siwc-20261010, rama work/reinicio-1c-b-siwc-20261010, HEAD f6b0cccde85c641002dffe67953eb2e986e99bc1. La build normal inicialmente abierta provenía de C:\Users\John Benites\AppData\Local\Temp\cipher-1c-b-path-fix-20261010-06c8a42e6dc14f73b78843f71bee2253; su main no incluía ProjectLocationStore, rememberProject ni projects-location.json. El paquete compilado antiguo del worktree tampoco incluía el cambio. Esa es la causa comprobada de que el perfil no tuviera el puntero; no era evidencia de fallo en el código fuente actualizado.
- **Build corregida:** renderer, main y preload se compilaron en C:\Users\John Benites\AppData\Local\Temp\cipher-1c-project-location-check-20261010-c5d5335a9e674106afb67e996dd26a0e. El main emitido contiene ProjectLocationStore y projects-location.json. Se mantuvo dist/index.html del worktree sin recompilar/sobrescribir. Las tres aperturas de aceptación ejecutaron esta build y Electron 44.7.0.
- **Por qué apareció primero una raíz vacía:** el primer arranque corregido se hizo desde C:\Windows\Temp; como no había raíz heredada allí, el código inicializó userData\projects. Copié ese puntero generado por la prueba a projects-location-initial.json, retiré solo el puntero activo que apuntaba a esa carpeta vacía y conservé la carpeta. No toqué el proyecto. Al arrancar después desde el padre real ...\cipher-siwc-auth-probe-20261010\cipher-studio, la lógica de adopción heredada encontró proyectos, registró esa raíz y la interfaz mostró aaa-1791645028712. Esto usó el flujo normal de inicialización de Cipher; el proyecto no se movió ni duplicó.
- **Registro y reinicio desde otro directorio:** en el mismo userData C:\Users\John Benites\AppData\Local\CipherStudio\siwc-probe-1c-b-20261010, projects-location.json apunta a C:\Users\John Benites\AppData\Local\Temp\cipher-siwc-auth-probe-20261010\cipher-studio\proyectos. Tras cerrar normalmente y relanzar la misma build desde C:\Users\John Benites\OneDrive\Documents\ChatGPT\Cipher — Reinicio, la lista volvió a mostrar aaa; la persona usuaria abrió el proyecto y confirmó que el editor cargó correctamente. El CWD de relanzamiento no tiene una raíz Cipher propia.
- **Integridad tras abrir:** proyecto aaa-1791645028712, 29 clips de timeline, Gráficos 0 %, Transiciones 0 %, preferencia chatgpt/gpt-6-luna. Plan 1b00fb57-1d54-403c-8d01-814ca43dbbf5, revisión 3, complete, 28 escenas, un intento de dirección; SHA-256 de build/plan.json 7149138ba5482d37fa39f29c6d51a0f23d9d193baf9756d9352c0f8f01638c8f, igual a la referencia. Los 28 archivos del plan siguen en rutas únicas, existen y coinciden con sus SHA-256 de referencia. No se solicitó dirección ni se construyeron medios.
- **Guardado del estado al cerrar:** el hash de project-state.json de la auditoría anterior era 51e795ce5efa6879e6ab68142347cda007c2f302dd60acee2c8afea055c89acb. Antes de la adopción, la referencia nueva registró 6ad48d340fbbaa95628bea519985ce431cd8f44e6b86d2110b3235d3f40dbd8e; el momento exacto de esa primera variación no quedó atribuido. Al cierre normal de la ventana de aceptación, Cipher escribió el respaldo .bak con ese hash y cambió el hash corriente a 211cca99efa6293cb000e5d83508c1d82280e4478651285160b8ca566ad1b24d. La comparación JSON del archivo y su .bak mostró que el único campo cambiado fue date; ID, modelo, 29 clips, plan y medios permanecen iguales. La reapertura posterior no cambió esa instantánea. Referencias recuperables fuera del proyecto: aaa-reference.json, aaa-reference-before-adoption.json y projects-location-initial.json en la carpeta temporal de comprobación.
- **Conclusión de ubicación:** corrección incluida en la build y comprobada en Windows: raíz heredada detectada y guardada; aaa aparece y se abre después de reiniciar la misma build desde otro CWD con el mismo userData. La raíz vacía inicial provino del primer CWD de prueba, no de una copia perdida.
- **Límites que siguen separados:** la primera variación del hash de project-state.json respecto a la auditoría previa no tiene una causa demostrable con la referencia antigua disponible; su contenido actual y respaldo confirman los campos esenciales y el plan/medios. Permanecen la incertidumbre documentada de uso monetizado, los pendientes históricos de 1B y la calidad editorial Stock correspondiente a 1D. No se hizo commit ni push; 1C no se declara cerrada.

## Cierre de la verificación técnica de 1C-B — 10-10-2026

Esta actualización incorpora las pruebas manuales de desconexión/reconexión y ubicación persistente de proyectos realizadas después de las auditorías anteriores. Sustituye los estados “pendiente” que aquellas entradas dejaron abiertos; se conservan como registro histórico de lo que se sabía entonces.

### Evidencia añadida

- **Worktree/build:** C:\graphify\_worktrees\cipher-1c-b-siwc-20261010, rama work/reinicio-1c-b-siwc-20261010. Se abrió la build temporal corregida, compilada desde este worktree con Electron 44.7.0. Se mantuvo el mismo userData SIWC aislado. La build antigua que primero se abrió no incluía ProjectLocationStore; ese fue el motivo concreto por el que no aparecía projects-location.json.
- **Ubicación:** al arrancar la build corregida desde la carpeta heredada que contenía el proyecto, Cipher registró mediante su inicialización normal la raíz existente en userData/projects-location.json. Tras cerrar la app y reabrirla desde C:\Users\John Benites\OneDrive\Documents\ChatGPT\Cipher — Reinicio, con el mismo userData, aaa-1791645028712 volvió a aparecer en la lista y la persona usuaria confirmó que abrió correctamente. No se movió ni duplicó el proyecto.
- **Integridad de aaa:** plan 1b00fb57-1d54-403c-8d01-814ca43dbbf5, revisión 3, estado complete; 28 escenas y 29 clips de timeline. El hash del plan coincidió con la referencia. Los 28 medios existen en rutas únicas y sus hashes coinciden con el plan; los 11 Original mantienen sus hashes previos. Gráficos y Transiciones permanecen en 0 %. No se ejecutó dirección ni construcción durante esta prueba.
- **Desconexión/reconexión SIWC:** la persona usuaria desconectó y reconectó desde la ventana normal de Windows. Tras reconectar, confirmó cuenta conectada, permiso de uso del plan, GPT-6-Luna y siete modelos visibles. La prueba solo consultó autenticación y catálogo; no hizo inferencia ni construcción. Se revisó el almacén cifrado sin leer ni registrar su contenido.
- **Pruebas ya registradas:** TypeScript correcto; contrato 8/8; recuperación 14/14; fixtures SIWC 9/9; ubicación de proyectos 2/2; build y render aislados correctos. Las pruebas de fallo y cancelación usan fixtures, no límites reales ni cambios de credenciales.

### Estado de los criterios técnicos

| Criterio del alcance 1C-B | Evidencia y estado |
| --- | --- |
| SIWC real en Windows: conexión, permiso, regreso, catálogo y selección de Luna | Comprobado manualmente; siete modelos observados con identificadores reales. |
| Desconectar y reconectar desde Cipher | Comprobado manualmente. La cuenta, el permiso, el catálogo y gpt-6-luna quedaron visibles tras reconectar. |
| Sesión y preferencias tras reiniciar; proyecto encontrado desde otro directorio de arranque | Comprobado manualmente con el mismo userData. El puntero de ubicación quedó guardado y aaa abrió correctamente. |
| Inferencia pequeña, respuesta validada y procedencia vinculada al plan/revisión | Comprobado previamente con Luna. El registro guarda solicitado/devuelto, fechas, resultado y los identificadores disponibles. No se repitió en esta actualización. |
| Solo planificar, guardar y reabrir sin duplicar la inferencia | Comprobado previamente en la interfaz con ID, revisión, hash y un intento conservados. |
| Continuar medios usando la dirección guardada, conservar Original y evitar sustitución silenciosa | Comprobado en el montaje auditado y por la prueba integrada de recuperación 14/14. Los 11 Original conservaron sus archivos y hashes. |
| Cambio de proveedor/modelo durante una espera o antes de continuar | La prueba integrada confirma que la solicitud iniciada conserva su contexto y que continuar el plan reutiliza su dirección guardada, sin cambiar la procedencia anterior. |
| Errores de cuenta/conexión, permiso, respuesta inválida, cancelación y respuesta tardía | Fixtures aislados: SIWC 9/9 y contrato 8/8. No se provocaron errores de cuenta ni límites reales. |
| Persistencia de la raíz de proyectos y migración desde la ubicación heredada | Prueba automatizada 2/2 y reapertura real desde un CWD distinto, con el mismo userData. |
| Uso/consumo informado por el servicio | Cipher conserva los campos de tokens cuando el servicio los entrega. Los planes reales de esta evidencia no contienen cifras vinculadas; no hay consumo cuantificable que registrar. |

**Cierre técnico:** se cubren los criterios técnicos asignados a 1C-B: conexión SIWC y catálogo real, adaptador y validación, procedencia, recuperación, manejo probado de errores, selección persistida y ubicación de proyectos. La comprobación manual de Solo planificar→continuar no se repitió sobre un único montaje: sus partes reales se comprobaron en los planes ya existentes y la continuación del mismo plan está cubierta por test:build-recovery 14/14. Repetir la construcción alteraría el montaje conservado y no es necesario para cerrar este criterio técnico.

El registro histórico no identifica qué control inició la segunda dirección que originó el plan 1b00…; la relación entre cada intento y su plan sí está guardada y verificada. Esa incertidumbre forense no cambia la prueba de que la continuación reutiliza la dirección del plan activo.

### Pendientes que permanecen fuera del cierre técnico de 1C-B

- **1B histórico:** su aceptación completa permanece abierta según el informe específico de 1B. Este cierre técnico de 1C-B no cambia ese estado.
- **1D editorial de Stock:** pertinencia de las propuestas, registro y evaluación de candidatos, repeticiones y encuadre consciente del sujeto siguen pendientes. El montaje auditado permanece intacto.
- **Fases posteriores de 1C:** aprobación editorial completa y persistencia ampliada de propuestas continúan en su alcance posterior.
- **Límites de la prueba SIWC:** no se revocó remotamente la autorización de la cuenta. Los estados de sesión revocada/caducada y permiso se ejercitaron con fixtures. La reconexión manual comprobó el flujo normal, no un incidente remoto.
- **Uso monetizado:** sigue sin resolverse si las condiciones de SIWC permiten el caso de uso monetizado de Cipher; la prueba técnica no constituye autorización comercial.

No se regeneró el montaje, no se inició 1D y no se modificaron proyectos, medios ni credenciales durante estas comprobaciones.
