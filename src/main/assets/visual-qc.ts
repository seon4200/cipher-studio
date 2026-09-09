import type { BrowserWindow } from 'electron'
import {
  motionQcTimes,
  type PresentHeroSlotV1,
  type ProceduralHeroSlotV1,
  type VisualSceneSpecV1,
} from '../../shared/visual-scene-spec'

export type VisualQcRect = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export type VisualDomQcSnapshot = {
  normalizedTime: number
  frame: VisualQcRect | null
  hero: VisualQcRect | null
  text: VisualQcRect | null
  keyword: VisualQcRect | null
  heroOpacity: number
  keywordOpacity: number
  textColor: string | null
  textOverflow: boolean
  maxLines: string | null
  visibleWords: number
}

export type VisualRuntimeQcFinding = {
  code: string
  level: 'error' | 'needs-review'
  message: string
  normalizedTime?: number
}

export type VisualRuntimeQcReport = {
  snapshots: VisualDomQcSnapshot[]
  localTextContrast: number | null
  findings: VisualRuntimeQcFinding[]
}

export class VisualRuntimeQcError extends Error {
  code = 'VISUAL_RUNTIME_QC_REJECTED'
  constructor(public report: VisualRuntimeQcReport) {
    super('El Visual productivo no supera el QC de geometría/contraste')
    this.name = 'VisualRuntimeQcError'
  }
}

function inside(inner: VisualQcRect, outer: VisualQcRect, tolerance = 1.5): boolean {
  return inner.left >= outer.left - tolerance && inner.top >= outer.top - tolerance &&
    inner.right <= outer.right + tolerance && inner.bottom <= outer.bottom + tolerance
}

function overlapRatio(a: VisualQcRect, b: VisualQcRect): number {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  return width * height / Math.max(1, Math.min(a.width * a.height, b.width * b.height))
}

/** Pure policy over actual DOM rectangles sampled after camera, fit and motion. */
export function evaluateVisualDomQc(
  spec: VisualSceneSpecV1,
  snapshots: readonly VisualDomQcSnapshot[],
): VisualRuntimeQcFinding[] {
  const findings: VisualRuntimeQcFinding[] = []
  for (const snapshot of snapshots) {
    const at = snapshot.normalizedTime
    if (!snapshot.frame) {
      findings.push({ code: 'VISUAL_QC_FRAME_MISSING', level: 'error', message: 'No existe lienzo medible', normalizedTime: at })
      continue
    }
    if (!snapshot.text || !snapshot.keyword) {
      findings.push({ code: 'VISUAL_QC_TEXT_MISSING', level: 'error', message: 'Falta texto editorial o keyword', normalizedTime: at })
      continue
    }
    const frame = snapshot.frame
    const safeText: VisualQcRect = {
      left: frame.left + frame.width * .0833,
      right: frame.right - frame.width * .0833,
      top: frame.top + frame.height * .1354,
      bottom: frame.bottom - frame.height * .1354,
      width: frame.width * (1 - .1666),
      height: frame.height * (1 - .2708),
    }
    if (!inside(snapshot.text, frame) || !inside(snapshot.keyword, safeText))
      findings.push({ code: 'VISUAL_QC_TEXT_BOUNDS', level: 'error', message: 'Texto fuera de la zona segura', normalizedTime: at })
    if (snapshot.textOverflow || snapshot.maxLines !== '2' || snapshot.visibleWords > 8)
      findings.push({ code: 'VISUAL_QC_TEXT_OVERFLOW', level: 'error', message: 'Texto recortado o fuera del presupuesto V1', normalizedTime: at })

    if (spec.visualMode === 'asset-led') {
      if (!snapshot.hero) {
        findings.push({ code: 'VISUAL_QC_HERO_MISSING', level: 'error', message: 'Hero present no llegó al DOM', normalizedTime: at })
      } else {
        if (!inside(snapshot.hero, frame))
          findings.push({ code: 'VISUAL_QC_HERO_FRAME', level: 'error', message: 'Hero sale del frame durante el motion', normalizedTime: at })
        if (snapshot.heroOpacity > .5 && snapshot.keywordOpacity > .5 &&
            overlapRatio(snapshot.hero, snapshot.keyword) > .18)
          findings.push({ code: 'VISUAL_QC_HERO_TEXT_OVERLAP', level: 'error', message: 'Hero tapa en exceso la keyword', normalizedTime: at })
      }
    } else if (snapshot.hero) {
      findings.push({ code: 'VISUAL_QC_EDITORIAL_HAS_HERO', level: 'error', message: 'editorial-text no puede montar Hero', normalizedTime: at })
    }
  }
  return findings
}

