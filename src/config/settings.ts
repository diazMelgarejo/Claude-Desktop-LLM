/**
 * Configuration settings for LLM providers
 */

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  defaultModel: string;
  timeout: number;
}

export interface Settings {
  ollama: ProviderConfig;
  lmstudio: ProviderConfig;
  activeProvider: 'ollama' | 'lmstudio';
}

export const defaultSettings: Settings = {
  ollama: {
    name: 'Ollama',
    baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    defaultModel: process.env.OLLAMA_MODEL || 'llama3.2',
    timeout: 120000, // 2 minutes
  },
  lmstudio: {
    name: 'LM Studio',
    baseUrl: process.env.LMSTUDIO_URL || 'http://localhost:1234',
    defaultModel: process.env.LMSTUDIO_MODEL || 'default',
    timeout: 120000,
  },
  activeProvider: (process.env.DEFAULT_PROVIDER as 'ollama' | 'lmstudio') || 'ollama',
};

export function getProviderConfig(provider: 'ollama' | 'lmstudio'): ProviderConfig {
  return defaultSettings[provider];
}
