import React, { useLayoutEffect, useRef } from 'react'
import type { VisualSceneSpecV2 } from '../../../shared/visual-scene-spec-v2'
import { LIGHT_COLORS_V1 as C } from '../../../shared/editorial-explainer-light-v1'
import { fitVisualTextV2 } from './text-fit-v2'

const ease = (v: number) => { const u = Math.max(0, Math.min(1, v)); return u * u * (3 - 2 * u) }
const phase = (u: number, start: number, span: number) => ease((u - start) / span)

/** Circle stays a circle in portrait and landscape; V1's slot-sized badge is untouched. */
export const EditorialLightV2Badge: React.FC<{ originalColor: boolean; children: React.ReactNode }> =
  ({ originalColor, children }) => <div data-light-v2-badge="true"
    style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
    <div style={{ width: 'min(100%, 15cqmin)', height: 'min(100%, 15cqmin)', aspectRatio: 1,
      boxSizing: 'border-box', display: 'grid', placeItems: 'center', padding: '22%', borderRadius: '50%',
      background: originalColor ? C.white : C.ink,
      border: originalColor ? `1px solid ${C.grid}` : 'none',
      boxShadow: '0 .3cqmin .5cqmin rgba(17,17,15,.18), .8cqmin 1.25cqmin 2cqmin rgba(17,17,15,.10)' }}>{children}</div>
  </div>

/** Geometry comes from the frozen SceneSpec layouts, never from a per-frame decision. */
export const EditorialLightV2Connector: React.FC<{ spec: VisualSceneSpecV2; u: number }> = ({ spec, u }) => {
  const plan = spec.lightStyle?.connector
  if (!plan) return null
  const a = spec.layout.slotLayouts.find(slot => slot.slotId === 'hero')?.envelope
  const b = spec.layout.slotLayouts.find(slot => slot.slotId === 'support-1')?.envelope
  if (!a || !b) return null
  const sx = a.x + a.width, sy = a.y + a.height * .50
  const ex = b.x, ey = b.y + b.height * .50
  const d = plan.variant === 'curved' ? `M${sx} ${sy} C${sx + 5} ${sy - 4},${ex - 5} ${ey - 4},${ex} ${ey}`
    : `M${sx} ${sy} L${ex} ${ey}`
  const progress = plan.state === 'draw' ? phase(u, .28, .25) : 1
  return <svg data-light-v2-connector={plan.variant} viewBox="0 0 100 100" preserveAspectRatio="none"
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 3,
      opacity: 1 - phase(u, .90, .08), pointerEvents: 'none' }}>
    {plan.arrow && <defs><marker id="light-arrow-v2" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5"
      markerHeight="5" orient="auto"><path d="M0 0L8 4 0 8" fill={C.orangeDepth} /></marker></defs>}
    <path d={d} fill="none" stroke={C.orangeDepth} strokeWidth=".54"
      strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={(1 - progress) * 100}
      markerEnd={plan.arrow && progress > .97 ? 'url(#light-arrow-v2)' : undefined} />
    <circle cx={sx} cy={sy} r=".65" fill={C.orangeDepth} opacity={progress} />
  </svg>
}

