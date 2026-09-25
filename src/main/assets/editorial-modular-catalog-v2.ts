import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { CuratedModularCatalogV1, type ImportedModularAssetV1 } from './editorial-modular-catalog-v1'
import { inspectPixabayRasterImageV1, publishRasterProjectAssetV1 } from './pixabay-images'
import { inspectSupportPngV41 } from './editorial-idea-support-catalog-v4-1'
import { canonicalNarrativeTerm } from '../../shared/asset-intent'
import { EDITORIAL_LOCAL_CATALOG_REVISION_V3 } from '../../shared/editorial-local-bank-v3'
import type { CuratedModularAssetV1, ModularCatalogRoleV1 } from '../../shared/editorial-modular-catalog-v1'

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const norm = (text: string) => canonicalNarrativeTerm(text)
const roles: readonly ModularCatalogRoleV1[] = ['support','hero-core','rear-collage','front-collage','accent-mask','background']
const extensionDir = 'extension-v2'
const safeId = /^[a-z0-9][a-z0-9-]{2,95}$/
const safeRuntime = /^runtime\/[a-z0-9][a-z0-9_-]{1,100}\.png$/

type DynamicEntry = CuratedModularAssetV1 & {
  aliasesEs: string[]; aliasesEn: string[]; literalDescription: string; semanticFamily: string
  runtimeRef: string; runtimeSHA256: string; runtimeDimensions: {width:number;height:number}
  masterSHA256?: string; runtimeTransform?: 'largest-8-connected-alpha-core-morphological-open-v1'|
    'largest-8-connected-alpha-core-morphological-open-and-fill-enclosed-2px-topology-holes-v1'
  surfaceUse?: 'hero-backing-accent-v1'|'thin-ribbon-accent-v1'
  status: 'imported'; aspectClass?: 'vertical'|'wide'|'compact'|'organic'
  colorMode: string; compatibleRelations: string[]; exclusions: string[]
  surfaceProfile?: 'continuous-filled-v1'
}
type BatchManifest = { id:string; entries:DynamicEntry[]; createdAt?:string; provenance?:string }
type ActivePointer = { revision:string; batches:{id:string;manifestSHA256:string}[] }
// ImageGen's opaque paper can carry alpha 254 across the entire sheet. Count >=240
// (at least 94% coverage) as the filled core; keep exact-alpha rules for backgrounds.
type AlphaProbe = { width:number;height:number;alpha:Uint8Array;left:number;top:number;right:number;bottom:number;transparent:number;partial:number;opaque:number;solidCore:number }
export type EditorialCatalogBatchPreviewV2 = {
  batchId:string; accepted:number; metadataRevisions:number; duplicates:number
  rejected:{assetId?:string;reason:string}[]; entries:{assetId:string;role:ModularCatalogRoleV1;decision:'new'|'metadata-revision'|'duplicate'}[]
}

function resolvedChild(root:string, relative:string):string {
  const base=fs.realpathSync(root), absolute=path.resolve(base,...relative.split('/'))
  if(!absolute.startsWith(base+path.sep))throw new Error('EDITORIAL_CATALOG_PATH_ESCAPE')
  const real=fs.realpathSync(absolute), rel=path.relative(base,real)
  if(!rel||rel.startsWith('..')||path.isAbsolute(rel)||fs.lstatSync(absolute).isSymbolicLink())
    throw new Error('EDITORIAL_CATALOG_PATH_ESCAPE')
  return real
}

/** Decoder intentionally accepts only the imagegen PNG subset used by the catalog.
 * It inspects actual decoded alpha rather than trusting an IHDR alpha flag. */
