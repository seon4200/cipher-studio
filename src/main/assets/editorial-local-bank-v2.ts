import { EDITORIAL_LOCAL_BANK_V2, EDITORIAL_LOCAL_FAMILIES_V2,
  EDITORIAL_LOCAL_SUPPORT_IDS_V2, createEditorialLocalBankLayoutV2,
  editorialLocalHeroVisibleRectV2, editorialLocalHeroScaleV2,
  type EditorialLocalBankPlanV2, type EditorialLocalRelationV2,
  type EditorialLocalVariantV2 } from '../../shared/editorial-local-bank-v2'
import { MODULAR_CATALOG_REVISION_V1,
  resolveModularTitleAccentV1 } from '../../shared/editorial-modular-catalog-v1'
import { EDITORIAL_LOCAL_BANK_V3, EDITORIAL_LOCAL_BANK_V3_HISTORICAL, EDITORIAL_LOCAL_BANK_V3_2, EDITORIAL_LOCAL_CATALOG_REVISION_V3,
  EDITORIAL_LOCAL_FAMILIES_V3, type EditorialLocalBankPlanV3 } from '../../shared/editorial-local-bank-v3'
import { EDITORIAL_LOCAL_BANK_V4, type EditorialLocalBankPlanV4 } from '../../shared/editorial-local-bank-v4'
import { EDITORIAL_FINISH_INTEGRATION_V2, editorialArrivalEventsV2,
  editorialFinishRecipeV2 } from '../../shared/editorial-finish-integration-v2'
import { EDITORIAL_RELATION_MEANING, validateEditorialDirectionCurrent,
  type EditorialDirectionCurrent } from '../../shared/editorial-scene-direction'
import { EDITORIAL_FINISH_FONT_SHA_V11, EDITORIAL_FINISH_BODY_FONT_SHA_V11,
  EDITORIAL_FINISH_LABEL_FONT_SHA_V11, routeEditorialFinishV11,
  type FinishFont } from '../../shared/editorial-finish-v1-1'
import { sceneSpecPixelIdentityAny, validateVisualSceneSpecV2,
  validateRenderBindingsAny, createRoleMotionV2,
  type VisualSceneSpecV2, type SceneSlotV2, type RenderBindingsV2 } from '../../shared/visual-scene-spec-v2'
import { subjectBoundsFromPixabayRasterV1 } from './pixabay-images'
import { CuratedModularCatalogV1, type ImportedModularAssetV1 } from './editorial-modular-catalog-v1'
import type { ModularCatalogProviderV2 } from './editorial-modular-catalog-v2'
import { CuratedModularCatalogV2 } from './editorial-modular-catalog-v2'
import type { LocalSceneSemanticV1 } from '../../shared/local-scene-semantic'
import type { ModernLayoutStructureV4 } from '../../shared/visual-layout-v4'
import { editorialHeadlineFromLocalTextV1, editorialTextWithoutEmptyClosingV4 } from './editorial-modular-families-v1'
import { canonicalNarrativeTerm } from '../../shared/asset-intent'
import { nativeImage } from 'electron'

/** V4-only: route to the actual outer alpha silhouette after the renderer's
 * contain + optical-scale transform. The historical rectangular endpoints stay
 * untouched. A decoded subject is mandatory; a guessed fallback would leave
 * a connector floating again. */
function editorialHeroAlphaTargetV4(bytes:Buffer,layout:ReturnType<typeof createEditorialLocalBankLayoutV2>,
  orientation:'portrait'|'landscape',supportId:string,bounds:ReturnType<typeof subjectBoundsFromPixabayRasterV1>){
  const envelope=layout.slotLayouts.find(item=>item.slotId==='hero')?.envelope
  const support=layout.slotLayouts.find(item=>item.slotId===supportId)?.envelope
  if(!envelope||!support)throw new Error('V4_HERO_ALPHA_LAYOUT_MISSING')
  const image=nativeImage.createFromBuffer(bytes),{width,height}=image.getSize()
  const bitmap=image.toBitmap()
  if(width<16||height<16||bitmap.length<width*height*4)throw new Error('V4_HERO_ALPHA_INVALID')
  const canvasAspect=orientation==='portrait'?.5625:16/9
  const contentWidth=Math.min(envelope.width*canvasAspect*.9,envelope.height*.9*bounds.aspectRatio)
  const contentHeight=contentWidth/bounds.aspectRatio
  const scale=editorialLocalHeroScaleV2(bounds)
  const cx=envelope.x+envelope.width/2,cy=envelope.y+envelope.height/2
  const supportX=(support.x+support.width/2)*canvasAspect
  const supportY=support.y+support.height*.43
  const text=layout.textBounds
  let best:{x:number;y:number;score:number}|undefined
  const consider=(px:number,py:number)=>{
    if(bitmap[(py*width+px)*4+3]<128)return
    const x=cx+((px+.5)/width-.5)*contentWidth*scale/canvasAspect
    const y=cy+((py+.5)/height-.5)*contentHeight*scale
    if(x<3||x>97||y<3||y>97||
      x>=text.x-1&&x<=text.x+text.width+1&&y>=text.y-1&&y<=text.y+text.height+1)return
    const score=((x*canvasAspect-supportX)**2+(y-supportY)**2)
    if(!best||score<best.score)best={x,y,score}
  }
  // First/last opaque sample on each row and column are external contours,
  // not edges of transparent holes inside a machine or face.
  for(let py=0;py<height;py+=4){
    for(let px=0;px<width;px+=2)if(bitmap[(py*width+px)*4+3]>=128){consider(px,py);break}
    for(let px=width-1;px>=0;px-=2)if(bitmap[(py*width+px)*4+3]>=128){consider(px,py);break}
  }
  for(let px=0;px<width;px+=4){
    for(let py=0;py<height;py+=2)if(bitmap[(py*width+px)*4+3]>=128){consider(px,py);break}
    for(let py=height-1;py>=0;py-=2)if(bitmap[(py*width+px)*4+3]>=128){consider(px,py);break}
  }
  if(!best)throw new Error('V4_HERO_ALPHA_TARGET_UNAVAILABLE')
  return {x:best.x,y:best.y,width:.01,height:.01}
}

