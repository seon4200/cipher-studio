/**
 * Frozen identity allowlist for the first IDEA Support microcatalog.
 * Physical files and provenance live only in the local import manifest; SceneSpec
 * stores the logical assetId and content SHA so a path can never affect pixels.
 */
export const IDEA_SUPPORT_CATALOG_V41 = Object.freeze([
  { assetId: 'idea-support-personas-v1', concept: 'personas', label: 'PERSONAS', sha256: 'c08045a69c674111850fde5002e51abbf44cae25bdc36b43c400639900fc6ca2' },
  { assetId: 'idea-support-datos-v1', concept: 'datos', label: 'DATOS', sha256: '30d12fccc09efa73b72922bf0c4deadb0daf7b6c57e4ff546726bdf0d127db13' },
  { assetId: 'idea-support-soluciones-v1', concept: 'soluciones', label: 'SOLUCIONES', sha256: 'dd672b9f82bbf418b4d499c240ea942bbb4da48daaff36c6d97ecef306b4d227' },
  { assetId: 'idea-support-impacto-v1', concept: 'impacto', label: 'IMPACTO', sha256: 'da8a6b755facffc73df096b42b73b03e30471bc21318fe10542169fdd7636152' },
  { assetId: 'idea-support-camera-v1', concept: 'camera', label: 'CÁMARA', sha256: '006a5e0be174c2e33762915cc77d285fcb7298a015eea68c2d6d279966b49d58' },
  { assetId: 'idea-support-network-v1', concept: 'network', label: 'RED', sha256: '5253a242efe17a171df4e43236032f0131ffe91c70dcd286a1f25998c275b209' },
  { assetId: 'idea-support-time-v1', concept: 'time', label: 'TIEMPO', sha256: 'e6fbab323900a808246df126968c6962a38297933c5ecc294db5c0cea9e507c8' },
  { assetId: 'idea-support-target-v1', concept: 'target', label: 'OBJETIVO', sha256: '6174308f3e6c0ec080a545380383a2e71e64a454e9f3c37b9258397c70ceda46' },
  { assetId: 'idea-support-connection-v1', concept: 'connection', label: 'CONEXIÓN', sha256: 'e80068f280fa3b3c91692e8bfb3ec1d7e9b3a2bf376953cf074713e15fdc2c6f' },
  { assetId: 'idea-support-flow-v1', concept: 'flow', label: 'FLUJO', sha256: 'cd800fcedb71a9ef0f8484834909e166d80a22bc200d50bbe053d3089abf7f93' },
] as const)

export type IdeaSupportCatalogAssetV41 = typeof IDEA_SUPPORT_CATALOG_V41[number]
export type IdeaSupportCatalogAssetIdV41 = IdeaSupportCatalogAssetV41['assetId']

export function getApprovedIdeaSupportV41(assetId: unknown): IdeaSupportCatalogAssetV41 | undefined {
  return IDEA_SUPPORT_CATALOG_V41.find(asset => asset.assetId === assetId)
}
