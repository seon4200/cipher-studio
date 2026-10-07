'use strict'

const MAX_SOURCE_EDITS = 8
const MAX_EDIT_TEXT_CHARS = 1200

function applyExactSourceEdits(source, edits) {
  if (typeof source !== 'string' || !Array.isArray(edits) || edits.length > MAX_SOURCE_EDITS)
    throw new Error('ANIMATION_TEMPLATE_SOURCE_EDITS_INVALID')
  let next = source
  for (const edit of edits) {
    const from = edit?.from
    const to = edit?.to
    if (typeof from !== 'string' || typeof to !== 'string' || !from.length || from === to ||
        from.length > MAX_EDIT_TEXT_CHARS || to.length > MAX_EDIT_TEXT_CHARS)
      throw new Error('ANIMATION_TEMPLATE_SOURCE_EDIT_SHAPE_INVALID')
    const first = next.indexOf(from)
    if (first < 0 || next.indexOf(from, first + from.length) >= 0)
      throw new Error('ANIMATION_TEMPLATE_SOURCE_EDIT_TARGET_COUNT_INVALID')
    next = next.slice(0, first) + to + next.slice(first + from.length)
  }
  return { source: next, appliedCount: edits.length }
}

module.exports = { applyExactSourceEdits, MAX_SOURCE_EDITS, MAX_EDIT_TEXT_CHARS }
