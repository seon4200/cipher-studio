import React from 'react'
import type { VisualSceneSpecV2 } from '../../../shared/visual-scene-spec-v2'
import type { BackgroundVariantV2, MotionPrimitiveV2 } from '../../../shared/families-motion-v2'

const fraction = (u: number, start: number, span: number) => Math.max(0, Math.min(1, (u - start) / span))
const smooth = (u: number, start: number, span: number) => {
  const p = fraction(u, start, span); return p * p * (3 - 2 * p)
}
type Palette = { background: string; surface: string; accent: string; support: string; line: string }

/** Procedural paint only; no network, image, font, or new rendering surface. */
export function backgroundImageV2(variant: BackgroundVariantV2, palette: Palette): string {
  const edge = `${palette.line}18`
  switch (variant) {
    case 'solid-deep': return 'none'
    case 'soft-radial': return `radial-gradient(ellipse at 73% 34%,${palette.accent}19 0,transparent 48%)`
    case 'directional-gradient': return `linear-gradient(125deg,${palette.surface}90 0,transparent 52%,${palette.accent}11 100%)`
    case 'subtle-grid': return `linear-gradient(${edge} 1px,transparent 1px),linear-gradient(90deg,${edge} 1px,transparent 1px)`
    case 'fine-lines': return `repeating-linear-gradient(112deg,transparent 0 14cqmin,${edge} 14cqmin 14.1cqmin)`
    case 'soft-vignette': return `radial-gradient(ellipse at center,transparent 22%,#05050699 100%)`
    case 'editorial-shape': return `radial-gradient(ellipse at 91% 21%,${palette.support}16 0 20%,transparent 20.2%)`
    case 'image-aware-darkening': return `linear-gradient(90deg,#0B0B0DDD 0,${palette.background}55 43%,transparent 100%)`
  }
}

export function assetMotionV2(variant: MotionPrimitiveV2, role: 'hero' | 'support-1' | 'support-2', u: number) {
  const position = role === 'hero' ? 0 : role === 'support-1' ? 1 : 2
  const start = variant === 'pairedCompare' ? (position === 0 ? .09 : .16)
    : variant === 'timelineBuild' || variant === 'staggerCluster' ? .07 + position * .13
      : variant === 'lineDraw' ? .28 + position * .09
        : .06 + position * .12
  const p = smooth(u, start, .16)
  const exit = 1 - smooth(u, .86, .11)
  const horizontal = variant === 'pairedCompare' ? (position === 0 ? -2.3 : 2.3) * (1 - p)
    : variant === 'slideSoft' ? -1.7 * (1 - p) : 0
  const vertical = variant === 'timelineBuild' ? -1.1 * (1 - p) : 1.4 * (1 - p)
  const scale = variant === 'scaleSettle' && position === 0 ? .96 + .04 * p : .985 + .015 * p
  const clipPath = variant === 'maskReveal' ? `inset(0 ${(100 * (1 - p)).toFixed(2)}% 0 0)` : undefined
  return { transform: `translate(-50%,-50%) translate3d(${horizontal.toFixed(3)}cqmin,${vertical.toFixed(3)}cqmin,0) scale(${scale.toFixed(4)})`,
    opacity: p * exit, clipPath }
}

/** A few semantic marks consume the active slots; absent supports never create fake nodes. */
export const FamilyV2AccentGraphics: React.FC<{ spec: VisualSceneSpecV2; u: number; accent: string }> =
  ({ spec, u, accent }) => {
  const plan = spec.compositionV2
  if (!plan) return null
  const draw = smooth(u, plan.motionCue === 'data' ? .22 : .2, .2)
  const leave = 1 - smooth(u, .87, .1)
  const slots = spec.layout.slotLayouts
  const hero = slots.find(slot => slot.slotId === 'hero')?.envelope
  const caption = spec.layout.textBounds
  const centers = slots.map(slot => [slot.envelope.x + slot.envelope.width / 2,
    slot.envelope.y + slot.envelope.height / 2] as const)
  const literalPercent = /\b(\d{1,3}(?:[.,]\d+)?)\s*%/u.exec(spec.text.closing ?? '')
  const confirmedPercent = spec.editorialData?.percent ?? (literalPercent
    ? Number(literalPercent[1].replace(',', '.')) : NaN)
  const hasConfirmedPercent = Number.isFinite(confirmedPercent) && confirmedPercent >= 0 && confirmedPercent <= 100
  const dataLineX = caption.x + 2
  const dataLineY = Math.min(93, caption.y + caption.height * .82)
  const line = { fill: 'none', stroke: accent, strokeWidth: .34, opacity: .8 * leave,
    pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - draw }
  const make = plan.accentGraphics.map((mark, index) => {
    if (mark === 'divider') return <line key={index} x1="50" y1="17" x2="50" y2="68" {...line} />
    if (mark === 'connector' && plan.motionCue === 'timeline' && centers.length >= 2) {
      const y = caption.y - 5
      return <g key={index}><line x1={centers[0][0]} y1={y} x2={centers[centers.length - 1][0]} y2={y} {...line} />
        {centers.map(([x],step) => <circle key={step} cx={x} cy={y} r=".72" fill={accent}
          opacity={smooth(u,.15+step*.12,.15)*leave} />)}</g>
    }
    if (mark === 'connector' || mark === 'directional-line') return centers.length >= 2
      ? <polyline key={index} points={centers.map(center => center.join(',')).join(' ')} {...line} /> : null
    if (mark === 'progress-line' && hasConfirmedPercent) return <line key={index} x1={dataLineX} y1={dataLineY}
      x2={dataLineX + confirmedPercent*.42} y2={dataLineY} {...line} />
    if (mark === 'numeric-marker' && hasConfirmedPercent) {
      const x=dataLineX+confirmedPercent*.42
      return <line key={index} x1={x} y1={dataLineY-3} x2={x} y2={dataLineY+3} {...line} />
    }
    if (mark === 'corner-frame' && hero) return <path key={index}
      d={`M${hero.x} ${hero.y+11}V${hero.y}H${hero.x+13} M${hero.x+hero.width-13} ${hero.y}H${hero.x+hero.width}V${hero.y+11}`} {...line} />
    if (mark === 'bracket' && hero) {
      const x=Math.max(6,hero.x-2),y=hero.y+hero.height/2
      return <path key={index} d={`M${x} ${y}V${y-10}H${x+5} M${x} ${y}V${y+10}H${x+5}`} {...line} />
    }
    if (mark === 'underline') return <line key={index} x1={caption.x+2} y1={caption.y+caption.height-3}
      x2={Math.min(94,caption.x+caption.width*.42)} y2={caption.y+caption.height-3} {...line} />
    return null
  })
  return <svg aria-hidden="true" data-qc-structure-mark={spec.layout.family} viewBox="0 0 100 100"
    preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
      zIndex: 1, pointerEvents: 'none' }}>{make}</svg>
}
