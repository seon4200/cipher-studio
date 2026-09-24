import { MODERN_LAYOUT_STRUCTURES_V4, type ModernLayoutStructureV4,
  type SceneSlotIdV2, type VisualLayoutV4, type SlotLayoutV4 } from './visual-layout-v4'
import type { PercentRectV3 } from './visual-layout-v3'
import type { SubjectBoundsV1 } from './visual-scene-spec'
import type { IdeaAssemblyResource } from './editorial-idea-assembly-v1'
import type { EditorialBackgroundV1, EditorialEntryV1,
  EditorialSupportTreatmentV1 } from './editorial-modular-families-v1'
import type { FinishFont, FinishIntensity, FinishRepresentation,
  FinishResponse, FinishRoute } from './editorial-finish-v1-1'
import { EDITORIAL_FINISH_FONT_SHA_V11,EDITORIAL_FINISH_BODY_FONT_SHA_V11,
  EDITORIAL_FINISH_LABEL_FONT_SHA_V11 } from './editorial-finish-v1-1'
import { MODULAR_CATALOG_REVISION_V1 } from './editorial-modular-catalog-v1'

/** A new opt-in pixel revision. Published V1/V1.1 plans and layouts are immutable. */
export const EDITORIAL_LOCAL_BANK_V2 = Object.freeze({
  id: 'editorial-local-bank-v2' as const,
  revision: 'editorial-local-bank-2026-09-v2' as const,
})
export const EDITORIAL_LOCAL_FAMILIES_V2 = MODERN_LAYOUT_STRUCTURES_V4
export const EDITORIAL_LOCAL_SUPPORT_IDS_V2 = [
  'support-1', 'support-2', 'support-3', 'support-4', 'support-5', 'support-6',
] as const
export type EditorialLocalSupportIdV2 = typeof EDITORIAL_LOCAL_SUPPORT_IDS_V2[number]
export type EditorialLocalVariantV2 = 'base' | 'inverse'
export type EditorialLocalRelationV2 = {
  from: 'hero' | EditorialLocalSupportIdV2
  to: 'hero' | EditorialLocalSupportIdV2
  meaning: 'informs' | 'causes' | 'transfers' | 'connects' | 'compares'
  representation: FinishRepresentation
  response: FinishResponse
  portrait: FinishRoute
  landscape: FinishRoute
  color: string
  start: number
  arrival: number
  end: number
}
export type EditorialLocalEventV2 = {
  id: string
  target: 'hero' | EditorialLocalSupportIdV2
  kind: 'hero-entry' | 'support-entry' | 'arrival'
  start: number
  duration: number
  seed: number
  color: string
  count: number
  size: number
  opacity: number
  intensity: FinishIntensity
}
export type EditorialLocalBankPlanV2 = {
  revision: typeof EDITORIAL_LOCAL_BANK_V2.revision
  catalogRevision: string
  family: ModernLayoutStructureV4
  layoutVariant: EditorialLocalVariantV2
  portraitLayout: VisualLayoutV4
  landscapeLayout: VisualLayoutV4
  background: EditorialBackgroundV1
  entry: EditorialEntryV1
  supportTreatment: EditorialSupportTreatmentV1
  camera: { mode: 'fixed' | 'quiet-drift'; dx: number; dy: number }
  particles: { mode: 'none' | 'dust' | 'ticks'; count: number; opacity: number }
  ink: '#11110F'
  paper: '#F0EEE8' | '#FAF9F6'
  accent: string
  supportTint: string
  typography: { display: FinishFont; weight: number; body: 'DM Sans'; label: 'IBM Plex Sans Condensed';
    displaySha256: string; bodySha256: string; labelSha256: string }
  colors: { headline: string; keyword: string; body: string; effects: string }
  localIntensity: FinishIntensity
  ambientIntensity: FinishIntensity
  events: EditorialLocalEventV2[]
  hero: { assetId: string; sha256: string; enter: number; settle: number }
  supports: { slotId: EditorialLocalSupportIdV2; assetId: string; sha256: string;
    label: string; enter: number; settle: number }[]
  layers: IdeaAssemblyResource[]
  relations: EditorialLocalRelationV2[]
  /** Three finite beats; actors persist between beats. All values are frame-normalized. */
  beats: { id: 'establish' | 'develop' | 'read'; start: number; end: number }[]
}

