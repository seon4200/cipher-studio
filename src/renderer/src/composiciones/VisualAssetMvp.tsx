import React from 'react'
import { FONDOS } from '../../../shared/escena'
import {
  effectiveSceneLayoutGeometry,
  evaluateAssetMotion,
  sceneSpecReactKey,
  typographyLookForSceneSpec,
  type PresentHeroSlotV1,
  type ProceduralHeroSlotV1,
  type RuntimeRenderAssetV1,
  type VisualMvpFontPair,
  type VisualSceneSpecV1,
} from '../../../shared/visual-scene-spec'
import { coloresEscena } from '../sistemas'
import { IconoSolar } from './IconoSolar'

const FONT_PAIRS: Record<VisualMvpFontPair, {
  connector: string
  keyword: string
  connectorWeight: number
  keywordWeight: number
}> = {
  'technical-black': {
    connector: 'Space Mono', keyword: 'Archivo Black', connectorWeight: 700, keywordWeight: 400,
  },
  'editorial-black': {
    connector: 'DM Serif Display', keyword: 'Archivo Black', connectorWeight: 400, keywordWeight: 400,
  },
}

function rgb(hex: string): [number, number, number] {
  const source = hex.replace('#', '')
  return [0, 2, 4].map(index => parseInt(source.slice(index, index + 2), 16) / 255) as [number, number, number]
}

function progress(u: number, start: number, duration: number): number {
  const p = Math.min(1, Math.max(0, (u - start) / duration))
  return 1 - Math.pow(1 - p, 3)
}

function sourceViewBox(slot: PresentHeroSlotV1): string {
  if (slot.fitPolicy === 'contain') return '0 0 100 100'
  const box = slot.bounds.alphaBounds
  return `${(box.x * 100).toFixed(4)} ${(box.y * 100).toFixed(4)} ` +
    `${(box.width * 100).toFixed(4)} ${(box.height * 100).toFixed(4)}`
}

const AssetImage: React.FC<{
  slot: PresentHeroSlotV1
  source: string
  accent: string
  support: string
}> = ({ slot, source, accent, support }) => {
  const suffix = slot.sha256.slice(0, 12)
  const maskId = `cipher-mask-${suffix}`
  const filterId = `cipher-duotone-${suffix}`
  const low = rgb(support)
  const high = rgb(accent)
  const image = <image href={source} x="0" y="0" width="100" height="100"
    preserveAspectRatio="xMidYMid meet" />

  return (
    <svg viewBox={sourceViewBox(slot)} preserveAspectRatio="xMidYMid meet"
      width="100%" height="100%" role="img" aria-label="Hero visual verificado">
      {slot.tint.treatment === 'none' && image}
      {slot.tint.treatment === 'accent-mask' && <>
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"
            style={{ maskType: 'alpha' }}>{image}</mask>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill={accent} mask={`url(#${maskId})`} />
      </>}
      {slot.tint.treatment === 'duotone' && <>
        <defs>
          <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%"
            colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={
              '.2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0'
            } />
            <feComponentTransfer>
              <feFuncR type="table" tableValues={`${low[0]} ${high[0]}`} />
              <feFuncG type="table" tableValues={`${low[1]} ${high[1]}`} />
              <feFuncB type="table" tableValues={`${low[2]} ${high[2]}`} />
              <feFuncA type="identity" />
            </feComponentTransfer>
          </filter>
        </defs>
        <g filter={`url(#${filterId})`}>{image}</g>
      </>}
    </svg>
  )
}

