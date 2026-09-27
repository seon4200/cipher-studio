# Visuales: comprensión y decisión conjunta — implementación parcial

## Estado y alcance

Continuación de `651d021e689f1c4d50493d3dd0bc069a36a5d2df`, en
`v15-editorial-decision-coherence-v1`. El checkpoint y su etiqueta permanecen intactos.
No se añade otro motor, perfil visible, familia ni recurso. Sólo cambia la decisión
de Visuales nuevos en la ruta ordinaria V4. Stock, Gráficos, transiciones y sus
controles no se modifican. No se migran SceneSpecs guardados.

**productFlow = PARTIAL.** Hay implementación, contratos, renders dirigidos,
handler controlado y replay offline comprobados. No hay evidencia nueva suficiente
para afirmar que la selección real mejoró en los dos videos completos. DeepSeek y
el recorrido UI quedaron bloqueados; se detallan abajo. Una escena dirigida no los sustituye.

## Causas comprobadas → cambios

| Causa en el checkpoint | Cambio dentro de la ruta actual |
|---|---|
| `validateEditorialCandidateDecision` exigía extractos literales contiguos: podían ser fieles como cadena, pero perder crítica o atribución | `validateEditorialMeaningV2` separa cita fuente, proposición, marco, titular y secundaria. Admite paráfrasis; rechaza pérdida detectable de alcance y cantidades. Se conserva el validador antiguo para compatibilidad |
| Contexto V4 podía limitarse a la misma frase | `generate-timeline-assets` entrega frases vecinas acotadas con referencia de origen; el intervalo efectivo y sus tokens siguen separados |
| La familia se volvía a escoger por expresiones regulares después de seleccionar assets | La respuesta conjunta incluye una dirección tipada, con familia elegible, variante, entrada, fondo y relaciones entre IDs ofrecidos |
| Reducción posterior podía sustituir el texto decidido | El handler pasa titular y secundaria validados al binder, sin volver a elegir la primera palabra |
| La misma palabra entre Hero/Support provocaba descarte silencioso | La revisión interna nueva respeta los IDs validados; un participante del mismo concepto puede tener sentido, sin cuota obligatoria |
| Relaciones derivadas de una etiqueta general no identificaban los extremos justificados | Grafo explícito entre recursos elegidos, cita y motivo, enum semántico separado de representación; rutas bloqueadas se omiten con ajuste persistido |
| El resumen de omisión no distinguía suficientemente una shortlist vacía | `RETRIEVAL_INSUFFICIENT` no significa hueco de catálogo. Se separan rechazo contextual, composición no elegible, decisión inválida y tipografía deliberada |
| Entradas de apoyos tardías dejaban poco tiempo estable | En planes nuevos se adelantan apoyos de forma escalonada y se limita el trazado antes de lectura. No se altera timing de planes históricos |

`editorial-scene-input.ts` ya corregía el reloj de ventanas/slots y se reutiliza,
sin crear otro segmentador. La nueva prueba de intervalos también registra la
diferencia entre duración semántica y duración MP4 cuantizada al frame.

## Ruta efectiva y procedencia de decisiones

```text
UI existente / Construir Timeline IA
  → generate-timeline-assets (src/main/index.ts)
  → reparto y planificación existentes (sin cambios de Stock/Gráficos)
  → intervalo Visual efectivo + contexto vecino identificado
  → decideEditorialScene
      1. DeepSeek: cita → proposición / marco / texto / conceptos
      2. catálogo: shortlist por rol, metadata ponderada
      3. DeepSeek: recursos + distribución + relaciones conjuntamente
      4. validadores: IDs, roles, marco, presupuesto, compatibilidad, enums
  → selectEditorialLocalBankV4Detailed: capas compatibles, registro de omisiones
  → publish: ProjectAssets con ID/SHA
  → bindEditorialLocalBankV2: geometrías y rutas en ambas orientaciones
  → VisualSceneSpecV2 + RenderBindings + PixelIdentity
  → MotionGraphicV15 / compositor editorial existente / captura y MP4
```

La regeneración no recorre el selector ni llama a DeepSeek. Usa las decisiones y
ProjectAssets guardados. La revisión de planificación
`editorial-scene-decision-2026-09-v2` es interna del mismo perfil V4; no es una
opción nueva de UI. V1–V3 y V4 sin esa dirección mantienen sus ramas históricas.

### Qué aporta cada parte

