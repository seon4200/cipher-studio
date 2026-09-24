import { createEditorialModularFamilyLayoutV1,
  type EditorialModularFamiliesPlanV1, type EditorialRelationV1 } from './editorial-modular-families-v1'
import type { VisualLayoutV4 } from './visual-layout-v4'

/** A separate, opt-in pixel revision. The six V1 family layouts remain frozen. */
export const EDITORIAL_FINISH_V1_1 = Object.freeze({
  id: 'editorial-modular-finish-v1-1' as const,
  revision: 'editorial-modular-finish-2026-09-v1-1' as const,
})
export type FinishIntensity = 'off' | 'discreto' | 'enfasis'
export type FinishFont = 'Fraunces' | 'Instrument Serif' | 'Bricolage Grotesque'
export const EDITORIAL_FINISH_FONT_SHA_V11:Record<FinishFont,string>={
  Fraunces:'177FF6C0F14E5550A3C624247CD1189611D4EB65D000B14944C63D967958ABBB',
  'Instrument Serif':'498EFD461F6DDFCB7A111BF9A565709D2085D48201D501EAD960D93E84FFBB88',
  'Bricolage Grotesque':'413E7357809DDD12FD80A96A8A396DE0E401638D4ACD3CB3E37532F0472AC682',
}
export const EDITORIAL_FINISH_BODY_FONT_SHA_V11='8CD08D97E89C24D0AA92EDD2F0F4C8EE6195EEE9B7C9F154865A58B02F0C1C0D'
export const EDITORIAL_FINISH_LABEL_FONT_SHA_V11='5B250217DC0E52E8A967987FEF751CC5B9F794B43D3E91E72E95B22CEC9053A4'
export type FinishRepresentation = 'arrow' | 'dotted' | 'dot-flow' | 'light-pulse' | 'accent-link'
export type FinishResponse = 'none' | 'accent' | 'halo' | 'pulse' | 'scale'
export type FinishRoute = { geometry: 'straight' | 'curve' | 'elbow'; points: { x: number; y: number }[] }
export type FinishRelation = {
  relationIndex: number
  from: EditorialRelationV1['from']
  to: EditorialRelationV1['to']
  meaning: EditorialRelationV1['meaning']
  representation: FinishRepresentation
  response: FinishResponse
  portrait: FinishRoute
  landscape: FinishRoute
  color: string
  start: number
  arrival: number
  end: number
}
export type FinishEvent = {
  id: string
  target: 'hero' | 'support-1' | 'support-2' | 'support-3' | 'support-4'
  kind: 'hero-entry' | 'support-entry' | 'arrival'
  start: number
  duration: number
  seed: number
  color: string
  count: number
  size: number
  opacity: number
  intensity: FinishIntensity
}
export type EditorialFinishPlanV11 = {
  revision: typeof EDITORIAL_FINISH_V1_1.revision
  composition: 'base' | 'focus'
  portraitLayout: VisualLayoutV4
  landscapeLayout: VisualLayoutV4
  typography: { display: FinishFont; weight: number; body: 'DM Sans'; label: 'IBM Plex Sans Condensed';
    displaySha256:string;bodySha256:string;labelSha256:string }
  colors: { headline: string; keyword: string; body: string; effects: string }
  localIntensity: FinishIntensity
  ambientIntensity: FinishIntensity
  events: FinishEvent[]
  relations: FinishRelation[]
}
type Point = { x: number; y: number }
type Rect = { x: number; y: number; width: number; height: number }
/** A second composition per family: no new family, no per-asset coordinates. */
export function createEditorialFinishLayoutV11(base:VisualLayoutV4,
  orientation:'portrait'|'landscape',variant:'base'|'focus'):VisualLayoutV4 {
  if(variant==='base')return base
  const landscape=orientation==='landscape'
  const r=(x:number,y:number,width:number,height:number):Rect=>({x,y,width,height})
  const map:Record<string,{text:Rect;hero:Rect;supports:Rect[]}>=landscape?{
    marcoPoster:{text:r(8,8,44,27),hero:r(34,28,48,61),supports:[r(4,48,16,17),r(21,72,16,17),r(83,12,15,17),r(83,72,15,17)]},
    editorial:{text:r(13,18,74,63),hero:r(0,0,1,1),supports:[]},
    partidoVertical:{text:r(8,9,42,26),hero:r(54,19,34,65),supports:[r(6,49,17,18),r(26,49,17,18),r(6,73,17,18),r(26,73,17,18)]},
    cuaderno:{text:r(8,70,41,22),hero:r(36,12,44,57),supports:[r(5,7,17,15),r(23,7,17,15),r(81,34,16,16),r(81,74,16,16)]},
    constelacion:{text:r(8,10,33,26),hero:r(53,27,35,59),supports:[r(42,4,16,17),r(82,5,16,17),r(41,76,16,17),r(83,77,16,17)]},
    cascada:{text:r(8,11,31,42),hero:r(38,17,31,53),supports:[r(72,7,22,17),r(68,31,22,17),r(64,55,22,17),r(60,78,22,15)]},
  }:{
    marcoPoster:{text:r(9,7,82,23),hero:r(17,38,66,48),supports:[r(4,33,17,13),r(79,33,17,13),r(4,72,17,13),r(79,72,17,13)]},
    editorial:{text:r(12,18,76,63),hero:r(0,0,1,1),supports:[]},
    partidoVertical:{text:r(8,12,44,32),hero:r(49,30,44,56),supports:[r(5,49,22,12),r(5,63,22,12),r(5,77,22,12),r(28,77,18,12)]},
    cuaderno:{text:r(9,8,82,21),hero:r(36,34,54,54),supports:[r(4,34,22,13),r(4,49,22,13),r(4,64,22,13),r(4,79,22,13)]},
    constelacion:{text:r(8,8,84,20),hero:r(32,37,43,49),supports:[r(5,32,19,16),r(5,67,19,16),r(77,32,19,16),r(77,70,19,16)]},
    cascada:{text:r(8,8,84,20),hero:r(24,32,52,33),supports:[r(3,70,21,16),r(27,72,21,16),r(51,74,21,16),r(75,76,21,16)]},
  }
  const config=map[base.family]
  if(!config)throw new Error('EDITORIAL_FINISH_FAMILY_NOT_SUPPORTED')
  return {...base,textBounds:config.text,slotLayouts:base.slotLayouts.map(slot=>({
    ...slot,envelope:slot.slotId==='hero'?config.hero:
      config.supports[Number(String(slot.slotId).slice(-1))-1]??slot.envelope,
  }))}
}
const inflate = (r: Rect, n: number): Rect => ({ x: r.x - n, y: r.y - n, width: r.width + 2*n, height: r.height + 2*n })
const contains = (r: Rect,p: Point) => p.x > r.x && p.x < r.x+r.width && p.y > r.y && p.y < r.y+r.height
const lerp = (a: Point,b: Point,t:number): Point => ({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t})
function clear(points: readonly Point[], obstacles: readonly Rect[]): boolean {
  for(let j=1;j<points.length;j++) {
    const a=points[j-1],b=points[j]
    for(let i=0;i<=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*2);i++) {
      const p=lerp(a,b,i/Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*2)))
      if(p.x<2||p.x>98||p.y<2||p.y>98||obstacles.some(r=>contains(r,p))) return false
    }
  }
  return true
}
function target(layout:VisualLayoutV4,id:string,landscape:boolean):Rect {
  const r=layout.slotLayouts.find(s=>s.slotId===id)?.envelope
  if(!r) throw new Error('EDITORIAL_FINISH_ROUTE_ENDPOINT_MISSING:'+id)
  // V1 uses the optical Hero region, not the full transparent collage envelope.
  if(id==='hero')return {x:r.x+r.width*.19,y:r.y+r.height*.17,width:r.width*.62,height:r.height*.66}
  // Match the actual card geometry in EditorialModularFamiliesV1. An envelope
  // can be much wider than the visible icon, particularly in landscape.
  const ratio=landscape?.5625:1.7778
  const height=Math.min(r.height*.7,r.width*.84/ratio),width=height*ratio
  return {x:r.x+(r.width-width)/2,y:r.y+r.height*.43-height/2,width,height}
}
function anchors(r:Rect,id:string):Point[] {const gap=id==='hero'?.7:.35;const values=[
  {x:r.x+r.width/2,y:r.y-gap},{x:r.x+r.width+gap,y:r.y+r.height/2},
  {x:r.x+r.width/2,y:r.y+r.height+gap},{x:r.x-gap,y:r.y+r.height/2},
];return id==='hero'?values:[values[0],values[1],values[3]]}
/** Bounded routing; an obstructed relation is an error, never an optimistic line. */
export function routeEditorialFinishV11(layout:VisualLayoutV4,fromId:string,toId:string,
  landscape=false):FinishRoute {
  const from=target(layout,fromId,landscape),to=target(layout,toId,landscape)
  const obstacles=[inflate(layout.textBounds,1.1),...layout.slotLayouts
    .filter(s=>s.slotId!==fromId&&s.slotId!==toId).map(s=>inflate(s.envelope,1.25)),
    ...layout.slotLayouts.filter(s=>(s.slotId===fromId||s.slotId===toId)&&s.slotId!=='hero')
      .map(s=>inflate({x:s.envelope.x,y:s.envelope.y+s.envelope.height*.68,
        width:s.envelope.width,height:s.envelope.height*.32},.5))]
  const candidates:FinishRoute[]=[]
const clampChannel=(n:number)=>Math.max(2.5,Math.min(97.5,n))
  const channelsX=[2.5,97.5,...obstacles.flatMap(r=>[clampChannel(r.x-.55),
    clampChannel(r.x+r.width+.55)])]
  const channelsY=[2.5,97.5,...obstacles.flatMap(r=>[clampChannel(r.y-.55),
    clampChannel(r.y+r.height+.55)])]
  for(const a of anchors(from,fromId)) for(const b of anchors(to,toId)) {
    candidates.push({geometry:'straight',points:[a,b]})
    for(const bend of [-7,-4,0,4,7]) {
      const mid=(a.x+b.x)/2+bend
      candidates.push({geometry:'elbow',points:[a,{x:mid,y:a.y},{x:mid,y:b.y},b]})
      const ymid=(a.y+b.y)/2+bend
      candidates.push({geometry:'elbow',points:[a,{x:a.x,y:ymid},{x:b.x,y:ymid},b]})
      const control1={x:a.x+(b.x-a.x)*.35,y:a.y+bend}
      const control2={x:a.x+(b.x-a.x)*.65,y:b.y+bend}
      const curve=Array.from({length:25},(_,i)=>{
        const t=i/24,v=1-t
        return {x:v*v*v*a.x+3*v*v*t*control1.x+3*v*t*t*control2.x+t*t*t*b.x,
          y:v*v*v*a.y+3*v*v*t*control1.y+3*v*t*t*control2.y+t*t*t*b.y}
      })
      candidates.push({geometry:'curve',points:curve})
    }
    for(const y of channelsY)candidates.push({geometry:'elbow',points:[a,{x:a.x,y},
      {x:b.x,y},b]})
    for(const x of channelsX)candidates.push({geometry:'elbow',points:[a,{x,y:a.y},
      {x,y:b.y},b]})
  }
  const score=(route:FinishRoute)=>route.points.slice(1).reduce((sum,p,i)=>
    sum+Math.hypot(p.x-route.points[i].x,p.y-route.points[i].y),0)+
    (route.geometry==='straight'?0:route.geometry==='curve'?1.5:3)
  let available=candidates.filter(c=>clear(c.points,obstacles))
  if(!available.length){
    // A source/destination can be trapped behind different obstacles. A
    // five-segment outer channel is still preferable to an unverified curve.
    for(const a of anchors(from,fromId))for(const b of anchors(to,toId))
      for(const x1 of channelsX)for(const y of channelsY)for(const x2 of channelsX){
        if(Math.abs(x1-x2)<1)continue
        const candidate:FinishRoute={geometry:'elbow',points:[a,{x:x1,y:a.y},{x:x1,y},
          {x:x2,y},{x:x2,y:b.y},b]}
        if(clear(candidate.points,obstacles))available.push(candidate)
      }
  }
  available.sort((a,b)=>score(a)-score(b))
  const direct=Math.hypot(to.x+to.width/2-from.x-from.width/2,
    to.y+to.height/2-from.y-from.height/2)
  if(!available.length||score(available[0])>direct*1.7+12)
    throw new Error('EDITORIAL_FINISH_ROUTE_BLOCKED:'+fromId+'>'+toId)
  return available[0]
}
const hex=(value:string)=>/^#[0-9A-F]{6}$/.test(value)
const luminance=(value:string)=>{
  const channels=[1,3,5].map(start=>parseInt(value.slice(start,start+2),16)/255)
    .map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4)
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722
}
const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b)
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
const finite01=(value:number)=>Number.isFinite(value)&&value>=0&&value<=1
const exact=(value:unknown,keys:readonly string[])=>!!value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).sort().join('|')===keys.slice().sort().join('|')
export function validateEditorialFinishV11(value:unknown,base:EditorialModularFamiliesPlanV1,
  portrait:VisualLayoutV4):EditorialFinishPlanV11 {
  if(!exact(value,['revision','composition','portraitLayout','landscapeLayout','typography','colors','localIntensity','ambientIntensity','events','relations']))
    throw new Error('EDITORIAL_FINISH_SHAPE_INVALID')
  const v=value as EditorialFinishPlanV11
  if(v.revision!==EDITORIAL_FINISH_V1_1.revision||!['base','focus'].includes(v.composition)||
    JSON.stringify(v.portraitLayout)!==JSON.stringify(portrait)||
    JSON.stringify(v.portraitLayout)!==JSON.stringify(createEditorialFinishLayoutV11(
      // Recreate V1's certified orientation independently of the supplied scene layout.
      createEditorialModularFamilyLayoutV1(base.family,'portrait',base.supports.length,base.layoutVariant),
      'portrait',v.composition))||
    JSON.stringify(v.landscapeLayout)!==JSON.stringify(createEditorialFinishLayoutV11(
      base.landscapeLayout,'landscape',v.composition))||
    !exact(v.typography,['display','weight','body','label','displaySha256','bodySha256','labelSha256'])||
    !['Fraunces','Instrument Serif','Bricolage Grotesque'].includes(v.typography.display)||
    ![400,500,600,650,700].includes(v.typography.weight)||v.typography.body!=='DM Sans'||
    v.typography.label!=='IBM Plex Sans Condensed'||
    v.typography.displaySha256!==EDITORIAL_FINISH_FONT_SHA_V11[v.typography.display]||
    v.typography.bodySha256!==EDITORIAL_FINISH_BODY_FONT_SHA_V11||
    v.typography.labelSha256!==EDITORIAL_FINISH_LABEL_FONT_SHA_V11||
    !exact(v.colors,['headline','keyword','body','effects'])||
    !Object.values(v.colors).every(hex)||
    contrast(v.colors.headline,base.paper)<4.5||contrast(v.colors.body,base.paper)<4.5||
    contrast(v.colors.keyword,base.paper)<3||contrast(v.colors.effects,base.paper)<2||
    !['off','discreto','enfasis'].includes(v.localIntensity)||
    !['off','discreto','enfasis'].includes(v.ambientIntensity)||
    !Array.isArray(v.events)||!Array.isArray(v.relations)||v.relations.length!==base.relations.length)
    throw new Error('EDITORIAL_FINISH_INVALID')
  for(const e of v.events){
    if(!exact(e,['id','target','kind','start','duration','seed','color','count','size','opacity','intensity'])||
      !/^[-a-z0-9]+$/.test(e.id)||
      !(['hero',...base.supports.map(s=>s.slotId)] as string[]).includes(e.target)||
      !['hero-entry','support-entry','arrival'].includes(e.kind)||!finite01(e.start)||
      !Number.isFinite(e.duration)||e.duration<=0||e.start+e.duration>1||
      !Number.isInteger(e.seed)||!hex(e.color)||!Number.isInteger(e.count)||e.count<0||e.count>8||
      !Number.isFinite(e.size)||e.size<.12||e.size>1.6||
      !finite01(e.opacity)||!['off','discreto','enfasis'].includes(e.intensity))
      throw new Error('EDITORIAL_FINISH_EVENT_INVALID')
  }
  if(new Set(v.events.map(e=>e.id)).size!==v.events.length)throw new Error('EDITORIAL_FINISH_EVENT_DUPLICATE')
  for(const [index,r] of v.relations.entries()){
    const baseRelation=base.relations[index]
    if(!exact(r,['relationIndex','from','to','meaning','representation','response','portrait','landscape','color','start','arrival','end'])||
      r.relationIndex!==index||r.from!==baseRelation.from||r.to!==baseRelation.to||r.meaning!==baseRelation.meaning||
      !['arrow','dotted','dot-flow','light-pulse','accent-link'].includes(r.representation)||
      !['none','accent','halo','pulse','scale'].includes(r.response)||!hex(r.color)||
      !finite01(r.start)||!finite01(r.arrival)||!finite01(r.end)||
      !(r.start<r.arrival&&r.arrival<r.end&&r.end<.85)||
      (r.meaning==='connects'||r.meaning==='compares')&&['dot-flow','light-pulse'].includes(r.representation))
      throw new Error('EDITORIAL_FINISH_RELATION_INVALID')
    for(const route of [r.portrait,r.landscape]){
      if(!exact(route,['geometry','points'])||!['straight','curve','elbow'].includes(route.geometry)||
        !Array.isArray(route.points)||route.points.length<2||route.points.length>30||
        route.points.some(p=>!exact(p,['x','y'])||!Number.isFinite(p.x)||!Number.isFinite(p.y)||
          p.x<2||p.x>98||p.y<2||p.y>98)) throw new Error('EDITORIAL_FINISH_ROUTE_INVALID')
    }
    if(JSON.stringify(r.portrait)!==JSON.stringify(routeEditorialFinishV11(portrait,r.from,r.to))||
       JSON.stringify(r.landscape)!==JSON.stringify(routeEditorialFinishV11(v.landscapeLayout,r.from,r.to,true)))
      throw new Error('EDITORIAL_FINISH_ROUTE_NOT_CERTIFIED')
  }
  return v
}

