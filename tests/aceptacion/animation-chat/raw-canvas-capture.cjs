'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '../../..')
const source = fs.readFileSync(path.join(root, 'src/main/services/animation-integration.ts'), 'utf8')

assert.match(source, /process\.env\.CIPHER_ANIMATION_CAPTURE_MODE \|\| 'raw-canvas-rgba'/,
  'Full-canvas raw RGBA is the tested default; PNG capture remains an explicit comparison mode')
assert.match(source, /'raw-canvas-rgba'/, 'Capture mode identifier is present')
assert.match(source, /'-pix_fmt', 'rgba'.*'-video_size', `\$\{width\}x\$\{height\}`/s,
  'FFmpeg receives the raw canvas pixel format and the complete requested frame dimensions')
assert.match(source, /getImageData\(0,0,\$\{width\},\$\{height\}\)\.data\.buffer/,
  'Raw pixels come from the full Canvas backing store, not the clipped desktop window')
assert.match(source, /pixels\.byteLength !== width \* height \* 4/,
  'Every frame is checked for a complete RGBA pixel buffer before it reaches FFmpeg')
assert.match(source, /if \(captureMode === 'raw-canvas-rgba'\) \{[\s\S]*?toDataURL\("image\/png"\)/,
  'Only representative review captures retain PNG encoding in the raw path')

process.stdout.write('Animation raw canvas capture contract: full-size RGBA validation and selected PNG review frames passed.\n')
