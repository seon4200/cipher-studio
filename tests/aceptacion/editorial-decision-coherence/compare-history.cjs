// Compare immutable evidence, not a baseline update. No network or source writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const {execFileSync}=require('node:child_process'),assert=require('node:assert/strict')
const [before,after,ffmpeg,output]=process.argv.slice(2)
if(!before||!after||!ffmpeg||!output)throw Error('BEFORE_AFTER_FFMPEG_OUTPUT_REQUIRED')
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const probe=file=>JSON.parse(execFileSync(path.join(path.dirname(ffmpeg),'ffprobe.exe'),[
  '-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames:stream_tags=encoder:format_tags=encoder','-of','json',file],{encoding:'utf8'}))
const pixels=file=>execFileSync(ffmpeg,['-v','error','-i',file,'-map','0:v:0','-c:v','rawvideo',
  '-pix_fmt','rgba','-f','hash','-hash','sha256','-'],{encoding:'utf8'}).trim()
const rows=['portrait','landscape'].map(orientation=>{
  const name='contextual-v3-'+orientation,a=path.join(before,name+'.mp4'),b=path.join(after,name+'.mp4')
  const row={orientation,before:a,after:b,beforeSha:sha(a),afterSha:sha(b),beforePixels:pixels(a),afterPixels:pixels(b),
    beforeEncoding:probe(a),afterEncoding:probe(b),stablePNGEqual:sha(path.join(before,name+'-stable.png'))===sha(path.join(after,name+'-stable.png'))}
  row.containerEqual=row.beforeSha===row.afterSha;row.allDecodedFramesEqual=row.beforePixels===row.afterPixels
  return row
})
const old=JSON.parse(fs.readFileSync(path.join(before,'result.json'),'utf8')),current=JSON.parse(fs.readFileSync(path.join(after,'result.json'),'utf8'))
const report={pixelIdentityEqual:old.pixelIdentity===current.pixelIdentity,rows,
  scope:'All decoded RGBA frames and stable PNG; container SHA reported separately. No tolerance.'}
fs.writeFileSync(output,JSON.stringify(report,null,2))
assert(report.pixelIdentityEqual)
assert(rows.every(r=>r.allDecodedFramesEqual&&r.stablePNGEqual))
console.log(JSON.stringify({passed:true,pixelIdentityEqual:report.pixelIdentityEqual,rows:rows.map(r=>({orientation:r.orientation,containerEqual:r.containerEqual,allDecodedFramesEqual:r.allDecodedFramesEqual}))}))
