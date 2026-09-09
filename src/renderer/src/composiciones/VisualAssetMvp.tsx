import React from 'react'
import { ESTRUCTURAS, FONDOS } from '../../../shared/escena'
import {
  VISUAL_MVP_HERO_ENVELOPES,
  evaluateAssetMotion,
  sceneSpecReactKey,
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
  const structure = ESTRUCTURAS[spec.direccion.estructura]
  const envelope = VISUAL_MVP_HERO_ENVELOPES[spec.direccion.estructura]
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
      style={{
        position: 'absolute',
        left: `${structure.heroe.x}%`,
        top: `${structure.heroe.y}%`,
        width: `${envelope.widthPct}%`,
        height: `${envelope.heightPct}%`,
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
  const structure = ESTRUCTURAS[spec.direccion.estructura]
  const envelope = VISUAL_MVP_HERO_ENVELOPES[spec.direccion.estructura]
  const motion = evaluateAssetMotion(slot.motion, u)
  return (
    <div
      key={sceneSpecReactKey(spec)}
      data-qc-hero="true"
      data-qc-slot="hero"
      data-qc-state="procedural"
      data-qc-treatment="none"
      style={{
        position: 'absolute',
        left: `${structure.heroe.x}%`,
        top: `${structure.heroe.y}%`,
        width: `${envelope.widthPct}%`,
        height: `${envelope.heightPct}%`,
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
  const fonts = FONT_PAIRS[text.fontPairId]
  const connectorP = progress(u, text.timing.connectorStart, 0.12)
  const keywordP = progress(u, text.timing.keywordStart, 0.16)
  const closingP = text.closing && text.timing.closingStart !== undefined
    ? progress(u, text.timing.closingStart, 0.12) : 0
  const overshoot = keywordP < 0.78
    ? 0.88 + keywordP / 0.78 * 0.16
    : 1.04 - (keywordP - 0.78) / 0.22 * 0.04
  const exitOpacity = u <= 0.9 ? 1 : Math.max(0, (1 - u) / 0.1)
  const keywordLength = Array.from(text.keyword).length
  const keywordSize = spec.visualMode === 'editorial-text'
    // A long editorial keyword is still valid input. The certified max is two lines, but
    // V1's keyword row is intentionally a single dominant line; scale it before it would
    // clip rather than accepting a broken frame. Legacy text never reaches this component.
    ? (keywordLength > 10 ? 8.6 : 12.4)
    : (keywordLength > 13 ? 7.4 : 9.2)
  const align = text.alignment === 'left' ? 'left' : 'center'
  const visibleWords = [text.connector, text.keyword, text.closing]
    .filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length

  return (
    <div data-qc-text="true" data-qc-max-lines={text.maxLines}
      data-qc-visible-words={visibleWords} style={{
        position: 'absolute', left: '8.33%', right: '8.33%', bottom: '13.54%',
        height: spec.visualMode === 'editorial-text' ? '27%' : '23%', zIndex: 8,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: align,
        color: 'var(--texto)', opacity: exitOpacity,
      }}>
      {text.connector && <div data-qc-connector="true" style={{
        fontFamily: `${fonts.connector},serif`, fontWeight: fonts.connectorWeight,
        fontSize: spec.visualMode === 'editorial-text' ? '3.7cqmin' : '3.15cqmin',
        lineHeight: 1.1, fontStyle: text.fontPairId === 'editorial-black' ? 'italic' : 'normal',
        letterSpacing: text.fontPairId === 'technical-black' ? '.08em' : '.01em',
        opacity: connectorP,
        transform: `translateY(${((1 - connectorP) * 1.5).toFixed(4)}cqmin)`,
        marginBottom: '1.1cqmin', whiteSpace: 'nowrap',
      }}>{text.connector}</div>}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: align === 'left' ? 'flex-start' : 'center',
        gap: '1.35cqmin', minWidth: 0, whiteSpace: 'nowrap' }}>
        <span data-qc-keyword="true" style={{
          fontFamily: `${fonts.keyword},sans-serif`, fontWeight: fonts.keywordWeight,
          fontSize: `${keywordSize}cqmin`, lineHeight: .9, letterSpacing: '-.025em',
          textTransform: 'uppercase', display: 'inline-block', opacity: keywordP,
          transform: `scale(${overshoot.toFixed(5)})`, transformOrigin: align === 'left' ? '0 70%' : '50% 70%',
          textShadow: '0 .35cqmin 2.2cqmin var(--sombra-pie,rgba(0,0,0,.8))',
        }}>{text.keyword}</span>
        {text.closing && <span data-qc-closing="true" style={{
          fontFamily: `${fonts.connector},serif`, fontWeight: fonts.connectorWeight,
          fontSize: spec.visualMode === 'editorial-text' ? '3.5cqmin' : '2.9cqmin',
          lineHeight: 1, opacity: closingP,
          transform: `translateY(${((1 - closingP) * 1.2).toFixed(4)}cqmin)`,
          display: 'inline-block',
        }}>{text.closing}</span>}
      </div>
      <div style={{ height: '.75cqmin', width: spec.visualMode === 'editorial-text' ? '20cqmin' : '13cqmin',
        margin: align === 'left' ? '2.2cqmin 0 0' : '2.2cqmin auto 0', borderRadius: '99cqmin',
        background: 'var(--acento)', transform: `scaleX(${keywordP.toFixed(4)})`,
        transformOrigin: align === 'left' ? '0 50%' : '50% 50%', opacity: keywordP }} />
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
