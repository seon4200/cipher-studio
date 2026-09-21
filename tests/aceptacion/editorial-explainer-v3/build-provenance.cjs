const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict')
const {spawnSync}=require('node:child_process')
const root=process.argv[2];assert(root&&path.isAbsolute(root),'absolute library root required')
const promptSummary={idea:'plaster profile, bulb and layered editorial paper',signal:'ivory receiver, antenna, cable and technical paper',system:'interlocking porcelain modules and orange keystone',parts:'three tactile interlocking blocks',camera:'ivory precision camera module',network:'modular network node with orange center',machine:'ivory clockwork with orange gear',data:'ivory data capsule',transfer:'editorial transfer arrow'}
const candidates=[
 ['idea',1,'candidates/idea/hero-idea-candidate-01.png','rejected',null,'baked dark background'],
 ['idea',2,'candidates/idea/hero-idea-candidate-02.png','rejected',null,'baked dark background'],
 ['idea',3,'candidates/idea/hero-idea-candidate-03.png','selected','runtime/hero-idea-candidate-03.png','clean transparent silhouette'],
 ['signal',1,'candidates/signal/hero-signal-candidate-01.png','rejected',null,'baked dark background'],
 ['signal',2,'candidates/signal/hero-signal-candidate-02.png','selected','runtime/hero-signal-candidate-02.png','clean transparent silhouette'],
 ['signal',3,'candidates/signal/hero-signal-candidate-03.png','rejected',null,'baked dark background'],
 ['system',1,'candidates/pieces/hero-pieces-candidate-01.png','rejected',null,'baked dark background'],
 ['system',2,'candidates/pieces/hero-pieces-candidate-02.png','rejected',null,'baked dark background'],
 ['system',3,'candidates/pieces/hero-pieces-candidate-03.png','selected','runtime/hero-pieces-candidate-03.png','clean transparent silhouette'],
 ['network',1,'candidates/clean/exec-ba7327c2-062e-4bfa-bb82-51a545e42f40.png','rejected',null,'baked dark background'],
 ['parts',1,'candidates/clean/exec-87d4b250-1138-4ebf-8a90-85735069aa5f.png','selected','runtime/clean-interlocking-blocks.png','clean transparent silhouette'],
 ['camera',1,'candidates/clean/exec-17d12201-c53c-456c-8eff-9b896b44cf46.png','selected','runtime/clean-camera-module.png','clean transparent silhouette'],
 ['data',1,'candidates/clean/exec-3f924cf9-ea49-4f24-87ef-d716b545bd09.png','rejected',null,'baked dark background'],
 ['transfer',1,'candidates/clean/exec-97ef7c89-3276-4930-9797-034d21ceef34.png','rejected',null,'baked dark background'],
 ['network',2,'candidates/clean/exec-118c113c-9a14-49c5-85ff-e08167224a61.png','selected','runtime/clean-network-node.png','clean transparent silhouette'],
 ['machine',1,'candidates/clean/exec-b616213f-c6a4-426f-9d2d-b3fa9a8e4536.png','selected','runtime/clean-clockwork-module.png','clean transparent silhouette'],
]
const selectedIdentity={
 'idea:3':['v3-composite-idea','composite-hero',['idea','light','creativity']],
 'signal:2':['v3-composite-signal','composite-hero',['signal','communication','connection']],
 'system:3':['v3-composite-pieces','composite-hero',['system','parts','pieces','construction']],
 'parts:1':['v3-clean-blocks','clean-hero',['parts','construction','process']],
 'camera:1':['v3-clean-camera','clean-hero',['camera','lens','record']],
 'network:2':['v3-clean-network','clean-hero',['network','connection','process']],
 'machine:1':['v3-clean-clockwork','clean-hero',['machine','gear','system']],
}
const probe=file=>{const result=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,pix_fmt','-of','json',file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);const s=JSON.parse(result.stdout).streams[0];return {width:s.width,height:s.height,hasAlpha:/a/u.test(s.pix_fmt)}}
const records=candidates.map(([concept,number,relative,status,runtimeRelativePath,notes])=>{const abs=path.join(root,relative),bytes=fs.readFileSync(abs),dimensions=probe(abs),selected=selectedIdentity[`${concept}:${number}`]
 return {id:selected?.[0]||`v3-${concept}-candidate-${String(number).padStart(2,'0')}`,concept,assetType:selected?.[1]||'candidate-hero',styleRevision:'editorial-explainer-art-direction-2026-09-v3',generationProvider:'OpenAI built-in image generation',generationModel:'built-in image_gen',generationPrompt:promptSummary[concept],generationDate:'2026-09-21',candidateNumber:number,approvedVariant:runtimeRelativePath?path.basename(runtimeRelativePath):null,sourceDimensions:dimensions,runtimeDimensions:runtimeRelativePath?probe(path.join(root,runtimeRelativePath)):null,format:'png',hasAlpha:dimensions.hasAlpha,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),semanticTags:selected?.[2]||[concept],accentCompatibility:['orange'],status,notes,candidateRelativePath:relative,runtimeRelativePath}})
const selected=records.filter(asset=>asset.status==='selected')
fs.mkdirSync(path.join(root,'metadata'),{recursive:true})
fs.writeFileSync(path.join(root,'metadata','assets.json'),JSON.stringify({schemaVersion:1,generatedCandidates:records,selectedAssets:selected},null,2)+'\n')
fs.writeFileSync(path.join(root,'metadata','hero-index.json'),JSON.stringify({schemaVersion:1,revision:'editorial-v3-raster-index-pilot',entries:selected.map(a=>({assetId:a.id,concept:a.concept,semanticTags:a.semanticTags,runtimeRelativePath:a.runtimeRelativePath,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,a.runtimeRelativePath))).digest('hex')}))},null,2)+'\n')
const resolve=concept=>selected.filter(a=>a.concept===concept||a.semanticTags.includes(concept)).sort((a,b)=>a.id.localeCompare(b.id))[0]
for(const concept of ['idea','signal','system','network'])assert(resolve(concept),`HERO_INDEX_MISSING:${concept}`)
console.log('EDITORIAL_V3_PROVENANCE',JSON.stringify({generated:records.length,selected:selected.length,rejected:records.length-selected.length,indexQueries:4}))
