# V15 photo-cutout feasibility acceptance

This acceptance harness validates an **external, local** background-removal
worker against the existing V15 production path. It is deliberately not a
production provider, selector, renderer, or packaged Python dependency.

The runner uses existing Pixabay image retrieval only to obtain a bounded,
eight-source corpus. It then persists the raw sources, model cache, cutouts,
MP4s, provenance, performance data, and contact sheets **outside Git** under
the configured `CUTOUT_SPIKE_ROOT` (default:
`C:\graphify\_spike-runtime\photo-cutout-v1`). It never writes a real user
project.

The completed reference run is:

`runs/2026-09-11-06-18-11-623/evidence/`

Its notable evidence is:

- `performance.json`: model download, cold load, cold inference, warm
  median/p95, RSS, alpha metrics, and file/RGBA determinism.
- `provenance.json`: selected Pixabay source IDs, SHA-256 values and the
  selected cutout's ProjectAsset relationship; no credentials are serialized.
- `contact-sheet-cutout-quality.png`: source, u2netp, and isnet-general-use
  composited on black, white, and checker surfaces.
- `quality-review.json`: a technical GOOD/ACCEPTABLE/BAD rubric recorded from
  that fixed sheet, without changing the model or its parameters afterward.
- `contact-sheet-motion-integration.png`, `end-to-end-cutout-hero.mp4`, and
  `end-to-end-cutout-halo.mp4`: ordinary V15 Hero/Support composition using
  verified local bytes after publication.
- `missing-cutout-fallback.mp4`: controlled deletion inside the temporary
  fixture resolves to editorial fallback with a different PixelIdentity rather
  than serving the present-asset cache.

Run the deterministic contract gate with:

```powershell
npm run test:photo-cutout-spike-v1
```

`npm run accept:photo-cutout-spike-v1` is a bounded live evidence run. Do not
rerun it simply to inspect a completed run: it queries Pixabay and downloads
the corpus anew by design.

The spike conclusion is intentionally conditional: `isnet-general-use` is the
recommended quality model on this machine, but package code licensing and the
separate redistribution status of model weights still require product/legal
review before it becomes a Cipher runtime dependency.
