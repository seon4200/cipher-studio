// Local evidence only; never writes to source projects or catalog.
const fs=require('node:fs'),path=require('node:path')
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),out=process.argv[3],cases=[]
for(const source of input.sources){
  const state=JSON.parse(fs.readFileSync(path.join(source.project,'project-state.json'),'utf8'))
  const review=JSON.parse(fs.readFileSync(source.review,'utf8'))
  for(const id of source.clipIds){
    const clip=state.timelineVideoClips.find(c=>c.id===id)
    if(!clip)throw Error('MISSING_CLIP:'+id)
    const spec=clip.visualRegeneration.graphicData.extra.sceneSpec
    const old=(spec.editorialBankV2??spec.editorialTextV4).sceneDecision
    const p=old.planning
    const segments=state.transcriptSegments
    const overlapping=segments.map((s,i)=>({s,i})).filter(({s})=>s.end>p.start&&s.start<p.end)
    const lo=Math.max(0,overlapping[0].i-1),hi=Math.min(segments.length-1,overlapping.at(-1).i+1)
    const context=segments.slice(lo,hi+1).map(s=>s.text.trim()).join(' ')
    const duration=clip.visualRegeneration.duration
    if(!Number.isFinite(duration)||duration<=0||Math.abs(duration-(p.end-p.start))>.001)
      throw Error('SOURCE_INTERVAL_DURATION_MISMATCH:'+id)
    cases.push({id:source.name+'-'+id,duration,timelineDuration:clip.durationSeconds,
      before:review.rows.find(c=>c.id===id),
      sourceProject:source.project,semantic:{version:1,sceneId:source.name+'-'+id,start:p.start,end:p.end,
        localText:p.intervalText,localTokens:[],concepts:[],globalHints:[],directEvidence:[],globalText:context,
        globalContextRef:`transcript:${lo}-${hi}; original:${p.start}-${p.end}`}})
  }
}
// Holdout is frozen before any real request, not used to patch topic-specific rules.
const holdout='En el taller, los vecinos reparan aparatos para que duren más. Compartir herramientas reduce lo que cada familia necesita comprar.'
cases.push({id:'natural-holdout',duration:7,conditions:'decision-only; no recorded narration',semantic:{version:1,
  sceneId:'natural-holdout',start:0,end:7,localText:holdout,localTokens:[],concepts:[],globalHints:[],directEvidence:[],globalText:holdout,globalContextRef:'heldout:complete'}})
fs.writeFileSync(out,JSON.stringify(cases,null,2))
console.log(cases.map(c=>({id:c.id,interval:[c.semantic.start,c.semantic.end],text:c.semantic.localText,context:c.semantic.globalText})))
