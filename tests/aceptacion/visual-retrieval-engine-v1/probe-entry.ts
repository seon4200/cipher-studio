// A deliberately narrow test-only entrypoint. Bundling these pure modules avoids importing
// src/main/index.ts, which starts the Electron application and unrelated IPC integrations.
export * from '../../../src/shared/asset-intent'
export * from '../../../src/shared/visual-concepts'
export * from '../../../src/shared/concept-lexicon'
export * from '../../../src/main/assets/pixabay-images'
export * from '../../../src/main/services/project-persistence'
