import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import type { IdeaColorIntentV4, IdeaColorCapability } from '../../shared/editorial-idea-assembly-v1'
import { EDITORIAL_EXPLAINER_V3 } from '../../shared/editorial-explainer-v3'
import { COLOR_PALETTE_REVISION_V1 } from '../../shared/color-palette-v1'
import { createLocalSceneSemanticV1 } from '../../shared/local-scene-semantic'
import { subjectBoundsFromPixabayRasterV1, publishRasterProjectAssetV1 } from './pixabay-images'
import { createModernVisualGenerationContextV2, resolveModernVisualGenerationBatchV2 } from './modern-visual-generation'
import { compileEditorialIdeaAssemblyPilotV4 } from './editorial-idea-assembly-pilot'
import type { VisualRuntimeQcReport } from './visual-qc'

const NAMES = ['bust', 'bulb', 'collage-rear', 'accent-paper', 'collage-front-neutral',
  'personas-v2', 'datos', 'soluciones', 'impacto', 'paper-background'] as const

/** Pilot authorization, not a general catalog. Future assets require catalog metadata
 * and their own revision, not another name added to this frozen V4 allowlist. */
const PILOT_SHA: Record<typeof NAMES[number], string> = {
  bust: 'dba8071c44ec3cbe66e98f8c8210837ea03118503c072302667e504b58680413',
  bulb: 'f1a43727f6af21767d46adae9d05363e3ab0ec94ea2f4dc19d1a2071895f7ad8',
  'collage-rear': 'b445b0fa64e0e983887d30449719d6b3a5eba6963a41896bdf03c6c7512af438',
  'accent-paper': 'd151c1b8c0c5e57a080dd831ba430fa4aef9f857951895e3cfaea449d47ec25d',
  'collage-front-neutral': '0e0d7a7760041bba0046e4e03df76a9a5e9fcf563d8e9770aa30171f3af7c91f',
  'personas-v2': 'c08045a69c674111850fde5002e51abbf44cae25bdc36b43c400639900fc6ca2',
  datos: '30d12fccc09efa73b72922bf0c4deadb0daf7b6c57e4ff546726bdf0d127db13',
  soluciones: 'dd672b9f82bbf418b4d499c240ea942bbb4da48daaff36c6d97ecef306b4d227',
  impacto: 'da8a6b755facffc73df096b42b73b03e30471bc21318fe10542169fdd7636152',
  'paper-background': '88fa8ac9ce3faaa9d9998f6008a1ae375ee6819a8a2d987e878671cec8907b19',
}

