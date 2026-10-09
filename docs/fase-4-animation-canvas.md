# Fase 4 — Visuales con Animation/Canvas

## Alcance y estado

Implementación sobre `work/fase4-animation-canvas-20261009`, creada desde `work/fase3-stock-discovery-20261009` (`5cc357c78be2422874f07eed9bdca9bf8190a535`). La fase conserva Original, Stock, IA y Visuales, sus cuotas y sus extremos. No cambia proveedores de vídeo, Vibes, motores heredados ni la dirección de las fases 5–7. No añade dependencias.

Visuales nuevos usan código Canvas creado para el guion y el proyecto actuales. La ruta de Animation solicita código nuevo; no usa una biblioteca de escenas como sustituto. Sí guarda el código, el plan y los resultados del trabajo actual para reabrirlo, editarlo o reanudarlo.

El montaje de prueba demuestra una escena nueva y reproducible; aún no cierra la aceptación completa de fase 4: el servidor Codex agotó la reconexión al generar las dos escenas restantes, por lo que no hay un MP4 final de 20 segundos que revisar o exportar.

## Cambios

- `AnimationWorkspace` queda accesible desde Visuales. El chat conserva referencias y contexto del proyecto, distingue una corrección del Visual seleccionado de una instrucción global y muestra el alcance antes de guardar un cambio de estilo.
- Se añade una biblioteca versionada de estilos administrados. Cada proyecto conserva una copia del perfil usado y sus referencias. Los perfiles integrados no se pueden borrar; borrar un perfil de la biblioteca elimina solo su carpeta administrada, no las copias de proyecto, videos ni referencias originales.
- Los perfiles pueden guardar tipografías, paleta, dirección de movimiento y referencias. El generador puede crear un perfil con otra composición y paleta; no queda limitado al estilo inicial ni obliga a repetir una estructura por escena.
- El plan completo se persiste antes de despachar medios. La cola de Animation trabaja por ID e intervalo, conserva los slots aplicados y pendientes, guarda cada resultado y se coordina con la cola común. En una mezcla, Canvas puede avanzar mientras trabajan Stock/IA; Gráficos espera los medios elegibles que necesita. Las pruebas reales de mezcla quedan pendientes.
- Cancelar detiene nuevos trabajos; continuar conserva IDs e intervalos y solo reintenta pendientes. La protección de proyecto y versión sigue bloqueando resultados tardíos. La exportación comprueba que no queden medios requeridos sin guardar.
- El render por defecto entrega el `ImageData` RGBA completo del Canvas directamente a FFmpeg. Codifica PNG solo para los fotogramas representativos que guarda para revisar el render. `CIPHER_ANIMATION_CAPTURE_MODE=png-data-url` conserva la ruta anterior para comparación.
- El código de escena sigue ejecutándose dentro del runtime aislado: sin Node en la ventana, `sandbox` y CSP local con red desactivada; la validación rechaza capacidades de archivo, proceso, red y acceso a la página fuera del contrato.

## Dirección extraída de las referencias

Se revisaron secuencias mediante tres fotogramas por cada uno de los cuatro videos adjuntos, en distintos puntos de su duración. La llamada de estilo recibió las doce capturas. La dirección resultante conserva decisiones visuales generales —tinta azul oscura, azul brillante y coral, jerarquía editorial, tipografía de contraste, capas con volumen y conexiones progresivas—. No incorpora fotogramas, texto, hechos, símbolos ni escenas de esas referencias. Cada elemento generado se relaciona con el guion actual.

Codex devolvió el perfil editable **Editorial modular · tinta, azul y coral**, ID `style-c041a0a557b970d4ea87`, versión 1. La llamada real de propuesta de estilo duró 32,764 ms; el perfil se guardó en la biblioteca y su copia quedó en el proyecto. Tras cerrar y reabrir Studio, el estilo y las referencias seguían asociados al proyecto.

## Ensayo real en Windows

Proyecto temporal `Fase 4 ensayo Visuales 20s 20261009`:

