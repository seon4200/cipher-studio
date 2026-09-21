// Small external SVG catalog from the repository's licensed Lucide dependency.
// It uses the existing LocalManifestCatalog; no renderer/catalog fork and no network.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const assert=require('node:assert/strict')
const React=require('react'),ReactDOMServer=require('react-dom/server')
const names=require('../../fixtures/editorial-explainer-v3-supports')
const components={light:'Lightbulb',spark:'Sparkles',antenna:'Antenna',connection:'Cable',gear:'Cog',factory:'Factory',
  database:'Database',arrow:'MoveRight',person:'UserRound',document:'FileText',chart:'ChartNoAxesCombined',clock:'Clock3',camera:'Camera',brain:'Brain'}
const targetRoot=process.argv[2]
assert(targetRoot&&path.isAbsolute(targetRoot),'usage: node build-local-library.cjs <external-catalog-root>')
const repo=path.resolve(__dirname,'../../..')
assert(!targetRoot.toLowerCase().startsWith(repo.toLowerCase()+path.sep),'catalog must be outside repository')
async function main(){
  const Lucide=await import('lucide-react')
  const pairs=names.map(name=>[name,name,name,components[name]])
  fs.mkdirSync(path.join(targetRoot,'assets'),{recursive:true})
  fs.mkdirSync(path.join(targetRoot,'notices'),{recursive:true})
  const notice='notices/lucide.txt'
  fs.copyFileSync(path.join(repo,'public/modern-pack-100-v1/notices/lucide.txt'),path.join(targetRoot,notice))
  const entries=pairs.map(([name,es,en,component])=>{
    assert(Lucide[component],`Lucide icon absent: ${component}`)
    const svg=ReactDOMServer.renderToStaticMarkup(React.createElement(Lucide[component],
      {width:64,height:64,strokeWidth:1.8,'aria-hidden':true}))
    assert(/^<svg(?:\s|>)/u.test(svg),`Not root SVG: ${component}`)
    const bytes=Buffer.from(svg,'utf8'),sha256=crypto.createHash('sha256').update(bytes).digest('hex')
    const localRelativePath=`assets/${name}.svg`
    fs.writeFileSync(path.join(targetRoot,localRelativePath),bytes)
    return {assetId:`local-editorial-v3-${name}`,canonicalConcept:en,aliasesEs:[es],aliasesEn:[en],
      source:'lucide',collection:'lucide',license:'ISC',licenseNotice:notice,format:'svg',sha256,
      originalColor:false,styleFamily:'modern-line',heroAllowed:false,supportAllowed:true,priority:80,
      localRelativePath,quality:3}
  })
  const manifest={schemaVersion:1,packId:'local-editorial-v3-supports',revision:'2026-09-v3',
    collections:[{source:'lucide',collection:'lucide',license:'ISC',licenseNotice:notice,
      styleFamily:'modern-line',licenseApproved:true,reviewedBy:'Cipher technical pilot: bundled Lucide ISC notice',
      reviewedAt:'2026-09-20T00:00:00.000Z'}],assets:entries}
  fs.writeFileSync(path.join(targetRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
  console.log('EDITORIAL_V3_LOCAL_LIBRARY',JSON.stringify({root:targetRoot,count:entries.length,
    shas:entries.map(x=>x.sha256)}))
}
main().catch(error=>{console.error(error);process.exitCode=1})
