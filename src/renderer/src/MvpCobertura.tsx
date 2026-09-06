// Inspeccion local, solo importada por banco.tsx (fuera de los inputs de produccion).
import { useEffect, useState } from 'react'
import { AnimatedGraphic } from './AnimatedGraphic'
import { composicion } from './composiciones'
import { FONDOS, ESTRUCTURAS, CAMARAS, DENSIDADES, RITMOS, TIPOGRAFIAS, type Direccion } from '../../shared/escena'
import { SISTEMAS, type NombreSistema } from './sistemas'
import { FUENTES_RENDER, MUESTRA_FUENTES, faltaLaFuentePorAncho } from './fuentes-render'

const base: Direccion = { fondo: 'ondas', estructura: 'constelacion', camara: 'quieto',
  densidad: 'media', ritmo: 'simultaneo', tipografia: 'archivo' }
const conceptos = [{emoji:'🧠',etiqueta:'recuerdo'},{emoji:'🗂️',etiqueta:'archivo'},{emoji:'🔗',etiqueta:'conexion'}]
type Caso = {eje:string;id:string;direccion:Direccion;sistema:NombreSistema;control:boolean}
const casos: Caso[] = []
for (const [eje, registro] of Object.entries({fondo:FONDOS,estructura:ESTRUCTURAS,camara:CAMARAS,tipografia:TIPOGRAFIAS})) {
  for(const p of Object.values(registro)) casos.push({eje,id:p.id,direccion:{...base,[eje]:p.id},
    sistema:'voltaje',control:'prueba' in p && p.prueba === true})
}
for(const [eje, ids] of Object.entries({densidad:DENSIDADES,ritmo:RITMOS})) {
  for(const id of ids) casos.push({eje,id,direccion:{...base,[eje]:id},sistema:'voltaje',control:false})
}
for(const id of Object.keys(SISTEMAS) as NombreSistema[]) casos.push({eje:'sistema',id,direccion:base,sistema:id,control:false})

export function MvpCobertura() {
  const [fuentes,setFuentes]=useState<string[]|null>(null)
  const parametros=new URLSearchParams(location.search)
  const t=Number(parametros.get('t') ?? 1.5)
  const eje=parametros.get('eje')
  const lista=casos.filter(c=>!eje||c.eje===eje)
  // Una sola composicion por documento: el prefijo de keyframes depende de la palabra.
  const elegido=lista.find(c=>`${c.eje}:${c.id}`===parametros.get('caso')) ?? lista[0]
  const escala=parametros.get('escala')==='1'?1:.45
  useEffect(()=>{let vivo=true
    Promise.all(FUENTES_RENDER.map(f=>document.fonts.load(`${f.peso} 100px "${f.familia}"`,MUESTRA_FUENTES)))
      .then(()=>document.fonts.ready).then(()=>{
        if(vivo)setFuentes(FUENTES_RENDER.map(f=>faltaLaFuentePorAncho(f.familia,f.peso)).filter((f):f is string=>!!f))
      }).catch(e=>{if(vivo)setFuentes([String(e)])})
    return()=>{vivo=false}
  },[])
  return <main data-cobertura="mvp" data-inventario={JSON.stringify(lista)} data-fuentes={fuentes===null?'pendiente':fuentes.length?'fallo':'ok'}
    style={{background:'#10141b',color:'#fff',padding:20,width:2052,boxSizing:'border-box',fontFamily:'Arial'}}>
    <h1>MVP · cobertura {eje ? `· ${eje}` : ''} · ESCALA {escala*100}%</h1>
    <p>1080×1920 → {1080*escala}×{1920*escala} px por celda · visual_escena · memoria · t={t.toFixed(3)} s / ciclo 3 s</p>
    <p>Conceptos: 🧠 recuerdo / 🗂️ archivo / 🔗 conexion. Cada celda declara su direccion y sistema.</p>
    <p>Una muestra por pieza prueba que dibuja, no su legibilidad en todos los contenidos ni su movimiento completo.</p>
    <p>{fuentes===null?'Comprobando fuentes…':fuentes.length?fuentes.join(' · '):'11 familias comprobadas por geometria.'}</p>
    <nav>{lista.map(c=><a key={c.id} style={{color:'#aaa',marginRight:8}} href={`?vista=cobertura&eje=${c.eje}&caso=${c.eje}:${c.id}`}>{c.id}</a>)}</nav>
    <p>Documento aislado por pieza. La hoja completa se monta desde estas capturas, sin reescalar.</p>
    <section style={{display:'grid',gridTemplateColumns:`${1080*escala}px`,gap:20}}>
      {[elegido].filter(Boolean).map(c=>{
        const puede=composicion('escena')!.puedeDibujar({texto:'memoria',conceptos,direccion:c.direccion})
        return <article key={`${c.eje}:${c.id}`} data-caso={`${c.eje}:${c.id}`} data-puede={String(puede)}
          data-direccion={JSON.stringify(c.direccion)} data-sistema={c.sistema}>
          <header style={{height:96,fontSize:16,lineHeight:1.2,overflowWrap:'anywhere'}}>
            <strong>{c.eje} · {c.id}{c.control?' · CONTROL (fuera del sorteo)':''}</strong>
            <div style={{fontSize:12}}>{JSON.stringify(c.direccion)}</div>
            <div>sistema: {c.sistema} · puedeDibujar: {String(puede)} · escala {escala*100}%</div>
          </header>
          <div style={{width:1080*escala,height:1920*escala,overflow:'hidden',position:'relative'}}>
            <div style={{width:1080,height:1920,transform:`scale(${escala})`,transformOrigin:'top left'}}>
              <div className="flex" style={{width:1080,height:1920}}>
                <AnimatedGraphic graphic={{type:'visual_escena',value:'memoria',extra:{conceptos,direccion:c.direccion}}}
                  t={t} ciclo={3} modo="pantalla" sistema={c.sistema}/>
              </div>
            </div>
          </div>
        </article>
      })}
    </section>
  </main>
}