- Guion: “Al mediodía, los paneles solares producen más electricidad de la que usamos. Las baterías guardan ese excedente. Cuando cae el sol, lo liberan y ayudan a equilibrar la red durante todo el día.”
- 20 s, 9:16, 1080 × 1920, 30 fps, sin narración ni archivo original; cuota `[Original, Stock, IA, Visuales] = [0,0,0,100]`.
- Studio usó la conexión existente `codex-app-server`, autenticada en el proceso de la aplicación. No hubo fallback a DeepSeek.

### Plan y persistencia

El planificador real hizo una llamada Codex (`gpt-6-luna`): 6,119 ms en proveedor y 6,174 ms de planificación total. El plan guardado creó tres slots Visuales consecutivos, sin huecos ni solapamientos, con duraciones distintas (7.2667 s, 3.0333 s y 9.7000 s), y cobertura `[0,20]`:

| ID estable | Inicio | Duración |
| --- | ---: | ---: |
| `build-915aa31f-550b-445d-8d04-8d7843247b64` | 0.0000 s | 7.2667 s |
| `build-64049afc-2f4e-4dd4-893d-c75f25d8294e` | 7.2667 s | 3.0333 s |
| `build-7a53766a-61e3-4cea-b339-eb316f0b9a0b` | 10.3000 s | 9.7000 s |

El plan y los slots se escribieron antes de Animation. Se reabrió el proyecto en otra sesión de Studio y se conservaron el ID, el estilo, la escena aplicada y los dos pendientes. La respuesta inicial duplicó dos palabras de frontera entre citas consecutivas por el redondeo de fotogramas. Se reprodujo ese fallo, se corrigió la asignación de palabras por fotograma y se probó en `test:build-integrity`; en la copia de ensayo se corrigieron las dos citas sin cambiar IDs ni intervalos. El reintento no volvió a llamar al planificador.

### Generación, cancelación y visual

La primera escena se generó de verdad con código nuevo de Animation y el perfil guardado. Hubo dos llamadas de herramienta de código: la primera fue rechazada por metadatos inválidos y la segunda produjo un módulo válido. Métricas de esa escena:

| Etapa | Tiempo |
| --- | ---: |
| Generación/dirección del código (2 intentos) | 152,952 ms |
| Validación y compilación | 80 ms |
| Primer render PNG | 14,353 ms |
| Total registrado para esa generación | 167,421 ms |

El servidor después mostró progreso `Reconnecting…` y agotó sus intentos. Los slots 2 y 3 quedaron con el mismo ID e intervalo, pendientes de reintento; no se sustituyeron por otra categoría. Se canceló y se continuó la cola: el primer Visual permaneció aplicado y no se volvió a planificar. El siguiente intento de generación volvió a terminar con `ANIMATION_CODEX_RECONNECT_EXHAUSTED`. No se ocultó el error.

MP4 de la escena disponible: [animation-2bba1af9d98a57a90484.mp4](<C:/graphify/_worktrees/cipher-fase4-animation-canvas/cipher-studio/proyectos/fase-4-ensayo-visuales-20s-20261009-1791524858480/materiales/visual/animation-2bba1af9d98a57a90484.mp4>). Es un fragmento de 7.2667 s, 218 fotogramas, H.264, 1080 × 1920, 30 fps, sin audio; no es el video final de 20 s. Se revisaron visualmente muestras temporales del MP4: la cita solar, el panel, el trazo de conexión y la comparación de producción/uso entran progresivamente, mantienen jerarquía móvil y no presentan errores de dibujo. Esa revisión cubre solo esta escena.

### Medición A/B del render

Se reprodujo el mismo borrador guardado, código, plan, recursos, 218 fotogramas y ajustes de FFmpeg. La repetición no llamó al modelo. El primer render usa PNG/base64; la comparación usa RGBA leído del Canvas. Antes de obtener el RGBA completo, `capturePage` se probó y reprodujo una limitación de la ventana oculta en este escritorio (1080 × 1032, recortado frente al Canvas de 1080 × 1920). Esa ruta se descartó; el cambio final lee el búfer del Canvas, comprueba sus 8,294,400 bytes y se lo entrega a FFmpeg como `rgba`.