export const ProjectAssetHero: React.FC<{
  spec: VisualSceneSpecV1
  slot: PresentHeroSlotV1
  runtimeAsset: RuntimeRenderAssetV1
  u: number
}> = ({ spec, slot, runtimeAsset, u }) => {
  const layout = effectiveSceneLayoutGeometry(spec)
  const envelope = layout.heroEnvelope
  if (!envelope) throw new Error('VISUAL_RUNTIME_HERO_LAYOUT_REQUIRED')
  const motion = evaluateAssetMotion(slot.motion, u)
  const fondo = FONDOS[spec.direccion.fondo]
  const tone = 'tonoDominante' in fondo ? fondo.tonoDominante : fondo.tono
  const colors = coloresEscena(spec.sistema, tone)
  return (
    <div
      key={sceneSpecReactKey(spec)}
      data-qc-hero="true"
      data-qc-slot="hero"
      data-qc-state="present"
      data-qc-treatment={slot.tint.treatment}
      data-qc-hero-placement={layout.heroPlacement}
      style={{
        position: 'absolute',
        left: `${envelope.x + envelope.width / 2}%`,
        top: `${envelope.y + envelope.height / 2}%`,
        width: `${envelope.width}%`,
        height: `${envelope.height}%`,
        transform: `translate(-50%,-50%) translate3d(${motion.translateXCqmin.toFixed(4)}cqmin,` +
          `${motion.translateYCqmin.toFixed(4)}cqmin,0) scale(${motion.scale.toFixed(5)})`,
        transformOrigin: '50% 50%',
        opacity: motion.opacity,
        willChange: 'transform,opacity',
        filter: 'drop-shadow(0 1.4cqmin 2.2cqmin rgba(0,0,0,.58))',
      }}
    >
      <AssetImage slot={slot} source={runtimeAsset.objectUrl}
        accent={colors.acento} support={colors.apoyo} />
    </div>
  )
}

/**
 * Solar reaches the renderer only as a canonical local icon already selected by the resolver.
 * It has no RenderBinding and does not consult aliases, providers, or the network here.
 */
export const ProceduralSolarHero: React.FC<{
  spec: VisualSceneSpecV1
  slot: ProceduralHeroSlotV1
  u: number
}> = ({ spec, slot, u }) => {
  const layout = effectiveSceneLayoutGeometry(spec)
  const envelope = layout.heroEnvelope
  if (!envelope) throw new Error('VISUAL_RUNTIME_HERO_LAYOUT_REQUIRED')
  const motion = evaluateAssetMotion(slot.motion, u)
  return (
    <div
      key={sceneSpecReactKey(spec)}
      data-qc-hero="true"
      data-qc-slot="hero"
      data-qc-state="procedural"
      data-qc-treatment="none"
      data-qc-hero-placement={layout.heroPlacement}
      style={{
        position: 'absolute',
        left: `${envelope.x + envelope.width / 2}%`,
        top: `${envelope.y + envelope.height / 2}%`,
        width: `${envelope.width}%`,
        height: `${envelope.height}%`,
        transform: `translate(-50%,-50%) translate3d(${motion.translateXCqmin.toFixed(4)}cqmin,` +
          `${motion.translateYCqmin.toFixed(4)}cqmin,0) scale(${motion.scale.toFixed(5)})`,
        transformOrigin: '50% 50%',
        opacity: motion.opacity,
        willChange: 'transform,opacity',
        color: 'var(--acento)',
        filter: 'drop-shadow(0 1.4cqmin 2.2cqmin rgba(0,0,0,.58))',
      }}
    >
      <IconoSolar
        concepto={{ emoji: '', etiqueta: slot.solarIcon, icono: slot.solarIcon }}
        estilo={slot.solarStyle}
        canonicalId={slot.solarIcon}
        className="es-svg"
        titulo={`Hero Solar ${slot.solarIcon}`}
      />
    </div>
  )
}

