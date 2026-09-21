import { createLightLayoutV2, type LightStyleV2 } from './editorial-explainer-light-v2'
import type { VisualLayoutV4 } from './visual-layout-v4'

/** Frozen opt-in art-direction contract. V1/V2 are never reinterpreted. */
export const EDITORIAL_EXPLAINER_V3 = Object.freeze({
  id: 'editorial-explainer-v3' as const,
  revision: 'editorial-explainer-art-direction-2026-09-v3' as const,
})
export const EDITORIAL_V3_ACCENTS = Object.freeze({
  orange: { main: '#F26E35', light: '#F6A078', dark: '#D85125', text: '#B53F18' },
  teal: { main: '#238C87', light: '#7BC0BA', dark: '#176B67', text: '#105955' },
  crimson: { main: '#B8444F', light: '#DB8990', dark: '#8E2E38', text: '#79242D' },
})
export type EditorialV3Accent = keyof typeof EDITORIAL_V3_ACCENTS
export type EditorialV3Placement = 'top-dominant'|'top-left'|'top-right'|'center-left'|'center-right'|
  'left-of-hero'|'right-of-hero'|'between-assets'|'bottom-left'|'bottom-center'|'full-type'
export type LightStyleV3 = Omit<LightStyleV2, 'revision'|'connector'> & {
  revision: typeof EDITORIAL_EXPLAINER_V3.revision
  artDirectionRevision: 'editorial-explainer-art-direction-v3'
  accentTheme: EditorialV3Accent
  compositionDensity: 'minimal'|'editorial'|'rich'
  textPlacement: EditorialV3Placement
  typeRole: 'display-hero'|'narrative'|'data-display'
  heroTreatment: 'clean-hero'|'composite-hero'|'none'
  supportTreatment: 'paper-icon-card'|'black-micro-badge'|'accent-tile'
  connector: { variant:'straight'|'curved-short'|'curved-wide'|'dashed'; state:'static'|'draw'; arrow:boolean; dotAnchors:boolean }|null
  microdetailPreset: 'none'|'editorial-2'|'technical-4'|'rich-5'
  microdetailVariant: number
  dataRepeaterVariant: 'compact-prominent-v3'|'none'
  transitionVariant: 'fade-slide'|'paired-exit'|'stagger-out'
  narrativeBeats: readonly { at:number; target:'text'|'hero'|'support-1'|'support-2'|'connector'|'data'|'microdetails' }[]
}

const rect=(x:number,y:number,width:number,height:number)=>({x,y,width,height})
export function createLightLayoutV3(mode:'asset-led'|'editorial-text',supports:number,cue:LightStyleV3['motionCue'],
  orientation:'portrait'|'landscape',placement:EditorialV3Placement):VisualLayoutV4 {
  const out=createLightLayoutV2(mode,supports,cue,orientation)
  const landscape=orientation==='landscape'
  if(mode==='editorial-text') out.textBounds=cue==='count'
    ? (landscape?rect(8,10,42,78):rect(8,8,84,30))
    : (landscape?rect(10,18,80,64):rect(9,24,82,55))
  else if(['top-dominant','top-left','top-right'].includes(placement)) out.textBounds=landscape?rect(8,8,48,30):rect(8,7,84,25)
  else if(['center-left','left-of-hero'].includes(placement)) out.textBounds=landscape?rect(7,30,38,50):rect(6,33,42,43)
  else if(['center-right','right-of-hero','between-assets'].includes(placement)) out.textBounds=landscape?rect(57,25,37,55):rect(52,34,42,42)
  else out.textBounds=landscape?rect(11,70,78,22):rect(8,72,84,22)
  out.textRegion=placement==='full-type'?'center-editorial':placement.includes('right')?'right':placement.startsWith('bottom')?'bottom':'left'
  for(const slot of out.slotLayouts){
    if(slot.slotId==='hero') {
      const textRight=['center-right','right-of-hero','between-assets'].includes(placement)
      const textLeft=['center-left','left-of-hero'].includes(placement)
      const textTop=['top-dominant','top-left','top-right'].includes(placement)
      slot.envelope=landscape
        ? textRight?rect(5,14,45,74):textLeft?rect(50,13,45,75):textTop?rect(58,20,36,68):rect(23,10,54,56)
        : textRight?rect(4,23,43,50):textLeft?rect(53,22,43,52):textTop?rect(23,35,54,46):rect(23,15,54,48)
    }
    else if(slot.slotId==='support-1') slot.envelope=landscape?rect(7,68,14,24):rect(7,65,22,18)
    else slot.envelope=landscape?rect(80,12,13,22):rect(73,14,20,17)
  }
  return out
}

export function validateLightStyleV3(v:unknown,mode:'asset-led'|'editorial-text',supports:number):asserts v is LightStyleV3 {
  const s=v as LightStyleV3
  if(!s||s.revision!==EDITORIAL_EXPLAINER_V3.revision||s.artDirectionRevision!=='editorial-explainer-art-direction-v3' ||
    !(s.accentTheme in EDITORIAL_V3_ACCENTS)||!['minimal','editorial','rich'].includes(s.compositionDensity)||
    s.shadowPreset!=='upper-left-contact-ambient-v1'||!Number.isInteger(s.microdetailVariant)||s.microdetailVariant<0||s.microdetailVariant>7)
    throw new Error('EDITORIAL_V3_STYLE_INVALID')
  if(JSON.stringify(s.landscapeLayout)!==JSON.stringify(createLightLayoutV3(mode,supports,s.motionCue,'landscape',s.textPlacement)))
    throw new Error('EDITORIAL_V3_LANDSCAPE_LAYOUT_INVALID')
  if(s.connector&&(!['straight','curved-short','curved-wide','dashed'].includes(s.connector.variant)||
    !['static','draw'].includes(s.connector.state))) throw new Error('EDITORIAL_V3_CONNECTOR_INVALID')
}