const normalized=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim()
const intentRules:readonly {family:ModernLayoutStructureV4;test:RegExp}[]=[
  {family:'lineaTiempo',test:/cronolog|linea de tiempo|antes y despues|año|siglo|decada/},
  {family:'partidoVertical',test:/compar|contraste|frente a|versus|diferencia/},
  {family:'redNodos',test:/red de|nodos|sistema conectado|interconex/},
  {family:'cascada',test:/secuencia|paso a paso|primero.*despues|flujo/},
  {family:'pilaVertical',test:/niveles|jerarquia|pila|estratos/},
  {family:'anillosConcentricos',test:/ciclo|capas concentricas|alrededor|anillos/},
  {family:'rayosImpacto',test:/impacto|irradi|expande|alcance/},
  {family:'corteTransversal',test:/interior|seccion|descompone|por dentro/},
  {family:'abanicoTarjetas',test:/opciones|alternativas|tarjetas|elecciones/},
  {family:'engranajes',test:/coordina|mecanismo|colabora|sincroniza/},
  {family:'mundoIsometrico',test:/espacio|entorno|ciudad|arquitectura/},
  {family:'capasApiladas',test:/capas|superpone|profundidad|ensambla/},
  {family:'cintaDiagonal',test:/avance|trayectoria|ascenso|diagonal/},
  {family:'constelacion',test:/constelacion|ideas relacionadas|varios puntos/},
  {family:'cuaderno',test:/document|archivo|historia|escritura|lectura/},
  {family:'marcoPoster',test:/anuncio|cartel|presenta|retrato/},
  {family:'editorial',test:/idea|concepto|reflexion|descubri/},
]
export type EditorialLocalSelectionV2={
  family:ModernLayoutStructureV4; variant:EditorialLocalVariantV2
  heroId:string;supportIds:string[];rearId?:string;accentId?:string;frontId?:string
  backgroundId?:string
  reason:string;missingTerms:string[]
}
export type EditorialLocalSelectionTraceV2 = {
  terms: string[]
  literalTerms?: string[]
  heroSelectionMechanism?: 'semantic-anchor' | 'semantic-concept' | 'literal-recovery' | 'contextual-candidates'
  heroCandidates: { term: string; assetId: string; match: string }[]
  supportCandidates: { term: string; assetId: string; match: string }[]
  missingTerms: string[]
  layerDecisions?: { role: 'rear-collage' | 'accent-mask' | 'front-collage' | 'background'; assetId?: string; reason: string }[]
  outcome: 'SELECTED' | 'NO_HERO' | 'INSUFFICIENT_SUPPORTS' | 'NO_COMPATIBLE_ACCENT'
}
/** Content-first selector. A scene without two genuinely matched Supports is not
 * promoted to an illustrated V2 scene. No quotas or fake semantic matches. */
export function selectEditorialLocalBankV2Detailed(input:{catalog:ModularCatalogProviderV2;
  semantic:LocalSceneSemanticV1;recentFamilies?:readonly ModernLayoutStructureV4[];
  allowedFamilies?:readonly ModernLayoutStructureV4[];maxSupports?:number;minimumSupports?:number}):{
    selection: EditorialLocalSelectionV2 | null; trace: EditorialLocalSelectionTraceV2 }{
  const text=normalized(input.semantic.localText)
  // `conceptos` is supplied for this very subclip by the existing planner.
  // An absent scope is not evidence of a different scene; explicit context is.
  const terms=[input.semantic.anchor,...input.semantic.concepts.filter(item=>
    item.scope!=='context' && (item.start===undefined || item.end===undefined ||
      item.end>=input.semantic.start && item.start<=input.semantic.end)).map(item=>item.label)]
    .filter((term):term is string=>typeof term==='string'&&!!term.trim())
    .filter((term,index,all)=>all.findIndex(other=>canonicalNarrativeTerm(other)===canonicalNarrativeTerm(term))===index)
  const heroCandidates=terms.flatMap(term=>input.catalog.searchEditorialLocalV2(term,'hero-core')
    .map(found=>({term,assetId:found.asset.assetId,match:found.match,asset:found.asset})))
  const supportCandidates=terms.flatMap(term=>input.catalog.searchEditorialLocalV2(term,'support')
    .map(found=>({term,assetId:found.asset.assetId,match:found.match,asset:found.asset})))
  const missingTerms=terms.filter(term=>!heroCandidates.some(item=>item.term===term)&&
    !supportCandidates.some(item=>item.term===term))
  const hero=heroCandidates[0]?.asset
  const supports=supportCandidates.map(item=>item.asset)
    .filter((item,index,all)=>item.primaryWordEs.toLocaleLowerCase('es')!==hero?.primaryWordEs.toLocaleLowerCase('es')&&
    all.findIndex(candidate=>candidate.assetId===item.assetId)===index).slice(0,input.maxSupports??6)
  const traceBase={terms,heroCandidates:heroCandidates.map(({term,assetId,match})=>({term,assetId,match})),
    supportCandidates:supportCandidates.map(({term,assetId,match})=>({term,assetId,match})),missingTerms}
  if(!hero)return {selection:null,trace:{...traceBase,outcome:'NO_HERO'}}
  if(supports.length<(input.minimumSupports??2))return {selection:null,trace:{...traceBase,outcome:'INSUFFICIENT_SUPPORTS'}}
  const relation=normalized(input.semantic.relation??'')
  const allowed=new Set(input.allowedFamilies??EDITORIAL_LOCAL_FAMILIES_V2)
  const eligible=intentRules.filter(rule=>allowed.has(rule.family)&&rule.test.test(`${relation} ${text}`))
  const recent=new Set(input.recentFamilies?.slice(-3)??[])
  const fallback=allowed.has('editorial')?'editorial':allowed.values().next().value as ModernLayoutStructureV4|undefined
  const family=(eligible.find(item=>!recent.has(item.family))??eligible[0])?.family??
    (input.allowedFamilies ? fallback&&(recent.has(fallback)?[...allowed].find(item=>!recent.has(item))??fallback:fallback) :
      (recent.has('editorial')?'marcoPoster':'editorial'))
  if(!family)return {selection:null,trace:{...traceBase,outcome:'NO_HERO'}}
  if(!EDITORIAL_LOCAL_FAMILIES_V2.includes(family))throw new Error('EDITORIAL_LOCAL_FAMILY_UNKNOWN')
  const aspect=input.catalog.aspectClass(hero.assetId)
  const layerCode=aspect==='wide'?'002':aspect==='compact'?'003':'001'
  const accentCode=aspect==='wide'?'037':aspect==='compact'?'038':'036'
  const frontCode=aspect==='wide'?'022':aspect==='compact'?'023':'021'
  // Shape-class recipes are a conservative technical pairing, not an
  // assertion that every Hero-layer combination is individually art-approved.
  const byCode=(code:string,role:Parameters<CuratedModularCatalogV1['search']>[1])=>{
    const selected=input.catalog.entries().find(asset=>asset.code.toUpperCase()===`L${code}`&&asset.role===role)
    if(!selected||!input.catalog.getById(selected.assetId))throw new Error('EDITORIAL_LOCAL_LAYER_RECIPE_MISSING:'+code)
    return selected.assetId
  }
  return {selection:{family,variant:aspect==='wide'?'inverse':'base',heroId:hero.assetId,
    supportIds:supports.map(item=>item.assetId),rearId:byCode(layerCode,'rear-collage'),
    accentId:byCode(accentCode,'accent-mask'),frontId:byCode(frontCode,'front-collage'),
    reason:eligible.length?'CONTENT_RELATION':'EDITORIAL_DEFAULT',missingTerms},
    trace:{...traceBase,outcome:'SELECTED'}}
}

