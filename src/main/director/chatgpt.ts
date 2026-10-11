import type { Director, DirectorInput, DirectorMetadataObserver } from '../../shared/director';
import { BuildFailure } from '../build/media';
import { SiwcError, type SiwcRuntime } from '../siwc/runtime';

export function chatGPTDirector(runtime: SiwcRuntime, profileId: string, model: string): Director {
  return {
    id: 'chatgpt',
    async propose(input: DirectorInput, signal: AbortSignal, onMetadata?: DirectorMetadataObserver): Promise<unknown> {
      try { return await runtime.propose(profileId, model, input, signal, onMetadata); }
      catch (error: any) {
        if (error instanceof BuildFailure) throw error;
        if (error instanceof SiwcError) throw new BuildFailure(error.code, error.message, error.retryable);
        throw new BuildFailure('DIRECTOR_ERROR', 'No se pudo completar la dirección editorial.');
      }
    },
  };
}
