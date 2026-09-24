import { EDITORIAL_LOCAL_BANK_V2, EDITORIAL_LOCAL_FAMILIES_V2,
  EDITORIAL_LOCAL_SUPPORT_IDS_V2, createEditorialLocalBankLayoutV2,
  editorialLocalHeroVisibleRectV2,
  type EditorialLocalBankPlanV2, type EditorialLocalRelationV2,
  type EditorialLocalVariantV2 } from '../../shared/editorial-local-bank-v2'
import { MODULAR_CATALOG_REVISION_V1, getCuratedModularAssetV1,
  resolveModularTitleAccentV1 } from '../../shared/editorial-modular-catalog-v1'
import { EDITORIAL_FINISH_FONT_SHA_V11, EDITORIAL_FINISH_BODY_FONT_SHA_V11,
  EDITORIAL_FINISH_LABEL_FONT_SHA_V11, routeEditorialFinishV11,
  type FinishFont } from '../../shared/editorial-finish-v1-1'
import { sceneSpecPixelIdentityAny, validateVisualSceneSpecV2,
  validateRenderBindingsAny, createRoleMotionV2,
  type VisualSceneSpecV2, type SceneSlotV2, type RenderBindingsV2 } from '../../shared/visual-scene-spec-v2'
import { subjectBoundsFromPixabayRasterV1 } from './pixabay-images'
import { CuratedModularCatalogV1, type ImportedModularAssetV1 } from './editorial-modular-catalog-v1'
import type { LocalSceneSemanticV1 } from '../../shared/local-scene-semantic'
import type { ModernLayoutStructureV4 } from '../../shared/visual-layout-v4'
import { editorialHeadlineFromLocalTextV1 } from './editorial-modular-families-v1'

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
  heroId:string;supportIds:string[];rearId:string;accentId:string;frontId:string
  reason:string;missingTerms:string[]
}
/** Content-first selector. A scene without two genuinely matched Supports is not
 * promoted to an illustrated V2 scene. No quotas or fake semantic matches. */
export function selectEditorialLocalBankV2(input:{catalog:CuratedModularCatalogV1;
  semantic:LocalSceneSemanticV1;recentFamilies?:readonly ModernLayoutStructureV4[]}):EditorialLocalSelectionV2|null{
  const text=normalized(input.semantic.localText)
  const terms=[input.semantic.anchor,...input.semantic.concepts.filter(item=>
    item.scope==='scene'||item.scope===undefined&&text.includes(normalized(item.label))).map(item=>item.label)]
    .filter((term):term is string=>typeof term==='string'&&!!term.trim())
  const heroes=terms.flatMap(term=>input.catalog.search([term],'hero-core'))
  const hero=heroes[0]
  const supports=terms.flatMap(term=>input.catalog.search([term],'support'))
    .filter((item,index,all)=>item.primaryWordEs.toLocaleLowerCase('es')!==hero?.primaryWordEs.toLocaleLowerCase('es')&&
      all.findIndex(candidate=>candidate.assetId===item.assetId)===index).slice(0,6)
  if(!hero||supports.length<2)return null
  const relation=normalized(input.semantic.relation??'')
  const eligible=intentRules.filter(rule=>rule.test.test(`${relation} ${text}`))
  const recent=new Set(input.recentFamilies?.slice(-3)??[])
  const family=(eligible.find(item=>!recent.has(item.family))??eligible[0])?.family??
    (recent.has('editorial')?'marcoPoster':'editorial')
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
  return {family,variant:aspect==='wide'?'inverse':'base',heroId:hero.assetId,
    supportIds:supports.map(item=>item.assetId),rearId:byCode(layerCode,'rear-collage'),
    accentId:byCode(accentCode,'accent-mask'),frontId:byCode(frontCode,'front-collage'),
    reason:eligible.length?'CONTENT_RELATION':'EDITORIAL_DEFAULT',missingTerms:[]}
}

/** ProjectAsset materialization is still the original SHA-pinned raster provider.
 * V2 freezes independent portrait/landscape geometry and all visible choices. */
