'use strict';
// SIWC protocol tests are isolated: loopback callbacks and all OpenAI endpoints are mocked.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
let temp, SiwcRuntime, SiwcError, normalizeDirectorPreference;

before(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'cipher-siwc-'));
  const compiled = spawnSync(process.execPath, [require.resolve('typescript/lib/tsc.js'), '--target', 'es2022',
    '--module', 'commonjs', '--moduleResolution', 'node', '--strict', '--skipLibCheck', '--esModuleInterop',
    '--rootDir', 'src', '--outDir', path.join(temp, 'compiled'), 'src/main/siwc/runtime.ts',
    'src/shared/director-provider.ts'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
  process.env.NODE_PATH = path.resolve(__dirname, '..', 'node_modules');
  require('node:module').Module._initPaths();
  ({ SiwcRuntime, SiwcError } = require(path.join(temp, 'compiled/main/siwc/runtime.js')));
  ({ normalizeDirectorPreference } = require(path.join(temp, 'compiled/shared/director-provider.js')));
});
after(async () => { if (temp) await fs.rm(temp, { recursive: true, force: true }); });

function fakeSafeStorage() {
  const prefix = Buffer.from('TEST-CIPHER:');
  const key = Buffer.from('isolated-si-wc-test');
  const transform = value => Buffer.from(value.map((byte, index) => byte ^ key[index % key.length]));
  return {
    isEncryptionAvailable: () => true,
    encryptString: value => Buffer.concat([prefix, transform(Buffer.from(value))]),
    decryptString: value => {
      assert.ok(value.subarray(0, prefix.length).equals(prefix));
      return transform(value.subarray(prefix.length)).toString();
    },
  };
}

function fixture(t, options = {}) {
  const userDataPath = path.join(temp, `profile-${Math.random().toString(16).slice(2)}`);
  const calls = [];
  const state = { scopes: options.scopes || 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
    expires: options.expires ?? 3600, catalogStatus: options.catalogStatus || 200,
    catalogErrorCode: options.catalogErrorCode || 'test_error', modelNetworkError: !!options.modelNetworkError,
    catalog: options.catalog || { models: [
      { slug: 'test-model-one', display_name: 'Test Model One', visibility: 'list' },
      { slug: 'hidden-model', display_name: 'Hidden', visibility: 'hide' },
    ] }, inference: options.inference || 'complete', refreshCount: 0, inferenceCount: 0 };
  const fetcher = async (url, init = {}) => {
    const href = String(url); calls.push({ url: href, init });
    if (href.endsWith('/api/accounts/oauth/token')) {
      const form = new URLSearchParams(init.body);
      if (form.get('grant_type') === 'refresh_token') {
        state.refreshCount++;
        return Response.json({ access_token: 'rotated-access-token', refresh_token: 'rotated-refresh-token',
          expires_in: 3600, scope: state.scopes });
      }
      return Response.json({ access_token: 'initial-access-token', refresh_token: 'initial-refresh-token',
        id_token: 'signed-id-token-test-only', expires_in: state.expires, scope: state.scopes });
    }
    if (href.endsWith('/v1/models')) {
      assert.equal(init.headers.Authorization, state.refreshCount ? 'Bearer rotated-access-token' : 'Bearer initial-access-token');
      if (state.modelNetworkError) throw new Error('fixture-network-failure');
      if (state.catalogStatus !== 200)
        return Response.json({ error: { code: state.catalogErrorCode } }, { status: state.catalogStatus });
      return Response.json(state.catalog, { status: state.catalogStatus });
    }
    if (href.endsWith('/v1/responses')) {
      state.inferenceCount++;
      assert.equal(init.headers.Authorization, 'Bearer initial-access-token');
      const request = JSON.parse(init.body);
      state.lastRequest = request;
      assert.equal(request.store, false);
      assert.equal(request.stream, true);
      assert.equal(request.model, 'test-model-one');
      assert.ok(!init.body.includes('C:\\private'));
      if (state.inference === 'late') {
        state.requestSignal = init.signal;
        return new Promise(resolve => { state.resolveLateResponse = resolve; });
      }
      if (state.inference === 'cancel') {
        const encoder = new TextEncoder();
        return new Response(new ReadableStream({ start(controller) {
          init.signal.addEventListener('abort', () => controller.error(init.signal.reason), { once: true });
          controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"{\\"scenes\\":["}\n\n'));
        } }), { headers: { 'Content-Type': 'text/event-stream', 'x-request-id': 'req-fixture-42' } });
      }
      const proposal = state.inference === 'invalid-json' ? '{invalid-json'
        : JSON.stringify({ scenes: [{ id: 'scene-one', visualIntent: 'Superficie lunar',
          searchQueries: ['moon surface'], sourceStart: 1 }] });
      const events = state.inference === 'partial'
        ? [{ type: 'response.incomplete', response: { id: 'resp-partial-1', model: 'test-model-one' } }]
        : [{ type: 'response.output_text.delta', delta: proposal },
          { type: 'response.completed', response: { id: 'resp-fixture-1', model: 'test-model-one',
            usage: { input_tokens: 9, output_tokens: 7, total_tokens: 16 } } }];
      const payload = events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('');
      return new Response(payload, { headers: { 'Content-Type': 'text/event-stream', 'x-request-id': 'req-fixture-42' } });
    }
    if (href === 'https://auth.openai.com/.well-known/openid-configuration')
      return Response.json({ issuer: 'https://auth.openai.com', jwks_uri: 'https://auth.openai.com/.well-known/jwks.json',
        revocation_endpoint: 'https://auth.openai.com/api/accounts/oauth/revoke' });
    if (href.endsWith('/api/accounts/oauth/revoke')) return new Response('', { status: 200 });
    throw new Error(`Unexpected mocked URL: ${href}`);
  };
  const runtime = new SiwcRuntime({ userDataPath, safeStorage: fakeSafeStorage(), fetcher,
    verifyToken: async (token, clientId, nonce) => {
      assert.equal(token, 'signed-id-token-test-only');
      assert.equal(clientId, 'oaiapp_test_registration');
      assert.ok(nonce.length > 10);
      return { sub: 'account-subject-test', email: 'director@example.test' };
    },
    openExternal: async value => {
      if (options.openExternal) return options.openExternal(value, state);
      const auth = new URL(value);
      state.authUrl = auth;
      const callback = new URL(auth.searchParams.get('redirect_uri'));
      callback.searchParams.set('code', 'authorization-code-test');
      callback.searchParams.set('state', auth.searchParams.get('state'));
      callback.searchParams.set('client_id', 'oaiapp_test_registration');
      callback.searchParams.set('scope', state.scopes);
      const result = await fetch(callback);
      assert.equal(result.status, 200);
    },
    timeoutMs: 3000,
  });
  t.after(async () => { await fs.rm(userDataPath, { recursive: true, force: true }); });
  return { runtime, userDataPath, calls, state };
}

