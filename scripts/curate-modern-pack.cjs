/* Release tooling only. Never called by generation or render. Inventory is read-only. */
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const inventory = process.argv[2];
if (!inventory || !path.isAbsolute(inventory)) throw Error('Explicit inventory directory required');
const out = path.resolve(__dirname, '../public/modern-pack-100-v1');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
async function get(url) { const r = await fetch(url); if (!r.ok) throw Error(`${r.status} ${url}`); return Buffer.from(await r.arrayBuffer()); }
async function main() {
  if (fs.existsSync(path.join(out, 'manifest.json'))) throw Error('Immutable pack already exists');
  fs.mkdirSync(path.join(out, 'assets'), {recursive:true}); fs.mkdirSync(path.join(out, 'notices'), {recursive:true});
  const notices = {
    fluent: ['https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/LICENSE','MIT'],
    tabler: ['https://raw.githubusercontent.com/tabler/tabler-icons/main/LICENSE','MIT'],
    ph: ['https://raw.githubusercontent.com/phosphor-icons/core/main/LICENSE','MIT'],
    mingcute: ['https://raw.githubusercontent.com/Richard9394/MingCute/main/LICENSE','Apache-2.0'],
    lucide: ['https://raw.githubusercontent.com/lucide-icons/lucide/main/LICENSE','ISC'],
  };
  const provenance = []; const assets = []; const excluded = [];
  for (const [name,[url,license]] of Object.entries(notices)) {
    const bytes = await get(url); fs.writeFileSync(path.join(out, 'notices', name+'.txt'), bytes);
    provenance.push({collection:name,license,url,sha256:sha(bytes)});
  }
  function add(bytes, row) {
    const upstreamSha256 = sha(bytes);
    // Remove non-rendering XML comments; preserve geometry, colours and copyright notices.
    bytes = Buffer.from(bytes.toString('utf8').replace(/<!--[^]*?-->/g, '').trimStart());
    const hash = sha(bytes);
    if (assets.some(a => a.sha256 === hash)) {excluded.push({name:row.assetId,reason:'duplicate-sha'});return;}
    const text = bytes.toString('utf8');
    if (!/<svg\b/.test(text) || /<script|<foreignObject|<!DOCTYPE|<!ENTITY|\bon\w+\s*=|@import|<image|<text|<animate|<set\b/i.test(text)) throw Error('Unsafe SVG: '+row.assetId);
    const localRelativePath = 'assets/'+row.assetId+'.svg';
    fs.writeFileSync(path.join(out,localRelativePath),bytes);
    assets.push({...row,format:'svg',sha256:hash,localRelativePath,supportAllowed:true,licenseNotice:'notices/'+(row.source==='fluent'?'fluent':row.collection)+'.txt'});
    provenance.push({assetId:row.assetId,upstreamSha256,transform:'strip-xml-comments-only',sha256:hash});
  }
  // One official flat variant per literal concept; no misleading inventory substring matches.
  const fluent = [
    ['Camera','camera','cámara'],['Mobile phone','phone','teléfono'],['Laptop','laptop','portátil'],
    ['Desktop computer','computer','computador'],['Microphone','microphone','micrófono'],['Robot','robot','robot'],
    ['Rocket','rocket','cohete'],['Airplane','airplane','avión'],['Open book','book','libro'],
    ['Calendar','calendar','calendario'],['Alarm clock','alarm clock','despertador'],['Money bag','money bag','bolsa de dinero'],
    ['Factory','factory','fábrica'],['House','house','casa'],['Cityscape','city','ciudad'],['School','school','escuela'],
    ['Hospital','hospital','hospital'],['Stadium','stadium','estadio'],['Soccer ball','football','fútbol'],
    ['Deciduous tree','tree','árbol'],['Seedling','seedling','plántula'],['Fire','fire','fuego'],['Droplet','water drop','gota de agua'],
    ['Brain','brain','cerebro'],['Anatomical heart','anatomical heart','corazón anatómico'],['Ringed planet','planet','planeta'],
    ['Microscope','microscope','microscopio'],['Telescope','telescope','telescopio'],['Hammer','hammer','martillo'],
    ['Wrench','wrench','llave inglesa'],['Gear','gear','engranaje'],['Satellite','satellite','satélite'],
    ['Newspaper','newspaper','periódico'],['File folder','folder','carpeta'],['Light bulb','lightbulb','bombilla'],
  ];
  const tree=JSON.parse((await get('https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/main?recursive=1')).toString());
  if(tree.truncated) throw Error('Fluent tree truncated');
  for (const [name,concept,es] of fluent) {
    const file=tree.tree.find(x=>x.path.startsWith('assets/'+name+'/Flat/') && x.path.endsWith('.svg'));
    if(!file) {excluded.push({name,reason:'official-flat-not-found'});continue;}
    const url='https://raw.githubusercontent.com/microsoft/fluentui-emoji/'+tree.sha+'/'+file.path.split('/').map(encodeURIComponent).join('/');
    add(await get(url),{assetId:'modern-fluent-'+slug(concept)+'-v1',canonicalConcept:concept,aliasesEs:[es],aliasesEn:[],source:'fluent',collection:'fluent-flat',license:'MIT',originalColor:true,styleFamily:'modern-color',heroAllowed:true,priority:100});
    provenance.push({assetId:assets.at(-1).assetId,url,upstreamRevision:tree.sha,upstreamBlob:file.sha});
  }
  const rows=JSON.parse(fs.readFileSync(path.join(inventory,'_manifests/iconify.json'),'utf8'));
  for(const r of rows) {
    if(!r.localPath || r.semanticMatch!=='exact' || r.visualQuality!=='high') continue;
    if(!(r.collection==='mingcute' && r.originalName.endsWith('-fill') || r.collection==='ph' && !r.originalName.endsWith('-bold') || r.collection==='lucide')) continue;
    if(['hide','machine','space'].includes(r.searchedConcept)) {excluded.push({name:r.originalName,reason:'overbroad-or-context-dependent'});continue;}
    const bytes=fs.readFileSync(path.join(inventory,r.localPath)); if(sha(bytes)!==r.sha256) throw Error('Inventory SHA mismatch');
    add(bytes,{assetId:'modern-'+r.collection+'-'+r.originalName+'-v1',canonicalConcept:r.searchedConcept,aliasesEs:[r.searchedConceptEs],aliasesEn:[],source:'iconify',collection:r.collection,license:notices[r.collection][1],originalColor:false,styleFamily:r.collection==='mingcute'?'modern-solid':'modern-line',heroAllowed:r.collection==='mingcute',priority:r.collection==='mingcute'?80:65});
    provenance.push({assetId:assets.at(-1).assetId,url:r.downloadUrl,inventorySha256:r.sha256,upstreamName:r.originalName});
  }
  const tabler=JSON.parse(fs.readFileSync(path.join(inventory,'_manifests/tabler.json'),'utf8'));
  for(const r of tabler) {
    if(!r.localPath || r.semanticMatch!=='exact' || ['computer','machine','question'].includes(r.searchedConcept)) continue;
    const url='https://raw.githubusercontent.com/tabler/tabler-icons/main/icons/outline/'+r.originalName+'.svg';
    add(await get(url),{assetId:'modern-tabler-'+r.originalName+'-v1',canonicalConcept:r.searchedConcept,aliasesEs:[r.searchedConceptEs],aliasesEn:[],source:'tabler',collection:'tabler',license:'MIT',originalColor:false,styleFamily:'modern-line',heroAllowed:false,priority:60});
    provenance.push({assetId:assets.at(-1).assetId,url});
  }
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({schemaVersion:1,packId:'modern-pack-100-v1',revision:'2026-09-v1',assets},null,2)+'\n');
  fs.writeFileSync(path.join(out,'provenance.json'),JSON.stringify({provenance,excluded},null,2)+'\n');
  console.log(JSON.stringify({assets:assets.length,bySource:Object.fromEntries(['fluent','iconify','tabler'].map(s=>[s,assets.filter(a=>a.source===s).length])),excluded}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
