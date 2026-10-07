# Editorial Explainer V3

`editorial-explainer-v3` is an opt-in presentation profile. Its frozen visual revision is
`editorial-explainer-art-direction-2026-09-v3`. Existing V15, Editorial Explainer V1/V2,
Porcelain, Modern Pack, and Local Visual Library scenes retain their previous dispatch and
pixel identity.

## Art-direction contract

- Neutral paper world: warm ivory, white paper, subtle grid or grain.
- One accent theme per video: orange (pilot default), teal, or crimson.
- Instrument Serif for display, DM Sans for narrative copy, IBM Plex Sans Condensed for data.
- Clean and composite Heroes are separate treatments but each occupies one semantic Hero slot.
- Supports use one coherent paper-card treatment; monochrome SVGs receive ink tint.
- Connectors, microdetails, and DataRepeater are procedural and do not consume semantic slots.
- Pixel-visible choices are persisted in `lightStyle`: revision, accent, density, placement,
  type role, Hero/Support treatment, connector, microdetail variant, data variant, motion beats,
  transition, background, material, and shadow.

The renderer still consumes the existing `VisualSceneSpecV2` and `RenderBindingsV2`. V3 adds no
renderer, provider, catalog, or SceneSpec pipeline.

## Pilot assets

External read/write root:

`C:\CipherAssets\VisualLibrary\editorial-explainer-v3`

- `candidates/`: sixteen original ImageGen candidates; nine rejected and seven selected.
- `masters/`: seven untouched selected PNG masters.
- `runtime/`: seven selected transparent runtime PNGs.
- `runtime-svg/`: fourteen deterministic Lucide/ISC supports exposed through the existing
  `LocalManifestCatalog` and `CompositeVisualCatalog`.
- `metadata/assets.json`: generation provenance and curation status for every candidate.
- `metadata/hero-index.json`: scoped pilot concept index for selected raster Heroes.

The three selected composite Heroes are IDEA candidate 03, SIGNAL candidate 02, and PIECES
candidate 03. Four selected clean Heroes cover parts, camera, network, and machine. Raster
Heroes are resolved through the scoped index and then published as `ProjectAsset`; SVG supports
use the existing local catalog. Absolute paths and provenance do not enter PixelIdentity.

This split is deliberate pilot debt. Before a 100-asset production catalog, add raster entries
behind `CatalogProvider` (including alpha/dimensions/master/runtime variants) instead of growing
the scoped index or adding direct filesystem knowledge to the resolver.

## Fixed 20-second corpus

| Scene | Duration | Density | Purpose |
|---|---:|---|---|
| IDEA | 3.35 s | rich | composite Hero and progressive build |
| SIGNAL | 3.20 s | rich | transfer and connector |
| PIECES | 3.55 s | rich | system/process construction |
| 12 PARTICIPANTES | 3.20 s | editorial | literal DataRepeater |
| RED | 3.45 s | editorial | clean Hero and support cluster |
| CONEXIÓN | 3.25 s | minimal | typography-led close |

The acceptance harness renders V2 and V3 with the same narration, roles, semantic assets,
dimensions, and duration; it also renders V3 in 9:16 and 16:9, verifies deterministic replay,
blocks network access after materialization, and produces Orange/Teal/Crimson stills.

## Evidence limitation

The task attachment contained only the written brief. The three artistic target images and the
motion-reference video were not present in the attachment directory. The repository therefore
contains no fabricated target comparison and makes no claim that motion timing was matched to
an unseen reference. The generated `target-vs-v3-BLOCKED.md` records this explicitly. Technical
and self-review evidence is valid; golden-target similarity remains blocked pending those files.

## Activation

In the normal application choose **Editorial Explainer** in the visual presentation selector.
The persisted profile value is `editorial-explainer-v3`. Asset-pack selection remains an
independent setting. Historical projects are not migrated or activated automatically.

## Acceptance

Run after a fresh build:

```text
npm run test:editorial-explainer-v3
npm run accept:editorial-explainer-v3
```

The visual verdict remains `PENDING_HUMAN_REVIEW`.
