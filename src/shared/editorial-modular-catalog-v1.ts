import registryJson from './editorial-modular-catalog-v1.registry.json'
import type { IdeaColorIntentV4 } from './editorial-idea-assembly-v1'

/** Additive opt-in contract. V1–V4.1 IDEA scenes never enter this dispatch. */
export const EDITORIAL_MODULAR_CATALOG_V1 = Object.freeze({
  id: 'editorial-modular-catalog-v1' as const,
  revision: 'editorial-modular-catalog-2026-09-v1' as const,
})
export const MODULAR_CATALOG_REVISION_V1 = 'editorial-modular-catalog-2026-09-v1' as const
export const MODULAR_CATALOG_PACK_ID_V1 = 'editorial-modular-catalog-v1-250' as const
export type ModularCatalogRoleV1 = 'support' | 'hero-core' | 'rear-collage' | 'front-collage' | 'accent-mask'
export type ModularRecipeV1 = 'vertical' | 'wide' | 'compact' | 'organic'
export type ModularCatalogPilotInputV1 = {
  catalogRoot: string
  assetRoot: string
  heroId: string
  supportIds: [string,string,string,string]
  rearId?: string
  accentId?: string
  frontId?: string
  recipe: ModularRecipeV1
  orientation: 'portrait' | 'landscape'
  color: IdeaColorIntentV4
  headline?: {connector:string;keyword:string;closing:string}
}
export type CuratedModularAssetV1 = {
  assetId: string
  code: string
  role: ModularCatalogRoleV1
  primaryWordEs: string
  sha256: string
  colorCapability: 'none' | 'alpha-mask'
}

const registry = registryJson as { id: string; revision: string; manifestSha256:string; assets: CuratedModularAssetV1[] }
if (registry.id !== MODULAR_CATALOG_PACK_ID_V1 || registry.revision !== MODULAR_CATALOG_REVISION_V1 ||
    !/^[a-f0-9]{64}$/.test(registry.manifestSha256) ||
    new Set(registry.assets.map(a => a.assetId)).size !== registry.assets.length)
  throw new Error('EDITORIAL_MODULAR_REGISTRY_INVALID')
export const MODULAR_CATALOG_MANIFEST_SHA256_V1 = registry.manifestSha256
export function getCuratedModularAssetV1(assetId: unknown): CuratedModularAssetV1 | undefined {
  return typeof assetId === 'string' ? registry.assets.find(a => a.assetId === assetId) : undefined
}
export function curatedModularAssetsV1(): readonly CuratedModularAssetV1[] { return registry.assets }

/** Resolve a readable editorial headline from the separately frozen Hero accent.
 * Supports and accent masks retain their exact requested HEX; only title ink darkens. */
export function resolveModularTitleAccentV1(primary: string): string {
  if (!/^#[0-9A-F]{6}$/.test(primary)) throw new Error('MODULAR_ACCENT_HEX_INVALID')
  const paper = [240,238,232]
  const luminance = (channels: number[]) => channels.map(value => {
    const normalized=value/255
    return normalized<=.04045?normalized/12.92:((normalized+.055)/1.055)**2.4
  }).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0)
  const backdrop=luminance(paper)
  const rgb=[1,3,5].map(index=>parseInt(primary.slice(index,index+2),16))
  for(let step=0;step<50 && (backdrop+.05)/(luminance(rgb)+.05)<6;step++)
    for(let index=0;index<3;index++) rgb[index]=Math.floor(rgb[index]*.95)
  return '#'+rgb.map(value=>value.toString(16).toUpperCase().padStart(2,'0')).join('')
}
