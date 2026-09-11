# Photo Cutout Production V1

`generar.cjs` is a bounded, isolated acceptance run for the productive V15 route:

`LocalSceneSemantic → VisualConceptSet → representation decision → Pixabay → CutoutTransform → ProjectAsset → VisualSceneSpecV2 → RenderBindingsV2 → MotionGraphicV15 → QC → MP4`.

It selects five representative inputs from the frozen 20-scene corpus. Provider retrieval and the
local u2netp transform run before the network gate; rendering, QC, frames, contact sheet and MP4
run after the gate with only verified project-local bytes.

Run with a provisioned internal sidecar, for example:

```powershell
$env:CIPHER_CUTOUT_PYTHON = '...\\venv\\Scripts\\python.exe'
$env:CIPHER_CUTOUT_MODEL_CACHE = '...\\model-cache'
npm run accept:photo-cutout-production-v1
```

The output never serializes credentials. `CUTOUT_WEIGHT_LICENSE_GATE` remains
`PENDING_BEFORE_COMMERCIAL_DISTRIBUTION`; this acceptance is internal-development evidence, not
commercial redistribution approval.
