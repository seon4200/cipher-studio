declare module '*.cjs' {
  export const ANIMATION_CONFIG_SCHEMA_V1: string
  export const ANIMATION_SCENE_PLAN_SCHEMA_V1: string
  export const ANIMATION_RECIPES_V1: Record<string, any>
  export const ANIMATION_COMPONENTS_V1: Array<any>
  export const ANIMATION_PALETTES_V1: Record<string, any>
  export const ANIMATION_FONTS_V1: Record<string, string>
  export const validateAnimationConfigV1: (...args: any[]) => any
  export const compileAnimationPlanV1: (...args: any[]) => any
  export const animationStateAt: (...args: any[]) => any
  export const resolveTimelineDuration: (...args: any[]) => any
  export const validateParameterSchema: (...args: any[]) => any
  export const findForbiddenCapability: (...args: any[]) => any
  export const validateSceneModule: (...args: any[]) => any
  export const scenePlan: (...args: any[]) => any
  export class CodexAppServerProvider { constructor(options?: any); complete(options: any): Promise<any> }
  export const codexConnectionStatus: (...args: any[]) => Promise<any>
  export const normalizeProjectAspectRatioV1: (value: unknown) => 'vertical' | 'square' | 'horizontal'
  export const isVerticalAspectRatioV1: (value: unknown) => boolean
  export const isSquareAspectRatioV1: (value: unknown) => boolean
}
