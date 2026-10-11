# 1D-A — Búsqueda Stock verificable y selección pertinente

## Base y alcance

- Repositorio: `seon4200/cipher-studio`.
- Worktree: `C:\graphify\_worktrees\cipher-1d-a-stock-20261010`.
- Rama: `work/reinicio-1d-a-stock-20261010`.
- Base: `ea4a42813dae1c9fe23c2a27a3720714cfd8fe52` (cierre publicado de 1C-B).
- `CLAUDE.md` y los informes de 1C-A, 1C-B y 1B se revisaron antes de editar. No existe mapa Graphify específico en este worktree; se inspeccionó el código directamente.
- Se editó únicamente este worktree nuevo. No se abrió ni modificó `aaa`, sus 28 clips, los worktrees de 1B/1C-B, perfiles SIWC, `.env` ni `dist/index.html`.
- No se incorporaron proveedores nuevos, NASA, Wikimedia, motores visuales, Vibes ni Canvas.

## Qué demostraba la auditoría histórica

La auditoría de `aaa` quedó registrada en `docs/reinicio-1c-b-siwc.md`. Sus observaciones fueron:

| Escena | Consulta guardada | Resultado que se observó en el montaje anterior |
|---|---|---|
| S01 | `person standing at crossroads` | `pixabay:345244`, martín pescador sobre una rama. |
| S06 | `talented young woman receiving an award` | `pixabay:275498`, mujer patinando; la dirección había añadido mujer y premio. |
| S11 | `person looking into a mirror` | `pixabay:32443`, placa electrónica en primer plano. |
| S21 | `athlete pushing through a steep uphill run` | `pixabay:215946`, corredora en parque llano; el recorte central 9:16 perdía a la persona. |
| S23 | `person closing a book and standing up` | `pixabay:43459`, repetido desde S19; la persona seguía sentada. |

Esos resultados son observaciones del montaje viejo, no respuestas históricas de la API. El registro de entonces no guardó resultados alternativos, etiquetas, títulos ni orden de la respuesta. No se reconstruyeron.

La inspección del código base encontró la causa mecánica que puede producir selecciones así: `providers.ts` enviaba una sola `keyword` por escena, reunía hasta tres resultados por proveedor y ordenaba todos los candidatos primero por orientación y después por ancho. No puntuaba la relación con el guion ni revisaba etiquetas. El runner procesa cada escena secuencialmente y entrega el resultado a esa misma escena; no apareció evidencia de asociación cruzada entre escenas. `encodeURIComponent` ya codificaba la búsqueda correctamente. La caché existente guardaba el archivo de vídeo descargado por `proveedor:id`, pero no la respuesta de búsqueda ni evitaba que dos escenas eligieran el mismo ID.

La causa exacta de cada resultado histórico no se puede asignar entre consulta de dirección, resultados que Pixabay devolvió y elección de Cipher: faltan las respuestas originales de API. Sí queda demostrado en el código que, si esos candidatos estaban entre los resultados, la ausencia de evaluación semántica y el desempate por orientación/resolución permitían que uno técnicamente grande desplazara a otro más pertinente.

## Ensayo nuevo de Pixabay

