# Asset Resolver V1 — decisión automática offline

## Extensión 4A integrada

La extensión cerrada por `v-semantic-decision-repair-v1` añade una entrada local
temporizada (`LocalSceneSemanticV1`) antes de `AssetIntentV1`. `localText` tiene
un máximo de 360 caracteres; `globalText` queda como referencia diagnóstica y no
puede dominar la metáfora. Una entrada inválida se materializa como
`editorial-text` trazable, nunca como un Visual legacy nuevo.

La traza productiva queda separada en
`materiales/diagnostics/visual-decisions/<generationId>.json`, fuera de
`project-state`, AssetManifest y PixelIdentity. Incluye decisión, candidatos,
razones, resumen requested/materialized/rejected/substituted y el report QC
completo si aplica. No cambia el renderer ni la identidad de una `sceneSpec`
existente. Detalle y evidencia: `semantic-decision-repair-v1.md`.

Jairo aprobó la corrección temporal antes del merge/tag de 4A. Esa aprobación es
semántica; la composición visual se evalúa separadamente en Ronda 4B.

## Alcance

El resolver V1 convierte semántica existente en una decisión materializada antes de calcular el hash y antes de capturar el Visual:

    semántica existente
    → AssetIntentV1
    → metáfora concreta
    → candidatos locales
    → ResolvedSceneDecisionV1
    → VisualSceneSpecV1 + RenderBindingsV1
    → visual_escena

No hay llamada nueva de IA, búsqueda de red ni provider lookup durante render. El renderer recibe un sceneSpec ya resuelto y bindings que sólo localizan bytes verificados. La traza de decisión es diagnóstico de aceptación; no entra en extra.sceneSpec ni en PixelIdentity.

## Contratos ejecutables

src/shared/asset-intent.ts es la autoridad de AssetIntentV1:

- version 1, sceneId, phrase opcional, keyword, concepts, relation opcional, anchor opcional, searchTerms y preferredVisualMode;
- describe necesidad narrativa, nunca provider, URL, path, SHA, tratamiento ni geometría;
- normaliza términos del input semántico ya saneado y rechaza keyword vacía.

ResolvedSceneDecisionV1 conserva metáfora, Hero materializado o ausencia, estructura, razones, fallback y avisos. El compilador único lo traduce a VisualSceneSpecV1 + RenderBindingsV1 + graphicData; ningún otro punto fabrica extra.sceneSpec manualmente.

La API de integración es resolveAndCompileVisualSceneV1({ intent, projectRoot, sistema, direction, session }). Sólo projectRoot explícito autoriza publicar o reutilizar ProjectAsset; no hay fallback a process.cwd().

## Política V1

La metáfora precede al archivo. El consumidor histórico conserva ancla, keyword
y frase/relación; la extensión 4A usa primero el sujeto del intervalo local y
sólo después conceptos/ancla. Dentro de su evidencia concreta, el orden es emoji
exacto, label, ancla, hint canónico, keyword y término de metáfora. Así una
palabra global incidental no desplaza la cláusula que se está narrando. Las
guardias de contexto humano, archivo/historia y proceso abstracto pueden decidir
editorial-text antes de buscar un icono.

El score es cerrado: 3 metáfora fuerte, 2 usable, 1 genérica/débil y 0 incorrecta. Sólo 2–3 habilitan Hero. Un empate de candidatos utilizables termina en editorial-text con AMBIGUOUS_ASSET_CANDIDATES; no hay desempate silencioso.

Providers activos, todos locales:

| Orden | Vía | Regla |
|---|---|---|
| 1 | ProjectAsset | Reutilizar primero si registro, SHA, MIME y bytes siguen válidos. |
| 2 | OpenMoji 17.0.0 | Buscar catálogo local; máximo cuatro queries, tres resultados por query y seis candidatos únicos; publicar sólo el elegido. |
| 3 | Solar | Elegir glifo procedural canónico cuando expresa mejor la abstracción o el icono simple. No se convierte en ProjectAsset. |
| 4 | editorial-text | Resultado válido para ausencia de metáfora, riesgo, ambigüedad o contexto no representable todavía. |

No están activos ByPeople, Iconify, Lucide como provider, PurePNG, PNGImages, archivo/vintage, Pexels, Wikimedia, IA ni API remota.

## Familia, tratamiento, estructura y continuidad

- OpenMoji simple-icon → accent-mask.
- OpenMoji complex-illustration → duotone.
- none exige regla explícita; Solar mantiene su vía procedural.
- Asset-led se limita a constelacion, marcoPoster y editorial.
- Una sesión por vídeo guarda historia acotada de metáforas, assets, estructuras y tratamientos. Evita una tercera estructura consecutiva idéntica si hay alternativa compatible, pero semántica > coherencia > variedad.
- La misma metáfora dentro de tres escenas permite reuse como continuidad. Nunca se sacrifica candidato mejor por variar.

El motion reutiliza exclusivamente presets certificados del Visual MVP: densidad baja usa fade-slide/breathe/fade-out; media scale-in/float/scale-down; alta añade el único punch V1.

## Identidad, bindings y avisos

El spec materializado conserva estado, SHA, MIME, kind, bounds, fit, tratamiento, motion, texto, dirección, sistema y revisiones. Eso alimenta tanto hashGrafico como la clave React mediante la misma proyección canónica.

