# Ronda 4A — reparación de decisión semántica local V1

## Estado de esta evidencia

Esta especificación corresponde a la rama `semantic-decision-repair-v1`, nacida
de `ec255f0fe6b10502c260faa21e375256004f01ed`. No es un checkpoint, no mueve
ninguna etiqueta y no autoriza un merge: la hoja de contactos queda pendiente de
revisión humana de Jairo.

La ronda modifica la decisión que materializa una escena nueva. No modifica el
renderer, `hashGrafico`, `canonizar`, fondos, estructuras, movimiento, QC,
`VisualSceneSpecV1` ya materializado ni la salida de una misma `sceneSpec`.
`VERSION_PLANTILLAS` permanece en 12: una decisión distinta materializa una
`sceneSpec` distinta, que ya entra en la identidad visual y provoca otro hash.

## Hecho forense que corrige

La auditoría externa `audit-last-real-video-20260909` registró 34 Visuales
finales: 22 `editorial-text`, 6 Solar con `sceneSpec`, 6 Solar legacy y 0
OpenMoji visible. Se solicitaron 50 Visuales; 34 se materializaron y 16 fueron
sustituidos por original tras QC.

Seis escenas nuevas recibieron la frase global de 598 caracteres como
`AssetIntent.phrase`. El límite V1 de 480 la rechazó y el camino de generación
las devolvió a `graphicData` legacy. Esta ronda elimina ese retorno para escenas
nuevas: un input inválido se vuelve una `sceneSpec` editorial segura con aviso
trazable, nunca un Visual legacy.

## LocalSceneSemanticV1

`src/shared/local-scene-semantic.ts` define una unidad semántica limitada al
subclip:

- `sceneId`, `start`, `end`, `localText` y tokens con timestamps;
- conceptos, ancla y relación ya existentes;
- `globalText`, hints y referencia global sólo para diagnóstico.

El texto local se extrae de `transcriptSegments` en la ventana temporal real,
con contexto inmediato acotado, puntuación cercana y un máximo de 360 caracteres.
No se copia el párrafo entero al AssetIntent. La prioridad de decisión es:

1. tokens y conceptos que intersectan el intervalo exacto del subclip;
2. ancla o concepto asociado al tramo;
3. contexto inmediato;
4. conceptos vecinos;
5. contexto global diagnóstico.

La keyword ya emitida por la semántica del subclip tiene procedencia
`scene-semantic`, pero sólo desempata dentro del primer nivel si el transcript
temporizado confirma literalmente esa misma palabra dentro del intervalo. Así,
una palabra vecina de la misma cláusula no desplaza la palabra alineada al
subclip, ni una candidata global puede imponerse sobre evidencia temporal.

## Keyword y metáfora V2

`selectNarrativeKeywordV2` devuelve keyword, confianza, motivo y alternativas.
Prioriza objeto/entidad, concepto nominal defendible y acción visualizable; los
auxiliares, deícticos, adjetivos genéricos y tokens ASR de baja confianza no
ganan sólo por ser largos. Los sustantivos con `-ción`, `-sión` o `-ismo` pueden
seguir siendo conceptos editoriales; no se tratan automáticamente como residuos.

La resolución de metáfora usa reglas generales de categoría más evidencia
concreta ya disponible. Para una keyword local seleccionada, primero se reduce la
evidencia al sujeto de esa keyword. Sólo después se aplica este orden:

1. emoji exacto, con equivalencia de selectores Unicode de presentación;
2. label exacta;
3. ancla;
4. hint canónico;
5. keyword;
6. términos de metáfora.

Un evento/condición o contexto humano sin evidencia concreta propia no puede
tomar el icono de un concepto estructurado ajeno. Por ejemplo, `accidente` no
puede heredar `shield` sólo por un hint upstream, ni `indignación` una regla de
ancla de una cláusula vecina. En esos casos el resultado normal es
`editorial-text`, con razón explícita.

Las reglas incorporadas son categorías, no IDs de escenas forenses: balón de
fútbol, estadio, construcción, trabajador de construcción, cerveza, protesta y
bandera de México. OpenMoji sigue siendo local/offline; Solar se conserva para
abstracciones con glifo fuerte.

## Integración y fallback

En `generate-timeline-assets`, antes de hash y captura:

    transcriptSegments + intervalo del subclip
    → LocalSceneSemanticV1
    → keyword V2
    → resolveLocalSemanticVisualSceneV1
    → VisualSceneSpecV1 + RenderBindingsV1
    → hashGrafico / renderGraphicClip

`resolveLocalSemanticVisualSceneV1` construye el AssetIntent con `localText`.
Si el AssetIntent o el resolver falla, recompila por el mismo camino a
`editorial-text`, añade `RESOLVER_DEGRADED` y deja `inputFallback` trazable. Un
proyecto antiguo sin `sceneSpec` conserva su comportamiento legacy al abrirse;
esta ronda sólo afecta una generación o regeneración explícita.