- Modelo: idea, texto, pertinencia propuesta, recursos ofrecidos, familia y
  representación narrativa. Sólo recibe metadata textual, no ve los PNG.
- Recuperación: conceptos/proposición contra palabra, aliases, descripción,
  familia semántica y relaciones compatibles. Presupuestos separados: hasta
  12 Heroes y 12 Supports. Índice reutilizado por instancia de catálogo.
- Código: existencia, SHA/rol, incompatibilidades declaradas, elegibilidad,
  rutas, bounds, contraste/Text Fit y materialización. Las capas siguen siendo
  resueltas por reglas de metadata y permisos, no por nombres pronunciados.
- Binder: geometría por formato, fuente Fraunces/DM Sans/IBM Plex ya empaquetadas,
  entrada y escalonado, color resuelto, ruta y representación, partículas existentes.
- Continuidad: familias recientes se ofrecen al modelo como preferencia subordinada
  a pertinencia. No es todavía un planificador narrativo de video largo.

## Prompt y contrato efectivos

Los textos literales de los prompts están en
`src/main/assets/editorial-scene-selection.ts`:
`editorialMeaningPromptV2` y `editorialSceneChoicePromptV2`.
El prompt antiguo permanece exportado, pero **no es el que usa ahora el handler V4**.

```ts
// Etapa de comprensión (máximo dos intentos)
{ sourceQuote, proposition, headline, secondary,
  framing: 'assertion'|'negation'|'question'|'attribution'|
           'condition'|'uncertainty'|'critique',
  concepts: string[], intent: 'object'|'components'|'relation'|'process'|'statement', reason }

// Etapa conjunta (máximo dos intentos, incluida recuperación adicional)
{ mode: 'asset'|'typographic', heroId: string|null, supportIds: string[],
  reason, evidence: [{assetId, quote, reason}], rejected: [{assetId, reason}],
  omission: null|'deliberate-typography'|'no-suitable-material'|'contextual-rejection',
  additionalTerms: string[],
  direction: { revision, intent, family, variant, entry, background,
    relations: [{fromId, toId, relation, quote, reason}], reason } }
```

Se ofrecen sólo seis distribuciones conectadas: `editorial`, `marcoPoster`,
`partidoVertical`, `cuaderno`, `constelacion`, `cascada`. No se anuncian las otras
once por el hecho de existir en una demo. `cascada` requiere intención de proceso
y dos apoyos; no prueba causalidad. Cero o un apoyo son válidos en familias elegibles.
Sin Hero, el binder actual sólo admite tipografía sin Supports: se declara esa limitación.

Mapeo explícito de relación → significado dibujado:
`conecta→connects`, `contrasta→compares`, `informa→informs`,
`causa→causes`, `transfiere→transfers`.
`observa` y `secuencia` no se transforman en `connects`. Una relación permitida
también debe tener cita, extremos seleccionados y evidencia verbal pertinente.
Las comprobaciones lingüísticas son conservadoras; no demuestran implicación
semántica completa ni sustituyen revisión humana.

### Ejemplos comprobados, NO respuestas reales de DeepSeek

- Fixture de contrato: fuente «El error es creer que el potencial es suficiente
  para progresar». Se admite «El potencial no basta» como crítica y se rechazan
  «El potencial es suficiente» y «El potencial basta» usados como afirmación visible.
- Fixture de capacidad: instrumento que registra datos, Hero con un apoyo DATOS
  y relación `informa`. Se dibuja flecha en ambos formatos; cambiarla a `causa`
  en SceneSpec sin autorización falla. Quitar `relationDecision` también falla.
- Fixture de omisión: tipografía deliberada queda sin Hero ni conexiones.
  Shortlist vacía con falta de material se registra como recuperación insuficiente.

No hay ejemplo nuevo de respuesta real válida: las solicitudes de esta sesión
fallaron antes de obtener respuesta. No se publican prompts de proyectos privados en Git.

## Propuesta, ajustes y escena persistida

Se guardan intervalo, texto local, contexto/referencia, cita, proposición, marco,
titular y secundaria, revisión y dirección. Diagnósticos externos por clip
conservan prompts, respuestas/intentos fallidos, candidatos, scores, evidencias,
rechazos, latencia, elección y fallback. Nunca se incluye la clave API.

Las modificaciones posteriores se registran en `planning.adjustments`:

- fondo procedural sustituido por papel del catálogo compatible;
- relación omitida por geometría o por presupuesto de lectura;
- decisión de recursos no disponible, conservando comprensión ya validada.

