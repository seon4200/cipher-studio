# QC Scene Recipe V1 — puertas futuras

Estado: especificación. Validar JSON documental no acredita legibilidad, metáfora correcta, movimiento o render. En implementación, las pruebas importarán consumidores reales; no reimplementarán geometría ni lógica de selección.

| Puerta | Evidencia / respuesta al fallo |
|---|---|
| 1. Metáfora concreta | relación defendible frase↔objeto; sin ella permitir receta tipográfica sin Hero |
| 2. No stock genérico | candidato corresponde a metáfora, no primer resultado de palabra |
| 3. Hero dominante | evaluación visual al tamaño de salida; exento fallback tipográfico |
| 4. Roles sin competencia | jerarquía visible, apoyos no ocultan Hero/texto |
| 5. Máximo de elementos | conteo de entidades semánticas según densidad; textura no es escondite |
| 6. Texto legible | glifos, líneas, tiempo de lectura y fuente reales; no basta contar palabras |
| 7. Contraste exacto | medir detrás de texto sobre fondo/asset/tinte en intervalos visibles |
| 8. Bounds completos | entrada, overshoot, sustain, emphasis, salida y extremos de cámara; intervalos de salida deliberada separados de lectura |
| 9. Archivo presente | resolver antes de hash y garantizar disponibilidad hasta captura |
| 10. SHA correcta | verificar bytes finales, incluido derivado, y bounds/revisión usados |
| 11. Riesgo aceptable | procedencia y licencia por asset; no aprobación por extensión |
| 12. Fallback definido | todos motivos llevan a decisión trazable, presente/ausente no comparten identidad |
| 13. Motion semántico | motivo ligado a narración; no amplitud libre |
| 14. Shake motivado | reason concreto y máximo un énfasis por escena |
| 15. Tiempo normalizado | valores finitos 0..1, ventanas válidas, sustain ciclo/divisor cerrado |
| 16. Geometría única | estructura produce placement y envelope; Recipe no coordenadas de escena |
| 17. Recipe limpia | ninguna URL/path/proveedor ni bytes/SHA resueltos; sólo slots/intenciones |

## Comprobaciones documentales reproducibles

Desde la raíz del repositorio:

```powershell
node --check docs/asset-engine/validar-scene-recipe-v1.cjs
node docs/asset-engine/validar-scene-recipe-v1.cjs
```

[Validador único](validar-scene-recipe-v1.cjs). Lee sólo el JSON de ejemplos;
sin imports de producción, red ni escrituras. Error de contrato/cobertura:
mensaje con escena/campo y código de salida 1. No mantener otra copia del
validador dentro de Markdown. Exporta validate para controles en memoria.

Fuente: ejemplos-scene-recipe-v1.json corregido sobre 74d1572, base master
291069e, ejecución de cierre 07/09/2026. Son 18 ejemplos hipotéticos, 3 por perfil.
No es muestra real de vídeos ni evaluación de catálogo/render.

| Cobertura | Medida | Mínimo documental |
|---|---:|---:|
| asset-led / editorial-text | 16 / 2 | editorial-text >=2 |
| hard-cut | 6 | 4 |
| Hero exit none | 5 | 4 |
| escenas sin emphasis | 11 | 3 |
| Supports opcionales omitibles | 3 | 2 |
| hold motivado | 1 | 1 |
| asset-led sin Support | 1 | 1 |
| no-metaphor / providers-exhausted | 1 / 1 | 1 / 1 |
| entradas scale / slide | 8 / 6 | 3 / 3 |
| float | 5 | 3 |
| punch/shake con reason | 7 | 3 |
| tipos de transición | 5 | 3 |
| salidas visibles de Hero | 11 | no exigidas en todas |

Transiciones: hard-cut 6, match-shape 4, none 4, shrink-to-anchor 3, scale-cover 1.
Las escenas 6 y 12 ilustran fallbacks, no proveedores ejecutados.

Controles en memoria ejecutados contra validate: rechazados keywordRef duplicado,
Hero en editorial, asset-led sin Hero, entry fuera de visibility, sustain antes
de entry, ventana exit incompatible, doble énfasis, hold solapado, divisor 7,
NaN, ausencia de hard cuts, SHA/campo infiltrado, ruta, URL, falta de casos
fallback, referencia inexistente, nueve palabras y hero-entry con tiempo.
Son 18 rechazos esperados, no suites productivas. Un hold 0.1–0.3 y punch
manual 0.5–0.6 en scene-09 es válido: evita prohibir coexistencia sin solape.

Ejemplo de control negativo sin escribir fixtures:

```powershell
node -e 'const {validate}=require("./docs/asset-engine/validar-scene-recipe-v1.cjs"); const d=require("./docs/asset-engine/ejemplos-scene-recipe-v1.json"); d.examples[0].SceneRecipe.text.keywordRef="SceneIntent.keyword"; validate(d)'
```

Debe salir distinto de cero. Estas comprobaciones sólo certifican coherencia
estructural/documental. No demuestran metáforas acertadas, legibilidad, movimiento,
contraste o compatibilidad de estructuras.

## Puertas visuales futuras: no basta una captura fija

Contraste se mide en la zona REAL del texto sobre fondo/asset/tinte: después de
entrada, keyword-hit, overshoot máximo, extremos de sustain y antes de salida.
Bounds considera entrada, overshoot, sustain, emphasis, salida, cámara y texto
real. Una captura central no certifica el intervalo completo ni la legibilidad.

Desde 3.4 OpenMoji deja traza de proveedor, versión, source URL, file URL, SHA,
licencia, atribución, validación y fecha, fuera de Recipe y de la identidad
salvo atribución que se dibuje. Validación V1: MIME y magic bytes, tamaño,
dimensiones, SHA, política de SVG permitido, scripts y recursos externos.
OCR, watermark detector y logo detector son endurecimiento/proveedores de riesgo,
no puertas obligatorias de 3.4.

## Integración y cachés

Hash de archivo y clave del árbol React consumen la misma extra.sceneSpec
materializada. RenderBindings sólo localiza bytes y se verifica antes de render.
renderTier y revisiones/timing efectivos se fijan ANTES de hashear; si coste exige
otro tier, nueva identidad y aviso. Nunca degradación silenciosa por carga de
máquina. Medir caché existente antes de proponer render incremental.
