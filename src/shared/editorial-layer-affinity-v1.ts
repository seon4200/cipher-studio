/** Metadata-only layer compatibility rules for the current editorial decision path.
 * These rules are evidence gates, not claims that textual metadata replaces
 * inspection of the raster itself. */
export type EditorialAffinityMetadataV1={
  assetId?:unknown
  role?:unknown
  semanticFamily?:unknown
  compatibleRelations?:unknown
  surfaceProfile?:unknown
}

const broad=new Set([
  'editorial','collage','paper','paperwork','neutral','reading','background','hero','support',
  'object','asset','image','icon','surface','layer','accent','mask','visual','general','field','sheet',
  'full','fieldwork','laboratory','science','measurement','analysis','sample','record','data','process',
  'system','concept','idea','content','texture','material','information','document','design','graphic',
  'visualization','illustration','color','colour','element','composition','editorial'
])
const genericPhrases=new Set(['editorial collage','neutral background','editorial reading',
  'hero backing accent','continuous filled','paper texture','background surface'])
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLocaleLowerCase('es').replace(/[^a-z0-9]+/gu,' ').trim()
const tokens=(value:string)=>normalize(value).split(/\s+/u).filter(Boolean)
const values=(value:unknown):string[]=>Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):
  typeof value==='string'?[value]:[]
const semanticTags=(value:EditorialAffinityMetadataV1)=>[
  ...values(value.semanticFamily),...values(value.compatibleRelations)
].map(normalize).filter(tag=>Boolean(tag)&&!genericPhrases.has(tag))

/** Exact semantic tags, or a shared multi-token technical phrase, are meaningful.
 * A lone broad token (e.g. "sample", "data" or "analysis") never authorizes a layer. */
export function editorialMetadataAffinityV1(left:EditorialAffinityMetadataV1,
  right:EditorialAffinityMetadataV1):boolean{
  const a=semanticTags(left),b=semanticTags(right)
  if(a.some(tag=>b.includes(tag)))return true
  return a.some(leftTag=>b.some(rightTag=>{
    const leftWords=tokens(leftTag),rightWords=tokens(rightTag)
    for(let size=Math.min(leftWords.length,rightWords.length);size>=2;size--){
      for(let start=0;start+size<=leftWords.length;start++){
        const phrase=leftWords.slice(start,start+size).join(' ')
        if(!genericPhrases.has(phrase)&&rightWords.some((_,rightStart)=>
          rightWords.slice(rightStart,rightStart+size).join(' ')===phrase))return true
      }
    }
    const common=leftWords.filter(word=>rightWords.includes(word)&&!broad.has(word))
    return common.some(word=>word.length>=11)
  }))
}

/** A layer may directly support a validated concept through its explicit
 * compatibleRelations. Free-form descriptions and title overlap are not proof. */
export function editorialLayerConceptAffinityV1(layer:EditorialAffinityMetadataV1,
  concepts:readonly string[]):boolean{
  const relations=values(layer.compatibleRelations).map(normalize)
  return concepts.some(concept=>{
    const query=normalize(concept)
    if(!query)return false
    const queryWords=tokens(query).filter(word=>!broad.has(word))
    return relations.some(relation=>{
      if(relation===query)return true
      const relationWords=tokens(relation).filter(word=>!broad.has(word))
      const common=queryWords.filter(word=>relationWords.includes(word))
      return common.length>=2||common.some(word=>word.length>=11)
    })
  })
}

/** Only a genuinely generic, continuously filled rear is theme-independent.
 * An "editorial-collage" relation alone is insufficient: thematic papers may
 * also carry that production relation. */
export function editorialGenericRearV1(value:EditorialAffinityMetadataV1):boolean{
  const family=typeof value.semanticFamily==='string'?normalize(value.semanticFamily):''
  return value.role==='rear-collage'&&family==='editorial collage'&&
    value.surfaceProfile==='continuous-filled-v1'
}
