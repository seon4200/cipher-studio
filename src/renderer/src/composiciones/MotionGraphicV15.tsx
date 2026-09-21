import React, { useLayoutEffect, useRef } from 'react'
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
import { applyBackgroundProfileV1 } from '../../../shared/background-profile-v1'
import {
  applySceneColorPaletteV1,
  sceneColorRoleTokensV1,
} from '../../../shared/color-palette-v1'
import { IconoSolar } from './IconoSolar'
import { EDITORIAL_MOTION_PROFILE_V2, VISUAL_RECOVERY_PROFILE_V1,
  PREMIUM_TYPE_COLOR_PROFILE_V1, VISUAL_RECOVERY_REFINED_FAMILIES } from '../../../shared/editorial-motion-profile-v1'
import { PREMIUM_TYPE_THEMES } from '../../../shared/premium-type-color-v1'
import { fitVisualTextV2 } from './text-fit-v2'
import { chooseTextContrastV1 } from './photo-text-contrast-v1'
import { assetMotionV2, backgroundImageV2, FamilyV2AccentGraphics } from './families-v2-layers'
import { FAMILIES_MOTION_PROFILE_V2 } from '../../../shared/editorial-motion-profile-v1'
import { EDITORIAL_EXPLAINER_LIGHT_V1, LIGHT_COLORS_V1 } from '../../../shared/editorial-explainer-light-v1'
import { EDITORIAL_EXPLAINER_LIGHT_V2 } from '../../../shared/editorial-explainer-light-v2'
import { EditorialHeroTile, EditorialIconBadge, EditorialConnector, EditorialDataRepeater,
  EditorialLightBackground, EditorialLightText } from './editorial-explainer-light-components'
import { EditorialLightV2Badge, EditorialLightV2Connector, EditorialLightV2DataRepeater, EditorialLightV2Text } from './editorial-explainer-light-v2-components'

function clamp01(value: number): number { return Math.min(1, Math.max(0, value)) }
function ease(value: number): number { const p = clamp01(value); return 1 - Math.pow(1 - p, 3) }
function phase(u: number, start: number, duration: number): number { return ease((u - start) / duration) }

function scenePalette(spec: VisualSceneSpecV2): ReturnType<typeof videoVisualStylePaletteV1> {
  const base = applySceneColorPaletteV1(
    applyBackgroundProfileV1(videoVisualStylePaletteV1(spec.videoStyle), spec.backgroundProfile),
    spec.colorPalette,
  )
  if (spec.lightStyle) return { ...base, background: LIGHT_COLORS_V1.ivory, surface: LIGHT_COLORS_V1.white,
    text: LIGHT_COLORS_V1.ink, accent: LIGHT_COLORS_V1.orange, support: LIGHT_COLORS_V1.orangeDepth,
    line: LIGHT_COLORS_V1.grid, shadow: 'rgba(17,17,15,.16)' }
  if (!spec.premiumStyle) return base
  return { ...base, background: '#0B0B0D', surface: '#17171B', text: '#F4F2ED',
    accent: spec.premiumStyle.accentPrimary, support: spec.premiumStyle.accentSecondary,
    line: '#74747C', shadow: 'rgba(0,0,0,.32)' }
}

function sceneRoles(spec: VisualSceneSpecV2) {
  return sceneColorRoleTokensV1(scenePalette(spec), spec.premiumStyle ? undefined : spec.colorPalette)
}

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

