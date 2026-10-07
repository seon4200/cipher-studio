'use strict'

const assert = require('node:assert/strict')
const { applyExactSourceEdits } = require('../../../src/main/animation/scene-template-source-edits.cjs')

const original = 'draw(); label("OPCIÓN", 0.46, right); finish();'
const corrected = applyExactSourceEdits(original, [{
  from: 'label("OPCIÓN", 0.46, right)',
  to: 'label("OPCIÓN", 0.76, center)',
}])
assert.equal(corrected.source, 'draw(); label("OPCIÓN", 0.76, center); finish();')
assert.equal(corrected.appliedCount, 1)
assert.throws(() => applyExactSourceEdits(original, [{ from: 'missing', to: 'replacement' }]),
  error => error.message === 'ANIMATION_TEMPLATE_SOURCE_EDIT_TARGET_COUNT_INVALID')
assert.throws(() => applyExactSourceEdits('label(); label();', [{ from: 'label()', to: 'newLabel()' }]),
  error => error.message === 'ANIMATION_TEMPLATE_SOURCE_EDIT_TARGET_COUNT_INVALID')
assert.throws(() => applyExactSourceEdits(original, [{ from: 'draw()', to: 'draw2()' }, { from: 'finish()', to: 'finish2()' },
  { from: 'x', to: 'y' }, { from: 'a', to: 'b' }, { from: 'c', to: 'd' }, { from: 'e', to: 'f' },
  { from: 'g', to: 'h' }, { from: 'i', to: 'j' }, { from: 'k', to: 'l' }]),
error => error.message === 'ANIMATION_TEMPLATE_SOURCE_EDITS_INVALID')
process.stdout.write('Animation saved-template source edits: exact single-target patching and bounds passed.\n')
