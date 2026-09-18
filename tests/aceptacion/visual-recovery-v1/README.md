# Visual Recovery V1 — acceptance record

Opt-in pixel contract: `visual-recovery-v1` / `visual-recovery-2026-09-v1`.
`VERSION_PLANTILLAS` stays 15. Existing V15 and editorial-hybrid V1/V2
SceneSpecs dispatch to their historical components. The new SceneSpec stores
the explicit profile, layout, typography look and color palette; Text Fit V2 is
a deterministic DOM measurement under that immutable profile revision.

## Activate in the app

In a new/temporary project, use **Estilo de Visuales (piloto)** → **Visual
Recovery V1 (experimental)** before generating Visuales. It is not the default
for existing projects. The choice is persisted with the project and effective
profile with each new SceneSpec. The editor's TV-height/scroll issue is not
fixed by this phase; if the selector is inaccessible at that window size, use
a taller app window. UI activation has been checked in code, not manually on
the user's TV.

## Evidence

- `ab-text-composition.html`: first eight principal scenes, same words,
  duration, format, assets/SHA and slot roles before and after. Only the
  opt-in presentation differs. Provider replies are captured; opaque photos
  are local copies from the previous photo-cutout spike.
- `main-12.html`: twelve principal scenes, vertical and horizontal frames.
- `stress-8.html`: eight text stress cases, vertical and horizontal frames.
- `typography-themes.png`: five controlled font pairings using bundled WOFF2.
- `motion-entry-read-exit.html`: four representative scenes at entry, reading
  interval and exit in both aspect ratios. These are silent visual timing
  observations, not audio/word-sync validation.
- `visual-recovery-12-vertical.mp4` and `visual-recovery-12-horizontal.mp4`:
  silent 24 fps motion sequences. They are not a real user project.
- `evidence.json`: SceneSpec identity hashes, roles, QC findings, fit stages,
  render durations. No provider secrets, absolute paths or complete identities.

The acceptance rendered 20/20 scenes in each format with zero QC errors. The
separate DOM contract test checked 264 family/asset-count/text/aspect-ratio
combinations across all 17 certified families and found zero text overflow,
safe-area or severe-overlap failures. Only five families have new composition
geometry (`editorial`, `marcoPoster`, `partidoVertical`, `cintaDiagonal`,
`lineaTiempo`); all 17 use the new shared text-fit component when this profile
is selected.

Type pairing is chosen once from the video's primary color family: impact
(Anton/Archivo), clean (Outfit/Archivo), editorial (Playfair/DM Serif),
condensed (Barlow Condensed/Archivo), data (IBM Plex Sans Condensed/Space Mono).
The A/B sequence has one coherent clean video theme; the panel demonstrates
all five themes separately. Numeric data also uses a Space Mono accent.

The photo-contrast policy has deterministic tests for bright, dark, detailed
and partial-coverage probes. The current main corpus positions its full
raster in a separate visual region, so these tests do **not** constitute a
photographic light/dark/busy end-to-end contrast certification. The acceptance
does not exercise the exact long narration in the task, and no memory profile
was collected. Those evidence gaps must not be presented as a visual PASS.

## Results and limits

- Build and typecheck passed. The guarded global runner passed 33/33 once,
  then finished 32/33 on the final build: Black Foundation's historical
  exact-pixel assertion differed by 7,792 pixels. That same suite passed
  standalone after the red result, and its prior standalone run also passed.
  A separate build of the exact base commit passed the suite in a serial
  runner and in five fixed isolated attempts. The mismatch is **unattributed**,
  not proven to be caused by the recovery profile nor proven to be a base/GPU
  flake. No threshold, baseline or assertion was changed to mask it.
- DPI profile clip: passed at 1× and 2.25×. Earlier pre-change temporary
  generation gate yielded 3/3 visual timeline clips and no
  `visual-sin-fichero` at 2.25×.
- Historical Black Foundation and Color System suites each reported
  `HISTORICAL_PIXEL_DIFF=0` in directed runs; D-Final also reported zero pixel
  differences. The final serial Black Foundation failure above prevents a
  clean historical-parity gate.
- Eight matched vertical A/B scenes averaged 51.20 ms/frame before and
  51.53 ms/frame after, including local render/encode overhead. This sample
  is too small to generalize to every scene or computer.
- The text-fit minimum at 540×960 or 960×540 is 32 px for titles, 30 px for
  secondary text, 49 px for a numeric datum; longer words may switch to the
  bundled condensed family. At larger formats minima scale with `cqmin`.
- Existing OpenMoji and photos keep original color; Solar still uses system
  tint. Retrieval, Hygiene, Relevance, CutoutTransform, backgrounds and motion
  architecture were not changed.
- Silent synthetic sequences and QC cannot establish visual elegance or
  semantic suitability for a real user video. Human review is pending.

The exact local replay requires the prior spike's opaque photo corpus under
`C:\graphify\_spike-runtime\photo-cutout-v1`. Production does not depend on
that corpus. Cutout model-weight licensing remains a pre-distribution debt.