El selector registra aparte cada capa: fondo neutro autorizado, acento permitido,
rear sin afinidad/continuidad y front sin pareja de oclusión certificada. No inventa
permisos ni rellena front por defecto. El alpha se usa para extremos del Hero;
las cajas/rutas son aproximaciones geométricas, no máscaras focales semánticas precisas.

## Diferencia con las muestras dirigidas

Inspección enfocada de los arneses existentes:

- `editorial-modular-families-v1/generar.cjs`: familia y assets del corpus;
  variante por índice y entrada por índice módulo cuatro; titular preparado.
- `editorial-finish-v1-1/generar.cjs`: mismos ingredientes dirigidos; acabado y
  entrada elegidos por familia.
- `editorial-local-bank-v2/generar.cjs`: familia, texto e IDs del corpus; variante
  por formato. Demuestra 17 geometrías, no selección automática de las 17.

Esta continuación lleva parte de esas decisiones al contrato ordinario, sin
copiar los IDs ni convertir asociaciones de las muestras en reglas universales.
Los renders de capacidad de esta entrega siguen siendo **dirigidos**, no prueba
de que la selección automática alcance su aspecto.

## Verificación y limitaciones del cierre

Evidencia local: `C:\graphify\_cipher-decision-coherence-20260927`.
El informe privado de esa carpeta precisa estados, hashes, comandos, casos y archivos.

- TypeScript y build: comprobados sobre bundle actualizado; renderer/main/preload presentes.
- 16 contratos nuevos y 13 comprobaciones conservadas: PASS, ejecutados sobre funciones del bundle,
  no copias de su implementación. Se verifica catálogo activo 390/390, sin constantes
  productivas que impongan ese total.
- Handler ordinario con semántica simulada: Hero sin apoyos y fallback tipográfico;
  MP4 presente, guardado, reapertura, replay y exportación. No equivale a UI real.
- Capacidad Hero + un apoyo + relación explícita: dos orientaciones, frames de
  entrada/lectura/salida; QC sin findings en esa escena. No certifica todas las familias.
- Replay: tres caches/proyectos independientes por formato, igualdad de decisiones
  y SHA MP4 dentro de cada formato, cero solicitudes de red y cero accesos al catálogo.
- V3: identidad y todos los fotogramas decodificados idénticos. Una última ejecución
  usó otra versión de FFmpeg por PATH: cambió el contenedor/encoder, no los píxeles.
  No se cambió baseline ni tolerancia. No se afirma paridad MP4 binaria entre encoders.
- El runner global completo no se ejecutó en esta continuación.

Bloqueos: primer lote real (seis fragmentos + holdout) registró 14 errores de red
`fetch failed`, sin respuestas válidas. El intento de habilitar red fue denegado
por el entorno y pidió confirmación específica del envío. No se buscó un bypass.
La ventana temporal abrió, pero Windows estaba bloqueado; no se pulsó Construir.
No se completaron dos nuevos videos reales con audio ni reproducción perceptual
completa a velocidad normal. Los frames a 360 px sólo acreditan observación estática.

La revisión del arnés encontró además `duration` inexistente en clips guardados:
se corrigió a la duración del contexto de regeneración y se valida contra el
intervalo. Se conserva el lote fallido original; los casos corregidos están en
`cases-v2.json` y aún no tienen respuesta real. No presentar la latencia de esos
errores como rendimiento de DeepSeek.

## Pendientes concretos

1. Autorizar la salida de datos concreta y desbloquear la sesión Windows; ejecutar
   casos corregidos, sin ID esperado, conservar fallos y medir llamadas/latencia.
2. Comparar pertinencia, crítica/atribución, cifras/unidades y lectura con el audio.
   Los guardas actuales no cubren todas las paráfrasis ni todas las unidades posibles.
3. UI de copias temporales de ambos proyectos: generar decisiones nuevas, guardar,
   reabrir, regenerar sin modelo y exportar con audio. Conservar mezclas originales.
4. Revisión completa y A/B del mismo contenido, no sustituirla por esta escena dirigida.
5. Sólo entonces cuantificar huecos reales de catálogo. Por ahora están demostradas
   limitaciones de metadata/oclusión y del binder sin Hero, no una necesidad comprobada
   de producir más imágenes de temas concretos.

No se declara aprobación editorial. `technicalVerdict = PARTIAL`;
`visualVerdict = PENDING_HUMAN_REVIEW`.
