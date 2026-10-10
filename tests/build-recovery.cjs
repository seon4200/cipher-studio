// No Electron, API credentials or user projects. Uses isolated temporary media.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, spawn } = require('node:child_process');
let temp, source, audio, model, storage, media, BuildRunner;
const noop = () => {};

before(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'cipher-1b-'));
  const compiler = process.env.CIPHER_TSC || require.resolve('typescript/lib/tsc.js');
  const compiled = spawnSync(process.execPath, [compiler, '--target', 'es2020', '--module', 'commonjs',
    '--moduleResolution', 'node', '--strict', '--noUnusedLocals', '--skipLibCheck', '--esModuleInterop',
    '--rootDir', 'src', '--outDir', path.join(temp, 'compiled'),
    'src/shared/build-plan.ts', 'src/main/build/runner.ts'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
  model = require(path.join(temp, 'compiled/shared/build-plan.js'));
  storage = require(path.join(temp, 'compiled/main/build/storage.js'));
  media = require(path.join(temp, 'compiled/main/build/media.js'));
  ({ BuildRunner } = require(path.join(temp, 'compiled/main/build/runner.js')));
  source = path.join(temp, 'vídeo fuente #1.mp4');
  audio = path.join(temp, 'audio principal.wav');
  await media.command('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=30',
    '-t', '8', '-c:v', 'libx264', '-g', '120', '-pix_fmt', 'yuv420p', source]);
  await media.command('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '6.2', audio]);
});
after(async () => { if (temp) await fs.rm(temp, { recursive: true, force: true }); });

async function input(name, weights = [100, 0, 0]) {
  const projectPath = path.join(temp, name);
  await fs.mkdir(projectPath, { recursive: true });
  return { projectPath, scriptText: 'Primera frase. Segunda frase.', audioPath: audio, audioDuration: 6.2,
    videoPath: source, weights, aspectRatio: '16:9', originalAudio: true,
    segments: [{ start: 0, end: 3.7, text: 'Primera frase.' }, { start: 4, end: 6, text: 'Segunda frase.' }] };
}
const direct = async scenes => scenes.map(s => ({ id: s.id, keyword: 'ocean waves', sourceStart: s.sourceStart }));
async function prepare(scene, spec, output, signal) {
  const result = await media.cutMedia(source, output, scene.sourceStart, scene.frames, spec.aspectRatio, signal, 160);
  return { ...result, path: output, sourcePath: source, provider: scene.category };
}

test('frame quotas cover silence and phrases of 3–4 s without stretching clips', async () => {
  const spec = await input('quotas');
  for (const duration of [1/30, 0.7, 3, 3.01, 3.7, 4, 6.2, 20.017, 121.4]) {
    for (let stock = 0; stock <= 100; stock++) {
      const p = model.createPlan({ ...spec, audioDuration: duration, weights: [100-stock, stock, 0],
        segments: [{ start: 0, end: duration, text: 'Prueba' }] }, 'test-plan', 'hash', 1);
      model.validatePlan(p);
      assert.equal(p.scenes.reduce((n,s) => n+s.frames,0), Math.round(duration*30));
      assert.equal(p.scenes.filter(s=>s.category==='stock').reduce((n,s)=>n+s.frames,0), Math.round(Math.round(duration*30)*stock/100));
      assert.ok(p.scenes.every(s=>s.frames>0 && s.frames<=90));
    }
  }
  const p = model.createPlan(spec, 'test-plan', 'hash', 1);
  assert.ok(p.scenes.some(s=>s.startFrame===111)); // explicit gap after the first phrase
  assert.equal(p.scenes.at(-1).startFrame+p.scenes.at(-1).frames,186);
});

test('real FFmpeg cuts align to frames, clamp source offsets and preserve the audio', async () => {
  const digest = await media.sha256(audio);
  for (const frames of [1, 21, 90]) {
    const file = path.join(temp, `cut-${frames}.mp4`);
    const result = await media.cutMedia(source, file, 9999, frames, '16:9', undefined, 160);
    assert.equal(result.duration, frames/30);
    assert.ok(result.sourceStart+result.duration<=8.000001);
    await media.validateMedia(file,frames,undefined,result.sha256);
  }
  await assert.rejects(media.cutMedia(source,path.join(temp,'invalid.mp4'),0,91,'16:9'), /recorte válido/);
  assert.equal(await media.sha256(audio),digest);
  for (const aspect of ['horizontal','vertical','square']) {
    const spec=await input(`format-${aspect}`);spec.aspectRatio=aspect;
    model.validateInput(spec);
    const file=path.join(temp,`${aspect}.mp4`);
    await media.cutMedia(source,file,0,15,aspect,undefined,160);
    const meta=await media.probe(file);
    assert.equal(meta.width,160);
    assert.equal(meta.height,aspect==='square'?160:aspect==='vertical'?284:90);
  }
});

