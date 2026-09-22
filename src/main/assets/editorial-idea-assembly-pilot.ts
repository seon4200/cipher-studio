import type { ProjectAssetRecord } from '../../shared/project-state'
import { createIdeaAssemblyLayoutV1, createIdeaAssemblyLayoutV2, EDITORIAL_IDEA_ASSEMBLY_V1, EDITORIAL_IDEA_ASSEMBLY_V2,
  type IdeaResourceId, type IdeaAssemblyResource } from '../../shared/editorial-idea-assembly-v1'
import { createRoleMotionV2, validateVisualSceneSpecV2, validateRenderBindingsV2,
  type PresentSceneSlotV2, type VisualSceneSpecV2, type RenderBindingsV2 } from '../../shared/visual-scene-spec-v2'
import { fullSubjectBounds } from '../../shared/visual-scene-spec'
import type { MotionGraphicsCompiledV2 } from './motion-graphics-resolver'

type PilotAsset = { asset: ProjectAssetRecord }
type PilotAssets = {
  hero: PilotAsset
  supports: readonly [PilotAsset, PilotAsset, PilotAsset, PilotAsset]
  resources: Record<IdeaResourceId, PilotAsset>
}

/** Scoped authoring adapter: starts from the productive semantic resolver's compiled Hero.
 * The four user-requested, independently materialized labels are explicit art direction,
 * not a claim that the legacy automatic retrieval can select four Supports. */
export function compileEditorialIdeaAssemblyPilotV1(input: {
  base: MotionGraphicsCompiledV2
  assets: PilotAssets
  accentTheme?: 'orange' | 'teal' | 'crimson'
}): MotionGraphicsCompiledV2 {
  const baseHero = input.base.sceneSpec.slots.find((slot): slot is PresentSceneSlotV2 =>
    slot.slotId === 'hero' && slot.state === 'present')
  if (!baseHero || baseHero.sha256 !== input.assets.hero.asset.sha256)
    throw new Error('IDEA_BASE_HERO_MISMATCH')
  const supportNames = ['PERSONAS', 'DATOS', 'SOLUCIONES', 'IMPACTO'] as const
  const slots: PresentSceneSlotV2[] = [baseHero, ...input.assets.supports.map((item, i): PresentSceneSlotV2 => {
    const slotId = `support-${i + 1}` as PresentSceneSlotV2['slotId']
    if (item.asset.mime !== 'image/png' || !item.asset.validation.alphaUseful)
      throw new Error(`IDEA_SUPPORT_RASTER_INVALID:${slotId}`)
    return { slotId, role: slotId, state: 'present', sha256: item.asset.sha256,
      mime: 'image/png', kind: 'simple-icon', alphaMode: 'useful-alpha',
      bounds: fullSubjectBounds(), fitPolicy: 'contain', tint: { treatment: 'original-color' },
      motion: createRoleMotionV2({ role: slotId, energy: 'medium' }) }
  })]
  const geometry: Record<IdeaResourceId, Omit<IdeaAssemblyResource, 'id' | 'sha256' | 'mime' | 'alphaMode'>> = {
    'idea-background': { rect: { x: 0, y: 0, width: 100, height: 100 }, zIndex: 0,
      timing: { start: 0, settle: 0, exit: .99 }, from: { x: 0, y: 0, scale: 1 }, accentTreatment: 'none' },
    'idea-rear': { rect: { x: -10, y: 4, width: 120, height: 90 }, zIndex: 1,
      timing: { start: .09, settle: .28, exit: .91 }, from: { x: -10, y: 7, scale: .83 }, accentTreatment: 'none' },
    'idea-accent': { rect: { x: 3, y: 11, width: 94, height: 84 }, zIndex: 2,
      timing: { start: .14, settle: .33, exit: .91 }, from: { x: 13, y: 9, scale: .78 }, accentTreatment: 'hue-shift' },
    'idea-bulb': { rect: { x: 25, y: 1, width: 50, height: 54 }, zIndex: 2,
      timing: { start: .17, settle: .34, exit: .90 }, from: { x: 0, y: -80, scale: .82 }, accentTreatment: 'none' },
    'idea-front': { rect: { x: -5, y: 58, width: 110, height: 45 }, zIndex: 5,
      timing: { start: .23, settle: .39, exit: .90 }, from: { x: 5, y: 30, scale: .90 }, accentTreatment: 'none' },
  }
  const resources = (Object.keys(geometry) as IdeaResourceId[]).map(id => {
    const asset = input.assets.resources[id].asset
    if (asset.mime !== 'image/png' || (id !== 'idea-background' && !asset.validation.alphaUseful) ||
        (id === 'idea-background' && asset.validation.hasAlpha)) throw new Error(`IDEA_RESOURCE_RASTER_INVALID:${id}`)
    return { id, sha256: asset.sha256, mime: 'image/png' as const,
      alphaMode: id === 'idea-background' ? 'opaque-rectangle' as const : 'useful-alpha' as const,
      ...geometry[id] }
  })
  const { lightStyle: _oldLight, premiumStyle: _oldPremium, compositionV2: _oldComposition,
    ideaAssembly: _oldIdea, ...base } = input.base.sceneSpec
  const sceneSpec: VisualSceneSpecV2 = {
    ...base, presentationProfile: EDITORIAL_IDEA_ASSEMBLY_V1,
    direccion: { ...base.direccion, estructura: 'marcoPoster' },
    editorialMotionCue: 'protagonist',
    layout: createIdeaAssemblyLayoutV1('portrait'),
    text: { connector: 'UNA', keyword: 'IDEA', closing: 'abre nuevas posibilidades',
      alignment: 'left', maxLines: 2, typographyLookId: base.text.typographyLookId,
      timing: { connectorStart: 0, keywordStart: 0, closingStart: .04 },
      motion: { secondaryPreset: 'fade-slide', keywordPreset: 'slide-reveal', emphasisStart: .14 } },
    slots,
    ideaAssembly: { revision: EDITORIAL_IDEA_ASSEMBLY_V1.revision,
      accentTheme: input.accentTheme ?? 'orange', heroStartScale: .82,
      heroAnchor: { x: 50, y: 55 }, resources,
      supports: supportNames.map((label, i) => ({ slotId: `support-${i + 1}` as `support-${1 | 2 | 3 | 4}`,
        label, enter: .27 + i * .055 })),
      landscapeLayout: createIdeaAssemblyLayoutV1('landscape') },
  }
  validateVisualSceneSpecV2(sceneSpec)
  const entries = [input.assets.hero, ...input.assets.supports]
  const ids = ['hero', 'support-1', 'support-2', 'support-3', 'support-4', ...resources.map(r => r.id)] as const
  const records = [...entries.map(v => v.asset), ...resources.map(r => input.assets.resources[r.id].asset)]
  const renderBindings: RenderBindingsV2 = { version: 2,
    assets: records.map((asset, i) => ({ slotId: ids[i], assetId: asset.id, relativeFile: asset.relativeFile })) }
  validateRenderBindingsV2(renderBindings)
  return { sceneSpec, renderBindings,
    graphicData: { ...input.base.graphicData, extra: { ...input.base.graphicData.extra, sceneSpec } } }
}

