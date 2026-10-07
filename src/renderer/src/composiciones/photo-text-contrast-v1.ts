import type { RuntimeRenderAssetV2, VisualSceneSpecV2 } from '../../../shared/visual-scene-spec-v2'

export type PhotoProbeV1 = NonNullable<RuntimeRenderAssetV2['photoProbe']>
export type TextContrastDecisionV1 = 'black-base' | 'light-text' | 'dark-text' | 'local-scrim'

/** One fixed-cost 64x64 probe per already-decoded local raster; no network or model. */
export function measurePhotoProbeV1(image: HTMLImageElement): PhotoProbeV1 {
  const canvas = document.createElement('canvas')
  canvas.width = 64; canvas.height = 64
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('PHOTO_PROBE_CANVAS_UNAVAILABLE')
  context.drawImage(image, 0, 0, 64, 64)
  const rgba = context.getImageData(0, 0, 64, 64).data
  const luminance: number[] = []
  const detail: number[] = []
  const at = (x: number, y: number) => {
    const offset = (y * 64 + x) * 4
    return (.2126 * rgba[offset] + .7152 * rgba[offset + 1] + .0722 * rgba[offset + 2])
  }
  for (let cellY = 0; cellY < 4; cellY++) for (let cellX = 0; cellX < 4; cellX++) {
    let sum = 0; let edge = 0; let count = 0
    for (let y = cellY * 16; y < cellY * 16 + 16; y += 2)
      for (let x = cellX * 16; x < cellX * 16 + 16; x += 2) {
        const current = at(x, y)
        sum += current
        edge += Math.abs(current - at(Math.min(63, x + 2), y)) +
          Math.abs(current - at(x, Math.min(63, y + 2)))
        count++
      }
    luminance.push(Math.round(sum / count))
    detail.push(Math.round(edge / (count * 2)))
  }
  return { luminance, detail }
}

/** Samples only the portion of a verified opaque photo underneath the materialized text box. */
export function chooseTextContrastV1(
  spec: VisualSceneSpecV2,
  runtimeAssets: readonly RuntimeRenderAssetV2[],
): TextContrastDecisionV1 {
  const text = spec.layout.textBounds
  for (const slot of spec.slots) {
    if (slot.state !== 'present' || slot.alphaMode !== 'opaque-rectangle') continue
    const layout = spec.layout.slotLayouts.find(value => value.slotId === slot.slotId)
    const probe = runtimeAssets.find(value => value.slotId === slot.slotId)?.photoProbe
    if (!layout) continue
    const photo = layout.envelope
    const x0 = Math.max(text.x, photo.x); const x1 = Math.min(text.x + text.width, photo.x + photo.width)
    const y0 = Math.max(text.y, photo.y); const y1 = Math.min(text.y + text.height, photo.y + photo.height)
    if (x1 <= x0 || y1 <= y0) continue
    const coverage = (x1 - x0) * (y1 - y0) / Math.max(1, text.width * text.height)
    // A small Support touching the text envelope must not make every glyph dark
    // against the otherwise black canvas. Local backing handles partial coverage.
    if (coverage < .1) continue
    if (coverage < .65) return 'local-scrim'
    if (!probe) return 'local-scrim'
    const values: number[] = []; const details: number[] = []
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const cx = photo.x + photo.width * (x + .5) / 4
      const cy = photo.y + photo.height * (y + .5) / 4
      if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) {
        values.push(probe.luminance[y * 4 + x]); details.push(probe.detail[y * 4 + x])
      }
    }
    if (!values.length) {
      const x = Math.min(3, Math.max(0, Math.floor(4 * ((x0 + x1) / 2 - photo.x) / photo.width)))
      const y = Math.min(3, Math.max(0, Math.floor(4 * ((y0 + y1) / 2 - photo.y) / photo.height)))
      values.push(probe.luminance[y * 4 + x]); details.push(probe.detail[y * 4 + x])
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const roughness = Math.max(...details, Math.max(...values) - Math.min(...values))
    if (roughness > 32) return 'local-scrim'
    return mean >= 185 ? 'dark-text' : mean <= 82 ? 'light-text' : 'local-scrim'
  }
  return 'black-base'
}
