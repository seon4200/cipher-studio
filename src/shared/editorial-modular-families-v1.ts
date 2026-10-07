import type { IdeaAssemblyResource, IdeaSupportId } from './editorial-idea-assembly-v1'
import type { VisualLayoutV4, SlotLayoutV4 } from './visual-layout-v4'
import type { PercentRectV3 } from './visual-layout-v3'

/** Opt-in only. Neither the IDEA revisions nor Modular Catalog V1 dispatch here. */
export const EDITORIAL_MODULAR_FAMILIES_V1 = Object.freeze({
  id: 'editorial-modular-families-v1' as const,
  revision: 'editorial-modular-families-2026-09-v1' as const,
})
export const EDITORIAL_FAMILIES_V1 = [
  'marcoPoster', 'editorial', 'partidoVertical', 'cuaderno', 'constelacion', 'cascada',
] as const
export type EditorialFamilyIdV1 = typeof EDITORIAL_FAMILIES_V1[number]
export type EditorialLayoutVariantV1 = 'base' | 'inverse'
export type EditorialBackgroundV1 = 'ivory-clean' | 'ivory-subtle-grid' | 'white-soft-paper'
export type EditorialEntryV1 = 'text-first' | 'hero-first' | 'supports-first' | 'word-first'
export type EditorialSupportTreatmentV1 = 'naked-label' | 'paper-card' | 'ink-badge' | 'accent-tile'
export type EditorialRelationV1 = {
  from: 'hero' | IdeaSupportId
  to: 'hero' | IdeaSupportId
  meaning: 'informs' | 'causes' | 'transfers' | 'connects' | 'compares'
  start: number
  end: number
}
export type EditorialModularFamiliesPlanV1 = {
  revision: typeof EDITORIAL_MODULAR_FAMILIES_V1.revision
  catalogRevision: 'editorial-modular-catalog-2026-09-v1'
  family: EditorialFamilyIdV1
  layoutVariant: EditorialLayoutVariantV1
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
  hero?: { assetId: string; sha256: string; enter: number; settle: number }
  supports: { slotId: IdeaSupportId; assetId: string; sha256: string; label: string; enter: number; settle: number }[]
  layers: IdeaAssemblyResource[]
  relations: EditorialRelationV1[]
}

const rect = (x:number,y:number,width:number,height:number):PercentRectV3 => ({x,y,width,height})
const slot = (slotId:SlotLayoutV4['slotId'], envelope:PercentRectV3, zIndex:SlotLayoutV4['zIndex']):SlotLayoutV4 => ({
  slotId, placement:slotId==='hero'?'integrated':'center-dominant', envelope,zIndex,
  rotationDeg:0,opacity:1,backing:'none',crop:'none',
})

/** Six distinct, format-specific grammars. Missing slots never become placeholders. */
function createBaseEditorialModularFamilyLayoutV1(
  family:EditorialFamilyIdV1, orientation:'portrait'|'landscape', supportCount:number,
):VisualLayoutV4 {
  if (!EDITORIAL_FAMILIES_V1.includes(family) || !Number.isInteger(supportCount) || supportCount<0 || supportCount>4 ||
      (family==='editorial' ? supportCount!==0 :
        ['constelacion','cascada'].includes(family) && supportCount<2))
    throw new Error('EDITORIAL_FAMILY_LAYOUT_INPUT_INVALID')
  const portrait=orientation==='portrait'
  const supportIds:IdeaSupportId[]=['support-1','support-2','support-3','support-4']
  const make=(textBounds:PercentRectV3,hero:PercentRectV3|null,positions:PercentRectV3[],
    textRegion:VisualLayoutV4['textRegion'],relationStyle:VisualLayoutV4['relationStyle']):VisualLayoutV4 => ({
      version:2,family,textRegion,textBounds,textAlignment:'left',relationStyle,
      slotLayouts:[...(hero?[slot('hero',hero,4)]:[]),...positions.slice(0,supportCount)
        .map((position,index)=>slot(supportIds[index],position,5))],
    })
  if(family==='editorial') return make(portrait?rect(10,23,80,54):rect(14,22,72,58),null,[],
    'center-editorial','none')
  if(family==='marcoPoster') return portrait
    ?make(rect(9,7,82,23),rect(22,33,56,53),[rect(4,34,17,13),rect(79,34,17,13),rect(4,68,17,13),rect(79,68,17,13)],'top','frame')
    :make(rect(9,12,30,54),rect(41,10,43,81),[rect(5,70,15,17),rect(23,70,15,17),rect(82,14,15,18),rect(82,68,15,18)],'left','frame')
  if(family==='partidoVertical') return portrait
    ?make(rect(8,9,84,18),rect(7,31,55,54),[rect(66,31,26,13),rect(66,47,26,13),rect(66,63,26,13),rect(66,79,26,13)],'top','split-axis')
    :make(rect(9,14,34,67),rect(45,15,35,69),[rect(82,12,15,18),rect(82,33,15,18),rect(82,54,15,18),rect(82,75,15,18)],'left','split-axis')
  if(family==='cuaderno') return portrait
    ?make(rect(9,8,82,20),rect(24,29,53,51),[rect(5,35,18,15),rect(77,35,18,15),rect(5,68,18,15),rect(77,68,18,15)],'top','document')
    :make(rect(8,15,37,64),rect(47,13,40,71),[rect(4,7,17,15),rect(24,7,17,15),rect(5,78,17,15),rect(25,78,17,15)],'left','document')
  if(family==='constelacion') return portrait
    ?make(rect(10,7,80,19),rect(25,29,50,54),[rect(4,36,20,16),rect(76,36,20,16),rect(5,72,20,16),rect(75,72,20,16)],'top','constellation-links')
    :make(rect(9,12,32,62),rect(42,17,43,70),[rect(43,3,16,17),rect(84,32,15,17),rect(43,79,16,17),rect(84,75,15,17)],'left','constellation-links')
  return portrait
    ?make(rect(8,8,84,19),rect(5,30,48,32),[rect(55,34,29,17),rect(34,58,29,17),rect(56,76,29,17),rect(7,75,23,17)],'top','cascade-flow')
    :make(rect(9,11,31,58),rect(40,14,30,50),[rect(72,13,22,17),rect(69,36,22,17),rect(66,59,22,17),rect(63,80,22,15)],'left','cascade-flow')
}

