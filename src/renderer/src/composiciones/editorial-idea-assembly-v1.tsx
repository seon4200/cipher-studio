import React from 'react'
import type { VisualSceneSpecV2, RuntimeRenderAssetV2 } from '../../../shared/visual-scene-spec-v2'
import { type IdeaAccentTheme, type IdeaAssemblyResource } from '../../../shared/editorial-idea-assembly-v1'
import { sceneSpecReactKeyAny } from '../../../shared/visual-scene-spec-v2'

const clamp = (v: number) => Math.max(0, Math.min(1, v))
const ease = (v: number) => 1 - Math.pow(1 - clamp(v), 3)
const phase = (u: number, start: number, end: number) => ease((u - start) / (end - start))
const ACCENTS: Record<IdeaAccentTheme, { color: string; filter: string }> = {
  orange: { color: '#C5481E', filter: 'none' },
  teal: { color: '#238C87', filter: 'hue-rotate(158deg)' },
  crimson: { color: '#B8444F', filter: 'hue-rotate(-26deg)' },
}

export const EditorialIdeaAssemblyV1: React.FC<{
  spec: VisualSceneSpecV2
  runtimeAssets: readonly RuntimeRenderAssetV2[]
  u: number
}> = ({ spec, runtimeAssets, u }) => {
  const plan = spec.ideaAssembly!
  const landscape = window.innerWidth > window.innerHeight
  const layout = landscape ? plan.landscapeLayout : spec.layout
  const byId = new Map(runtimeAssets.map(asset => [asset.slotId, asset]))
  const requireUrl = (id: string) => {
    const url = byId.get(id as RuntimeRenderAssetV2['slotId'])?.objectUrl
    if (!url) throw new Error(`IDEA_RUNTIME_RESOURCE_REQUIRED:${id}`)
    return url
  }
  const hero = layout.slotLayouts.find(item => item.slotId === 'hero')!
  const accent = ACCENTS[plan.accentTheme]
  const out = 1 - phase(u, .89, 1)
  const heroEnter = phase(u, 0, .2)
  const heroScale = plan.heroStartScale + (1 - plan.heroStartScale) * heroEnter
  const layer = (resource: IdeaAssemblyResource) => {
    const enter = resource.id === 'idea-background' ? 1 : phase(u, resource.timing.start, resource.timing.settle)
    const { rect, from } = resource
    const x = from.x * (1 - enter), y = from.y * (1 - enter)
    const scale = from.scale + (1 - from.scale) * enter
    const isBackground = resource.id === 'idea-background'
    return <img key={resource.id} src={requireUrl(resource.id)} alt="" data-idea-part={resource.id}
      style={{ position: 'absolute', left: `${rect.x}%`, top: `${rect.y}%`,
        width: `${rect.width}%`, height: `${rect.height}%`, objectFit: isBackground ? 'cover' : 'contain',
        zIndex: resource.zIndex, pointerEvents: 'none',
        opacity: enter * (isBackground ? 1 : 1 - phase(u, resource.timing.exit, 1)),
        transform: `translate(${x}%,${y}%) scale(${scale})`, transformOrigin: '50% 50%',
        filter: resource.accentTreatment === 'hue-shift' ? accent.filter : 'none',
      }} />
  }
  const supportCenters = layout.slotLayouts.filter(item => item.slotId !== 'hero').map(item => ({
    id: item.slotId, x: item.envelope.x + item.envelope.width / 2,
    y: item.envelope.y + item.envelope.height / 2,
  }))
  const heroCenter = { x: hero.envelope.x + hero.envelope.width / 2,
    y: hero.envelope.y + hero.envelope.height / 2 }
  return <div key={sceneSpecReactKeyAny(spec)} data-visual-mvp="true" data-visual-composition="v15-idea-assembly"
    data-qc-layout-family="marcoPoster" data-qc-empty-hero-frames="0"
    style={{ position: 'absolute', inset: 0, overflow: 'hidden', containerType: 'size', background: '#F0EEE8', color: '#11110F', fontSynthesis: 'none' }}>
    <div data-qc-background-motion="none" style={{position:'absolute',inset:0}}>
      {layer(plan.resources.find(r => r.id === 'idea-background')!)}
    </div>
    <div data-qc-text="true" data-qc-hide-container="true" data-qc-max-lines="2" data-qc-visible-words="5" style={{ position: 'absolute',
      left: `${layout.textBounds.x}%`, top: `${layout.textBounds.y}%`,
      width: `${layout.textBounds.width}%`, height: `${layout.textBounds.height}%`,
      zIndex: 12, opacity: out, fontFamily: 'Instrument Serif,serif',
      lineHeight: .82, letterSpacing: '-.035em', textAlign: landscape ? 'left' : 'center' }}>
      <div data-qc-text-glyph="true" style={{ fontSize: landscape ? '10cqmin' : '16cqmin', fontWeight: 400, color: '#11110F' }}>{spec.text.connector}</div>
      <div data-qc-keyword="true" data-qc-text-glyph="true" style={{ fontSize: landscape ? '15cqmin' : '23cqmin', fontWeight: 400,
        color: accent.color, marginTop: '.5cqmin', whiteSpace: 'nowrap' }}>{spec.text.keyword}</div>
      <div data-qc-closing="true" data-qc-text-glyph="true" style={{ fontFamily: 'DM Sans,sans-serif', fontWeight: 500,
        fontSize: landscape ? '2.8cqmin' : '3.4cqmin', letterSpacing: '-.025em', lineHeight: 1.12,
        marginTop: '1.4cqmin', whiteSpace: 'nowrap' }}>{spec.text.closing}</div>
    </div>
    <div data-qc-asset="true" data-qc-hero="true" data-qc-slot="hero" data-qc-role="hero"
      style={{ position: 'absolute', zIndex: 4, left: `${hero.envelope.x}%`, top: `${hero.envelope.y}%`,
        width: `${hero.envelope.width}%`, height: `${hero.envelope.height}%`,
        transform: `scale(${heroScale})`, transformOrigin: `${plan.heroAnchor.x}% ${plan.heroAnchor.y}%`,
        opacity: out }}>
      {plan.resources.filter(r => r.id === 'idea-rear' || r.id === 'idea-accent').map(layer)}
      <img src={requireUrl('hero')} alt="" data-idea-part="bust" style={{ position: 'absolute', zIndex: 3,
        left: '12%', top: '18%', width: '78%', height: '80%', objectFit: 'contain',
        filter: 'drop-shadow(.5cqmin 1cqmin 1.2cqmin rgba(20,18,16,.22))' }} />
      {plan.resources.filter(r => r.id === 'idea-bulb' || r.id === 'idea-front').map(layer)}
    </div>
    <svg data-idea-connectors="true" viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 4, pointerEvents: 'none', opacity: out }}>
      {supportCenters.map((point, i) => {
        const sign = point.x < heroCenter.x ? -1 : 1
        const endX = heroCenter.x + sign * (landscape ? 13 : 18)
        const endY = heroCenter.y + (landscape ? (i === 0 || i === 2 ? -15 : 12) : (point.y < heroCenter.y ? -10 : 12))
        const startX = point.x - sign * (landscape ? 6 : 7)
        const draw = phase(u, .38 + i * .035, .65 + i * .025)
        return <g key={point.id} opacity={draw}>
          <path d={`M ${startX} ${point.y} Q ${(startX + endX) / 2} ${(point.y + endY) / 2 - 4} ${endX} ${endY}`}
            pathLength={1} stroke="#11110F" strokeWidth=".18" fill="none"
            strokeDasharray={1} strokeDashoffset={1 - draw} />
          <circle cx={endX} cy={endY} r=".3" fill="#11110F" />
        </g>
      })}
    </svg>
    {plan.supports.map((support) => {
      const slot = layout.slotLayouts.find(item => item.slotId === support.slotId)!
      const enter = phase(u, support.enter, support.enter + .13)
      const resource = spec.slots.find(item => item.slotId === support.slotId)
      if (!resource || resource.state !== 'present') throw new Error(`IDEA_SUPPORT_REQUIRED:${support.slotId}`)
      return <div key={support.slotId} data-qc-asset="true" data-qc-slot={support.slotId} data-qc-role={support.slotId}
        style={{ position: 'absolute', zIndex: 5, left: `${slot.envelope.x}%`, top: `${slot.envelope.y}%`,
          width: `${slot.envelope.width}%`, height: `${slot.envelope.height}%`,
          opacity: enter * out, transform: `translateY(${(1 - enter) * 1.2}cqmin)`,
          textAlign: 'center' }}>
        <div style={{ height: '69%', width: '75%', margin: '0 auto', borderRadius: '1.6cqmin',
          background: '#FAF9F6', border: '1px solid rgba(17,17,15,.13)', padding: '1.0cqmin',
          boxSizing: 'border-box', boxShadow: '.2cqmin .3cqmin .25cqmin rgba(17,17,15,.16), .7cqmin 1cqmin 2cqmin rgba(17,17,15,.08)' }}>
          <img src={requireUrl(support.slotId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain',
            filter: accent.filter }} />
        </div>
        <div data-qc-text-glyph="true" style={{ fontFamily: 'IBM Plex Sans Condensed,sans-serif', fontWeight: 400,
          fontSize: landscape ? '1.75cqmin' : '2.05cqmin', letterSpacing: '.14em',
          marginTop: '.7cqmin', whiteSpace: 'nowrap' }}>{support.label}</div>
      </div>
    })}
    <div style={{ position: 'absolute', left: '7%', bottom: '6%', width: '12%', height: '.22cqmin',
      background: accent.color, zIndex: 8, opacity: out }} />
  </div>
}