function decodeRgbaAlpha(bytes:Buffer,allowOpaqueRgb=false):AlphaProbe {
  const signature=Buffer.from([137,80,78,71,13,10,26,10])
  if(!bytes.subarray(0,8).equals(signature))throw new Error('EDITORIAL_BATCH_NOT_PNG')
  let offset=8,width=0,height=0,depth=0,colorType=0,interlace=0
  const compressed:Buffer[]=[]
  while(offset+12<=bytes.length){
    const length=bytes.readUInt32BE(offset),kind=bytes.toString('ascii',offset+4,offset+8)
    if(offset+12+length>bytes.length)throw new Error('EDITORIAL_BATCH_PNG_TRUNCATED')
    const data=bytes.subarray(offset+8,offset+8+length)
    if(kind==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);depth=data[8];colorType=data[9];interlace=data[12]}
    if(kind==='IDAT')compressed.push(data)
    offset+=12+length
    if(kind==='IEND')break
  }
  const channels=colorType===6?4:colorType===2&&allowOpaqueRgb?3:0
  if(!width||!height||width>4096||height>4096||depth!==8||!channels||interlace!==0)
    throw new Error('EDITORIAL_BATCH_PNG_UNSUPPORTED')
  const stride=width*channels,raw=inflateSync(Buffer.concat(compressed)),alpha=new Uint8Array(width*height)
  if(raw.length!==(stride+1)*height)throw new Error('EDITORIAL_BATCH_PNG_TRUNCATED')
  let prior=new Uint8Array(stride),cursor=0,left=width,top=height,right=-1,bottom=-1,transparent=0,partial=0,opaque=0,solidCore=0
  for(let y=0;y<height;y++){
    const filter=raw[cursor++],row=new Uint8Array(raw.subarray(cursor,cursor+stride));cursor+=stride
    for(let x=0;x<stride;x++){
      const a=x>=channels?row[x-channels]:0,b=prior[x],c=x>=channels?prior[x-channels]:0
      if(filter===1)row[x]=(row[x]+a)&255
      else if(filter===2)row[x]=(row[x]+b)&255
      else if(filter===3)row[x]=(row[x]+Math.floor((a+b)/2))&255
      else if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);row[x]=(row[x]+(pa<=pb&&pa<=pc?a:pb<=pc?b:c))&255}
      else if(filter!==0)throw new Error('EDITORIAL_BATCH_PNG_FILTER_UNSUPPORTED')
    }
    for(let x=0;x<width;x++){
      const value=channels===4?row[x*4+3]:255,i=y*width+x;alpha[i]=value
      if(value===0)transparent++
      else {if(value===255)opaque++;else partial++;if(value>=240)solidCore++;if(x<left)left=x;if(x>right)right=x;if(y<top)top=y;if(y>bottom)bottom=y}
    }
    prior=row
  }
  if(right<left||bottom<top)throw new Error('EDITORIAL_BATCH_PNG_EMPTY')
  return {width,height,alpha,left,top,right,bottom,transparent,partial,opaque,solidCore}
}

/** New collage/accent layers must be one continuous filled surface. Evaluate a 2px
 * topology grid to tolerate edge antialiasing while rejecting interior windows and
 * meaningful detached fragments. Historical V1 files never pass this validator. */
function assertContinuousSurface(probe:AlphaProbe):void{
  const width=Math.ceil((probe.right-probe.left+1)/2),height=Math.ceil((probe.bottom-probe.top+1)/2),size=width*height
  if(width<8||height<8)throw new Error('EDITORIAL_LAYER_SURFACE_TOO_SMALL')
  const solid=new Uint8Array(size)
  for(let gy=0;gy<height;gy++)for(let gx=0;gx<width;gx++){
    let present=false
    for(let dy=0;dy<2&&!present;dy++)for(let dx=0;dx<2&&!present;dx++){
      const x=probe.left+gx*2+dx,y=probe.top+gy*2+dy
      if(x<=probe.right&&y<=probe.bottom&&probe.alpha[y*probe.width+x]>=16)present=true
    }
    if(present)solid[gy*width+gx]=1
  }
  const outside=new Uint8Array(size),queue=new Uint32Array(size);let head=0,tail=0
  const pushOutside=(index:number)=>{if(!solid[index]&&!outside[index]){outside[index]=1;queue[tail++]=index}}
  for(let x=0;x<width;x++){pushOutside(x);pushOutside((height-1)*width+x)}
  for(let y=0;y<height;y++){pushOutside(y*width);pushOutside(y*width+width-1)}
  while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width)
    if(x>0)pushOutside(i-1);if(x+1<width)pushOutside(i+1);if(y>0)pushOutside(i-width);if(y+1<height)pushOutside(i+width)}
  let holes=0,visible=0
  for(let i=0;i<size;i++){if(solid[i])visible++;else if(!outside[i])holes++}
  if(holes>Math.max(2,Math.floor(size*.00002)))throw new Error('EDITORIAL_LAYER_INTERNAL_ALPHA_HOLE')
  const seen=new Uint8Array(size);let maxComponent=0
  for(let i=0;i<size;i++)if(solid[i]&&!seen[i]){
    head=0;tail=0;queue[tail++]=i;seen[i]=1;let component=0
    while(head<tail){const at=queue[head++],x=at%width,y=Math.floor(at/width);component++
      const visit=(next:number)=>{if(solid[next]&&!seen[next]){seen[next]=1;queue[tail++]=next}}
      if(x>0)visit(at-1);if(x+1<width)visit(at+1);if(y>0)visit(at-width);if(y+1<height)visit(at+width)
    }
    maxComponent=Math.max(maxComponent,component)
  }
  if(!visible||maxComponent/visible<.99)throw new Error('EDITORIAL_LAYER_DETACHED_ALPHA_COMPONENT')
}

