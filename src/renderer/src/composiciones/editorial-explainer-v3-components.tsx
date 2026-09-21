import React,{useLayoutEffect,useRef} from 'react'
import type {VisualSceneSpecV2} from '../../../shared/visual-scene-spec-v2'
import {EDITORIAL_V3_ACCENTS,type LightStyleV3} from '../../../shared/editorial-explainer-v3'
import {LIGHT_COLORS_V1 as C} from '../../../shared/editorial-explainer-light-v1'
import {fitVisualTextV2} from './text-fit-v2'
const clamp=(v:number)=>Math.max(0,Math.min(1,v)); const ease=(v:number)=>{v=clamp(v);return v*v*(3-2*v)}
const phase=(u:number,s:number,d:number)=>ease((u-s)/d)
const style=(spec:VisualSceneSpecV2)=>spec.lightStyle as LightStyleV3

export const EditorialV3SupportCard:React.FC<{children:React.ReactNode;variant:LightStyleV3['supportTreatment'];accent:string}>=({children,variant,accent})=>{
  const black=variant==='black-micro-badge',tile=variant==='accent-tile'
  return <div data-v3-support={variant} style={{width:'100%',height:'100%',display:'grid',placeItems:'center',
    padding:black?'24%':'18%',boxSizing:'border-box',borderRadius:black?'50%':'16%',
    background:black?C.ink:tile?`linear-gradient(145deg,${accent},#D85125)`:'linear-gradient(145deg,#FAF9F6,#ECE9E1)',
    border:black?'1px solid rgba(255,255,255,.12)':tile?'1px solid rgba(17,17,15,.16)':`1px solid ${C.grid}88`,
    boxShadow:'.18cqmin .35cqmin .35cqmin rgba(17,17,15,.18),1cqmin 1.35cqmin 2.2cqmin rgba(17,17,15,.11)'}}>{children}</div>}

export const EditorialV3Microdetails:React.FC<{spec:VisualSceneSpecV2;u:number}>=({spec,u})=>{const s=style(spec),a=EDITORIAL_V3_ACCENTS[s.accentTheme]
  if(s.microdetailPreset==='none')return null;const p=phase(u,.56,.16),n=s.microdetailPreset==='rich-5'?5:s.microdetailPreset==='technical-4'?4:2
  return <svg data-v3-microdetails={s.microdetailPreset} viewBox="0 0 100 100" style={{position:'absolute',inset:0,zIndex:6,pointerEvents:'none',opacity:p}}>
    {Array.from({length:n},(_,i)=>{const x=(13+s.microdetailVariant*7+i*19)%88,y=(18+s.microdetailVariant*11+i*23)%82
      return i%3===0?<path key={i} d={`M${x-2} ${y}h4M${x} ${y-2}v4`} stroke={a.dark} strokeWidth=".45"/>:
        i%3===1?<circle key={i} cx={x} cy={y} r=".75" fill={a.main}/>:<path key={i} d={`M${x-3} ${y}h6`} stroke={C.ink} strokeWidth=".25" strokeDasharray="1 1"/>})}
  </svg>}

export const EditorialV3Connector:React.FC<{spec:VisualSceneSpecV2;u:number}>=({spec,u})=>{const s=style(spec),p=s.connector;if(!p)return null
  const h=spec.layout.slotLayouts.find(x=>x.slotId==='hero')?.envelope,b=spec.layout.slotLayouts.find(x=>x.slotId==='support-1')?.envelope;if(!h||!b)return null
  const sx=h.x+h.width*.72,sy=h.y+h.height*.52,ex=b.x+b.width*.5,ey=b.y+b.height*.5,a=EDITORIAL_V3_ACCENTS[s.accentTheme]
  const d=p.variant==='straight'?`M${sx} ${sy}L${ex} ${ey}`:p.variant==='curved-wide'?`M${sx} ${sy}C${sx+18} ${sy-10},${ex-18} ${ey+8},${ex} ${ey}`:`M${sx} ${sy}Q${(sx+ex)/2} ${Math.min(sy,ey)-7},${ex} ${ey}`
  const q=p.state==='draw'?phase(u,.44,.2):1
  return <svg data-v3-connector={p.variant} viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:'absolute',inset:0,zIndex:5,width:'100%',height:'100%',pointerEvents:'none'}}>
    <defs><marker id="v3-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L8 4 0 8" fill={a.dark}/></marker></defs>
    <path d={d} fill="none" stroke={a.dark} strokeWidth=".42" strokeLinecap="round" pathLength="100" strokeDasharray={p.variant==='dashed'?'4 3':'100'} strokeDashoffset={p.variant==='dashed'?0:(1-q)*100} markerEnd={p.arrow&&q>.97?'url(#v3-arrow)':undefined}/>
    {p.dotAnchors&&<><circle cx={sx} cy={sy} r=".65" fill={C.ink}/><circle cx={ex} cy={ey} r=".65" fill={a.main}/></>}
  </svg>}

