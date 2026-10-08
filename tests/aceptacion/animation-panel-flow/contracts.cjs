const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '../../..')
const helperPath = path.join(root, 'src/shared/animation-panel-flow-v1.ts')
const helperSource = fs.readFileSync(helperPath, 'utf8')
const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const helperModule = { exports: {} }
new Function('module', 'exports', helperJs)(helperModule, helperModule.exports)
const { resolveAnimationPanelFlowV1 } = helperModule.exports

assert.deepEqual(resolveAnimationPanelFlowV1([], [{ text: 'transcrito' }]), { tool: 'subtitles', mode: 'scene' })
assert.deepEqual(resolveAnimationPanelFlowV1([{ type: 'audio', name: 'Voz - Audio Original' }], [{ text: 'transcrito' }]),
  { tool: 'animation', mode: 'style' })
assert.deepEqual(resolveAnimationPanelFlowV1([{ type: 'audio', narration: true }], []), { tool: 'animation', mode: 'style' })
assert.deepEqual(resolveAnimationPanelFlowV1([{ type: 'audio', name: 'Música ambiente' }], []), { tool: null, mode: 'scene' })

const mainSource = fs.readFileSync(path.join(root, 'src/renderer/src/main.tsx'), 'utf8')
const workspaceSource = fs.readFileSync(path.join(root, 'src/renderer/src/components/AnimationWorkspace.tsx'), 'utf8').replace(/\r\n/g, '\n')
const transcriptionSuccess = mainSource.match(/if \(data\.status === 'success'\)[\s\S]*?\n\s*}\s*else if \(data\.status === 'error'\)/)?.[0] || ''
assert.match(transcriptionSuccess, /setSelectedTool\('subtitles'\)/)
assert.doesNotMatch(transcriptionSuccess, /setSelectedTool\('animation'\)/)
assert.equal((mainSource.match(/openAnimationPanel\('style'\)/g) || []).length, 2,
  'both existing narration actions should open the style step after adding audio')
assert.match(mainSource, /restoreProjectPanel\(clipsDelTimeline, loadedData\.transcriptSegments \|\| \[\]\)/)
assert.match(mainSource, /flowMode=\{animationPanelMode\}/)
assert.match(mainSource, /onBackToAudio=\{\(\) => setSelectedTool\('voice'\)\}/)
const styleOnlyHandlerStart = workspaceSource.indexOf("if (flowMode === 'style') {")
const styleOnlyHandlerEnd = workspaceSource.indexOf('if (stylePatch &&', styleOnlyHandlerStart)
assert.ok(styleOnlyHandlerStart >= 0 && styleOnlyHandlerEnd > styleOnlyHandlerStart,
  'style-only updates should be handled before scene generation')
assert.match(workspaceSource.slice(styleOnlyHandlerStart, styleOnlyHandlerEnd), /return/)
assert.doesNotMatch(workspaceSource.slice(styleOnlyHandlerStart, styleOnlyHandlerEnd), /animationGenerateDraft/)
assert.match(workspaceSource, /Continuar con este estilo/)
assert.match(workspaceSource, /Volver al audio/)
assert.match(workspaceSource, /disabled=\{!input\.trim\(\) \|\| \(!styleOnly && !connection\?\.authenticated\)/)
assert.match(workspaceSource, /!styleOnly && currentDraft &&/)
assert.match(workspaceSource, /!styleOnly && <p className="mt-2 text-\[8px\][\s\S]*?Proveedor local/)

console.log('animation-panel-flow contracts: OK')