function backingStyle(
  layout: SlotLayoutV4,
  palette: ReturnType<typeof videoVisualStylePaletteV1>,
  sceneColor: VisualSceneSpecV2['colorPalette'],
): React.CSSProperties {
  const roles = sceneColorRoleTokensV1(palette, sceneColor)
  if (layout.backing === 'neutral-plate') return {
    background: palette.surface, borderRadius: '2.2cqmin', border: `.15cqmin solid ${palette.line}55`,
    boxShadow: `0 1.1cqmin 2.8cqmin ${palette.shadow}`, padding: '1.6cqmin',
  }
  if (layout.backing === 'frame') return {
    border: `.48cqmin solid ${roles.border}`, boxShadow: `inset 0 0 0 .16cqmin ${palette.line}55`,
    padding: '1.6cqmin', background: `${palette.surface}B8`,
  }
  if (layout.backing === 'halo') return {
    borderRadius: '999cqmin', background: sceneColor
      ? `radial-gradient(circle,${roles.halo}38 0 24%,${palette.surface}F2 48%,${palette.surface}00 72%)`
      : `radial-gradient(circle,${palette.surface}F2 0 48%,${palette.surface}00 72%)`,
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
  const palette = scenePalette(spec)
  const roles = sceneRoles(spec)
  const motion = evaluateAssetMotion(slot.motion, u)
  const recovery = [VISUAL_RECOVERY_PROFILE_V1.revision, PREMIUM_TYPE_COLOR_PROFILE_V1.revision]
    .includes(spec.presentationProfile?.revision as typeof VISUAL_RECOVERY_PROFILE_V1.revision)
  const recoveryRefined = recovery && VISUAL_RECOVERY_REFINED_FAMILIES.includes(
    spec.layout.family as typeof VISUAL_RECOVERY_REFINED_FAMILIES[number])
  const pilot = !!spec.presentationProfile && (!recovery || recoveryRefined)
  const refined = spec.presentationProfile?.revision === EDITORIAL_MOTION_PROFILE_V2.revision || recoveryRefined
  const entryStart = refined
    ? spec.editorialMotionCue === 'comparison' ? (slot.role === 'support-2' ? .24 : .10)
      : spec.editorialMotionCue === 'process' ? (slot.role === 'hero' ? .05 : slot.role === 'support-1' ? .23 : .41)
        : spec.editorialMotionCue === 'cause' ? (slot.role === 'hero' ? .05 : slot.role === 'support-1' ? .32 : .45)
          : spec.editorialMotionCue === 'datum' ? (slot.role === 'hero' ? .27 : .36)
            : (slot.role === 'hero' ? .04 : slot.role === 'support-1' ? .22 : .34)
    : slot.role === 'hero' ? .04 : slot.role === 'support-1' ? .19 : .29
  const entrance = phase(u, entryStart, refined ? .15 : slot.role === 'hero' ? .19 : .13)
  const departure = 1 - phase(u, .84, .13)
  const pilotOpacity = entrance * departure
  const pilotScale = .94 + entrance * .06 - (1 - departure) * .025
  const pilotYOffset = (1 - entrance) * (slot.role === 'hero' ? 3.1 : 1.7) - (1 - departure) * 1.1
  const familyMotion = spec.compositionV2 ? assetMotionV2(spec.compositionV2.motionVariant, slot.role, u) : undefined
  if (slot.state === 'present' && !runtime) throw new Error(`VISUAL_RUNTIME_SLOT_REQUIRED:${slot.slotId}`)
  const light = spec.lightStyle
  const lightV2 = light?.revision === EDITORIAL_EXPLAINER_LIGHT_V2.revision
  const lightStart = lightV2 ? light.motionCue === 'count' ? .25
    : light.motionCue === 'transfer' ? slot.role === 'hero' ? .07 : slot.role === 'support-1' ? .39 : .49
      : light.motionCue === 'process' ? slot.role === 'hero' ? .06 : slot.role === 'support-1' ? .29 : .46
        : slot.role === 'hero' ? .07 : slot.role === 'support-1' ? .25 : .36
    : slot.role === 'hero' ? .07 : .25
  const lightEnter = light ? phase(u, lightStart, lightV2 ? .15 : .17) : 1
  const lightExit = light ? 1 - phase(u, .87, .10) : 1
  const source = slot.state === 'present' && runtime
    ? <ProjectAssetVisual slot={slot} runtime={runtime}
        accent={light && slot.tint.treatment === 'system-tint' ? LIGHT_COLORS_V1.white : palette.accent}
        support={palette.support} />
    : slot.state === 'procedural' ? <div data-qc-solar-tint={light ? LIGHT_COLORS_V1.white : roles.solar}
        style={{ width: '100%', height: '100%', color: light ? LIGHT_COLORS_V1.white : roles.solar }}>
        <IconoSolar concepto={{ emoji: '', etiqueta: slot.solarIcon, icono: slot.solarIcon }}
          estilo={slot.solarStyle} canonicalId={slot.solarIcon} className="es-svg"
          titulo={`${slot.role} Solar ${slot.solarIcon}`} /></div> : null
  const lightContent = light && slot.kind === 'simple-icon'
    ? slot.role === 'hero' && light.heroTile !== 'none'
      ? <EditorialHeroTile variant={light.heroTile} material={light.materialPreset}>{source}</EditorialHeroTile>
      : slot.role !== 'hero' && lightV2 ? <EditorialLightV2Badge originalColor={slot.state === 'present' && slot.tint.treatment === 'original-color'}>{source}</EditorialLightV2Badge>
      : slot.role !== 'hero' ? <EditorialIconBadge material={light.materialPreset}
        variant={slot.state === 'present' && slot.tint.treatment === 'original-color'
          ? 'original-color' : light.iconTreatment === 'orange-tile' ? 'orange-tile' : 'black-circle'}>{source}</EditorialIconBadge> : source
    : source
  return <div
    data-qc-asset="true" data-qc-hero={slot.role === 'hero' ? 'true' : undefined}
    data-qc-slot={slot.slotId} data-qc-role={slot.role} data-qc-state={slot.state}
    data-qc-treatment={slot.tint.treatment} data-qc-z={layout.zIndex}
    data-qc-alpha-mode={slot.state === 'present' ? slot.alphaMode : 'vector'}
    style={{
      position: 'absolute', left: `${layout.envelope.x + layout.envelope.width / 2}%`,
      top: `${layout.envelope.y + layout.envelope.height / 2}%`, width: `${layout.envelope.width}%`,
      height: `${layout.envelope.height}%`, zIndex: layout.zIndex, boxSizing: 'border-box',
      transform: light ? `translate(-50%,-50%) translateY(${((1 - lightEnter) * 1.5).toFixed(3)}cqmin) scale(${(.96 + .04 * lightEnter).toFixed(4)})`
        : familyMotion ? familyMotion.transform : pilot
        ? `translate(-50%,-50%) translate3d(0,${pilotYOffset.toFixed(4)}cqmin,0) rotate(${layout.rotationDeg}deg) scale(${pilotScale.toFixed(5)})`
        : `translate(-50%,-50%) translate3d(${motion.translateXCqmin.toFixed(4)}cqmin,` +
          `${motion.translateYCqmin.toFixed(4)}cqmin,0) rotate(${layout.rotationDeg}deg) scale(${motion.scale.toFixed(5)})`,
      transformOrigin: '50% 50%', opacity: (light ? lightEnter * lightExit : familyMotion ? familyMotion.opacity : pilot ? pilotOpacity : motion.opacity) * layout.opacity,
      ...(familyMotion?.clipPath ? { clipPath: familyMotion.clipPath } : {}),
      willChange: 'transform,opacity', overflow: layout.crop === 'cover-safe' ? 'hidden' : 'visible',
      filter: lightV2 && slot.role === 'hero' && slot.state === 'present' && slot.alphaMode === 'useful-alpha'
        ? 'drop-shadow(.2cqmin .45cqmin .35cqmin rgba(17,17,15,.22)) drop-shadow(.9cqmin 1.4cqmin 1.8cqmin rgba(17,17,15,.12))'
        : light || familyMotion ? 'none' : pilot ? (slot.state === 'present' && slot.alphaMode === 'opaque-rectangle'
        ? `drop-shadow(0 .65cqmin 1.7cqmin ${palette.shadow})` : 'none')
        : slot.role === 'hero' ? `drop-shadow(0 1.2cqmin 2.4cqmin ${palette.shadow})`
          : `drop-shadow(0 .7cqmin 1.5cqmin ${palette.shadow})`,
      ...(light || pilot ? {} : backingStyle(layout, palette, spec.premiumStyle ? undefined : spec.colorPalette)),
    }}>
    {light ? lightContent : <>{slot.state === 'present' && runtime && (spec.compositionV2?.layoutVariant === 'full-raster-context'
      && slot.role === 'hero' && slot.alphaMode === 'opaque-rectangle'
      && slot.tint.treatment === 'original-color'
      ? <img src={runtime.objectUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      : <ProjectAssetVisual slot={slot} runtime={runtime} accent={palette.accent} support={palette.support} />)}
    {slot.state === 'procedural' && <div data-qc-solar-tint={roles.solar}
      style={{ width: '100%', height: '100%', color: roles.solar }}>
      <IconoSolar concepto={{ emoji: '', etiqueta: slot.solarIcon, icono: slot.solarIcon }}
        estilo={slot.solarStyle} canonicalId={slot.solarIcon} className="es-svg"
        titulo={`${slot.role} Solar ${slot.solarIcon}`} />
    </div>}</>}
  </div>
}

function center(layout: SlotLayoutV4): [number, number] {
  return [layout.envelope.x + layout.envelope.width / 2, layout.envelope.y + layout.envelope.height / 2]
}

const PilotStructureGrammar: React.FC<{ spec: VisualSceneSpecV2; u: number }> = ({ spec, u }) => {
  const roles = sceneRoles(spec)
  const draw = phase(u, .1, .28)
  const exit = 1 - phase(u, .86, .12)
  const stroke = { fill: 'none', stroke: roles.primaryLine, strokeWidth: .3,
    opacity: .74 * exit, vectorEffect: 'non-scaling-stroke' as const,
    pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - draw }
  const family = spec.layout.family
  const hero = spec.layout.slotLayouts[0]
  const marks: React.ReactNode = family === 'marcoPoster' && hero
    ? <><line x1="8" y1="9" x2="43" y2="9" {...stroke} />
      <line x1="8" y1="9" x2="8" y2="43" {...stroke} />
      <line x1="57" y1="64" x2="92" y2="64" {...stroke} /></>
    : family === 'partidoVertical'
      ? <line x1="50" y1="10" x2="50" y2="88" {...stroke} />
      : family === 'cintaDiagonal'
        ? <line x1="7" y1="59" x2="94" y2="25" {...stroke} />
        : family === 'cuaderno'
          ? <><line x1="7" y1="10" x2="7" y2="88" {...stroke} />
            <line x1="7" y1="59" x2="70" y2="59" {...stroke} /></>
          : family === 'lineaTiempo'
            ? <polyline points={spec.layout.slotLayouts.map(item => center(item).join(',')).join(' ')} {...stroke} />
            : <line x1="8" y1="70" x2="40" y2="70" {...stroke} />
  return <svg data-qc-structure-mark={family} viewBox="0 0 100 100" preserveAspectRatio="none"
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1,
      pointerEvents: 'none' }}>{marks}</svg>
}