/**
 * Contained V2 finish for the same authored IDEA scene.  V1 above is deliberately
 * left byte-for-byte stable: the new profile revision owns its changed geometry,
 * timing and title dispatch through the persisted SceneSpec.
 */
export function compileEditorialIdeaAssemblyPilotV2(input: {
  base: MotionGraphicsCompiledV2
  assets: PilotAssets
  accentTheme?: 'orange' | 'teal' | 'crimson'
}): MotionGraphicsCompiledV2 {
  const baseHero = input.base.sceneSpec.slots.find((slot): slot is PresentSceneSlotV2 =>
    slot.slotId === 'hero' && slot.state === 'present')
  if (!baseHero || baseHero.sha256 !== input.assets.hero.asset.sha256)
    throw new Error('IDEA_BASE_HERO_MISMATCH')
  const supportNames = ['PERSONAS', 'DATOS', 'SOLUCIONES', 'IMPACTO'] as const
  const slots: PresentSceneSlotV2[] = [baseHero, ...input.assets.supports.map((item, i): PresentSceneSlotV2 => {
    const slotId = `support-${i + 1}` as PresentSceneSlotV2['slotId']
    if (item.asset.mime !== 'image/png' || !item.asset.validation.alphaUseful)
      throw new Error(`IDEA_SUPPORT_RASTER_INVALID:${slotId}`)
    return { slotId, role: slotId, state: 'present', sha256: item.asset.sha256,
      mime: 'image/png', kind: 'simple-icon', alphaMode: 'useful-alpha',
      bounds: fullSubjectBounds(), fitPolicy: 'contain', tint: { treatment: 'original-color' },
      motion: createRoleMotionV2({ role: slotId, energy: 'medium' }) }
  })]
  const geometry: Record<IdeaResourceId, Omit<IdeaAssemblyResource, 'id' | 'sha256' | 'mime' | 'alphaMode'>> = {
    'idea-background': { rect: { x: 0, y: 0, width: 100, height: 100 }, zIndex: 0,
      timing: { start: 0, settle: 0, exit: .99 }, from: { x: 0, y: 0, scale: 1 }, accentTreatment: 'none' },
    'idea-rear': { rect: { x: -9, y: 6, width: 118, height: 88 }, zIndex: 1,
      timing: { start: .08, settle: .29, exit: .91 }, from: { x: -9, y: 6, scale: .86 }, accentTreatment: 'none' },
    'idea-accent': { rect: { x: 4, y: 14, width: 92, height: 80 }, zIndex: 2,
      timing: { start: .13, settle: .36, exit: .91 }, from: { x: 12, y: 8, scale: .80 }, accentTreatment: 'hue-shift' },
    // Behind the stone rim, but taller and higher: the glass remains visibly inserted rather than sunk.
    'idea-bulb': { rect: { x: 22, y: -5, width: 56, height: 61 }, zIndex: 2,
      timing: { start: .16, settle: .36, exit: .90 }, from: { x: 0, y: -80, scale: .82 }, accentTreatment: 'none' },
    // V1's large foreground paper covered the chest. Keep its neutral material but expose the bust.
    'idea-front': { rect: { x: 4, y: 69, width: 92, height: 31 }, zIndex: 5,
      timing: { start: .25, settle: .42, exit: .90 }, from: { x: 4, y: 22, scale: .93 }, accentTreatment: 'none' },
  }
  const resources = (Object.keys(geometry) as IdeaResourceId[]).map(id => {
    const asset = input.assets.resources[id].asset
    if (asset.mime !== 'image/png' || (id !== 'idea-background' && !asset.validation.alphaUseful) ||
        (id === 'idea-background' && asset.validation.hasAlpha)) throw new Error(`IDEA_RESOURCE_RASTER_INVALID:${id}`)
    return { id, sha256: asset.sha256, mime: 'image/png' as const,
      alphaMode: id === 'idea-background' ? 'opaque-rectangle' as const : 'useful-alpha' as const,
      ...geometry[id] }
  })
  const { lightStyle: _oldLight, premiumStyle: _oldPremium, compositionV2: _oldComposition,
    ideaAssembly: _oldIdea, ...base } = input.base.sceneSpec
  const sceneSpec: VisualSceneSpecV2 = {
    ...base, presentationProfile: EDITORIAL_IDEA_ASSEMBLY_V2,
    direccion: { ...base.direccion, estructura: 'marcoPoster' }, editorialMotionCue: 'protagonist',
    layout: createIdeaAssemblyLayoutV2('portrait'),
    text: { connector: 'UNA', keyword: 'IDEA', closing: 'abre nuevas posibilidades',
      alignment: 'left', maxLines: 2, typographyLookId: base.text.typographyLookId,
      timing: { connectorStart: 0, keywordStart: 0, closingStart: .04 },
      motion: { secondaryPreset: 'fade-slide', keywordPreset: 'slide-reveal', emphasisStart: .14 } },
    slots,
    ideaAssembly: { revision: EDITORIAL_IDEA_ASSEMBLY_V2.revision,
      accentTheme: input.accentTheme ?? 'orange', heroStartScale: .84,
      heroAnchor: { x: 50, y: 55 }, resources,
      // The final Support reaches 0.48 = 1.60 s at 24 fps; connectors finish at 0.495.
      supports: supportNames.map((label, i) => ({ slotId: `support-${i + 1}` as `support-${1 | 2 | 3 | 4}`,
        label, enter: .27 + i * .03 })),
      landscapeLayout: createIdeaAssemblyLayoutV2('landscape') },
  }
  validateVisualSceneSpecV2(sceneSpec)
  const entries = [input.assets.hero, ...input.assets.supports]
  const ids = ['hero', 'support-1', 'support-2', 'support-3', 'support-4', ...resources.map(r => r.id)] as const
  const records = [...entries.map(v => v.asset), ...resources.map(r => input.assets.resources[r.id].asset)]
  const renderBindings: RenderBindingsV2 = { version: 2,
    assets: records.map((asset, i) => ({ slotId: ids[i], assetId: asset.id, relativeFile: asset.relativeFile })) }
  validateRenderBindingsV2(renderBindings)
  return { sceneSpec, renderBindings,
    graphicData: { ...input.base.graphicData, extra: { ...input.base.graphicData.extra, sceneSpec } } }
}