/** Approximate the visible raster subject after object-fit:contain and the
 * frozen Hero optical scale. Only V2 calls this; old frozen route geometry is
 * untouched. The alpha box is not treated as a facial/focal segmentation. */
export function editorialLocalHeroScaleV2(bounds:SubjectBoundsV1):number{
  return Math.min(1.85,Math.max(1,.9/bounds.visibleWidthRatio))
}
export function editorialLocalHeroVisibleRectV2(layout:VisualLayoutV4,bounds:SubjectBoundsV1,
  orientation:'portrait'|'landscape'):PercentRectV3{
  const envelope=layout.slotLayouts.find(item=>item.slotId==='hero')?.envelope
  if(!envelope)throw new Error('EDITORIAL_LOCAL_HERO_LAYOUT_MISSING')
  const canvasAspect=orientation==='portrait'?.5625:16/9
  const contentWidth=Math.min(envelope.width*canvasAspect*.9,envelope.height*.9*bounds.aspectRatio)
  const contentHeight=contentWidth/bounds.aspectRatio
  const cx=(envelope.x+envelope.width/2)*canvasAspect,cy=envelope.y+envelope.height/2
  const scale=editorialLocalHeroScaleV2(bounds),a=bounds.alphaBounds
  const left=cx+(-contentWidth/2+a.x*contentWidth)*scale
  const top=cy+(-contentHeight/2+a.y*contentHeight)*scale
  return {x:left/canvasAspect,y:top,width:a.width*contentWidth*scale/canvasAspect,
    height:a.height*contentHeight*scale}
}

type Rect = PercentRectV3
type Blueprint = { text: Rect; hero: Rect; supports: readonly Rect[];
  region: VisualLayoutV4['textRegion']; relation: VisualLayoutV4['relationStyle'] }
const r = (x:number,y:number,width:number,height:number):Rect => ({x,y,width,height})
const p=(text:Rect,hero:Rect,supports:readonly Rect[],
  region:Blueprint['region'],relation:Blueprint['relation']):Blueprint=>({text,hero,supports,region,relation})