function validateBytes(entry:DynamicEntry,bytes:Buffer):void {
  const hasDerivedRuntime=entry.masterSHA256!==undefined||entry.runtimeTransform!==undefined
  if(sha(bytes)!==entry.sha256||entry.runtimeSHA256!==entry.sha256||
      (hasDerivedRuntime&&(!/^[a-f0-9]{64}$/.test(entry.masterSHA256??'')||
        !['largest-8-connected-alpha-core-morphological-open-v1',
          'largest-8-connected-alpha-core-morphological-open-and-fill-enclosed-2px-topology-holes-v1'].includes(entry.runtimeTransform??''))))
    throw new Error('EDITORIAL_BATCH_SHA_MISMATCH')
  if(!roles.includes(entry.role)||!safeId.test(entry.assetId)||!safeRuntime.test(entry.runtimeRef)||
      !entry.primaryWordEs?.trim()||entry.primaryWordEs.length>80||!Array.isArray(entry.aliasesEs)||
      !Array.isArray(entry.aliasesEn)||!entry.literalDescription?.trim()||entry.literalDescription.length>400||
      !entry.semanticFamily?.trim()||entry.semanticFamily.length>80||
      [...entry.aliasesEs,...entry.aliasesEn].some(alias=>typeof alias!=='string'||!alias.trim()||alias.length>80)||
      !Array.isArray(entry.compatibleRelations)||!Array.isArray(entry.exclusions)||
      !['none','alpha-mask','original-color'].includes(entry.colorCapability)||
      (entry.role==='support'&&entry.colorCapability!=='alpha-mask')||
      (entry.role==='hero-core'&&entry.colorCapability!=='none')||
      (['rear-collage','front-collage'].includes(entry.role)&&entry.colorCapability!=='none')||
      (entry.role==='accent-mask'&&entry.colorCapability!=='alpha-mask')||
      (entry.role==='background'&&entry.colorCapability!=='none')||
      (['rear-collage','front-collage','accent-mask'].includes(entry.role)&&entry.surfaceProfile!=='continuous-filled-v1')||
      (!['rear-collage','front-collage','accent-mask'].includes(entry.role)&&entry.surfaceProfile!==undefined)||
      (entry.surfaceUse!==undefined&&(!['hero-backing-accent-v1','thin-ribbon-accent-v1'].includes(entry.surfaceUse)||
        entry.role!=='accent-mask')))
    throw new Error('EDITORIAL_BATCH_ENTRY_INVALID')
  const info=inspectPixabayRasterImageV1(bytes),alpha=decodeRgbaAlpha(bytes,entry.role==='background')
  if(info.mime!=='image/png'||info.width!==alpha.width||info.height!==alpha.height||
      entry.runtimeDimensions?.width!==alpha.width||entry.runtimeDimensions?.height!==alpha.height)
    throw new Error('EDITORIAL_BATCH_DIMENSIONS_INVALID')
  const total=alpha.width*alpha.height,visible=total-alpha.transparent
  if(entry.role==='support'){
    const report=inspectSupportPngV41(bytes)
    if(alpha.transparent<total*.1||visible<total*.002||
       report.chromaticVisiblePixels>Math.max(12,(report.partialAlphaPixels+report.opaquePixels)*.001))
      throw new Error('EDITORIAL_BATCH_SUPPORT_ALPHA_OR_COLOR_INVALID')
  } else if(entry.role==='accent-mask'){
    const box=(alpha.right-alpha.left+1)*(alpha.bottom-alpha.top+1),cx=Math.floor((alpha.left+alpha.right)/2),cy=Math.floor((alpha.top+alpha.bottom)/2)
    // Organic torn silhouettes may occupy less than 72% of their rectangular
    // bounds; connected-surface topology below remains the stronger hole/island guard.
    if(alpha.alpha[cy*alpha.width+cx]<240||visible<total*.02||visible>total*.92||
       alpha.solidCore<box*.4)
      throw new Error('EDITORIAL_BATCH_ACCENT_NOT_SOLID')
    assertContinuousSurface(alpha)
  } else if(entry.role==='rear-collage'||entry.role==='front-collage'){
    const cx=Math.floor((alpha.left+alpha.right)/2),cy=Math.floor((alpha.top+alpha.bottom)/2),box=(alpha.right-alpha.left+1)*(alpha.bottom-alpha.top+1)
    if(alpha.alpha[cy*alpha.width+cx]<220||visible<total*.06||visible>total*.97||
       alpha.solidCore<box*.55)
      throw new Error('EDITORIAL_BATCH_PAPER_CENTER_OR_ALPHA_INVALID')
    assertContinuousSurface(alpha)
  } else if(entry.role==='background'){
    if(alpha.opaque!==total||alpha.partial!==0)throw new Error('EDITORIAL_BATCH_BACKGROUND_MUST_BE_OPAQUE')
  } else if(visible<total*.015||visible>total*.995)throw new Error('EDITORIAL_BATCH_HERO_ALPHA_INVALID')
}

