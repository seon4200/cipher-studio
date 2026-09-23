import React, { useLayoutEffect, useRef } from 'react'
import type { RuntimeRenderAssetV2, VisualSceneSpecV2 } from '../../../shared/visual-scene-spec-v2'
import type { EditorialModularFamiliesPlanV1 } from '../../../shared/editorial-modular-families-v1'
import { sceneSpecReactKeyAny } from '../../../shared/visual-scene-spec-v2'
import { AlphaMaskRasterV4 } from './alpha-mask-raster-v4'
import { fitVisualTextV2 } from './text-fit-v2'

const clamp=(value:number)=>Math.max(0,Math.min(1,value))
const ease=(value:number)=>1-(1-clamp(value))**3
const phase=(u:number,start:number,end:number)=>ease((u-start)/(end-start))
const cue=(u:number,start:number,end:number)=>u<=start||u>=end?0:
  Math.sin(Math.PI*(u-start)/(end-start))
type Point={x:number;y:number}
type Rect={x:number;y:number;width:number;height:number}
const center=(r:Rect):Point=>({x:r.x+r.width/2,y:r.y+r.height/2})
// The layout envelope includes transparent margins and collage. Lines must reach
// the visible subject, not stop at the edge of that oversized envelope.
const relationTarget=(r:Rect):Rect=>({x:r.x+r.width*.19,y:r.y+r.height*.17,
  width:r.width*.62,height:r.height*.66})
const supportTarget=(r:Rect,landscape:boolean,alpha?:Rect):Rect=>{
  const height=Math.min(r.height*.7,r.width*.84/(landscape ? 0.5625 : 1.7778))
  const width=height*(landscape ? 0.5625 : 1.7778)
  const card={x:r.x+(r.width-width)/2,y:r.y+r.height*.43-height/2,width,height}
  return alpha?{x:card.x+card.width*alpha.x,y:card.y+card.height*alpha.y,
    width:card.width*alpha.width,height:card.height*alpha.height}:card
}
function edge(from:Rect,to:Rect):Point {
  const a=center(from),b=center(to),dx=b.x-a.x,dy=b.y-a.y
  const ratio=Math.min(Math.abs(dx)>0?from.width*.48/Math.abs(dx):Infinity,
    Math.abs(dy)>0?from.height*.48/Math.abs(dy):Infinity)
  return {x:a.x+dx*ratio,y:a.y+dy*ratio}
}
type CubicRoute={path:string;tip:Point;points:[Point,Point,Point,Point]}
const cubicPoint=(points:CubicRoute['points'],t:number):Point=>{
  const q=clamp(t),v=1-q,[a,b,c,d]=points
  return {x:v*v*v*a.x+3*v*v*q*b.x+3*v*q*q*c.x+q*q*q*d.x,
    y:v*v*v*a.y+3*v*v*q*b.y+3*v*q*q*c.y+q*q*q*d.y}
}
function route(from:Rect,to:Rect,obstacles:readonly Rect[]=[],supportToSupport=false):CubicRoute {
  let a=edge(from,to),b=edge(to,from)
  if(supportToSupport&&Math.abs(center(to).y-center(from).y)>
      Math.abs(center(to).x-center(from).x)*.75){
    const side=center(to).x>=center(from).x?1:-1
    a={x:center(from).x+side*from.width*.55,y:center(from).y}
    b={x:center(to).x-side*to.width*.55,y:center(to).y}
  }
  const dx=b.x-a.x,dy=b.y-a.y
  const bend=Math.min(6,Math.max(2,Math.abs(dx)+Math.abs(dy))*.08)
  const horizontal=Math.abs(dx)>=Math.abs(dy)
  const candidates=[0,-bend,bend,-bend*2,bend*2,-bend*3,bend*3].map(offset=>{
    const c1=horizontal?{x:a.x+dx*.42,y:a.y+offset}:{x:a.x+offset,y:a.y+dy*.42}
    const c2=horizontal?{x:a.x+dx*.58,y:b.y+offset}:{x:b.x+offset,y:a.y+dy*.58}
    const points:[Point,Point,Point,Point]=[a,c1,c2,b]
    const hits=Array.from({length:19},(_,i)=>cubicPoint(points,(i+1)/20)).reduce((sum,p)=>
      sum+obstacles.filter(r=>p.x>=r.x-1&&p.x<=r.x+r.width+1&&
        p.y>=r.y-1&&p.y<=r.y+r.height+1).length,0)
    const outside=Array.from({length:19},(_,i)=>cubicPoint(points,(i+1)/20))
      .filter(p=>p.x<2||p.x>98||p.y<2||p.y>98).length
    return {points,score:hits*100+outside*100+Math.abs(offset)*.1}
  })
  const best=candidates.reduce((a,b)=>a.score<=b.score?a:b)
  const [,c1,c2]=best.points
  return {path:`M ${a.x.toFixed(3)} ${a.y.toFixed(3)} C ${c1.x.toFixed(3)} ${c1.y.toFixed(3)} ${c2.x.toFixed(3)} ${c2.y.toFixed(3)} ${b.x.toFixed(3)} ${b.y.toFixed(3)}`,
    tip:b,points:best.points}
}
const paperBackground=(plan:EditorialModularFamiliesPlanV1):React.CSSProperties=>({
  backgroundColor:plan.paper,
  backgroundImage:plan.background==='ivory-subtle-grid'
    ?'linear-gradient(rgba(88,83,76,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(88,83,76,.045) 1px,transparent 1px)'
    :plan.background==='white-soft-paper'
      ?'radial-gradient(circle at 20% 10%,rgba(210,205,194,.11),transparent 45%),radial-gradient(circle at 80% 90%,rgba(211,205,193,.10),transparent 48%)'
      :'none',
  backgroundSize:plan.background==='ivory-subtle-grid'?'5cqmin 5cqmin':'auto',
})

