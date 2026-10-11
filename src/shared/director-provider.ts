export type DirectorProviderId = 'chatgpt' | 'deepseek' | 'anthropic' | 'gemini';

export const DIRECTOR_PROVIDERS: readonly { id: DirectorProviderId; label: string; status: 'available' | 'planned' }[] = [
  { id: 'chatgpt', label: 'ChatGPT', status: 'available' },
  { id: 'deepseek', label: 'DeepSeek', status: 'available' },
  { id: 'anthropic', label: 'Claude · próximamente', status: 'planned' },
  { id: 'gemini', label: 'Gemini · próximamente', status: 'planned' },
];

export const DEFAULT_DIRECTOR_PROVIDER: DirectorProviderId = 'deepseek';
export const DEFAULT_DIRECTOR_MODEL = 'deepseek-chat';

export function normalizeDirectorPreference(provider: unknown, model: unknown) {
  const validProvider = DIRECTOR_PROVIDERS.some(item => item.id === provider && item.status === 'available');
  if (!validProvider) return { providerId: DEFAULT_DIRECTOR_PROVIDER, modelId: DEFAULT_DIRECTOR_MODEL };
  if (provider === 'deepseek') return { providerId: 'deepseek' as const,
    modelId: typeof model === 'string' && model ? model : DEFAULT_DIRECTOR_MODEL };
  return { providerId: 'chatgpt' as const, modelId: typeof model === 'string' ? model : '' };
}

export interface DirectorAccountProfile { id: string; email: string; connected: boolean; planUsageEnabled: boolean; expiresAt: number | null }
export interface DirectorInferenceRecord {
  provider: 'chatgpt'; model: string; completedAt: string; durationMs: number;
  status?: 'completed' | 'failed' | 'cancelled';
  actualModelId?: string;
  providerRequestId?: string;
  providerResponseId?: string;
  errorCode?: string;
  inputTokens?: number; outputTokens?: number; totalTokens?: number;
}
export interface DirectorAuthState { activeProfileId: string | null; profiles: DirectorAccountProfile[]; lastInference: DirectorInferenceRecord | null }
export interface DirectorModelOption { slug: string; displayName: string }