export function selectEditorialLocalBankV2(input:Parameters<typeof selectEditorialLocalBankV2Detailed>[0]):EditorialLocalSelectionV2|null{
  return selectEditorialLocalBankV2Detailed(input).selection
}

/** V3 explicitly ranks exact/curated-alias matches above morphology and prioritizes
 * anchor/direct evidence. The frozen V2 call path keeps its historical ordering. */
export function selectEditorialLocalBankV3Detailed(input:{catalog:ModularCatalogProviderV2;
  semantic:LocalSceneSemanticV1;recentFamilies?:readonly ModernLayoutStructureV4[];
  selectionRevision?:typeof EDITORIAL_LOCAL_BANK_V3_2.revision;
  allowedFamilies?:readonly ModernLayoutStructureV4[];minimumSupports?:number}):{
    selection:EditorialLocalSelectionV2|null;trace:EditorialLocalSelectionTraceV2}{
  const semantic=input.semantic
  const concepts=semantic.concepts.filter(item=>item.scope!=='context'&&
    (item.start===undefined||item.end===undefined||item.end>=semantic.start&&item.start<=semantic.end))
  const rank=(term:string,role:'hero-core'|'support')=>input.catalog.searchEditorialLocalV2(term,role)
    .map(found=>({term,assetId:found.asset.assetId,match:found.match,asset:found.asset,
      termWeight:term===semantic.anchor?4:semantic.directEvidence.some(evidence=>
        normalized(evidence.query)===normalized(term)&&evidence.relevance==='anchor')?4:
        semantic.directEvidence.some(evidence=>normalized(evidence.query)===normalized(term)&&evidence.relevance==='keyword')?3:2,
      matchWeight:found.match==='primary'?3:found.match==='alias'?2:1}))
  const terms=[semantic.anchor,...concepts.map(item=>item.label)]
    .filter((term):term is string=>typeof term==='string'&&!!term.trim())
    .filter((term,index,all)=>all.findIndex(item=>canonicalNarrativeTerm(item)===canonicalNarrativeTerm(term))===index)
  const heroes=terms.flatMap(term=>rank(term,'hero-core')).sort((a,b)=>
    b.termWeight-a.termWeight||b.matchWeight-a.matchWeight||a.asset.assetId.localeCompare(b.asset.assetId))
  const hero=heroes[0]?.asset
  const supports=terms.flatMap(term=>rank(term,'support')).sort((a,b)=>
    b.termWeight-a.termWeight||b.matchWeight-a.matchWeight||a.asset.assetId.localeCompare(b.asset.assetId))
    .map(item=>item.asset).filter((asset,index,all)=>asset.assetId!==hero?.assetId&&
      normalized(asset.primaryWordEs)!==normalized(hero?.primaryWordEs??'')&&
      all.findIndex(other=>other.assetId===asset.assetId)===index).slice(0,4)
  // Reuse the V2 family/geometry resolver, but give it a ranked, bounded set of
  // direct scene terms and restrict it to the six connected V3 families.
  const selected=selectEditorialLocalBankV2Detailed({catalog:input.catalog,semantic,
    recentFamilies:input.recentFamilies,allowedFamilies:input.allowedFamilies??EDITORIAL_LOCAL_FAMILIES_V3,
    maxSupports:4,minimumSupports:input.minimumSupports??2})
  const trace={...selected.trace,terms,heroCandidates:heroes.map(item=>({term:item.term,assetId:item.asset.assetId,match:item.match})),
    supportCandidates:terms.flatMap(term=>rank(term,'support')).map(item=>({term:item.term,assetId:item.asset.assetId,match:item.match}))}
  if(!hero)return {selection:null,trace:{...trace,outcome:'NO_HERO'}}
  if(supports.length<(input.minimumSupports??2))return {selection:null,trace:{...trace,outcome:'INSUFFICIENT_SUPPORTS'}}
  if(!selected.selection)return {selection:null,trace:selected.trace}
  const aspect=input.catalog.aspectClass(hero.assetId)
  // A full-frame raster is selected only on direct primary/alias evidence.
  const backgroundTerms=[...terms,...semantic.concepts.filter(item=>item.scope==='context').map(item=>item.label)]
    .filter((term,index,all)=>all.findIndex(item=>canonicalNarrativeTerm(item)===canonicalNarrativeTerm(term))===index)
  const background=backgroundTerms.flatMap(term=>input.catalog.searchEditorialLocalV2(term,'background')
    .filter(found=>found.match==='primary'||found.match==='alias').map(found=>found.asset))
    .find((asset,index,all)=>all.findIndex(item=>item.assetId===asset.assetId)===index)
  const continuousSurface=(role:'rear-collage'|'accent-mask',preferred:'vertical'|'wide'|'compact',matchedRear?:string)=>{
    const candidates=input.catalog.entries().filter(entry=>entry.role===role&&
      (entry as typeof entry&{surfaceProfile?:string}).surfaceProfile==='continuous-filled-v1'&&
      (role!=='accent-mask'||(entry as typeof entry&{surfaceUse?:string}).surfaceUse==='hero-backing-accent-v1')&&
      input.catalog.getById(entry.assetId)).sort((a,b)=>a.assetId.localeCompare(b.assetId))
    let selected:typeof candidates[number]|undefined
    if(role==='rear-collage'){
      const candidateIds=new Set(candidates.map(entry=>entry.assetId))
      const matchRank={primary:0,alias:1,inflection:2} as const
      const semanticMatches=terms.flatMap((term,termIndex)=>input.catalog.searchEditorialLocalV2(term,'rear-collage')
        .filter(found=>candidateIds.has(found.asset.assetId))
        .map(found=>({entry:found.asset,termIndex,matchRank:matchRank[found.match as keyof typeof matchRank]??3})))
        .sort((a,b)=>a.termIndex-b.termIndex||a.matchRank-b.matchRank||
          Number(input.catalog.aspectClass(a.entry.assetId)!==preferred)-Number(input.catalog.aspectClass(b.entry.assetId)!==preferred)||
          a.entry.assetId.localeCompare(b.entry.assetId))
      selected=semanticMatches[0]?.entry
    }
    if(role==='accent-mask'&&input.selectionRevision===EDITORIAL_LOCAL_BANK_V3_2.revision){
      const related=[{asset:background,weight:4},{asset:hero,weight:3},
        {asset:matchedRear?input.catalog.getById(matchedRear):undefined,weight:2},
        ...supports.map(asset=>({asset,weight:1}))]
      const relations=(asset:typeof candidates[number]|undefined):Set<string>=>
        new Set(((asset as typeof asset&{compatibleRelations?:string[]}|undefined)?.compatibleRelations??[]).map(normalized))
      const directTerms=[...terms,...semantic.concepts.filter(item=>item.scope==='context').map(item=>item.label)]
      const directIds=new Set(directTerms.flatMap(term=>input.catalog.searchEditorialLocalV2(term,'accent-mask')
        .map(found=>found.asset.assetId)))
      const score=(asset:typeof candidates[number])=>{
        const own=relations(asset)
        return (directIds.has(asset.assetId)?20:0)+
          (input.catalog.aspectClass(asset.assetId)===preferred?2:0)+
          related.reduce((sum,item)=>sum+item.weight*[...relations(item.asset)].filter(value=>own.has(value)).length,0)
      }
      selected=candidates.sort((a,b)=>score(b)-score(a)||a.assetId.localeCompare(b.assetId))[0]
    }
    else if(role==='accent-mask')
      selected=candidates.find(entry=>input.catalog.aspectClass(entry.assetId)===preferred)??candidates[0]
    if(!selected){
      if(role==='rear-collage')return undefined
      throw new Error('EDITORIAL_LOCAL_V3_CONTINUOUS_SURFACE_MISSING:'+role)
    }
    if(role==='accent-mask')return selected.assetId
    return selected.assetId
  }
  const aspectPreference=aspect==='wide'?'wide':aspect==='compact'?'compact':'vertical'
  const {frontId:_v2FrontId,rearId:_v2RearId,...v3Selection}=selected.selection
  const semanticallyMatchedRear=continuousSurface('rear-collage',aspectPreference)
  const accentId=continuousSurface('accent-mask',aspectPreference,semanticallyMatchedRear)
  if(!accentId)throw new Error('EDITORIAL_LOCAL_V3_CONTINUOUS_ACCENT_MISSING')
  // V2's trace only checks Hero/Support. V3 also resolves paper, accent and
  // background, so an actual selected paper must not be reported as missing.
  const searchableRoles=['hero-core','support','rear-collage','accent-mask','background'] as const
  const missingTerms=terms.filter(term=>!searchableRoles.some(role=>
    input.catalog.searchEditorialLocalV2(term,role).length>0))
  return {selection:{...v3Selection,heroId:hero.assetId,supportIds:supports.map(asset=>asset.assetId),
    variant:aspect==='wide'?'inverse':'base',
    ...(semanticallyMatchedRear?{rearId:semanticallyMatchedRear}:{}),
    accentId,
    ...(background?{backgroundId:background.assetId}:{}),missingTerms},
    trace:{...trace,missingTerms}}
}

