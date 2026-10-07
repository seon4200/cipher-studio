import { EDITORIAL_LOCAL_BANK_V2, validateEditorialLocalBankPlanV2 } from './editorial-local-bank-v2'
import { EDITORIAL_LOCAL_CATALOG_REVISION_V3, type EditorialLocalBankPlanV3 } from './editorial-local-bank-v3'
import { EDITORIAL_DECISION_V2, EDITORIAL_DECISION_V3, EDITORIAL_RELATION_MEANING,
  validateEditorialDirectionCurrent, type EditorialDirectionCurrent } from './editorial-scene-direction'
import { EDITORIAL_FINISH_INTEGRATION_V2, validateEditorialFinishIntegrationV2 } from './editorial-finish-integration-v2'

/** New opt-in product route. Published V2/V3 plans are never rewritten. */
export const EDITORIAL_LOCAL_BANK_V4 = Object.freeze({
  id: 'editorial-local-bank-v4' as const,
  revision: 'editorial-local-bank-2026-09-v4' as const,
})

export type EditorialLocalSceneDecisionV4 = {
  sceneId: string
  localText: string
  anchor: string
  evidence: string[]
  durationSeconds: number
  selectionReason: string
  familyReason: string
  missingTerms: string[]
  colorMode: 'auto' | 'manual'
  seed: number
  /** Only new decisions carry this; saved scenes are neither reselected nor rewritten. */
  planning?: {
    revision:'editorial-scene-selection-2026-09-v1'|typeof EDITORIAL_DECISION_V2|typeof EDITORIAL_DECISION_V3
    start:number;end:number;intervalText:string;neighborContext:string
    proposition:string;visibleText:string;reason:string
    propositionSource?:'interval'|'neighbor-context'
    sourceQuote?:string
    headline?:string
    secondary?:string
    framing?:string
    contextRef?:string
    direction?:EditorialDirectionCurrent
    adjustments?:string[]
    sourceScope?:'interval'|'interval-with-prior-context'
    neighborBefore?:string
    neighborAfter?:string
    layerChoices?:{
      revision:'editorial-layer-selection-2026-09-v1'
      source:'model'
      choices:{
        'rear-collage':{assetId:string|null;reason:string}
        'accent-mask':{assetId:string|null;reason:string}
        background:{assetId:string|null;reason:string}
      }
    }
  }
}

export type EditorialLocalBankPlanV4 = Omit<EditorialLocalBankPlanV3,'revision'> & {
  revision: typeof EDITORIAL_LOCAL_BANK_V4.revision
  /** New scenes only. Missing marker preserves every saved V4 effect and pixel. */
  finishIntegration?: typeof EDITORIAL_FINISH_INTEGRATION_V2
  sceneDecision: EditorialLocalSceneDecisionV4
  /** Absent in already persisted V4 scenes; preserve their original label pixels. */
  supportLabelSize?: 'mobile-readable-v1'
  /** New V4 scenes freeze why a semantic relation was drawn or omitted.
   * Absent on already persisted scenes; those keep their original pixels. */
  relationDecision?: {
    status: 'drawn' | 'omitted'
    reason: 'SCRIPT_CONNECTS' | 'SCRIPT_CONTRASTS' | 'NO_VALID_RELATION' |
      'NO_SCRIPT_EVIDENCE' | 'UNSUPPORTED_RELATION' | 'NO_SUPPORTS' | 'GROUNDED_GRAPH' | 'NO_GROUNDED_EDGES'
    sourceRelation?: 'conecta' | 'contrasta'
  }
}
export type EditorialLocalTextPlanV4 = {
  revision: typeof EDITORIAL_LOCAL_BANK_V4.revision
  sceneDecision: EditorialLocalSceneDecisionV4
}

/** A Visual is not a subtitle track. Keep the timed narration intact in sceneDecision,
 * but show a contiguous, duration-budgeted excerpt so a three-second composition
 * does not demand reading an entire paragraph. Never invent or rewrite words. */
export function editorialVisibleExcerptV4(localText:string,durationSeconds:number,_keyword?:string):string{
  const firstClause=localText.trim().split(/[;.!?]/u)[0]?.trim()??''
  const words=firstClause.split(/\s+/u).filter(Boolean)
  const budget=durationSeconds<=3.25?7:durationSeconds<=4.5?10:13
  const chosen=words.slice(0,budget)
  const omitted=words.slice(budget).join(' ')
  if(/\b(?:no|nunca|jamás|sin|pero|aunque|excepto|salvo|menos|\d[\d.,%]*)\b/iu.test(omitted)){
    // A lone keyword destroys the assertion, its polarity or its quantity. A
    // model-validated reduction may replace this upstream; the fallback is faithful.
    return firstClause||localText.trim()
  }
  if(words.length>budget){
    const conjunction=chosen.findIndex((word,index)=>index>=3&&/^(?:y|ni|pero)$/iu.test(word))
    if(conjunction>=0)chosen.splice(conjunction)
  }
  while(chosen.length>2&&/^(?:y|o|de|del|la|el|un|una|para|con)$/iu.test(chosen[chosen.length-1]))
    chosen.pop()
  return chosen.join(' ').replace(/[,:;]+$/u,'').trim()||localText.trim()
}