La ronda ya había comenzado al llegar la instrucción de respetar el máximo de diez. Se conservó esa ronda y no se hizo una segunda. Se ejecutaron exactamente diez solicitudes de búsqueda reales, secuenciales: dos consultas por cada escena; página 1 y tres resultados máximos por respuesta. Los parámetros fueron `lang=en`, `video_type=all`, `order=popular`, `page=1`, `per_page=3`, `safesearch=true`. Todas respondieron HTTP 200 y devolvieron tres candidatos: 30 candidatos en total. La cabecera pasó de 99 a 90 solicitudes restantes; no hubo 429 ni error de conexión. El límite de la cuenta y la ventana se toman de las cabeceras de Pixabay, no se infieren del catálogo de resultados. Pixabay documenta el límite general y la obligación de almacenar en caché las respuestas de API durante 24 horas en su [documentación oficial](https://pixabay.com/api/docs/).

El ensayo se hizo con un harness local y la configuración Pixabay autorizada. No se inició Cipher, no se llamó a SIWC/DeepSeek y no se pidió al director una respuesta nueva. La intención visual breve de la tabla se redactó manualmente desde cada frase para guiar esta comparación; las diez consultas nuevas también son entradas de ensayo, no propuestas atribuidas al modelo. Las consultas históricas proceden del informe 1C-B.

| ID | Fragmento | Intención resumida manualmente para el ensayo | Consulta nueva 1 → elección anterior por resolución | Consulta nueva 2 → elección anterior por resolución | Evaluación local 1D |
|---|---|---|---|---|---|
| S01 | «Dices que tienes potencial» | Afirmación de potencial propio; el guion no nombra actividad ni lugar. | `personal growth` → 44639 (3840×2160; éxito/crecimiento/persona). | `self confidence` → 149944 (1080×1920; solo chakras, yoga, meditación y autoconocimiento). | Pendiente: las etiquetas no demuestran qué imagen expresa potencial. |
| S06 | «Mejumi lo tiene todo, talento, potencial y reconocimiento» | Talento y reconocimiento descritos por el guion, sin premio o género especificados. | `skill performance` → 270163 (animación de espadas, combate y fantasía; IA generada). | `achievement recognition` → 158549 (robot con etiquetas de reconocimiento facial/voz), con alternativas de pulgares animados. | Pendiente: la dirección no sostiene el contenido concreto de los resultados. |
| S11 | «Te lo dices aquí misma para poder sentirte cómoda» | Autodiálogo referido por la frase. | `self talk` → 149944 (chakras); el candidato 180 describe conversación entre colegas y se rechaza. | `person speaking alone` → 43633 (etiquetas persona/sola, sin habla). | Pendiente: metadatos insuficientes; además, el poster de 43633 y el recorte central dejan fuera el rostro. |
| S21 | «llevarse al límite una y otra vez» | Repetición y esfuerzo, sin género o tipo de ejercicio especificados. | `repeated effort` → 18941 (araña y hormigas) por orientación/resolución. | `intense training` → 293085 (mujer haciendo cardio y entrenamiento en casa; etiquetas de intensidad/entrenamiento). | Apoyo de metadatos para 293085; requiere revisión visual antes de aceptación editorial. |
| S23 | «dejes de sentirte cómoda pensando en lo que podrías llegar a ser» | Pensar en el futuro posible, sin libro u otra acción indicada. | `thinking about the future` → 118214 (cabeza abstracta y cuadrícula futurista). | `working toward goals` → 356398 (cascada; sus etiquetas incluyen naturaleza y una mención aislada a “goal”). | Pendiente: no elegir cascada por ser 3840×2160; no hay metadatos que sostengan una acción de avance. |

La elección de la tabla es la simulación del selector anterior dentro de cada consulta del ensayo; no afirma que se reproduzca la llamada histórica ni combina consultas distintas como si fueran una sola respuesta. Las respuestas nuevas son evidencia nueva.

Los IDs `pixabay:149944` y `pixabay:49038` aparecieron dos veces entre escenas distintas, demostrando que Pixabay puede devolver candidatos repetidos. La evaluación local de las 30 respuestas aplicó las mismas funciones nuevas de selección que se probaron; dejó S01, S06, S11 y S23 pendientes y respaldó por metadatos S21 con `pixabay:293085`. El filtro es deliberadamente conservador: un resultado con metadatos coincidentes no queda declarado visualmente validado.

No se descargaron vídeos para construcción ni se editó el montaje de `aaa`. Se obtuvieron posters de nueve candidatos y se generaron recortes centrales simulados 9:16 para una comparación local. Son imágenes de previsualización, no fotogramas temporales del vídeo completo. Por ejemplo:

- `pixabay:356398`: el poster y el recorte muestran una cascada; no existe sujeto humano que el recorte pueda conservar.
- `pixabay:43633`: el recorte mantiene pelo y hombro en un borde, pero deja el rostro fuera.
- `pixabay:293085`: conserva a la persona haciendo ejercicio en el encuadre vertical; la escena aún necesita confirmar reproducción y pertinencia completa.
- `pixabay:118214`: el recorte conserva la cabeza abstracta, no convierte la pieza en una toma de una persona.

La comparación completa con metadatos, decisiones y pares de poster/recorte está en [comparison.html](C:/Users/John%20Benites/OneDrive/Documents/ChatGPT/Cipher%20%E2%80%94%20Reinicio/evidence/cipher-1d-a-stock-20261010/comparison.html). El registro sanitizado de las 10 consultas y 30 candidatos está en [evidence.json](C:/Users/John%20Benites/OneDrive/Documents/ChatGPT/Cipher%20%E2%80%94%20Reinicio/evidence/cipher-1d-a-stock-20261010/evidence.json). Ambos están fuera del repositorio. No contienen la clave, cabeceras de autorización ni URLs de descarga. Las imágenes son posters y recortes; el archivo de vídeo no se solicitó.

## Cambios de 1D-A

- `DirectorDecision` separa `visualIntent` de `searchQueries`, admite como máximo dos consultas de hasta 100 caracteres y conserva `keyword` como alias de la primera para planes existentes. El validador rechaza intención ausente, consultas vacías/duplicadas/excesivas y un alias contradictorio.
- Los prompts SIWC y DeepSeek ahora piden intención en el idioma del guion y de una a dos consultas breves en inglés que no inventen personas, acciones u objetos. Cipher sigue controlando IDs, categorías, duración, rutas y ejecución.
- `providers.ts` guarda por escena, intento, proveedor y consulta los parámetros no sensibles, fechas, estado, total de resultados, conteo y metadatos disponibles de cada candidato (ID, etiquetas, dimensiones, duración, tipo, contadores públicos, orden de respuesta y orden de evaluación). Persiste aceptación por metadatos, rechazo, duplicado, candidato elegido y motivo. No persiste URL de descarga ni credenciales.
- La búsqueda Pixabay ahora fija explícitamente página, idioma, orden, tipo, seguridad y tres elementos por página; codifica `q` con `encodeURIComponent`. Corrige la elección de rendition: si el `large.url` viene vacío, usa el primer `medium/small/tiny` con URL.
- Se añadió caché local de resultados Pixabay con vencimiento de 24 horas, separada por hash de proveedor, consulta y parámetros. La clave no forma parte de la ruta ni del archivo. Solo se guarda una URL de descarga para uso local si es HTTPS de un subdominio Pixabay y no contiene usuario, contraseña ni query string; la evidencia del plan nunca la guarda. Los demás proveedores continúan disponibles con su autenticación y endpoints existentes.
- Se consultan las alternativas secuencialmente. Si la primera ya ofrece un candidato con metadatos suficientes, sin repetición ni rechazo anterior, la búsqueda se detiene y no envía la segunda.
- El selector evalúa primero etiquetas/título; orientación y tamaño solo desempatan candidatos con igual pertinencia. Rechaza contradicciones claras (persona/animal, espejo/electrónica, auto-diálogo/grupo) y deja en revisión lo abstracto, débil, generado por IA o sin metadatos. La selección se declara “respaldada por metadatos”, nunca “validada visualmente”.
- Los IDs elegidos antes en el mismo plan se excluyen. La recuperación conserva los registros anteriores y no repite la búsqueda de escenas marcadas en revisión; Stock permanece Stock y no se reemplaza silenciosamente por Original. El panel muestra el estado de revisión y los IDs disponibles.
- Original, clips de 2–3 s, recortes, mezcla por tiempo, audio principal, cancelación y recuperación no cambiaron. Las pruebas de recuperación verifican que las escenas originales y la construcción sin Stock sigan funcionando.

## Verificación

El worktree no tenía `node_modules`. `npm ci --ignore-scripts --no-audit --no-fund` restauró las versiones ya fijadas en `package-lock.json`; no se cambió ninguna dependencia ni manifiesto de versión.

- `npx tsc --noEmit`: aprobado.
- `npm run test:stock-selection`: 4/4 aprobadas.
- `npm run test:director-contract`: 8/8 aprobadas.
- `npm run test:director-siwc`: 9/9 aprobadas.
- `npm run test:build-recovery`: 17/17 aprobadas, incluidas caché, ausencia de URL/key en evidencia, fallback de rendition, bloqueo por ambigüedad, prevención de duplicados y persistencia/reapertura.
- Build Vite/Electron temporal: renderer, main y preload se compilaron en `C:\Users\John Benites\AppData\Local\Temp\cipher-1d-a-build-20261010-427f6b34-corrected`. El primer intento tuvo una cadena de ruta temporal mal escapada: dejó la salida renderer bajo su carpeta de fuente y escribió sobre cuatro artefactos rastreados en `src/renderer/dist-electron`. Se eliminó la carpeta renderer accidental y los cuatro archivos rastreados se restauraron exactamente desde el HEAD base; la rama no conserva diferencias en ellos. La segunda build, con ruta temporal en formato `/`, terminó correctamente. `dist/index.html` conservó SHA-256 `1D7A675E01AA3B60A22034BE181AD10C28133D6CEE7D0C19133FE09BFB79D860` antes y después.
- Las búsquedas reales de la ronda fueron las diez ya documentadas; las pruebas de caché posteriores sustituyeron `fetch` y no hicieron llamadas externas.
- No se compiló sobre `dist`, no se ejecutó una construcción de vídeo ni se abrió la interfaz para regenerar un montaje.

## Criterios y pendientes

| Criterio | Estado |
|---|---|
| Rastreo del flujo actual de query, proveedores, ordenación, asociación escena/resultado y caché | Comprobado por código. |
| Respuestas reales nuevas de Pixabay para S01, S06, S11, S21 y S23; 10 consultas, 30 candidatos, parámetros y estados HTTP | Comprobado en la ronda de prueba; no es reconstrucción histórica. |
| Registro de candidatos y motivo, caché Pixabay de 24 h y reanudación del mismo plan | Cubierto por pruebas aisladas; la interfaz no ejecutó una construcción nueva. |
| No ordenar principalmente por resolución, rechazo de contradicciones, revisión cuando faltan metadatos y exclusión de IDs usados | Cubierto por pruebas focalizadas y simulación de los candidatos nuevos. |
| Selección editorial correcta de las cinco escenas | Pendiente: cuatro requieren revisión; el único caso con metadatos fuertes también necesita inspección de vídeo. |
| Validación visual del clip completo, duración, contenido en movimiento, adaptación/crop que conserve al sujeto a lo largo de 9:16 | Pendiente para etapa visual siguiente; los posters/crops centrales no prueban el vídeo. |
| Calidad editorial del montaje auditado de `aaa` | Sin cambios ni regeneración; queda preservado para comparación. |
| Otros proveedores en ejecución real | Sin nueva consulta en esta entrega. Los adaptadores existentes permanecen, pero el ensayo se acotó a Pixabay. |
| Clips 2–3 s, mezcla por tiempo, audio intacto y recuperación/no duplicados | No se modificaron; recuperación cubierta por su suite focalizada. |

La limitación principal que queda demostrada es que el texto y las etiquetas de Stock no bastan para escoger con seguridad todas las metáforas del guion. En esos casos, Cipher ahora se detiene y conserva candidatos para revisión en lugar de construir con el primero de alta resolución. La validación de pertinencia en movimiento y el encuadre consciente del sujeto requieren la entrega visual siguiente. Esta entrega no declara resuelta la calidad visual de Stock.

## Cierre 1D-A: evidencia y estado de aceptación

La evidencia y la galería se conservaron fuera de `Temp`, en `C:\Users\John Benites\OneDrive\Documents\ChatGPT\Cipher — Reinicio\evidence\cipher-1d-a-stock-20261010`. Contiene el registro sanitizado de 10 búsquedas/30 candidatos, `comparison.html`, 18 posters y recortes centrales 9:16, y un manifiesto SHA-256. Se revisaron el JSON y HTML contra patrones de claves y cabeceras de autorización antes de copiarlos; no se copiaron scripts ni builds temporales. No contiene vídeo descargado.

### Mejoras técnicas verificadas

- La intención editorial y las consultas quedaron separadas y validadas; los adaptadores SIWC y DeepSeek usan el contrato actualizado.
- El código registra consultas, candidatos, orden, metadatos y motivos de aceptación/rechazo por escena, sin URLs de descarga ni secretos en la evidencia.
- La búsqueda secuencial tiene límites explícitos; Pixabay usa caché de 24 horas y la selección evita IDs ya usados en el plan.
- Contradicciones evidentes se rechazan; metadatos débiles o ambiguos dejan la escena en revisión. Continuar conserva resultados terminados y no sustituye Stock silenciosamente por Original.
- TypeScript, las suites de selección, contrato, SIWC y recuperación, y el build temporal se aprobaron según los resultados registrados arriba. No se repitieron búsquedas para cerrar esta documentación.

### Calidad visual aún pendiente

La ronda real confirmó respuestas HTTP y metadatos, y las vistas previas permitieron observar posters y recortes simulados. No se descargaron ni reprodujeron los vídeos candidatos en Cipher; por tanto, ni la correspondencia editorial en movimiento ni el encuadre durante el clip quedan aprobados. S21 tiene apoyo de metadatos, no validación visual. S01, S06, S11 y S23 siguen sin evidencia suficiente para aceptar un candidato. La comparación no reconstruye las respuestas históricas de Pixabay.

### Registro para 1D-B (pendiente; no implementado aquí)

1. Solicitar propuestas visuales concretas ligadas a palabras o acciones del guion y permitir metáforas solo cuando la propuesta explique qué elemento del guion las justifica. Mostrar la propuesta y su justificación antes de aceptar; no inventar sujetos o acciones.
2. Comparar visualmente candidatos lado a lado con poster y vista temporal disponible, guion/intención, consulta, metadatos y motivo de mantener o rechazar. Distinguir revisión humana de evaluación por etiquetas.
3. Elegir el intervalo fuente que mejor contiene la acción y producir clips de entre 2 y 3 segundos inclusive; conservar la regla de duración al reencuadrar.
4. Adaptar a 9:16 con escalado proporcional y recorte, procurando conservar el sujeto a lo largo del fragmento; señalar recortes dudosos para revisión y no deformar.
5. Reanudar por escenas pendientes: mantener IDs, archivos, hashes y estado de las escenas ya terminadas; reconstruir solo las escenas pendientes, sin duplicados ni sustitución Stock→Original.

1D-B queda como trabajo futuro. No se modificó `aaa`, no se repitieron llamadas reales a Pixabay en esta fase de cierre, y el montaje auditado no se regeneró.