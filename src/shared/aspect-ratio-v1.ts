export type ProjectAspectRatioV1 = 'vertical' | 'square' | 'horizontal'

export const normalizeProjectAspectRatioV1 = (value: unknown): ProjectAspectRatioV1 => {
  const normalized = String(value)
  if (['vertical', 'portrait', '9:16'].includes(normalized)) return 'vertical'
  if (['square', '1:1'].includes(normalized)) return 'square'
  return 'horizontal'
}

export const isVerticalAspectRatioV1 = (value: unknown): boolean => normalizeProjectAspectRatioV1(value) === 'vertical'
export const isSquareAspectRatioV1 = (value: unknown): boolean => normalizeProjectAspectRatioV1(value) === 'square'