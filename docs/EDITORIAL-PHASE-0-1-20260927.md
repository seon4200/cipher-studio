# Consolidación editorial · Fases 0 y 1 (27-09-2026)

Alcance: sólo Visuales del flujo editorial habitual. No se modificaron Stock, Gráficos, transiciones, familias, ranking ni recursos. El perfil visible sigue siendo Editorial contextual V4; `editorial-scene-decision-2026-09-v3` versiona únicamente decisiones nuevas. Los SceneSpecs anteriores no se migran.

## Fase 0: punto de retorno

- Código: `%CIPHER_LOCAL_ROOT%\_cipher-phase0-20260927\code-current.bundle`, bundle completo de `42092b7b3953cad65dd06ef4ea910dfd1ba687e1` y del checkpoint publicado `651d021e689f1c4d50493d3dd0bc069a36a5d2df`. `git bundle verify` pasó. SHA-256: `0D8848F37FF64B7A9622FDD575C050ADD7C50A15F82BADFA82B0841138FE8C92`.
- Cambios ajenos sin confirmar: copiados separadamente bajo `pending/` y cotejados por SHA-256. No se añadieron al commit.
- Catálogo: `base-250.zip` (SHA-256 `57DC9EDAE1870C0DABC2BB32F444C33CC6CC883160F8507AAF0BC0A80E63295D`) y copia de `extension-v2/` (20 manifiestos de lote, 140 PNG activos; cero diferencias de SHA). Inventarios `inventory.json` e `inventario-vigente-390.json` también copiados y cotejados. El catálogo activo conserva 390/390 archivos verificados; no se alteró.
- La copia de manifiestos por sí sola **no** es respaldo de raster. Esta entrega guarda también el ZIP base y los raster de ampliación. Los proyectos y exportaciones originales quedan en su lugar, fuera del bundle Git.

## Fase 1: cambios de contrato y flujo

- `editorial-scene-selection.ts`: la cita tolera diferencias de espacio bajo la nueva revisión, pero conserva comprobación de intervalo/procedencia, negación, atribución, cifras y enums. El contexto posterior no puede convertirse en afirmación del intervalo. Comprensión y presentación se validan en etapas distintas: un titular largo ya no impide buscar candidatos. Hay como máximo tres intentos de comprensión y dos de reducción; se registran etapas, errores, latencia y ajustes.
- `index.ts`: conserva por separado tokens del intervalo y contexto anterior/posterior, incluidos vecinos dentro de una frase con timestamps. El plan nuevo persiste ese alcance. Si no existe texto breve fiel, registra `editorial-no-faithful-text` o `editorial-presentation-unresolved` y omite el render del Visual, sin publicar un título cortado ni inventar una relación.
- `editorial-local-bank-v4.ts`: acepta el contrato interno v3 y sus campos de procedencia; v1/v2 permanecen válidos. Las familias, catálogo, binder y compositor actuales no cambiaron.

## Evidencia y límites

El diagnóstico guardado de `9999` contiene 17 Visuales; 14 fallaron comprensión, dos fueron tipográficos con lista vacía y uno tuvo Hero. Es evidencia anterior, no resultado del cambio actual. En cuatro fragmentos históricos, la evaluación de respuestas guardadas con el contrato nuevo identificó afirmaciones futuras o procedencia fuera de intervalo. Esas respuestas no se reetiquetaron como válidas para fabricar progreso.

Prueba nueva con DeepSeek real, cinco fragmentos (cuatro históricos y una narración natural reservada): 18 llamadas, 64,306 ms acumulados de decisión. Comprensión final válida 4/5; una quedó rechazada por perder el marco crítico. Hubo dos Heroes propuestos, dos composiciones tipográficas y un rechazo de comprensión. Las selecciones de Hero **no** demuestran pertinencia editorial: el Hero `editorial-hero-h030-v1` elegido para identidad se ve como lector biométrico en el MP4. El caso de transcripción dudosa `portaleza` permaneció literal en `sourceQuote`, pero la paráfrasis del modelo lo corrigió; debe revisarse antes de aprobar calidad semántica. Dos comprensiones válidas acabaron en `PRESENTATION_UNRESOLVED`: no se publicaron como titulares largos.

Una decisión real de DeepSeek (`visual-8:0`) pasó por selección V4, importación ProjectAsset, binder y render en 9:16 y 16:9. Ambos MP4 existen, QC sin hallazgos y red cero durante render. El ensayo de guardado/reapertura/regeneración del plan guardado produjo tres MP4 de SHA idéntico por orientación, sin DeepSeek ni acceso al catálogo externo. Este ensayo usa handlers: **no** prueba clics en la UI ni sincronía con audio.

TypeScript y build pasaron. Contratos Phase 1: 9; contratos de decisión: 17; correcciones previas afectadas: 13. El fixture dirigido V3 de contrato produjo MP4 en ambas orientaciones. El fixture histórico V3 produjo exactamente la misma identidad, MP4 y todos los frames decodificados que la evidencia previa en ambas orientaciones, sin tolerancia. No se cambiaron baselines.

Una instancia temporal de Electron se inició desde el checkout con perfil aislado, pero no apareció como ventana identificable en la herramienta de UI y el proceso terminó; **UI = no verificada**. No se atribuyen clics al usuario ni al harness. Tampoco se generaron videos completos con audio. Por estas puertas y por las presentaciones no resueltas, la Fase 1 queda **PARTIAL**: comprensión y ruta de render demostradas parcialmente, calidad editorial y flujo UI pendientes.

Evidencia externa: `%CIPHER_LOCAL_ROOT%\_cipher-phase0-20260927\phase1-tests\` (`contracts.json`, `real-escalated/real-decisions.json`, `real-render/`, `real-replay/result.json`, `historical-parity.json`). Las trazas con guion y respuestas del modelo permanecen fuera del repositorio público. SHA-256 del bundle `dist-electron/main/index.js` probado: `B9DFF11CB02196B1DAD202A0061F26A2F2064E7C8BD16DDBE5AFABED8E3A962D` (también en `phase1-tests/decisions/contracts.json`).

## Registro de integración

| Capacidad | Estado tras Fase 1 | Siguiente puerta |
| --- | --- | --- |
| Comprensión con procedencia temporal | Conectada en decisiones nuevas V4; cuatro de cinco casos reales aceptados | Más narraciones naturales y revisión de incertidumbre de transcripción |
| Reducción de titular independiente | Conectada; dos casos aún irresolubles | Mejorar estrategia de presentación sin cambiar significado |
| Recuperación tras comprensión válida | Conectada y trazable, aun con lista vacía | Fase 2: pertinencia y cobertura de candidatos |
| Seis familias/editorial actual | Sin cambios | Fase 2: decisión conjunta recursos/composición |
| Otras once familias y tratamientos históricos | Sin conectar por esta fase | Fase 3 |
| Guardado/replay sin red ni catálogo | Verificado por handler en proyecto temporal | Fase 4: UI y video completo con audio |
| Build UI real | Instancia temporal no controlable; sin clic verificado | Repetir en sesión visible e inequívoca |

No se inicia la Fase 2 sin revisión de este resultado.