RenderBindingsV1 contiene sólo slotId, assetId y relativeFile. Path, projectRoot, provider, URL, licencia, atribución, fecha, candidato, score y la traza quedan fuera de identidad. Solar usa un ID canónico exacto en el spec; el renderer lo dibuja sin reconsultar aliases. Una vía present, missing o editorial-text nunca comparte identidad por accidente.

Los avisos distinguen decisión editorial legítima de degradación: NO_VISUAL_METAPHOR, AMBIGUOUS_ASSET_CANDIDATES, PROJECT_ASSET_INVALID, PROVIDER_NO_USABLE_RESULT, FALLBACK_EDITORIAL y RESOLVER_DEGRADED. La integración de generación los publica por el canal de avisos existente antes de hashGrafico y renderGraphicClip.

## Evidencia de aceptación

El corpus físico de 42 Visuales es tests/aceptacion/mvp-paso7/video.json; no persiste frase, por lo que su fuente disponible es keyword, conceptos, relación, ancla y dirección. La medición tests/aceptacion/asset-resolver-v1/corpus-42.json usa el main compilado, un proyecto temporal marcado y red bloqueada; nunca usa decisiones humanas de la puerta experimental como lookup.

La evidencia actual del corpus registra 20/42 asset-led (8 OpenMoji, 12 Solar) y 22/42 editorial-text. Es una política deliberadamente conservadora: evita fingir personas, archivo, contexto histórico o relaciones abstractas con emoji. Hay un empate editorial y las tres barreras críticas quedan activas: termodinámica no recibe mobile phone off, peatones no recibe no pedestrians y mástil no recibe mastodon.

La corrida final del corpus tomó 2.447,629 ms en total (mediana 1,522 ms por
escena; p95 171,836 ms), con 84 queries locales de OpenMoji, ocho publicaciones
en el proyecto temporal y veinte lecturas de manifest. Es una medición del host y
del corpus concreto, no un presupuesto universal de producción.

Frente a la puerta visual humana anterior (Solar usable/fuerte 22/42 y OpenMoji usable/fuerte 28/42), esta primera política automática no intenta igualar toda la cobertura de candidatos. Materializa sólo decisiones que puede defender sin resolver más rico: el cuello de botella pendiente es selección/metáfora y representación de escenas humanas, archivo y relaciones, no ausencia de segunda fuente de iconos.

tests/aceptacion/asset-resolver-v1/ conserva además video real de once Visuales, hoja de contacto de frames medios y evidence.json. El fixture elige sólo semántica: incluye OpenMoji creado/reutilizado, Solar, dos fallbacks editoriales, tres estructuras, dos tratamientos, texto y motion. Termina por renderGraphicClip → export-video, no como overlay de SVG/PNG. Durante resolver/render no hubo intentos de red; un intento de voces de inicialización fue bloqueado antes de medir y se registra por separado.

La ejecución de aceptación registrada en evidence.json resolvió las once escenas
en 792,867 ms (mediana 69,027 ms/escena; p95 129,451 ms), hizo 27 queries
locales, publicó cuatro assets y reutilizó uno. El render/export de los once
clips 540×960/10 fps/1,4 s tomó 6.810,732 ms. El control informativo equivalente
del mismo proceso midió legacy 568 ms / 1,57 intentos por frame y asset-led
591 ms / 1,50 intentos por frame (+4,05 %); no es un benchmark universal ni
activa degradación automática.

## Límites y ByPeople posterior al MVP

    BYPEOPLE_PROVIDER_STATUS = 'planned-not-audited'

ByPeople es la primera expansión prevista después del MVP para photo-cutout (personas, multitudes, objetos, arquitectura y sujetos de peso visual), pero no es candidato de este resolver. No se hace scraping, login automatizado ni búsqueda durante render; la biblioteca cruda no entra en Git ni se copia masivamente a proyectos.

Antes de integrar la biblioteca adquirida hay que auditar, con la colección real:

1. Si permite bulk download.
2. Si los más de 50.000 archivos pueden existir localmente.
3. Estructura de carpetas.
4. Nombres semánticos.
5. Metadata/tags.
6. Que sean PNG reales.
7. Alpha útil.
8. Resoluciones.
9. Duplicados.
10. Licencia comercial.
11. Restricciones de redistribución.
12. Permiso para índice local.
13. Descarga individual o bulk.
14. Si login sólo sirve para descargar o también para usar.
15. Si existe API oficial o sólo biblioteca web.

Sólo entonces el pipeline futuro podrá ser biblioteca local → índice local → búsqueda semántica → magic/dimensiones/alpha/SHA/procedencia → copiar un asset elegido → ProjectAsset → bindings → spec. Provider, path y licencia seguirán fuera de PixelIdentity; SHA, estado y tratamiento seguirán dentro.

## Fuera de alcance

No hay AttentionIntent, Support, collage, decorators, provider adicional, transición, sincronía de voz, IA, UI nueva, copia de assets a proyectos reales ni cambio de VERSION_PLANTILLAS. Legacy sin extra.sceneSpec sigue por su camino actual y no se resuelve al reabrir: sólo regeneración explícita activa V1.