function srgb(channel: number): number {
  const value = channel / 255
  return value <= .04045 ? value / 12.92 : Math.pow((value + .055) / 1.055, 2.4)
}

function luminance(red: number, green: number, blue: number): number {
  return .2126 * srgb(red) + .7152 * srgb(green) + .0722 * srgb(blue)
}

function contrast(a: number, b: number): number {
  const high = Math.max(a, b)
  const low = Math.min(a, b)
  return (high + .05) / (low + .05)
}

function parseCssRgb(value: string | null): [number, number, number] | null {
  const match = value?.match(/rgba?\(\s*(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/i)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

async function localKeywordContrast(
  window: BrowserWindow,
  snapshot: VisualDomQcSnapshot,
): Promise<number | null> {
  const textRgb = parseCssRgb(snapshot.textColor)
  if (!snapshot.keyword || !textRgb) return null
  await window.webContents.executeJavaScript('window.__hideVisualTextForQc(true)')
  try {
    const image = await window.webContents.capturePage()
    const bitmap = image.getBitmap() // Electron exposes BGRA, as used by renderGraphicClip.
    const size = image.getSize()
    const x0 = Math.max(0, Math.floor(snapshot.keyword.left + 2))
    const y0 = Math.max(0, Math.floor(snapshot.keyword.top + 2))
    const x1 = Math.min(size.width - 1, Math.ceil(snapshot.keyword.right - 2))
    const y1 = Math.min(size.height - 1, Math.ceil(snapshot.keyword.bottom - 2))
    const textLuminance = luminance(textRgb[0], textRgb[1], textRgb[2])
    const ratios: number[] = []
    for (let y = y0; y <= y1; y += 6) {
      for (let x = x0; x <= x1; x += 6) {
        const offset = (y * size.width + x) * 4
        ratios.push(contrast(textLuminance, luminance(bitmap[offset + 2], bitmap[offset + 1], bitmap[offset])))
      }
    }
    if (!ratios.length) return null
    ratios.sort((a, b) => a - b)
    // The lower decile rejects a locally unreadable patch without letting one decorative pixel
    // dictate the whole result.
    return ratios[Math.floor((ratios.length - 1) * .1)]
  } finally {
    await window.webContents.executeJavaScript('window.__hideVisualTextForQc(false)')
  }
}

/** Executes the productive QC against the exact DOM that will feed FFmpeg. */
export async function runVisualRuntimeQc(
  window: BrowserWindow,
  spec: VisualSceneSpecV1,
  duration: number,
): Promise<VisualRuntimeQcReport> {
  const hero = spec.slots.find((slot): slot is PresentHeroSlotV1 | ProceduralHeroSlotV1 =>
    slot.state === 'present' || slot.state === 'procedural')
  const times = hero ? motionQcTimes(hero.motion) : [0, .2, .5, .8, 1]
  const snapshots: VisualDomQcSnapshot[] = []
  for (const normalizedTime of times) {
    await window.webContents.executeJavaScript(`window.__setT(${normalizedTime * duration})`)
    const dom = await window.webContents.executeJavaScript('window.__visualQc()')
    snapshots.push({ normalizedTime, ...dom } as VisualDomQcSnapshot)
  }
  const findings = evaluateVisualDomQc(spec, snapshots)
  const middle = snapshots.reduce((best, current) =>
    Math.abs(current.normalizedTime - .5) < Math.abs(best.normalizedTime - .5) ? current : best,
  snapshots[0])
  const localTextContrast = middle ? await localKeywordContrast(window, middle) : null
  if (localTextContrast === null) {
    findings.push({ code: 'VISUAL_QC_CONTRAST_UNAVAILABLE', level: 'needs-review', message: 'No se pudo medir contraste local' })
  } else if (localTextContrast < 3) {
    findings.push({ code: 'VISUAL_QC_CONTRAST_LOCAL', level: 'error', message: `Contraste local p10=${localTextContrast.toFixed(2)} < 3` })
  } else if (localTextContrast < 4.5) {
    findings.push({ code: 'VISUAL_QC_CONTRAST_LOCAL', level: 'needs-review', message: `Contraste local p10=${localTextContrast.toFixed(2)} < 4.5` })
  }
  await window.webContents.executeJavaScript('window.__setT(0)')
  const report = { snapshots, localTextContrast, findings }
  if (findings.some(finding => finding.level === 'error')) throw new VisualRuntimeQcError(report)
  return report
}
