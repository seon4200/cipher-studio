# Editorial Explainer Light — Pilot V2

Pilot only; visual approval remains human. This revision does not authorize a 100/500-asset catalog, cloud delivery or Style 02.

## Pixel contract and historical isolation

`editorial-explainer-light-v2` / `editorial-explainer-light-2026-09-v2` is opt-in in the editor's visual presentation selector. V1's revision and components remain available. Without either light profile, historical generation and identity take the existing paths. The V2 `lightStyle`, layout and profile revision are part of SceneSpec/PixelIdentity; ProjectAsset locators, licensing notices and source metadata are not.

The compositor is still MotionGraphicV15. V2 adds an isolated layout, text hierarchy, circular icon badge, continuous connector and data treatment. It reuses the three V1 light backgrounds and its frozen palette (`#F0EEE8`, `#FAF9F6`, `#11110F`, `#CBC8C1`, `#F26E35`, `#D85125`). No new fonts are downloaded: Instrument Serif, DM Sans and IBM Plex Sans Condensed are local. V1 pixels are not repurposed.

## Pilot assets and route

- Four original AI-generated transparent PNG *candidate* Heroes: idea light bulb, signal relay, connection bridge and process stack. These are synthetic editorial objects, **not retrieved photos**. They remain outside the Git repository under `%CIPHER_LOCAL_ROOT%\_editorial-explainer-light-v2-assets\heroes` and are published into a temporary project's `ProjectAsset` manifest by the raster publisher. Their visible SHA is locked and their original color is preserved. This is art-directed pilot selection, not evidence that automatic photo retrieval selected them.
- Eight support candidates (`robot`, `camera`, `phone`, `brain`, `factory`, `gear`, `satellite`, `tree`) and four visual utility candidates (`data`, `chart`, `question`, `heart`) are local SVGs from the already-installed Lucide React package (ISC). The external pilot library is built through the existing `LocalManifestCatalog` and `CompositeVisualCatalog`, with one manifest and SHA per asset. Some candidates are intentionally unused in the six-scene film. The renderer sees published `ProjectAsset` bindings, not the library path.
- Connectors, cards/badges, grid and DataRepeater are procedural components rather than pretending to be semantic Supports. A scene still has at most one Hero and two semantic Supports.
- Only the light pilot profiles accept locked `editorial-pilot-raster` choices; restoration verifies the accepted raster ProjectAsset, SHA, alpha and representation. Ordinary projects cannot accidentally reinterpret these files as Pixabay imagery.

To rebuild the local library, run from the repo root:

```powershell
node tests/aceptacion/editorial-explainer-light-v2/build-local-library.cjs %CIPHER_LOCAL_ROOT%\_editorial-explainer-light-v2-assets\local-library-lucide
```

The normal UI profile is opt-in. For ordinary project generation, select **Editorial Explainer Light V2 (piloto)** under visual presentation. Select the separate `modern-pack-100-v1+local` asset pack only if the `CIPHER_VISUAL_LIBRARY_PATH` process setting points directly at a folder containing `manifest.json`. The acceptance harness sets that variable only in its isolated process; it never edits `.env`. Raster pilot Heroes are selected as verified explicit locks by the synthetic acceptance harness, not exposed as an automatic UI asset picker. That is deliberate debt before scaling.

## Six-scene film (fictional, exactly 20 s at 24 fps)

| Scene | Duration | Claim | Treatment |
| --- | ---: | --- | --- |
| Idea | 3.5 s | Una idea enciende posibilidades. | Transparent light-bulb Hero, clean ivory, typography |
| Signal | 3.2 s | La señal conecta robot y cámara. | Relay Hero, two monochrome Supports |
| Transfer | 3.5 s | Una conexión lleva datos al siguiente paso. | Bridge Hero, database Support, drawn arrow |
| Quantity | 3.4 s | 12 participantes construyen una red. | Literal number and 12 procedural person tokens |
| Build | 3.5 s | Las piezas construyen la fábrica, paso a paso. | Block Hero, factory Support, finite sequential entrance |
| Close | 2.9 s | Una idea puede moverlo todo. | Type-led closing with editorial negative space |

The quantity is fixture data, not a real user-video fact. Backgrounds cycle clean/grid/paper within the same light palette. The A/B uses the same synthetic narration, duration, Hero/Support SHA and role, while V2 intentionally changes typography emphasis, text completeness, layout, badge geometry and motion.

Run the pilot with `npm run build` followed by `npm run accept:editorial-explainer-light-v2`. It writes isolated evidence to `%CIPHER_LOCAL_ROOT%\_editorial-explainer-light-v2-evidence\run-*`: 9:16 and 16:9 MP4s, V1/V2 comparison HTML, contact PNG/HTML keyframes, SceneSpecs, bindings and QC in `evidence.json`. No real project or userData is used. Network is denied during resolution/render.

## Acceptance and deliberately deferred work

Directed tests check opt-in revision, historical V1 dispatch, identity changes for visible choices, data value, deterministic regeneration and the 0–1/0–2 slot limit. The acceptance checks literal visible narration, four useful-alpha raster publications, 12 local catalog entries, 18 rendered clips, zero QC errors, DPI-safe output via the productive capture path, offline rendering and final MP4s.

The pilot is **not** a normal-generation proof of automatic Hero retrieval, semantic improvement, human-approved style, audio synchronization or commercial packaging of the AI raster files. It does not change Hygiene, Relevance, cutout weights, raster catalog schema or licensing debt. Before 500 assets: review the video, decide whether the mixed raster/SVG library boundary should be unified, add a genuine asset-authoring/approval workflow, and audit the license/distribution status of all shipped imagery/weights.
