import { EDITORIAL_MODULAR_FAMILIES_V1, createEditorialModularFamilyLayoutV1,
  type EditorialBackgroundV1, type EditorialEntryV1, type EditorialFamilyIdV1,
  type EditorialLayoutVariantV1, type EditorialModularFamiliesPlanV1, type EditorialRelationV1,
  type EditorialSupportTreatmentV1 } from '../../shared/editorial-modular-families-v1'
import { getCuratedModularAssetV1, resolveModularTitleAccentV1 } from '../../shared/editorial-modular-catalog-v1'
import { IDEA_SUPPORT_IDS, type IdeaAssemblyResource } from '../../shared/editorial-idea-assembly-v1'
import { sceneSpecPixelIdentityAny, validateRenderBindingsAny, validateVisualSceneSpecV2,
  createRoleMotionV2, type RenderBindingsV2, type SceneSlotV2, type VisualSceneSpecV2 } from '../../shared/visual-scene-spec-v2'
import type { ImportedModularAssetV1 } from './editorial-modular-catalog-v1'
import { CuratedModularCatalogV1 } from './editorial-modular-catalog-v1'
import { subjectBoundsFromPixabayRasterV1 } from './pixabay-images'
import type { LocalSceneSemanticV1 } from '../../shared/local-scene-semantic'
import { EDITORIAL_FINISH_V1_1, createEditorialFinishV11, type FinishFont,
  type FinishIntensity, type FinishRepresentation, type FinishResponse } from '../../shared/editorial-finish-v1-1'

/** The historic keyword compiler may shorten a closing line. This opt-in
 * profile keeps every token of the source segment, including numbers and
 * negations, while giving the matched keyword its own editable text field. */
export function editorialHeadlineFromLocalTextV1(localText:string,keyword:string) {
  const phrase=localText.trim()
  const term=keyword.trim()
  if(!phrase||!term)throw new Error('EDITORIAL_HEADLINE_SOURCE_MISSING')
  const at=phrase.toLocaleLowerCase('es').indexOf(term.toLocaleLowerCase('es'))
  if(at<0){
    // A semantic keyword may not appear verbatim in the narrated segment.
    // Never insert that extra word into an otherwise literal display.
    const first=phrase.match(/^\S+/u)?.[0]
    if(!first)throw new Error('EDITORIAL_HEADLINE_SOURCE_MISSING')
    return {connector:'',keyword:first,closing:phrase.slice(first.length).trim()}
  }
  return {connector:phrase.slice(0,at).trim(),keyword:phrase.slice(at,at+term.length),
    closing:phrase.slice(at+term.length).trim()}
}

/** Materialization remains CuratedModularCatalogV1.publish -> ProjectAsset. This
 * adapter freezes only semantic choices and pixel geometry, never local paths. */
