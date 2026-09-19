# Familias V15 — auditoría previa a Families/Motion V2

Base: `dbf5e4e4ac3da79ec8167cf51521b1851eb59f25`. Autoridad:
`src/shared/visual-layout-v4.ts` (`MODERN_LAYOUT_STRUCTURES_V4`,
`LAYOUT_ELIGIBILITY_V4`, `createVisualLayoutV4`) y
`src/renderer/src/composiciones/MotionGraphicV15.tsx` (`StructureGrammar`,
`SceneAssetSlot`, `QuietBackground`). Las cinco familias indicadas como refinadas
por Visual Recovery están en `VISUAL_RECOVERY_REFINED_FAMILIES`.

Las geometrías son porcentajes del canvas: una lectura de código no certifica
legibilidad 9:16/16:9. `PENDIENTE` registra exactamente esa limitación antes de
ejecutar la evidencia. El fondo actual es solid-black-v1/Porcelain según el
perfil, con motion ambiental nulo o sutil; la entrada de asset es genérica por
rol y sólo el piloto editorial diferencia algunas relaciones.

| familyId | purpose / relación elegible | currentLayout y texto | Hero / Supports actuales | background / motion | 9:16 / 16:9 | mainWeakness | clasificación inicial |
|---|---|---|---|---|---|---|---|
| editorial | texto sin asset | centro 10,22,80,56 | ninguno | negro / tipografía | PENDIENTE / PENDIENTE | bloque único y poco ritmo | NEEDS_REFINEMENT |
| marcoPoster | protagonista, 0–2 apoyos | texto inferior centrado | Hero en placa 66×48, apoyos laterales con halo | negro / entrada por rol | PENDIENTE / PENDIENTE | placa y halos demasiado constantes | NEEDS_REFINEMENT |
| partidoVertical | división/comparación defendible | texto lateral | Hero lateral 43×50, apoyos al otro lado | negro / entrada por rol | PENDIENTE / PENDIENTE | comparación no siempre lee como par | NEEDS_REFINEMENT |
| cintaDiagonal | impulso/cruce | texto inferior izquierdo | Hero diagonal 51×44, dos apoyos | negro / entrada por rol | PENDIENTE / PENDIENTE | diagonal decorativa sin función clara | NEEDS_REFINEMENT |
| anillosConcentricos | foco y órbitas | texto inferior | Hero central 52×42, apoyos periféricos | negro / entrada por rol | PENDIENTE / PENDIENTE | anillos/halo dominan asset | WEAK |
| rayosImpacto | impacto/expansión | texto inferior | Hero central 62×46, apoyos con placa | negro / entrada por rol | PENDIENTE / PENDIENTE | rayos se sienten genéricos | WEAK |
| cuaderno | documento/anotación | margen inferior izquierdo | Hero documental 38×35, dos apoyos | negro / entrada por rol | PENDIENTE / PENDIENTE | marco de papel sin jerarquía de lectura | NEEDS_REFINEMENT |
| constelacion | relación entre nodos | texto inferior | Hero central 38×31, 1–2 apoyos | negro / entrada por rol | PENDIENTE / PENDIENTE | Hero pequeño y vínculos poco expresivos | WEAK |
| capasApiladas | estratos / composición | texto lateral derecho | Hero 50×38 y capas escalonadas | negro / entrada por rol | PENDIENTE / PENDIENTE | placas repetidas | WEAK |
| redNodos | red de tres elementos | texto inferior | Hero 38×31 y dos apoyos | negro / entrada por rol | PENDIENTE / PENDIENTE | similar a constelación sin direccionalidad | REDUNDANT_CANDIDATE |
| lineaTiempo | tres hitos temporales reales | caption inferior | Hero 35×33, dos hitos decrecientes | negro / entrada por rol | PENDIENTE / PENDIENTE | hitos no aparecen en orden temporal | NEEDS_REFINEMENT |
| corteTransversal | partes/interior | texto lateral derecho | Hero y supports en tres bandas | negro / entrada por rol | PENDIENTE / PENDIENTE | bandas demasiado parecidas a tarjetas | WEAK |
| abanicoTarjetas | colección/alternativas | texto superior | Hero central 44×40 y dos tarjetas laterales | negro / entrada por rol | PENDIENTE / PENDIENTE | marcos universales; relación poco legible | WEAK |
| engranajes | interacción/mecanismo | texto inferior | Hero 38×31 y dos apoyos | negro / entrada por rol | PENDIENTE / PENDIENTE | círculos punteados por encima del significado | WEAK |
| cascada | cadena causal | texto superior derecho | tres niveles diagonales | negro / entrada por rol | PENDIENTE / PENDIENTE | entrada no sigue la cadena | WEAK |
| mundoIsometrico | sistema/entorno, tres objetos | texto superior | Hero central 40×34 y apoyos laterales | negro / entrada por rol | PENDIENTE / PENDIENTE | campo isométrico no cambia la profundidad real | SPECIAL_CASE |
| pilaVertical | jerarquía/pasos, 1–2 apoyos | texto lateral derecho | tres niveles a la izquierda | negro / entrada por rol | PENDIENTE / PENDIENTE | niveles demasiado iguales | WEAK |

No se elimina ninguna familia. `REDUNDANT_CANDIDATE` no autoriza fusionar
`redNodos` con `constelacion`: las relaciones admisibles difieren y deberán
compararse visualmente. La política de foto/asset, Concept Hygiene y Relevance
Gate conservan autoridad; este documento sólo describe presentación.

Gate productivo previo: build exit 0; DPI-safe, Text Fit, Porcelain, Modern Pack
y Local Library exit 0. Generación temporal a DPR 2.25:
3 Visuales planeados, 3 SceneSpecs, 3 archivos, 3 clips de timeline,
visual-sin-fichero=0. Evidencia externa:
`C:/graphify/_phase4-entry-evidence/acceptance-dpi-2.25.json`.

## Resultado de la extensión opt-in

La clasificación de la tabla superior describe **la base previa**, no una
evaluación estética final. El contrato V2 añade geometrías específicas para
las 17 familias en retrato y paisaje; el arnés las selecciona mediante el
resolver real, no escribiendo SceneSpecs finales. La prueba de estructura
certifica que cada `familyId` puede seleccionarse con relación y número de
slots admisibles y que puede renderizarse con QC en ambos formatos. La hoja
`families-v2-overview.html` facilita la evaluación humana caso por caso.

La elección semántica no se ha ampliado para favorecer estas pruebas. Un
ejemplo estructural de cámara, robot y teléfono aparece repetidamente porque
las 17 entradas fijan una relación distinta sobre los mismos tres sujetos;
eso permite comparar familias sin atribuir diferencias al asset. No debe
interpretarse como un video real ni como variedad semántica demostrada.

`redNodos` sigue marcado `REDUNDANT_CANDIDATE` frente a `constelacion` para
revisión de dirección de arte: V2 no elimina ninguna. Las familias
`anillosConcentricos`, `rayosImpacto`, `engranajes` y `mundoIsometrico` pueden
seguir sintiéndose más iconográficas que editoriales; el pase técnico sólo
certifica geometría, seguridad y reproducción. El veredicto visual permanece
pendiente de revisión humana.
