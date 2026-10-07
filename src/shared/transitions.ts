export type TransitionClip = { id: string; type: string; startSeconds: number };

export const CIPHER_DEFAULT_TRANSITIONS = [
  'fade','dissolve','morph','CrossZoom','pixelize','GlitchDisplace','ripple','crosswarp','fadegrayscale',
  'fadecolor','burn','luma','flyeye','randomsquares','wipeUp','LinearBlur','colorphase','rotate_scale_fade',
  'multiply_blend','kaleidoscope','powerKaleido','TVStatic','static_wipe','SimpleZoom','SimpleZoomOut',
  'zoomInOut','StereoViewer','displacement','DirectionalScaled','HSVfade','StaticFade','parametric_glitch',
  'mosaic_transition','ButterflyWaveScrawler','old_tv_lost_signal','DefocusBlur','directionalwipe','Revolve_Left'
] as const;

/** Cipher's existing evenly-spaced, shuffled transition assignment. */
export function assignCipherTransitions(clips: TransitionClip[], coverage: number, selected: string[]) {
  const videos = clips.filter(clip => clip.type !== 'audio' && clip.type !== 'graphic')
    .sort((a, b) => a.startSeconds - b.startSeconds);
  const totalCuts = videos.length - 1;
  if (totalCuts <= 0 || coverage <= 0 || selected.length === 0) return {};
  const count = Math.round((coverage / 100) * totalCuts);
  const shuffle = (values: string[]) => {
    const items = [...values];
    for (let index = items.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [items[index], items[other]] = [items[other], items[index]];
    }
    return items;
  };
  let queue = shuffle(selected);
  let previous = '';
  const next = () => {
    if (queue.length === 0) {
      queue = shuffle(selected);
      if (queue[0] === previous && queue.length > 1) {
        const other = Math.floor(Math.random() * (queue.length - 1)) + 1;
        [queue[0], queue[other]] = [queue[other], queue[0]];
      }
    }
    previous = queue.shift()!;
    return previous;
  };
  const assigned: Record<string, string> = {};
  for (let index = 0; index < count; index++) {
    const cut = Math.min(totalCuts - 1, Math.floor(((index + 0.5) * totalCuts) / count));
    assigned[videos[cut].id + '->' + videos[cut + 1].id] = next();
  }
  return assigned;
}
