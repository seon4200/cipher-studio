const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {execFileSync}=require('node:child_process')
const {createTestFixture}=require('../../helpers/safe-fixture.js')
const root=path.resolve(__dirname,'../../..'),fixture=createTestFixture('stock-cover-regression')
app.setPath('userData',path.join(fixture,'userData'));process.chdir(fixture)
const ffmpeg=path.resolve(root,'../_tools/ffmpeg-v4/extracted/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe')
const probe=path.join(path.dirname(ffmpeg),'ffprobe.exe')
app.whenReady().then(()=>{let code=1;try{
  const {stockCoverFilter}=require(path.join(root,'dist-electron/main/index.js')),results=[]
  for(const [aspect,width,height] of [['9:16',1080,1920],['16:9',1920,1080]]){
    const output=path.join(fixture,aspect.replace(':','-')+'.mp4'),filter=stockCoverFilter(aspect)
    execFileSync(ffmpeg,['-v','error','-f','lavfi','-i','testsrc2=size=1080x1620:rate=24:duration=0.5',
      '-vf',filter,'-an','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',output])
    const info=JSON.parse(execFileSync(probe,['-v','error','-select_streams','v:0','-show_entries','stream=width,height',
      '-of','json',output],{encoding:'utf8'})).streams[0]
    assert.deepEqual(info,{width,height});results.push({aspect,source:[1080,1620],filter,output,...info})
  }
  fs.writeFileSync(path.resolve(root,'../_cipher-scene-corrections-20260927/stock-runtime.json'),JSON.stringify(results,null,2))
  console.log(JSON.stringify({passed:true,results}));code=0
}catch(error){console.error(error.stack)}finally{app.exit(code)}})