/** V4 may recover a named object omitted by the semantic service, but only
 * when that word/phrase occurs literally in this clip's timed text. This
 * never synthesizes a concept from nearby scenes or a demo asset ID. */
export function selectEditorialLocalBankV4Detailed(input:{catalog:CuratedModularCatalogV2;
  semantic:LocalSceneSemanticV1;recentFamilies?:readonly ModernLayoutStructureV4[];
  contextualChoice?:{heroId:string;supportIds:string[];direction?:EditorialDirectionCurrent};useInventoryMetadata?:boolean}):{
    selection:EditorialLocalSelectionV2|null;trace:EditorialLocalSelectionTraceV2}{
  const literalTerms=[...new Set((['hero-core','support','rear-collage'] as const)
    .flatMap(role=>input.catalog.literalTermsInText(input.semantic.localText,role)))].slice(0,12)
  const semanticTerms=[input.semantic.anchor,...input.semantic.concepts.map(item=>item.label)]
    .filter((term):term is string=>typeof term==='string'&&!!term.trim())
  const missing=literalTerms.filter(term=>!semanticTerms.some(item=>canonicalNarrativeTerm(item)===canonicalNarrativeTerm(term)))
  const semantic={...input.semantic,concepts:[...input.semantic.concepts,
    ...missing.map(label=>({label,scope:'scene' as const}))]}
  // A literal transcript hit is a recovery path, not an equal-ranked rival to
  // an accepted scene concept. V3's historical ranking is intentionally intact.
  const semanticOnly=selectEditorialLocalBankV3Detailed({catalog:input.catalog,
    semantic:input.semantic,recentFamilies:input.recentFamilies,
    selectionRevision:EDITORIAL_LOCAL_BANK_V3_2.revision,minimumSupports:0})
  let result=selectEditorialLocalBankV3Detailed({catalog:input.catalog,semantic,
    recentFamilies:input.recentFamilies,selectionRevision:EDITORIAL_LOCAL_BANK_V3_2.revision,
    minimumSupports:0})
  if(input.contextualChoice){
    const choice=input.contextualChoice
    if(choice.direction)validateEditorialDirectionCurrent(choice.direction,choice.heroId,choice.supportIds)
    if(input.catalog.getById(choice.heroId)?.role!=='hero-core'||choice.supportIds.length>4||
      choice.supportIds.some(id=>input.catalog.getById(id)?.role!=='support'))throw Error('EDITORIAL_CONTEXTUAL_ROLE_INVALID')
    // Geometry remains the existing resolver; do not rotate families to fill quotas.
    const eligible=intentRules.find(rule=>EDITORIAL_LOCAL_FAMILIES_V3.includes(rule.family as typeof EDITORIAL_LOCAL_FAMILIES_V3[number])&&
      rule.test.test(normalized(input.semantic.localText)))
    result={selection:{family:choice.direction?.family??eligible?.family??'editorial',
      variant:choice.direction?.variant??(input.catalog.aspectClass(choice.heroId)==='wide'?'inverse':'base'),
      heroId:choice.heroId,supportIds:choice.supportIds,
      reason:choice.direction?.reason??'CONTEXTUAL_CANDIDATE_VALIDATED',missingTerms:result.trace.missingTerms},
      trace:{...result.trace,outcome:'SELECTED'}}
  }
  if(!result.selection)return {...result,trace:{...result.trace,literalTerms:missing}}
  const chosenHeroId=input.contextualChoice?.heroId??semanticOnly.selection?.heroId??result.selection.heroId
  const semanticHeroTerm=semanticOnly.trace.heroCandidates.find(candidate=>candidate.assetId===chosenHeroId)?.term
  const heroSelectionMechanism:NonNullable<EditorialLocalSelectionTraceV2['heroSelectionMechanism']>=
    input.contextualChoice?'contextual-candidates':!semanticOnly.selection?'literal-recovery':
    normalized(semanticHeroTerm??'')===normalized(input.semantic.anchor??'')?'semantic-anchor':'semantic-concept'
  const lookup=(id:string)=>input.useInventoryMetadata?input.catalog.selectionMetadata(id):input.catalog.getById(id)
  const hero=lookup(chosenHeroId)
  if(!hero)throw new Error('EDITORIAL_LOCAL_V4_HERO_MISSING')
  type Entry=NonNullable<typeof hero>
  const tags=(entry:Entry)=>new Set([
    ...((entry as Entry&{compatibleRelations?:string[]}).compatibleRelations??[]),
    (entry as Entry&{semanticFamily?:string}).semanticFamily,
  ].filter((tag):tag is string=>typeof tag==='string'&&!!tag).map(normalized))
  const intersects=(entry:Entry,related:Entry)=>[...tags(entry)].some(tag=>tags(related).has(tag))
  const excluded=(entry:Entry,related:Entry)=>{
    const exclusions=new Set(((entry as Entry&{exclusions?:string[]}).exclusions??[]).map(normalized))
    return [...tags(related)].some(tag=>exclusions.has(tag))
  }
  const neutralBacking=(entry:Entry)=>input.useInventoryMetadata&&entry.role==='accent-mask'&&
    (entry as Entry&{surfaceUse?:string}).surfaceUse==='hero-backing-accent-v1'&&
    entry.surfaceProfile==='continuous-filled-v1'
  const neutralBackground=(entry:Entry)=>input.useInventoryMetadata&&entry.role==='background'&&
    tags(entry).has('neutral-background')&&tags(entry).has('editorial-reading')
  const compatible=(entry:Entry,related:Entry)=>(intersects(entry,related)||neutralBacking(entry)||neutralBackground(entry))&&
    !excluded(entry,related)&&!excluded(related,entry)
  const preferred=input.catalog.aspectClass(hero.assetId)==='wide'?'wide':'vertical'
  const candidates=(role:'rear-collage'|'accent-mask'|'background')=>input.catalog.entries().map(entry=>lookup(entry.assetId)!)
    .filter(entry=>entry.role===role&&input.catalog.getById(entry.assetId)&&
      (role==='background'||(entry as Entry&{surfaceProfile?:string}).surfaceProfile==='continuous-filled-v1')&&
      (role!=='accent-mask'||(entry as Entry&{surfaceUse?:string}).surfaceUse==='hero-backing-accent-v1'))
    .sort((a,b)=>Number(input.catalog.aspectClass(a.assetId)!==preferred)-
      Number(input.catalog.aspectClass(b.assetId)!==preferred)||a.assetId.localeCompare(b.assetId))
  const background=candidates('background').find(entry=>compatible(entry,hero))
  const rear=candidates('rear-collage').find(entry=>compatible(entry,hero)||
    Boolean(background&&compatible(entry,background)))
  const accent=candidates('accent-mask').find(entry=>compatible(entry,hero)||
    Boolean(background&&compatible(entry,background))||Boolean(rear&&compatible(entry,rear)))
  const layerDecisions:NonNullable<EditorialLocalSelectionTraceV2['layerDecisions']>=[
    {role:'background',assetId:background?.assetId,reason:background?neutralBackground(background)?'AUTHORIZED_NEUTRAL_READING_BACKGROUND':'HERO_METADATA_RELATION':'NO_COMPATIBLE_BACKGROUND'},
    {role:'rear-collage',assetId:rear?.assetId,reason:rear?'HERO_OR_BACKGROUND_METADATA_RELATION':'NO_COMPATIBLE_REAR'},
    {role:'accent-mask',assetId:accent?.assetId,reason:accent?neutralBacking(accent)?'AUTHORIZED_COMPOSITIONAL_BACKING':'HERO_OR_LAYER_METADATA_RELATION':'NO_COMPATIBLE_ACCENT'},
  ]
  if(input.contextualChoice?.direction)layerDecisions.push({role:'front-collage',
    reason:'OMITTED_NO_CERTIFIED_FRONT_OCCLUSION_PAIRING'})
  // A grounded participant with the same concept can be meaningful (e.g. one
  // device and its network). Never silently remove a validated model decision.
  const supportIds=input.contextualChoice?.direction?result.selection.supportIds:result.selection.supportIds.filter(id=>{
    const candidate=input.catalog.getById(id)
    return candidate&&candidate.assetId!==hero.assetId&&
      normalized(candidate.primaryWordEs)!==normalized(hero.primaryWordEs)
  })
  return {selection:{...result.selection,heroId:hero.assetId,supportIds,
    rearId:rear?.assetId,accentId:accent?.assetId,
    backgroundId:background?.assetId},trace:{...result.trace,literalTerms:missing,
      heroSelectionMechanism,layerDecisions}}
}

