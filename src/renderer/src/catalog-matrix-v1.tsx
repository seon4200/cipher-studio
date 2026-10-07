import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AlphaMaskRasterV4 } from './composiciones/alpha-mask-raster-v4'

type Entry = { code: string; word: string; role: 'support'|'accent-mask'; url: string }
type Input = { entries: Entry[]; colors: string[]; title: string }
declare global { interface Window { catalogMatrixInput?: Input } }
const Matrix: React.FC = () => {
  const [input, setInput] = useState<Input | null>(window.catalogMatrixInput ?? null)
  useEffect(() => {
    const receive = (event: Event) => setInput((event as CustomEvent<Input>).detail)
    window.addEventListener('catalog-matrix-input', receive)
    return () => window.removeEventListener('catalog-matrix-input', receive)
  }, [])
  if (!input) return <div>Waiting for curated catalogue input…</div>
  return <main><h1>{input.title}</h1><p>Máscara alpha productiva de Cipher · un PNG original por fila · HEX exactos congelados</p>
    <div className="matrix">
      <div className="head">Asset / palabra</div>{input.colors.map(color=><div className="head" key={color}>{color}</div>)}
      {input.entries.map(entry=><React.Fragment key={entry.code}>
        <div className="name">{entry.code}<br /><strong>{entry.word}</strong><small>{entry.role}</small></div>
        {input.colors.map(color=><div className="cell" key={color}>
          <AlphaMaskRasterV4 url={entry.url} color={color} maskId={`${entry.code}-${color.slice(1)}`}
            renderMode={entry.role==='support'?'css':'svg'} />
        </div>)}
      </React.Fragment>)}
    </div></main>
}
const css = document.createElement('style')
css.textContent = `*{box-sizing:border-box}body{margin:0;background:#F0EEE8;color:#11110F;font-family:Arial,sans-serif}main{padding:24px}h1{margin:0;font-size:26px}p{margin:4px 0 16px;font-size:13px}.matrix{display:grid;grid-template-columns:170px repeat(5,1fr);gap:2px;background:#C9C5BD;border:2px solid #C9C5BD}.head{padding:8px;background:#EEEAE3;text-align:center;font-size:15px;font-weight:700}.name{padding:8px;background:#FAF9F6;font-size:14px}.name small{display:block;color:#666}.cell{height:126px;background:#FAF9F6;padding:12px;display:grid;place-items:center}.cell>div,.cell>svg{width:96px!important;height:96px!important}`
document.head.appendChild(css)
createRoot(document.getElementById('catalog-matrix-root')!).render(<Matrix />)
