/** Explicit opt-in. Absence means historical provider selection, never migration. */
export const MODERN_VISUAL_PACK_ID = 'modern-pack-100-v1' as const
export const MODERN_VISUAL_PACK_REVISION = '2026-09-v1' as const
export type ModernVisualPackSelectionV1 = { id: typeof MODERN_VISUAL_PACK_ID; revision: typeof MODERN_VISUAL_PACK_REVISION }
export type ModernVisualAssetIdentityV1 = ModernVisualPackSelectionV1 & { assetId: string }
export const MODERN_VISUAL_PACK_V1: ModernVisualPackSelectionV1 = Object.freeze({ id: MODERN_VISUAL_PACK_ID, revision: MODERN_VISUAL_PACK_REVISION })
export type ModernVisualPackAssetV1 = {
  assetId: string; canonicalConcept: string; aliasesEs: string[]; aliasesEn: string[]
  source: 'fluent' | 'iconify' | 'tabler'; collection: string; license: string; licenseNotice: string
  format: 'svg'; sha256: string; originalColor: boolean; styleFamily: string
  heroAllowed: boolean; supportAllowed: boolean; priority: number; localRelativePath: string
}
export function validateModernVisualPackSelectionV1(value: unknown): ModernVisualPackSelectionV1 {
  const v = value as ModernVisualPackSelectionV1
  if (!v || v.id !== MODERN_VISUAL_PACK_ID || v.revision !== MODERN_VISUAL_PACK_REVISION ||
    Object.keys(v).some(k => !['id', 'revision'].includes(k))) throw new Error('MODERN_PACK_SELECTION_INVALID')
  return { id: v.id, revision: v.revision }
}
export function validateModernVisualAssetIdentityV1(value: unknown): ModernVisualAssetIdentityV1 {
  const v = value as ModernVisualAssetIdentityV1
  if (!v || !/^modern-[a-z0-9-]+-v1$/.test(v.assetId) || Object.keys(v).some(k => !['id', 'revision', 'assetId'].includes(k)))
    throw new Error('MODERN_PACK_ASSET_IDENTITY_INVALID')
  return { ...validateModernVisualPackSelectionV1({ id: v.id, revision: v.revision }), assetId: v.assetId }
}