test('Stock failure persists its category; a fresh runner resumes only unfinished scenes', async () => {
  const spec = await input('resume', [30,70,0]);
  const preserved = path.join(spec.projectPath,'materiales','originales','existing.mp4');
  await fs.mkdir(path.dirname(preserved),{recursive:true}); await fs.writeFile(preserved,'DO NOT DELETE');
  let calls = [], fail = true;
  const deps = { direct, prepare: async (scene,...args) => {
    calls.push(scene.id);
    if (fail && scene.category==='stock') throw new media.BuildFailure('NETWORK','Fallo controlado',true);
    return prepare(scene,...args);
  } };
  const first = await new BuildRunner(deps).run(spec,'new',null,noop);
  assert.equal(first.success,false);
  const before = await storage.loadPlan(spec.projectPath);
  assert.ok(before.scenes.filter(s=>s.status!=='complete').every(s=>s.category==='stock'));
  const kept = before.scenes.filter(s=>s.status==='complete').map(s=>({id:s.id,hash:s.result.sha256}));
  calls=[]; fail=false;
  const runner = new BuildRunner(deps);
  const resumed = await runner.run(spec,'continue',before.id,noop);
  assert.equal(resumed.success,true);
  for (const item of kept) assert.ok(!calls.includes(item.id));
  const after = await storage.loadPlan(spec.projectPath);
  for (const item of kept) assert.equal(after.scenes.find(s=>s.id===item.id).result.sha256,item.hash);
  assert.deepEqual(after.scenes.map(s=>s.id),before.scenes.map(s=>s.id));
  assert.equal(await fs.readFile(preserved,'utf8'),'DO NOT DELETE');
  assert.equal(after.scenes.filter(s=>s.category==='stock').reduce((n,s)=>n+s.frames,0),Math.round(186*.7));
  calls=[];
  await runner.run(spec,'continue',after.id,noop);
  assert.equal(calls.length,0);
  await runner.validateExport(spec.projectPath,resumed.clips);
  const changed=resumed.clips.map(c=>({...c})); changed[0].durationSeconds=4;
  await assert.rejects(runner.validateExport(spec.projectPath,changed),/modificado|huecos|duración/);
  const reordered=[...resumed.clips].reverse().map(c=>({...c}));let cursor=0;
  for(const clip of reordered){clip.startSeconds=cursor;cursor+=clip.durationSeconds;}
  await runner.validateExport(spec.projectPath,reordered);
});

test('cancel keeps completed outputs and rejects overlapping execution', async () => {
  const spec=await input('cancel'); let reached, release;
  const waiting=new Promise(resolve=>reached=resolve);
  const gate=new Promise(resolve=>release=resolve); let count=0;
  const runner=new BuildRunner({direct,prepare:async(scene,...args)=>{
    if(++count===2){reached();await gate;args[2].throwIfAborted();}
    return prepare(scene,...args);
  }});
  const work=runner.run(spec,'new',null,noop);
  await waiting;
  await assert.rejects(runner.run(spec,'new',null,noop),/activa/);
  runner.cancel(spec.projectPath);release();
  const result=await work;
  assert.equal(result.summary.status,'paused');assert.equal(result.summary.completed,1);
  const recovered=await new BuildRunner({direct,prepare}).run(spec,'continue',result.summary.id,noop);
  assert.equal(recovered.success,true);
});

test('a changed input or stale plan cannot overwrite a saved plan', async () => {
  const spec=await input('stale');const runner=new BuildRunner({direct,prepare});
  const first=await runner.run(spec,'new',null,noop);
  const before=await fs.readFile(storage.planFile(spec.projectPath),'utf8');
  await assert.rejects(runner.run({...spec,scriptText:'Changed'},'continue',first.summary.id,noop),/Cambió/);
  await assert.rejects(runner.run(spec,'new','obsolete',noop),/plan cambió/);
  assert.equal(await fs.readFile(storage.planFile(spec.projectPath),'utf8'),before);
  const next=await runner.run({...spec,scriptText:'New plan'},'new',first.summary.id,noop);
  assert.notEqual(next.summary.id,first.summary.id);
  await runner.validateExport(spec.projectPath,first.clips); // archived versions remain usable
  await assert.rejects(runner.validateExport(spec.projectPath,[...next.clips,{id:'extra',type:'video'}]),/fuera del plan/);
});

