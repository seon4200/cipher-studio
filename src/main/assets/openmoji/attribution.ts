export type OpenMojiCatalogInfo = {
  provider: 'openmoji'
  catalogVersion: '17.0.0'
  license: 'CC-BY-SA-4.0'
  attributionRequired: true
  attributionText: string
  attributionPage: string
  sourceRepository: string
  attributionRevision: 'openmoji-catalog-v1'
  sourceKind: 'official-npm'
}

// Single authority for every OpenMoji attribution exposed by Cipher. The text is
// Cipher's recommended attribution, not a claim that it is an upstream UI string.
const CATALOG_INFO: OpenMojiCatalogInfo = Object.freeze({
  provider: 'openmoji',
  catalogVersion: '17.0.0',
  license: 'CC-BY-SA-4.0',
  attributionRequired: true,
  attributionText: 'OpenMoji 17.0.0 — CC BY-SA 4.0 — https://openmoji.org/',
  attributionPage: 'https://openmoji.org/',
  sourceRepository: 'https://github.com/hfg-gmuend/openmoji',
  attributionRevision: 'openmoji-catalog-v1',
  sourceKind: 'official-npm',
})

export function getOpenMojiCatalogInfo(): OpenMojiCatalogInfo {
  // Do not give callers the frozen authority object itself: future consumers must
  // not be able to mutate catalog attribution for other callers.
  return { ...CATALOG_INFO }
}

export const OPENMOJI_CATALOG_VERSION = CATALOG_INFO.catalogVersion
