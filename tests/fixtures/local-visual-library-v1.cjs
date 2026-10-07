// Authored MIT geometric contract fixtures, NOT new production coverage or official assets.
const crypto=require('crypto'),fs=require('fs'),path=require('path');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const camera='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#eeeeee" d="M6 16h14l4-6h16l4 6h14v38H6z"/><circle fill="#222222" cx="32" cy="35" r="13"/><circle fill="#eeeeee" cx="32" cy="35" r="8"/></svg>';
function document(count=1){
 const assets=Array.from({length:count},(_,i)=>({assetId:`local-contract-camera-${i}-v1`,canonicalConcept:i?'fixture-concept-'+i:'camera',aliasesEs:i?[]:['cámara'],aliasesEn:[],
 source:'iconify',collection:'synthetic-contract-not-production',license:'MIT',licenseNotice:'notices/test.txt',format:'svg',sha256:hash(i?camera+'\n<!-- '+i+' -->':camera),
 originalColor:false,styleFamily:'modern-line',heroAllowed:true,supportAllowed:true,priority:100,quality:3,localRelativePath:`assets/camera-${i}.svg`}));
 return {schemaVersion:1,packId:'local-contract-tests',revision:'2026-09-v1',collections:[{source:'iconify',collection:'synthetic-contract-not-production',license:'MIT',licenseNotice:'notices/test.txt',styleFamily:'modern-line',licenseApproved:true,reviewedBy:'test-fixture-author',reviewedAt:'2026-09-19'}],assets};
}
function write(root,doc=document(),physical=true){fs.mkdirSync(path.join(root,'assets'),{recursive:true});fs.mkdirSync(path.join(root,'notices'),{recursive:true});fs.writeFileSync(path.join(root,'notices/test.txt'),'MIT - geometric test fixture authored for Cipher tests; not an Iconify release.');fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(doc));if(physical)for(let i=0;i<doc.assets.length;i++)fs.writeFileSync(path.join(root,doc.assets[i].localRelativePath),i?camera+'\n<!-- '+i+' -->':camera);return doc;}
module.exports={hash,camera,document,write};
