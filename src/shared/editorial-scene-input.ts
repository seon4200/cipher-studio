/** One clock for request, semantic windows and timeline slots. No media is changed here. */
export function editorialPhraseWindow(segments: readonly {start:number;end:number}[], index:number, audioDuration:number) {
  const segment=segments[index], next=segments[index+1]?.start
  const start=segment.start
  const end=Math.min(audioDuration,typeof next==='number'&&next>start?next:segment.end)
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error('EDITORIAL_INVALID_VOICE_WINDOW')
  const duration=end-start
  return {start,end,duration,count:duration>4?Math.ceil(duration/3):1}
}

export function editorialSlotWindow(start:number,durations:readonly number[],index:number) {
  if(!Number.isFinite(start)||index<0||index>=durations.length||durations.some(d=>!Number.isFinite(d)||d<=0))
    throw Error('EDITORIAL_INVALID_SLOT_WINDOW')
  const begin=start+durations.slice(0,index).reduce((sum,d)=>sum+d,0)
  return {start:begin,end:begin+durations[index]}
}

/** Cover, then crop: unlike orientation-only branching this works for 2:3, square
 * and ultrawide sources. FFmpeg derives dimensions from the decoded stream. */
export function stockCoverFilter(aspectRatio:string) {
  const [w,h]=['9:16','vertical'].includes(aspectRatio)?[1080,1920]:[1920,1080]
  return `scale=${w}:${h}:force_original_aspect_ratio=increase:force_divisible_by=2,crop=${w}:${h},setsar=1,setpts=0.8*PTS`
}

/** A missing emphasis is not permission to promote the first token (e.g. "de").
 * Use the complete proposition as the editable headline instead. */
export function editorialHeadlineForScene(text:string,emphasis?:string) {
  const phrase=text.trim(), term=emphasis?.trim()??''
  if(!phrase)throw Error('EDITORIAL_HEADLINE_SOURCE_MISSING')
  const at=term?phrase.toLocaleLowerCase('es').indexOf(term.toLocaleLowerCase('es')):-1
  const boundaries=at>=0&&(!at||/[^\p{L}\p{N}]/u.test(phrase[at-1]))&&
    (at+term.length===phrase.length||/[^\p{L}\p{N}]/u.test(phrase[at+term.length]))
  if(!boundaries||term.split(/\s+/u).length===1&&term.length<4)
    return {keyword:phrase}
  return {connector:phrase.slice(0,at).trim()||undefined,keyword:phrase.slice(at,at+term.length),
    closing:phrase.slice(at+term.length).trim()||undefined}
}
