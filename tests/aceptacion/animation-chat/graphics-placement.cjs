'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.resolve(__dirname, '../../../src/shared/exclusion.ts'), 'utf8')
const javascript = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 })
const commonModule = { exports: {} }
const sandbox = { exports: commonModule.exports, module: commonModule, require }
vm.runInNewContext(javascript, sandbox, { filename: 'src/shared/exclusion.ts' })
const { colocarYFiltrarTarjetas } = sandbox.module.exports

const fullTimeline = [
  { id: 'stock-0', category: 'stock', startSeconds: 0, durationSeconds: 3 },
  { id: 'visual-1', category: 'visual', startSeconds: 3, durationSeconds: 3 },
  { id: 'original-2', category: 'original', startSeconds: 6, durationSeconds: 3 },
]
const eligibleSourceList = fullTimeline.filter(c => c.category === 'stock' || c.category === 'original')
const overlapsAnimation = colocarYFiltrarTarjetas([
  { id: 'stock-0', graphicData: { type: 'frase_clave' }, graphicAbsoluteStart: 3.2, graphicDuration: 1 },
], fullTimeline)
assert.equal(overlapsAnimation.quedan.length, 0)
assert.equal(overlapsAnimation.descartadas.length, 1)
assert.equal(overlapsAnimation.descartadas[0].visual.id, 'visual-1')

const allowedOnOriginal = colocarYFiltrarTarjetas([
  { id: 'original-2', graphicData: { type: 'frase_clave' }, graphicAbsoluteStart: 6.2, graphicDuration: 1 },
], fullTimeline)
assert.equal(allowedOnOriginal.quedan.length, 1)

// The generator's input remains restricted to Original/Stock even though the exclusion
// check sees the complete timeline.
assert.deepEqual(eligibleSourceList.map(c => c.id), ['stock-0', 'original-2'])
console.log('Animation graphics placement: eligible targets stay Original/Stock and overlays on procedural Visuals are rejected.')
