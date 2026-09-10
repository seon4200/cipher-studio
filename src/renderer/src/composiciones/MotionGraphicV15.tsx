import React from 'react'
import { evaluateAssetMotion } from '../../../shared/visual-scene-spec'
import {
  sceneSpecReactKeyAny,
  type PresentSceneSlotV2,
  type RuntimeRenderAssetV2,
  type SceneSlotV2,
  type VisualSceneSpecV2,
} from '../../../shared/visual-scene-spec-v2'
import { typographyLookV3 } from '../../../shared/visual-layout-v3'
import type { SlotLayoutV4 } from '../../../shared/visual-layout-v4'
import { videoVisualStylePaletteV1 } from '../../../shared/visual-style-v1'
import { IconoSolar } from './IconoSolar'

function clamp01(value: number): number { return Math.min(1, Math.max(0, value)) }
function ease(value: number): number { const p = clamp01(value); return 1 - Math.pow(1 - p, 3) }
function phase(u: number, start: number, duration: number): number { return ease((u - start) / duration) }

function normalizedViewBox(slot: PresentSceneSlotV2): string {
  const aspect = Math.max(.01, slot.bounds.aspectRatio)
  if (slot.fitPolicy !== 'subject-contain') return `0 0 ${aspect} 1`
  const box = slot.bounds.alphaBounds
  return `${(box.x * aspect).toFixed(6)} ${box.y.toFixed(6)} ` +
    `${(box.width * aspect).toFixed(6)} ${box.height.toFixed(6)}`
}

