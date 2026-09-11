# Cutout final gate V15

This is an isolated evidence gate for the prior `photo-cutout-spike-v1`.
It does not add a production dependency, selector, renderer, SceneSpec revision,
or model fallback.

`prepare-candidates.cjs` uses the existing Pixabay adapter to create a bounded
opaque-photo selection sheet. The final benchmark uses only those verified local
sources, the pre-existing rembg venv and the pre-existing model cache. It makes
no provider request and never writes a user project.

The frozen final run is external to Git under:

`C:\graphify\_spike-runtime\photo-cutout-final-gate-v1\runs\2026-09-11-20-07-30-104\evidence\`

The result is deliberately conservative about model weights. `rembg` says its
models have independent licenses, and the exact `u2netp.onnx` and
`isnet-general-use.onnx` release artifacts do not carry a separately verifiable
weight grant in the sources audited here. Their source repositories are Apache-2.0,
but Cipher must not infer commercial redistribution permission for the exact
weights until an auditable attribution/license document or author confirmation is
recorded.

Future asset classes may include `3D_OBJECT`, alongside OpenMoji, Solar,
photo-cutout and full raster. That is documentation only; no 3D support is added.