export const EditorialV3DataRepeater:React.FC<{spec:VisualSceneSpecV2;u:number}>=({spec,u})=>{const s=style(spec),d=s.dataRepeater;if(!d)return null;const a=EDITORIAL_V3_ACCENTS[s.accentTheme],shown=Math.floor(d.tokenCount*phase(u,.23,.34))
  return <div data-v3-data="compact-prominent-v3" data-qc-data-count={d.confirmedValue} style={{position:'absolute',left:'8%',top:'42%',width:'84%',height:'45%',zIndex:4,display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:'2.2cqmin',alignContent:'center'}}>
    {Array.from({length:d.tokenCount},(_,i)=><div key={i} style={{aspectRatio:1,borderRadius:'18%',display:'grid',placeItems:'center',background:i<shown?(i%4===0?a.main:C.ink):C.white,opacity:i<shown?1:.16,boxShadow:i<shown?'.5cqmin .8cqmin 1.2cqmin rgba(17,17,15,.12)':'none'}}><span style={{color:C.white,fontSize:'3.6cqmin'}}>●</span></div>)}
    <div data-qc-text-glyph="true" style={{gridColumn:'1/-1',font:"600 3cqmin 'IBM Plex Sans Condensed',sans-serif",letterSpacing:'.1em',color:C.ink}}>{d.label.toUpperCase()}</div>
  </div>}

export const EditorialV3Text:React.FC<{spec:VisualSceneSpecV2;u:number}>=({spec,u})=>{const r=useRef<HTMLDivElement>(null);useLayoutEffect(()=>{if(r.current)fitVisualTextV2(r.current)},[spec]);const s=style(spec),t=spec.text,a=EDITORIAL_V3_ACCENTS[s.accentTheme],big=s.typeRole==='display-hero'||s.typeRole==='data-display',visibleWords=[t.connector,t.keyword,t.closing,s.dataRepeater?.label].filter(Boolean).join(' ').split(/\s+/u).filter(Boolean).length
  return <div ref={r} data-qc-text="true" data-qc-text-fit="v2" data-qc-max-lines={t.maxLines} data-qc-visible-words={visibleWords} data-qc-text-region={s.textPlacement} data-qc-keyword-family="Instrument Serif" data-qc-contrast-treatment="dark-text" style={{position:'absolute',left:`${spec.layout.textBounds.x}%`,top:`${spec.layout.textBounds.y}%`,width:`${spec.layout.textBounds.width}%`,height:`${spec.layout.textBounds.height}%`,zIndex:9,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:t.alignment==='right'?'flex-end':'flex-start',overflow:'hidden',color:C.ink,fontSynthesis:'none'}}>
    {t.connector&&<div data-fit-body="true" data-qc-connector="true" data-qc-text-glyph="true" style={{font:"500 3.1cqmin 'DM Sans',sans-serif",opacity:phase(u,.05,.13)}}>{t.connector}</div>}
    <div data-fit-title="true" data-qc-keyword="true" data-qc-text-glyph="true" style={{fontFamily:"'Instrument Serif',serif",fontWeight:400,fontSize:big?'14cqmin':'11cqmin',lineHeight:.88,color:a.text,opacity:phase(u,.14,.18),transform:`translateY(${(1-phase(u,.14,.18))*1.5}cqmin)`}}>{t.keyword}</div>
    {t.closing&&<div data-fit-body="true" data-qc-closing="true" data-qc-text-glyph="true" style={{font:"400 3.05cqmin 'DM Sans',sans-serif",lineHeight:1.18,marginTop:'1cqmin',opacity:phase(u,.31,.15)}}>{t.closing}</div>}
    <div style={{height:'.25cqmin',width:'22%',background:a.main,marginTop:'1.2cqmin',transform:`scaleX(${phase(u,.39,.16)})`,transformOrigin:'0 50%'}}/>
  </div>}