export function createEditorialFinishV11(base:EditorialModularFamiliesPlanV1,
  portrait:VisualLayoutV4,options:{display?:FinishFont;headline?:string;keyword?:string;body?:string;
    effects?:string;local?:FinishIntensity;ambient?:FinishIntensity;
    representation?:FinishRepresentation|'auto';response?:FinishResponse|'auto';
    composition?:'base'|'focus'}={}):EditorialFinishPlanV11 {
  const composition=options.composition??'base'
  const portraitLayout=createEditorialFinishLayoutV11(portrait,'portrait',composition)
  const landscapeLayout=createEditorialFinishLayoutV11(base.landscapeLayout,'landscape',composition)
  const color=options.effects??base.accent
  const intensity=options.local??'discreto'
  const events:FinishEvent[]=[]
  const add=(target:FinishEvent['target'],kind:FinishEvent['kind'],start:number,index:number)=>{
    if(intensity==='off')return
    events.push({id:`${kind}-${target}-${index}`,target,kind,start:Math.min(.84,start),
      duration:kind==='arrival'?.09:intensity==='enfasis'?.18:.15,
      seed:index*31+base.family.length*17,
      color,count:intensity==='enfasis'?7:5,size:intensity==='enfasis'?1.45:1.2,
      opacity:intensity==='enfasis'?.88:.78,intensity})
  }
  if(base.hero)add('hero','hero-entry',base.hero.enter,0)
  base.supports.forEach((s,i)=>add(s.slotId,'support-entry',s.enter,i+1))
  let previousEnd=0
  const relations=base.relations.map((r,index):FinishRelation=>{
    const directed=['informs','causes','transfers'].includes(r.meaning)
    const representation=options.representation&&options.representation!=='auto'
      ?options.representation:directed?(['arrow','dotted','dot-flow','light-pulse'][index%4] as FinishRepresentation):
        (index%2?'accent-link':'dotted')
    const safeRepresentation=!directed&&['dot-flow','light-pulse'].includes(representation)?'dotted':representation
    const response=options.response&&options.response!=='auto'?options.response:
      (['accent','halo','pulse','scale'][index%4] as FinishResponse)
    const settle=(id:string)=>id==='hero'?base.hero?.settle??0:
      base.supports.find(s=>s.slotId===id)?.settle??0
    const start=Math.max(previousEnd,settle(r.from)+.02,settle(r.to)+.02)
    const arrival=start+.04,end=arrival+.035
    previousEnd=end
    if(intensity!=='off')add(r.to,'arrival',arrival,index+10)
    return {relationIndex:index,from:r.from,to:r.to,meaning:r.meaning,
      representation:safeRepresentation,response,
      portrait:routeEditorialFinishV11(portraitLayout,r.from,r.to),
      landscape:routeEditorialFinishV11(landscapeLayout,r.from,r.to,true),
      color,start,arrival,end}
  })
  const display=options.display??'Fraunces'
  const weight=display==='Instrument Serif'?400:display==='Bricolage Grotesque'?700:650
  const result:EditorialFinishPlanV11={revision:EDITORIAL_FINISH_V1_1.revision,composition,
    portraitLayout,landscapeLayout,
    typography:{display,weight,body:'DM Sans',label:'IBM Plex Sans Condensed',
      displaySha256:EDITORIAL_FINISH_FONT_SHA_V11[display],bodySha256:EDITORIAL_FINISH_BODY_FONT_SHA_V11,
      labelSha256:EDITORIAL_FINISH_LABEL_FONT_SHA_V11},
    // The approved teal is suitable for the image/effects, but not for small
    // antialiased headline edges on ivory. Freeze its darker text role in the
    // opt-in spec; an explicit user choice is never silently replaced.
    colors:{headline:options.headline??base.ink,
      keyword:options.keyword??(base.accent==='#238C87'?'#176A66':base.accent),
      body:options.body??base.ink,effects:color},localIntensity:intensity,
    ambientIntensity:options.ambient??(base.family==='editorial'?'off':'discreto'),events,relations}
  return validateEditorialFinishV11(result,base,portraitLayout)
}