// A grammar per family and orientation; layouts differ in balance, hierarchy and
// relationship geometry. The text/hero/supports are not scaled from one format.
const PORTRAIT:Record<ModernLayoutStructureV4,Blueprint>={
  editorial:p(r(9,7,82,30),r(21,39,58,45),[r(4,43,18,12),r(78,43,18,12),r(4,72,18,12),r(78,72,18,12),r(18,85,19,11),r(63,85,19,11)],'top','none'),
  marcoPoster:p(r(9,7,82,23),r(21,32,58,54),[r(3,34,18,13),r(79,34,18,13),r(3,68,18,13),r(79,68,18,13),r(23,85,18,11),r(59,85,18,11)],'top','frame'),
  partidoVertical:p(r(8,8,84,20),r(7,32,56,55),[r(66,31,27,12),r(66,44,27,12),r(66,57,27,12),r(66,70,27,12),r(4,87,20,10),r(30,87,20,10)],'top','split-axis'),
  cintaDiagonal:p(r(9,7,82,22),r(24,32,56,51),[r(3,35,22,12),r(72,28,23,12),r(5,63,22,12),r(70,70,23,12),r(17,84,21,12),r(60,84,21,12)],'top','diagonal-axis'),
  anillosConcentricos:p(r(10,7,80,22),r(25,34,50,50),[r(39,32,22,11),r(76,40,20,12),r(76,68,20,12),r(39,82,22,12),r(4,68,20,12),r(4,40,20,12)],'top','radial'),
  rayosImpacto:p(r(8,7,84,22),r(21,35,58,48),[r(3,37,20,12),r(77,37,20,12),r(3,65,20,12),r(77,65,20,12),r(17,83,20,12),r(63,83,20,12)],'top','impact'),
  cuaderno:p(r(8,7,84,22),r(23,32,56,52),[r(3,36,20,13),r(77,36,20,13),r(3,69,20,13),r(77,69,20,13),r(18,84,20,12),r(62,84,20,12)],'document-margin','document'),
  constelacion:p(r(8,7,84,21),r(26,34,49,51),[r(3,34,21,13),r(76,34,21,13),r(4,70,21,13),r(75,70,21,13),r(26,84,20,12),r(54,84,20,12)],'top','constellation-links'),
  capasApiladas:p(r(8,7,84,21),r(25,32,54,55),[r(3,42,21,12),r(76,42,21,12),r(3,67,21,12),r(76,67,21,12),r(23,85,21,12),r(56,85,21,12)],'top','layer-stack'),
  redNodos:p(r(8,7,84,21),r(29,36,42,47),[r(3,33,22,12),r(75,33,22,12),r(3,53,22,12),r(75,53,22,12),r(3,73,22,12),r(75,73,22,12)],'top','network-links'),
  lineaTiempo:p(r(8,7,84,21),r(25,31,51,43),[r(3,77,21,14),r(27,77,21,14),r(51,77,21,14),r(75,77,21,14),r(4,34,20,12),r(76,34,20,12)],'top','timeline'),
  corteTransversal:p(r(8,7,84,21),r(22,34,56,45),[r(3,37,19,12),r(78,37,19,12),r(3,59,19,12),r(78,59,19,12),r(28,81,19,12),r(53,81,19,12)],'top','cross-section'),
  abanicoTarjetas:p(r(8,7,84,22),r(23,32,54,47),[r(2,69,21,13),r(20,78,21,13),r(40,81,21,13),r(60,78,21,13),r(78,69,20,13),r(38,29,22,12)],'top','card-fan'),
  engranajes:p(r(8,7,84,21),r(25,33,50,53),[r(3,37,21,12),r(76,37,21,12),r(3,67,21,12),r(76,67,21,12),r(24,84,21,12),r(55,84,21,12)],'top','interlock'),
  cascada:p(r(8,7,84,21),r(6,32,49,38),[r(57,32,32,12),r(57,52,32,12),r(57,72,32,12),r(63,86,32,11),r(4,77,23,12),r(29,84,23,12)],'top','cascade-flow'),
  mundoIsometrico:p(r(8,7,84,21),r(22,31,56,52),[r(4,36,22,13),r(74,36,22,13),r(6,65,22,13),r(72,65,22,13),r(24,84,21,12),r(55,84,21,12)],'top','isometric-field'),
  pilaVertical:p(r(8,7,84,21),r(19,31,62,42),[r(11,75,24,12),r(38,75,24,12),r(65,75,24,12),r(12,87,23,11),r(39,87,23,11),r(66,87,23,11)],'top','vertical-hierarchy'),
}
const LANDSCAPE:Record<ModernLayoutStructureV4,Blueprint>={
  editorial:p(r(6,13,37,69),r(50,17,39,68),[r(44,3,16,16),r(68,3,16,16),r(83,30,15,17),r(83,72,15,17),r(44,79,16,16),r(24,79,16,16)],'left','none'),
  marcoPoster:p(r(7,13,32,57),r(41,11,45,76),[r(4,75,16,17),r(22,75,16,17),r(83,12,15,17),r(83,69,15,17),r(42,2,16,15),r(62,2,16,15)],'left','frame'),
  partidoVertical:p(r(7,14,36,66),r(45,15,36,69),[r(82,7,16,16),r(82,27,16,16),r(82,47,16,16),r(82,67,16,16),r(4,4,16,16),r(25,4,16,16)],'left','split-axis'),
  cintaDiagonal:p(r(7,11,36,46),r(42,18,41,68),[r(3,68,17,17),r(22,74,17,17),r(80,5,17,17),r(80,75,17,17),r(45,3,17,15),r(64,3,17,15)],'left','diagonal-axis'),
  anillosConcentricos:p(r(5,18,29,62),r(40,21,44,65),[r(38,3,16,17),r(57,3,16,17),r(82,22,16,17),r(82,61,16,17),r(40,79,16,17),r(65,79,16,17)],'left','radial'),
  rayosImpacto:p(r(6,14,33,54),r(43,17,41,71),[r(41,3,17,15),r(62,3,17,15),r(82,17,16,17),r(82,68,16,17),r(41,81,17,16),r(62,81,17,16)],'left','impact'),
  cuaderno:p(r(6,16,37,60),r(45,14,42,72),[r(81,4,16,16),r(81,78,16,16),r(4,2,16,13),r(4,81,16,13),r(24,2,16,13),r(24,81,16,13)],'document-margin','document'),
  constelacion:p(r(6,14,32,57),r(42,19,43,66),[r(41,2,17,17),r(62,2,17,17),r(81,25,17,17),r(81,65,17,17),r(41,80,17,17),r(62,80,17,17)],'left','constellation-links'),
  capasApiladas:p(r(7,13,33,57),r(43,16,44,69),[r(40,3,17,16),r(61,3,17,16),r(82,27,16,17),r(82,65,16,17),r(40,80,17,16),r(61,80,17,16)],'left','layer-stack'),
  redNodos:p(r(5,17,29,59),r(43,24,39,56),[r(34,3,17,17),r(57,3,17,17),r(82,19,16,17),r(82,61,16,17),r(35,80,17,17),r(59,80,17,17)],'left','network-links'),
  lineaTiempo:p(r(5,15,31,55),r(40,12,44,57),[r(5,77,16,17),r(24,77,16,17),r(43,77,16,17),r(62,77,16,17),r(81,77,16,17),r(82,6,16,17)],'left','timeline'),
  corteTransversal:p(r(6,12,34,61),r(43,16,41,68),[r(3,78,16,16),r(21,78,16,16),r(82,16,16,17),r(82,62,16,17),r(43,2,16,16),r(63,2,16,16)],'left','cross-section'),
  abanicoTarjetas:p(r(5,12,34,56),r(43,13,41,62),[r(5,76,16,17),r(23,78,16,17),r(42,79,16,17),r(61,79,16,17),r(80,76,16,17),r(83,4,15,16)],'left','card-fan'),
  engranajes:p(r(6,16,33,56),r(42,18,42,66),[r(40,3,17,16),r(61,3,17,16),r(82,18,16,17),r(82,64,16,17),r(40,80,17,16),r(61,80,17,16)],'left','interlock'),
  cascada:p(r(6,13,31,53),r(39,12,36,55),[r(78,7,19,15),r(73,27,19,15),r(68,47,19,15),r(63,67,19,15),r(9,77,17,16),r(29,77,17,16)],'left','cascade-flow'),
  mundoIsometrico:p(r(6,13,32,56),r(41,16,46,70),[r(39,3,17,16),r(62,3,17,16),r(82,24,16,17),r(82,65,16,17),r(40,80,17,16),r(62,80,17,16)],'left','isometric-field'),
  pilaVertical:p(r(6,13,34,52),r(43,15,41,57),[r(4,76,17,16),r(22,76,17,16),r(40,77,17,16),r(58,77,17,16),r(77,77,17,16),r(82,4,16,16)],'left','vertical-hierarchy'),
}