export function bindEditorialModularFamilyV1(input: {
  template: {sceneSpec:VisualSceneSpecV2;graphicData:Record<string,any>}
  catalog:CuratedModularCatalogV1
  imported: Record<string,ImportedModularAssetV1>
  family: EditorialFamilyIdV1
  layoutVariant?:EditorialLayoutVariantV1
  heroId?:string
  supportIds:readonly string[]
  rearId?:string;accentId?:string;frontId?:string
  background:EditorialBackgroundV1
  entry:EditorialEntryV1
  supportTreatment:EditorialSupportTreatmentV1
  camera:'fixed'|'quiet-drift'
  particles:'none'|'dust'|'ticks'
  color:string
  supportTint?:string
  headline:{connector?:string;keyword:string;closing?:string}
  relations?:readonly Omit<EditorialRelationV1,'start'|'end'>[]
}) {
  const source=input.template.sceneSpec
  if(source.renderSpecVersion!==2)
    throw new Error('EDITORIAL_FAMILY_TEMPLATE_INVALID')
  if(!/^#[0-9A-F]{6}$/.test(input.color) ||
      input.supportTint && !/^#[0-9A-F]{6}$/.test(input.supportTint) ||
      input.supportIds.length>(input.family==='editorial'?0:4) ||
      (input.family==='editorial' ? !!input.heroId || input.supportIds.length!==0 :
        !input.heroId || ['constelacion','cascada'].includes(input.family) && input.supportIds.length<2) ||
      new Set(input.supportIds).size!==input.supportIds.length)
    throw new Error('EDITORIAL_FAMILY_INPUT_INVALID')
  const requireRole=(assetId:string,role:ImportedModularAssetV1['curated']['role'])=>{
    const selected=input.imported[assetId],approved=getCuratedModularAssetV1(assetId)
    if(!selected || !approved || approved.role!==role || selected.curated.assetId!==assetId ||
      selected.asset.id!==assetId || selected.asset.sha256!==approved.sha256)
      throw new Error('EDITORIAL_FAMILY_ASSET_NOT_CURATED:'+assetId)
    return selected
  }
  const hero=input.heroId?requireRole(input.heroId,'hero-core'):undefined
  const supports=input.supportIds.map(id=>requireRole(id,'support'))
  const layerSelections=[
    input.rearId&&{id:'idea-rear' as const,asset:requireRole(input.rearId,'rear-collage')},
    input.accentId&&{id:'idea-accent' as const,asset:requireRole(input.accentId,'accent-mask')},
    input.frontId&&{id:'idea-front' as const,asset:requireRole(input.frontId,'front-collage')},
  ].filter((x):x is {id:'idea-rear'|'idea-accent'|'idea-front';asset:ImportedModularAssetV1}=>!!x)
  if(!hero && layerSelections.length) throw new Error('EDITORIAL_FAMILY_TYPE_LED_HAS_LAYERS')
  const layers:IdeaAssemblyResource[]=layerSelections.map(({id,asset})=>({
    id,sha256:asset.asset.sha256,mime:'image/png',alphaMode:'useful-alpha',
    rect:id==='idea-rear'?{x:0,y:0,width:100,height:100}:
      id==='idea-accent'?{x:8,y:8,width:84,height:84}:{x:2,y:14,width:96,height:82},
    zIndex:id==='idea-rear'?1:id==='idea-accent'?2:5,
    timing:id==='idea-rear'?{start:.10,settle:.28,exit:.9}:
      id==='idea-accent'?{start:.17,settle:.33,exit:.9}:{start:.23,settle:.39,exit:.9},
    from:{x:0,y:5,scale:.96},
    catalogAssetId:asset.curated.assetId,catalogSha256:asset.curated.sha256,
    colorCapability:id==='idea-accent'?'accent-primary':'none',
    accentTreatment:id==='idea-accent'?'alpha-mask':'none',
  }))
  const orientationLayouts={
    portrait:createEditorialModularFamilyLayoutV1(input.family,'portrait',supports.length,input.layoutVariant),
    landscape:createEditorialModularFamilyLayoutV1(input.family,'landscape',supports.length,input.layoutVariant),
  }
  // A type-only beat has neither a Hero nor Supports to lead the entrance.
  // Freeze the effective cue rather than persisting a non-existent first actor.
  const entry:EditorialEntryV1=input.family==='editorial'&&
    (input.entry==='hero-first'||input.entry==='supports-first')?'word-first':input.entry
  const heroTiming={enter:input.entry==='supports-first'?.13:.02,settle:input.entry==='supports-first'?.31:.25}
  const supportTiming=supports.map((_,index)=>{
    const enter=(input.entry==='supports-first'?.04:.27)+index*.055
    return {enter,settle:enter+.12}
  })
  const relations:EditorialRelationV1[]=(input.relations??[]).map((item,index)=>{
    const settle=(id:string)=>id==='hero'?heroTiming.settle:
      supportTiming[IDEA_SUPPORT_IDS.indexOf(id as typeof IDEA_SUPPORT_IDS[number])]?.settle??0
    const start=Math.max(settle(item.from),settle(item.to))+.025+index*.05
    return {...item,start,end:start+.055}
  })
  const plan:EditorialModularFamiliesPlanV1={
    revision:EDITORIAL_MODULAR_FAMILIES_V1.revision,
    catalogRevision:'editorial-modular-catalog-2026-09-v1',family:input.family,
    layoutVariant:input.layoutVariant??'base',
    landscapeLayout:orientationLayouts.landscape,background:input.background,
    entry,supportTreatment:input.supportTreatment,
    camera:{mode:input.camera,dx:input.camera==='fixed'?0:.3,dy:input.camera==='fixed'?0:-.2},
    particles:{mode:input.particles,count:input.particles==='none'?0:6,
      opacity:input.particles==='none'?0:.055},
    ink:'#11110F',paper:input.background==='white-soft-paper'?'#FAF9F6':'#F0EEE8',
    accent:input.color,supportTint:input.supportTint??'#11110F',
    ...(hero?{hero:{assetId:hero.curated.assetId,sha256:hero.asset.sha256,...heroTiming}}:{}),
    supports:supports.map((asset,index)=>({slotId:IDEA_SUPPORT_IDS[index],assetId:asset.curated.assetId,
      sha256:asset.asset.sha256,label:asset.curated.primaryWordEs.toLocaleUpperCase('es'),...supportTiming[index]})),
    layers,relations,
  }
  const slots:SceneSlotV2[]=[
    ...(hero?[{slotId:'hero' as const,role:'hero' as const,state:'present' as const,
      sha256:hero.asset.sha256,mime:'image/png' as const,kind:'complex-illustration' as const,
      alphaMode:'useful-alpha' as const,bounds:subjectBoundsFromPixabayRasterV1(input.catalog.resolveAsset(hero.curated.assetId)),
      fitPolicy:'subject-contain' as const,tint:{treatment:'original-color' as const},colorCapability:'none' as const,
      motion:createRoleMotionV2({role:'hero',energy:'low'})}]:[]),
    ...supports.map((asset,index)=>({slotId:IDEA_SUPPORT_IDS[index],role:IDEA_SUPPORT_IDS[index],
      state:'present' as const,sha256:asset.asset.sha256,mime:'image/png' as const,
      kind:'simple-icon' as const,alphaMode:'useful-alpha' as const,
      bounds:subjectBoundsFromPixabayRasterV1(input.catalog.resolveAsset(asset.curated.assetId)),
      fitPolicy:'contain' as const,tint:{treatment:'accent-mask' as const},
      colorCapability:'alpha-mask' as const,
      motion:createRoleMotionV2({role:IDEA_SUPPORT_IDS[index],energy:'low'})})),
  ]
  const {ideaAssembly:_oldAssembly,editorialMotionCue:_oldCue,lightStyle:_oldLight,
    premiumStyle:_oldPremium,compositionV2:_oldComposition,editorialFinish:_oldFinish,...base}=source
  const sceneSpec:VisualSceneSpecV2={...base,presentationProfile:EDITORIAL_MODULAR_FAMILIES_V1,
    visualMode:hero?'asset-led':'editorial-text',
    direccion:{...source.direccion,estructura:input.family},
    layout:orientationLayouts.portrait,
    text:{...source.text,...input.headline,alignment:orientationLayouts.portrait.textAlignment},
    slots,editorialFamily:plan}
  // Exactly one binding per visible ProjectAsset; even the optional collage
  // layers are SHA-verified before capture and do not consume semantic slots.
  const selected=[...(hero?[{slotId:'hero',asset:hero}]:[]),
    ...supports.map((asset,index)=>({slotId:IDEA_SUPPORT_IDS[index],asset})),
    ...layerSelections.map(item=>({slotId:item.id,asset:item.asset}))]
  const renderBindings:RenderBindingsV2={version:2,assets:selected.map(({slotId,asset})=>({
    slotId:slotId as RenderBindingsV2['assets'][number]['slotId'],assetId:asset.asset.id,
    relativeFile:asset.asset.relativeFile}))}
  validateVisualSceneSpecV2(sceneSpec)
  validateRenderBindingsAny(renderBindings,sceneSpec)
  const graphicData:Record<string,any>={...input.template.graphicData,
    extra:{...input.template.graphicData.extra,sceneSpec}}
  return {sceneSpec,renderBindings,graphicData,pixelIdentity:sceneSpecPixelIdentityAny(sceneSpec),
    titleAccent:resolveModularTitleAccentV1(input.color)}
}