function readBatch(folder:string):{manifest:BatchManifest;bytes:Buffer;manifestPath:string} {
  const root=fs.realpathSync(folder),manifestPath=path.join(root,'manifest.json'),bytes=fs.readFileSync(manifestPath)
  const manifest=JSON.parse(bytes.toString('utf8')) as BatchManifest
  if(!manifest||!safeId.test(manifest.id)||!Array.isArray(manifest.entries)||manifest.entries.length<1||manifest.entries.length>25)
    throw new Error('EDITORIAL_BATCH_MANIFEST_INVALID')
  return {manifest,bytes,manifestPath}
}

/** Extensible composite over the immutable 250 roster. New runtime files are loaded
 * only through activated, SHA-pinned batch snapshots under extension-v2/. */
export class CuratedModularCatalogV2 {
  readonly catalogRevision=EDITORIAL_LOCAL_CATALOG_REVISION_V3
  private readonly root:string
  private readonly base:CuratedModularCatalogV1
  private readonly baseInventory:Map<string,any>
  private readonly extensionEntries=new Map<string,DynamicEntry>()
  private readonly batchFolders=new Map<string,string>()
  constructor(catalogRoot:string){
    this.base=new CuratedModularCatalogV1(catalogRoot)
    this.root=fs.realpathSync(catalogRoot)
    const raw=JSON.parse(fs.readFileSync(path.join(this.root,'inventory.json'),'utf8')) as {entries:any[]}
    this.baseInventory=new Map(raw.entries.map(entry=>[entry.assetId,entry]))
    const activePath=path.join(this.root,extensionDir,'active.json')
    if(!fs.existsSync(activePath))return
    const active=JSON.parse(fs.readFileSync(activePath,'utf8')) as ActivePointer
    if(active.revision!==this.catalogRevision||!Array.isArray(active.batches))throw new Error('EDITORIAL_EXTENSION_POINTER_INVALID')
    for(const pointer of active.batches){
      if(!safeId.test(pointer.id)||!/^[a-f0-9]{64}$/.test(pointer.manifestSHA256))throw new Error('EDITORIAL_EXTENSION_POINTER_INVALID')
      const folder=path.join(this.root,extensionDir,'batches',pointer.id)
      const manifestBytes=fs.readFileSync(path.join(folder,'manifest.json'))
      if(sha(manifestBytes)!==pointer.manifestSHA256)throw new Error('EDITORIAL_EXTENSION_BATCH_SHA_MISMATCH:'+pointer.id)
      const manifest=JSON.parse(manifestBytes.toString('utf8')) as BatchManifest
      if(manifest.id!==pointer.id||!Array.isArray(manifest.entries))throw new Error('EDITORIAL_EXTENSION_BATCH_INVALID')
      for(const entry of manifest.entries){
        if(!entry||!safeId.test(entry.assetId)||!roles.includes(entry.role)||!safeRuntime.test(entry.runtimeRef))throw new Error('EDITORIAL_EXTENSION_ENTRY_INVALID')
        this.extensionEntries.set(entry.assetId,entry);this.batchFolders.set(entry.assetId,folder)
      }
    }
    for(const [id,entry] of this.extensionEntries){
      const bytes=fs.readFileSync(resolvedChild(this.batchFolders.get(id)!,entry.runtimeRef))
      validateBytes(entry,bytes)
    }
  }
  entries():readonly CuratedModularAssetV1[]{return [...this.base.entries(),...this.extensionEntries.values()]}
  getById(assetId:string):CuratedModularAssetV1|undefined{
    return this.extensionEntries.get(assetId)??this.base.getById(assetId)
  }
  aspectClass(assetId:string):DynamicEntry['aspectClass']{
    return this.extensionEntries.get(assetId)?.aspectClass??this.base.aspectClass(assetId)
  }
  search(terms:readonly string[],role?:ModularCatalogRoleV1):readonly CuratedModularAssetV1[]{
    const exact=new Set(terms.map(norm).filter(Boolean))
    if(!exact.size)return []
    return this.entries().filter(asset=>{
      if(role&&asset.role!==role||!this.getById(asset.assetId))return false
      const base=this.baseInventory.get(asset.assetId),dynamic=this.extensionEntries.get(asset.assetId)
      const words=dynamic?[dynamic.primaryWordEs,...dynamic.aliasesEs,...dynamic.aliasesEn]:
        base?[base.primaryWordEs,...(base.aliasesEs??[]),...(base.aliasesEn??[])]:[asset.primaryWordEs]
      return words.some(word=>exact.has(norm(word)))
    })
  }
  searchEditorialLocalV2(term:string,role:ModularCatalogRoleV1):readonly {asset:CuratedModularAssetV1;match:'primary'|'alias'|'inflection'}[]{
    const key=norm(term);if(!key)return []
    const results:{asset:CuratedModularAssetV1;match:'primary'|'alias'|'inflection'}[]=[]
    const inflect=(a:string,b:string)=>!a.includes(' ')&&!b.includes(' ')&&
      ((a.length>=3&&(b===a+'s'||b===a+'es'))||(b.length>=3&&(a===b+'s'||a===b+'es')))
    for(const asset of this.entries()){
      if(asset.role!==role||!this.getById(asset.assetId))continue
      const dynamic=this.extensionEntries.get(asset.assetId),base=this.baseInventory.get(asset.assetId)
      const primary=norm(dynamic?.primaryWordEs??base?.primaryWordEs??asset.primaryWordEs)
      const aliases=(dynamic?[...dynamic.aliasesEs,...dynamic.aliasesEn]:base?[...(base.aliasesEs??[]),...(base.aliasesEn??[])]:[]).map(norm)
      const match=primary===key?'primary':aliases.includes(key)?'alias':[primary,...aliases].some(word=>inflect(key,word))?'inflection':null
      if(match)results.push({asset,match})
    }
    const order={primary:0,alias:1,inflection:2}
    return results.sort((a,b)=>order[a.match]-order[b.match]||a.asset.assetId.localeCompare(b.asset.assetId))
  }
  getVariants(term:string):readonly CuratedModularAssetV1[]{return this.search([term])}
  resolveAsset(assetId:string):Buffer{
    const entry=this.extensionEntries.get(assetId)
    if(!entry)return this.base.resolveAsset(assetId)
    const bytes=fs.readFileSync(resolvedChild(this.batchFolders.get(assetId)!,entry.runtimeRef));validateBytes(entry,bytes);return bytes
  }
  publish(projectRoot:string,assetId:string):ImportedModularAssetV1{
    const curated=this.getById(assetId);if(!curated)throw new Error('MODULAR_ASSET_NOT_CURATED:'+assetId)
    const bytes=this.resolveAsset(assetId)
    const result=publishRasterProjectAssetV1({projectRoot,provider:'editorial_modular_v2',assetId,bytes,
      requireUsefulAlpha:curated.role!=='background',source:{providerVersion:this.catalogRevision,attribution:'Locally curated editorial modular catalog extension'},
      validationRevision:'editorial-modular-raster-2026-09-v2'})
    if(result.asset.sha256!==curated.sha256)throw new Error('MODULAR_PUBLISHED_SHA_MISMATCH')
    return {asset:result.asset,curated}
  }
  verifyAll():{listed:number;verified:number;failures:{assetId:string;error:string}[]}{
    const failures:{assetId:string;error:string}[]=[];let verified=0
    for(const asset of this.entries())try{this.resolveAsset(asset.assetId);verified++}catch(error){failures.push({assetId:asset.assetId,error:String(error)})}
    return {listed:this.entries().length,verified,failures}
  }
}