| Métrica | PNG/base64 | Canvas RGBA |
| --- | ---: | ---: |
| Render total | 14,353 ms | 7,552 ms |
| Captura/transferencia de fotogramas | 13,365 ms | 6,029 ms |
| Ejecución de `renderAt` | 392 ms | 672 ms |
| Espera por backpressure del encoder | 224 ms | 309 ms |
| Duración del encoder (se solapa con captura) | 14,198 ms | 7,408 ms |
| Archivo H.264 | 479,819 bytes | 470,254 bytes |

La variante RGBA redujo el render de esta escena un 47.4 % y la métrica de captura un 54.9 %. La comparación de los MP4 completos dio PSNR promedio de 49.45 dB; las hojas de contacto en los mismos cuatro tiempos se ven iguales. Es una medición de una escena y un equipo, no una promesa para otros videos ni el tiempo total de Construir. No incluye planificación, llamadas de Codex ni generación del código. La generación real de esta escena duró 167.421 s contando esos pasos; no respalda una promesa de cuatro minutos.

### Guardado y exportación

Se reabrió el proyecto y se conservaron el plan, el estilo y la escena aplicada. La exportación se detuvo en la comprobación previa con el mensaje de que había medios pendientes; no se creó un MP4 final. Por tanto, no se verificaron audio, continuidad visual de los 20 s, gráficos, transiciones ni exportación completa.

## Verificaciones automatizadas

- `npm ci`: correcto; no se instaló ni fijó una dependencia nueva.
- `npm run build`: correcto en TypeScript, renderer, main y preload.
- `npm run test:animation-chat`: correcto, incluido el contrato nuevo de captura RGBA completa.
- `npm run test:animation-chat-bundle`, `test:animation-build-queue`, `test:animation-panel-flow`, `test:build-integrity` y `test:build-graphics`: correctos.
- `CIPHER_TEST_HEADLESS=1 npm test`: **18 de 18 suites registradas, verdes**. El ejecutor mantiene la exclusión preexistente de `test:ventana` porque su prueba documenta un fallo ya conocido; no se añadieron exclusiones. Las suites de motores heredados continúan preservadas/inactivas como antes.

En esta sesión las pruebas con fixtures necesitaron ejecutarse fuera del sandbox de `os.tmpdir`: el sandbox denegaba `realpath` al directorio temporal. En el entorno normal de Windows, `npm test` completó el conjunto entero.

## Pendiente y límites

- Completar las escenas 2 y 3 del ensayo cuando el servidor Codex deje de agotar sus reconexiones; revisar el MP4 de 20 s y completar una exportación real.
- La creación del estilo a partir de referencias y su persistencia son reales. También se envió una instrucción real de chat dirigida al Visual seleccionado; Codex terminó con `ANIMATION_CODEX_RECONNECT_EXHAUSTED:2/2`, sin crear ni aplicar un borrador parcial. El historial anterior del panel conserva errores `ANIMATION_TOOLS_SERVER_UNAVAILABLE:not-registered`. La edición completada de una escena, los cambios globales y su recuperación visual quedan pendientes de una sesión estable del servidor; los contratos y el código de la biblioteca sí están cubiertos por tests.
- No se ensayó con proveedores remotos reales una mezcla Stock/IA/Visuales en paralelo. La coordinación y sus protecciones pasan pruebas controladas; no es aceptación de rendimiento bajo carga.
- Los tests simulados de colocación/exclusión de Gráficos pasan. El ensayo usa 100 % Visuales, por lo que no aporta escenas Original/Stock elegibles; la llamada real de Gráficos de fase 2 sigue pendiente.
- Sigue pendiente la aceptación visual completa de fase 1. La revisión de esta fase cubre un solo fragmento nuevo y no sustituye esa aceptación.
- El A/B solo caracteriza una escena vertical en este equipo. Resoluciones horizontales, escalas DPI distintas, escenas complejas y cargas largas requieren medición adicional.

## Fases posteriores

Fase 5: Vibes. Fase 6: Estilos ampliados. Fase 7: limpieza e integración final. Esta entrega no las implementa.