async function connected(f) { return f.runtime.signIn(); }
const sampleInput = Object.freeze({ schemaVersion: 1, scriptText: 'La luna ilumina la noche.', fps: 30,
  scenes: Object.freeze([{ id: 'scene-one', phraseIndex: 0, text: 'La luna.', category: 'stock', startFrame: 0, frames: 90 }]) });

test('legacy projects keep DeepSeek defaults and preserve stale model IDs for explicit replacement', () => {
  assert.deepEqual(normalizeDirectorPreference(undefined, undefined), { providerId: 'deepseek', modelId: 'deepseek-chat' });
  assert.deepEqual(normalizeDirectorPreference('chatgpt', undefined), { providerId: 'chatgpt', modelId: '' });
  assert.deepEqual(normalizeDirectorPreference('chatgpt', 'removed-model'), { providerId: 'chatgpt', modelId: 'removed-model' });
  assert.deepEqual(normalizeDirectorPreference('gemini', 'fake'), { providerId: 'deepseek', modelId: 'deepseek-chat' });
});

test('OAuth uses the official dynamic client flow, persisted host, loopback PKCE and explicit plan permission', async t => {
  const f = fixture(t, { scopes: 'openid profile email offline_access resource.invoke' });
  await assert.rejects(connected(f), error => error instanceof SiwcError && error.code === 'PERMISSION_REQUIRED');
  const state = await f.runtime.getState();
  assert.equal(state.profiles.length, 1);
  assert.equal(state.profiles[0].connected, true);
  assert.equal(state.profiles[0].planUsageEnabled, false);
  assert.equal(state.activeProfileId, 'oaiapp_test_registration');
  assert.equal(f.state.authUrl.searchParams.get('client_id'), 'dynamic_agent_client');
  assert.equal(f.state.authUrl.searchParams.get('agent_name_hint'), 'Cipher Studio');
  assert.equal(f.state.authUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(f.state.authUrl.searchParams.get('resource'), 'https://api.openai.com/v1');
  assert.match(f.state.authUrl.searchParams.get('redirect_uri'), /^http:\/\/127\.0\.0\.1:\d+\/auth\/callback$/);
  assert.ok(f.state.authUrl.searchParams.get('scope').includes('chatgpt.tokens.use.direct'));
  const stored = await fs.readFile(path.join(f.userDataPath, 'siwc', 'profile-store.bin'));
  assert.ok(stored.subarray(0, 12).equals(Buffer.from('TEST-CIPHER:')));
  assert.equal(stored.includes(Buffer.from('initial-access-token')), false);
  await assert.rejects(f.runtime.listModels(), error => error.code === 'PERMISSION_REQUIRED');
  assert.equal(f.calls.some(call => call.url.endsWith('/v1/models')), false);
});

test('closing the login flow cancels OAuth without creating a connected profile', async t => {
  let browserOpened;
  const opened = new Promise(resolve => { browserOpened = resolve; });
  const f = fixture(t, { openExternal: async value => { f.state.authUrl = new URL(value); browserOpened(); } });
  const pending = f.runtime.signIn();
  await opened;
  f.runtime.cancelSignIn();
  await assert.rejects(pending, error => error instanceof SiwcError && error.code === 'LOGIN_CANCELLED');
  const state = await f.runtime.getState();
  assert.equal(state.profiles.length, 0);
  assert.equal(state.activeProfileId, null);
});

test('catalog errors distinguish expired session, account/model permission, limits and network failure', async t => {
  const scenarios = [
    [{ catalogStatus: 401 }, 'SESSION_EXPIRED'],
    [{ catalogStatus: 403 }, 'ACCOUNT_MODEL'],
    [{ catalogStatus: 429, catalogErrorCode: 'subscription_sharing_usage_limit_exceeded' }, 'USAGE_LIMIT'],
    [{ modelNetworkError: true }, 'NETWORK'],
  ];
  for (const [options, expected] of scenarios) {
    const f = fixture(t, options);
    await connected(f);
    await assert.rejects(f.runtime.listModels(), error => error instanceof SiwcError && error.code === expected);
  }
});

test('model catalog uses the account slugs and inference accepts only a completed JSON proposal', async t => {
  const f = fixture(t);
  await connected(f);
  const models = await f.runtime.listModels('oaiapp_test_registration');
  assert.deepEqual(models, [{ slug: 'test-model-one', displayName: 'Test Model One' }]);
  const proposal = await f.runtime.propose('oaiapp_test_registration', models[0].slug, sampleInput, new AbortController().signal);
  assert.deepEqual(proposal, { scenes: [{ id: 'scene-one', visualIntent: 'Superficie lunar',
    searchQueries: ['moon surface'], sourceStart: 1 }] });
  assert.equal(f.state.lastRequest.input[1].content.includes('C:\\private'), false);
  assert.deepEqual(f.state.lastRequest.input[1].content && JSON.parse(f.state.lastRequest.input[1].content).scenes,
    [{ id: 'scene-one', text: 'La luna.', category: 'stock', startFrame: 0, frames: 90 }]);
  const after = await f.runtime.getState();
  assert.deepEqual(after.lastInference, { provider: 'chatgpt', model: 'test-model-one',
    completedAt: after.lastInference.completedAt, durationMs: after.lastInference.durationMs, status: 'completed',
    actualModelId: 'test-model-one', providerRequestId: 'req-fixture-42', providerResponseId: 'resp-fixture-1',
    inputTokens: 9, outputTokens: 7, totalTokens: 16 });
});

test('expired access tokens refresh once with the account registration and rotating token', async t => {
  const f = fixture(t, { expires: 0 });
  await connected(f);
  const [first, second] = await Promise.all([f.runtime.listModels(), f.runtime.listModels()]);
  assert.deepEqual(first, second);
  assert.equal(f.state.refreshCount, 1);
  const calls = f.calls.filter(call => call.url.endsWith('/api/accounts/oauth/token'));
  const refreshForm = new URLSearchParams(calls[1].init.body);
  assert.equal(refreshForm.get('grant_type'), 'refresh_token');
  assert.equal(refreshForm.get('client_id'), 'oaiapp_test_registration');
  assert.equal(refreshForm.get('refresh_token'), 'initial-refresh-token');
});

test('incomplete responses and cancellation never apply a proposal', async t => {
  const partial = fixture(t, { inference: 'partial' });
  await connected(partial);
  await assert.rejects(partial.runtime.propose('oaiapp_test_registration', 'test-model-one', sampleInput,
    new AbortController().signal), error => error.code === 'RESPONSE_PARTIAL');
  const partialRecord = (await partial.runtime.getState()).lastInference;
  assert.deepEqual(partialRecord, {
    provider: 'chatgpt', model: 'test-model-one', completedAt: partialRecord.completedAt,
    durationMs: partialRecord.durationMs, status: 'failed',
    actualModelId: 'test-model-one', providerRequestId: 'req-fixture-42', providerResponseId: 'resp-partial-1',
    errorCode: 'RESPONSE_PARTIAL' });

  const cancelled = fixture(t, { inference: 'cancel' });
  await connected(cancelled);
  const controller = new AbortController();
  const pending = cancelled.runtime.propose('oaiapp_test_registration', 'test-model-one', sampleInput, controller.signal);
  setTimeout(() => controller.abort(new Error('test-cancel')), 30);
  await assert.rejects(pending, /test-cancel/);
  const cancelledRecord = (await cancelled.runtime.getState()).lastInference;
  assert.equal(cancelledRecord.status, 'cancelled');
  assert.equal(cancelledRecord.model, 'test-model-one');
  assert.equal(cancelledRecord.providerRequestId, 'req-fixture-42');
  assert.equal(cancelledRecord.errorCode, 'CANCELLED');
});

test('malformed JSON and an uncancellable late response are discarded and recorded as failures', async t => {
  const invalid = fixture(t, { inference: 'invalid-json' });
  await connected(invalid);
  await assert.rejects(invalid.runtime.propose('oaiapp_test_registration', 'test-model-one', sampleInput,
    new AbortController().signal), error => error.code === 'RESPONSE_INVALID');
  assert.equal((await invalid.runtime.getState()).lastInference.errorCode, 'RESPONSE_INVALID');

  const late = fixture(t, { inference: 'late' });
  await connected(late);
  const controller = new AbortController();
  const pending = late.runtime.propose('oaiapp_test_registration', 'test-model-one', sampleInput, controller.signal);
  for (let i = 0; i < 100 && !late.state.resolveLateResponse; i++)
    await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(typeof late.state.resolveLateResponse, 'function', 'the mocked request reached the pending response');
  controller.abort(new Error('late-response-cancel'));
  assert.equal(late.state.requestSignal.aborted, true);
  const proposal = JSON.stringify({ scenes: [{ id: 'scene-one', visualIntent: 'Una idea tardía',
    searchQueries: ['late response'], sourceStart: 0 }] });
  const events = [
    { type: 'response.output_text.delta', delta: proposal },
    { type: 'response.completed', response: { id: 'resp-too-late', model: 'test-model-one',
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } },
  ];
  late.state.resolveLateResponse(new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''),
    { headers: { 'Content-Type': 'text/event-stream', 'x-request-id': 'req-too-late' } }));
  await assert.rejects(pending, /late-response-cancel/);
  const lateRecord = (await late.runtime.getState()).lastInference;
  assert.equal(lateRecord.status, 'cancelled');
  assert.equal(lateRecord.errorCode, 'CANCELLED');
  assert.equal(lateRecord.providerResponseId, undefined);
  assert.equal(lateRecord.totalTokens, undefined);
});

test('disconnect revokes refresh token, removes local credentials and retains the registration identity', async t => {
  const f = fixture(t);
  await connected(f);
  const hostId = f.state.authUrl.searchParams.get('ext_agent_host_id');
  const result = await f.runtime.disconnect('oaiapp_test_registration');
  assert.equal(result.revocationConfirmed, true);
  assert.equal(result.state.activeProfileId, null);
  assert.equal(result.state.profiles[0].connected, false);
  assert.equal(result.state.profiles[0].id, 'oaiapp_test_registration');
  await assert.rejects(f.runtime.listModels('oaiapp_test_registration'), error => error.code === 'DISCONNECTED');
  const reconnected = await f.runtime.signIn('oaiapp_test_registration');
  assert.equal(reconnected.activeProfileId, 'oaiapp_test_registration');
  assert.equal(reconnected.profiles.length, 1);
  assert.equal(reconnected.profiles[0].connected, true);
  assert.equal(f.state.authUrl.searchParams.get('client_id'), 'oaiapp_test_registration');
  assert.equal(f.state.authUrl.searchParams.get('ext_agent_host_id'), hostId);
});