/** V1.1 augments the frozen V1 composition without altering its published pixels. */
export function bindEditorialModularFinishV11(input: Parameters<typeof bindEditorialModularFamilyV1>[0] & {
  finish?: { display?:FinishFont; headline?:string; keyword?:string; body?:string; effects?:string;
    local?:FinishIntensity; ambient?:FinishIntensity;
    representation?:FinishRepresentation|'auto'; response?:FinishResponse|'auto';
    composition?:'base'|'focus' }
}) {
  // V1.1 routes are frozen in scene coordinates. A drifting Hero would detach
  // them during entrance; keep this opt-in revision fixed until paths can
  // follow the actor's camera transform. The resolved choice is in SceneSpec.
  const legacy=bindEditorialModularFamilyV1((input.relations?.length??0)>0&&input.camera==='quiet-drift'
    ?{...input,camera:'fixed'}:input)
  const editorialFinish=createEditorialFinishV11(legacy.sceneSpec.editorialFamily!,legacy.sceneSpec.layout,input.finish)
  const sceneSpec:VisualSceneSpecV2={...legacy.sceneSpec,presentationProfile:EDITORIAL_FINISH_V1_1,
    layout:editorialFinish.portraitLayout,editorialFinish}
  validateVisualSceneSpecV2(sceneSpec)
  validateRenderBindingsAny(legacy.renderBindings,sceneSpec)
  return {...legacy,sceneSpec,pixelIdentity:sceneSpecPixelIdentityAny(sceneSpec),
    graphicData:{...legacy.graphicData,extra:{...legacy.graphicData.extra,sceneSpec}} as Record<string,any>}
}

