/** Visual Recovery only. Measures the actual loaded WOFF2 glyphs in the render DOM. */
export type TextFitV2Result = { fitted: boolean; stage: string; titlePx: number; bodyPx: number }

export function fitVisualTextV2(root: HTMLElement): TextFitV2Result {
  const title = root.querySelector<HTMLElement>('[data-fit-title]')
  const body = [...root.querySelectorAll<HTMLElement>('[data-fit-body]')]
  if (!title) return { fitted: false, stage: 'missing-title', titlePx: 0, bodyPx: 0 }
  const frame = root.closest<HTMLElement>('[data-visual-mvp]')
  const cq = frame ? Math.min(frame.clientWidth, frame.clientHeight) / 100 : 10.8
  const minTitle = Math.max(32, 3.2 * cq)
  const initialTitle = Math.min(11.5 * cq, Math.max(minTitle, parseFloat(getComputedStyle(title).fontSize)))
  const initialBody = body.map(item => parseFloat(getComputedStyle(item).fontSize))
  const minBody = body.map(item => item.dataset.fitData === 'true'
    ? Math.max(49, 4.6 * cq) : Math.max(30, 3.0 * cq))
  const normalFamily = title.style.fontFamily
  const overlapsAsset = (): boolean => {
    if (!frame) return false
    const word = title.getBoundingClientRect()
    for (const asset of frame.querySelectorAll<HTMLElement>('[data-qc-asset="true"]')) {
      const box = asset.getBoundingClientRect()
      const width = Math.max(0, Math.min(word.right, box.right) - Math.max(word.left, box.left))
      const height = Math.max(0, Math.min(word.bottom, box.bottom) - Math.max(word.top, box.top))
      const ratio = width * height / Math.max(1, Math.min(word.width * word.height, box.width * box.height))
      if (ratio > (asset.dataset.qcRole === 'hero' ? .2 : .3)) return true
    }
    return false
  }
  const fits = (): boolean => {
    const rootRect = root.getBoundingClientRect()
    if (root.scrollWidth > root.clientWidth + 1 || root.scrollHeight > root.clientHeight + 1) return false
    for (const element of [title, ...body]) {
      // Chromium's scrollHeight includes font ink overhang even when the line is fully
      // visible (Archivo Black: +3 px at 540x960). Horizontal overflow is real; vertical
      // clipping is checked against the outer root, which owns the clipping boundary.
      if (element.scrollWidth > element.clientWidth + 1) return false
      const rect = element.getBoundingClientRect()
      if (rect.left < rootRect.left - 1 || rect.right > rootRect.right + 1 ||
          rect.top < rootRect.top - 1 || rect.bottom > rootRect.bottom + 1) return false
    }
    // A short headline broken as RESULTAD / O is technically inside the box but fails
    // editorial reading. Reserve such single-word wraps for genuinely long words.
    const titleWord = title.textContent?.trim() ?? ''
    const lineHeight = parseFloat(getComputedStyle(title).lineHeight)
    if (!/\s/u.test(titleWord) && Array.from(titleWord).length <= 12 &&
        Number.isFinite(lineHeight) && title.clientHeight > lineHeight * 1.45) return false
    return true
  }
  const apply = (titlePx: number, factor: number) => {
    title.style.fontSize = `${titlePx.toFixed(3)}px`
    for (let index = 0; index < body.length; index++) {
      const px = Math.max(minBody[index], initialBody[index] -
        (initialBody[index] - minBody[index]) * factor)
      body[index].style.fontSize = `${px.toFixed(3)}px`
    }
  }
  // CSS does the first word/line break. The measured layout, not a character-count formula,
  // decides each subsequent reduction.
  title.style.whiteSpace = 'normal'
  title.style.wordBreak = 'normal'
  title.style.overflowWrap = 'normal'
  title.style.textWrap = 'balance'
  for (const element of body) { element.style.overflowWrap = 'break-word'; element.style.textWrap = 'balance' }
  for (const stage of ['balanced', 'long-word-wrap', 'compact-padding', 'expanded-safe-region',
    'relocate-below-assets', 'condensed'] as const) {
    if (stage === 'long-word-wrap') title.style.overflowWrap = 'anywhere'
    if (stage === 'compact-padding') { root.style.padding = '.35cqmin .5cqmin'; root.style.gap = '.32cqmin' }
    if (stage === 'expanded-safe-region' && frame) {
      const frameRect = frame.getBoundingClientRect()
      const box = root.getBoundingClientRect()
      const top = Math.max(frameRect.top + frameRect.height * .09,
        box.top - frameRect.height * .045)
      const bottom = Math.min(frameRect.top + frameRect.height * .94,
        box.bottom + frameRect.height * .045)
      if (bottom > top) {
        root.style.top = `${(top - frameRect.top).toFixed(3)}px`
        root.style.height = `${(bottom - top).toFixed(3)}px`
      }
    }
    if (stage === 'relocate-below-assets' && frame) {
      const frameRect = frame.getBoundingClientRect()
      const word = title.getBoundingClientRect()
      const candidateBottoms = [...frame.querySelectorAll<HTMLElement>('[data-qc-asset="true"]')]
        .map(asset => asset.getBoundingClientRect())
        .filter(box => box.left < word.right && box.right > word.left && box.bottom > root.getBoundingClientRect().top)
        .map(box => box.bottom)
      if (candidateBottoms.length) {
        const top = Math.max(...candidateBottoms) + 2
        const bottom = frameRect.top + frameRect.height * .94
        if (bottom - top >= frameRect.height * .18) {
          root.style.top = `${(top - frameRect.top).toFixed(3)}px`
          root.style.height = `${(bottom - top).toFixed(3)}px`
        }
      }
    }
    if (stage === 'condensed') title.style.fontFamily = "'IBM Plex Sans Condensed',sans-serif"
    for (let step = 0; step <= 14; step++) {
      const factor = step / 14
      const titlePx = Math.max(minTitle, initialTitle - (initialTitle - minTitle) * factor)
      apply(titlePx, factor)
      if (fits() && !overlapsAsset()) {
        root.dataset.qcFitFailed = 'false'
        root.dataset.qcFitStage = stage
        return { fitted: true, stage, titlePx,
          bodyPx: body.length ? Math.min(...body.map(item => parseFloat(getComputedStyle(item).fontSize))) : 0 }
      }
    }
  }
  title.style.fontFamily = normalFamily
  root.dataset.qcFitFailed = 'true'
  root.dataset.qcFitStage = 'no-legible-fit'
  root.dataset.qcFitDiagnostic = JSON.stringify({ root: [root.scrollWidth, root.clientWidth, root.scrollHeight, root.clientHeight],
    children: [title, ...body].map(element => [element.scrollWidth, element.clientWidth,
      element.scrollHeight, element.clientHeight]) })
  return { fitted: false, stage: 'no-legible-fit', titlePx: minTitle,
    bodyPx: minBody.length ? Math.min(...minBody) : 0 }
}
