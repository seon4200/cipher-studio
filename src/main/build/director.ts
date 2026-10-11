import type { BuildInput, BuildScene } from '../../shared/build-plan';
import { BUILD_FPS } from '../../shared/build-plan';
import type { Director, DirectorInput, DirectorMetadataObserver } from '../../shared/director';
import { deepseekDirector } from '../director/deepseek';
import { validateDirectorProposal } from '../director/validate';

export function createSceneDirector(director: Director) {
  return async (scenes: readonly BuildScene[], input: BuildInput, signal: AbortSignal,
    onMetadata?: DirectorMetadataObserver) => {
    signal.throwIfAborted();
    // Snapshot just the editorial data; adapters cannot mutate the live plan.
    const request: DirectorInput = Object.freeze({
      schemaVersion: 1,
      scriptText: input.scriptText,
      fps: BUILD_FPS,
      scenes: Object.freeze(scenes.map(scene => Object.freeze({
        id: scene.id, phraseIndex: scene.phraseIndex, text: scene.text,
        category: scene.category, startFrame: scene.startFrame, frames: scene.frames,
      }))),
    });
    const proposal = await director.propose(request, signal, onMetadata);
    signal.throwIfAborted();
    return validateDirectorProposal(request, proposal);
  };
}

// Keep 1B's provider until the separately accepted OpenAI adapter is configured.
export const directScenes = createSceneDirector(deepseekDirector);
