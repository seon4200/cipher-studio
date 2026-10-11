'use strict';
// No external calls, credentials or user projects. Network is replaced in every HTTP test.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
let temp, createSceneDirector, directScenes;

before(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'cipher-director-'));
  const compiled = spawnSync(process.execPath, [require.resolve('typescript/lib/tsc.js'),
    '--target', 'es2020', '--module', 'commonjs', '--moduleResolution', 'node', '--strict',
    '--noUnusedLocals', '--skipLibCheck', '--esModuleInterop', '--rootDir', 'src',
    '--outDir', path.join(temp, 'compiled'), 'src/main/build/director.ts'],
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
  ({ createSceneDirector, directScenes } = require(path.join(temp, 'compiled/main/build/director.js')));
});
after(async () => { if (temp) await fs.rm(temp, { recursive: true, force: true }); });

const scenes = () => [
  { id: 'plan-s1', phraseIndex: 0, text: 'El mar.', category: 'stock', startFrame: 0, frames: 90,
    sourceStart: 0, status: 'pending', attempts: [], rejectedCandidates: [] },
  { id: 'plan-s2', phraseIndex: 1, text: 'La orilla.', category: 'original', startFrame: 90, frames: 60,
    sourceStart: 3, status: 'pending', attempts: [], rejectedCandidates: [] },
];
const spec = () => ({ scriptText: 'El mar. La orilla.', projectPath: '/private/project',
  audioPath: '/private/audio.wav', videoPath: '/private/source.mp4', audioDuration: 5,
  weights: [40, 60, 0], aspectRatio: '9:16', originalAudio: false,
  segments: [{ start: 0, end: 3, text: 'El mar.' }, { start: 3, end: 5, text: 'La orilla.' }] });
const signal = () => new AbortController().signal;
const proposal = () => ({ scenes: scenes().map(s => ({ id: s.id, visualIntent: 'Oleaje en la costa',
  searchQueries: ['ocean waves', 'coastal surf'], keyword: 'ocean waves', sourceStart: 1 })) });
const reply = (items, metadata = {}) => new Response(JSON.stringify({ id: metadata.responseId,
  model: metadata.model, choices: [{ message: {
  content: JSON.stringify({ scenes: items }),
} }] }), { headers: metadata.requestId ? { 'x-request-id': metadata.requestId } : {} });
function fakeNetwork(t, handler, key = 'test-only-placeholder') {
  const previousKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = global.fetch;
  if (key === null) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = key;
  global.fetch = handler;
  t.after(() => {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
  });
}

test('the legacy adapter preserves the request and restores Cipher scene order', async t => {
  let calls = 0;
  fakeNetwork(t, async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(init.method, 'POST');
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'deepseek-chat');
    assert.equal(body.temperature, 0.2);
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.deepEqual(JSON.parse(body.messages[1].content), { script: spec().scriptText, scenes: [
      { id: 'plan-s1', text: 'El mar.', category: 'stock', start: 0, duration: 3 },
      { id: 'plan-s2', text: 'La orilla.', category: 'original', start: 3, duration: 2 },
    ] });
    assert.ok(!init.body.includes('/private/'));
    return reply([{ id: 'plan-s2', visualIntent: 'La orilla', searchQueries: [' beach ', 'shoreline'], timestamp: 4 },
      { id: 'plan-s1', visualIntent: 'El mar', searchQueries: [' ocean ', 'coast'], timestamp: 0 }],
    { responseId: 'chatcmpl-test-1', model: 'deepseek-chat', requestId: 'req-deepseek-test-1' });
  });
  const metadata = {};
  assert.deepEqual(await directScenes(scenes(), spec(), signal(), value => Object.assign(metadata, value)), [
    { id: 'plan-s1', visualIntent: 'El mar', searchQueries: ['ocean', 'coast'], keyword: 'ocean', sourceStart: 0 },
    { id: 'plan-s2', visualIntent: 'La orilla', searchQueries: ['beach', 'shoreline'], keyword: 'beach', sourceStart: 4 },
  ]);
  assert.deepEqual(metadata, { providerRequestId: 'req-deepseek-test-1',
    actualModelId: 'deepseek-chat', providerResponseId: 'chatcmpl-test-1' });
  assert.equal(calls, 1);
});