export function bindEditorialLocalBankV2(input:{
  template:{sceneSpec:VisualSceneSpecV2;graphicData:Record<string,any>}
  catalog:CuratedModularCatalogV1; imported:Record<string,ImportedModularAssetV1>
  selection:EditorialLocalSelectionV2; color:string; headline:{connector?:string;keyword:string;closing?:string}
}){
  const chosen=input.selection
  if(!/^#[0-9A-F]{6}$/.test(input.color)||chosen.supportIds.length<2||chosen.supportIds.length>6||
      new Set(chosen.supportIds).size!==chosen.supportIds.length)throw new Error('EDITORIAL_LOCAL_INPUT_INVALID')
  const requireAsset=(id:string,role:NonNullable<ReturnType<typeof getCuratedModularAssetV1>>['role'])=>{
    const asset=input.imported[id],approved=getCuratedModularAssetV1(id)
    if(!asset||!approved||approved.role!==role||asset.asset.sha256!==approved.sha256||
        asset.asset.id!==id)throw new Error('EDITORIAL_LOCAL_ASSET_NOT_CURATED:'+id)
    return asset
  }
  const hero=requireAsset(chosen.heroId,'hero-core')
  const heroBounds=subjectBoundsFromPixabayRasterV1(input.catalog.resolveAsset(hero.curated.assetId))
  const aspect=input.catalog.aspectClass(chosen.heroId)
  const supports=chosen.supportIds.map(id=>requireAsset(id,'support'))
  const layers=[
    {slotId:'idea-rear' as const,asset:requireAsset(chosen.rearId,'rear-collage')},
    {slotId:'idea-accent' as const,asset:requireAsset(chosen.accentId,'accent-mask')},
    {slotId:'idea-front' as const,asset:requireAsset(chosen.frontId,'front-collage')},
  ]
  const portrait=createEditorialLocalBankLayoutV2(chosen.family,'portrait',supports.length,chosen.variant)
  const landscape=createEditorialLocalBankLayoutV2(chosen.family,'landscape',supports.length,chosen.variant)
  const focus=chosen.family==='lineaTiempo'||chosen.family==='cascada'||chosen.family==='redNodos'
  const entry=focus?'supports-first':chosen.family==='editorial'?'word-first':'text-first'
  const heroTiming={enter:entry==='supports-first'?.13:.04,settle:entry==='supports-first'?.31:.25}
  const supportsTiming=supports.map((_,index)=>({enter:(entry==='supports-first'?.03:.27)+index*.045,
    settle:(entry==='supports-first'?.03:.27)+index*.045+.11}))
  const layerTiming=[{start:.08,settle:.23,exit:.93},{start:.13,settle:.28,exit:.93},
    {start:.18,settle:.34,exit:.93}]
  const planLayers=layers.map(({slotId,asset},index)=>({id:slotId,sha256:asset.asset.sha256,
    mime:'image/png' as const,alphaMode:'useful-alpha' as const,
    rect:index===0?{x:-2,y:3,width:104,height:94}:index===1?{x:7,y:7,width:86,height:86}:
      aspect==='vertical'?{x:4,y:67,width:92,height:30}:
        aspect==='wide'?{x:4,y:47,width:92,height:44}:{x:4,y:52,width:92,height:40},
    zIndex:index===0?1 as const:index===1?2 as const:5 as const,timing:layerTiming[index],from:{x:0,y:4,scale:.97},
    catalogAssetId:asset.curated.assetId,catalogSha256:asset.curated.sha256,
    colorCapability:index===1?'accent-primary' as const:'none' as const,
    accentTreatment:index===1?'alpha-mask' as const:'none' as const}))
  const font:FinishFont=chosen.family==='cuaderno'||chosen.family==='lineaTiempo'?'Instrument Serif':
    chosen.family==='cintaDiagonal'||chosen.family==='rayosImpacto'?'Bricolage Grotesque':'Fraunces'
  const color=resolveModularTitleAccentV1(input.color)
  const supportsPlan=supports.map((asset,index)=>({slotId:EDITORIAL_LOCAL_SUPPORT_IDS_V2[index],
    assetId:asset.curated.assetId,sha256:asset.asset.sha256,
    label:asset.curated.primaryWordEs.toLocaleUpperCase('es'),...supportsTiming[index]}))
  const relationMeaning=chosen.family==='partidoVertical'?'compares' as const:
    chosen.family==='cascada'?'transfers' as const:'connects' as const
  const relationPairs=supports.map((_,index)=>({from:relationMeaning==='transfers'&&index>0?
    EDITORIAL_LOCAL_SUPPORT_IDS_V2[index-1]:'hero' as const,
    to:EDITORIAL_LOCAL_SUPPORT_IDS_V2[index]}))
  const relations:EditorialLocalRelationV2[]=relationPairs.map(({from,to},index)=>{
    const start=Math.max(from==='hero'?heroTiming.settle:supportsTiming[index-1].settle,
      supportsTiming[index].settle)+.015+index*.005
    const routeFor=(layout:typeof portrait,orientation:'portrait'|'landscape')=>{
      try{return routeEditorialFinishV11(layout,from,to,orientation==='landscape',{
        hero:editorialLocalHeroVisibleRectV2(layout,heroBounds,orientation)})}
      catch(error){throw new Error(`EDITORIAL_LOCAL_ROUTE_${orientation.toUpperCase()}:${chosen.family}:${from}>${to}:${error instanceof Error?error.message:String(error)}`)}
    }
    return {from,to,meaning:relationMeaning,
      representation:index%3===0?'arrow':index%3===1?'dotted':'dot-flow',
      response:index%2===0?'pulse':'accent',portrait:routeFor(portrait,'portrait'),
      landscape:routeFor(landscape,'landscape'),color:input.color,
      start,arrival:start+.045,end:start+.105}
  })
  const plan:EditorialLocalBankPlanV2={revision:EDITORIAL_LOCAL_BANK_V2.revision,
    catalogRevision:MODULAR_CATALOG_REVISION_V1,family:chosen.family,layoutVariant:chosen.variant,
    portraitLayout:portrait,landscapeLayout:landscape,
    background:chosen.family==='cuaderno'?'white-soft-paper':
      ['redNodos','lineaTiempo','cascada','constelacion'].includes(chosen.family)?'ivory-subtle-grid':'ivory-clean',
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
    events:[{id:'hero-entry',target:'hero',kind:'hero-entry',start:.07,duration:.25,
      seed:13,color:input.color,count:4,size:.55,opacity:.35,intensity:'discreto'},
      ...supportsPlan.map((s,index)=>({id:`support-${index}-entry`,target:s.slotId,
        kind:'support-entry' as const,start:s.enter,duration:.15,seed:index+17,color:input.color,
        count:3,size:.45,opacity:.34,intensity:'discreto' as const}))],
    hero:{assetId:hero.curated.assetId,sha256:hero.asset.sha256,...heroTiming},
    supports:supportsPlan,layers:planLayers,relations,
    beats:[{id:'establish',start:0,end:.31},{id:'develop',start:.31,end:.62},
      {id:'read',start:.62,end:.91}],
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
  const sceneSpec:VisualSceneSpecV2={...base,presentationProfile:EDITORIAL_LOCAL_BANK_V2,
    visualMode:'asset-led',direccion:{...base.direccion,estructura:chosen.family},
    layout:portrait,text:{...base.text,...input.headline,alignment:portrait.textAlignment},
    slots:[slot('hero',hero,'complex-illustration'),
      ...supports.map((asset,index)=>slot(EDITORIAL_LOCAL_SUPPORT_IDS_V2[index],asset,'simple-icon'))],
    editorialBankV2:plan}
  const renderBindings:RenderBindingsV2={version:2,assets:[{slotId:'hero',assetId:hero.asset.id,
      relativeFile:hero.asset.relativeFile},
    ...supports.map((asset,index)=>({slotId:EDITORIAL_LOCAL_SUPPORT_IDS_V2[index],
      assetId:asset.asset.id,relativeFile:asset.asset.relativeFile})),
    ...layers.map(({slotId,asset})=>({slotId,assetId:asset.asset.id,
      relativeFile:asset.asset.relativeFile}))]}
  validateVisualSceneSpecV2(sceneSpec)
  validateRenderBindingsAny(renderBindings,sceneSpec)
  const graphicData:Record<string,any>={...input.template.graphicData,
    extra:{...input.template.graphicData.extra,sceneSpec}}
  return {sceneSpec,renderBindings,graphicData,
    pixelIdentity:sceneSpecPixelIdentityAny(sceneSpec),titleAccent:color,
    selectionReason:chosen.reason}
}

export { editorialHeadlineFromLocalTextV1 }