export const EditorialText: React.FC<{ spec: VisualSceneSpecV1; u: number }> = ({ spec, u }) => {
  const text = spec.text
  const look = typographyLookForSceneSpec(spec)
  const legacyFonts = text.fontPairId ? FONT_PAIRS[text.fontPairId] : null
  if (!look && !legacyFonts) throw new Error('VISUAL_RUNTIME_TYPOGRAPHY_REQUIRED')
  const layout = effectiveSceneLayoutGeometry(spec)
  const fonts = look ? {
    connector: look.connectorFamily,
    keyword: look.keywordFamily,
    closing: look.closingFamily,
    connectorWeight: look.connectorWeight,
    keywordWeight: look.keywordWeight,
    closingWeight: look.closingWeight,
  } : { ...legacyFonts!, closing: legacyFonts!.connector, closingWeight: legacyFonts!.connectorWeight }
  const connectorP = progress(u, text.timing.connectorStart, 0.12)
  const keywordP = progress(u, text.timing.keywordStart, 0.16)
  const closingP = text.closing && text.timing.closingStart !== undefined
    ? progress(u, text.timing.closingStart, 0.12) : 0
  const overshoot = keywordP < 0.78
    ? 0.88 + keywordP / 0.78 * 0.16
    : 1.04 - (keywordP - 0.78) / 0.22 * 0.04
  const exitOpacity = u <= 0.9 ? 1 : Math.max(0, (1 - u) / 0.1)
  const keywordParts = text.keyword.split(/\s+/).filter(Boolean)
  const longestKeyword = Math.max(1, ...keywordParts.map(word => Array.from(word).length))
  const widthScale = layout.textBounds.width / 77
  const keywordSize = look
    ? Math.max(look.minKeywordCqmin, Math.min(look.maxKeywordCqmin, look.widthBudget * widthScale / longestKeyword))
    : Math.max(4.6, Math.min(
      spec.visualMode === 'editorial-text' ? 10.3 : 8.1,
      (spec.visualMode === 'editorial-text' ? 78 : 74) / longestKeyword,
    ))
  const align = text.alignment
  const visibleWords = [text.connector, text.keyword, text.closing]
    .filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length
  const editorial = spec.visualMode === 'editorial-text'
  const v14 = Boolean(spec.layout && look)
  const transformOrigin = align === 'left' ? '0 70%' : align === 'right' ? '100% 70%' : '50% 70%'
  const ruleMargin = align === 'left' ? '.8cqmin 0 0' : align === 'right' ? '.8cqmin 0 0 auto' : '.8cqmin auto 0'
  const v14Surface: React.CSSProperties = layout.family === 'impact'
    ? { background: 'color-mix(in srgb,var(--sup) 76%,transparent)', borderTop: '.28cqmin solid var(--acento)',
        borderBottom: '.12cqmin solid color-mix(in srgb,var(--apoyo) 48%,transparent)' }
    : layout.family === 'focus'
      ? { background: 'var(--sup)', borderRadius: '2.8cqmin', border: '.14cqmin solid color-mix(in srgb,var(--apoyo) 48%,transparent)' }
      : layout.family === 'split'
        ? { background: 'color-mix(in srgb,var(--sup) 88%,transparent)', borderInlineStart: '.55cqmin solid var(--acento)' }
        : layout.family === 'diagonal'
          ? { background: 'var(--sup)', borderLeft: '.65cqmin solid var(--acento)', borderBottom: '.18cqmin solid var(--apoyo)' }
          : layout.family === 'document'
            ? { background: 'var(--sup)', border: '.14cqmin solid color-mix(in srgb,var(--apoyo) 58%,transparent)',
                boxShadow: '1.15cqmin 1.15cqmin 0 color-mix(in srgb,var(--acento) 35%,transparent)' }
            : layout.family === 'poster'
              ? { background: 'var(--sup)', borderTop: '.5cqmin solid var(--acento)' }
              : { background: 'var(--sup)', borderLeft: '.75cqmin solid var(--acento)' }

  return (
    <div data-qc-text="true" data-qc-max-lines={text.maxLines}
      data-qc-visible-words={visibleWords} data-visual-editorial-v2="true"
      data-qc-text-region={layout.textRegion}
      data-qc-typography-look={text.typographyLookId ?? text.fontPairId}
      data-qc-keyword-family={fonts.keyword}
      style={{
        position: 'absolute',
        ...(v14 ? {
          left: `${layout.textBounds.x}%`, top: `${layout.textBounds.y}%`,
          width: `${layout.textBounds.width}%`, height: `${layout.textBounds.height}%`,
        } : {
          left: '11.5%', right: '11.5%',
          ...(editorial ? { top: '27%', minHeight: '36%' } : { bottom: '14.5%', minHeight: '20%' }),
          maxHeight: editorial ? '48%' : '25%',
        }),
        zIndex: 8,
        boxSizing: 'border-box', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'stretch',
        gap: v14 ? (layout.textBounds.height < 30 ? '.65cqmin' : '1.05cqmin') : (editorial ? '1.35cqmin' : '.85cqmin'),
        padding: v14 ? (layout.textBounds.width < 50 ? '2.8cqmin 2.4cqmin' : '3.3cqmin 3.8cqmin')
          : (editorial ? '4.3cqmin 4.6cqmin 4cqmin' : '2.6cqmin 3.4cqmin 2.4cqmin'),
        textAlign: align, color: 'var(--texto)', opacity: exitOpacity,
        ...(v14 ? v14Surface : {
          background: 'var(--sup)',
          borderLeft: '.75cqmin solid var(--acento)',
          borderTop: '.16cqmin solid color-mix(in srgb,var(--apoyo) 42%,transparent)',
          boxShadow: '0 1.5cqmin 4.8cqmin rgba(0,0,0,.28)',
        }),
        ...(v14 ? { fontSynthesis: 'none' } : {}),
      }}>
      {text.connector && <div data-qc-connector="true" data-qc-text-glyph="true" style={{
        fontFamily: `${fonts.connector},serif`, fontWeight: fonts.connectorWeight,
        fontSize: v14 ? (layout.textBounds.width < 50 ? '2.55cqmin' : '3.15cqmin') : (editorial ? '3.55cqmin' : '2.9cqmin'),
        lineHeight: 1.1, fontStyle: text.fontPairId === 'editorial-black' || text.typographyLookId === 'elegant-serif' ? 'italic' : 'normal',
        letterSpacing: v14 ? '.035em' : (text.fontPairId === 'technical-black' ? '.08em' : '.01em'),
        opacity: connectorP,
        transform: `translateY(${((1 - connectorP) * 1.5).toFixed(4)}cqmin)`,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{text.connector}</div>}
      <span data-qc-keyword="true" data-qc-text-glyph="true" style={{
        maxWidth: '100%', fontFamily: `${fonts.keyword},sans-serif`, fontWeight: fonts.keywordWeight,
        fontSize: `${keywordSize.toFixed(3)}cqmin`, lineHeight: look?.lineHeight ?? .9,
        letterSpacing: `${look?.trackingEm ?? -.025}em`,
        textTransform: look?.keywordCase === 'preserve' ? 'none' : 'uppercase', display: 'block', opacity: keywordP,
        // A single narrative keyword is one semantic unit: shrinking is preferable to
        // splitting INDIGNACIÓN/ACCIDENTE in the middle of the word. Multi-word keywords
        // may still wrap only at their existing spaces.
        whiteSpace: keywordParts.length === 1 ? 'nowrap' : 'normal',
        overflowWrap: 'normal', wordBreak: 'keep-all',
        transform: `scale(${overshoot.toFixed(5)})`, transformOrigin,
        textShadow: '0 .35cqmin 2.2cqmin var(--sombra-pie,rgba(0,0,0,.8))',
      }}>{text.keyword}</span>
      {text.closing && <span data-qc-closing="true" data-qc-text-glyph="true" style={{
        maxWidth: '100%', fontFamily: `${fonts.closing},serif`, fontWeight: fonts.closingWeight,
        fontSize: v14 ? (layout.textBounds.width < 50 ? '2.35cqmin' : '2.85cqmin') : (editorial ? '3.25cqmin' : '2.75cqmin'),
        lineHeight: 1.12, opacity: closingP,
        transform: `translateY(${((1 - closingP) * 1.2).toFixed(4)}cqmin)`,
        display: 'block', whiteSpace: 'normal', overflowWrap: 'break-word',
      }}>{text.closing}</span>}
      <div data-qc-text-glyph="true" style={{ height: '.58cqmin', width: editorial ? '17cqmin' : '11cqmin',
        margin: ruleMargin, borderRadius: '99cqmin',
        background: 'var(--acento)', transform: `scaleX(${keywordP.toFixed(4)})`,
        transformOrigin: align === 'left' ? '0 50%' : align === 'right' ? '100% 50%' : '50% 50%', opacity: keywordP }} />
    </div>
  )
}

export const VisualAssetMvp: React.FC<{
  spec: VisualSceneSpecV1
  runtimeAssets: readonly RuntimeRenderAssetV1[]
  u: number
}> = ({ spec, runtimeAssets, u }) => {
  const slot = spec.slots.find((candidate): candidate is PresentHeroSlotV1 => candidate.state === 'present')
  const solarSlot = spec.slots.find((candidate): candidate is ProceduralHeroSlotV1 => candidate.state === 'procedural')
  const runtime = runtimeAssets.find(candidate => candidate.slotId === 'hero')
  return <>
    {spec.visualMode === 'asset-led' && slot && runtime &&
      <ProjectAssetHero spec={spec} slot={slot} runtimeAsset={runtime} u={u} />}
    {spec.visualMode === 'asset-led' && solarSlot &&
      <ProceduralSolarHero spec={spec} slot={solarSlot} u={u} />}
    <EditorialText spec={spec} u={u} />
  </>
}