export type ModularCatalogProviderV2=Pick<CuratedModularCatalogV1,
  'entries'|'getById'|'search'|'searchEditorialLocalV2'|'getVariants'|'aspectClass'|'resolveAsset'|'publish'> &
  {catalogRevision?:string}

export function previewEditorialCatalogBatchV2(catalogRoot:string,batchFolder:string):EditorialCatalogBatchPreviewV2{
  const catalog=new CuratedModularCatalogV2(catalogRoot),{manifest}=readBatch(batchFolder)
  const ids=new Set<string>(),shas=new Set(catalog.entries().map(entry=>entry.sha256))
  const preview:EditorialCatalogBatchPreviewV2={batchId:manifest.id,accepted:0,metadataRevisions:0,duplicates:0,rejected:[],entries:[]}
  for(const raw of manifest.entries){
    try{
      const entry=raw as DynamicEntry
      if(!entry||ids.has(entry.assetId))throw new Error('DUPLICATE_ID_IN_BATCH')
      ids.add(entry.assetId)
      const file=resolvedChild(batchFolder,entry.runtimeRef),assetBytes=fs.readFileSync(file);validateBytes(entry,assetBytes)
      const existing=catalog.getById(entry.assetId)
      if(existing){
        if(existing.role!==entry.role||existing.sha256!==entry.sha256)throw new Error('ID_COLLISION_REQUIRES_NEW_ASSET_ID')
        preview.metadataRevisions++;preview.entries.push({assetId:entry.assetId,role:entry.role,decision:'metadata-revision'});continue
      }
      if(shas.has(entry.sha256)){preview.duplicates++;preview.entries.push({assetId:entry.assetId,role:entry.role,decision:'duplicate'});continue}
      shas.add(entry.sha256);preview.accepted++;preview.entries.push({assetId:entry.assetId,role:entry.role,decision:'new'})
    }catch(error){preview.rejected.push({assetId:(raw as any)?.assetId,reason:error instanceof Error?error.message:String(error)})}
  }
  if(preview.rejected.length)preview.rejected.push({reason:'BATCH_ATOMIC_REJECTION'})
  return preview
}

