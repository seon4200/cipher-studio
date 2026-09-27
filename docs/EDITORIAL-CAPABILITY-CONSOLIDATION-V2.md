# Consolidación de capacidades editoriales — revisión de integración V2

Estado: integración acotada, **no** aprobación estética ni paridad total con las demostraciones. Rama `v15-editorial-capability-consolidation-v2`, base `6e0db5529ec54d3ea138973e0710169ef3cccfcb`. Ningún proyecto ni recurso del catálogo activo se modificó deliberadamente. La prueba semántica controlada no equivale a selección autónoma de DeepSeek.

## Dos líneas de evolución y decisión

| Línea | Demuestra | Decidía el motor | Decidía el fixture / límite |
| --- | --- | --- | --- |
| V15 clásico y Families + Motion V2 (`docs/FAMILIES-V2-AUDIT.md`, `src/shared/visual-layout-v4.ts`) | Geometrías, fondos y movimiento con variedad | Compositor y captura | El banco guiaba conceptos, assets y varias variantes; no transferir asociaciones por índice |
| Editorial modular y Acabado V1.1 (`src/shared/editorial-finish-v1-1.ts`, `src/renderer/src/composiciones/editorial-modular-families-v1.tsx`) | Cinco tipos de línea y cinco respuestas, llegada finita y ambiente; muestra `C:\graphify\_cipher-editorial-finish-v1-1\evidence\editorial-finish-v1-1-portrait.mp4` | Rutas, eventos, render e identidad dados los parámetros | Corpus de 12 escenas fijaba texto, roles, relaciones y efecto; no probaba elección automática |
| IDEA Assembly y banco local V2/V3 | Material raster por capas, cuatro apoyos en IDEA, 17 blueprints verticales/horizontales; muestras `C:\graphify\_cipher-idea-assembly-v3\runs\run-20260923-095747\idea-assembly-v3-vertical.mp4` y `C:\graphify\_cipher-editorial-local-bank-v2\evidence\editorial-local-bank-v2-portrait.mp4` | Composición/render de planes válidos | Scripts elegían cada composición; la ruta contextual V4 sólo ofrecía seis |
| Editorial contextual V4 y coherencia de decisiones (HEAD base) | Comprensión con procedencia, recuperación, selección conjunta, capas compatibles y replays | `decideEditorialScene` → `selectEditorialLocalBankV4Detailed` → `bindEditorialLocalBankV2` → SceneSpec → `EditorialModularFamiliesV1` | Relaciones escasas, acabado de llegada sin eventos y otras once geometrías no elegibles desde el prompt |

La línea anterior gana variedad de render, pero no pertinencia por sí sola. La actual conserva mejor la trazabilidad y evita conexiones inventadas; merece recibir capacidades sólo cuando exista evidencia semántica y geometría segura. No se cambió el selector visible ni se creó otro renderer.

## Qué ocurría con los efectos

En el compositor, `finish = spec.editorialBankV2 ?? spec.editorialFinish`. Por tanto, si V4 tiene `editorialBankV2`, los caminos `!finish && plan.particles` quedan anulados aunque el plan antiguo guarde partículas. V4 ya dibujaba siete microdetalles por `ambientIntensity:'discreto'`, entradas finitas y rutas, pero el binder creaba `plan.particles={mode:'none',count:0,opacity:0}` y no generaba eventos `arrival`. `editorialFamilyEffects` sólo se usa en la ruta modular de `src/main/index.ts`, no gobierna V4. No hay iluminación física de los RGB del Hero. La muestra V1.1 prueba las variantes de acabado dirigidas; no prueba que V4 las seleccionara.

## Matriz de integración

| Capacidad / origen | Consumidor anterior | Ruta actual y adaptación | Prueba | Pendiente |
| --- | --- | --- | --- | --- |
| Comprensión, candidatos y justificaciones / V4 coherente | `editorial-scene-selection.ts` | Conservados; mismo `decideEditorialScene` | UI con DeepSeek real, una escena natural | Calidad de ranking en corpus amplio |
| 6 familias V3 | `editorial-local-bank-v3.ts` | Siguen ofrecidas y validadas | UI Hero, tipografía y handler | Corpus de las seis por ruta ordinaria |
| `redNodos` / banco V2 | `editorial-local-bank-v2.ts` | Séptima geometría bajo dirección interna V3; exige Hero, 2+ Supports y grafo explícito con todos los participantes | UI controlada 9:16/16:9; rechazo de grafo incompleto | Selección espontánea con DeepSeek real y pertinencia del Hero |
| Otras 10 geometrías / banco V2 | Blueprints V2 y demos dirigidas | No ofrecidas todavía | Código y auditoría de elegibilidad abajo | Reglas narrativas, pruebas de colisión/oclusión en ambos formatos |
| Relaciones con significado / Acabado V1.1 | `routeEditorialFinishV11`, compositor existente | `editorialFinishRecipeV2`: informa→flecha/acento, causa→pulso/halo, transfiere→punto/pulso, conecta→enlace/acento de escala, contrasta→punteado/sin respuesta | A/B controlado y UI real con relación `informa` | A/B visual de los cinco significados |
| Llegadas y ambiente / V1.1 | `events`, `ambientIntensity` | Eventos finitos por relación validada; ambiente más tenue durante lectura; ningún efecto de llegada sin relación | Contrato de rechazo, MP4 A/B 9:16/16:9 | Revisión de movimiento a velocidad normal |
| Capas y color / IDEA, V3/V4 | Binder, ProjectAssets, compositor | Se mantienen; no se tiñe RGB neutro | UI con background y accent, replay sin catálogo | Afinidad de rear y oclusión frontal todavía restrictivas |
| Persistencia / V4 | SceneSpec/PixelIdentity | Marcador pixel-visible `editorial-finish-integration-2026-09-v2`, rutas, eventos, tiempos y semillas dentro del plan; ausencia conserva comportamiento V4 guardado | Spec SHA y MP4 SHA iguales al regenerar 9:16/16:9 | PixelDiff histórico exhaustivo no ejecutado |