const StructureGrammar: React.FC<{ spec: VisualSceneSpecV2; u: number }> = ({ spec, u }) => {
  if (spec.presentationProfile && (![VISUAL_RECOVERY_PROFILE_V1.revision, PREMIUM_TYPE_COLOR_PROFILE_V1.revision].includes(
      spec.presentationProfile.revision as typeof VISUAL_RECOVERY_PROFILE_V1.revision) ||
      VISUAL_RECOVERY_REFINED_FAMILIES.includes(spec.layout.family as typeof VISUAL_RECOVERY_REFINED_FAMILIES[number])))
    return <PilotStructureGrammar spec={spec} u={u} />
  const palette = scenePalette(spec)
  const roles = sceneRoles(spec)
  const slots = spec.layout.slotLayouts
  const points = slots.map(center)
  const hero = points[0] ?? [50, 40]
  const line = { fill: 'none', stroke: roles.secondaryLine, strokeWidth: .38, opacity: .55,
    vectorEffect: 'non-scaling-stroke' as const }
  const accent = { ...line, stroke: roles.primaryLine, opacity: .65 }
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
  const palette = scenePalette(spec)
  const subtle = spec.videoStyle.backgroundMotion === 'subtle'
  const shift = subtle ? Math.sin(u * Math.PI * 2) * .7 : 0
  return <div data-qc-background-family={spec.videoStyle.backgroundVariant}
    data-qc-background-profile={spec.backgroundProfile?.id ?? 'historical-video-style'}
    data-qc-background-motion={spec.videoStyle.backgroundMotion} style={{
      position: 'absolute', inset: '-2%', zIndex: 0,
      backgroundColor: palette.background,
      backgroundImage: spec.compositionV2 ? backgroundImageV2(spec.compositionV2.backgroundVariant, palette)
        : spec.premiumStyle ? 'none' : `radial-gradient(circle at 78% 18%,${palette.accent}13 0,transparent 31%),` +
        `linear-gradient(112deg,transparent 0 62%,${palette.support}0C 62% 63%,transparent 63%),` +
        `repeating-linear-gradient(0deg,transparent 0 5.8cqmin,${palette.line}0A 5.8cqmin 5.92cqmin)`,
      ...(spec.compositionV2?.backgroundVariant === 'subtle-grid' ? { backgroundSize: '8cqmin 8cqmin' } : {}),
      transform: `translate3d(${shift.toFixed(3)}cqmin,${(-shift * .35).toFixed(3)}cqmin,0)`,
    }} />
}