export function activateEditorialCatalogBatchV2(catalogRoot:string,batchFolder:string):EditorialCatalogBatchPreviewV2{
  const preview=previewEditorialCatalogBatchV2(catalogRoot,batchFolder)
  if(preview.rejected.length||(!preview.accepted&&!preview.metadataRevisions))throw new Error('EDITORIAL_BATCH_ATOMIC_REJECT:'+JSON.stringify(preview))
  const {manifest}=readBatch(batchFolder),root=fs.realpathSync(catalogRoot),extension=path.join(root,extensionDir)
  const decisions=new Map(preview.entries.map(item=>[item.assetId,item.decision]))
  const filteredManifest:BatchManifest={...manifest,entries:manifest.entries.filter(entry=>decisions.get(entry.assetId)!=='duplicate')}
  const bytes=Buffer.from(JSON.stringify(filteredManifest,null,2)+'\n')
  const batches=path.join(extension,'batches'),target=path.join(batches,manifest.id)
  fs.mkdirSync(batches,{recursive:true})
  if(fs.existsSync(target))throw new Error('EDITORIAL_BATCH_ID_ALREADY_INSTALLED')
  const activePath=path.join(extension,'active.json'),previousPath=path.join(extension,'active-previous.json')
  const hadActive=fs.existsSync(activePath),priorBytes=hadActive?fs.readFileSync(activePath):undefined
  const hadPrevious=fs.existsSync(previousPath),priorPreviousBytes=hadPrevious?fs.readFileSync(previousPath):undefined
  const staging=path.join(extension,`.staging-${manifest.id}-${Date.now()}`);fs.mkdirSync(path.join(staging,'runtime'),{recursive:true})
  try{
    fs.writeFileSync(path.join(staging,'manifest.json'),bytes)
    for(const entry of manifest.entries){const source=resolvedChild(batchFolder,entry.runtimeRef)
      const targetRuntime=path.join(staging,...entry.runtimeRef.split('/'));fs.mkdirSync(path.dirname(targetRuntime),{recursive:true});fs.copyFileSync(source,targetRuntime)}
    fs.renameSync(staging,target)
    const active:ActivePointer=hadActive?JSON.parse(priorBytes!.toString('utf8')):
      {revision:EDITORIAL_LOCAL_CATALOG_REVISION_V3,batches:[]}
    const next:ActivePointer={revision:EDITORIAL_LOCAL_CATALOG_REVISION_V3,
      batches:[...active.batches.filter(item=>item.id!==manifest.id),{id:manifest.id,manifestSHA256:sha(bytes)}]}
    const tmp=path.join(extension,`active-${Date.now()}.tmp`)
    if(priorBytes)fs.writeFileSync(previousPath,priorBytes)
    fs.writeFileSync(tmp,JSON.stringify(next,null,2)+'\n')
    fs.renameSync(tmp,activePath)
    const validation=new CuratedModularCatalogV2(root).verifyAll()
    if(validation.failures.length||validation.verified!==validation.listed)
      throw new Error('EDITORIAL_BATCH_POST_ACTIVATION_VERIFY_FAILED:'+JSON.stringify(validation.failures.slice(0,5)))
    return preview
  }catch(error){
    // Restore the prior pointer if validation failed after the atomic pointer swap.
    if(priorBytes){
      const restore=path.join(extension,`restore-${Date.now()}.tmp`)
      fs.writeFileSync(restore,priorBytes);fs.renameSync(restore,activePath)
    }else if(fs.existsSync(activePath))fs.rmSync(activePath,{force:true})
    if(priorPreviousBytes)fs.writeFileSync(previousPath,priorPreviousBytes)
    else if(fs.existsSync(previousPath))fs.rmSync(previousPath,{force:true})
    if(fs.existsSync(target))fs.rmSync(target,{recursive:true,force:true})
    throw error
  }finally{if(fs.existsSync(staging))fs.rmSync(staging,{recursive:true,force:true})}
}

export function rollbackEditorialCatalogSnapshotV2(catalogRoot:string):void{
  const extension=path.join(fs.realpathSync(catalogRoot),extensionDir),previous=path.join(extension,'active-previous.json'),active=path.join(extension,'active.json')
  if(!fs.existsSync(previous))throw new Error('EDITORIAL_NO_PREVIOUS_SNAPSHOT')
  const snapshot=JSON.parse(fs.readFileSync(previous,'utf8')) as ActivePointer
  for(const item of snapshot.batches){const manifest=fs.readFileSync(path.join(extension,'batches',item.id,'manifest.json'))
    if(sha(manifest)!==item.manifestSHA256)throw new Error('EDITORIAL_PREVIOUS_SNAPSHOT_INVALID')}
  const tmp=path.join(extension,`rollback-${Date.now()}.tmp`);fs.copyFileSync(previous,tmp);fs.renameSync(tmp,active)
  const result=new CuratedModularCatalogV2(catalogRoot).verifyAll();if(result.failures.length)throw new Error('EDITORIAL_ROLLBACK_SNAPSHOT_INVALID')
}