const keys=(value:unknown,required:readonly string[])=>!!value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).sort().join('|')===required.slice().sort().join('|')

export function validateEditorialLocalSceneDecisionV4(sceneDecision:EditorialLocalSceneDecisionV4):void{
  const {planning,...historical}=sceneDecision
  const v3=planning?.revision===EDITORIAL_DECISION_V3
  const v2=planning?.revision===EDITORIAL_DECISION_V2||v3
  const optional=v2?['propositionSource','sourceQuote','headline','secondary','framing','contextRef','direction','adjustments',
    ...(v3?['sourceScope','neighborBefore','neighborAfter','layerChoices']:[])]:['propositionSource']
  const planningKeys=planning?Object.fromEntries(Object.entries(planning).filter(([key])=>!optional.includes(key))):undefined
  if(planning!==undefined&&(!keys(planningKeys,['revision','start','end','intervalText','neighborContext',
    'proposition','visibleText','reason'])||!['editorial-scene-selection-2026-09-v1',EDITORIAL_DECISION_V2,EDITORIAL_DECISION_V3].includes(planning.revision)||
    !Number.isFinite(planning.start)||!Number.isFinite(planning.end)||planning.end<=planning.start||
    ['intervalText','neighborContext','proposition','visibleText','reason'].some(key=>
      typeof planning[key as keyof typeof planning]!=='string')))
    throw new Error('EDITORIAL_SCENE_PLANNING_INVALID')
  if(v2&&(typeof planning.sourceQuote!=='string'||!planning.sourceQuote.trim()||
    typeof planning.headline!=='string'||!planning.headline.trim()||typeof planning.secondary!=='string'||
    !['assertion','negation','question','attribution','condition','uncertainty','critique'].includes(planning.framing??'')||
    typeof planning.contextRef!=='string'||!Array.isArray(planning.adjustments)||
    planning.adjustments.some(item=>typeof item!=='string')))
    throw new Error('EDITORIAL_SCENE_MEANING_INVALID')
  if(v3&&(!['interval','interval-with-prior-context'].includes(planning.sourceScope??'')||
    typeof planning.neighborBefore!=='string'||typeof planning.neighborAfter!=='string'))
    throw new Error('EDITORIAL_SCENE_TEMPORAL_SCOPE_INVALID')
  if(planning?.layerChoices!==undefined){
    const layerPlan=planning.layerChoices
    if(!v3||!keys(layerPlan,['revision','source','choices'])||
      layerPlan.revision!=='editorial-layer-selection-2026-09-v1'||layerPlan.source!=='model'||
      !keys(layerPlan.choices,['rear-collage','accent-mask','background']))
      throw new Error('EDITORIAL_SCENE_LAYER_SELECTION_INVALID')
    for(const value of Object.values(layerPlan.choices))if(!keys(value,['assetId','reason'])||
      (value.assetId!==null&&typeof value.assetId!=='string')||typeof value.reason!=='string'||!value.reason.trim())
      throw new Error('EDITORIAL_SCENE_LAYER_CHOICE_INVALID')
  }
  if(planning?.propositionSource!==undefined&&!['interval','neighbor-context'].includes(planning.propositionSource))
    throw new Error('EDITORIAL_SCENE_PROPOSITION_SOURCE_INVALID')
  if(!keys(historical,['sceneId','localText','anchor','evidence','durationSeconds','selectionReason',
      'familyReason','missingTerms','colorMode','seed'])||
    typeof sceneDecision.sceneId!=='string'||!sceneDecision.sceneId||
    typeof sceneDecision.localText!=='string'||typeof sceneDecision.anchor!=='string'||
    !Array.isArray(sceneDecision.evidence)||sceneDecision.evidence.some(item=>typeof item!=='string')||
    !Array.isArray(sceneDecision.missingTerms)||sceneDecision.missingTerms.some(item=>typeof item!=='string')||
    !Number.isFinite(sceneDecision.durationSeconds)||sceneDecision.durationSeconds<=0||
    !['auto','manual'].includes(sceneDecision.colorMode)||!Number.isInteger(sceneDecision.seed)||
    typeof sceneDecision.selectionReason!=='string'||typeof sceneDecision.familyReason!=='string')
    throw new Error('EDITORIAL_LOCAL_V4_SCENE_DECISION_INVALID')
}

export function validateEditorialLocalTextPlanV4(value:unknown):EditorialLocalTextPlanV4{
  if(!keys(value,['revision','sceneDecision'])||
    (value as EditorialLocalTextPlanV4).revision!==EDITORIAL_LOCAL_BANK_V4.revision)
    throw new Error('EDITORIAL_LOCAL_V4_TEXT_PLAN_INVALID')
  validateEditorialLocalSceneDecisionV4((value as EditorialLocalTextPlanV4).sceneDecision)
  const direction=(value as EditorialLocalTextPlanV4).sceneDecision.planning?.direction
  if(direction)validateEditorialDirectionCurrent(direction,null,[])
  return value as EditorialLocalTextPlanV4
}

