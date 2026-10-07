import type { ProjectAssetRecord } from '../../shared/project-state'
import { createIdeaAssemblyLayoutV1, createIdeaAssemblyLayoutV2, EDITORIAL_IDEA_ASSEMBLY_V1, EDITORIAL_IDEA_ASSEMBLY_V2,
  EDITORIAL_IDEA_ASSEMBLY_V3, EDITORIAL_IDEA_ASSEMBLY_V4, resolveIdeaColorV4,
  type IdeaColorIntentV4, type IdeaColorCapability, type IdeaAssemblyConnector, type IdeaResourceId, type IdeaAssemblyResource } from '../../shared/editorial-idea-assembly-v1'
import { createRoleMotionV2, validateVisualSceneSpecV2, validateRenderBindingsV2,
  type PresentSceneSlotV2, type VisualSceneSpecV2, type RenderBindingsV2 } from '../../shared/visual-scene-spec-v2'
import { fullSubjectBounds } from '../../shared/visual-scene-spec'
import type { MotionGraphicsCompiledV2 } from './motion-graphics-resolver'

type PilotAsset = { asset: ProjectAssetRecord; colorCapability?: IdeaColorCapability }
type PilotAssets = {
  hero: PilotAsset
  supports: readonly [PilotAsset, PilotAsset, PilotAsset, PilotAsset]
  resources: Record<Exclude<IdeaResourceId, 'idea-accent-secondary'>, PilotAsset> &
    Partial<Record<'idea-accent-secondary', PilotAsset>>
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
  const geometry: Record<Exclude<IdeaResourceId, 'idea-accent-secondary'>, Omit<IdeaAssemblyResource, 'id' | 'sha256' | 'mime' | 'alphaMode'>> = {
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
  const resources = (Object.keys(geometry) as Exclude<IdeaResourceId, 'idea-accent-secondary'>[]).map(id => {
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
  const records = [...entries.map(v => v.asset), ...resources.map(r => input.assets.resources[r.id]!.asset)]
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
  const geometry: Record<Exclude<IdeaResourceId, 'idea-accent-secondary'>, Omit<IdeaAssemblyResource, 'id' | 'sha256' | 'mime' | 'alphaMode'>> = {
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
  const resources = (Object.keys(geometry) as Exclude<IdeaResourceId, 'idea-accent-secondary'>[]).map(id => {
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
  const records = [...entries.map(v => v.asset), ...resources.map(r => input.assets.resources[r.id]!.asset)]
  const renderBindings: RenderBindingsV2 = { version: 2,
    assets: records.map((asset, i) => ({ slotId: ids[i], assetId: asset.id, relativeFile: asset.relativeFile })) }
  validateRenderBindingsV2(renderBindings)
  return { sceneSpec, renderBindings,
    graphicData: { ...input.base.graphicData, extra: { ...input.base.graphicData.extra, sceneSpec } } }
}

/**
 * V3 intentionally reuses V2's approved static composition and authored assets.
 * The only new pixels are the persisted card-settle beats and the causal connector
 * hand-off: PERSONAS → Hero, DATOS → Hero, Hero → SOLUCIONES,
 * then SOLUCIONES → IMPACTO.
 */
export function compileEditorialIdeaAssemblyPilotV3(input: {
  base: MotionGraphicsCompiledV2
  assets: PilotAssets
  accentTheme?: 'orange' | 'teal' | 'crimson'
}): MotionGraphicsCompiledV2 {
  const v2 = compileEditorialIdeaAssemblyPilotV2(input)
  const assembly = v2.sceneSpec.ideaAssembly!
  const supports = assembly.supports.map((support, i) => ({
    ...support,
    // 80 frames at 24 fps. Each card is fully settled exactly three frames
    // before its own route begins; later cards can arrive while prior routes draw.
    enter: [.20, .25, .30, .35][i],
    settle: [.2875, .3375, .3875, .4375][i],
  }))
  const connectorSequence: IdeaAssemblyConnector[] = [
    {
      id: 'support-1', relation: 'support-to-hero', from: 'support-1', to: 'hero', start: .325, end: .3625,
      portrait: { path: 'M 22 38 C 27 38 29 45 35 51', tip: { x: 35, y: 51 } },
      landscape: { path: 'M 20 73 C 21 57 34 53 39 55 C 42 57 43 58 45 59', tip: { x: 45, y: 59 } },
    },
    {
      id: 'support-2', relation: 'support-to-hero', from: 'support-2', to: 'hero', start: .375, end: .4125,
      portrait: { path: 'M 78 38 C 73 38 71 45 65 51', tip: { x: 65, y: 51 } },
      landscape: { path: 'M 38 73 C 43 73 45 70 48 67', tip: { x: 48, y: 67 } },
    },
    {
      id: 'support-3', relation: 'hero-to-support', from: 'hero', to: 'support-3', start: .425, end: .4625,
      portrait: { path: 'M 35 68 C 31 70 28 73 24.4 73', tip: { x: 24.4, y: 73 } },
      landscape: { path: 'M 76 34 C 78 30 80 25 83.6 25', tip: { x: 83.6, y: 25 } },
    },
    {
      id: 'support-4', relation: 'support-to-support', from: 'support-3', to: 'support-4', start: .475, end: .5125,
      portrait: { path: 'M 24.4 78 C 39 88 61 88 75.6 78', tip: { x: 75.6, y: 78 } },
      landscape: { path: 'M 96.5 31 C 99 41 99 57 96.5 69', tip: { x: 96.5, y: 69 } },
    },
  ]
  const sceneSpec: VisualSceneSpecV2 = {
    ...v2.sceneSpec,
    presentationProfile: EDITORIAL_IDEA_ASSEMBLY_V3,
    ideaAssembly: {
      ...assembly,
      revision: EDITORIAL_IDEA_ASSEMBLY_V3.revision,
      supports,
      connectorSequence,
    },
  }
  validateVisualSceneSpecV2(sceneSpec)
  return {
    ...v2,
    sceneSpec,
    graphicData: { ...v2.graphicData, extra: { ...v2.graphicData.extra, sceneSpec } },
  }
}

/** V4 inherits V3's approved geometry and connector beats. Only an authorized
 * alpha layer or simple Support icon may receive an exact resolved HEX fill. */
export function compileEditorialIdeaAssemblyPilotV4(input: {
  base: MotionGraphicsCompiledV2
  assets: PilotAssets
  color: IdeaColorIntentV4
}): MotionGraphicsCompiledV2 {
  const { supportTint, heroPalette } = resolveIdeaColorV4(input.color)
  if (input.assets.hero.colorCapability !== 'none' ||
      input.assets.supports.some(item => item.colorCapability !== 'alpha-mask') ||
      Object.entries(input.assets.resources).some(([id, item]) =>
        item && item.colorCapability !== (id === 'idea-accent'
          ? heroPalette.mode === 'fixed-spectrum' ? 'fixed-spectrum' : 'accent-primary'
          : id === 'idea-accent-secondary' ? 'accent-secondary' : 'none')))
    throw new Error('IDEA_V4_ASSET_COLOR_CAPABILITY_INVALID')
  if (heroPalette.mode === 'dual-accent')
    throw new Error('IDEA_V4_SECONDARY_LAYER_REQUIRED')
  const v3 = compileEditorialIdeaAssemblyPilotV3({ base: input.base, assets: input.assets, accentTheme: 'orange' })
  const sceneSpec: VisualSceneSpecV2 = {
    ...v3.sceneSpec,
    presentationProfile: EDITORIAL_IDEA_ASSEMBLY_V4,
    slots: v3.sceneSpec.slots.map(slot => slot.state !== 'present' ? slot : slot.slotId === 'hero'
      ? { ...slot, colorCapability: 'none' as const }
      : { ...slot, colorCapability: 'alpha-mask' as const, tint: { treatment: 'accent-mask' as const } }),
    ideaAssembly: {
      ...v3.sceneSpec.ideaAssembly!, revision: EDITORIAL_IDEA_ASSEMBLY_V4.revision,
      supportTint, heroPalette,
      resources: v3.sceneSpec.ideaAssembly!.resources.map(resource => ({ ...resource,
        colorCapability: resource.id === 'idea-accent'
          ? (heroPalette.mode === 'fixed-spectrum' ? 'fixed-spectrum' as const : 'accent-primary' as const)
          : 'none' as const,
        accentTreatment: resource.id === 'idea-accent' && heroPalette.mode !== 'fixed-spectrum'
          ? 'alpha-mask' as const : 'none' as const,
      })),
    },
  }
  validateVisualSceneSpecV2(sceneSpec)
  return { ...v3, sceneSpec,
    graphicData: { ...v3.graphicData, extra: { ...v3.graphicData.extra, sceneSpec } } }
}