test('Stock tries the next candidate after a corrupt download and records the discard', async () => {
  const spec=await input('provider',[0,100,0]);
  const scene=model.createPlan(spec,'provider-plan','hash',1).scenes[0];scene.keyword='forest';
  const providers=require(path.join(temp,'compiled/main/build/providers.js'));
  const fetchBefore=global.fetch;const names=['PEXELS_API_KEY','PIXABAY_API_KEY','COVERR_API_KEY'];
  const env=Object.fromEntries(names.map(n=>[n,process.env[n]]));
  process.env.PEXELS_API_KEY='test-only';delete process.env.PIXABAY_API_KEY;delete process.env.COVERR_API_KEY;
  const bytes=await fs.readFile(source);const downloads=[];
  global.fetch=async url=>{
    if(String(url).includes('api.pexels.com'))return Response.json({videos:[1,2].map(id=>({id,duration:8,
      video_files:[{file_type:'video/mp4',width:160,height:90,link:`https://fixture.invalid/${id}`}]}))});
    downloads.push(String(url));return new Response(String(url).endsWith('/1')?'corrupt':bytes);
  };
  try {
    const result=await providers.prepareScene(scene,spec,path.join(temp,'provider-output.mp4'),new AbortController().signal,
      async id=>{scene.rejectedCandidates.push(id);});
    assert.deepEqual(downloads,['https://fixture.invalid/1','https://fixture.invalid/2']);
    assert.deepEqual(scene.rejectedCandidates,['pexels:1']);
    assert.equal(result.provider,'pexels');assert.equal(scene.category,'stock');
    await media.validateMedia(result.path,scene.frames);
  } finally {
    global.fetch=fetchBefore;for(const name of names){if(env[name]===undefined)delete process.env[name];else process.env[name]=env[name];}
  }
});

test('damaged completed file is rebuilt without regenerating its neighbors', async () => {
  const spec=await input('corrupt');let calls=[];
  const deps={direct,prepare:async(scene,...args)=>{calls.push(scene.id);return prepare(scene,...args);}};
  const result=await new BuildRunner(deps).run(spec,'new',null,noop);
  await fs.writeFile(result.clips[1].path,'broken');calls=[];
  const resumed=await new BuildRunner(deps).run(spec,'continue',result.summary.id,noop);
  assert.equal(resumed.success,true);assert.deepEqual(calls,[result.clips[1].id]);
});

test('atomic writes serialize and recover the last valid JSON, keeping the original', async () => {
  const file=path.join(temp,'atomic','state.json');
  await storage.atomicJson(file,{n:0});
  await Promise.all([storage.atomicJson(file,{n:1}),storage.atomicJson(file,{n:2})]);
  assert.deepEqual(await storage.readJson(file),{n:2});
  await fs.writeFile(file,'{"incomplete":');
  assert.deepEqual(await storage.readJson(file),{n:1});
  assert.deepEqual(JSON.parse(await fs.readFile(file+'.before-1b','utf8')),{n:0});
});

test('abrupt process exit recovers persisted progress and releases a dead-process claim', async () => {
  const spec=await input('crash');
  const childScript=path.join(temp,'crash.cjs');
  await fs.writeFile(childScript,`
    const {BuildRunner}=require(${JSON.stringify(path.join(temp,'compiled/main/build/runner.js'))});
    const media=require(${JSON.stringify(path.join(temp,'compiled/main/build/media.js'))});
    const spec=${JSON.stringify(spec)};let count=0;
    const runner=new BuildRunner({prepare:async(scene,input,out,signal)=>{
      if(++count===2){process.stdout.write('CHECKPOINT\\n');await new Promise(()=>{});}
      const r=await media.cutMedia(input.videoPath,out,scene.sourceStart,scene.frames,input.aspectRatio,signal,160);
      return {...r,path:out,sourcePath:input.videoPath,provider:'original'};
    }});
    setInterval(()=>{},1000);
    runner.run(spec,'new',null,()=>{}).catch(e=>{console.error(e);process.exit(1);});
  `);
  const child=spawn(process.execPath,[childScript],{stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('No checkpoint'));},20000);
    child.stdout.on('data',data=>{if(data.toString().includes('CHECKPOINT')){clearTimeout(timer);resolve();}});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error('Child exited before checkpoint '+code));});
  });
  const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGKILL');await exited;
  const runner=new BuildRunner({direct,prepare});const status=await runner.inspect(spec.projectPath);
  assert.equal(status.status,'paused');assert.equal(status.completed,1);
  const resumed=await runner.run(spec,'continue',status.id,noop);
  assert.equal(resumed.success,true);
});
