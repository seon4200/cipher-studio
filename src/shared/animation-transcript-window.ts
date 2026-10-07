export type TimedWord = { word?: string; text?: string; start?: number; end?: number }
export type TimedSegment = { start?: number; end?: number; text?: string; words?: TimedWord[] }

/** Extract literal slot words from word timings and keep nearby context in a separate channel. */
export function clipAnimationTranscript(segments: TimedSegment[], clip: { startSeconds: number; durationSeconds: number; text?: string }) {
  const start = Number(clip.startSeconds) || 0
  const end = start + Number(clip.durationSeconds)
  const inRange: Array<{ start: number; end: number; text: string }> = []
  const previous: Array<{ start: number; end: number; text: string }> = []
  const next: Array<{ start: number; end: number; text: string }> = []
  let boundaryUnaligned = false

  for (const segment of segments || []) {
    const segmentStart = Number(segment?.start), segmentEnd = Number(segment?.end)
    const segmentText = String(segment?.text || '').trim()
    if (!Number.isFinite(segmentStart) || !Number.isFinite(segmentEnd)) continue
    const words = Array.isArray(segment.words) ? segment.words : []
    if (words.length) {
      for (const item of words) {
        const wordStart = Number(item?.start), wordEnd = Number(item?.end)
        const text = String(item?.word ?? item?.text ?? '')
        if (!text.trim() || !Number.isFinite(wordStart) || !Number.isFinite(wordEnd) || wordEnd < wordStart) continue
        if (wordEnd > start && wordStart < end) {
          inRange.push({ start: Math.max(wordStart, start) - start, end: Math.min(wordEnd, end) - start, text })
        } else if (wordEnd <= start && start - wordEnd <= 1.2) {
          previous.push({ start: wordStart, end: wordEnd, text })
        } else if (wordStart >= end && wordStart - end <= 1.2) {
          next.push({ start: wordStart, end: wordEnd, text })
        }
      }
      continue
    }

    if (!segmentText) continue
    if (segmentStart >= start && segmentEnd <= end) {
      inRange.push({ start: segmentStart - start, end: segmentEnd - start, text: segmentText })
    } else if (segmentEnd <= start && start - segmentEnd <= 1.2) {
      previous.push({ start: segmentStart, end: segmentEnd, text: segmentText })
    } else if (segmentStart >= end && segmentStart - end <= 1.2) {
      next.push({ start: segmentStart, end: segmentEnd, text: segmentText })
    } else if (segmentEnd > start && segmentStart < end) {
      // A whole paragraph that crosses the slot boundary is not a literal quote for this slot.
      boundaryUnaligned = true
    }
  }

  const ordered = (items: typeof inRange) => [...items].sort((a, b) => a.start - b.start)
  const formatWords = (items: typeof inRange) => ordered(items).map(item => item.text).join('').trim()
  const transcript = inRange.length ? [{ start: ordered(inRange)[0].start, end: ordered(inRange).at(-1)!.end,
    text: formatWords(inRange) }] : []
  const context = (items: typeof previous) => {
    const sorted = ordered(items)
    if (!sorted.length) return []
    return [{ start: sorted[0].start, end: sorted.at(-1)!.end, text: formatWords(sorted) }]
  }
  const quote = transcript.map(item => item.text).join(' ').trim()
  return { start, end, transcript, adjacentContext: [...context(previous), ...context(next)],
    fallbackQuote: quote || String(clip.text || '').trim(), timingPrecision: inRange.length ? 'word' : 'segment-or-slot-text',
    boundaryUnaligned }
}
