import { EDITORIAL_LOCAL_FAMILIES_V3 } from './editorial-local-bank-v3'

/** Internal decision revision in the existing V4 route; never rewrites saved plans. */
export const EDITORIAL_DECISION_V2 = 'editorial-scene-decision-2026-09-v2' as const
export const EDITORIAL_RELATION_MEANING = {
  conecta:'connects',contrasta:'compares',informa:'informs',causa:'causes',transfiere:'transfers',
} as const
export type EditorialDirectionV2 = {
  revision:typeof EDITORIAL_DECISION_V2
  intent:'object'|'components'|'relation'|'process'|'statement'
  family:typeof EDITORIAL_LOCAL_FAMILIES_V3[number]
  variant:'base'|'inverse'
  entry:'text-first'|'hero-first'|'supports-first'|'word-first'
  background:'ivory-clean'|'ivory-subtle-grid'|'white-soft-paper'
  relations:{fromId:string;toId:string;relation:keyof typeof EDITORIAL_RELATION_MEANING;quote:string;reason:string}[]
  reason:string
}
export function validateEditorialDirectionV2(value:EditorialDirectionV2,heroId:string|null,supportIds:readonly string[]):void{
  const exact=(v:unknown,fields:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&
    Object.keys(v).sort().join('|')===fields.sort().join('|')
  if(!value||value.revision!==EDITORIAL_DECISION_V2||
    !exact(value,['revision','intent','family','variant','entry','background','relations','reason'])||
    !['object','components','relation','process','statement'].includes(value.intent)||
    !EDITORIAL_LOCAL_FAMILIES_V3.includes(value.family)||!['base','inverse'].includes(value.variant)||
    !['text-first','hero-first','supports-first','word-first'].includes(value.entry)||
    !['ivory-clean','ivory-subtle-grid','white-soft-paper'].includes(value.background)||
    typeof value.reason!=='string'||!value.reason.trim()||!Array.isArray(value.relations)||value.relations.length>4)
    throw Error('EDITORIAL_DIRECTION_INVALID')
  if(!heroId&&(supportIds.length||value.family!=='editorial'||value.relations.length))
    throw Error('EDITORIAL_DIRECTION_TYPE_LED_INVALID')
  if((value.entry==='supports-first'&&!supportIds.length)||(value.entry==='hero-first'&&!heroId))
    throw Error('EDITORIAL_DIRECTION_ENTRY_MISSING_ACTOR')
  if((['constelacion','cascada'].includes(value.family)&&supportIds.length<2)||
    (value.family==='cascada'&&value.intent!=='process'))throw Error('EDITORIAL_DIRECTION_NOT_ELIGIBLE')
  const ids=[heroId,...supportIds],pairs=new Set<string>()
  for(const edge of value.relations){
    if(!exact(edge,['fromId','toId','relation','quote','reason']))throw Error('EDITORIAL_DIRECTION_RELATION_SHAPE')
    const pair=[edge.fromId,edge.toId].join('>')
    if(!ids.includes(edge.fromId)||!ids.includes(edge.toId)||edge.fromId===edge.toId||pairs.has(pair)||
      !Object.prototype.hasOwnProperty.call(EDITORIAL_RELATION_MEANING,edge.relation)||
      typeof edge.quote!=='string'||!edge.quote.trim()||typeof edge.reason!=='string'||!edge.reason.trim())
      throw Error('EDITORIAL_DIRECTION_RELATION_INVALID')
    pairs.add(pair)
  }
}
