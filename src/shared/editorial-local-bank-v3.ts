import type { ModernLayoutStructureV4 } from './visual-layout-v4'
import { EDITORIAL_LOCAL_BANK_V2, validateEditorialLocalBankPlanV2,
  type EditorialLocalBankPlanV2 } from './editorial-local-bank-v2'

/** Extensible local catalog is opt-in; the prior V3 revision remains readable and frozen. */
export const EDITORIAL_LOCAL_BANK_V3_HISTORICAL = Object.freeze({
  id: 'editorial-local-bank-v3' as const,
  revision: 'editorial-local-bank-2026-09-v3' as const,
})
export const EDITORIAL_LOCAL_BANK_V3 = Object.freeze({
  id: 'editorial-local-bank-v3' as const,
  revision: 'editorial-local-bank-2026-09-v3.1' as const,
})
export const EDITORIAL_LOCAL_BANK_V3_REVISIONS = [EDITORIAL_LOCAL_BANK_V3_HISTORICAL.revision,
  EDITORIAL_LOCAL_BANK_V3.revision] as const
export const isEditorialLocalBankV3Revision = (revision: unknown): revision is typeof EDITORIAL_LOCAL_BANK_V3_REVISIONS[number] =>
  EDITORIAL_LOCAL_BANK_V3_REVISIONS.includes(revision as typeof EDITORIAL_LOCAL_BANK_V3_REVISIONS[number])
export const EDITORIAL_LOCAL_CATALOG_REVISION_V3 = 'editorial-modular-catalog-2026-09-ext-v2' as const
export const EDITORIAL_LOCAL_FAMILIES_V3 = [
  'marcoPoster', 'editorial', 'partidoVertical', 'cuaderno', 'constelacion', 'cascada',
] as const satisfies readonly ModernLayoutStructureV4[]

export type EditorialLocalBankPlanV3 = Omit<EditorialLocalBankPlanV2, 'revision'|'catalogRevision'> & {
  revision: typeof EDITORIAL_LOCAL_BANK_V3.revision | typeof EDITORIAL_LOCAL_BANK_V3_HISTORICAL.revision
  catalogRevision: string
  /** Optional semantically matched full-frame raster; absent means procedural paper. */
  backgroundAsset?: { assetId: string; sha256: string }
}

export function validateEditorialLocalBankPlanV3(value: unknown): EditorialLocalBankPlanV3 {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('EDITORIAL_LOCAL_BANK_V3_PLAN_INVALID')
  const plan = value as EditorialLocalBankPlanV3
  if (![EDITORIAL_LOCAL_BANK_V3.revision,EDITORIAL_LOCAL_BANK_V3_HISTORICAL.revision].includes(plan.revision) ||
      plan.catalogRevision !== EDITORIAL_LOCAL_CATALOG_REVISION_V3 ||
      !EDITORIAL_LOCAL_FAMILIES_V3.includes(plan.family as typeof EDITORIAL_LOCAL_FAMILIES_V3[number]))
    throw new Error('EDITORIAL_LOCAL_BANK_V3_REVISION_OR_FAMILY_INVALID')
  // Reuse the complete frozen structural/layout validator after adapting only its two
  // revision tokens. This keeps geometry and all common numeric checks single-sourced.
  const { backgroundAsset, ...commonPlan } = plan
  const compatible = { ...commonPlan, revision: EDITORIAL_LOCAL_BANK_V2.revision,
    catalogRevision: 'editorial-modular-catalog-2026-09-v1' }
  validateEditorialLocalBankPlanV2(compatible,{allowMissingFront:true,
    allowMissingRear:plan.revision===EDITORIAL_LOCAL_BANK_V3.revision})
  if (backgroundAsset && (!/^[a-z0-9][a-z0-9-]{2,95}$/.test(backgroundAsset.assetId) ||
      !/^[a-f0-9]{64}$/.test(backgroundAsset.sha256)))
    throw new Error('EDITORIAL_LOCAL_BANK_V3_BACKGROUND_ASSET_INVALID')
  return plan
}
