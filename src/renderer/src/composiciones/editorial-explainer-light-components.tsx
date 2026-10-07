import React, { useLayoutEffect, useRef } from 'react'
import type { VisualSceneSpecV2 } from '../../../shared/visual-scene-spec-v2'
import { LIGHT_COLORS_V1 } from '../../../shared/editorial-explainer-light-v1'
import { fitVisualTextV2 } from './text-fit-v2'

const C = LIGHT_COLORS_V1
const ease = (n: number) => { const p = Math.max(0, Math.min(1, n)); return p * p * (3 - 2 * p) }
const phase = (u: number, start: number, span: number) => ease((u - start) / span)
const raised = { boxShadow: '0 .34cqmin .52cqmin rgba(17,17,15,.20), 1.15cqmin 1.65cqmin 3.4cqmin rgba(17,17,15,.11)' } as const

export const EditorialHeroTile: React.FC<{ variant: 'orange-raised' | 'black-raised' | 'neutral-raised'; material: 'flat-editorial' | 'raised-object'; children: React.ReactNode }> =
  ({ variant, material, children }) => <div data-light-component="hero-tile" style={{ width: '100%', height: '100%',
    display: 'grid', placeItems: 'center', boxSizing: 'border-box', padding: '10%', borderRadius: '14%',
    background: variant === 'orange-raised' ? `linear-gradient(145deg,#FF8952 0%,${C.orange} 55%,${C.orangeDepth} 100%)`
      : variant === 'black-raised' ? `linear-gradient(145deg,#30302D,${C.ink})`
        : `linear-gradient(145deg,${C.white},${C.ivory})`,
    border: variant === 'orange-raised' ? `1px solid ${C.orangeDepth}` : '1px solid rgba(17,17,15,.12)',
    ...(material === 'raised-object' ? raised : {}) }}>{children}</div>

export const EditorialIconBadge: React.FC<{ variant: 'orange-tile' | 'black-circle' | 'original-color'; material: 'flat-editorial' | 'raised-object'; children: React.ReactNode }> =
  ({ variant, material, children }) => <div data-light-component="icon-badge" style={{ width: '100%', height: '100%',
    display: 'grid', placeItems: 'center', boxSizing: 'border-box', padding: '18%',
    borderRadius: variant === 'black-circle' ? '50%' : '22%',
    background: variant === 'black-circle' ? C.ink : variant === 'orange-tile'
      ? `linear-gradient(145deg,#FF8952,${C.orangeDepth})` : C.white,
    border: variant === 'original-color' ? '1px solid rgba(17,17,15,.11)' : 'none',
    ...(material === 'raised-object' ? raised : {}) }}>{children}</div>

export const EditorialCard: React.FC<{ variant: 'light' | 'dark'; material: 'flat-editorial' | 'raised-object'; children: React.ReactNode }> =
  ({ variant, material, children }) => <div data-light-component="card" style={{ color: variant === 'light' ? C.ink : C.white,
    background: variant === 'light' ? C.white : C.ink, borderRadius: '1.7cqmin',
    border: '1px solid rgba(17,17,15,.12)', padding: '2.1cqmin 2.5cqmin',
    ...(material === 'raised-object' ? raised : {}) }}>{children}</div>

export const EditorialLabel: React.FC<{ variant: 'light' | 'dark' | 'orange-accent'; children: React.ReactNode }> =
  ({ variant, children }) => <span data-light-component="label" style={{ display: 'inline-block',
    fontFamily: "'IBM Plex Sans Condensed',sans-serif", fontWeight: 700,
    letterSpacing: '.08em', color: variant === 'light' ? C.white : variant === 'orange-accent' ? C.orangeDepth : C.ink,
    fontSynthesis: 'none' }}>{children}</span>

export const EditorialConnector: React.FC<{ spec: VisualSceneSpecV2; u: number }> = ({ spec, u }) => {
  const plan = spec.lightStyle?.connector
  if (!plan) return null
  const layouts = spec.layout.slotLayouts
  const start = layouts.find(item => item.slotId === 'hero')?.envelope
  const end = layouts.find(item => item.slotId === 'support-1')?.envelope
  if (!start || !end) return null
  const sx = start.x + start.width, sy = start.y + start.height / 2
  const ex = end.x, ey = end.y + end.height / 2
  const d = plan.variant === 'curved' ? `M${sx} ${sy} Q${(sx + ex) / 2} ${Math.min(sy, ey) - 12} ${ex} ${ey}`
    : `M${sx} ${sy} L${ex} ${ey}`
  const reveal = plan.state === 'draw' ? phase(u, .22, .26) : 1
  const depart = 1 - phase(u, .86, .11)
  return <svg data-light-component="connector" viewBox="0 0 100 100" preserveAspectRatio="none"
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2,
      opacity: depart, pointerEvents: 'none' }}>
    {plan.arrow && <defs><marker id="light-arrow-v1" viewBox="0 0 8 8" refX="7" refY="4"
      markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L8 4 0 8" fill={C.orangeDepth} /></marker></defs>}
    <path d={d} fill="none" stroke={C.orangeDepth} strokeWidth=".55" pathLength="1"
      strokeDasharray="1" strokeDashoffset={1 - reveal} markerEnd={plan.arrow && reveal > .97 ? 'url(#light-arrow-v1)' : undefined} />
  </svg>
}

