import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Link2, Download, LoaderCircle } from 'lucide-react';
type TrendItem = { id:number; type:'video'|'news'|'image'; title:string; platform:string; account:string; accountUrl:string; videoUrl?:string; accountSize?:'small'|'big'; followers?:number; views?:number|null; avgLast20?:number; publishedHoursAgo:number; duplicates:number; duplicateSources?:string[]; transcript?:string; };
const MOCK:Record<string,TrendItem[]>={'2026-07-15':[{id:1,type:'video',title:'Receta de arepa rellena con truco viral',platform:'TikTok',account:'@cocinaconlu',accountUrl:'#',accountSize:'small',followers:4200,views:812000,avgLast20:9800,publishedHoursAgo:6,duplicates:0},{id:2,type:'news',title:'Aumento en precio del café reaviva debate sobre exportaciones',platform:'El Tiempo',account:'El Tiempo',accountUrl:'#',publishedHoursAgo:3,duplicates:3,duplicateSources:['Semana','La República'],transcript:'El precio del café subió por tercera semana consecutiva.'},{id:3,type:'video',title:'Trend nuevo con canción Se fue de viaje',platform:'TikTok',account:'@juanpa.dance',accountUrl:'#',accountSize:'small',followers:1100,views:38000,avgLast20:2100,publishedHoursAgo:2,duplicates:0},{id:4,type:'image',title:'Meme de la final del torneo se vuelve tendencia en X',platform:'X',account:'@memesdeportivos',accountUrl:'#',accountSize:'big',views:410000,publishedHoursAgo:20,duplicates:1,duplicateSources:['@futbolmemesco']}],'2026-07-14':[{id:5,type:'video',title:'Tutorial maquillaje piel de vidrio viral',platform:'YouTube',account:'@glowbylau',accountUrl:'#',accountSize:'small',followers:800,views:640000,avgLast20:3100,publishedHoursAgo:30,duplicates:0}]};
function fmt(n?:number|null){if(n==null)return'-';if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'k';return String(n);}
const PI:Record<string,string>={TikTok:'🎵',YouTube:'▶️',X:'✕',Instagram:'📷'};
function getVb(it:TrendItem){if(!it.avgLast20||!it.views)return null;const r=it.views/it.avgLast20;if(it.publishedHoursAgo<=8&&r>=8)return{l:'💎 Diamante en bruto',c:'bg-sky-500/20 text-sky-300 border border-sky-500/30'};if(r>=6)return{l:'🔥 Viral confirmado',c:'bg-rose-500/20 text-rose-300 border border-rose-500/30'};if(r>=2.5)return{l:'📈 Creciendo rápido',c:'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'};return null;}
function typeBadge(t:string){if(t==='video')return'bg-rose-500/20 text-rose-400';if(t==='news')return'bg-emerald-500/20 text-emerald-400';return'bg-violet-500/20 text-violet-400';}
type Props={isOpen:boolean;onClose:()=>void;onUseIdea?:(t:string)=>void;onOpenProject?:(projectPath:string)=>Promise<void>};
const localStateLabel:Record<string,string>={WAITING_FOR_DEVICE:'Esperando turno del PC',QUERYING:'Consultando el video',DOWNLOADING:'Descargando en este PC',PREPARING:'Preparando archivo',VERIFYING:'Verificando con FFprobe',AVAILABLE:'Original disponible en este PC',FAILED:'Error de descarga',CANCEL_REQUESTED:'Cancelación solicitada',CANCELED:'Descarga cancelada'};
export default function TrendsPanel({isOpen,onClose,onUseIdea,onOpenProject}:Props){
  const days=Object.keys(MOCK);
  const[cd,setCd]=useState(days[0]);
  const[ct,setCt]=useState<'all'|'video'|'news'|'image'>('all');
  const[oid,setOid]=useState<number|null>(null);
  const[createLinkOpen,setCreateLinkOpen]=useState(false);
  const[localUrl,setLocalUrl]=useState('');
  const[localName,setLocalName]=useState('');
  const[localQuality,setLocalQuality]=useState<'fhd'|'best'>('fhd');
  const[localBusy,setLocalBusy]=useState(false);
  const localStartingRef=useRef(false);
  const localRequestRef=useRef<{fingerprint:string;key:string}|null>(null);
  const[localError,setLocalError]=useState('');
  const[localDownloads,setLocalDownloads]=useState<any[]>([]);
  const[focusDownload,setFocusDownload]=useState<{projectId:string;attemptId:string}|null>(null);
  useEffect(()=>{
    if(!isOpen)return;
    let alive=true;
    const refresh=async()=>{try{const result=await window.electronAPI.listCipherLocalDownloads();if(alive&&result?.success)setLocalDownloads(result.downloads||[])}catch{}}
    void refresh();const timer=window.setInterval(refresh,1500);
    return()=>{alive=false;window.clearInterval(timer)};
  },[isOpen]);
  const focusedDownload=focusDownload?localDownloads.find(item=>item.projectId===focusDownload.projectId&&item.attemptId===focusDownload.attemptId):localDownloads[0];
  const createFromLink=async()=>{
    if(localStartingRef.current||!localUrl.trim())return;
    localStartingRef.current=true;
    setLocalBusy(true);setLocalError('');
    try{
      const fingerprint=JSON.stringify([localUrl.trim(),localName.trim(),localQuality]);
      if(!localRequestRef.current||localRequestRef.current.fingerprint!==fingerprint)
        localRequestRef.current={fingerprint,key:window.crypto.randomUUID()};
      const result=await window.electronAPI.startCipherLocalDownload({idempotencyKey:localRequestRef.current.key,sourceUrl:localUrl,name:localName,qualityProfile:localQuality});
      if(!result?.success||!result.projectId||!result.attemptId)throw new Error(result?.error||'No se pudo crear el proyecto local.');
      localRequestRef.current=null;
      setFocusDownload({projectId:result.projectId,attemptId:result.attemptId});setLocalUrl('');setCreateLinkOpen(false);
      const listed=await window.electronAPI.listCipherLocalDownloads();if(listed?.success)setLocalDownloads(listed.downloads||[]);
    }catch(error){setLocalError(error instanceof Error?error.message:'No se pudo iniciar la descarga.')}
    finally{localStartingRef.current=false;setLocalBusy(false)}
  };
  const openDownloadedProject=async(item:any)=>{
    setLocalError('');
    try{
      const result=await window.electronAPI.openCipherLocalDownloadProject({projectId:item.projectId,attemptId:item.attemptId});
      if(!result?.success||!result.projectPath)throw new Error(result?.error||'El original todavía no está disponible.');
      if(onOpenProject)await onOpenProject(result.projectPath);
      onClose();
    }catch(error){setLocalError(error instanceof Error?error.message:'No se pudo abrir el proyecto.')}
  };
  const cancelLocalDownload=async(item:any)=>{
    const result=await window.electronAPI.cancelCipherLocalDownload({projectId:item.projectId,attemptId:item.attemptId});
    if(!result?.success)setLocalError(result?.error||'No se pudo solicitar la cancelación.');
  };
  const retryLocalDownload=async(item:any)=>{
    setLocalError('');setLocalBusy(true);
    try{
      const result=await window.electronAPI.retryCipherLocalDownload({projectId:item.projectId,attemptId:item.attemptId});
      if(!result?.success||!result.attemptId)throw new Error(result?.error||'No se pudo reintentar en el proyecto existente.');
      setFocusDownload({projectId:item.projectId,attemptId:result.attemptId});
      const listed=await window.electronAPI.listCipherLocalDownloads();if(listed?.success)setLocalDownloads(listed.downloads||[]);
    }catch(error){setLocalError(error instanceof Error?error.message:'No se pudo reintentar la descarga.')}
    finally{setLocalBusy(false)}
  };
  const items=useMemo(()=>{const l=MOCK[cd]??[];return ct==='all'?l:l.filter(i=>i.type===ct);},[cd,ct]);
  if(!isOpen)return null;
  const sel=items.find(i=>i.id===oid)||null;
  const b=sel?getVb(sel):null;
  const r=sel&&sel.avgLast20&&sel.views?(sel.views/sel.avgLast20).toFixed(1):null;
  const fr=sel&&sel.followers&&sel.views?(sel.views/sel.followers).toFixed(1):null;
  return(
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"/>
      <div className="relative w-full h-full flex" onClick={e=>e.stopPropagation()}>
        <div className="w-[340px] bg-[#0D0D0F] border-r border-[#3a3a3c] h-full flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-[#3a3a3c]/80 bg-[#1C1C1E]/80">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white">📡 Tendencias</h2>
              <button onClick={onClose} className="p-1.5 hover:bg-[#3a3a3c] rounded-lg text-slate-400 hover:text-white transition-colors"><X className="h-4 w-4"/></button>
            </div>
            <button type="button" onClick={()=>{setCreateLinkOpen(value=>!value);setLocalError('')}} className="w-full flex items-center justify-center gap-2 rounded-lg border border-indigo-500/50 bg-indigo-600/15 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-600/25">
              <Link2 className="h-4 w-4"/> Crear proyecto desde un enlace
            </button>
            {createLinkOpen&&<div className="mt-3 rounded-xl border border-[#3a3a3c] bg-[#141416] p-3 space-y-2.5">
              <label className="block text-[10px] font-semibold text-slate-300">Enlace de YouTube, Facebook, TikTok o Instagram
                <input value={localUrl} onChange={event=>setLocalUrl(event.target.value)} placeholder="https://…" inputMode="url" autoComplete="url" className="mt-1.5 w-full rounded-lg border border-[#3a3a3c] bg-[#09090b] px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"/>
              </label>
              <label className="block text-[10px] font-semibold text-slate-300">Nombre del proyecto
                <input value={localName} onChange={event=>setLocalName(event.target.value)} placeholder="Opcional" maxLength={80} className="mt-1.5 w-full rounded-lg border border-[#3a3a3c] bg-[#09090b] px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"/>
              </label>
              <label className="block text-[10px] font-semibold text-slate-300">Calidad
                <select value={localQuality} onChange={event=>setLocalQuality(event.target.value as 'fhd'|'best')} className="mt-1.5 w-full rounded-lg border border-[#3a3a3c] bg-[#09090b] px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none">
                  <option value="fhd">Hasta Full HD</option><option value="best">Máxima disponible</option>
                </select>
              </label>
              <button type="button" disabled={localBusy||!localUrl.trim()} onClick={()=>void createFromLink()} className="w-full min-h-10 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {localBusy?<span className="inline-flex items-center gap-2"><LoaderCircle className="h-3.5 w-3.5 animate-spin"/>Creando solicitud…</span>:<span className="inline-flex items-center gap-2"><Download className="h-3.5 w-3.5"/>Descargar y crear proyecto</span>}
              </button>
              <p className="text-[10px] leading-relaxed text-slate-500">Descarga local compartida con Cipher Control. No se inicia sesión en la web ni se envía el original a la nube.</p>
            </div>}
            {focusedDownload&&<div className="mt-3 rounded-xl border border-[#3a3a3c] bg-[#1c1c1e] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="truncate text-[11px] font-semibold text-white">{focusedDownload.name||'Proyecto desde enlace'}</p>
                  <p className={`mt-1 text-[10px] ${focusedDownload.state==='AVAILABLE'?'text-emerald-300':focusedDownload.state==='FAILED'?'text-rose-300':'text-slate-300'}`}>{localStateLabel[focusedDownload.state]||focusedDownload.state}</p></div>
                {Number.isFinite(focusedDownload.progressPercent)&&<span className="shrink-0 text-[10px] text-slate-300">{focusedDownload.progressPercent}%</span>}
              </div>
              {focusedDownload.label&&<p className="mt-1 text-[10px] text-slate-500">{focusedDownload.label}</p>}
              {focusedDownload.errorMessage&&<p className="mt-2 text-[10px] text-rose-300">{focusedDownload.errorMessage}</p>}
              {focusedDownload.state==='AVAILABLE'&&<>
                <p className="mt-2 text-[10px] text-emerald-200">{focusedDownload.file?.file_name} · {(Number(focusedDownload.file?.size_bytes||0)/1048576).toFixed(1)} MB · FFprobe válido</p>
                {focusedDownload.timings&&<p className="mt-1 text-[9px] text-slate-500">Tiempos medidos · búsqueda {focusedDownload.timings.sourceLookupSeconds??'—'} s · descarga {focusedDownload.timings.downloadSeconds??'—'} s · verificación {focusedDownload.timings.validationSeconds??'—'} s</p>}
                <button type="button" onClick={()=>void openDownloadedProject(focusedDownload)} className="mt-3 w-full rounded-lg bg-emerald-700 px-3 py-2.5 text-[11px] font-bold text-white hover:bg-emerald-600">Abrir proyecto y transcribir</button>
              </>}
              {['WAITING_FOR_DEVICE','QUERYING','DOWNLOADING','PREPARING','VERIFYING'].includes(focusedDownload.state)&&<button type="button" onClick={()=>void cancelLocalDownload(focusedDownload)} className="mt-2 rounded-md border border-rose-500/40 px-2.5 py-1.5 text-[10px] text-rose-200">Solicitar cancelación</button>}
              {['FAILED','CANCELED'].includes(focusedDownload.state)&&<button type="button" disabled={localBusy} onClick={()=>void retryLocalDownload(focusedDownload)} className="mt-2 w-full rounded-lg border border-amber-500/40 px-3 py-2 text-[10px] font-semibold text-amber-200 disabled:opacity-50">Reintentar en el mismo proyecto · máximo 2 reintentos</button>}
            </div>}
            {localError&&<p role="alert" className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] text-rose-200">{localError}</p>}
            <div className="flex gap-1.5 mb-3">
              {days.map((d,i)=>(
                <button key={d} onClick={()=>{setCd(d);setOid(null);}} className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${d===cd?'bg-[#242426] border-[#4a4a4c] text-white':'border-[#3a3a3c] text-slate-500 hover:text-slate-300'}`}>{d}{i===0?' · hoy':''} ({MOCK[d].length})</button>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              {([['all','🌐 Todos'],['video','🎬 Videos'],['news','📰 Noticias'],['image','🖼️ Imágenes']]as const).map(([k,l])=>(
                <button key={k} onClick={()=>{setCt(k as any);setOid(null);}} className={`text-[11px] px-3 py-2 rounded-lg text-left transition-all ${ct===k?'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 shadow-[0_0_8px_rgba(99,102,241,0.15)]':'text-slate-400 hover:bg-[#1C1C1E] hover:text-white'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {items.length===0&&<p className="text-slate-600 text-xs py-8 text-center">Sin ítems para este filtro.</p>}
            {items.map(it=>{
              const vb=getVb(it);const active=oid===it.id;
              return(
                <button key={it.id} onClick={()=>setOid(active?null:it.id)} className={`w-full text-left p-3 rounded-xl border transition-all ${active?'bg-[#1C1C1E] border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.1)]':'bg-[#1C1C1E]/50 border-[#3a3a3c]/50 hover:bg-[#1C1C1E] hover:border-[#4a4a4c]'}`}>
                  <div className="flex gap-1.5 items-center flex-wrap mb-1.5">
                    <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded-md font-bold ${typeBadge(it.type)}`}>{it.type}</span>
                    <span className="text-[9px] text-slate-500">{PI[it.platform]??'📰'} {it.platform}</span>
                    {vb&&<span className={`text-[9px] px-1.5 py-0.5 rounded-full ${vb.c}`}>{vb.l}</span>}
                  </div>
                  <p className="text-white text-[12px] leading-snug mb-1 font-medium" style={{display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{it.title}</p>
                  <div className="flex gap-2 text-[10px] text-slate-500">
                    <span>{it.account}</span>
                    <span>{it.publishedHoursAgo}h</span>
                    {it.views!=null&&<span>{fmt(it.views)} vistas</span>}
                  </div>
                  {it.duplicates>0&&<p className="text-[10px] text-amber-400 mt-1">⚠ {it.duplicates} fuente(s)</p>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 bg-[#0D0D0F] flex items-center justify-center overflow-y-auto">
          {!sel?(
            <div className="text-center">
              <div className="text-4xl mb-3 opacity-30">📡</div>
              <p className="text-slate-600 text-sm">Selecciona una tendencia para ver detalles</p>
            </div>
          ):(
            <div className="w-full max-w-2xl p-8">
              <div className="flex gap-2 items-center flex-wrap mb-4">
                <span className={`text-[11px] uppercase px-2.5 py-1 rounded-lg font-bold ${typeBadge(sel.type)}`}>{sel.type}</span>
                <span className="text-[11px] text-slate-400 bg-[#1C1C1E] px-2.5 py-1 rounded-lg border border-[#3a3a3c]">{PI[sel.platform]??'📰'} {sel.platform}</span>
                {b&&<span className={`text-[11px] px-3 py-1 rounded-full font-medium ${b.c}`}>{b.l}</span>}
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 leading-tight">{sel.title}</h3>
              <div className="flex gap-4 text-[12px] text-slate-500 mb-6 flex-wrap">
                <span>{sel.account}</span>
                {sel.accountSize&&<span>{sel.accountSize==='small'?'📌 cuenta pequeña':'⭐ cuenta grande'}</span>}
                <span>🕐 {sel.publishedHoursAgo}h publicado</span>
                {sel.views!=null&&<span>👁 {fmt(sel.views)} vistas</span>}
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {sel.views!=null&&<div className="bg-[#1C1C1E] border border-[#3a3a3c] rounded-xl px-4 py-3"><div className="text-xl font-bold text-white">{fmt(sel.views)}</div><div className="text-[10px] text-slate-500 uppercase mt-1">vistas</div></div>}
                {sel.followers&&<div className="bg-[#1C1C1E] border border-[#3a3a3c] rounded-xl px-4 py-3"><div className="text-xl font-bold text-white">{fmt(sel.followers)}</div><div className="text-[10px] text-slate-500 uppercase mt-1">seguidores</div></div>}
                {r&&<div className="bg-[#1C1C1E] border border-[#3a3a3c] rounded-xl px-4 py-3"><div className="text-xl font-bold text-white">{r}x</div><div className="text-[10px] text-slate-500 uppercase mt-1">vs promedio</div></div>}
                {fr&&<div className="bg-[#1C1C1E] border border-[#3a3a3c] rounded-xl px-4 py-3"><div className="text-xl font-bold text-white">{fr}x</div><div className="text-[10px] text-slate-500 uppercase mt-1">vs seguidores</div></div>}
                <div className="bg-[#1C1C1E] border border-[#3a3a3c] rounded-xl px-4 py-3"><div className="text-xl font-bold text-white">{sel.publishedHoursAgo}h</div><div className="text-[10px] text-slate-500 uppercase mt-1">antigüedad</div></div>
                <div className="bg-[#1C1C1E] border border-[#3a3a3c] rounded-xl px-4 py-3"><div className={`text-xl font-bold ${sel.duplicates>0?'text-amber-400':'text-white'}`}>{sel.duplicates}</div><div className="text-[10px] text-slate-500 uppercase mt-1">coincidencias</div></div>
              </div>
              {sel.duplicates>0&&<div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-[12px] text-amber-400 mb-4">⚠ Se repite en {sel.duplicates} fuente(s) más{sel.duplicateSources?': '+sel.duplicateSources.join(', '):''}. Puede ser tema consolidándose.</div>}
              {sel.transcript&&<div className="bg-[#1C1C1E] border border-[#3a3a3c] rounded-xl px-4 py-3 text-[13px] text-slate-400 leading-relaxed mb-6"><span className="block text-[10px] text-emerald-400 uppercase mb-2 font-medium">Texto (evita copia textual)</span>{sel.transcript}</div>}
              <div className="flex flex-wrap gap-3">
                <a href={sel.videoUrl||sel.accountUrl} target="_blank" rel="noreferrer" className="px-5 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-[12px] hover:bg-rose-500 transition-colors shadow-lg shadow-rose-500/20">{PI[sel.platform]??'📰'} Ver en {sel.platform}</a>
                {sel.type==='news'&&<button className="px-5 py-2.5 rounded-xl border border-emerald-500 text-emerald-400 text-[12px] font-medium hover:bg-emerald-500/10 transition-colors">✎ Reescribir</button>}
                {sel.type!=='news'&&<button className="px-5 py-2.5 rounded-xl border border-[#3a3a3c] text-slate-300 text-[12px] hover:border-slate-500 transition-colors">🎙 Transcribir</button>}
                <button className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-[12px] font-bold hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20" onClick={()=>{if(onUseIdea)onUseIdea(sel.title);onClose();}}>✦ Usar idea en Crear con IA</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