test('all adapters receive an immutable editorial snapshot and cannot overwrite timing or media', async () => {
  const batch = scenes(), input = spec(), before = JSON.stringify({ batch, input });
  const direct = createSceneDirector({ id: 'alternative-test', propose: async request => {
    assert.deepEqual(Object.keys(request).sort(), ['fps', 'scenes', 'schemaVersion', 'scriptText']);
    assert.equal(request.fps, 30);
    assert.equal(request.scenes[1].phraseIndex, 1);
    assert.throws(() => { request.scenes[0].frames = 999; }, TypeError);
    assert.throws(() => { request.scenes.push({}); }, TypeError);
    const result = proposal();
    result.scenes[0] = { ...result.scenes[0], frames: 999, category: 'original',
      path: '/invented/file.mp4', status: 'complete' };
    return result;
  } });
  assert.deepEqual(await direct(batch, input, signal()), proposal().scenes);
  assert.equal(JSON.stringify({ batch, input }), before);
});

test('malformed or partial proposals are rejected as a whole with a typed error', async () => {
  const valid = proposal().scenes;
  const invalid = [null, {}, { scenes: null }, { scenes: valid.slice(0, 1) },
    { scenes: [...valid, valid[0]] }, { scenes: [valid[0], valid[0]] },
    { scenes: [valid[0], { ...valid[1], id: 'another-plan' }] },
    { scenes: [valid[0], null] }];
  for (const fields of [{ visualIntent: '' }, { visualIntent: 'a'.repeat(241) }, { searchQueries: [] },
    { searchQueries: ['a', 'b', 'c'] }, { searchQueries: ['a'.repeat(101)] }, { searchQueries: ['same', ' SAME '] },
    { keyword: 'different' }, { sourceStart: -1 }, { sourceStart: NaN }, { sourceStart: Infinity },
    { sourceStart: '2' }, { sourceStart: undefined }])
    invalid.push({ scenes: [valid[0], { ...valid[1], ...fields }] });
  for (const result of invalid) {
    const batch = scenes(), before = JSON.stringify(batch);
    const direct = createSceneDirector({ id: 'invalid-test', propose: async () => result });
    await assert.rejects(direct(batch, spec(), signal()), e => e.code === 'PLAN_RESPONSE' && e.retryable);
    assert.equal(JSON.stringify(batch), before);
  }
});

test('legacy malformed JSON and null scene entries use the same validation failure', async t => {
  const responses = [new Response('not JSON'), new Response(JSON.stringify({ choices: [] })),
    reply([null, { id: 'plan-s2', visualIntent: 'La orilla', searchQueries: ['beach'], timestamp: 0 }])];
  fakeNetwork(t, async () => responses.shift());
  for (let i = 0; i < 3; i++)
    await assert.rejects(directScenes(scenes(), spec(), signal()), e => e.code === 'PLAN_RESPONSE');
});

test('cancel before submission or during an uncooperative provider discards its result', async () => {
  let calls = 0, release;
  const direct = createSceneDirector({ id: 'delayed-test', propose: () => {
    calls++;
    return new Promise(resolve => { release = resolve; });
  } });
  const before = new AbortController(); before.abort(new Error('cancel-before'));
  await assert.rejects(direct(scenes(), spec(), before.signal), /cancel-before/);
  assert.equal(calls, 0);
  const during = new AbortController(), batch = scenes(), original = JSON.stringify(batch);
  const pending = direct(batch, spec(), during.signal);
  during.abort(new Error('cancel-during'));
  release(proposal());
  await assert.rejects(pending, /cancel-during/);
  assert.equal(JSON.stringify(batch), original);
});

test('a missing key fails before any network call', async t => {
  let calls = 0;
  fakeNetwork(t, async () => { calls++; throw new Error('unexpected network'); }, null);
  await assert.rejects(directScenes(scenes(), spec(), signal()), e => e.code === 'CREDENTIALS');
  assert.equal(calls, 0);
});

test('credential and long rate-limit errors do not trigger a provider fallback', async t => {
  let calls = 0, status = 401;
  fakeNetwork(t, async () => { calls++; return new Response('', { status,
    headers: { 'retry-after': '60', 'x-request-id': `req-failure-${calls}` } }); });
  const metadata = {};
  await assert.rejects(directScenes(scenes(), spec(), signal(), value => Object.assign(metadata, value)),
    e => e.code === 'CREDENTIALS' && !e.retryable);
  assert.equal(metadata.providerRequestId, 'req-failure-1');
  status = 429;
  await assert.rejects(directScenes(scenes(), spec(), signal()), e => e.code === 'RATE_LIMIT' && e.retryable);
  assert.equal(calls, 2);
});

test('the extracted transport retains its bounded retry on server failure', async t => {
  let calls = 0;
  fakeNetwork(t, async () => {
    calls++;
    return calls === 1 ? new Response('', { status: 500 }) :
      reply(scenes().map(s => ({ id: s.id, visualIntent: 'Oleaje en la costa',
        searchQueries: ['ocean waves', 'coastal surf'], timestamp: 1 })));
  });
  assert.deepEqual(await directScenes(scenes(), spec(), signal()), proposal().scenes);
  assert.equal(calls, 2);
});