export const EditorialDataRepeater: React.FC<{ spec: VisualSceneSpecV2; u: number }> = ({ spec, u }) => {
  const d = spec.lightStyle?.dataRepeater
  if (!d) return null
  const reveal = phase(u, .17, .36)
  const count = Math.floor(d.tokenCount * reveal)
  return <div data-light-component="data-repeater" data-qc-data-count={d.confirmedValue}
    style={{ position: 'absolute', left: '14%', top: '55%', width: '72%', height: '32%', zIndex: 3,
      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.2cqmin', pointerEvents: 'none' }}>
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(6, d.tokenCount)},1fr)`,
      gap: '1.5cqmin', justifyItems: 'center', alignItems: 'center' }}>
      {Array.from({ length: d.tokenCount }, (_, i) => <svg key={i} viewBox="0 0 24 30" aria-hidden="true"
        style={{ width: '3.7cqmin', height: '4.6cqmin', opacity: i < count ? 1 : .10,
          transform: `translateY(${i < count ? 0 : 1.2}cqmin)` }}>
        <circle cx="12" cy="6" r="4" fill={i % 4 === 0 ? C.orange : C.ink} />
        <path d="M5 27v-8c0-4 3-6 7-6s7 2 7 6v8Z" fill={i % 4 === 0 ? C.orange : C.ink} />
      </svg>)}
    </div>
    <EditorialLabel variant="dark">{d.label.toUpperCase()}</EditorialLabel>
  </div>
}

export const EditorialLightBackground: React.FC<{ spec: VisualSceneSpecV2 }> = ({ spec }) => {
  const variant = spec.lightStyle!.background
  return <div data-qc-background-family={variant} data-qc-background-motion="none"
    style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundColor: variant === 'white-soft-paper' ? C.white : C.ivory,
      backgroundImage: variant === 'ivory-subtle-grid'
        ? `linear-gradient(${C.grid}26 1px,transparent 1px),linear-gradient(90deg,${C.grid}26 1px,transparent 1px)`
        : variant === 'white-soft-paper'
          ? `radial-gradient(circle at 25% 20%,${C.grid}18 0 1px,transparent 1.2px)` : 'none',
      backgroundSize: variant === 'ivory-subtle-grid' ? '10cqmin 10cqmin' : '3cqmin 3cqmin' }} />
}

export const EditorialLightText: React.FC<{ spec: VisualSceneSpecV2; u: number }> = ({ spec, u }) => {
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { if (root.current) fitVisualTextV2(root.current) }, [spec])
  const t = spec.text, enter = phase(u, .10, .17), exit = 1 - phase(u, .86, .11)
  const visibleWords = [t.connector, t.keyword, t.closing].filter(Boolean).join(' ').split(/\s+/u).filter(Boolean).length
  return <div ref={root} data-qc-text="true" data-qc-text-fit="v2" data-qc-max-lines={t.maxLines}
    data-qc-visible-words={visibleWords} data-qc-text-region={spec.layout.textRegion}
    data-qc-keyword-family="Instrument Serif" data-qc-contrast-treatment="dark-text"
    style={{ position: 'absolute', left: `${spec.layout.textBounds.x}%`, top: `${spec.layout.textBounds.y}%`,
      width: `${spec.layout.textBounds.width}%`, height: `${spec.layout.textBounds.height}%`, zIndex: 8,
      boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center',
      alignItems: 'stretch', gap: '.5cqmin', padding: '.7cqmin', textAlign: t.alignment,
      color: C.ink, fontSynthesis: 'none', opacity: exit, pointerEvents: 'none' }}>
    {t.connector && <div data-fit-body="true" data-qc-connector="true" data-qc-text-glyph="true"
      style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: '3.5cqmin', lineHeight: 1.17,
        flexShrink: 0, opacity: phase(u, .05, .15) }}>{t.connector}</div>}
    <div data-fit-title="true" data-qc-keyword="true" data-qc-text-glyph="true"
      style={{ fontFamily: "'Instrument Serif',serif", fontWeight: 400, fontSize: '10.5cqmin',
        lineHeight: 1.02, color: C.orangeDepth, flexShrink: 0, opacity: enter,
        clipPath: `inset(0 ${(100 - enter * 100).toFixed(2)}% 0 0)` }}>{t.keyword}</div>
    {t.closing && <div data-fit-body="true" data-qc-closing="true" data-qc-text-glyph="true"
      style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 400, fontSize: '3.35cqmin', lineHeight: 1.18,
        flexShrink: 0, opacity: phase(u, .28, .15) }}>{t.closing}</div>}
    <div data-qc-text-glyph="true" style={{ width: '18%', height: '.16cqmin', flexShrink: 0,
      marginTop: '.6cqmin', background: C.orange, transform: `scaleX(${phase(u, .44, .18).toFixed(4)})`,
      transformOrigin: '0 50%' }} />
  </div>
}
