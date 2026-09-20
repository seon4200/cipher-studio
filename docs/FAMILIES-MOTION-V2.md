# Families + Motion + Composition V2 (opt-in)

This phase adds the explicit `families-motion-v2` presentation profile. Its
revision is `families-motion-2026-09-v1`; the frozen composition revision is
`composition-17-2026-09-v1`. `VERSION_PLANTILLAS` remains 15. A project without
this profile still dispatches to its previous renderer path. Do not alter a
registered revision's pixels; add a new revision for subsequent art changes.

## Authority and activation

In the editor's Visuales controls, set **Estilo de Visuales (piloto)** to
**Families + Motion V2 (experimental)** before generating Visuales. The asset
pack remains a separate control. This choice persists as the project's
presentation profile; generated
SceneSpecs additionally persist `compositionV2`: layout variant, landscape
geometry, background variant, motion cue/variant, and accent graphics. The
whole visible plan participates in the existing SceneSpec pixel identity. The
renderer receives local ProjectAssets and bindings, never catalog queries.
Semantic concept, photo policy, relevance, hygiene, cutout, pack and local
library ranking are unchanged. The profile is not the default for old projects.

## Presentation contract

There are 12 reusable composition variants, 8 local CSS-only procedural
backgrounds, and 9 finite motion primitives. The same 17 family IDs remain;
each has portrait and landscape geometry instead of scaled coordinates. The
video palette selects a coherent three-background group; a consecutive repeat
is avoided when alternatives exist. Opaque context photographs use an
original-color image layer in this new profile so their intrinsic aspect ratio
does not get letterboxed twice. Existing profiles retain the SVG path.

One semantic accent graphic is selected per scene: a divider for comparison,
connector for a real timeline/relationship, directional line for process,
real confirmed percentage marker for data, or a restrained bracket/underline.
No missing Support is imitated by an accent. Entries settle before the reading
interval and leave near the end; short scenes compress movement rather than
adding a new animation architecture. Photo/cutout Heroes are given wider
fields; icons remain color-correct and are not scaled to fill the frame merely
because they occupy the Hero slot.

The V2-only QC adds review warnings for visibly overlapping assets and an
excessively small combined text/asset footprint. It does not fill empty space
or alter historical QC. Text Fit and existing hard safe-area checks remain
authoritative. These inexpensive warnings are not an aesthetic verdict.

## Evidence and limitations

`npm run test:families-motion-v2` checks 17 layouts in both formats, all eight
background recipes, deterministic plan and identity, direct OpenMoji/Solar
provider preservation, and render/QC smoke.
`npm run accept:families-motion-v2-backgrounds` paints all eight variants.
`npm run accept:families-motion-v2-photos` uses captured Pixabay responses and
three opaque local photos supplied by environment variables; it does not make
HTTP requests. `npm run accept:families-motion-v2` covers 17 family cases, 12
narrative cases and 8 stress cases, then creates 12 A/B renders with identical
text, slot content SHA, Porcelain palette and duration. Evidence is written
outside this repository to `C:/graphify/_families-motion-v2-evidence`.

The two videos contain 18 synthetic scenes each, including the three photo
cases, at 24 fps. They have no narration and do not validate audio timing or
prove semantic selection on a user's real video. The photo cases reuse sources
from the earlier cutout spike and captured provider responses; they are test
evidence, not shipped assets. Portrait and landscape videos, all scene clips,
contact galleries, `evidence.json`, `metrics.json`, `photos.json`, and
`background-variants.json` are review artifacts outside the repository.
The before/after timing in `metrics.json` compares only the same 12 controlled
A/B scenes at 24 fps; the all-scene after average is reported separately.
The structural family grid deliberately repeats camera/robot/phone; it should
not be read as proof of asset variety. A few mono-asset or type-led frames keep
large negative space, and some small Supports may still need art-direction
feedback despite passing geometry/QC. Motion is judged without narration or
word-level audio alignment. Visual elegance still requires human approval.
Photo weight licensing remains the documented pre-distribution debt.