export async function generateIdeaColorPilotV4(input: {
  projectRoot: string
  assetRoot: string
  color: IdeaColorIntentV4
  orientation: 'portrait' | 'landscape'
  render: (graphicData: any, options: any) => Promise<string | null>
}) {
  if (!path.isAbsolute(input.assetRoot) || !fs.statSync(input.assetRoot).isDirectory())
    throw new Error('IDEA_V4_ASSET_DIRECTORY_INVALID')
  const published = Object.fromEntries(NAMES.map(name => {
    const bytes = fs.readFileSync(path.join(input.assetRoot, `${name}.png`))
    if (createHash('sha256').update(bytes).digest('hex') !== PILOT_SHA[name])
      throw new Error(`IDEA_V4_PILOT_ASSET_SHA_MISMATCH:${name}`)
    const record = publishRasterProjectAssetV1({ projectRoot: input.projectRoot,
      provider: 'editorial-pilot-raster', assetId: `idea-v4-${name}`, bytes,
      requireUsefulAlpha: name !== 'paper-background',
      source: { providerVersion: 'chatgpt-imagegen-2026-09',
        attribution: 'IDEA assembly ChatGPT-generated pilot asset; reused unchanged in V4' },
      validationRevision: 'editorial-idea-pilot-raster-v4' })
    const colorCapability: IdeaColorCapability = name === 'accent-paper' ? 'accent-primary'
      : ['personas-v2', 'datos', 'soluciones', 'impacto'].includes(name) ? 'alpha-mask' : 'none'
    return [name, { asset: record.asset, bytes, colorCapability }]
  })) as Record<typeof NAMES[number], { asset: ReturnType<typeof publishRasterProjectAssetV1>['asset']; bytes: Buffer; colorCapability: IdeaColorCapability }>
  const duration = 80 / 24
  const sceneId = 'idea-assembly-v4-pilot'
  const localSemantic = createLocalSceneSemanticV1({ sceneId, start: 0, end: duration,
    transcriptSegments: [{ start: 0, end: duration, text: 'Una idea abre nuevas posibilidades' }],
    concepts: [{ label: 'idea', canonicalHint: 'idea', start: 0, end: duration, scope: 'scene' }],
    anchor: 'idea', globalText: 'Una idea abre nuevas posibilidades', globalHints: [],
    globalContextRef: 'synthetic:editorial-idea-assembly-v4' })
  const hero = published.bust
  const context = createModernVisualGenerationContextV2({ sceneId, duration, localSemantic,
    keywordCandidates: [{ keyword: 'IDEA', source: 'scene-semantic' }],
    preferredVisualMode: 'asset-led', sistema: 'editorial',
    direction: { fondo: 'ondas', estructura: 'marcoPoster', camara: 'quieto', densidad: 'alta',
      ritmo: 'simultaneo', semilla: 91551 }, videoStyleId: 'cream-editorial',
    presentationProfile: EDITORIAL_EXPLAINER_V3,
    lockedChoices: [{ slotId: 'hero', concept: 'idea', provider: 'editorial-pilot-raster',
      representation: 'photo-cutout', reason: 'EXPLICIT_IDEA_PILOT_CHATGPT_GENERATED', score: 3,
      assetId: hero.asset.id, relativeFile: hero.asset.relativeFile, sha256: hero.asset.sha256,
      mime: hero.asset.mime, bounds: subjectBoundsFromPixabayRasterV1(hero.bytes),
      kind: 'photo-cutout', alphaMode: 'useful-alpha' }],
    colorPalettePlan: { version: 1, primaryFamily: 'blue-tech', compatibleFamilies: [],
      revision: COLOR_PALETTE_REVISION_V1 },
  })
  const batch = await resolveModernVisualGenerationBatchV2({ contexts: [context], projectRoot: input.projectRoot })
  const assets = { hero, supports: [published['personas-v2'], published.datos, published.soluciones, published.impacto] as const,
    resources: { 'idea-background': published['paper-background'], 'idea-rear': published['collage-rear'],
      'idea-accent': published['accent-paper'], 'idea-bulb': published.bulb,
      'idea-front': published['collage-front-neutral'] } }
  const compiled = compileEditorialIdeaAssemblyPilotV4({ base: batch[0].resolved.compiled, assets, color: input.color })
  let qc: VisualRuntimeQcReport | undefined
  const width = input.orientation === 'portrait' ? 720 : 1280
  const height = input.orientation === 'portrait' ? 1280 : 720
  const file = await input.render(compiled.graphicData, { ancho: width, alto: height,
    fps: 24, duracion: duration, modo: 'pantalla', sistema: 'editorial',
    projectRoot: input.projectRoot, renderBindings: compiled.renderBindings,
    onQcReport: (report: VisualRuntimeQcReport) => { qc = report },
    onQcFailure: (report: VisualRuntimeQcReport) => { qc = report } })
  if (!file || !fs.existsSync(file)) throw new Error(`IDEA_V4_VISUAL_SIN_FICHERO:${JSON.stringify(qc?.findings)}`)
  return { file, sceneSpec: compiled.sceneSpec, graphicData: compiled.graphicData,
    renderBindings: compiled.renderBindings,
    qc, width, height, frames: 80, fps: 24, duration }
}