/** Content-first, exact-alias selection. No padding with unrelated icons. */
export function selectEditorialModularFamilyAssetsV1(input:{
  catalog:CuratedModularCatalogV1;semantic:LocalSceneSemanticV1;sceneIndex:number;
  previousFamily?:EditorialFamilyIdV1;preferredFamily?:EditorialFamilyIdV1
}) {
  const localText=input.semantic.localText.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  const terms=[input.semantic.anchor,...input.semantic.concepts
    .filter(item=>item.scope==='scene'||item.scope===undefined&&
      localText.includes(item.label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()))
    .map(item=>item.label)]
    .filter((word):word is string=>typeof word==='string'&&!!word.trim())
  const heroes=terms.flatMap(word=>input.catalog.search([word],'hero-core'))
  const hero=heroes.find((item,index)=>heroes.findIndex(candidate=>candidate.assetId===item.assetId)===index)
  const supportCandidates=terms.flatMap(word=>input.catalog.search([word],'support'))
    .filter(item=>item.primaryWordEs.toLocaleLowerCase('es')!==hero?.primaryWordEs.toLocaleLowerCase('es'))
  // A type-led scene must remain type-led; unmatched semantic terms must not
  // turn into detached support icons or an invalid Hero-less SceneSpec.
  const supports=hero?supportCandidates.filter((item,index)=>
    supportCandidates.findIndex(candidate=>candidate.assetId===item.assetId)===index).slice(0,4):[]
  const relation=(input.semantic.relation??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  const text=localText
  let family:EditorialFamilyIdV1=!hero?'editorial'
    :/compar|contraste|frente a|versus/.test(relation+' '+text)?'partidoVertical'
    :supports.length>=2&&/proceso|secuencia|paso|flujo|produce|causa/.test(relation+' '+text)?'cascada'
    :supports.length>=2&&/red|conecta|relacion/.test(relation+' '+text)?'constelacion'
    :/document|archivo|historia|escritura|lectura/.test(text)?'cuaderno':'marcoPoster'
  if(hero&&family===input.previousFamily&&['marcoPoster','cuaderno'].includes(family))
    family=family==='marcoPoster'?'cuaderno':'marcoPoster'
  const preferenceEligible=input.preferredFamily==='editorial' ||
    (!!hero && (!['constelacion','cascada'].includes(input.preferredFamily??'') || supports.length>=2))
  if(input.preferredFamily && preferenceEligible) family=input.preferredFamily
  const useHero=family!=='editorial'?hero:undefined
  const useSupports=useHero?supports:[]
  // Catalog layers have no approved Hero-pair compatibility metadata yet.
  // A scene-index rotation would make arbitrary paper/accent overlays look
  // curated. Keep the Hero core intact until a user supplies an explicit pair.
  // A process label establishes order, not causality. Reserve causal arrows
  // for an explicit causal verb in this scene's structured relation or text.
  const causal=/produce|causa|transforma|provoca|genera/.test(relation+' '+text)
  const relations:Omit<EditorialRelationV1,'start'|'end'>[]=family==='cascada'&&useSupports.length>=2
    ?[{from:'hero',to:'support-1',meaning:causal?'causes':'connects'},
      {from:'support-1',to:'support-2',meaning:causal?'causes':'connects'}]
    :family==='constelacion'&&useSupports.length>=2
      ?[{from:'support-1',to:'hero',meaning:'connects'},{from:'hero',to:'support-2',meaning:'connects'}]
      :family==='partidoVertical'&&useSupports.length>=2
        ?[{from:'hero',to:'support-1',meaning:'compares'}]:[]
  const background:EditorialBackgroundV1=family==='partidoVertical'||family==='constelacion'||family==='cascada'
    ?'ivory-subtle-grid':family==='cuaderno'?'white-soft-paper':'ivory-clean'
  const entry:EditorialEntryV1=family==='constelacion'?'supports-first':
    family==='editorial'?'word-first':family==='cascada'?'hero-first':'text-first'
  const supportTreatment:EditorialSupportTreatmentV1=family==='partidoVertical'?'ink-badge':
    family==='cascada'?'naked-label':family==='cuaderno'?'accent-tile':'paper-card'
  const layoutVariant:EditorialLayoutVariantV1=useHero&&input.catalog.aspectClass(useHero.assetId)==='wide'||
    (family==='editorial'&&input.semantic.localText.length>85)?'inverse':'base'
  return {family,layoutVariant,heroId:useHero?.assetId,supportIds:useSupports.map(item=>item.assetId),
    rearId:undefined,accentId:undefined,frontId:undefined,
    relations,background,entry,supportTreatment,
    camera:family==='marcoPoster'&&supports.length>=2?'quiet-drift' as const:'fixed' as const,
    particles:'none' as const,
    selectionReason:input.preferredFamily&&!preferenceEligible?'PREFERRED_FAMILY_INELIGIBLE':
      !hero?'NO_EXACT_CURATED_HERO':input.preferredFamily?'USER_SELECTED_FAMILY':'CONTENT_RULE'}
}
