# NullAssetStrategy V1 — especificación

Objetivo: el fallo de resolución conserva una salida editorial intencional y un aviso trazable. El Visual tipográfico editorial es una receta futura; hoy el respaldo de texto existente sirve como último recurso, no se declara el nuevo layout implementado.

```ts
type NullAssetStrategy = 'editorial-text'
type SlotFallback = 'next-candidate' | 'generic-illustration' | 'solar' | 'omit' | 'editorial-text'
type MissingReason = 'no-metaphor' | 'no-candidate' | 'download-failed' |
  'invalid-file' | 'unusable-alpha' | 'rights-risk' | 'file-lost' | 'providers-exhausted'
```

Recipe contiene intenciones de fallback, no proveedor concreto. generic-illustration se resolvería preferentemente por OpenMoji obligatorio a nivel política de resolver. Solar significa la representación vectorial existente como clase de fallback; no una URL/proveedor externo ni nombre inventado. Omit sólo se permite para slot optional.

| Causa | Respuesta ordenada |
|---|---|
| Concepto sin metáfora adecuada | receta tipográfica editorial sin Hero; no fingir una metáfora genérica |
| Metáfora sin candidato | ilustración genérica si aún expresa la idea → Solar inequívoco → tipográfico |
| Descarga fallida | siguiente candidato dentro de límites → agotado |
| Archivo inválido | rechazar, registrar motivo y siguiente candidato |
| Alpha no útil | rechazar como cutout; full-bleed sólo tras nueva Recipe/layout compatible y nueva identidad |
| Riesgo demasiado alto | rechazar y continuar; nunca permiso inferido del nombre de portal |
| Archivo perdido después de resolver | invalidar present, aviso, resolver de nuevo o tipográfico; RenderSpec nuevo |
| Todos proveedores agotados | receta tipográfica editorial |

No blur/mancha genérica obligatoria. No escena rota, Hero present sin bytes o hash compartido entre present/missing. Optional ausente se registra en plan; su omisión cambia spec si antes pintaba. Un Hero requerido ausente replantea layout/texto/motion y triggers, no deja hueco por casualidad.

La degradación registra slot, motivo, candidatos descartados y decisión en el canal de avisos futuro y procedencia; no introduce URL/licencia en Recipe. La trazabilidad de elección no entra al hash salvo efectos visibles. Avisos/persistencia se integrarán con el pipeline real, sin segundo renderer.

## Modo y escenarios de los ejemplos

SceneRecipe.visualMode distingue asset-led (un Hero requerido) y editorial-text
(cero Hero, sólo procedural opcional o ningún slot). NullAssetStrategy sigue
siendo "editorial-text": el motivo pertenece a ResolvedScenePlan.fallbackDecision,
no es una segunda política de proveedores en Recipe.

Los ejemplos 6 y 12 incluyen un fallbackCase documental fuera de Recipe:
{reason, fromMode, toMode, expectedStrategy}. Representa una condición hipotética,
NO una descarga o resolución ejecutada. no-metaphor no inventa concreteMetaphor;
providers-exhausted conserva la intención original pero muestra la nueva receta
editorial sin Hero. No contiene nombres de proveedores ni assets resueltos.