export function validateEditorialLocalBankPlanV4(value:unknown):EditorialLocalBankPlanV4 {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('EDITORIAL_LOCAL_V4_PLAN_INVALID')
  const {sceneDecision,backgroundAsset,supportLabelSize,relationDecision,finishIntegration,...common}=value as EditorialLocalBankPlanV4
  if(common.revision!==EDITORIAL_LOCAL_BANK_V4.revision||common.catalogRevision!==EDITORIAL_LOCAL_CATALOG_REVISION_V3||
    !sceneDecision)
    throw new Error('EDITORIAL_LOCAL_V4_SCENE_DECISION_INVALID')
  validateEditorialLocalSceneDecisionV4(sceneDecision)
  if(supportLabelSize!==undefined&&supportLabelSize!=='mobile-readable-v1')
    throw new Error('EDITORIAL_LOCAL_V4_SUPPORT_LABEL_SIZE_INVALID')
  if(sceneDecision.planning?.direction&&relationDecision===undefined)
    throw new Error('EDITORIAL_GRAPH_DECISION_REQUIRED')
  if(relationDecision!==undefined){
    const direction=sceneDecision.planning?.direction
    if(direction){
      validateEditorialDirectionCurrent(direction,common.hero.assetId,common.supports.map(s=>s.assetId))
      if(direction.family!==common.family||direction.variant!==common.layoutVariant||direction.entry!==common.entry||
        direction.background!==common.background)throw Error('EDITORIAL_DIRECTION_RENDER_MISMATCH')
      if(!keys(relationDecision,['status','reason'])||
        relationDecision.reason!==(common.relations.length?'GROUNDED_GRAPH':'NO_GROUNDED_EDGES')||
        relationDecision.status!==(common.relations.length?'drawn':'omitted'))throw Error('EDITORIAL_GRAPH_DECISION_INVALID')
      const bySlot=(id:string)=>id==='hero'?common.hero.assetId:common.supports.find(s=>s.slotId===id)?.assetId
      if(common.relations.some(edge=>!direction.relations.some(source=>source.fromId===bySlot(edge.from)&&
        source.toId===bySlot(edge.to)&&EDITORIAL_RELATION_MEANING[source.relation]===edge.meaning)))
        throw Error('EDITORIAL_GRAPH_EDGE_NOT_AUTHORIZED')
    }else{
    const drawn=relationDecision.status==='drawn'
    const expectedReason=relationDecision.sourceRelation==='conecta'?'SCRIPT_CONNECTS':
      relationDecision.sourceRelation==='contrasta'?'SCRIPT_CONTRASTS':null
    if(!keys(relationDecision,drawn?['status','reason','sourceRelation']:['status','reason'])||
      (drawn?relationDecision.reason!==expectedReason||!common.relations.length:
        relationDecision.status!=='omitted'||common.relations.length!==0||
        !['NO_VALID_RELATION','NO_SCRIPT_EVIDENCE','UNSUPPORTED_RELATION','NO_SUPPORTS']
          .includes(relationDecision.reason)))
      throw new Error('EDITORIAL_LOCAL_V4_RELATION_DECISION_INVALID')
    if(drawn&&common.relations.some(relation=>relation.meaning!==
      (relationDecision.sourceRelation==='conecta'?'connects':'compares')))
      throw new Error('EDITORIAL_LOCAL_V4_RELATION_MEANING_INVALID')
    }
  }
  const layerChoices=sceneDecision.planning?.layerChoices?.choices
  if(layerChoices){
    const actual=(role:'rear-collage'|'accent-mask'|'background')=>{
      if(role==='background')return backgroundAsset?.assetId??null
      const id=role==='rear-collage'?'idea-rear':'idea-accent'
      return common.layers.find(layer=>layer.id===id)?.catalogAssetId??null
    }
    for(const role of ['rear-collage','accent-mask','background'] as const)
      if(layerChoices[role].assetId!==actual(role))throw new Error('EDITORIAL_LAYER_DECISION_RENDER_MISMATCH:'+role)
  }
  validateEditorialLocalBankPlanV2({...common,revision:EDITORIAL_LOCAL_BANK_V2.revision,
    catalogRevision:'editorial-modular-catalog-2026-09-v1'},
  {allowMissingFront:true,allowMissingRear:true,allowMissingAccent:true,minimumSupports:0})
  validateEditorialFinishIntegrationV2({...common,finishIntegration})
  if(backgroundAsset&&(!/^[a-z0-9][a-z0-9-]{2,95}$/.test(backgroundAsset.assetId)||
    !/^[a-f0-9]{64}$/.test(backgroundAsset.sha256)))throw new Error('EDITORIAL_LOCAL_V4_BACKGROUND_INVALID')
  return value as EditorialLocalBankPlanV4
}
