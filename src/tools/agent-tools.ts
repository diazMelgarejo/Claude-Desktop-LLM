/**
 * MCP Tools for interacting with local LLMs as external agents
 */

import { OllamaProvider } from '../providers/ollama.js';
import { LMStudioProvider } from '../providers/lmstudio.js';
import { defaultSettings } from '../config/settings.js';

// Provider instances
const ollamaProvider = new OllamaProvider();
const lmstudioProvider = new LMStudioProvider();

// Current active provider
let activeProvider: 'ollama' | 'lmstudio' = defaultSettings.activeProvider;

/**
 * Get the currently active provider instance
 */
function getActiveProvider() {
  return activeProvider === 'ollama' ? ollamaProvider : lmstudioProvider;
}

/**
 * Query the local LLM with a simple prompt
 */
export async function queryLocalLLM(
  prompt: string,
  model?: string,
  provider?: 'ollama' | 'lmstudio'
): Promise<string> {
  const selectedProvider = provider
    ? (provider === 'ollama' ? ollamaProvider : lmstudioProvider)
    : getActiveProvider();

  return await selectedProvider.generate(prompt, model);
}

/**
 * Send a task to the local LLM agent with system context
 */
export async function delegateToAgent(
  task: string,
  systemPrompt?: string,
  model?: string,
  provider?: 'ollama' | 'lmstudio'
): Promise<string> {
  const selectedProvider = provider
    ? (provider === 'ollama' ? ollamaProvider : lmstudioProvider)
    : getActiveProvider();

  const messages = [
    {
      role: 'system' as const,
      content: systemPrompt || 'You are a helpful AI assistant. Complete the given task thoroughly and provide a detailed response.',
    },
    {
      role: 'user' as const,
      content: task,
    },
  ];

  return await selectedProvider.chat(messages, model);
}

/**
 * Chat with the local LLM using message history
 */
export async function chatWithLLM(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model?: string,
  provider?: 'ollama' | 'lmstudio'
): Promise<string> {
  const selectedProvider = provider
    ? (provider === 'ollama' ? ollamaProvider : lmstudioProvider)
    : getActiveProvider();

  return await selectedProvider.chat(messages, model);
}

/**
 * List available models from the specified or active provider
 */
export async function listModels(provider?: 'ollama' | 'lmstudio'): Promise<string[]> {
  if (provider === 'ollama' || (!provider && activeProvider === 'ollama')) {
    const models = await ollamaProvider.listModels();
    return models.map(m => m.name);
  } else {
    const models = await lmstudioProvider.listModels();
    return models.map(m => m.id);
  }
}

/**
 * Switch the active provider
 */
export function switchProvider(provider: 'ollama' | 'lmstudio'): string {
  activeProvider = provider;
  return `Switched to ${provider === 'ollama' ? 'Ollama' : 'LM Studio'}`;
}

/**
 * Get the current active provider name
 */
export function getActiveProviderName(): string {
  return activeProvider === 'ollama' ? 'Ollama' : 'LM Studio';
}

/**
 * Check health status of providers
 */
export async function checkProvidersHealth(): Promise<{
  ollama: boolean;
  lmstudio: boolean;
  active: string;
}> {
  const [ollamaHealth, lmstudioHealth] = await Promise.all([
    ollamaProvider.healthCheck(),
    lmstudioProvider.healthCheck(),
  ]);

  return {
    ollama: ollamaHealth,
    lmstudio: lmstudioHealth,
    active: activeProvider,
  };
}