/** Editorial profile only. The historical card component below is deliberately untouched. */
const NarrativeTextPilot: React.FC<{ spec: VisualSceneSpecV2; u: number }> = ({ spec, u }) => {
  const text = spec.text
  const look = typographyLookV3(text.typographyLookId)
  const palette = scenePalette(spec)
  const roles = sceneRoles(spec)
  const refined = spec.presentationProfile?.revision === EDITORIAL_MOTION_PROFILE_V2.revision
  const datum = refined && spec.editorialMotionCue === 'datum' && !!spec.editorialData
  const keywordStart = refined
    ? spec.editorialMotionCue === 'process' ? .31 : spec.editorialMotionCue === 'cause' ? .22
      : spec.editorialMotionCue === 'datum' ? .08 : spec.editorialMotionCue === 'comparison' ? .17 : .16
    : text.timing.keywordStart
  const words = text.keyword.split(/\s+/).filter(Boolean)
  const longest = Math.max(1, ...words.map(word => Array.from(word).length))
  const widthScale = spec.layout.textBounds.width / 72
  const keywordSize = Math.max(look.minKeywordCqmin, Math.min(look.maxKeywordCqmin,
    look.widthBudget * widthScale / longest *
      (spec.layout.textBounds.width < 50 && text.typographyLookId !== 'technical-condensed' ? .8 : 1)))
  const connectorP = phase(u, text.timing.connectorStart, .14)
  const closingP = text.closing && text.timing.closingStart !== undefined
    ? phase(u, text.timing.closingStart, .15) : 0
  const exit = 1 - phase(u, .86, .12)
  const visibleWords = [text.connector, text.keyword, text.closing, spec.editorialData?.value]
    .filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length
  const numeric = /^\s*(\d{1,3}(?:[.,]\d+)?)\s*%\s*$/.exec(text.keyword)
  const percentage = numeric ? Number(numeric[1].replace(',', '.')) : NaN
  return <div data-qc-text="true" data-qc-max-lines={text.maxLines} data-qc-visible-words={visibleWords}
    data-qc-text-region={spec.layout.textRegion} data-qc-typography-look={text.typographyLookId}
    data-qc-keyword-family={look.keywordFamily} style={{
      position: 'absolute', left: `${spec.layout.textBounds.x}%`, top: `${spec.layout.textBounds.y}%`,
      width: `${spec.layout.textBounds.width}%`, height: `${spec.layout.textBounds.height}%`, zIndex: 8,
      boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'stretch', gap: '.6cqmin', padding: '.8cqmin 1.1cqmin',
      textAlign: text.alignment, color: palette.text, fontSynthesis: 'none',
      opacity: exit, pointerEvents: 'none',
    }}>
    {text.connector && <div data-qc-connector="true" data-qc-text-glyph="true" style={{
      fontFamily: `${look.connectorFamily},serif`, fontWeight: look.connectorWeight,
      fontSize: '4.1cqmin', lineHeight: 1.09, color: spec.colorPalette ? roles.connector : palette.text,
      opacity: connectorP, transform: `translateY(${((1 - connectorP) * 1.1).toFixed(4)}cqmin)`,
      overflowWrap: 'break-word',
    }}>{text.connector}</div>}
    <div data-qc-keyword="true" data-qc-text-glyph="true" style={{
      display: 'block', maxWidth: '100%', fontFamily: `${look.keywordFamily},sans-serif`,
      fontWeight: look.keywordWeight, fontSize: `${keywordSize.toFixed(3)}cqmin`,
      lineHeight: look.lineHeight, letterSpacing: `${look.trackingEm}em`,
      textTransform: look.keywordCase === 'uppercase' ? 'uppercase' : 'none',
      whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'normal',
    }}>{words.map((word, index) => {
      const reveal = phase(u, keywordStart + Math.min(index, 3) * .045, .16)
      // A narrow split column has no horizontal reserve for a scale punch; the
      // underline supplies emphasis there without moving a glyph past QC bounds.
      const emphasis = spec.layout.textBounds.width >= 55 &&
        Math.abs(u - text.motion.emphasisStart) < .055 && index === 0 ? .025 : 0
      return <React.Fragment key={`${word}-${index}`}>
        {index > 0 && ' '}
        <span style={{ display: 'inline-block', opacity: reveal,
          clipPath: `inset(0 ${(100 - reveal * 100).toFixed(2)}% 0 0)`,
          transform: `translateY(${((1 - reveal) * 1.4).toFixed(4)}cqmin) scale(${(1 + emphasis).toFixed(4)})`,
          transformOrigin: '0 70%',
        }}>{word}</span>
      </React.Fragment>
    })}</div>
    {spec.editorialData && <div data-qc-text-glyph="true" style={{
      fontFamily: `${look.keywordFamily},sans-serif`, fontWeight: look.keywordWeight,
      fontSize: datum ? '13cqmin' : '7.1cqmin', lineHeight: 1, color: palette.text,
      opacity: phase(u, text.motion.emphasisStart - .12, .16),
    }}>{spec.editorialData.value}</div>}
    {text.closing && <div data-qc-closing="true" data-qc-text-glyph="true" style={{
      fontFamily: `${look.closingFamily},serif`, fontWeight: look.closingWeight,
      fontSize: refined ? '4.6cqmin' : '3.9cqmin', lineHeight: 1.08, color: palette.text,
      opacity: closingP, transform: `translateY(${((1 - closingP) * .8).toFixed(4)}cqmin)`,
      overflowWrap: 'break-word',
    }}>{text.closing}</div>}
    <div data-qc-text-glyph="true" style={{ width: '24%', minWidth: '7cqmin', height: '.33cqmin',
      margin: text.alignment === 'right' ? '.5cqmin 0 0 auto' : text.alignment === 'center' ? '.5cqmin auto 0' : '.5cqmin 0 0',
      background: roles.underline, transform: `scaleX(${phase(u, text.motion.emphasisStart - .08, .22).toFixed(4)})`,
      transformOrigin: text.alignment === 'right' ? '100% 50%' : '0 50%',
    }} />
    {(spec.editorialData || (Number.isFinite(percentage) && percentage >= 0 && percentage <= 100)) &&
      <div aria-label={`Indicador ${spec.editorialData?.value ?? text.keyword}`}
      style={{ height: '.42cqmin', width: '100%', background: `${palette.line}66`, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${spec.editorialData?.percent ?? percentage}%`, background: roles.underline,
        transform: `scaleX(${phase(u, text.motion.emphasisStart - .1, .24).toFixed(4)})`, transformOrigin: '0 50%' }} />
    </div>}
  </div>
}

/** Opt-in revision: actual-font fitting and selective emphasis. V15/V1/V2 above remain byte-stable. */
const NarrativeTextRecovery: React.FC<{ spec: VisualSceneSpecV2; runtimeAssets: readonly RuntimeRenderAssetV2[]; u: number }> =
  ({ spec, runtimeAssets, u }) => {
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { if (root.current) fitVisualTextV2(root.current) }, [spec])
  const text = spec.text
  const look = typographyLookV3(text.typographyLookId)
  const cleanExplainer = text.typographyLookId === 'editorial-strong'
  const keywordFamily = cleanExplainer ? 'Outfit' : look.keywordFamily
  const supportFamily = cleanExplainer ? 'Archivo' : look.connectorFamily
  const palette = scenePalette(spec)
  const roles = sceneRoles(spec)
  const contrast = chooseTextContrastV1(spec, runtimeAssets)
  const dark = contrast === 'dark-text'
  const datum = spec.editorialMotionCue === 'datum' && !!spec.editorialData
  const enter = phase(u, spec.compositionV2 ? spec.compositionV2.motionCue === 'data' ? .07
    : spec.compositionV2.motionCue === 'type-led' ? .09 : .18 : text.timing.keywordStart, .15)
  const exit = 1 - phase(u, .85, .13)
  const visibleWords = [text.connector, text.keyword, text.closing, spec.editorialData?.value]
    .filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length
  return <div ref={root} data-qc-text="true" data-qc-text-fit="v2" data-qc-max-lines={text.maxLines}
    data-qc-visible-words={visibleWords} data-qc-text-region={spec.layout.textRegion}
    data-qc-typography-look={text.typographyLookId} data-qc-keyword-family={keywordFamily}
    data-qc-contrast-treatment={contrast} style={{
      position: 'absolute', left: `${spec.layout.textBounds.x}%`, top: `${spec.layout.textBounds.y}%`,
      width: `${spec.layout.textBounds.width}%`, height: `${spec.layout.textBounds.height}%`,
      zIndex: 8, boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'stretch', gap: '.55cqmin', padding: '.7cqmin .95cqmin',
      textAlign: text.alignment, color: dark ? '#11131A' : palette.text, fontSynthesis: 'none', pointerEvents: 'none',
      opacity: exit,
      background: contrast === 'local-scrim'
        ? 'linear-gradient(90deg,rgba(7,7,9,.92),rgba(7,7,9,.74))' : 'transparent',
    }}>
    {text.connector && <div data-fit-body="true" data-qc-connector="true" data-qc-text-glyph="true" style={{
      fontFamily: `${supportFamily},serif`, fontWeight: cleanExplainer ? 700 : look.connectorWeight,
      fontSize: '4.2cqmin', lineHeight: 1.14, flexShrink: 0, color: dark ? '#11131A' : palette.text,
      opacity: phase(u, text.timing.connectorStart, .13),
    }}>{text.connector}</div>}
    <div data-fit-title="true" data-qc-keyword="true" data-qc-text-glyph="true" style={{
      display: 'block', maxWidth: '100%', flexShrink: 0, fontFamily: `${keywordFamily},sans-serif`,
      fontWeight: cleanExplainer ? 700 : look.keywordWeight, fontSize: datum ? '5.2cqmin' : '9.2cqmin', lineHeight: 1.05,
      letterSpacing: `${cleanExplainer ? -.012 : look.trackingEm}em`, textTransform: cleanExplainer ? 'none' : look.keywordCase === 'uppercase' ? 'uppercase' : 'none',
      color: dark ? spec.colorPalette?.tokens.accentDark ?? '#163048'
        : spec.colorPalette?.tokens.accentBright ?? roles.underline,
      opacity: enter, clipPath: `inset(0 ${(100 - enter * 100).toFixed(2)}% 0 0)`,
      transform: `translateY(${((1 - enter) * 1.1).toFixed(3)}cqmin)`,
    }}>{text.keyword}</div>
    {spec.editorialData && <div data-fit-body="true" data-fit-data="true" data-qc-text-glyph="true" style={{
      fontFamily: "'Space Mono',monospace", fontWeight: 700, fontSize: '12.5cqmin', lineHeight: 1.04,
      flexShrink: 0, color: dark ? spec.colorPalette?.tokens.accentDark ?? '#163048' : roles.underline,
      opacity: phase(u, text.motion.emphasisStart - .09, .16),
    }}>{spec.editorialData.value}</div>}
    {text.closing && <div data-fit-body="true" data-qc-closing="true" data-qc-text-glyph="true" style={{
      fontFamily: `${cleanExplainer ? 'Archivo' : look.closingFamily},sans-serif`, fontWeight: cleanExplainer ? 700 : look.closingWeight,
      fontSize: '3.85cqmin', lineHeight: 1.16, flexShrink: 0, color: dark ? '#11131A' : palette.text,
      opacity: phase(u, text.timing.closingStart ?? .3, .14),
    }}>{text.closing}</div>}
    <div data-qc-text-glyph="true" style={{ width: '18%', minWidth: '5cqmin', flexShrink: 0,
      height: '.33cqmin', marginTop: '.35cqmin', background: roles.underline,
      transform: `scaleX(${phase(u, text.motion.emphasisStart - .07, .2).toFixed(4)})`,
      transformOrigin: '0 50%', alignSelf: text.alignment === 'right' ? 'flex-end' :
        text.alignment === 'center' ? 'center' : 'flex-start',
    }} />
  </div>
}

/** Porcelain uses the same measured Text Fit and photo contrast authority as Visual Recovery. */
const NarrativeTextPremium: React.FC<{ spec: VisualSceneSpecV2; runtimeAssets: readonly RuntimeRenderAssetV2[]; u: number }> =
  ({ spec, runtimeAssets, u }) => {
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { if (root.current) fitVisualTextV2(root.current) }, [spec])
  const style = spec.premiumStyle!
  const type = PREMIUM_TYPE_THEMES[style.typographyTheme]
  const text = spec.text
  const contrast = chooseTextContrastV1(spec, runtimeAssets)
  const dark = contrast === 'dark-text'
  const ivory = dark ? '#17171B' : '#F4F2ED'
  const accent = dark ? '#283E8B' : style.accentPrimary
  const single = !/\s/u.test(text.keyword.trim())
  const treatment = single ? style.keywordTreatment : 'ivory-solid'
  const outlined = treatment.includes('outline')
  const highlighted = treatment === 'accent-solid' || treatment === 'accent-outline' || treatment === 'signature-accent'
  const datum = spec.editorialMotionCue === 'datum' && !!spec.editorialData
  const closingData = spec.compositionV2?.motionCue === 'data' && !spec.editorialData
    ? /\b\d{1,3}(?:[.,]\d+)?\s*%/u.exec(text.closing ?? '') : null
  const enter = phase(u, text.timing.keywordStart, .15)
  const exit = 1 - phase(u, .85, .13)
  const visibleWords = [text.connector, text.keyword, text.closing, spec.editorialData?.value]
    .filter(Boolean).join(' ').split(/\s+/u).filter(Boolean).length
  return <div ref={root} data-qc-text="true" data-qc-text-fit="v2" data-qc-max-lines={text.maxLines}
    data-qc-visible-words={visibleWords} data-qc-text-region={spec.layout.textRegion}
    data-qc-keyword-family={type.title} data-qc-contrast-treatment={contrast}
    data-qc-premium-theme={style.typographyTheme} data-qc-premium-treatment={style.keywordTreatment}
    style={{ position: 'absolute', left: `${spec.layout.textBounds.x}%`, top: `${spec.layout.textBounds.y}%`,
      width: `${spec.layout.textBounds.width}%`, height: `${spec.layout.textBounds.height}%`,
      zIndex: 8, boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', gap: '.55cqmin', padding: '.7cqmin .95cqmin',
      textAlign: text.alignment, color: ivory, fontSynthesis: 'none', pointerEvents: 'none', opacity: exit,
      background: contrast === 'local-scrim'
        ? 'linear-gradient(90deg,rgba(7,7,9,.92),rgba(7,7,9,.74))' : 'transparent' }}>
    {text.connector && <div data-fit-body="true" data-qc-connector="true" data-qc-text-glyph="true" style={{
      fontFamily: `'${type.body}',sans-serif`, fontWeight: 500, fontSize: '4.2cqmin',
      lineHeight: 1.14, flexShrink: 0, opacity: phase(u, spec.compositionV2 ? .07 : text.timing.connectorStart, .13),
    }}>{text.connector}</div>}
    <div data-fit-title="true" data-qc-keyword="true" data-qc-text-glyph="true" style={{
      maxWidth: '100%', flexShrink: 0,
      fontFamily: treatment === 'signature-accent' ? "'Dancing Script',cursive" : `'${type.title}',sans-serif`,
      fontWeight: type.titleWeight, fontSize: spec.compositionV2?.motionCue === 'data' ? '6.2cqmin'
        : datum ? '5.2cqmin' : spec.compositionV2 ? '11.8cqmin' : '9.2cqmin', lineHeight: 1.06,
      letterSpacing: '-.012em', color: outlined ? ivory : highlighted ? accent : ivory,
      WebkitTextStroke: outlined ? `.08cqmin ${treatment === 'accent-outline' ? accent : '#C7C8CC'}` : undefined,
      opacity: enter, clipPath: outlined ? undefined : `inset(0 ${(100 - enter * 100).toFixed(2)}% 0 0)`,
      transform: `translateY(${((1 - enter) * 1.1).toFixed(3)}cqmin)`,
    }}>{text.keyword}</div>
    {spec.editorialData && <div data-fit-body="true" data-fit-data="true" data-qc-text-glyph="true" style={{
      fontFamily: `'${type.data}',sans-serif`, fontWeight: 700,
      fontSize: '12.5cqmin', lineHeight: 1.04, flexShrink: 0, color: accent,
      opacity: phase(u, spec.compositionV2 ? .13 : text.motion.emphasisStart - .09, .16),
    }}>{spec.editorialData.value}</div>}
    {text.closing && <div data-fit-body="true" data-qc-closing="true" data-qc-text-glyph="true" style={{
      fontFamily: `'${type.body}',sans-serif`, fontWeight: 400,
      fontSize: spec.compositionV2 ? '4.2cqmin' : '3.85cqmin',
      lineHeight: 1.16, flexShrink: 0, opacity: phase(u, closingData ? .07
        : spec.compositionV2 ? .36 : text.timing.closingStart ?? .3, .14),
    }}>{closingData ? <>{text.closing.slice(0, closingData.index)}<span style={{ display: 'block',
      fontFamily: `'${type.data}',sans-serif`, fontWeight: 700, fontSize: '2.05em',
      lineHeight: 1.04, color: accent }}>{closingData[0]}</span>
      {text.closing.slice(closingData.index + closingData[0].length)}</> : text.closing}</div>}
    <div data-qc-text-glyph="true" style={{ width: treatment === 'editorial-underline' ? '26%' : '15%',
      minWidth: '4cqmin', flexShrink: 0, height: '.17cqmin', marginTop: '.4cqmin',
      background: accent, transform: `scaleX(${phase(u, spec.compositionV2 ? .43 : text.motion.emphasisStart - .07, .2).toFixed(4)})`,
      transformOrigin: '0 50%', alignSelf: text.alignment === 'right' ? 'flex-end' :
        text.alignment === 'center' ? 'center' : 'flex-start',
    }} />
  </div>
}

const NarrativeTextV15: React.FC<{ spec: VisualSceneSpecV2; runtimeAssets: readonly RuntimeRenderAssetV2[]; u: number }> =
  ({ spec, runtimeAssets, u }) => {
  if (spec.presentationProfile?.revision === PREMIUM_TYPE_COLOR_PROFILE_V1.revision ||
      spec.presentationProfile?.revision === FAMILIES_MOTION_PROFILE_V2.revision)
    return <NarrativeTextPremium spec={spec} runtimeAssets={runtimeAssets} u={u} />
  if (spec.presentationProfile?.revision === EDITORIAL_EXPLAINER_LIGHT_V1.revision)
    return <EditorialLightText spec={spec} u={u} />
  if (spec.presentationProfile?.revision === EDITORIAL_EXPLAINER_LIGHT_V2.revision)
    return <EditorialLightV2Text spec={spec} u={u} />
  if (spec.presentationProfile?.revision === VISUAL_RECOVERY_PROFILE_V1.revision)
    return <NarrativeTextRecovery spec={spec} runtimeAssets={runtimeAssets} u={u} />
  if (spec.presentationProfile) return <NarrativeTextPilot spec={spec} u={u} />
  const text = spec.text
  const look = typographyLookV3(text.typographyLookId)
  const palette = scenePalette(spec)
  const roles = sceneRoles(spec)
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
      color: spec.colorPalette ? roles.connector : undefined,
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
      background: roles.underline, transform: `scaleX(${keywordP.toFixed(4)})`,
      transformOrigin: align === 'left' ? '0 50%' : align === 'right' ? '100% 50%' : '50% 50%' }} />
  </div>
}

export const MotionGraphicV15: React.FC<{
  spec: VisualSceneSpecV2
  runtimeAssets: readonly RuntimeRenderAssetV2[]
  u: number
}> = ({ spec, runtimeAssets, u }) => {
  // Both geometries are part of the same frozen SceneSpec. The current canvas
  // chooses one; no runtime recomputation can drift from the stored identity.
  const layout = window.innerWidth > window.innerHeight
    ? spec.lightStyle?.landscapeLayout ?? spec.compositionV2?.landscapeLayout ?? spec.layout : spec.layout
  const displayed = layout === spec.layout ? spec : { ...spec, layout }
  const active = displayed.slots.filter((slot): slot is Extract<SceneSlotV2, { state: 'present' | 'procedural' }> =>
    slot.state === 'present' || slot.state === 'procedural')
  const runtimeBySlot = new Map(runtimeAssets.map(asset => [asset.slotId, asset]))
  return <div key={sceneSpecReactKeyAny(spec)} data-visual-mvp="true" data-visual-composition="v15"
    data-qc-layout-family={displayed.layout.family} data-visual-density={spec.direccion.densidad}
    data-qc-decorator-count="0" data-qc-empty-hero-frames="0" data-qc-video-style={spec.videoStyle.id}
    data-qc-color-palette={spec.premiumStyle?.porcelainPalette ?? spec.colorPalette?.family ?? 'historical-video-style'}
    data-qc-color-variant={spec.colorPalette?.variant ?? 'historical'}
    data-qc-accent-primary={spec.premiumStyle?.accentPrimary ?? spec.colorPalette?.tokens.accentPrimary ?? ''}
    style={{ position: 'absolute', inset: 0, containerType: 'size', overflow: 'hidden' }}>
    {spec.lightStyle ? <><EditorialLightBackground spec={displayed} />
      {spec.lightStyle.revision === EDITORIAL_EXPLAINER_LIGHT_V2.revision
        ? <EditorialLightV2Connector spec={displayed} u={u} /> : <EditorialConnector spec={displayed} u={u} />}</>
      : <QuietBackground spec={displayed} u={u} />}
    {spec.lightStyle ? null : spec.compositionV2 ? <FamilyV2AccentGraphics spec={displayed} u={u}
      accent={scenePalette(spec).accent} /> : <StructureGrammar spec={spec} u={u} />}
    {active.map(slot => {
      const slotLayout = displayed.layout.slotLayouts.find(value => value.slotId === slot.slotId)
      if (!slotLayout) throw new Error(`VISUAL_RUNTIME_LAYOUT_SLOT_REQUIRED:${slot.slotId}`)
      return <SceneAssetSlot key={slot.slotId} spec={displayed} slot={slot} layout={slotLayout}
        runtime={runtimeBySlot.get(slot.slotId)} u={u} />
    })}
    {spec.lightStyle && (spec.lightStyle.revision === EDITORIAL_EXPLAINER_LIGHT_V2.revision
      ? <EditorialLightV2DataRepeater spec={displayed} u={u} /> : <EditorialDataRepeater spec={displayed} u={u} />)}
    <NarrativeTextV15 spec={displayed} runtimeAssets={runtimeAssets} u={u} />
  </div>
}
