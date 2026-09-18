export type CaptureDiagnosticCode =
  | 'CAPTURE_EXACT_SIZE'
  | 'CAPTURE_UNIFORM_DPI_SCALE'
  | 'CAPTURE_ASPECT_MISMATCH'
  | 'CAPTURE_UNDERSIZED'
  | 'CAPTURE_NON_UNIFORM_SCALE'
  | 'CAPTURE_EMPTY'

export type CaptureDiagnostic = {
  code: CaptureDiagnosticCode
  requestedWidth: number
  requestedHeight: number
  capturedWidth: number
  capturedHeight: number
  ratioX: number
  ratioY: number
  expectedScale: number
}

/** Capture measurements stay diagnostic; they never enter the graphic hash. */
export function classifyGraphicsCapture(
  requestedWidth: number,
  requestedHeight: number,
  capturedWidth: number,
  capturedHeight: number,
  expectedScale: number,
  empty = false,
): CaptureDiagnostic {
  const ratioX = capturedWidth / requestedWidth
  const ratioY = capturedHeight / requestedHeight
  let code: CaptureDiagnosticCode
  if (empty || capturedWidth <= 0 || capturedHeight <= 0) code = 'CAPTURE_EMPTY'
  else if (capturedWidth < requestedWidth || capturedHeight < requestedHeight) code = 'CAPTURE_UNDERSIZED'
  else if (capturedWidth === requestedWidth && capturedHeight === requestedHeight) code = 'CAPTURE_EXACT_SIZE'
  else if (Math.abs(ratioX - ratioY) > 0.01) code = 'CAPTURE_ASPECT_MISMATCH'
  else if (Math.abs(ratioX - ratioY) > 0.0001) code = 'CAPTURE_NON_UNIFORM_SCALE'
  else if (expectedScale > 1 && Math.abs(ratioX - expectedScale) < 0.0001) {
    code = 'CAPTURE_UNIFORM_DPI_SCALE'
  } else code = 'CAPTURE_NON_UNIFORM_SCALE'
  return {
    code, requestedWidth, requestedHeight, capturedWidth, capturedHeight,
    ratioX, ratioY, expectedScale,
  }
}

export function requireExactGraphicsCapture(diagnostic: CaptureDiagnostic): void {
  if (diagnostic.code !== 'CAPTURE_EXACT_SIZE') {
    throw new Error(`${diagnostic.code}: requested=${diagnostic.requestedWidth}x${diagnostic.requestedHeight}` +
      ` actual=${diagnostic.capturedWidth}x${diagnostic.capturedHeight}` +
      ` ratioX=${diagnostic.ratioX.toFixed(6)} ratioY=${diagnostic.ratioY.toFixed(6)}` +
      ` expectedScale=${diagnostic.expectedScale}`)
  }
}
