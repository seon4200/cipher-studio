const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {spawnSync}=require('node:child_process')
const root=path.resolve(__dirname,'../../..')
const out=path.resolve(root,'../_cipher-editorial-finish-v1-1/evidence')
const names=['arrow-accent','dotted-halo','dot-flow-scale','light-pulse-pulse',
  'accent-link-scale','effects-off','effects-discreto','effects-enfasis',
  'type-fraunces','type-instrument','type-bricolage']
const ffmpeg=process.env.CIPHER_FFMPEG_EXE||'ffmpeg'
const html=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;')
let baseline
const records=names.map(name=>{
  const dir=path.join(out,'comparisons',name)
  const result=JSON.parse(fs.readFileSync(path.join(dir,'F11-portrait.json'),'utf8'))
  assert.equal(result.source,'CIPHER_V15_RENDER')
  assert.equal(result.networkAttempts,0)
  if(!baseline)baseline=result
  assert.deepEqual(result.supports,baseline.supports,
    'ASSETS_DIFFER_IN_COMPARISON:'+name)
  assert.deepEqual(result.relations,baseline.relations,
    'SEMANTIC_RELATION_DIFFER_IN_COMPARISON:'+name)
  assert.deepEqual(result.routes,baseline.routes,
    'GEOMETRY_DIFFERS_IN_COMPARISON:'+name)
  const mobile={}
  for(const phase of ['peak','stable']){
    const source=path.join(dir,`F11-portrait-${phase}.png`)
    const target=path.join(dir,`F11-mobile-${phase}.png`)
    const done=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',source,
      '-vf','scale=360:-1',target],{encoding:'utf8'})
    if(done.status!==0)throw new Error('MOBILE_PREVIEW_FAILED:'+name+':'+done.stderr)
    mobile[phase]=path.relative(out,target).replaceAll('\\','/')
  }
  return {name,record:result,mobile}
})
const groups=[['Representación y recepción',records.slice(0,5)],
  ['Efectos: apagado / discreto / énfasis',records.slice(5,8)],
  ['Tipografía con mismo texto y assets',records.slice(8)]]
const cards=group=>group.map(({name,record,mobile})=>`<article><h3>${html(name)}</h3>`+
  `<p>${html(record.display)} · ${html(record.representation)} / ${html(record.response)} · `+
  `${html(record.local)} / ${html(record.ambient)}</p>`+
  `<div class="pair"><figure><img src="${html(mobile.peak)}"><figcaption>Pico local · 360 px</figcaption></figure>`+
  `<figure><img src="${html(mobile.stable)}"><figcaption>Lectura estable · 360 px</figcaption></figure></div>`+
  `<p><a href="comparisons/${html(name)}/F11-portrait.mp4">MP4 real</a> · `+
  `<a href="comparisons/${html(name)}/F11-portrait.json">Contrato</a></p></article>`).join('')
const page=`<!doctype html><html lang="es"><meta charset="utf-8"><title>Cipher · comparaciones V1.1</title>`+
  `<style>body{background:#1d1d1d;color:#f8f4eb;font-family:system-ui;margin:24px}section{margin-bottom:42px}`+
  `.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px}`+
  `article{background:#303030;padding:14px;border-radius:10px}.pair{display:flex;gap:8px}`+
  `figure{margin:0;flex:1}img{width:100%;height:290px;object-fit:contain;background:#f0eee8}`+
  `figcaption{font-size:12px;padding-top:5px;color:#ddd}a{color:#f8a56d}</style>`+
  `<h1>Acabado editorial V1.1 · A/B controlado</h1><p>F11, mismos assets, texto, relaciones, `+
  `rutas, duración y composición. Los fotogramas muestran pico y tramo posterior a 360 px.</p>`+
  groups.map(([title,group])=>`<section><h2>${html(title)}</h2><div class="grid">${cards(group)}</div></section>`).join('')+
  `</html>`
fs.writeFileSync(path.join(out,'comparisons.html'),page)
fs.writeFileSync(path.join(out,'comparisons.json'),JSON.stringify({passed:true,variants:names,
  sameAssets:true,sameRelations:true,sameGeometry:true,mobileWidth:360},null,2)+'\n')
console.log(JSON.stringify({passed:true,variants:names.length,output:path.join(out,'comparisons.html')}))