export const EditorialLightV2DataRepeater: React.FC<{ spec: VisualSceneSpecV2; u: number }> = ({ spec, u }) => {
  const d = spec.lightStyle?.dataRepeater
  if (!d) return null
  const shown = Math.floor(d.tokenCount * phase(u, .20, .33))
  return <div data-light-v2-repeater="true" data-qc-data-count={d.confirmedValue}
    style={{ position: 'absolute', left: '12%', top: '49%', width: '76%', height: '37%', zIndex: 3,
      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2.4cqmin', pointerEvents: 'none' }}>
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(6, d.tokenCount)},1fr)`,
      gap: '2.3cqmin', alignItems: 'center', justifyItems: 'center' }}>
      {Array.from({ length: d.tokenCount }, (_, i) => <div key={i} style={{ width: '6cqmin', height: '6cqmin',
        display: 'grid', placeItems: 'center', borderRadius: '50%', boxSizing: 'border-box',
        border: `1px solid ${C.grid}`, background: i < shown ? (i % 4 === 0 ? C.orange : C.ink) : C.white,
        opacity: i < shown ? 1 : .18, transform: `translateY(${i < shown ? 0 : .8}cqmin)`,
        boxShadow: i < shown ? '0 .25cqmin .45cqmin rgba(17,17,15,.17), .7cqmin .9cqmin 1.7cqmin rgba(17,17,15,.08)' : 'none' }}>
        <svg viewBox="0 0 24 30" aria-hidden="true" style={{ width: '56%', height: '66%' }}>
          <circle cx="12" cy="6" r="4" fill={C.white} />
          <path d="M5 27v-8c0-4 3-6 7-6s7 2 7 6v8Z" fill={C.white} />
        </svg>
      </div>)}
    </div>
    <span data-qc-text-glyph="true" style={{ font: "600 2.8cqmin 'IBM Plex Sans Condensed',sans-serif",
      letterSpacing: '.08em', color: C.ink, fontSynthesis: 'none' }}>{d.label.toUpperCase()}</span>
  </div>
}

export const EditorialLightV2Text: React.FC<{ spec: VisualSceneSpecV2; u: number }> = ({ spec, u }) => {
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { if (root.current) fitVisualTextV2(root.current) }, [spec])
  const t = spec.text
  const cue = spec.lightStyle?.motionCue
  const reveal = phase(u, cue === 'statement' ? .04 : cue === 'count' ? .09 : .19, .16)
  const exit = 1 - phase(u, .89, .09)
  const visibleWords = [t.connector, t.keyword, t.closing].filter(Boolean).join(' ').split(/\s+/u).filter(Boolean).length
  return <div ref={root} data-qc-text="true" data-qc-text-fit="v2" data-qc-max-lines={t.maxLines}
    data-qc-visible-words={visibleWords} data-qc-text-region={spec.layout.textRegion}
    data-qc-keyword-family="Instrument Serif" data-qc-contrast-treatment="dark-text"
    style={{ position: 'absolute', left: `${spec.layout.textBounds.x}%`, top: `${spec.layout.textBounds.y}%`,
      width: `${spec.layout.textBounds.width}%`, height: `${spec.layout.textBounds.height}%`, zIndex: 8,
      boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'stretch', gap: '.75cqmin', padding: '.6cqmin',
      color: C.ink, textAlign: t.alignment, fontSynthesis: 'none', opacity: exit, pointerEvents: 'none' }}>
    {t.connector && <div data-fit-body="true" data-qc-text-glyph="true" data-qc-connector="true"
      style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: '3.3cqmin', lineHeight: 1.2,
        opacity: phase(u, .11, .16), flexShrink: 0 }}>{t.connector}</div>}
    <div data-fit-title="true" data-qc-text-glyph="true" data-qc-keyword="true"
      style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400,
        fontSize: cue === 'count' ? '11.8cqmin' : '10.8cqmin', lineHeight: 1.02,
        color: cue === 'count' ? C.ink : C.orangeDepth, flexShrink: 0, opacity: reveal,
        transform: `translateY(${((1 - reveal) * 1.4).toFixed(3)}cqmin)` }}>{t.keyword}</div>
    {t.closing && <div data-fit-body="true" data-qc-text-glyph="true" data-qc-closing="true"
      style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 400, fontSize: '3.2cqmin',
        lineHeight: 1.2, flexShrink: 0, opacity: phase(u, cue === 'count' ? .42 : .36, .16) }}>{t.closing}</div>}
    <div data-qc-text-glyph="true" style={{ width: '21%', height: '.2cqmin', flexShrink: 0,
      marginTop: '.5cqmin', background: C.orange, transform: `scaleX(${phase(u, .48, .14).toFixed(4)})`,
      transformOrigin: '0 50%' }} />
  </div>
}
