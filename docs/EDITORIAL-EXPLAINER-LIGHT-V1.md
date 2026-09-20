# Editorial Explainer Light V1 — piloto sintético

Estado: perfil **opt-in**, revisión `editorial-explainer-light-2026-09-v1`. No sustituye V15, Families/Motion V2 ni SceneSpecs persistidas. La ausencia del perfil sigue la ruta histórica. No se ha aprobado estéticamente ni autorizado un catálogo de 500 assets.

## Contrato visual congelado

- Paleta: marfil `#F0EEE8`, blanco `#FAF9F6`, tinta `#11110F`, grid `#CBC8C1`, naranja `#F26E35` y naranja de profundidad `#D85125`. Los gradientes y sombras son derivados deterministas de esta paleta.
- Tipografía local existente: Instrument Serif 400 para voz narrativa, DM Sans variable 400/500 para texto funcional, IBM Plex Sans Condensed 700 para etiquetas/datos. `font-synthesis: none`; el render espera la carga de fuentes y el test dirigido comprueba los archivos/rostros usados.
- Fondos exclusivos de esta revisión: `ivory-clean`, `ivory-subtle-grid` y `white-soft-paper`. El grid y el punteado de papel son de opacidad muy baja; no usan imágenes remotas.
- Materiales: `flat-editorial` (sin elevación) y `raised-object` (sombra de contacto corta más sombra ambiental desplazada abajo/derecha). La luz aparente viene de arriba/izquierda. No se eleva automáticamente un raster/cutout.
- Componentes reutilizables: HeroTile (orange/black/neutral), IconBadge (orange/black/original-color), Card (light/dark), Label (light/dark/orange-accent), Connector (straight/curved, static/draw, flecha opcional) y DataRepeater. Los elementos procedurales no consumen Hero/Supports.
- Motion semántico acotado: `hero`, `transfer`, `process`, `count`, `compare`, `statement`. No hay loops. El conector se dibuja desde el borde del Hero al borde del primer Support.
- `negativeSpace: intentional-editorial` expresa la intención de composición; **no** desactiva los errores existentes de asset ausente, contenido fuera de rango ni texto ilegible. El piloto acepta espacio libre sólo si los elementos conservan una relación clara.

## Activación y procedencia

En un **proyecto nuevo de prueba**, seleccionar `Editorial Explainer Light V1 (piloto)` en el selector existente de perfil visual antes de generar. La selección se persiste por proyecto mediante `visualPresentationProfile`; el pack de assets se selecciona por separado. No se cambia la opción de proyectos anteriores. La revisión, fondo, geometría horizontal, material, shadow preset, tratamiento iconográfico, conector, repetidor y motion cue quedan en `VisualSceneSpecV2.lightStyle`, que participa en la identidad pixel-visible. Paths absolutos, licencias y URLs no entran en `PixelIdentity`.

El piloto usa 24 **candidatos existentes y curados** del pack embebido (8 Hero, 12 Support, 4 utilitarios); la lista es un corpus de evaluación, no 24 archivos nuevos ni 24 assets usados en el MP4. En las cuatro escenas se materializan assets SVG a través de `catalogAsset`/`ProjectAsset` y el render posterior es offline. No se necesitó crear `C:\CipherAssets\VisualLibrary\style-01-editorial-explainer-light`. Si se emplean Heroes raster en la fase siguiente, entrarán por la ruta ProjectAsset/raster vigente, **no** por el manifiesto SVG local. Antes de escalar a ~500, se deberá diseñar explícitamente la unificación SVG+raster y la distribución/licencia de cada nuevo asset.

## Corpus y comparación

`tests/fixtures/editorial-explainer-light-v1-corpus.js` fija cuatro escenas sintéticas de tres segundos: Hero chip, transferencia robot→herramienta, 12 participantes literales y cierre tipográfico. Se renderizan 9:16 y 16:9 a 24 fps. La comparación A/B bloquea los mismos SHA de assets, texto, duración y formato; el perfil base es Families/Motion V2. Sólo el tratamiento visual, geometría y motion cambian. La tercera escena no crea doce Supports: el valor literal confirmado activa doce tokens procedurales y una etiqueta. Para valores grandes sólo se permite agrupación exacta con equivalencia textual visible.

Ejecutar después de `npm run build`:

```powershell
npm run test:editorial-explainer-light-v1
npm run accept:editorial-explainer-light-v1
```

La aceptación escribe fuera del repositorio, en `C:\graphify\_editorial-explainer-light-v1-evidence\run-*`, `evidence.json`, una hoja A/B HTML y PNG, fotogramas, clips y dos MP4 de ~12 s. Usa proyecto y userData temporales, bloquea HTTP durante el render y no modifica proyectos reales. El MP4 sintético no valida sincronización de audio ni selección fotográfica. El QC puede emitir `needs-review` por contraste local de naranja en texto grande; no se rebaja su umbral. La aprobación de luz, tipografía, ritmo y sensación premium corresponde a revisión humana.

## Límites deliberados

No hay 500 assets, Style 02, nube, nuevo renderer, selector global de proveedores ni manifest raster. Esta revisión no rediseña la semántica: el texto visible sigue la autoridad de keyword/connector/closing del resolver existente; el transcript sintético completo no equivale necesariamente a un subtítulo literal. Las seis primitivas están disponibles, pero el corpus sólo ejercita las necesarias para las cuatro escenas. Antes de producción masiva: revisar evidencia visual humana, cobertura real de símbolos/raster, consistencia de iluminación de assets heterogéneos y contrato de distribución/licencias.