/** Six semantic slots maximum; each family has independent portrait/landscape geometry. */
export function createEditorialLocalBankLayoutV2(family:ModernLayoutStructureV4,
  orientation:'portrait'|'landscape',supportCount:number,variant:EditorialLocalVariantV2='base'):VisualLayoutV4 {
  if(!EDITORIAL_LOCAL_FAMILIES_V2.includes(family)||!Number.isInteger(supportCount)||
      supportCount<2||supportCount>6||!['base','inverse'].includes(variant))
    throw new Error('EDITORIAL_LOCAL_BANK_LAYOUT_INPUT_INVALID')
  const b=(orientation==='portrait'?PORTRAIT:LANDSCAPE)[family]
  if(!b||b.supports.length<supportCount)throw new Error('EDITORIAL_LOCAL_BANK_BLUEPRINT_MISSING')
  const mirror=(x:Rect):Rect=>variant==='inverse'?{...x,x:100-x.x-x.width}:x
  const safeText:Rect={x:Math.max(7,b.text.x),y:Math.max(9,b.text.y),
    width:Math.min(b.text.width,93-Math.max(7,b.text.x)),
    height:Math.min(b.text.height,91-Math.max(9,b.text.y))}
  const slot=(slotId:SceneSlotIdV2,envelope:Rect,zIndex:SlotLayoutV4['zIndex']):SlotLayoutV4=>({
    slotId,placement:slotId==='hero'?'integrated':'center-dominant',envelope:mirror(slotId==='hero'||
      envelope.width*envelope.height>=225?envelope:{...envelope,
        y:envelope.y-(225/envelope.width-envelope.height)/2,height:225/envelope.width}),zIndex,
    rotationDeg:0,opacity:1,backing:'none',crop:'none',
  })
  return {version:2,family,textRegion:b.region,textBounds:mirror(safeText),
    textAlignment:variant==='inverse'?'right':'left',relationStyle:b.relation,
    slotLayouts:[slot('hero',b.hero,4),...b.supports.slice(0,supportCount).map((box,index)=>
      slot(EDITORIAL_LOCAL_SUPPORT_IDS_V2[index],box,5))]}
}