## Traza productiva y QC

Cada generación con proyecto explícito escribe, de forma atómica, un diagnóstico
separado:

    materiales/diagnostics/visual-decisions/<generationId>.json

No es `project-state`, AssetManifest ni PixelIdentity. Contiene resumen de
`requestedVisuals`, `materializedVisuals`, `qcRejectedVisuals`,
`resolverDegradedVisuals`, `substitutedWithOriginal` y razones; por escena guarda
contexto local, keyword y alternativas, metáforas, candidatos/proveedores,
selección, tratamiento, estructura, fallback, avisos, referencia de identidad y
resultado de render.

Si el renderer rechaza una escena por `VisualRuntimeQcError`, la integración
persiste su `report` completo —snapshots, contraste local y findings— antes de
sustituir el clip. Fallar al persistir el diagnóstico produce un aviso
`RESOLVER_DEGRADED`, sin cambiar ni recuperar el render. 4A mide QC: no modifica
umbrales, composición ni renderer.

## Puertas y mediciones de la rama

La suite `test:semantic-decision-repair-v1` usa consumidores compilados, red
bloqueada y un fixture temporal con 22 entradas condensadas del corpus forense.

| Medida | Antes | Después |
|---|---:|---:|
| Frase global que invalidaba AssetIntent | 598 caracteres | `localText` ≤ 360 |
| Escenas nuevas que caen a legacy por input | 6 observadas | 0/22 del corpus |
| Ganadores residuales conocidos | `estando` observado en el export | 0/22 |
| Oportunidades concretas evaluadas | — | 14 |
| Hit rate concreto | — | 14/14 = 100,0 % |
| Decisiones del corpus 22 | — | 14 OpenMoji, 0 Solar, 8 editorial-text |

La oportunidad de bandera vecina que antes se atribuía a `indignación` dejó de
contarse como oportunidad de esa escena: pertenece a otro significado del
tramo. Las puertas específicas pasan: fútbol evalúa `openmoji:26bd`, estadio
`openmoji:1f3df`, construcción `openmoji:1f3d7`, cerveza `openmoji:1f37a`,
trabajador `openmoji:1f477` y México `openmoji:1f1f2-1f1fd`. Iglesia y religioso
no heredan cronómetro; accidente no hereda calendario y materializa
`editorial-text`. La escena temporal `indignación` conserva `indignación`, no
`emoción`, mediante `SCENE_KEYWORD_DIRECT_TIMED_MATCH`. El caso sintético de
abstracción local de tiempo conserva la vía Solar. La misma
entrada/inventario/sesión produce la misma identidad.

El replay de las 16 posiciones históricas de QC es una reproducción V4A con
frase, transcript temporizado y conceptos preservados; los reports QC originales
habían sido descartados y no se reconstruyen como hechos históricos. En la
última corrida del replay, los findings contados fueron 17
`VISUAL_QC_TEXT_BOUNDS`, 15 `VISUAL_QC_TEXT_OVERFLOW` y 5
`VISUAL_QC_CONTRAST_LOCAL`. Son medidas de la reproducción vigente, no hechos
históricos del export original.

La generación temporal por el handler real también escribió el diagnóstico. La
última corrida solicitó 1 Visual, materializó 0, rechazó 1 por
`VISUAL_QC_CONTRAST_LOCAL` y sustituyó 1 por original. Es una medición de QC,
no una corrección de QC ni una afirmación de estabilidad universal.

## Artefacto de revisión humana

`tests/aceptacion/semantic-decision-repair-v1/contact-sheet-before-after.png`
compara ocho escenas: construir, partidos, fútbol, estando, iglesia, religioso,
accidente e indignación. Cada celda lleva `B` (histórica), `A` (materializada en
la reproducción) o `QC` (rechazada), provider abreviado y candidato. El detalle
estructurado vive en `evidence.json` y `qc-replay.json` del mismo directorio.

La revisión humana detectó que la primera reproducción V2 mostraba `EMOCIÓN`
para el subclip histórico de `INDIGNACIÓN`. La hoja vigente ya conserva
`INDIGNACIÓN` con la razón temporal explícita anterior. Sigue siendo evidencia
para revisión humana, no una aprobación estética.

La hoja no es una aprobación estética. Su campo de evidencia es
`visualVerdict: pending-human-review`; Jairo debe revisar los frames antes de
cualquier merge o etiqueta de 4A.

## Límites intactos

No hay provider nuevo, red, IA adicional, ByPeople, AttentionIntent, Hero nuevo,
modificación de AssetManifest real, SVG en proyectos reales ni cambios a
renderer/hash/canonizar/paletas/fondos/estructuras/motion/QC. Los proyectos reales
se leen para huella; las reproducciones crean proyectos marcados bajo `%TEMP%`.

Ronda 4B no se inicia hasta la revisión humana de esta evidencia.
