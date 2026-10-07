'use strict'
;(function () {
  const canvas = document.getElementById('frame')
  const ctx = canvas.getContext('2d', { alpha: false })
  let plan = null
  let background = null
  let fontReady = false
  let registeredScene = null
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
  const mix = (a, b, t) => a + (b - a) * t
  const smooth = t => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u) }
  const fmt = (weight, size, family) => `${weight} ${size}px "${family}"`
  const editorialSurfaceCache = new Map()
  const EDITORIAL_CACHE_LIMIT = 18
  const stableStyleKey = value => {
    const normalize = item => Array.isArray(item) ? item.map(normalize) : item && typeof item === 'object'
      ? Object.fromEntries(Object.keys(item).sort().map(key => [key, normalize(item[key])])) : item
    return JSON.stringify(normalize(value))
  }
  function cachedSurface(key, width, height, draw) {
    let surface = editorialSurfaceCache.get(key)
    if (surface) return surface
    surface = document.createElement('canvas'); surface.width = Math.max(1, Math.ceil(width)); surface.height = Math.max(1, Math.ceil(height))
    draw(surface.getContext('2d'), surface.width, surface.height)
    editorialSurfaceCache.set(key, surface)
    if (editorialSurfaceCache.size > EDITORIAL_CACHE_LIMIT) editorialSurfaceCache.delete(editorialSurfaceCache.keys().next().value)
    return surface
  }
  function roundedPath(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2)
    context.beginPath(); context.roundRect(x, y, width, height, r)
  }
  function drawProceduralGlyph(context, glyph, center, color, size) {
    const [x, y] = center, s = size
    context.save(); context.translate(x, y); context.strokeStyle = color; context.fillStyle = color
    context.lineWidth = Math.max(7, s * .07); context.lineCap = 'round'; context.lineJoin = 'round'
    if (glyph === 'idea') {
      context.beginPath(); context.arc(0, -s * .08, s * .34, Math.PI, 0); context.lineTo(s * .2, s * .28); context.lineTo(-s * .2, s * .28); context.closePath(); context.stroke()
      context.beginPath(); context.moveTo(-s * .15, s * .4); context.lineTo(s * .15, s * .4); context.moveTo(-s * .11, s * .49); context.lineTo(s * .11, s * .49); context.stroke()
      context.beginPath(); context.moveTo(0, -s * .54); context.lineTo(0, -s * .4); context.moveTo(-s * .5, -s * .08); context.lineTo(-s * .38, -s * .08); context.moveTo(s * .5, -s * .08); context.lineTo(s * .38, -s * .08); context.stroke()
    } else if (glyph === 'voice' || glyph === 'signal') {
      for (let index = 0; index < 3; index++) {
        const yy = (index - 1) * s * .24
        context.beginPath(); context.moveTo(-s * .38, yy); context.bezierCurveTo(-s * .15, yy - s * .2, s * .15, yy + s * .2, s * .38, yy); context.stroke()
      }
    } else if (glyph === 'data' || glyph === 'growth') {
      const heights = [.42, .68, .94]
      heights.forEach((h, index) => { roundedPath(context, (index - 1) * s * .28 - s * .085, s * .36 - h * s, s * .17, h * s, s * .07); context.fill() })
      context.beginPath(); context.moveTo(-s * .42, s * .43); context.lineTo(s * .42, s * .43); context.stroke()
    } else if (glyph === 'group' || glyph === 'people') {
      for (let index = 0; index < 3; index++) {
        const xx = (index - 1) * s * .31, yy = index === 1 ? -s * .12 : -s * .03
        context.beginPath(); context.arc(xx, yy, s * .12, 0, Math.PI * 2); context.stroke()
        context.beginPath(); context.arc(xx, s * .28, s * .2, Math.PI, Math.PI * 2); context.stroke()
      }
    } else if (glyph === 'research' || glyph === 'focus') {
      context.beginPath(); context.arc(-s * .08, -s * .1, s * .27, .25, Math.PI * 1.85); context.stroke()
      context.beginPath(); context.moveTo(s * .12, s * .11); context.lineTo(s * .4, s * .39); context.stroke()
    } else if (glyph === 'result' || glyph === 'check') {
      context.beginPath(); context.arc(0, 0, s * .34, 0, Math.PI * 2); context.stroke()
      context.beginPath(); context.moveTo(-s * .2, 0); context.lineTo(-s * .04, s * .17); context.lineTo(s * .23, -s * .18); context.stroke()
    } else if (glyph === 'network') {
      const nodes = [[0,-s*.34],[-s*.31,s*.22],[s*.31,s*.22]]
      context.beginPath(); context.moveTo(...nodes[0]); context.lineTo(...nodes[1]); context.lineTo(...nodes[2]); context.closePath(); context.stroke()
      nodes.forEach(([nx,ny]) => { context.beginPath(); context.arc(nx,ny,s*.09,0,Math.PI*2); context.fill() })
    } else {
      roundedPath(context, -s * .3, -s * .3, s * .6, s * .6, s * .11); context.stroke()
      context.beginPath(); context.arc(0, 0, s * .09, 0, Math.PI * 2); context.fill()
    }
    context.restore()
  }
  function editorialBackground(context, width, height, palette, options = {}) {
    // v2 accepts the options object advertised to the Animation agent. Keep the
    // previous positional form readable for saved modules from editorial v1.
    if (width && typeof width === 'object') {
      options = width
      width = options.width
      height = options.height
      palette = options.palette
    }
    width = Number(width); height = Number(height)
    if (!Number.isFinite(width) || !Number.isFinite(height) || !palette || typeof palette.background !== 'string')
      throw new Error('ANIMATION_EDITORIAL_BACKGROUND_ARGUMENTS_INVALID')
    const style = { gridOpacity: options.gridOpacity ?? plan?.style?.gridOpacity ?? .075,
      textureStrength: options.textureStrength ?? plan?.style?.textureStrength ?? .045, seed: options.seed ?? 1 }
    const key = stableStyleKey({ kind: 'editorial-bg-v1', width, height, palette, style })
    const surface = cachedSurface(key, width, height, (b, w, h) => {
      b.fillStyle = palette.background; b.fillRect(0, 0, w, h)
      const wash = b.createRadialGradient(w * .5, h * .38, h * .05, w * .5, h * .5, h * .75)
      wash.addColorStop(0, palette.highlight || '#ffffff'); wash.addColorStop(1, palette.background)
      b.globalAlpha = .48; b.fillStyle = wash; b.fillRect(0, 0, w, h); b.globalAlpha = 1
      b.strokeStyle = `rgba(15,23,42,${style.gridOpacity})`; b.lineWidth = Math.max(1, w * .0015)
      const step = Math.max(28, Math.round(w / 24))
      for (let x = step; x < w; x += step) { b.beginPath(); b.moveTo(x, h * .12); b.lineTo(x, h * .88); b.stroke() }
      for (let y = Math.round(h * .12); y < h * .88; y += step) { b.beginPath(); b.moveTo(w * .06, y); b.lineTo(w * .94, y); b.stroke() }
      b.fillStyle = `rgba(15,23,42,${style.textureStrength})`
      // Fixed integer sequence: the texture is repeatable and generated only on cache miss.
      let state = (Math.trunc(style.seed) || 1) >>> 0
      const count = Math.round(w * h / 3100)
      for (let i = 0; i < count; i++) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0
        const x = (state / 4294967296) * w
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0
        const y = (state / 4294967296) * h
        b.fillRect(x, y, Math.max(1, w / 1080), Math.max(1, w / 1080))
      }
    })
    context.drawImage(surface, 0, 0, width, height)
  }
  function editorialObject(context, options = {}) {
    const { x = 0, y = 0, size = 240, palette = plan?.style?.palette, glyph = 'object' } = options
    if (!palette || !Number.isFinite(size) || size <= 0) return
    const treatment = options.style && typeof options.style === 'object' ? options.style : {}
    const shape = options.shape || 'tile', depth = options.surfaceDepth ?? treatment.surfaceDepth ?? plan?.style?.surfaceDepth ?? 1
    const shadow = options.shadowStrength ?? treatment.shadowStrength ?? plan?.style?.shadowStrength ?? .85
    const px = Math.ceil(size * 1.28), key = stableStyleKey({ kind: 'editorial-object-v1', size: px, shape, glyph, palette, depth, shadow })
    const surface = cachedSurface(key, px, px, (b, w, h) => {
      const cx = w / 2, cy = h / 2, radius = size * .48
      b.save(); b.shadowColor = `rgba(15,23,42,${.2 * shadow})`; b.shadowBlur = size * .12; b.shadowOffsetY = size * .08
      const round = shape === 'medallion' || shape === 'coin'
      const pathFor = (offset = 0) => {
        b.beginPath()
        if (round) b.arc(cx + offset, cy + offset, radius, 0, Math.PI * 2)
        else if (shape === 'diamond') {
          b.moveTo(cx + offset, cy - radius + offset); b.lineTo(cx + radius + offset, cy + offset)
          b.lineTo(cx + offset, cy + radius + offset); b.lineTo(cx - radius + offset, cy + offset); b.closePath()
        } else b.roundRect(cx - radius + offset, cy - radius + offset, radius * 2, radius * 2, size * .15)
      }
      b.fillStyle = palette.shadow || '#0f172a'; pathFor(size * .07 * depth); b.fill(); b.restore()
      const fill = b.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius)
      fill.addColorStop(0, palette.highlight || '#ffffff'); fill.addColorStop(.38, palette.surface); fill.addColorStop(1, palette.secondary || palette.accent)
      b.fillStyle = fill; pathFor(); b.fill()
      b.strokeStyle = palette.accent; b.lineWidth = Math.max(4, size * .018); pathFor(); b.stroke()
      if (round) {
        b.strokeStyle = `rgba(255,255,255,${.8 * shadow})`; b.lineWidth = Math.max(3, size * .012)
        b.beginPath(); b.arc(cx, cy, radius * .84, Math.PI * 1.1, Math.PI * 1.92); b.stroke()
      } else {
        b.strokeStyle = `rgba(255,255,255,${.62 * shadow})`; b.lineWidth = Math.max(3, size * .012)
        roundedPath(b, cx - radius * .84, cy - radius * .84, radius * 1.68, radius * 1.68, size * .11); b.stroke()
      }
      drawProceduralGlyph(b, glyph, [cx, cy], palette.ink, size * .8)
    })
    context.save(); context.globalAlpha *= clamp(options.opacity ?? 1, 0, 1); context.translate(x, y); context.rotate(options.rotation || 0)
    context.drawImage(surface, -size * .64, -size * .64, size * 1.28, size * 1.28); context.restore()
  }
  function editorialText(context, options = {}) {
    const text = String(options.text ?? ''), width = Math.max(1, Number(options.maxWidth) || 800)
    const family = options.fontFamily || plan?.style?.bodyFontFamily || 'DM Sans'
    const size = Math.max(10, Number(options.size) || 48), maxLines = Math.max(1, Math.min(6, Number(options.maxLines) || 2))
    const weight = options.weight || 600, font = `${weight} ${size}px "${family}"`
    context.save(); context.font = font
    const lines = linesFor(context, text, width, font), shown = lines.slice(0, maxLines)
    const lineHeight = Number(options.lineHeight) || size * 1.12
    context.fillStyle = options.color || plan?.style?.palette?.ink || '#111827'
    context.textAlign = options.align || 'center'; context.textBaseline = 'middle'
    const x = Number(options.x) || 0, y = Number(options.y) || 0
    shown.forEach((line, index) => context.fillText(line, x, y + (index - (shown.length - 1) / 2) * lineHeight, width))
    context.restore()
    return { lines: shown, width, height: shown.length * lineHeight, truncated: lines.length > maxLines }
  }
  function editorialRoute(context, options = {}) {
    const progress = clamp(Number(options.progress) || 0, 0, 1)
    let points
    if (Array.isArray(options.points) && options.points.length >= 2) {
      points = options.points.map(point => Array.isArray(point)
        ? [Number(point[0]), Number(point[1])] : [Number(point?.x), Number(point?.y)])
      if (points.some(point => !point.every(Number.isFinite))) throw new Error('ANIMATION_EDITORIAL_ROUTE_POINTS_INVALID')
    } else {
      const from = options.from || [0, 0], to = options.to || [0, 0]
      const bend = Number(options.bend) || 0, dx = to[0] - from[0], dy = to[1] - from[1], d = Math.max(1, Math.hypot(dx, dy))
      const nx = -dy / d, ny = dx / d, lift = bend || d * .12
      points = [from, [mix(from[0], to[0], .32) + nx * lift, mix(from[1], to[1], .32) + ny * lift],
        [mix(from[0], to[0], .72) + nx * lift, mix(from[1], to[1], .72) + ny * lift], to]
    }
    // Sample a smooth Catmull-Rom path so declared waypoints remain editable
    // scene geometry and progress is uniform by traveled distance.
    const sampled = [points[0]]
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)]
      for (let step = 1; step <= 12; step++) {
        const u = step / 12, u2 = u * u, u3 = u2 * u
        sampled.push([0.5 * ((2*p1[0])+(-p0[0]+p2[0])*u+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*u2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*u3),
          0.5 * ((2*p1[1])+(-p0[1]+p2[1])*u+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*u2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*u3)])
      }
    }
    const lengths = [0]
    for (let i = 1; i < sampled.length; i++) lengths[i] = lengths[i - 1] + Math.hypot(sampled[i][0] - sampled[i - 1][0], sampled[i][1] - sampled[i - 1][1])
    const distance = lengths[lengths.length - 1] * progress
    let endIndex = 1
    while (endIndex < lengths.length - 1 && lengths[endIndex] < distance) endIndex++
    const segmentStart = sampled[endIndex - 1], segmentEnd = sampled[endIndex]
    const segmentDistance = Math.max(.001, lengths[endIndex] - lengths[endIndex - 1])
    const partial = clamp((distance - lengths[endIndex - 1]) / segmentDistance, 0, 1)
    const endPoint = [mix(segmentStart[0], segmentEnd[0], partial), mix(segmentStart[1], segmentEnd[1], partial)]
    context.save(); context.strokeStyle = options.color || plan?.style?.palette?.accent || '#0284c7'
    context.lineWidth = Math.max(2, Number(options.width) || 14); context.lineCap = 'round'; context.lineJoin = 'round'
    context.beginPath(); context.moveTo(sampled[0][0], sampled[0][1])
    for (let i = 1; i < endIndex; i++) context.lineTo(sampled[i][0], sampled[i][1])
    if (progress > 0) context.lineTo(endPoint[0], endPoint[1])
    context.stroke(); context.restore()
    if (options.traveler && progress > 0 && progress < 1)
      editorialTraveler(context, { x: endPoint[0], y: endPoint[1], ...(typeof options.traveler === 'object' ? options.traveler : {}), color: options.traveler.color || options.color })
    return endPoint
  }
  function editorialTraveler(context, options = {}) {
    const r = Math.max(3, Number(options.radius) || 20), x = Number(options.x) || 0, y = Number(options.y) || 0
    context.save(); context.globalAlpha *= clamp(options.opacity ?? 1, 0, 1)
    context.fillStyle = options.glow || options.color || plan?.style?.palette?.accent || '#0284c7'
    context.globalAlpha *= .22; context.beginPath(); context.arc(x, y, r * 1.9, 0, Math.PI * 2); context.fill()
    context.globalAlpha = clamp(options.opacity ?? 1, 0, 1); context.fillStyle = options.color || plan?.style?.palette?.accent || '#0284c7'
    context.beginPath(); context.arc(x, y, r, 0, Math.PI * 2); context.fill()
    context.strokeStyle = options.edge || plan?.style?.palette?.surface || '#f8fafc'; context.lineWidth = Math.max(2, r * .18)
    context.stroke(); context.restore()
  }

  function linesFor(context, value, maxWidth, font) {
    context.font = font
    const words = String(value || '').split(/\s+/)
    const lines = []; let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (line && context.measureText(next).width > maxWidth) { lines.push(line); line = word }
      else line = next
    }
    if (line) lines.push(line)
    return lines
  }
  function textBlock(context, value, x, y, width, font, color, lineHeight, maxLines = 3) {
    const lines = linesFor(context, value, width, font).slice(0, maxLines)
    context.fillStyle = color; context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = font
    const first = y - (lines.length - 1) * lineHeight / 2
    lines.forEach((line, i) => context.fillText(line, x, first + i * lineHeight, width))
  }
  function prepareBackground() {
    background = document.createElement('canvas'); background.width = 1080; background.height = 1920
    const b = background.getContext('2d'); const p = plan.style.palette
    b.fillStyle = p.background; b.fillRect(0, 0, 1080, 1920)
    const wash = b.createLinearGradient(0, 0, 0, 1920)
    wash.addColorStop(0, 'rgba(255,255,255,.23)'); wash.addColorStop(.48, 'rgba(255,255,255,0)'); wash.addColorStop(1, 'rgba(30,36,33,.035)')
    b.fillStyle = wash; b.fillRect(0, 0, 1080, 1920)
    b.strokeStyle = 'rgba(40,45,42,.07)'; b.lineWidth = 2
    b.beginPath(); b.moveTo(94, 408); b.lineTo(986, 408); b.moveTo(94, 1604); b.lineTo(986, 1604); b.stroke()
    b.fillStyle = 'rgba(50,56,51,.06)'
    for (let y = 468; y < 1500; y += 44) for (let x = 112; x < 980; x += 44) b.fillRect(x, y, 2, 2)
  }
  function nodePose(participant, t) {
    const enterEnd = plan.time.entryEnd
    const start = [participant.x, participant.y + 130]
    const keys = [[0, start[0], start[1]], [enterEnd, participant.x, participant.y]]
    const result = typeof window.keyPath === 'function' ? window.keyPath(t, keys) : [mix(start[0], participant.x, smooth(t / enterEnd)), mix(start[1], participant.y, smooth(t / enterEnd))]
    const appeared = smooth(t / enterEnd)
    const settled = t > enterEnd ? 1 + (typeof window.settle === 'function' ? window.settle(t, enterEnd, { amp: .025, freq: 2.2, decay: 6, phase: Math.PI / 2 }) : 0) : 1
    return { x: result[0], y: result[1], alpha: appeared, scale: mix(.84, 1, appeared) * settled }
  }
  function participantMap(t) {
    return Object.fromEntries(plan.composition.participants.map(p => [p.instanceId, { def: p, pose: nodePose(p, t) }]))
  }
  function anchor(a, b, radius, reverse = false) {
    let dx = b.x - a.x, dy = b.y - a.y
    const d = Math.max(1, Math.hypot(dx, dy)); const sign = reverse ? -1 : 1
    return [a.x + sign * dx / d * radius, a.y + sign * dy / d * radius]
  }
  function routeGeometry(a, b, bend = 0) {
    // The destination anchor faces the source, keeping the route attached to the near edge.
    const p0 = anchor(a, b, a.r), p3 = anchor(b, a, b.r)
    const dx = p3[0] - p0[0], dy = p3[1] - p0[1], d = Math.max(1, Math.hypot(dx, dy))
    const nx = -dy / d, ny = dx / d
    const lift = bend || Math.min(84, d * .11)
    const p1 = [mix(p0[0], p3[0], .38) + nx * lift, mix(p0[1], p3[1], .38) + ny * lift]
    const p2 = [mix(p0[0], p3[0], .68) + nx * lift, mix(p0[1], p3[1], .68) + ny * lift]
    return { p0, p1, p2, p3 }
  }
  function curvePoint(a, b, u, bend = 0) {
    const { p0, p1, p2, p3 } = routeGeometry(a, b, bend)
    const v = 1 - u
    return [v*v*v*p0[0] + 3*v*v*u*p1[0] + 3*v*u*u*p2[0] + u*u*u*p3[0],
      v*v*v*p0[1] + 3*v*v*u*p1[1] + 3*v*u*u*p2[1] + u*u*u*p3[1]]
  }
  function drawRelations(t, nodes) {
    if (plan.recipe.id === 'explanatory-transfer-v1') {
      for (const rel of plan.composition.relations) {
        const a = nodes[rel.from], b = nodes[rel.to]; if (!a || !b) continue
        const arrive = plan.time.events.find(e => e.kind === 'arrival' && e.relationId === rel.id)
        const alpha = smooth((t - plan.time.actionStart) / Math.max(.01, plan.time.organizeEnd - plan.time.actionStart + .25))
        const from = { ...a.pose, r: a.def.radius * a.pose.scale }
        const to = { ...b.pose, r: b.def.radius * b.pose.scale }
        const bend = Math.min(84, Math.hypot(to.x - from.x, to.y - from.y) * .11) +
          (rel.order - (plan.composition.relations.length - 1) / 2) * 34
        const route = routeGeometry(from, to, bend)
        if (alpha > .005) {
          ctx.save(); ctx.globalAlpha = alpha * .82; ctx.strokeStyle = plan.style.palette.secondary; ctx.lineWidth = rel.strokeWidth
          ctx.lineCap = 'round'; ctx.setLineDash([18, 14]); ctx.beginPath(); ctx.moveTo(route.p0[0], route.p0[1]);
          ctx.bezierCurveTo(route.p1[0], route.p1[1], route.p2[0], route.p2[1], route.p3[0], route.p3[1]); ctx.stroke(); ctx.restore()
        }
        if (!arrive || t < plan.time.actionStart || t > arrive.at) continue
        const u = clamp((t - plan.time.actionStart) / Math.max(.02, arrive.at - plan.time.actionStart), 0, 1)
        const pos = curvePoint(from, to, u, bend)
        ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = plan.style.palette.accent; ctx.beginPath(); ctx.arc(pos[0], pos[1], rel.travelerRadius * 1.9, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 1; ctx.fillStyle = plan.style.palette.accent; ctx.beginPath(); ctx.arc(pos[0], pos[1], rel.travelerRadius, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = plan.style.palette.surface; ctx.lineWidth = 5; ctx.stroke(); ctx.restore()
      }
    } else if (plan.recipe.id === 'group-formation-v1') {
      const u = smooth((t - plan.time.actionStart) / Math.max(.01, plan.time.actionEnd - plan.time.actionStart))
      if (u > .01) {
        ctx.save(); ctx.globalAlpha = .55 * u; ctx.strokeStyle = plan.style.palette.accent; ctx.lineWidth = 7; ctx.setLineDash([16, 14])
        ctx.beginPath(); ctx.ellipse(540, 960, 350 * u, 350 * u, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
      }
    } else {
      const sides = ['left', 'right']
      sides.forEach((side, index) => {
        const start = plan.time.actionStart + index * .22
        const u = smooth((t - start) / .45); if (u <= 0) return
        const x = side === 'left' ? 285 : 795
        ctx.save(); ctx.globalAlpha = .12 + .2 * u; ctx.fillStyle = index ? plan.style.palette.secondary : plan.style.palette.accent
        ctx.beginPath(); ctx.ellipse(x, 1010, 196, 440, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore()
      })
    }
  }
  function drawSymbol(p, x, y, r, color) {
    const s = r * .43; ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    if (p.symbol === 'voice') {
      for (let i = 0; i < 3; i++) { const offset = (i - 1) * 34; ctx.beginPath(); ctx.moveTo(-s * .72, offset); ctx.bezierCurveTo(-s * .28, offset - 44, s * .18, offset + 44, s * .72, offset); ctx.stroke() }
    } else if (p.symbol === 'data') {
      const bars = [.43, .74, 1, .62]; bars.forEach((h, i) => { ctx.beginPath(); ctx.roundRect((i - 1.5) * 43 - 14, -h * s / 2, 28, h * s, 13); ctx.fill() })
      ctx.beginPath(); ctx.moveTo(-s * .9, s * .66); ctx.lineTo(s * .9, s * .66); ctx.stroke()
    } else if (p.symbol === 'idea') {
      ctx.beginPath(); ctx.arc(0, -12, s * .57, Math.PI, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * .57, -12); ctx.lineTo(-s * .35, s * .32); ctx.lineTo(-s * .2, s * .5); ctx.lineTo(s * .2, s * .5); ctx.lineTo(s * .35, s * .32); ctx.lineTo(s * .57, -12); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(-s * .18, s * .66); ctx.lineTo(s * .18, s * .66); ctx.stroke()
    } else if (p.symbol === 'research') {
      ctx.beginPath(); ctx.arc(-12, -15, s * .43, .3, Math.PI * 1.9); ctx.stroke(); ctx.beginPath(); ctx.moveTo(s * .15, s * .24); ctx.lineTo(s * .72, s * .77); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(-s * .57, s * .8); ctx.lineTo(s * .47, s * .8); ctx.stroke()
    } else if (p.symbol === 'group') {
      [-.46, 0, .46].forEach((k, i) => { ctx.beginPath(); ctx.arc(k * s, -s * .22 + (i === 1 ? -12 : 0), s * .17, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(k * s, s * .28, s * .28, Math.PI, Math.PI * 2); ctx.stroke() })
    } else if (p.symbol === 'result') {
      ctx.beginPath(); ctx.arc(0, 0, s * .61, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * .35, 0); ctx.lineTo(-s * .08, s * .28); ctx.lineTo(s * .42, -s * .28); ctx.stroke()
    } else if (p.symbol === 'growth') {
      const bars = [.28, .48, .72]
      bars.forEach((h, i) => { const x = (i - 1) * s * .4 - s * .12; ctx.beginPath(); ctx.roundRect(x, s * .52 - h * s, s * .24, h * s, s * .07); ctx.fill() })
      ctx.beginPath(); ctx.moveTo(-s * .62, s * .57); ctx.lineTo(-s * .12, s * .12); ctx.lineTo(s * .16, s * .28); ctx.lineTo(s * .65, -s * .52); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(s * .35, -s * .5); ctx.lineTo(s * .65, -s * .52); ctx.lineTo(s * .63, -s * .2); ctx.stroke()
    } else {
      ctx.beginPath(); ctx.roundRect(-s * .62, -s * .58, s * 1.24, s * 1.16, 28); ctx.stroke()
      ctx.beginPath(); ctx.arc(0, 0, s * .19, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }
  function drawParticipants(t, nodes) {
    for (const p of plan.composition.participants) {
      const current = nodes[p.instanceId]; const { x, y, alpha, scale } = current.pose; const r = p.radius * scale
      ctx.save(); ctx.globalAlpha = alpha
      const arrivals = plan.time.events.filter(e => e.kind === 'arrival' && plan.composition.relations.find(rel => rel.id === e.relationId)?.to === p.instanceId)
      let halo = 0
      for (const event of arrivals) { const progress = clamp((t - event.at) / Math.max(.01, event.endsAt - event.at), 0, 1); if (t >= event.at && progress < 1) halo = Math.max(halo, Math.sin(progress * Math.PI) * .18) }
      if (halo) { ctx.globalAlpha = halo; ctx.fillStyle = plan.style.palette.accent; ctx.beginPath(); ctx.arc(x, y, r * 1.34, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = alpha }
      ctx.fillStyle = plan.style.palette.surface; ctx.strokeStyle = p.destination ? plan.style.palette.accent : plan.style.palette.ink; ctx.lineWidth = p.destination ? 9 : 7
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.fillStyle = plan.style.palette.accent; ctx.globalAlpha = alpha * .11; ctx.beginPath(); ctx.arc(x, y, r * .84, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = alpha
      drawSymbol(p, x, y, r, p.destination ? plan.style.palette.accent : plan.style.palette.ink)
      if (halo) { ctx.globalAlpha = alpha * .8; ctx.strokeStyle = plan.style.palette.accent; ctx.lineWidth = 11; ctx.beginPath(); ctx.arc(x, y, r * (1.12 + halo * 1.1), 0, Math.PI * 2); ctx.stroke() }
      ctx.globalAlpha = alpha; ctx.fillStyle = plan.style.palette.ink
      textBlock(ctx, p.label, x, y + r + 58, 310, fmt(700, 38 * plan.style.labelScale, plan.style.bodyFontFamily || 'DM Sans'), plan.style.palette.ink, 43 * plan.style.labelScale, 2)
      ctx.restore()
    }
  }
  function drawOutcome(t) {
    const p = plan.style.palette; const start = plan.time.readStart
    const alpha = smooth((t - start + .12) / .28)
    if (alpha <= 0) return
    ctx.save(); ctx.globalAlpha = alpha
    const text = plan.composition.outcome.text; const font = fmt(700, 42 * plan.style.labelScale, plan.style.bodyFontFamily || 'DM Sans')
    const lines = linesFor(ctx, text, 760, font).slice(0, 2); const h = Math.max(84, lines.length * 52 + 38); const y = plan.composition.outcome.y
    ctx.fillStyle = p.surface; ctx.strokeStyle = p.accent; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(150, y - h / 2, 780, h, 42); ctx.fill(); ctx.stroke()
    textBlock(ctx, text, 540, y, 720, font, p.ink, 52 * plan.style.labelScale, 2)
    ctx.restore()
  }
  function renderAt(outputSeconds) {
    if (!plan || !Number.isFinite(outputSeconds)) throw new Error('ANIMATION_RENDER_TIME_INVALID')
    const t = clamp(outputSeconds, 0, plan.clock.durationSec)
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (plan.schema === 'cipher-animation-code-scene-plan-v1') {
      const palette = plan.style.palette
      ctx.fillStyle = palette.background; ctx.fillRect(0, 0, canvas.width, canvas.height)
      const state = registeredScene.render({ ctx, t, durationSec: plan.clock.durationSec, width: canvas.width,
        height: canvas.height, palette, style: plan.style, params: plan.parameters, lib: animationCanvasLibrary })
      return { seconds: t, phase: state?.phase || 'action', state: state?.state || '' }
    }
    ctx.drawImage(background, 0, 0)
    const exit = smooth((t - plan.time.exitStart) / Math.max(.01, plan.clock.durationSec - plan.time.exitStart))
    const nodes = participantMap(t)
    drawRelations(t, nodes); drawParticipants(t, nodes)
    const p = plan.style.palette
    ctx.save(); ctx.globalAlpha = 1 - exit * .72
    textBlock(ctx, plan.composition.title.text, plan.composition.title.x, plan.composition.title.y, plan.composition.title.maxWidth,
      fmt(600, 86 * (plan.style.titleScale || 1), plan.style.titleFontFamily || 'Instrument Serif'), p.ink, 94 * (plan.style.titleScale || 1), 2)
    ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(540, 350, 7, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    drawOutcome(t)
    if (exit) { ctx.save(); ctx.globalAlpha = exit * .34; ctx.fillStyle = p.background; ctx.fillRect(0, 0, 1080, 1920); ctx.restore() }
    return { seconds: t, phase: t < plan.time.entryEnd ? 'entry' : t < plan.time.organizeEnd ? 'organization' : t < plan.time.actionEnd ? 'action' : t < plan.time.readStart ? 'arrival' : t < plan.time.exitStart ? 'reading' : 'exit' }
  }
  const animationCanvasLibrary = Object.freeze({
    keyPath: window.keyPath, settle: window.settle, drawingTrack: window.drawingTrack,
    makeStroke: window.makeStroke, drawStroke: window.drawStroke, motionPath: window.motionPath,
    morphPoints: window.morphPoints, solveLimb: window.solveLimb,
    withCamera: (context, camera, seconds, durationSec, width, height, drawWorld) => {
      if (typeof drawWorld !== 'function') throw new Error('ANIMATION_CAMERA_DRAW_CALLBACK_REQUIRED')
      if (!camera || !Array.isArray(camera.keyframes) || camera.keyframes.length === 0) return drawWorld()
      const keys = camera.keyframes.map(key => ({ at: clamp(Number(key.atSec) || 0, 0, durationSec),
        focusX: clamp(Number(key.focusX ?? .5), 0, 1), focusY: clamp(Number(key.focusY ?? .5), 0, 1),
        zoom: clamp(Number(key.zoom ?? 1), .8, 2.2), rotation: clamp(Number(key.rotation ?? 0), -.25, .25) }))
        .sort((a, b) => a.at - b.at)
      const t = clamp(seconds, 0, durationSec)
      let left = keys[0], right = keys[keys.length - 1]
      for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i].at && t <= keys[i + 1].at) { left = keys[i]; right = keys[i + 1]; break }
      const u = right.at === left.at ? (t < right.at ? 0 : 1) : smooth((t - left.at) / (right.at - left.at))
      const pose = { focusX: mix(left.focusX, right.focusX, u), focusY: mix(left.focusY, right.focusY, u),
        zoom: mix(left.zoom, right.zoom, u), rotation: mix(left.rotation, right.rotation, u) }
      context.save()
      context.translate(width / 2, height / 2)
      context.rotate(pose.rotation)
      context.scale(pose.zoom, pose.zoom)
      context.translate(-pose.focusX * width, -pose.focusY * height)
      try { return drawWorld() } finally { context.restore() }
    },
    editorialBackground, editorialObject, editorialText, editorialRoute, editorialTraveler,
  })
  function registerScene(scene) {
    if (!scene || typeof scene !== 'object' || !/^[a-z][a-z0-9-]{2,63}$/.test(scene.id || '') ||
        typeof scene.render !== 'function' || registeredScene) throw new Error('ANIMATION_SCENE_REGISTRATION_INVALID')
    registeredScene = scene
  }
  async function bootstrap(nextPlan, fontAssets) {
    const isCodeScene = nextPlan?.schema === 'cipher-animation-code-scene-plan-v1'
    if (!nextPlan || (!isCodeScene && nextPlan.schema !== 'cipher-animation-scene-plan-v1')) throw new Error('ANIMATION_PLAN_SCHEMA_UNSUPPORTED')
    if (isCodeScene && (!registeredScene || registeredScene.id !== nextPlan.scene?.id)) throw new Error('ANIMATION_SCENE_MODULE_MISSING')
    plan = nextPlan
    const titleFont = new FontFace('Instrument Serif', `url(data:font/ttf;base64,${fontAssets.instrumentSerif})`)
    const bodyFont = new FontFace('DM Sans', `url(data:font/ttf;base64,${fontAssets.dmSans})`)
    await Promise.all([titleFont.load(), bodyFont.load()]); document.fonts.add(titleFont); document.fonts.add(bodyFont); fontReady = true
    if (!isCodeScene) prepareBackground()
    renderAt(0)
    const diagnostics = { ready: true, fontReady, width: canvas.width, height: canvas.height,
      fps: plan.viewport.fps, frameCount: Math.round(plan.clock.durationSec * plan.viewport.fps) }
    // executeJavaScript() serializes return values across Chromium's boundary. Keep the
    // callable renderAt exclusively in-page; return cloneable diagnostics to the main process.
    window.__cipherAnimationRuntime = { ...diagnostics, renderAt }
    return diagnostics
  }
  window.CipherAnimation = { bootstrap, registerScene }
  window.__cipherAnimationRuntime = { ready: false, fontReady: false }
})()
