# Fase 3 — búsqueda y selección de Stock

## Base y alcance

La rama `work/fase3-stock-discovery-20261009` parte del cierre de fase 2
`f6eb635f9c85b6020a6bd872208348dd6eb2ad07`, publicado en
`work/fase2-openai-planificador-20261008`. No había correcciones posteriores de fase 2 en la
copia examinada. La implementación de Stock se extrajo del trabajador común y se usa tanto en la
primera materialización como en los reintentos del mismo espacio.

Se mantienen las cuatro cuotas, los IDs, los intervalos, la cancelación, los recibos, la recuperación
y el bloqueo de exportación incompleta. Un fallo Stock conserva `category: stock` y su plan; no pasa a
Original ni vuelve a distribuir porcentajes. Los clips ya terminados no se rehacen.

No se modifica Canvas, Vibes, Estilos ni los motores heredados. La aceptación visual de fase 1 sigue
pendiente. Las pruebas reales del planificador de Construir y Gráficos de fase 2 también siguen
pendientes; la comprobación de autenticación y la llamada de revisión visual Stock descritas aquí no
las sustituyen.

## Implementación

- `src/main/services/build-stock.ts` concentra búsqueda, evaluación, descarga, validación, recorte y
  diagnóstico. La consulta usa hasta tres términos de keyword, uno de la frase y uno del contexto;
  elimina palabras genéricas y limita la consulta a cinco términos para catálogos que combinan los
  términos de forma restrictiva.
- Pexels, Pixabay y Coverr se consultan solo con su clave configurada. Sus consultas y NASA corren en
  paralelo con límite tres, timeout por proveedor y error individual. NASA solo se consulta para una
  escena de dominio espacial/científico pertinente; sus consultas de assets se limitan a cinco
  candidatos y concurrencia dos. Sus enlaces `http` se aceptan únicamente en
  `images-assets.nasa.gov` y se elevan a HTTPS.
- Se conservan título, descripción, etiquetas, autor, licencia, dimensiones, duración e URL. El orden
  usa relevancia de metadatos antes que formato, con empates estables. Codex revisa hasta tres
  finalistas y tres fotogramas de cada uno mediante `referencePaths` del proveedor app-server
  existente. La revisión debe describir lo visible, no inferirlo de títulos o etiquetas. Un resultado
  inferior a 40/100 se descarta; si no queda candidato suficiente, el espacio continúa pendiente en
  Stock.
- La descarga se coordina por clave de proveedor e ID. Se escribe en temporal, se limita a 180 MiB y
  se valida con ffprobe antes de incorporarla a caché. Los recortes también pasan por temporal y
  validación antes de publicarse en el montaje. Clips corruptos, cortos, fallidos al extraer
  fotogramas o al recortar se descartan y se intenta el siguiente, hasta cinco.
- Las decisiones de `stockDecision` conservan consulta/contexto, métricas y errores de proveedor,
  candidatos y puntuaciones, descartes, motivo de elección, offset/filtro/validación de recorte,
  intentos y tiempos por etapa. Los reintentos leen decisiones persistidas del mismo `buildId`; si
  hay otra fuente no usada la prefieren, incluso después de reabrir el proyecto.
- `materializeBuildSlot` dirige tanto creación como reintento al servicio compartido. El resultado
  sigue usando el ID del espacio, el recibo de fase 1 y la comprobación de proyecto/versión vigente.
- `src/main/animation/codex-app-server-provider.cjs` ya no añade overrides MCP para servidores
  inexistentes. Una llamada real reveló que crear una sección vacía `cipher_animation` impedía iniciar
  app-server con `invalid transport`. Ahora solo se desactivan secciones MCP existentes en la
  configuración leída; no se edita la configuración ni se agrega autenticación.

## Verificación simulada

- `npm run test:build-stock`: aprobado. Casos cubiertos: consulta compacta/contextual, NASA omitida
  para fauna, proveedor lento con timeout, HTTP 503 individual, concurrencia máxima tres, candidato
  corrupto y candidato demasiado corto antes de uno válido, rechazo visual y selección del siguiente,
  descarga compartida, decisión guardada y reabierta sin repetir candidato, cuotas Stock 0 %/100 % y
  conservación de un slot fallido como Stock pendiente.
- Comparación pequeña y revisable de ranking: con los mismos dos candidatos de fixture, la base
  técnica elige `forest-4k` por resolución, mientras el ranking semántico elige `fox-relevant` por
  título/etiquetas que coinciden con “fox hunting in snow”. Es una comparación simulada, no una
  conclusión sobre calidad real de catálogo.
- La prueba de app-server comprueba que solo se enumeran los servidores MCP declarados; la lista
  vacía no genera una sección inválida.
