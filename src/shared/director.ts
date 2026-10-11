import type { SourceKind } from './build-plan';

// Provider-independent editorial boundary. Cipher owns IDs, timing and category.
// Only text and scene metadata cross this boundary, never local paths or secrets.
export interface DirectorScene {
  readonly id: string;
  readonly phraseIndex: number;
  readonly text: string;
  readonly category: SourceKind;
  readonly startFrame: number;
  readonly frames: number;
}

export interface DirectorInput {
  readonly schemaVersion: 1;
  readonly scriptText: string;
  readonly fps: number;
  readonly scenes: readonly DirectorScene[];
}

export interface DirectorDecision {
  readonly id: string;
  /** Editorial meaning of the scene, separate from provider search terms. */
  readonly visualIntent: string;
  /** One or two short English alternatives that preserve the scene's meaning. */
  readonly searchQueries: readonly string[];
  /** First search query, retained for saved-plan and adapter compatibility. */
  readonly keyword: string;
  // A suggestion; the media runner checks it against the actual source duration.
  readonly sourceStart: number;
}

export interface DirectorProposal {
  readonly scenes: readonly DirectorDecision[];
}

/** Safe provider response identifiers; never includes prompts, paths or credentials. */
export interface DirectorResponseMetadata {
  readonly actualModelId?: string;
  readonly providerRequestId?: string;
  readonly providerResponseId?: string;
}

export type DirectorMetadataObserver = (metadata: DirectorResponseMetadata) => void;

export interface Director {
  readonly id: string;
  // External output is untrusted until Cipher validates the whole proposal.
  propose(input: DirectorInput, signal: AbortSignal, onMetadata?: DirectorMetadataObserver): Promise<unknown>;
}
