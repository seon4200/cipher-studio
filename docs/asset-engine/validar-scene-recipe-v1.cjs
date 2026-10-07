'use strict';
// Contratos documentales exclusivamente. Sin imports productivos, red ni escrituras.
const fs = require('node:fs');
const path = require('node:path');
const profiles = ['blueprint', 'tech', 'authority', 'investigation', 'economic', 'pop'];
const entries = ['fade-in', 'fade-slide', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'scale-in', 'scale-overshoot', 'whip-in'];
const cyclic = ['float', 'breathe', 'soft-rotate', 'parallax-drift', 'slow-zoom', 'sway'];
const exits = ['fade-out', 'scale-down', 'scale-cover', 'slide-out-left', 'slide-out-right', 'slide-out-up', 'slide-out-down', 'whip-out'];
const hits = ['punch', 'bounce', 'shake-short', 'pulse', 'tilt-hit', 'flash'];
const transitions = ['none', 'hard-cut', 'scale-cover', 'whip-pan', 'flash', 'match-shape', 'shrink-to-anchor'];
const densities = ['minima', 'baja', 'media', 'alta', 'saturada'];
const fallbacks = ['next-candidate', 'generic-illustration', 'solar', 'omit', 'editorial-text'];
const reasons = ['no-metaphor', 'no-candidate', 'download-failed', 'invalid-file', 'unusable-alpha', 'rights-risk', 'file-lost', 'providers-exhausted'];
const epsilon = 1e-9;
function check(ok, message) { if (!ok) throw new Error(message); }
function obj(v, where) { check(v && typeof v === 'object' && !Array.isArray(v), where + ': objeto requerido'); }
function shape(v, required, optional, where) {
  obj(v, where);
  for (const k of required) check(Object.hasOwn(v, k), where + ': falta ' + k);
  for (const k of Object.keys(v)) check([...required, ...optional].includes(k), where + ': campo no permitido ' + k);
}
function str(v, where) { check(typeof v === 'string' && v.trim().length > 0, where + ': texto no vacío'); }
function one(v, options, where) { check(options.includes(v), where + ': valor fuera de catálogo ' + String(v)); }
function arr(v, where) { check(Array.isArray(v), where + ': array requerido'); }
function unit(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1; }
function window(v, visibility, where) {
  check(unit(v.start) && unit(v.duration) && v.duration > 0 && v.start + v.duration <= 1 + epsilon, where + ': ventana U01 inválida');
  check(v.start >= visibility.start - epsilon && v.start + v.duration <= visibility.end + epsilon, where + ': fuera de visibility');
}
function intensity(v, where) { one(v, ['subtle', 'medium', 'strong'], where); }
function clean(v, where) {
  if (typeof v === 'string') {
    check(!/(?:https?:|data:|file:)|(?:[a-z]:[\\/])|(?:^|[\s"'])\.{0,2}\/|\\|#[a-f0-9]{3,8}\b|\b[a-f0-9]{64}\b|\.(?:png|svg|jpg|webp)\b/i.test(v), where + ': URL/path/hex/SHA/archivo prohibido');
  } else if (v && typeof v === 'object') {
    for (const [k, value] of Object.entries(v)) {
      check(!/^(?:url|path|provider|providers|allowedProviders|sha|sha256|sourceUrl|fileUrl|localFile|relativeFile|bytes|license|x|y|css|keywordRef)$/i.test(k), where + ': campo resuelto o no canónico ' + k);
      clean(value, where + '.' + k);
    }
  }
}
function validate(d) {
  shape(d, ['specVersion', 'status', 'conditions', 'ProjectSubstrates', 'examples'], [], 'root');
  check(d.specVersion === 'scene-recipe-documental-v1' && d.status === 'proposed-not-rendered', 'documentación hipotética V1 requerida');
  obj(d.conditions, 'conditions'); obj(d.ProjectSubstrates, 'substratos');
  arr(d.examples, 'examples'); check(d.examples.length === 18, '18 ejemplos requeridos');
  const counts = {assetLed:0, editorialText:0, hardCut:0, heroExitNone:0, noEmphasis:0,
    optionalSupport:0, hold:0, heroWithoutSupport:0, noMetaphor:0, providersExhausted:0,
    scaleEntries:0, slideEntries:0, floatSustain:0, motivatedImpact:0, visibleHeroExits:0};
  const profileCounts = Object.fromEntries(profiles.map(p => [p, 0]));
  const transitionCounts = {};
  const ids = new Set(), intents = new Set(), recipes = new Set();
  check(Object.keys(d.ProjectSubstrates).length === 6, 'seis sustratos');
  for (const [id, s] of Object.entries(d.ProjectSubstrates)) {
    shape(s, ['projectSubstrateVersion','primaryStyle','paletteId','fontPairId','decoratorFamilyId','textureFamilyId'], ['brandMarkId'], id);
    check(s.projectSubstrateVersion === 1, id + ': versión');
    one(s.primaryStyle, profiles, id);
    one(s.paletteId, ['editorial','clinico','voltaje','calido'], id + ': paleta');
    one(s.fontPairId, ['technical-black','editorial-black','manuscript-black'], id + ': par');
    one(s.decoratorFamilyId, ['measurement','circuits','marginalia','evidence','accounting','cut-paper'], id + ': decoradores');
    one(s.textureFamilyId, ['technical-grid','aged-paper','radial-gradient','dark-lines','soft-editorial'], id + ': textura');
    if (s.brandMarkId !== undefined) str(s.brandMarkId, id + ': brandMarkId');
    clean(s, id);
  }
  for (const e of d.examples) {
    shape(e, ['id','topic','SceneIntent','SceneRecipe'], ['fallbackCase'], 'example');
    str(e.id, 'id'); str(e.topic, e.id + ': topic');
    check(!ids.has(e.id), 'id duplicado ' + e.id); ids.add(e.id);
    const r = e.SceneRecipe, i = e.SceneIntent, at = e.id;
    shape(i, ['sceneIntentVersion','id','phrase','idea','abstractConcept','keyword'], ['concreteMetaphor'], at + ': Intent');
    check(i.sceneIntentVersion === 1, at + ': versión Intent');
    for (const [k, v] of Object.entries(i)) if (k !== 'sceneIntentVersion') str(v, at + ': ' + k);
    check(!intents.has(i.id), at + ': Intent duplicado'); intents.add(i.id);
    shape(r, ['sceneRecipeVersion','visualMode','id','sceneIntentRef','projectSubstrateRef','styleVariant','densityIntent','text','assetSlots','backgroundIntent','transitionIntent','fallback'], [], at + ': Recipe');
    check(r.sceneRecipeVersion === 1, at + ': versión Recipe');
    str(r.id, at + ': recipe id'); check(!recipes.has(r.id), at + ': Recipe duplicada'); recipes.add(r.id);
    check(r.sceneIntentRef === i.id && Object.hasOwn(d.ProjectSubstrates, r.projectSubstrateRef), at + ': referencia inválida');
    const sub = d.ProjectSubstrates[r.projectSubstrateRef]; profileCounts[sub.primaryStyle]++;
    one(r.visualMode, ['asset-led','editorial-text'], at + ': modo');
    one(r.densityIntent, densities, at + ': densidad');
    check(r.fallback === 'editorial-text', at + ': fallback');
    shape(r.styleVariant, ['layoutIntent','energy'], ['textureVariant','motionFamily'], at + ': estilo');
    one(r.styleVariant.layoutIntent, ['sandwich','hero-bottom','negative-space','editorial-left','object-dominant','evidence-board'], at + ': layout');
    one(r.styleVariant.energy, ['low','medium','high'], at + ': energía');
    if (r.styleVariant.textureVariant !== undefined) one(r.styleVariant.textureVariant, ['base','fine','coarse'], at + ': textureVariant');
    if (r.styleVariant.motionFamily !== undefined) one(r.styleVariant.motionFamily, ['measured','organic','impact'], at + ': motionFamily');
    shape(r.backgroundIntent, ['family','motion'], [], at + ': fondo');
    one(r.backgroundIntent.family, ['technical-grid','aged-paper','radial-gradient','dark-lines','soft-editorial'], at + ': fondo');
    one(r.backgroundIntent.motion, ['slow-zoom','slow-pan','none'], at + ': fondo motion');
    one(r.transitionIntent, transitions, at + ': transición');
    transitionCounts[r.transitionIntent] = (transitionCounts[r.transitionIntent] || 0) + 1;
    if (r.transitionIntent === 'hard-cut') counts.hardCut++;
    shape(r.text, ['alignment','maxLines','timing'], ['connector','closing'], at + ': texto');
    one(r.text.alignment, ['left','center'], at + ': alignment');
    one(r.text.maxLines, [2,3], at + ': líneas');
    for (const k of ['connector','closing']) if (r.text[k] !== undefined) str(r.text[k], at + ': ' + k);
    const words = [r.text.connector, i.keyword, r.text.closing].filter(Boolean).join(' ').trim().split(/\s+/);
    check(words.length <= 8, at + ': más de 8 palabras');
    const t = r.text.timing;
    shape(t, ['keywordStart'], ['connectorStart','closingStart'], at + ': timing');
    for (const v of Object.values(t)) check(unit(v), at + ': tiempo texto inválido');
    for (const k of ['connector','closing']) check((r.text[k] !== undefined) === (t[k+'Start'] !== undefined), at + ': timing/texto ' + k);
    if (t.connectorStart !== undefined) check(t.connectorStart <= t.keywordStart, at + ': orden connector');
    if (t.closingStart !== undefined) check(t.keywordStart <= t.closingStart, at + ': orden closing');
    arr(r.assetSlots, at + ': slots');
    const heroes = r.assetSlots.filter(s => s.role === 'hero');
    if (r.visualMode === 'asset-led') {
      counts.assetLed++;
      check(heroes.length === 1 && heroes[0].optional === false && heroes[0].importance === 'primary', at + ': Hero obligatorio único');
      str(i.concreteMetaphor, at + ': metáfora asset-led');
      if (!r.assetSlots.some(s => s.role === 'support')) counts.heroWithoutSupport++;
    } else {
      counts.editorialText++;
      check(heroes.length === 0, at + ': editorial-text no admite Hero');
      check(r.assetSlots.every(s => ['texture','decorator'].includes(s.role) && s.preferredKind === 'procedural' && s.optional), at + ': editorial-text sólo procedural opcional');
    }
    check(r.assetSlots.filter(s => s.role !== 'texture').length <= 4, at + ': presupuesto semántico');
    check(new Set(r.assetSlots.map(s => s.id)).size === r.assetSlots.length, at + ': slot duplicado');
    let emphasisCount = 0;
    for (const s of r.assetSlots) {
      const where = at + '/' + s.id;
      shape(s, ['id','role','intent','preferredKind','importance','optional','motion','fallback'], [], where);
      str(s.id, where); str(s.intent, where + ': intent');
      one(s.role, ['hero','support','decorator','badge','texture'], where + ': role');
      one(s.preferredKind, ['icon','illustration','photo-cutout','procedural'], where + ': kind');
      one(s.importance, ['primary','secondary','ambient'], where + ': importancia');
      check(typeof s.optional === 'boolean', where + ': optional');
      arr(s.fallback, where + ': fallback'); check(s.fallback.length > 0, where + ': fallback vacío');
      for (const f of s.fallback) one(f, fallbacks, where + ': fallback');
      check(s.optional || !s.fallback.includes('omit'), where + ': slot obligatorio omitible');
      check(s.optional || s.fallback.includes('editorial-text'), where + ': falta fallback terminal');
      if (s.role === 'support' && s.optional && s.fallback.includes('omit')) counts.optionalSupport++;
      const m = s.motion;
      shape(m, ['entry','sustain','emphasis','exit','visibility'], [], where + ': motion');
      shape(m.visibility, ['start','end'], [], where + ': visibility');
      check(unit(m.visibility.start) && unit(m.visibility.end) && m.visibility.start < m.visibility.end, where + ': visibility');
      shape(m.entry, ['preset','start','duration','intensity'], [], where + ': entry');
      one(m.entry.preset, entries, where + ': entry'); intensity(m.entry.intensity, where);
      window(m.entry, m.visibility, where + ': entry');
      const entryEnd = m.entry.start + m.entry.duration;
      one(m.exit.preset, [...exits,'none'], where + ': exit');
      if (m.exit.preset === 'none') shape(m.exit, ['preset'], [], where + ': exit none');
      else {
        shape(m.exit, ['preset','start','duration','intensity'], [], where + ': exit');
        intensity(m.exit.intensity, where); window(m.exit, m.visibility, where + ': exit');
        check(m.exit.start >= entryEnd - epsilon, where + ': exit antes de entry');
      }
      const exitStart = m.exit.preset === 'none' ? m.visibility.end : m.exit.start;
      one(m.sustain.preset, [...cyclic,'hold','none'], where + ': sustain');
      if (m.sustain.preset === 'none') shape(m.sustain, ['preset'], [], where + ': sustain none');
      else {
        const hold = m.sustain.preset === 'hold';
        shape(m.sustain, hold ? ['preset','start','duration','reason'] : ['preset','start','duration','cycleDivisor','intensity'], [], where + ': sustain');
        window(m.sustain, m.visibility, where + ': sustain');
        check(m.sustain.start >= entryEnd - epsilon && m.sustain.start + m.sustain.duration <= exitStart + epsilon, where + ': sustain/entry/exit');
        if (hold) { one(m.sustain.reason, ['manual','narration-pause','dramatic-emphasis'], where + ': hold reason'); counts.hold++; }
        else { one(m.sustain.cycleDivisor, [2,3,4,5,6,8,10,12], where + ': divisor'); intensity(m.sustain.intensity, where); }
      }
      arr(m.emphasis, where + ': emphasis'); emphasisCount += m.emphasis.length;
      for (const h of m.emphasis) {
        shape(h, ['preset','trigger','duration','intensity','reason'], [], where + ': hit');
        one(h.preset, hits, where + ': emphasis'); intensity(h.intensity, where); str(h.reason, where + ': reason');
        const tr = h.trigger;
        obj(tr, where + ': trigger');
        one(tr.kind, ['keyword-hit','hero-entry','manual','narration-pause'], where + ': trigger');
        if (tr.kind === 'hero-entry') {
          shape(tr, ['kind'], [], where + ': hero-entry'); check(heroes.length === 1, where + ': trigger sin Hero');
        } else {
          shape(tr, ['kind','normalizedTime'], tr.kind === 'keyword-hit' ? ['wordId'] : tr.kind === 'narration-pause' ? ['pauseId'] : [], where + ': trigger');
          check(unit(tr.normalizedTime), where + ': trigger time');
          if (tr.wordId !== undefined) str(tr.wordId, where);
          if (tr.pauseId !== undefined) str(tr.pauseId, where);
          if (tr.kind === 'keyword-hit') check(Math.abs(tr.normalizedTime - t.keywordStart) < epsilon, where + ': keyword-hit no coincide');
        }
        const hitStart = tr.kind === 'hero-entry' ? heroes[0].motion.entry.start + heroes[0].motion.entry.duration : tr.normalizedTime;
        window({start:hitStart,duration:h.duration}, m.visibility, where + ': emphasis');
        check(hitStart >= entryEnd - epsilon && hitStart + h.duration <= exitStart + epsilon, where + ': emphasis invade entry/exit');
        if (m.sustain.preset === 'hold') check(Math.max(hitStart,m.sustain.start) >= Math.min(hitStart+h.duration,m.sustain.start+m.sustain.duration)-epsilon, where + ': emphasis solapa hold');
        if (['punch','shake-short'].includes(h.preset)) counts.motivatedImpact++;
      }
      if (s.role === 'hero') {
        if (['scale-in','scale-overshoot'].includes(m.entry.preset)) counts.scaleEntries++;
        if (m.entry.preset.startsWith('slide-')) counts.slideEntries++;
        if (m.sustain.preset === 'float') counts.floatSustain++;
        if (m.exit.preset === 'none') counts.heroExitNone++; else counts.visibleHeroExits++;
      }
    }
    check(emphasisCount <= 1, at + ': más de un emphasis V1');
    if (!emphasisCount) counts.noEmphasis++;
    if (e.fallbackCase !== undefined) {
      const f = e.fallbackCase;
      shape(f, ['reason','fromMode','toMode','expectedStrategy'], [], at + ': fallbackCase');
      one(f.reason, reasons, at + ': fallback reason');
      one(f.fromMode, ['asset-led','editorial-text'], at + ': fromMode');
      check(f.toMode === 'editorial-text' && r.visualMode === f.toMode && f.expectedStrategy === r.fallback, at + ': fallback no materializado como receta editorial');
      if (f.reason === 'no-metaphor') { check(i.concreteMetaphor === undefined, at + ': no-metaphor inventada'); counts.noMetaphor++; }
      if (f.reason === 'providers-exhausted') { check(f.fromMode === 'asset-led', at + ': agotamiento parte de asset-led'); counts.providersExhausted++; }
    }
    clean(e, at);
  }
  check(Object.values(profileCounts).every(n => n === 3), 'tres ejemplos por perfil');
  counts.transitionKinds = Object.keys(transitionCounts).length;
  const minimum = {editorialText:2,hardCut:4,heroExitNone:4,noEmphasis:3,optionalSupport:2,hold:1,
    heroWithoutSupport:1,noMetaphor:1,providersExhausted:1,scaleEntries:3,slideEntries:3,
    floatSustain:3,motivatedImpact:3,transitionKinds:3};
  for (const [k,n] of Object.entries(minimum)) check(counts[k] >= n, 'cobertura insuficiente ' + k + ': ' + counts[k] + ' < ' + n);
  return {examples:d.examples.length, profiles:profileCounts, coverage:counts, transitions:transitionCounts, status:'contratos documentales válidos; no render ni calidad visual probados'};
}
module.exports = { validate };
if (require.main === module) {
  try {
    check(process.argv.length === 2, 'Uso: node docs/asset-engine/validar-scene-recipe-v1.cjs (sin argumentos)');
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'ejemplos-scene-recipe-v1.json'), 'utf8'));
    console.log(JSON.stringify(validate(d), null, 2));
  } catch (error) { console.error('SCENE RECIPE INVÁLIDA: ' + error.message); process.exitCode = 1; }
}