const ProjectAssetVisual: React.FC<{
  slot: PresentSceneSlotV2
  runtime: RuntimeRenderAssetV2
  accent: string
  support: string
}> = ({ slot, runtime, accent, support }) => {
  const suffix = `${slot.slotId}-${slot.sha256.slice(0, 12)}`
  const image = <image href={runtime.objectUrl} x="0" y="0" width={Math.max(.01, slot.bounds.aspectRatio)} height="1"
    preserveAspectRatio={slot.fitPolicy === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'} />
  const low = support.replace('#', '').match(/../g)?.map(value => parseInt(value, 16) / 255) ?? [0, 0, 0]
  const high = accent.replace('#', '').match(/../g)?.map(value => parseInt(value, 16) / 255) ?? [1, 1, 1]
  return <svg viewBox={normalizedViewBox(slot)} width="100%" height="100%"
    preserveAspectRatio={slot.fitPolicy === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
    role="img" aria-label={`${slot.role} verificado`}>
    {slot.tint.treatment === 'original-color' && image}
    {slot.tint.treatment === 'system-tint' && <>
      <defs><mask id={`v15-mask-${suffix}`} maskUnits="objectBoundingBox" x="0" y="0" width="1" height="1"
        style={{ maskType: 'alpha' }}>{image}</mask></defs>
      <rect x="0" y="0" width={Math.max(.01, slot.bounds.aspectRatio)} height="1"
        fill={accent} mask={`url(#v15-mask-${suffix})`} />
    </>}
    {slot.tint.treatment === 'accent-mask' && <>
      <defs><mask id={`v15-accent-${suffix}`} maskUnits="objectBoundingBox" x="0" y="0" width="1" height="1"
        style={{ maskType: 'alpha' }}>{image}</mask></defs>
      <rect x="0" y="0" width={Math.max(.01, slot.bounds.aspectRatio)} height="1"
        fill={accent} mask={`url(#v15-accent-${suffix})`} />
    </>}
    {slot.tint.treatment === 'duotone' && <>
      <defs><filter id={`v15-duotone-${suffix}`} x="-4%" y="-4%" width="108%" height="108%"
        colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={`${low[0]} ${high[0]}`} />
          <feFuncG type="table" tableValues={`${low[1]} ${high[1]}`} />
          <feFuncB type="table" tableValues={`${low[2]} ${high[2]}`} />
          <feFuncA type="identity" />
        </feComponentTransfer>
      </filter></defs>
      <g filter={`url(#v15-duotone-${suffix})`}>{image}</g>
    </>}
  </svg>
}

function backingStyle(layout: SlotLayoutV4, palette: ReturnType<typeof videoVisualStylePaletteV1>): React.CSSProperties {
  if (layout.backing === 'neutral-plate') return {
    background: palette.surface, borderRadius: '2.2cqmin', border: `.15cqmin solid ${palette.line}55`,
    boxShadow: `0 1.1cqmin 2.8cqmin ${palette.shadow}`, padding: '1.6cqmin',
  }
  if (layout.backing === 'frame') return {
    border: `.48cqmin solid ${palette.accent}`, boxShadow: `inset 0 0 0 .16cqmin ${palette.line}55`,
    padding: '1.6cqmin', background: `${palette.surface}B8`,
  }
  if (layout.backing === 'halo') return {
    borderRadius: '999cqmin', background: `radial-gradient(circle,${palette.surface}F2 0 48%,${palette.surface}00 72%)`,
    padding: '1.2cqmin',
  }
  return {}
}

const SceneAssetSlot: React.FC<{
  spec: VisualSceneSpecV2
  slot: Extract<SceneSlotV2, { state: 'present' | 'procedural' }>
  layout: SlotLayoutV4
  runtime?: RuntimeRenderAssetV2
  u: number
}> = ({ spec, slot, layout, runtime, u }) => {
  const palette = videoVisualStylePaletteV1(spec.videoStyle)
  const motion = evaluateAssetMotion(slot.motion, u)
  if (slot.state === 'present' && !runtime) throw new Error(`VISUAL_RUNTIME_SLOT_REQUIRED:${slot.slotId}`)
  return <div
    data-qc-asset="true" data-qc-hero={slot.role === 'hero' ? 'true' : undefined}
    data-qc-slot={slot.slotId} data-qc-role={slot.role} data-qc-state={slot.state}
    data-qc-treatment={slot.tint.treatment} data-qc-z={layout.zIndex}
    data-qc-alpha-mode={slot.state === 'present' ? slot.alphaMode : 'vector'}
    style={{
      position: 'absolute', left: `${layout.envelope.x + layout.envelope.width / 2}%`,
      top: `${layout.envelope.y + layout.envelope.height / 2}%`, width: `${layout.envelope.width}%`,
      height: `${layout.envelope.height}%`, zIndex: layout.zIndex, boxSizing: 'border-box',
      transform: `translate(-50%,-50%) translate3d(${motion.translateXCqmin.toFixed(4)}cqmin,` +
        `${motion.translateYCqmin.toFixed(4)}cqmin,0) rotate(${layout.rotationDeg}deg) scale(${motion.scale.toFixed(5)})`,
      transformOrigin: '50% 50%', opacity: motion.opacity * layout.opacity,
      willChange: 'transform,opacity', overflow: layout.crop === 'cover-safe' ? 'hidden' : 'visible',
      filter: slot.role === 'hero' ? `drop-shadow(0 1.2cqmin 2.4cqmin ${palette.shadow})`
        : `drop-shadow(0 .7cqmin 1.5cqmin ${palette.shadow})`,
      ...backingStyle(layout, palette),
    }}>
    {slot.state === 'present' && runtime && <ProjectAssetVisual slot={slot} runtime={runtime}
      accent={palette.accent} support={palette.support} />}
    {slot.state === 'procedural' && <div style={{ width: '100%', height: '100%', color: palette.accent }}>
      <IconoSolar concepto={{ emoji: '', etiqueta: slot.solarIcon, icono: slot.solarIcon }}
        estilo={slot.solarStyle} canonicalId={slot.solarIcon} className="es-svg"
        titulo={`${slot.role} Solar ${slot.solarIcon}`} />
    </div>}
  </div>
}

function center(layout: SlotLayoutV4): [number, number] {
  return [layout.envelope.x + layout.envelope.width / 2, layout.envelope.y + layout.envelope.height / 2]
}

const StructureGrammar: React.FC<{ spec: VisualSceneSpecV2 }> = ({ spec }) => {
  const palette = videoVisualStylePaletteV1(spec.videoStyle)
  const slots = spec.layout.slotLayouts
  const points = slots.map(center)
  const hero = points[0] ?? [50, 40]
  const line = { fill: 'none', stroke: palette.line, strokeWidth: .38, opacity: .55,
    vectorEffect: 'non-scaling-stroke' as const }
  const accent = { ...line, stroke: palette.accent, opacity: .65 }
  const links = points.slice(1).map((point, index) => <line key={index} x1={hero[0]} y1={hero[1]}
    x2={point[0]} y2={point[1]} {...line} />)
  const family = spec.layout.family
  let marks: React.ReactNode = null
  if (family === 'marcoPoster' && slots[0]) {
    const e = slots[0].envelope
    marks = <rect x={e.x - 2} y={e.y - 1.5} width={e.width + 4} height={e.height + 3} rx="1.2" {...accent} />
  } else if (family === 'partidoVertical') {
    marks = <><line x1="50" y1="12" x2="50" y2="88" {...accent} /><rect x="4" y="10" width="92" height="80" rx="2" {...line} /></>
  } else if (family === 'cintaDiagonal') {
    marks = <polygon points="-5,59 105,28 105,40 -5,71" fill={palette.accent} opacity=".13" />
  } else if (family === 'anillosConcentricos') {
    marks = <><ellipse cx={hero[0]} cy={hero[1]} rx="27" ry="21" {...line} />
      <ellipse cx={hero[0]} cy={hero[1]} rx="35" ry="27" {...line} opacity=".3" />{links}</>
  } else if (family === 'rayosImpacto') {
    marks = <>{[0, 45, 90, 135, 180, 225, 270, 315].map(angle => {
      const r = angle * Math.PI / 180
      return <line key={angle} x1={hero[0] + Math.cos(r) * 27} y1={hero[1] + Math.sin(r) * 20}
        x2={hero[0] + Math.cos(r) * 38} y2={hero[1] + Math.sin(r) * 29} {...accent} />
    })}</>
  } else if (family === 'cuaderno') {
    marks = <><rect x="6" y="8" width="88" height="82" rx="2" fill={palette.surface} opacity=".58" stroke={palette.line} strokeWidth=".3" />
      {[20, 32, 44, 56, 68, 80].map(y => <line key={y} x1="9" y1={y} x2="91" y2={y} {...line} opacity=".18" />)}</>
  } else if (family === 'constelacion' || family === 'redNodos') {
    marks = <>{links}{family === 'redNodos' && points.length === 3 &&
      <line x1={points[1][0]} y1={points[1][1]} x2={points[2][0]} y2={points[2][1]} {...line} />}
      {points.map((point, index) => <circle key={index} cx={point[0]} cy={point[1]} r={index ? 13 : 20} {...line} opacity=".32" />)}</>
  } else if (family === 'capasApiladas') {
    marks = <>{slots.map((slot, index) => <rect key={slot.slotId} x={slot.envelope.x - 2} y={slot.envelope.y - 1}
      width={slot.envelope.width + 4} height={slot.envelope.height + 2} rx="2" fill={palette.surface}
      stroke={index ? palette.line : palette.accent} strokeWidth=".3" opacity={.34 + index * .08} />)}</>
  } else if (family === 'lineaTiempo') {
    marks = <><polyline points={points.map(point => point.join(',')).join(' ')} {...accent} />
      {points.map((point, index) => <circle key={index} cx={point[0]} cy={point[1]} r="1.1" fill={palette.accent} />)}</>
  } else if (family === 'corteTransversal') {
    marks = <>{slots.map((slot, index) => <rect key={slot.slotId} x={slot.envelope.x - 1.5} y={slot.envelope.y - .8}
      width={slot.envelope.width + 3} height={slot.envelope.height + 1.6} fill={index % 2 ? palette.support : palette.accent}
      opacity=".08" stroke={palette.line} strokeWidth=".25" />)}</>
  } else if (family === 'abanicoTarjetas') {
    marks = <>{slots.map(slot => <rect key={slot.slotId} x={slot.envelope.x - 1.5} y={slot.envelope.y - 1.5}
      width={slot.envelope.width + 3} height={slot.envelope.height + 3} rx="2" fill={palette.surface}
      stroke={palette.line} strokeWidth=".32" opacity=".7" transform={`rotate(${slot.rotationDeg} ${center(slot).join(' ')})`} />)}</>
  } else if (family === 'engranajes') {
    marks = <>{points.map((point, index) => <circle key={index} cx={point[0]} cy={point[1]}
      r={index ? 17 : 20} strokeDasharray="2 1" {...line} />)}{links}</>
  } else if (family === 'cascada') {
    marks = <>{points.slice(0, -1).map((point, index) => <line key={index} x1={point[0]} y1={point[1]}
      x2={points[index + 1][0]} y2={points[index + 1][1]} {...accent} />)}</>
  } else if (family === 'mundoIsometrico') {
    marks = <><polygon points="50,30 92,54 50,79 8,54" fill={palette.support} opacity=".08" stroke={palette.line} strokeWidth=".35" />{links}</>
  } else if (family === 'pilaVertical') {
    marks = <><line x1="52" y1="13" x2="52" y2="87" {...accent} />
      {slots.map(slot => <line key={slot.slotId} x1={slot.envelope.x + slot.envelope.width} y1={center(slot)[1]}
        x2="52" y2={center(slot)[1]} {...line} />)}</>
  }
  return <svg data-qc-structure-mark={family} viewBox="0 0 100 100" preserveAspectRatio="none"
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}>{marks}</svg>
}

const QuietBackground: React.FC<{ spec: VisualSceneSpecV2; u: number }> = ({ spec, u }) => {
  const palette = videoVisualStylePaletteV1(spec.videoStyle)
  const subtle = spec.videoStyle.backgroundMotion === 'subtle'
  const shift = subtle ? Math.sin(u * Math.PI * 2) * .7 : 0
  return <div data-qc-background-family={spec.videoStyle.backgroundVariant}
    data-qc-background-motion={spec.videoStyle.backgroundMotion} style={{
      position: 'absolute', inset: '-2%', zIndex: 0,
      backgroundColor: palette.background,
      backgroundImage: `radial-gradient(circle at 78% 18%,${palette.accent}13 0,transparent 31%),` +
        `linear-gradient(112deg,transparent 0 62%,${palette.support}0C 62% 63%,transparent 63%),` +
        `repeating-linear-gradient(0deg,transparent 0 5.8cqmin,${palette.line}0A 5.8cqmin 5.92cqmin)`,
      transform: `translate3d(${shift.toFixed(3)}cqmin,${(-shift * .35).toFixed(3)}cqmin,0)`,
    }} />
}

const NarrativeTextV15: React.FC<{ spec: VisualSceneSpecV2; u: number }> = ({ spec, u }) => {
  const text = spec.text
  const look = typographyLookV3(text.typographyLookId)
  const palette = videoVisualStylePaletteV1(spec.videoStyle)
  const connectorP = phase(u, text.timing.connectorStart, .13)
  const keywordP = phase(u, text.timing.keywordStart, .17)
  const closingP = text.closing && text.timing.closingStart !== undefined ? phase(u, text.timing.closingStart, .14) : 0
  const emphasisDistance = Math.abs(u - text.motion.emphasisStart)
  const punch = text.motion.keywordPreset === 'scale-punch' && emphasisDistance < .09
    // El énfasis debe seguir siendo legible dentro de la región materializada: 8.5% hacía
    // que keywords largas cupieran en reposo pero se recortaran únicamente en el pico.
    ? Math.sin((1 - emphasisDistance / .09) * Math.PI) * .04 : 0
  const slide = text.motion.keywordPreset === 'slide-reveal' ? (1 - keywordP) * 2.2 : 0
  const keywordWords = text.keyword.split(/\s+/).filter(Boolean)
  const longest = Math.max(1, ...keywordWords.map(word => Array.from(word).length))
  const widthScale = spec.layout.textBounds.width / 72
  const keywordSize = Math.max(look.minKeywordCqmin, Math.min(look.maxKeywordCqmin,
    look.widthBudget * widthScale / longest))
  const visibleWords = [text.connector, text.keyword, text.closing].filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length
  const align = text.alignment
  return <div data-qc-text="true" data-qc-max-lines={text.maxLines} data-qc-visible-words={visibleWords}
    data-qc-text-region={spec.layout.textRegion} data-qc-typography-look={text.typographyLookId}
    data-qc-keyword-family={look.keywordFamily} style={{
      position: 'absolute', left: `${spec.layout.textBounds.x}%`, top: `${spec.layout.textBounds.y}%`,
      width: `${spec.layout.textBounds.width}%`, height: `${spec.layout.textBounds.height}%`, zIndex: 8,
      boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'stretch', gap: '.85cqmin', padding: '2.2cqmin 2.7cqmin',
      textAlign: align, color: palette.text, fontSynthesis: 'none',
      background: spec.visualMode === 'editorial-text' ? `${palette.surface}E8` : `${palette.surface}C9`,
      borderInlineStart: `.48cqmin solid ${palette.accent}`, boxShadow: `0 .8cqmin 2.6cqmin ${palette.shadow}`,
      opacity: u > .9 ? (1 - u) / .1 : 1,
    }}>
    {text.connector && <div data-qc-connector="true" data-qc-text-glyph="true" style={{
      fontFamily: `${look.connectorFamily},serif`, fontWeight: look.connectorWeight,
      fontSize: spec.visualMode === 'editorial-text' ? '4.0cqmin' : '3.45cqmin', lineHeight: 1.08,
      opacity: connectorP, transform: `translateY(${((1 - connectorP) * 1.2).toFixed(4)}cqmin)`,
      whiteSpace: 'normal', overflowWrap: 'break-word',
    }}>{text.connector}</div>}
    <span data-qc-keyword="true" data-qc-text-glyph="true" style={{
      maxWidth: '100%', display: 'block', fontFamily: `${look.keywordFamily},sans-serif`,
      fontWeight: look.keywordWeight, fontSize: `${keywordSize.toFixed(3)}cqmin`, lineHeight: look.lineHeight,
      letterSpacing: `${look.trackingEm}em`, textTransform: look.keywordCase === 'uppercase' ? 'uppercase' : 'none',
      whiteSpace: keywordWords.length === 1 ? 'nowrap' : 'normal', wordBreak: 'keep-all', overflowWrap: 'normal',
      opacity: keywordP, transform: `translateX(${slide.toFixed(4)}cqmin) scale(${(.9 + keywordP * .1 + punch).toFixed(5)})`,
      transformOrigin: align === 'left' ? '0 60%' : align === 'right' ? '100% 60%' : '50% 60%',
    }}>{text.keyword}</span>
    {text.closing && <div data-qc-closing="true" data-qc-text-glyph="true" style={{
      fontFamily: `${look.closingFamily},serif`, fontWeight: look.closingWeight,
      fontSize: spec.visualMode === 'editorial-text' ? '3.65cqmin' : '3.15cqmin', lineHeight: 1.1,
      opacity: closingP, transform: `translateY(${((1 - closingP) * .9).toFixed(4)}cqmin)`,
      whiteSpace: 'normal', overflowWrap: 'break-word',
    }}>{text.closing}</div>}
    <div data-qc-text-glyph="true" style={{ height: '.48cqmin', width: text.motion.keywordPreset === 'underline-reveal' ? '18cqmin' : '10cqmin',
      margin: align === 'left' ? '.4cqmin 0 0' : align === 'right' ? '.4cqmin 0 0 auto' : '.4cqmin auto 0',
      background: palette.accent, transform: `scaleX(${keywordP.toFixed(4)})`,
      transformOrigin: align === 'left' ? '0 50%' : align === 'right' ? '100% 50%' : '50% 50%' }} />
  </div>
}

export const MotionGraphicV15: React.FC<{
  spec: VisualSceneSpecV2
  runtimeAssets: readonly RuntimeRenderAssetV2[]
  u: number
}> = ({ spec, runtimeAssets, u }) => {
  const active = spec.slots.filter((slot): slot is Extract<SceneSlotV2, { state: 'present' | 'procedural' }> =>
    slot.state === 'present' || slot.state === 'procedural')
  const runtimeBySlot = new Map(runtimeAssets.map(asset => [asset.slotId, asset]))
  return <div key={sceneSpecReactKeyAny(spec)} data-visual-mvp="true" data-visual-composition="v15"
    data-qc-layout-family={spec.layout.family} data-visual-density={spec.direccion.densidad}
    data-qc-decorator-count="0" data-qc-empty-hero-frames="0" data-qc-video-style={spec.videoStyle.id}
    style={{ position: 'absolute', inset: 0, containerType: 'size', overflow: 'hidden' }}>
    <QuietBackground spec={spec} u={u} />
    <StructureGrammar spec={spec} />
    {active.map(slot => {
      const layout = spec.layout.slotLayouts.find(value => value.slotId === slot.slotId)
      if (!layout) throw new Error(`VISUAL_RUNTIME_LAYOUT_SLOT_REQUIRED:${slot.slotId}`)
      return <SceneAssetSlot key={slot.slotId} spec={spec} slot={slot} layout={layout}
        runtime={runtimeBySlot.get(slot.slotId)} u={u} />
    })}
    <NarrativeTextV15 spec={spec} u={u} />
  </div>
}
