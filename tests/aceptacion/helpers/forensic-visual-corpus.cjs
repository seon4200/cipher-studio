const fs = require('fs')
const path = require('path')

function json (file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function transcriptRows (raw) {
  return Array.isArray(raw) ? raw : (Array.isArray(raw?.segments) ? raw.segments : [])
}

function loadForensicVisualAudit (repoRoot) {
  const auditRoot = path.resolve(repoRoot, '..', '..', '..', 'graphify', 'diagnostics', 'audit-last-real-video-20260909')
  const audit = {
    attempts: json(path.join(auditRoot, 'render-attempts.json')),
    timeline: json(path.join(auditRoot, 'timeline.json')),
    transcript: transcriptRows(json(path.join(auditRoot, 'transcript.json'))),
    visuals: json(path.join(auditRoot, 'visuals-complete.json')).visuals,
  }
  if (audit.attempts.length !== 50 || audit.visuals.length !== 34)
    throw new Error('FORENSIC_CORPUS_INVALID: se esperaban 50 pedidos y 34 Visuales históricos')
  return audit
}

function conceptsFromLog (value) {
  if (typeof value !== 'string') return []
  return value.split('|').map(part => part.trim()).filter(Boolean).map(part => {
    const pieces = part.split(/\s+/)
    return { emoji: pieces.shift() || '', etiqueta: pieces.join(' ') || 'contexto' }
  })
}

function rangeForAttempt (timeline, attempt) {
  const row = (timeline.rows || []).find(candidate => candidate.pos === attempt.pos)
  if (row && Number.isFinite(row.startSeconds) && Number.isFinite(row.end)) return { start: row.startSeconds, end: row.end }
  return { start: 0, end: 2 }
}

function keywordCandidates (value) {
  const keyword = typeof value === 'string' ? value.trim() : ''
  return keyword ? [{ keyword, source: 'scene-semantic' }] : undefined
}

function fallbackDirection (index) {
  const rows = [
    { fondo: 'tramaTejida', camara: 'quieto', densidad: 'media', ritmo: 'simultaneo' },
    { fondo: 'circuito', camara: 'deriva', densidad: 'baja', ritmo: 'frenando' },
    { fondo: 'cristales', camara: 'acercamiento', densidad: 'alta', ritmo: 'acelerando' },
  ]
  return { ...rows[index % rows.length], semilla: 940000 + index }
}

function directionForAttempt (attempt, beforeVisual, index) {
  const source = beforeVisual?.derivedDirection
  if (!source) return fallbackDirection(index)
  return {
    fondo: source.fondo,
    camara: source.camara,
    densidad: source.densidad,
    ritmo: source.ritmo,
    semilla: Number(beforeVisual.seed) || (950000 + index),
  }
}

function localSemanticFor (bundle, audit, attempt, beforeVisual, scenePrefix) {
  const range = rangeForAttempt(audit.timeline, attempt)
  const concepts = beforeVisual?.concepts?.length ? beforeVisual.concepts : conceptsFromLog(attempt.semantic?.conceptsLog)
  return bundle.createLocalSceneSemanticV1({
    sceneId: `${scenePrefix}-${attempt.pos.replace(':', '-')}`,
    start: range.start,
    end: range.end,
    transcriptSegments: audit.transcript,
    concepts,
    anchor: beforeVisual?.diagnosticInput?.anchor || concepts[0]?.etiqueta || concepts[0]?.label,
    relation: beforeVisual?.diagnosticInput?.relation,
    globalText: attempt.phrase,
    globalHints: [attempt.keyword, attempt.semantic?.queryTruncated].filter(Boolean),
    globalContextRef: 'forensic:' + attempt.pos,
  })
}

function resolveAttempt (bundle, audit, attempt, index, resolverSession, projectRoot, scenePrefix = 'v14') {
  const beforeVisual = audit.visuals.find(candidate => candidate.pos === attempt.pos)
  const localSemantic = localSemanticFor(bundle, audit, attempt, beforeVisual, scenePrefix)
  const candidates = keywordCandidates(beforeVisual?.diagnosticInput?.keyword || attempt.keyword)
  const resolved = bundle.resolveLocalSemanticVisualSceneV1({
    localSemantic,
    projectRoot,
    sistema: 'editorial',
    direction: directionForAttempt(attempt, beforeVisual, index),
    session: resolverSession,
    ...(candidates ? { keywordCandidates: candidates } : {}),
  })
  return { attempt, beforeVisual, localSemantic, resolved }
}

module.exports = {
  loadForensicVisualAudit,
  fallbackDirection,
  localSemanticFor,
  resolveAttempt,
}