/** Placement alternates without mirroring the pixels of a Hero or any text. */
export function createEditorialModularFamilyLayoutV1(
  family:EditorialFamilyIdV1, orientation:'portrait'|'landscape', supportCount:number,
  variant:EditorialLayoutVariantV1='base',
):VisualLayoutV4 {
  const base=createBaseEditorialModularFamilyLayoutV1(family,orientation,supportCount)
  if(variant==='base') return base
  if(variant!=='inverse') throw new Error('EDITORIAL_FAMILY_LAYOUT_VARIANT_INVALID')
  const mirror=(r:PercentRectV3):PercentRectV3=>({...r,x:100-r.x-r.width})
  return {...base,textBounds:mirror(base.textBounds),textAlignment:'right',
    slotLayouts:base.slotLayouts.map(item=>({...item,envelope:mirror(item.envelope)}))}
}

export function validateEditorialModularFamiliesPlanV1(value:unknown):EditorialModularFamiliesPlanV1 {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('EDITORIAL_FAMILY_PLAN_INVALID')
  const v=value as EditorialModularFamiliesPlanV1
  const shape=(item:unknown,required:string[],optional:string[]=[])=>
    !!item&&typeof item==='object'&&!Array.isArray(item)&&
    required.every(key=>Object.prototype.hasOwnProperty.call(item,key))&&
    Object.keys(item).every(key=>required.includes(key)||optional.includes(key))
  if(!shape(v,['revision','catalogRevision','family','layoutVariant','landscapeLayout','background','entry',
    'supportTreatment','camera','particles','ink','paper','accent','supportTint','supports','layers','relations'],['hero']) ||
    !shape(v.camera,['mode','dx','dy']) || !shape(v.particles,['mode','count','opacity']))
    throw new Error('EDITORIAL_FAMILY_PLAN_SHAPE_INVALID')
  if(v.revision!==EDITORIAL_MODULAR_FAMILIES_V1.revision || v.catalogRevision!=='editorial-modular-catalog-2026-09-v1' ||
      !EDITORIAL_FAMILIES_V1.includes(v.family) || !['base','inverse'].includes(v.layoutVariant) ||
      !['ivory-clean','ivory-subtle-grid','white-soft-paper'].includes(v.background) ||
      !['text-first','hero-first','supports-first','word-first'].includes(v.entry) ||
      !['naked-label','paper-card','ink-badge','accent-tile'].includes(v.supportTreatment) ||
      v.ink!=='#11110F' || !['#F0EEE8','#FAF9F6'].includes(v.paper) ||
      !/^#[0-9A-F]{6}$/.test(v.accent) || !/^#[0-9A-F]{6}$/.test(v.supportTint) ||
      !v.camera || !['fixed','quiet-drift'].includes(v.camera.mode) ||
      !Number.isFinite(v.camera.dx) || !Number.isFinite(v.camera.dy) ||
      Math.abs(v.camera.dx)>1 || Math.abs(v.camera.dy)>1 ||
      !v.particles || !['none','dust','ticks'].includes(v.particles.mode) ||
      !Number.isInteger(v.particles.count) || v.particles.count<0 || v.particles.count>8 ||
      !Number.isFinite(v.particles.opacity) || v.particles.opacity<0 || v.particles.opacity>.12 ||
      !Array.isArray(v.supports) || v.supports.length>(v.family==='editorial'?0:4) ||
      !Array.isArray(v.layers) || !Array.isArray(v.relations)) throw new Error('EDITORIAL_FAMILY_PLAN_INVALID')
  if(v.family==='editorial' ? !!v.hero || v.supports.length!==0 || v.layers.length!==0 :
      !v.hero || ['constelacion','cascada'].includes(v.family) && v.supports.length<2)
    throw new Error('EDITORIAL_FAMILY_ASSET_BUDGET_INVALID')
  const ids=new Set<string>(['hero'])
  for(const s of v.supports){
    if(!shape(s,['slotId','assetId','sha256','label','enter','settle']) ||
       !['support-1','support-2','support-3','support-4'].includes(s.slotId) || ids.has(s.slotId) ||
       typeof s.assetId!=='string' || !s.assetId || !/^[a-f0-9]{64}$/.test(s.sha256) ||
       typeof s.label!=='string' || !s.label.trim() ||
       !(s.enter>=0 && s.enter<s.settle && s.settle<.8)) throw new Error('EDITORIAL_FAMILY_SUPPORT_INVALID')
    ids.add(s.slotId)
  }
  const layerIds=new Set<string>()
  for(const layer of v.layers){
    if(!shape(layer,['id','sha256','mime','alphaMode','rect','zIndex','timing','from',
      'accentTreatment','colorCapability','catalogAssetId','catalogSha256']) ||
      !['idea-rear','idea-accent','idea-front'].includes(layer.id) || layerIds.has(layer.id) ||
      !/^[a-f0-9]{64}$/.test(layer.sha256) || layer.sha256!==layer.catalogSha256 ||
      typeof layer.catalogAssetId!=='string' || !layer.catalogAssetId || layer.mime!=='image/png' ||
      layer.alphaMode!=='useful-alpha' || !shape(layer.rect,['x','y','width','height']) ||
      ![layer.rect.x,layer.rect.y,layer.rect.width,layer.rect.height].every(Number.isFinite) ||
      layer.rect.x<0 || layer.rect.y<0 || layer.rect.width<=0 || layer.rect.height<=0 ||
      layer.rect.x+layer.rect.width>100 || layer.rect.y+layer.rect.height>100 ||
      layer.zIndex!==(layer.id==='idea-rear'?1:layer.id==='idea-accent'?2:5) ||
      !shape(layer.timing,['start','settle','exit']) ||
      !(layer.timing.start>=0&&layer.timing.start<layer.timing.settle&&layer.timing.settle<layer.timing.exit&&layer.timing.exit<=1) ||
      !shape(layer.from,['x','y','scale']) || ![layer.from.x,layer.from.y,layer.from.scale].every(Number.isFinite) ||
      layer.from.scale<=0 || layer.from.scale>1 ||
      (layer.id==='idea-accent'
        ?layer.colorCapability!=='accent-primary'||layer.accentTreatment!=='alpha-mask'
        :layer.colorCapability!=='none'||layer.accentTreatment!=='none'))
      throw new Error('EDITORIAL_FAMILY_LAYER_INVALID')
    layerIds.add(layer.id)
  }
  for(const r of v.relations){
    if(!shape(r,['from','to','meaning','start','end']) ||
      !ids.has(r.from) || !ids.has(r.to) || r.from===r.to ||
      !['informs','causes','transfers','connects','compares'].includes(r.meaning) ||
      !(r.start>=0 && r.start<r.end && r.end<.85)) throw new Error('EDITORIAL_FAMILY_RELATION_INVALID')
    const settle=(id:string)=>id==='hero'?v.hero?.settle??0:v.supports.find(s=>s.slotId===id)?.settle??0
    if(r.start<Math.max(settle(r.from),settle(r.to))+.02) throw new Error('EDITORIAL_FAMILY_RELATION_BEFORE_ENDPOINT')
  }
  if(v.hero && (!shape(v.hero,['assetId','sha256','enter','settle']) ||
    typeof v.hero.assetId!=='string' || !v.hero.assetId || !/^[a-f0-9]{64}$/.test(v.hero.sha256) ||
    !(v.hero.enter>=0 && v.hero.enter<v.hero.settle && v.hero.settle<.8))) throw new Error('EDITORIAL_FAMILY_HERO_INVALID')
  if(v.camera.mode==='fixed'&&(v.camera.dx!==0||v.camera.dy!==0))
    throw new Error('EDITORIAL_FAMILY_CAMERA_INVALID')
  if(v.particles.mode==='none' !== (v.particles.count===0 && v.particles.opacity===0))
    throw new Error('EDITORIAL_FAMILY_PARTICLES_INVALID')
  return v
}