const color=(v:unknown)=>typeof v==='string'&&/^#[0-9A-F]{6}$/.test(v)
const sha=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const unit=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1
const keys=(v:unknown,expected:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&
  Object.keys(v).sort().join('|')===expected.slice().sort().join('|')
const routeValid=(route:FinishRoute)=>keys(route,['geometry','points'])&&
  ['straight','curve','elbow'].includes(route.geometry)&&Array.isArray(route.points)&&
  route.points.length>=2&&route.points.length<=128&&route.points.every(point=>
    keys(point,['x','y'])&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&
    point.x>=0&&point.x<=100&&point.y>=0&&point.y<=100)
export function validateEditorialLocalBankPlanV2(value:unknown):EditorialLocalBankPlanV2 {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('EDITORIAL_LOCAL_BANK_PLAN_INVALID')
  const p=value as EditorialLocalBankPlanV2
  if(!keys(p,['revision','catalogRevision','family','layoutVariant','portraitLayout','landscapeLayout',
      'background','entry','supportTreatment','camera','particles','ink','paper','accent','supportTint',
      'typography','colors','localIntensity','ambientIntensity','events','hero','supports','layers',
      'relations','beats'])||p.revision!==EDITORIAL_LOCAL_BANK_V2.revision||
    p.catalogRevision!==MODULAR_CATALOG_REVISION_V1||!EDITORIAL_LOCAL_FAMILIES_V2.includes(p.family)||
    !['base','inverse'].includes(p.layoutVariant)||!p.hero||!sha(p.hero.sha256)||
    !Array.isArray(p.supports)||p.supports.length<2||p.supports.length>6||
    !Array.isArray(p.layers)||p.layers.length!==3||!Array.isArray(p.relations)||
    !Array.isArray(p.events)||!Array.isArray(p.beats)||p.beats.length!==3||
    !color(p.accent)||!color(p.supportTint)||p.ink!=='#11110F'||
    !['#F0EEE8','#FAF9F6'].includes(p.paper)||
    !['ivory-clean','ivory-subtle-grid','white-soft-paper'].includes(p.background)||
    !['text-first','hero-first','supports-first','word-first'].includes(p.entry)||
    !['naked-label','paper-card','ink-badge','accent-tile'].includes(p.supportTreatment)||
    !keys(p.camera,['mode','dx','dy'])||!['fixed','quiet-drift'].includes(p.camera.mode)||
    !Number.isFinite(p.camera.dx)||Math.abs(p.camera.dx)>1||
    !Number.isFinite(p.camera.dy)||Math.abs(p.camera.dy)>1||
    !keys(p.particles,['mode','count','opacity'])||!['none','dust','ticks'].includes(p.particles.mode)||
    !Number.isInteger(p.particles.count)||p.particles.count<0||p.particles.count>12||
    !unit(p.particles.opacity)||
    !keys(p.typography,['display','weight','body','label','displaySha256','bodySha256','labelSha256'])||
    !(p.typography.display in EDITORIAL_FINISH_FONT_SHA_V11)||
    p.typography.displaySha256!==EDITORIAL_FINISH_FONT_SHA_V11[p.typography.display]||
    p.typography.body!=='DM Sans'||p.typography.label!=='IBM Plex Sans Condensed'||
    p.typography.bodySha256!==EDITORIAL_FINISH_BODY_FONT_SHA_V11||
    p.typography.labelSha256!==EDITORIAL_FINISH_LABEL_FONT_SHA_V11||
    !keys(p.colors,['headline','keyword','body','effects'])||!color(p.colors.headline)||!color(p.colors.keyword)||
    !color(p.colors.body)||!color(p.colors.effects)||
    !['off','discreto','enfasis'].includes(p.localIntensity)||
    !['off','discreto','enfasis'].includes(p.ambientIntensity)||
    JSON.stringify(p.portraitLayout)!==JSON.stringify(createEditorialLocalBankLayoutV2(p.family,'portrait',p.supports.length,p.layoutVariant))||
    JSON.stringify(p.landscapeLayout)!==JSON.stringify(createEditorialLocalBankLayoutV2(p.family,'landscape',p.supports.length,p.layoutVariant)))
    throw new Error('EDITORIAL_LOCAL_BANK_PLAN_INVALID')
  const ids=new Set<string>()
  for(const s of p.supports){
    if(!keys(s,['slotId','assetId','sha256','label','enter','settle'])||
      !EDITORIAL_LOCAL_SUPPORT_IDS_V2.includes(s.slotId)||ids.has(s.slotId)||!sha(s.sha256)||
      !s.assetId||!s.label||!unit(s.enter)||!unit(s.settle)||s.enter>=s.settle)
      throw new Error('EDITORIAL_LOCAL_BANK_SUPPORT_INVALID')
    ids.add(s.slotId)
  }
  if(!keys(p.hero,['assetId','sha256','enter','settle'])||
    !unit(p.hero.enter)||!unit(p.hero.settle)||p.hero.enter>=p.hero.settle)
    throw new Error('EDITORIAL_LOCAL_BANK_HERO_INVALID')
  const expected=new Set(['idea-rear','idea-accent','idea-front'])
  for(const layer of p.layers){
    if(!keys(layer,['id','sha256','mime','alphaMode','rect','zIndex','timing','from',
      'catalogAssetId','catalogSha256','colorCapability','accentTreatment'])||
      !expected.delete(layer.id)||!sha(layer.sha256)||layer.sha256!==layer.catalogSha256||
      !layer.catalogAssetId||layer.mime!=='image/png'||layer.alphaMode!=='useful-alpha'||
      (layer.id==='idea-accent'?layer.colorCapability!=='accent-primary'||layer.accentTreatment!=='alpha-mask':
        layer.colorCapability!=='none'||layer.accentTreatment!=='none'))
      throw new Error('EDITORIAL_LOCAL_BANK_LAYER_INVALID')
  }
  if(expected.size)throw new Error('EDITORIAL_LOCAL_BANK_LAYER_MISSING')
  for(const b of p.beats)if(!keys(b,['id','start','end'])||
    !['establish','develop','read'].includes(b.id)||!unit(b.start)||!unit(b.end)||b.start>=b.end)
    throw new Error('EDITORIAL_LOCAL_BANK_BEAT_INVALID')
  if(p.beats[0].id!=='establish'||p.beats[1].id!=='develop'||p.beats[2].id!=='read'||
    p.beats[0].end>p.beats[1].start||p.beats[1].end>p.beats[2].start)
    throw new Error('EDITORIAL_LOCAL_BANK_BEAT_ORDER_INVALID')
  for(const e of p.relations)if(!keys(e,['from','to','meaning','representation','response','portrait',
    'landscape','color','start','arrival','end'])||
    !['hero',...ids].includes(e.from)||!['hero',...ids].includes(e.to)||
    e.from===e.to||!unit(e.start)||!unit(e.arrival)||!unit(e.end)||
    !(e.start<e.arrival&&e.arrival<e.end)||!color(e.color)||
    !['informs','causes','transfers','connects','compares'].includes(e.meaning)||
    !['arrow','dotted','dot-flow','light-pulse','accent-link'].includes(e.representation)||
    !['none','accent','halo','pulse','scale'].includes(e.response)||
    !routeValid(e.portrait)||!routeValid(e.landscape))
    throw new Error('EDITORIAL_LOCAL_BANK_RELATION_INVALID')
  for(const e of p.events)if(!keys(e,['id','target','kind','start','duration','seed','color','count',
    'size','opacity','intensity'])||!['hero',...ids].includes(e.target)||!unit(e.start)||!unit(e.duration)||
    e.start+e.duration>1||!color(e.color)||!Number.isInteger(e.count)||e.count<0||e.count>10||
    !Number.isFinite(e.size)||e.size<0||e.size>2||!unit(e.opacity))
    throw new Error('EDITORIAL_LOCAL_BANK_EVENT_INVALID')
  return p
}
