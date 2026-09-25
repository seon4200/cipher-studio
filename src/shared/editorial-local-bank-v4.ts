import { EDITORIAL_LOCAL_BANK_V2, validateEditorialLocalBankPlanV2 } from './editorial-local-bank-v2'
import { EDITORIAL_LOCAL_CATALOG_REVISION_V3, type EditorialLocalBankPlanV3 } from './editorial-local-bank-v3'

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
}

export type EditorialLocalBankPlanV4 = Omit<EditorialLocalBankPlanV3,'revision'> & {
  revision: typeof EDITORIAL_LOCAL_BANK_V4.revision
  sceneDecision: EditorialLocalSceneDecisionV4
  /** Absent in already persisted V4 scenes; preserve their original label pixels. */
  supportLabelSize?: 'mobile-readable-v1'
}
export type EditorialLocalTextPlanV4 = {
  revision: typeof EDITORIAL_LOCAL_BANK_V4.revision
  sceneDecision: EditorialLocalSceneDecisionV4
}

/** A Visual is not a subtitle track. Keep the timed narration intact in sceneDecision,
 * but show a contiguous, duration-budgeted excerpt so a three-second composition
 * does not demand reading an entire paragraph. Never invent or rewrite words. */
export function editorialVisibleExcerptV4(localText:string,durationSeconds:number):string{
  const firstClause=localText.trim().split(/[;.!?]/u)[0]?.trim()??''
  const words=firstClause.split(/\s+/u).filter(Boolean)
  const budget=durationSeconds<=3.25?7:durationSeconds<=4.5?10:13
  const chosen=words.slice(0,budget)
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
  if(!keys(sceneDecision,['sceneId','localText','anchor','evidence','durationSeconds','selectionReason',
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
  return value as EditorialLocalTextPlanV4
}

export function validateEditorialLocalBankPlanV4(value:unknown):EditorialLocalBankPlanV4 {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('EDITORIAL_LOCAL_V4_PLAN_INVALID')
  const {sceneDecision,backgroundAsset,supportLabelSize,...common}=value as EditorialLocalBankPlanV4
  if(common.revision!==EDITORIAL_LOCAL_BANK_V4.revision||common.catalogRevision!==EDITORIAL_LOCAL_CATALOG_REVISION_V3||
    !sceneDecision)
    throw new Error('EDITORIAL_LOCAL_V4_SCENE_DECISION_INVALID')
  validateEditorialLocalSceneDecisionV4(sceneDecision)
  if(supportLabelSize!==undefined&&supportLabelSize!=='mobile-readable-v1')
    throw new Error('EDITORIAL_LOCAL_V4_SUPPORT_LABEL_SIZE_INVALID')
  validateEditorialLocalBankPlanV2({...common,revision:EDITORIAL_LOCAL_BANK_V2.revision,
    catalogRevision:'editorial-modular-catalog-2026-09-v1'},
  {allowMissingFront:true,allowMissingRear:true,minimumSupports:0})
  if(backgroundAsset&&(!/^[a-z0-9][a-z0-9-]{2,95}$/.test(backgroundAsset.assetId)||
    !/^[a-f0-9]{64}$/.test(backgroundAsset.sha256)))throw new Error('EDITORIAL_LOCAL_V4_BACKGROUND_INVALID')
  return value as EditorialLocalBankPlanV4
}