/** Catalog is required only when this generation actually requests Visuales. */
export function preflightEditorialLocalCatalogV2(root: string | undefined, visualQuota: number): CuratedModularCatalogV1 | null {
  if (visualQuota <= 0) return null
  if (!root?.trim())
    throw new Error('Biblioteca editorial sin configurar. Selecciona la carpeta que contiene inventory.json antes de construir con Visuales.')
  try { return new CuratedModularCatalogV1(root.trim()) }
  catch (error) {
    throw new Error(`Biblioteca editorial no disponible: ${error instanceof Error ? error.message : String(error)}. Selecciona una carpeta válida con inventory.json; ningún Visual fue renderizado.`)
  }
}

/** The V3 snapshot composes the untouched V1 250-pack with active local batches. */
export function preflightEditorialLocalCatalogV3(root:string|undefined,visualQuota:number):CuratedModularCatalogV2|null{
  if(visualQuota<=0)return null
  if(!root?.trim())throw new Error('Biblioteca editorial sin configurar. Selecciona la carpeta que contiene inventory.json antes de construir con Visuales.')
  try{return new CuratedModularCatalogV2(root.trim())}
  catch(error){throw new Error(`Biblioteca editorial extensible no disponible: ${error instanceof Error?error.message:String(error)}. El snapshot activo permanece intacto.`)}
}

/** ProjectAsset materialization is still the original SHA-pinned raster provider.
 * V2 freezes independent portrait/landscape geometry and all visible choices. */