export const EditorialModularFamiliesV1:React.FC<{
  spec:VisualSceneSpecV2;runtimeAssets:readonly RuntimeRenderAssetV2[];u:number
}>=({spec,runtimeAssets,u})=>{
  const plan=spec.editorialFamily!
  const landscape=window.innerWidth>window.innerHeight
  const layout=landscape?plan.landscapeLayout:spec.layout
  const byId=new Map(runtimeAssets.map(asset=>[asset.slotId,asset.objectUrl]))
  const url=(id:string)=>{
    const value=byId.get(id as RuntimeRenderAssetV2['slotId'])
    if(!value) throw new Error('EDITORIAL_FAMILY_RUNTIME_RESOURCE_MISSING:'+id)
    return value
  }
  const exit=1-phase(u,.89,1)
  const textStart=plan.entry==='text-first'||plan.entry==='word-first'?.02:.12
  const textEnter=phase(u,textStart,textStart+.15)
  const root=useRef<HTMLDivElement>(null)
  useLayoutEffect(()=>{if(root.current) fitVisualTextV2(root.current)},[spec,landscape])
  const title=layout.textBounds
  const heroLayout=layout.slotLayouts.find(item=>item.slotId==='hero')
  const visibleHero=spec.slots.find(item=>item.role==='hero'&&item.state==='present')
  const opticalHeroScale=visibleHero&&visibleHero.state==='present'
    ?Math.min(1.35,Math.max(1,.82/visibleHero.bounds.visibleWidthRatio)):1
  const heroEnter=plan.hero?phase(u,plan.hero.enter,plan.hero.settle):0
  const camera=plan.camera.mode==='quiet-drift'?{
    x:(1-phase(u,.05,.38))*plan.camera.dx,
    y:(1-phase(u,.05,.38))*plan.camera.dy,
  }:{x:0,y:0}
  const nodeRect=(id:string)=>{
    const envelope=layout.slotLayouts.find(slot=>slot.slotId===id)?.envelope
    const slot=spec.slots.find(item=>item.slotId===id&&item.state==='present')
    const alpha=plan.supportTreatment==='naked-label'&&slot?.state==='present'
      ?slot.bounds.alphaBounds:undefined
    return envelope&&id==='hero'?relationTarget(envelope):envelope?supportTarget(envelope,landscape,alpha):undefined
  }
  return <div key={sceneSpecReactKeyAny(spec)} data-visual-mvp="true" data-visual-composition="v15-editorial-modular-families"
    data-qc-layout-family={plan.family} data-qc-empty-hero-frames="0" data-editorial-family={plan.family}
    data-qc-background-motion="none" data-qc-decorator-count="0"
    style={{position:'absolute',inset:0,overflow:'hidden',containerType:'size',fontSynthesis:'none',color:plan.ink,
      ...paperBackground(plan)}}>
    {plan.particles.mode!=='none'&&Array.from({length:plan.particles.count},(_,index)=>{
      const x=7+(index*37)%86,y=6+(index*29)%88
      return <span key={index} aria-hidden="true" style={{position:'absolute',left:`${x}%`,top:`${y}%`,
        width:plan.particles.mode==='ticks'?'.4cqmin':'.22cqmin',
        height:plan.particles.mode==='ticks'?'.08cqmin':'.22cqmin',borderRadius:'50%',
        background:plan.accent,opacity:plan.particles.opacity*phase(u,.5,.72),pointerEvents:'none'}}/>
    })}
    <div ref={root} data-qc-text="true" data-qc-hide-container="true" data-qc-text-fit="v2" data-qc-max-lines="3"
      data-qc-visible-words="8" data-qc-contrast-treatment="dark-text"
      style={{position:'absolute',left:`${title.x}%`,top:`${title.y}%`,width:`${title.width}%`,height:`${title.height}%`,
        zIndex:10,display:'flex',flexDirection:'column',justifyContent:'center',gap:'.6cqmin',
        opacity:textEnter*exit,padding:'.5cqmin',boxSizing:'border-box',textAlign:layout.textAlignment,
        overflow:'hidden'}}>
      {spec.text.connector&&<div data-fit-body="true" data-qc-text-glyph="true"
        style={{fontFamily:plan.family==='editorial'?'Fraunces,serif':'DM Sans,sans-serif',
          fontSize:plan.family==='editorial'?'9cqmin':'3.35cqmin',fontWeight:plan.family==='editorial'?600:500,
          letterSpacing:'-.02em',lineHeight:1.1}}>{spec.text.connector}</div>}
      <div data-fit-title="true" data-qc-keyword="true" data-qc-text-glyph="true" data-qc-keyword-family="Fraunces"
        style={{fontFamily:'Fraunces,serif',fontSize:plan.family==='editorial'?'21cqmin':'17.5cqmin',
          fontWeight:650,lineHeight:.95,letterSpacing:'-.04em',color:plan.accent}}>{spec.text.keyword}</div>
      {spec.text.closing&&<div data-fit-body="true" data-qc-closing="true" data-qc-text-glyph="true"
        style={{fontFamily:'DM Sans,sans-serif',fontSize:'3.35cqmin',fontWeight:500,lineHeight:1.18}}>{spec.text.closing}</div>}
      <span aria-hidden="true" style={{display:'block',width:'10cqmin',height:'.17cqmin',
        background:plan.accent,transform:`scaleX(${phase(u,textStart+.10,textStart+.26)})`,transformOrigin:'left'}}/>
    </div>
    {plan.hero&&heroLayout&&<div data-qc-asset="true" data-qc-hero="true" data-qc-slot="hero" data-qc-role="hero"
      style={{position:'absolute',left:`${heroLayout.envelope.x}%`,top:`${heroLayout.envelope.y}%`,
        width:`${heroLayout.envelope.width}%`,height:`${heroLayout.envelope.height}%`,zIndex:4,
        opacity:heroEnter*exit,transform:`translate(${camera.x}cqmin,${camera.y}cqmin) scale(${(.94+.06*heroEnter).toFixed(4)})`,
        transformOrigin:'50% 55%'}}>
      {plan.layers.filter(layer=>layer.id==='idea-rear'||layer.id==='idea-accent').map(layer=>{
        const enter=phase(u,layer.timing.start,layer.timing.settle)
        const style:React.CSSProperties={position:'absolute',left:`${layer.rect.x}%`,top:`${layer.rect.y}%`,
          width:`${layer.rect.width}%`,height:`${layer.rect.height}%`,zIndex:layer.zIndex,
          opacity:enter,transform:`translate(${(1-enter)*layer.from.x}%,${(1-enter)*layer.from.y}%) scale(${layer.from.scale+(1-layer.from.scale)*enter})`,
          objectFit:'contain',pointerEvents:'none'}
        return layer.colorCapability==='accent-primary'
          ?<AlphaMaskRasterV4 key={layer.id} url={url(layer.id)} color={plan.accent}
            maskId={`family-${layer.id}`} style={style} />
          :<img key={layer.id} src={url(layer.id)} alt="" style={style}/>
      })}
      {plan.particles.mode!=='none'&&[[8,24],[88,27],[13,78],[85,75]].map(([x,y],index)=><span
        key={`hero-dust-${index}`} aria-hidden="true" style={{position:'absolute',left:`${x}%`,top:`${y}%`,
          width:'.45cqmin',height:'.45cqmin',borderRadius:'50%',background:plan.accent,zIndex:2,
          opacity:.18*cue(u,plan.hero!.enter,plan.hero!.settle),pointerEvents:'none'}}/>)}
      <img src={url('hero')} alt="" style={{position:'absolute',left:'5%',top:'5%',width:'90%',height:'90%',
        objectFit:'contain',zIndex:3,transform:`scale(${opticalHeroScale.toFixed(4)})`,
        filter:'drop-shadow(.4cqmin .75cqmin .85cqmin rgba(25,22,18,.19))'}}/>
      {plan.layers.filter(layer=>layer.id==='idea-front').map(layer=>{
        const enter=phase(u,layer.timing.start,layer.timing.settle)
        return <img key={layer.id} src={url(layer.id)} alt="" style={{position:'absolute',
          left:`${layer.rect.x}%`,top:`${layer.rect.y}%`,width:`${layer.rect.width}%`,height:`${layer.rect.height}%`,
          zIndex:layer.zIndex,objectFit:'contain',opacity:enter}}/>
      })}
    </div>}
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" data-editorial-relations="true"
      style={{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:3,pointerEvents:'none',opacity:exit}}>
      {plan.relations.map((relation,index)=>{
        const from=nodeRect(relation.from),to=nodeRect(relation.to)
        if(!from||!to) throw new Error('EDITORIAL_FAMILY_RELATION_LAYOUT_MISSING')
        const endpointLabels=[relation.from,relation.to].filter(id=>id!=='hero').flatMap(id=>{
          const r=layout.slotLayouts.find(slot=>slot.slotId===id)?.envelope
          return r?[{x:r.x,y:r.y+r.height*.68,width:r.width,height:r.height*.32}]:[]
        })
        const obstacles=[layout.textBounds,...endpointLabels,...layout.slotLayouts
          .filter(slot=>slot.slotId!==relation.from&&slot.slotId!==relation.to)
          .map(slot=>slot.slotId==='hero'?relationTarget(slot.envelope):slot.envelope)]
        const {path,tip,points}=route(from,to,obstacles,
          relation.from!=='hero'&&relation.to!=='hero'),draw=phase(u,relation.start,relation.end)
        const transfer=relation.meaning==='transfers'&&u>=relation.end&&u<relation.end+.14
        const moving=cubicPoint(points,phase(u,relation.end,relation.end+.12))
        const directional=relation.meaning==='causes'||relation.meaning==='transfers'
        return <g key={index} opacity={draw>0?1:0} data-relation-meaning={relation.meaning}>
          <path d={path} pathLength={1} fill="none" stroke={plan.ink} strokeWidth=".16"
            strokeDasharray={1} strokeDashoffset={1-draw}/>
          <circle cx={tip.x} cy={tip.y} r=".23" fill={plan.accent} opacity={draw>.98?1:0}/>
          {directional&&draw>.98&&<circle cx={tip.x} cy={tip.y} r=".37" fill={plan.accent}/>}
          {transfer&&<circle cx={moving.x} cy={moving.y} r=".52" fill={plan.accent}
            data-editorial-transfer-token="true" />}
          {transfer&&<circle cx={tip.x} cy={tip.y} r={.4+.6*cue(u,relation.end+.10,relation.end+.18)}
            fill="none" stroke={plan.accent} strokeWidth=".12"
            opacity={cue(u,relation.end+.10,relation.end+.18)} data-editorial-arrival="true"/>}
        </g>
      })}
    </svg>
    {plan.supports.map((support,index)=>{
      const position=layout.slotLayouts.find(slot=>slot.slotId===support.slotId)!.envelope
      const enter=phase(u,support.enter,support.settle)
      const material=plan.supportTreatment
      const card=material!=='naked-label'
      const dark=material==='ink-badge',orange=material==='accent-tile'
      return <div key={support.slotId} data-qc-asset="true" data-qc-slot={support.slotId} data-qc-role={support.slotId}
        style={{position:'absolute',left:`${position.x}%`,top:`${position.y}%`,
          width:`${position.width}%`,height:`${position.height}%`,zIndex:5,
          opacity:enter*exit,transform:`translateY(${((1-enter)*1.3).toFixed(3)}cqmin)`,
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'.4cqmin'}}>
        <div style={{height:'70%',aspectRatio:'1',maxWidth:'84%',borderRadius:dark?'50%':'1.2cqmin',
          background:card?(dark?plan.ink:orange?plan.accent:'#FAF9F6'):'transparent',
          border:card?'1px solid rgba(17,17,15,.11)':'none',boxSizing:'border-box',
          boxShadow:card?'.18cqmin .27cqmin .24cqmin rgba(17,17,15,.12),.4cqmin .7cqmin 1.25cqmin rgba(17,17,15,.07)':'none',
          padding:card?'1cqmin':'0',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <AlphaMaskRasterV4 url={url(support.slotId)} color={dark||orange?'#FAF9F6':plan.supportTint}
            maskId={`family-${support.slotId}-${index}`} renderMode="css" />
        </div>
        {plan.particles.mode!=='none'&&<span aria-hidden="true" style={{position:'absolute',left:'14%',top:'8%',
          width:'.28cqmin',height:'.28cqmin',borderRadius:'50%',background:plan.accent,
          opacity:.2*cue(u,support.enter,support.settle),pointerEvents:'none'}}/>}
        <div data-qc-text-glyph="true" style={{fontFamily:'IBM Plex Sans Condensed,sans-serif',
          fontSize:'1.85cqmin',letterSpacing:'.12em',fontWeight:400,whiteSpace:'nowrap'}}>{support.label}</div>
      </div>
    })}
  </div>
}