- Dos espacios del mismo montaje en la misma sesión eligen fuentes distintas si hay alternativa; las
  reservas de candidatos no elegidos se liberan al terminar.
- `npm run build`: aprobado en TypeScript y bundles renderer, main y preload.
- `npm test`: **18/18 suites activas verdes**, incluidas `build-stock`, `build-integrity`, las seis
  suites Electron de persistencia/materiales/avisos/gráficos, y las suites de Animation. No se
  excluyeron suites activas ni se debilitaron comprobaciones. `test:ventana` conserva su exclusión
  previa documentada; los motores visuales desconectados siguen marcados como inactivos.

Los fallos de Stock y los retornos de proveedores del test enfocado son mocks. Esa suite no realiza
llamadas reales ni envía fotogramas a Codex.

## Búsqueda y revisión reales

El mismo `codexConnectionStatus()` de Studio encontró Codex CLI `0.160.1`,
`authenticated: true`, `status: ready-to-test`. Después se completó una llamada real con el servicio
app-server y fotogramas locales: modelo `gpt-6-luna`, una llamada, nueve fotogramas y 5.834 ms de
tiempo informado por el proveedor. Esto confirma que el transporte admite esa entrada de imagen;
autenticación por sí sola no se cuenta como llamada.

Comparación real pequeña contra la consulta base del commit de fase 2, que usa solo `keyword` y
selecciona por formato/resolución/duración con un pequeño desempate aleatorio:

| Consulta NASA | Resultados | Primer título devuelto | Tiempo HTTP observado |
| --- | ---: | --- | ---: |
| Base: `mars rover` | 5 | “Mars 2020 Perserverance Rover Post Landing Briefing” | 501 ms |
| Fase 3: `mars rover red landscape` | 3 | “Explore Mars' Jezero Crater with NASA’s Perseverance Rover” | 185 ms |

Son mediciones de una petición por consulta; no son una promesa de latencia. El recorrido final del
servicio ejecutó una búsqueda y tres consultas de assets NASA (cuatro llamadas, 602 ms en la etapa
de búsqueda/assets). Sin claves Pexels, Pixabay ni Coverr en el proceso de ensayo, esos proveedores
quedaron desactivados; la llamada real usó solo NASA.

En el ejemplo “un rover cruza el planeta rojo”, Codex revisó los tres candidatos NASA reales. Los
fotogramas mostraban panoramas de Marte, partes del rover en bordes o huellas, pero ninguno mostraba
el rover avanzando. La implementación final los dejó pendientes en Stock: puntuaciones 20, 18 y
12/100, todos bajo el mínimo 40; no escribió un MP4. Métricas de esa ejecución temporal:

| Etapa | Tiempo |
| --- | ---: |
| Consulta y assets NASA | 602 ms |
| Descarga y validación de candidatos | 51.631 ms |
| Revisión visual Codex, 9 fotogramas | 7.270 ms de etapa; 5.834 ms informados por el proveedor |
| Recorte | 0 ms; no se materializó candidato |
| Total | 59.507 ms |

Una primera pasada con `mars rover red planet` aceptó un video de rótulos/sonidos de Marte con
4/100; tras introducir un umbral de 30, otra consulta todavía aceptó un paisaje con 34/100. Esos
resultados llevaron a incluir contexto distintivo en la consulta, elevar el mínimo a 40 y pedir a
Codex que trate sujeto/acción como dominantes. La pasada final dejó los candidatos pendientes y no
escribió un archivo de salida. Búsqueda y revisión fueron reales; selección de una escena
suficientemente pertinente no se aprobó en este ejemplo.

## Pendiente y límites

- Pexels, Pixabay y Coverr no se probaron en vivo porque sus claves no estaban configuradas en el
  proceso temporal. Sus formatos/respuestas se cubren con fixtures.
- La búsqueda NASA no encontró video que mostrara la acción de rover solicitada; el slot queda
  recuperable y pendiente. No se declara calidad suficiente para todas las escenas ni para otros
  proveedores.
- No se ejecutó Animation, exportación ni aceptación visual de Studio. La verificación real de
  fase 3 terminó tras la búsqueda y selección; no acredita reproducción final del proyecto.
- Las llamadas reales de planificación Construir y Gráficos de fase 2 siguen pendientes, igual que
  la aceptación visual de fase 1. El login y esta llamada Stock no las sustituyen.
- La latencia real dominó en descargar y validar tres videos NASA (51,6 s); no se optimizó esa etapa
  ni se promete un tiempo total.

La fase 3 deja documentados estos límites para continuar después con la fase 4. No implementa
Canvas/Animation como generador exclusivo de Visuales, producción paralela, Vibes, Estilos ni
limpieza de motores heredados.