export function bindEditorialLocalBankV2(input:{
  template:{sceneSpec:VisualSceneSpecV2;graphicData:Record<string,any>}
  catalog:ModularCatalogProviderV2; imported:Record<string,ImportedModularAssetV1>
  selection:EditorialLocalSelectionV2; color:string; headline:{connector?:string;keyword:string;closing?:string}
  sceneDecision?:EditorialLocalBankPlanV4['sceneDecision']
  /** Only the sanitized subclip relation may authorize a new V4 connector. */
  semanticRelation?:string
  /** Controlled comparison only. The ordinary V4 route uses the integrated finish. */
  finishMode?:'historical'
  contract?:typeof EDITORIAL_LOCAL_BANK_V3|typeof EDITORIAL_LOCAL_BANK_V3_HISTORICAL|
    typeof EDITORIAL_LOCAL_BANK_V3_2|typeof EDITORIAL_LOCAL_BANK_V4
}){
  const chosen=input.selection
  const isV4=input.contract?.revision===EDITORIAL_LOCAL_BANK_V4.revision
  const integratedFinish=isV4&&input.finishMode!=='historical'
  const direction=isV4?input.sceneDecision?.planning?.direction:undefined
  if(direction)validateEditorialDirectionCurrent(direction,chosen.heroId,chosen.supportIds)
  const adjustments=[...(input.sceneDecision?.planning?.adjustments??[])]
  if(!/^#[0-9A-F]{6}$/.test(input.color)||chosen.supportIds.length<(isV4?0:2)||chosen.supportIds.length>6||
      new Set(chosen.supportIds).size!==chosen.supportIds.length||
      (input.contract&&!isV4&&!EDITORIAL_LOCAL_FAMILIES_V3.includes(chosen.family as typeof EDITORIAL_LOCAL_FAMILIES_V3[number]))||
      (isV4&&!input.sceneDecision))
    throw new Error('EDITORIAL_LOCAL_INPUT_INVALID')
  const requireAsset=(id:string,role:NonNullable<ReturnType<ModularCatalogProviderV2['getById']>>['role'])=>{
    const asset=input.imported[id],approved=input.catalog.getById(id)
    if(!asset||!approved||approved.role!==role||asset.asset.sha256!==approved.sha256||
        asset.asset.id!==id)throw new Error('EDITORIAL_LOCAL_ASSET_NOT_CURATED:'+id)
    return asset
  }
  const hero=requireAsset(chosen.heroId,'hero-core')
  const background=input.contract&&chosen.backgroundId?requireAsset(chosen.backgroundId,'background'):undefined
  if(direction&&background)adjustments.push('BACKGROUND_PROCEDURAL_REPLACED_BY_COMPATIBLE_CATALOG_PAPER:'+background.curated.assetId)
  const heroBytes=input.catalog.resolveAsset(hero.curated.assetId)
  const heroBounds=subjectBoundsFromPixabayRasterV1(heroBytes)
  const aspect=input.catalog.aspectClass(chosen.heroId)
  const supports=chosen.supportIds.map(id=>requireAsset(id,'support'))
  if(!input.contract&&!chosen.frontId)throw new Error('EDITORIAL_LOCAL_V2_FRONT_LAYER_REQUIRED')
  const rearId=chosen.rearId
  if((!input.contract||input.contract.revision===EDITORIAL_LOCAL_BANK_V3_HISTORICAL.revision)&&!chosen.rearId)
    throw new Error('EDITORIAL_LOCAL_V2_REAR_LAYER_REQUIRED')
  const layers=[
    ...(rearId?[{slotId:'idea-rear' as const,asset:requireAsset(rearId,'rear-collage')}]:[]),
    ...(isV4&&!chosen.accentId?[]:[{slotId:'idea-accent' as const,
      asset:requireAsset(chosen.accentId!,'accent-mask')}]),
    ...(chosen.frontId?[{slotId:'idea-front' as const,asset:requireAsset(chosen.frontId,'front-collage')}]:[]),
  ]
  const portrait=createEditorialLocalBankLayoutV2(chosen.family,'portrait',supports.length,chosen.variant,isV4?0:2)
  const landscape=createEditorialLocalBankLayoutV2(chosen.family,'landscape',supports.length,chosen.variant,isV4?0:2)
  const focus=chosen.family==='lineaTiempo'||chosen.family==='cascada'||chosen.family==='redNodos'
  const entry=direction?.entry??(focus?'supports-first':chosen.family==='editorial'?'word-first':'text-first')
  const heroTiming={enter:entry==='supports-first'?.13:.04,settle:entry==='supports-first'?.31:.25}
  const supportStart=entry==='supports-first'?.03:direction?.18:.27
  const supportStagger=direction?.035:.045
  const supportsTiming=supports.map((_,index)=>({enter:supportStart+index*supportStagger,
    settle:supportStart+index*supportStagger+.11}))
  const layerTiming=[{start:.08,settle:.23,exit:.93},{start:.13,settle:.28,exit:.93},
    {start:.18,settle:.34,exit:.93}]
  const planLayers=layers.map(({slotId,asset})=>({id:slotId,sha256:asset.asset.sha256,
    mime:'image/png' as const,alphaMode:'useful-alpha' as const,
    rect:!input.contract?(slotId==='idea-rear'?{x:-2,y:3,width:104,height:94}:slotId==='idea-accent'?{x:7,y:7,width:86,height:86}:
      aspect==='vertical'?{x:4,y:67,width:92,height:30}:
        aspect==='wide'?{x:4,y:47,width:92,height:44}:{x:4,y:52,width:92,height:40}):
      input.contract.revision===EDITORIAL_LOCAL_BANK_V3_HISTORICAL.revision?
      slotId==='idea-rear'?{x:-12,y:-8,width:124,height:116}:slotId==='idea-accent'?{x:-6,y:-4,width:112,height:108}:
      aspect==='vertical'?{x:4,y:67,width:92,height:30}:
        aspect==='wide'?{x:4,y:47,width:92,height:44}:{x:4,y:52,width:92,height:40}:
      (input.contract.revision===EDITORIAL_LOCAL_BANK_V3_2.revision||isV4)?
      slotId==='idea-rear'?{x:-18,y:-13,width:136,height:126}:
      slotId==='idea-accent'?{x:-8,y:-8,width:116,height:116}:
      aspect==='vertical'?{x:4,y:67,width:92,height:30}:
        aspect==='wide'?{x:4,y:47,width:92,height:44}:{x:4,y:52,width:92,height:40}:
      slotId==='idea-rear'?{x:-8,y:-4,width:116,height:108}:
      slotId==='idea-accent'?{x:18,y:18,width:64,height:64}:
      aspect==='vertical'?{x:4,y:67,width:92,height:30}:
        aspect==='wide'?{x:4,y:47,width:92,height:44}:{x:4,y:52,width:92,height:40},
    zIndex:slotId==='idea-rear'?1 as const:slotId==='idea-accent'?2 as const:5 as const,
    timing:slotId==='idea-rear'?layerTiming[0]:slotId==='idea-accent'?layerTiming[1]:layerTiming[2],from:{x:0,y:4,scale:.97},
    catalogAssetId:asset.curated.assetId,catalogSha256:asset.curated.sha256,
    colorCapability:slotId==='idea-accent'?'accent-primary' as const:'none' as const,
    accentTreatment:slotId==='idea-accent'?'alpha-mask' as const:'none' as const}))
  const font:FinishFont=direction?'Fraunces':chosen.family==='cuaderno'||chosen.family==='lineaTiempo'?'Instrument Serif':
    chosen.family==='cintaDiagonal'||chosen.family==='rayosImpacto'?'Bricolage Grotesque':'Fraunces'
  const color=resolveModularTitleAccentV1(input.color)
  const supportsPlan=supports.map((asset,index)=>({slotId:EDITORIAL_LOCAL_SUPPORT_IDS_V2[index],
    assetId:asset.curated.assetId,sha256:asset.asset.sha256,
    label:asset.curated.primaryWordEs.toLocaleUpperCase('es'),...supportsTiming[index]}))
  const script=input.sceneDecision?.localText??''
  const v4RelationReason:NonNullable<EditorialLocalBankPlanV4['relationDecision']>['reason']=
    !supports.length?'NO_SUPPORTS':!input.semanticRelation?'NO_VALID_RELATION':
    input.semanticRelation==='conecta'?/\b(?:conecta|conectan|une|unen|vincula|vinculan|enlaza|enlazan|relaciona|relacionan)\b/iu.test(script)
      ?'SCRIPT_CONNECTS':'NO_SCRIPT_EVIDENCE':
    input.semanticRelation==='contrasta'?/\b(?:contrasta|contrastan|compara|comparan|frente a|versus)\b/iu.test(script)
      ?'SCRIPT_CONTRASTS':'NO_SCRIPT_EVIDENCE':'UNSUPPORTED_RELATION'
  const v4Draws=!isV4||v4RelationReason==='SCRIPT_CONNECTS'||v4RelationReason==='SCRIPT_CONTRASTS'
  const relationMeaning=isV4?v4RelationReason==='SCRIPT_CONTRASTS'?'compares' as const:'connects' as const:
    chosen.family==='partidoVertical'?'compares' as const:
    chosen.family==='cascada'?'transfers' as const:'connects' as const
  const relationPairs=(v4Draws?supports:[]).map((_,index)=>({from:relationMeaning==='transfers'&&index>0?
    EDITORIAL_LOCAL_SUPPORT_IDS_V2[index-1]:'hero' as const,
    to:EDITORIAL_LOCAL_SUPPORT_IDS_V2[index]}))
  let relations:EditorialLocalRelationV2[]=direction?[]:relationPairs.map(({from,to},index)=>{
    const start=Math.max(from==='hero'?heroTiming.settle:supportsTiming[index-1].settle,
      supportsTiming[index].settle)+.015+index*.005
    const routeFor=(layout:typeof portrait,orientation:'portrait'|'landscape')=>{
      try{return routeEditorialFinishV11(layout,from,to,orientation==='landscape',{
        hero:isV4?editorialHeroAlphaTargetV4(heroBytes,layout,orientation,
          from==='hero'?to:from,heroBounds):editorialLocalHeroVisibleRectV2(layout,heroBounds,orientation)})}
      catch(error){throw new Error(`EDITORIAL_LOCAL_ROUTE_${orientation.toUpperCase()}:${chosen.family}:${from}>${to}:${error instanceof Error?error.message:String(error)}`)}
    }
    return {from,to,meaning:relationMeaning,
      // The older V4 script cues are symmetric; the integrated recipe may add a
      // direction only when the persisted relation meaning authorizes it.
      representation:integratedFinish?editorialFinishRecipeV2(relationMeaning).representation:
        isV4?relationMeaning==='compares'?'dotted':'accent-link':
        index%3===0?'arrow':index%3===1?'dotted':'dot-flow',
      response:integratedFinish?editorialFinishRecipeV2(relationMeaning).response:
        index%2===0?'pulse':'accent',portrait:routeFor(portrait,'portrait'),
      landscape:routeFor(landscape,'landscape'),color:input.color,
      start,arrival:start+.045,end:start+.105}
  })
  if(direction){
    const slotFor=(id:string)=>id===chosen.heroId?'hero' as const:supportsPlan.find(s=>s.assetId===id)!.slotId
    const settled=(id:string)=>id==='hero'?heroTiming.settle:supportsPlan.find(s=>s.slotId===id)!.settle
    let previousArrival=0
    relations=direction.relations.flatMap(edge=>{
      const from=slotFor(edge.fromId),to=slotFor(edge.toId)
      const start=Math.max(settled(from),settled(to),previousArrival)+.015
      if(start+.07>.56){adjustments.push(`RELATION_OMITTED_READING_BUDGET:${edge.fromId}>${edge.toId}`);return []}
      try{
        const route=(layout:typeof portrait,orientation:'portrait'|'landscape')=>routeEditorialFinishV11(layout,from,to,orientation==='landscape',{
          hero:from==='hero'||to==='hero'?editorialHeroAlphaTargetV4(heroBytes,layout,orientation,from==='hero'?to:from,heroBounds):
            editorialLocalHeroVisibleRectV2(layout,heroBounds,orientation)})
        const meaning=EDITORIAL_RELATION_MEANING[edge.relation]
        const portraitRoute=route(portrait,'portrait'),landscapeRoute=route(landscape,'landscape')
        previousArrival=start+.055
        const recipe=editorialFinishRecipeV2(meaning)
        return [{from,to,meaning,representation:integratedFinish?recipe.representation:
          meaning==='compares'?'dotted' as const:meaning==='connects'?'accent-link' as const:'arrow' as const,
          response:integratedFinish?recipe.response:'accent' as const,
          portrait:portraitRoute,landscape:landscapeRoute,color:input.color,
          start,arrival:previousArrival,end:previousArrival+.045}]
      }catch(error){
        adjustments.push(`RELATION_OMITTED_GEOMETRY:${edge.fromId}>${edge.toId}:${error instanceof Error?error.message:String(error)}`)
        return []
      }
    })
  }
  const plan:EditorialLocalBankPlanV2|EditorialLocalBankPlanV3|EditorialLocalBankPlanV4={revision:input.contract?.revision??EDITORIAL_LOCAL_BANK_V2.revision,
    ...(integratedFinish?{finishIntegration:EDITORIAL_FINISH_INTEGRATION_V2}:{}),
    catalogRevision:input.contract?EDITORIAL_LOCAL_CATALOG_REVISION_V3:
      input.catalog.catalogRevision??MODULAR_CATALOG_REVISION_V1,family:chosen.family,layoutVariant:chosen.variant,
    portraitLayout:portrait,landscapeLayout:landscape,
    background:direction?.background??(chosen.family==='cuaderno'?'white-soft-paper':
      ['redNodos','lineaTiempo','cascada','constelacion'].includes(chosen.family)?'ivory-subtle-grid':'ivory-clean'),
    entry,supportTreatment:chosen.family==='partidoVertical'?'ink-badge':
      chosen.family==='cascada'?'naked-label':'paper-card',
    camera:['editorial','marcoPoster','mundoIsometrico','capasApiladas'].includes(chosen.family)
      ?{mode:'quiet-drift' as const,dx:.6,dy:.35}:{mode:'fixed' as const,dx:0,dy:0},
    particles:{mode:'none',count:0,opacity:0},
    ink:'#11110F',paper:chosen.family==='cuaderno'?'#FAF9F6':'#F0EEE8',
    accent:input.color,supportTint:'#11110F',
    typography:{display:font,weight:font==='Instrument Serif'?400:650,body:'DM Sans',
      label:'IBM Plex Sans Condensed',displaySha256:EDITORIAL_FINISH_FONT_SHA_V11[font],
      bodySha256:EDITORIAL_FINISH_BODY_FONT_SHA_V11,labelSha256:EDITORIAL_FINISH_LABEL_FONT_SHA_V11},
    colors:{headline:'#11110F',keyword:color,body:'#11110F',effects:input.color},
    localIntensity:'discreto',ambientIntensity:'discreto',
    events:[{id:'hero-entry',target:'hero',kind:'hero-entry',start:direction?heroTiming.enter:.07,duration:direction?.15:.25,
      seed:13,color:input.color,count:4,size:.55,opacity:.35,intensity:'discreto'},
      ...supportsPlan.map((s,index)=>({id:`support-${index}-entry`,target:s.slotId,
        kind:'support-entry' as const,start:s.enter,duration:.15,seed:index+17,color:input.color,
        count:3,size:.45,opacity:.34,intensity:'discreto' as const})),
      ...(integratedFinish?editorialArrivalEventsV2(relations,input.color):[])],
    hero:{assetId:hero.curated.assetId,sha256:hero.asset.sha256,...heroTiming},
    supports:supportsPlan,layers:planLayers,relations,
    ...(isV4?{relationDecision:direction?{status:relations.length?'drawn' as const:'omitted' as const,
      reason:relations.length?'GROUNDED_GRAPH' as const:'NO_GROUNDED_EDGES' as const}:v4Draws?{
      status:'drawn' as const,reason:v4RelationReason,
      sourceRelation:input.semanticRelation as 'conecta'|'contrasta',
    }:{status:'omitted' as const,reason:v4RelationReason}}:{}),
    ...(isV4?{supportLabelSize:'mobile-readable-v1' as const}:{}),
    ...(background?{backgroundAsset:{assetId:background.curated.assetId,sha256:background.curated.sha256}}:{}),
    beats:direction?[{id:'establish',start:0,end:.25},{id:'develop',start:.25,end:Math.max(.42,...relations.map(r=>r.end))},
      {id:'read',start:Math.max(.42,...relations.map(r=>r.end)),end:.89}]:
      [{id:'establish',start:0,end:.31},{id:'develop',start:.31,end:.62},{id:'read',start:.62,end:.91}],
    ...(isV4?{sceneDecision:direction?{...input.sceneDecision!,planning:{...input.sceneDecision!.planning!,adjustments}}:input.sceneDecision}:{}),
  }
  const slot=(slotId:SceneSlotV2['slotId'],asset:ImportedModularAssetV1,kind:'simple-icon'|'complex-illustration'):SceneSlotV2=>({
    slotId,role:slotId,state:'present',sha256:asset.asset.sha256,mime:'image/png',
    kind,alphaMode:'useful-alpha',bounds:slotId==='hero'?heroBounds:
      subjectBoundsFromPixabayRasterV1(input.catalog.resolveAsset(asset.curated.assetId)),
    fitPolicy:kind==='simple-icon'?'contain':'subject-contain',
    tint:{treatment:kind==='simple-icon'?'accent-mask':'original-color'},
    colorCapability:kind==='simple-icon'?'alpha-mask':'none',
    motion:createRoleMotionV2({role:slotId,energy:'low'}),
  })
  const {ideaAssembly:_assembly,editorialFamily:_family,editorialFinish:_finish,
    editorialMotionCue:_cue,lightStyle:_light,premiumStyle:_premium,
    compositionV2:_composition,...base}=input.template.sceneSpec
  const sceneSpec:VisualSceneSpecV2={...base,presentationProfile:input.contract??EDITORIAL_LOCAL_BANK_V2,
    visualMode:'asset-led',direccion:{...base.direccion,estructura:chosen.family},
    layout:portrait,text:isV4
      ?editorialTextWithoutEmptyClosingV4(base.text,input.headline,portrait.textAlignment)
      :{...base.text,...input.headline,alignment:portrait.textAlignment},
    slots:[slot('hero',hero,'complex-illustration'),
      ...supports.map((asset,index)=>slot(EDITORIAL_LOCAL_SUPPORT_IDS_V2[index],asset,'simple-icon'))],
    editorialBankV2:plan}
  const renderBindings:RenderBindingsV2={version:2,assets:[{slotId:'hero',assetId:hero.asset.id,
      relativeFile:hero.asset.relativeFile},
    ...supports.map((asset,index)=>({slotId:EDITORIAL_LOCAL_SUPPORT_IDS_V2[index],
      assetId:asset.asset.id,relativeFile:asset.asset.relativeFile})),
    ...layers.map(({slotId,asset})=>({slotId,assetId:asset.asset.id,
      relativeFile:asset.asset.relativeFile})),
    ...(background?[{slotId:'idea-background' as const,assetId:background.asset.id,
      relativeFile:background.asset.relativeFile}]:[])]}
  validateVisualSceneSpecV2(sceneSpec)
  validateRenderBindingsAny(renderBindings,sceneSpec)
  const graphicData:Record<string,any>={...input.template.graphicData,
    extra:{...input.template.graphicData.extra,sceneSpec}}
  return {sceneSpec,renderBindings,graphicData,
    pixelIdentity:sceneSpecPixelIdentityAny(sceneSpec),titleAccent:color,
    selectionReason:chosen.reason}
}

export { editorialHeadlineFromLocalTextV1 }
