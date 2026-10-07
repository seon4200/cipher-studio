'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.resolve(__dirname, '../../../src/shared/animation-transcript-window.ts'), 'utf8')
const javascript = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 })
const commonModule = { exports: {} }
vm.runInNewContext(javascript, { exports: commonModule.exports, module: commonModule }, { filename: 'animation-transcript-window.ts' })
const { clipAnimationTranscript } = commonModule.exports

const selected = clipAnimationTranscript([
  { start: 0, end: 3.94, text: 'no se trata solamente de forzar al cerebro, se trata', words: [
    { word: 'no ', start: 0, end: 0.2 }, { word: 'forzar al cerebro,', start: 1.7, end: 2.9 },
    { word: 'se ', start: 3.6, end: 3.66 }, { word: 'trata ', start: 3.66, end: 3.92 },
  ] },
  { start: 3.94, end: 7, text: 'de trabajar con él, ahora, a ver amigos', words: [
    { word: 'de ', start: 3.94, end: 4.02 }, { word: 'trabajar ', start: 4.02, end: 4.5 },
    { word: 'con ', start: 4.5, end: 4.8 }, { word: 'él. ', start: 4.8, end: 5.3 },
    { word: 'ahora, ', start: 5.4, end: 5.8 }, { word: 'a ', start: 6.4, end: 6.5 }, { word: 'ver', start: 6.5, end: 6.7 },
  ] },
], { startSeconds: 3, durationSeconds: 3, text: 'slot phrase fallback' })
assert.equal(selected.transcript.map(x => x.text).join(' '), 'se trata de trabajar con él. ahora,')
assert(!selected.transcript[0].text.includes('forzar'), 'Neighboring words cannot become the slot quote')
assert(!selected.transcript[0].text.includes('ver'), 'Words after the slot are excluded from its literal quote')
assert.equal(selected.adjacentContext.length, 2, 'Previous and next context stay separate')
assert(selected.adjacentContext[0].text.includes('cerebro'))
assert(selected.adjacentContext[1].text.includes('ver'))

const unaligned = clipAnimationTranscript([{ start: 0, end: 8, text: 'whole sentence crosses slot without word timings' }],
  { startSeconds: 3, durationSeconds: 3, text: 'exact slot fallback' })
assert.equal(unaligned.transcript.length, 0)
assert.equal(unaligned.fallbackQuote, 'exact slot fallback')
assert.equal(unaligned.boundaryUnaligned, true)
console.log('Animation transcript window: word-timed literal quote excludes neighboring claims and retains context separately.')