Las diez geometrías no activadas son `cintaDiagonal` (eje diagonal; proteger titulares), `anillosConcentricos` (radial; distinguir nodo de decoración), `rayosImpacto` (énfasis; evitar causalidad inventada), `capasApiladas` (estratos; verificar oclusión), `lineaTiempo` (hitos fechados; exigir orden temporal), `corteTransversal` (partes internas; requiere asset/capas apropiadas), `abanicoTarjetas` (comparación o conjunto; legibilidad de tarjetas), `engranajes` (interdependencia; no atribuir causalidad por la geometría), `mundoIsometrico` (proyección 2D, no cámara 3D) y `pilaVertical` (jerarquía/secuencia; duración de lectura). Todas tienen blueprint 9:16/16:9 en `src/shared/editorial-local-bank-v2.ts`; ninguna queda por ello automáticamente elegible. Activarlas por rotación sería una regresión semántica.

## Evidencia producida en esta integración

- A/B controlado, mismo texto/assets/familia/duración/formato: `C:\graphify\_cipher-consolidation-v2\controlled-ab\portrait-historical-finish.mp4` frente a `portrait-valid.mp4`, y `landscape-historical-finish.mp4` frente a `landscape-valid.mp4`. Cambian sólo eventos/acabado y sus campos de identidad; ambos duran 3 s. Los frames previos a la relación coinciden; los del efecto/lectura difieren. El modo `historical` existe únicamente como parámetro del binder para esta comparación, no como selector visible.
- Ruta ordinaria de handler: `C:\graphify\_cipher-consolidation-v2\normal-route\v4-controlled-handler-vertical.mp4`. 1 Visual pedido/intento/materializado/insertado, 0 sin fichero. Semántica simulada.
- UI automatizada temporal, clics «Construir Timeline IA», guardar, reabrir, regenerar sin catálogo y exportar: `C:\graphify\_cipher-consolidation-v2\ui-network-vertical\ui-controlled-semantic-vertical-network-no-catalog-replay-timeline-export.mp4` y equivalente en `ui-network-horizontal`. 1/1 Visual materializado en cada formato; dos relaciones y dos llegadas. El audio de fixture es un tono de prueba, no voz; no demuestra sincronía perceptual con narración.
- DeepSeek real, frase natural no preparada con IDs: `C:\graphify\_cipher-consolidation-v2\ui-real-natural\ui-real-semantic-vertical-network-natural-visual.mp4` y su `*-diagnostic.json`. Eligió familia `editorial`, Hero `editorial-hero-h028-v1`, un Support DATOS, relación `informa`; 4 llamadas HTTP a DeepSeek en todo el flujo, 3 dentro de la decisión contextual, 1 reintento, 16,207 ms de decisión contextual. No eligió `redNodos`, ni debía hacerlo sin dos apoyos justificados. El Hero parece una cámara industrial: la pertinencia respecto de «sensor de invernadero» requiere juicio humano. No se exportó ni regeneró este caso real.
- Fotogramas estables comprobados: `C:\graphify\_cipher-consolidation-v2\ui-network-vertical\frames\stable.png`, `...\ui-network-horizontal\frames\stable.png`, `...\ui-real-natural\stable.png`. La familia de red mantiene texto y rutas fuera de las tarjetas; el efecto temporal se comprobó con frames distribuidos, **no** con reproducción a velocidad normal. El visor disponible bloqueó abrir MP4 locales por su política `file:`; no se eludió.

`tsc --noEmit`, `npm run build`, contratos históricos V1.1, aceptación V4 controlada, handler y UI de ambos formatos pasaron. El test V3 de contratos modifica el puntero de catálogo activo y por ello no se ejecutó contra esa raíz. No se tocó baseline. El test V1.1 informó `historicalParity:true` para sus propios contratos; no equivale a pixelDiff global de V1–V4. No hubo video largo real ni validación de las siete familias con guiones diversos. La aceptación técnica es parcial y la revisión estética sigue pendiente.

Se intentó además reproducir `editorial-local-bank-v3/render.cjs` y compararlo con `C:\graphify\_cipher-editorial-catalog-1265\evidence\contextual-v3-sample\result.json`. **No es una comparación de paridad válida**: la evidencia previa creó revisión `editorial-local-bank-2026-09-v3`, mientras el fixture actual crea `v3.1`; aunque conserva familia y Hero, ya omite una capa rear y cambia identidad y píxeles. Los SHA distintos no prueban una regresión de un SceneSpec guardado. Hace falta reproducir el SceneSpec original con sus ProjectAssets exactos o una línea base de igual revisión antes de afirmar paridad V3 pixel a pixel.

## Siguiente trabajo con dependencia concreta

1. Repetir las seis familias actuales y `redNodos` con corpus de narración natural y evaluar elección, no sólo render; corregir ranking de Heroes no pertinentes sin añadir cuotas.
2. Para cada una de las diez restantes, introducir elegibilidad semántica y prueba dirigida/ordinaria en ambos formatos antes de ofrecerla al modelo. Priorizar `lineaTiempo` sólo con hitos fechados y `pilaVertical` sólo con jerarquía verificable.
3. Construir A/B aislados para transferencia, causa, comparación e información, revisar clips completos a velocidad normal y auditar zonas focales.
4. Regresión histórica pixel a pixel y UI con voz real; luego video largo. No interpretar tests controlados como aprobación visual.
