'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
let temp, selection;

before(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'cipher-stock-selection-'));
  const compiled = spawnSync(process.execPath, [require.resolve('typescript/lib/tsc.js'),
    '--target', 'es2020', '--module', 'commonjs', '--moduleResolution', 'node', '--strict',
    '--noUnusedLocals', '--skipLibCheck', '--esModuleInterop', '--rootDir', 'src',
    '--outDir', path.join(temp, 'compiled'), 'src/main/build/stock-selection.ts'],
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
  selection = require(path.join(temp, 'compiled/main/build/stock-selection.js'));
});
after(async () => { if (temp) await fs.rm(temp, { recursive: true, force: true }); });

test('legacy plans keep their saved keyword and new plans use at most two distinct alternatives', () => {
  assert.deepEqual(selection.sceneSearchQueries({ keyword: 'forest' }), ['forest']);
  assert.deepEqual(selection.sceneSearchQueries({ keyword: 'forest', searchQueries: [' forest ', 'trees', 'woods'] }), ['forest', 'trees']);
});

test('metadata relevance outranks resolution and ambiguous candidates remain for review', () => {
  const waterfall = { id: 'wide', provider: 'pixabay', url: 'https://cdn.pixabay.com/w.mp4', width: 3840, height: 2160,
    query: 'intense training', responseRank: 1, tags: ['waterfall', 'river', 'nature'] };
  const workout = { id: 'portrait', provider: 'pixabay', url: 'https://cdn.pixabay.com/p.mp4', width: 1920, height: 1080,
    query: 'intense training', responseRank: 3, tags: ['woman', 'intense workout', 'training', 'cardio'] };
  const ranked = selection.rankStockCandidates([waterfall, workout], '9:16');
  assert.equal(ranked[0].candidate.id, 'portrait');
  assert.equal(ranked[0].assessment.decision, 'metadata-supported');
  assert.equal(ranked[1].assessment.decision, 'pending-review');
  assert.ok(ranked[0].assessment.score > ranked[1].assessment.score);
});

test('clear person-versus-animal and mirror-versus-electronics contradictions are rejected', () => {
  const bird = selection.assessStockCandidate('person standing at crossroads', { tags: ['bird', 'kingfisher', 'branch'] });
  const processor = selection.assessStockCandidate('person looking into a mirror', { tags: ['computer', 'processor', 'circuit board'] });
  const colleagues = selection.assessStockCandidate('self talk', { tags: ['conversation', 'talk', 'colleagues'] });
  assert.equal(bird.decision, 'rejected');
  assert.equal(processor.decision, 'rejected');
  assert.equal(colleagues.decision, 'rejected');
  assert.match(bird.reasons[0], /Contradicción clara/);
  assert.match(processor.reasons[0], /Contradicción clara/);
});

test('AI-generated or weakly described matches are not claimed as visually validated', () => {
  const generated = selection.assessStockCandidate('personal growth', { tags: ['personal growth', 'ai generated', 'silhouette'] });
  const weak = selection.assessStockCandidate('person speaking alone', { tags: ['person', 'alone', 'portrait'] });
  assert.equal(generated.decision, 'pending-review');
  assert.equal(weak.decision, 'pending-review');
  assert.ok([...generated.reasons, ...weak.reasons].some(reason => /revisión/i.test(reason)));
});
