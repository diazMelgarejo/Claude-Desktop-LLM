/**
 * LM Studio API Provider
 * Connects to local LM Studio instance using OpenAI-compatible API
 */

import { getProviderConfig } from '../config/settings.js';

export interface LMStudioModel {
  id: string;
  object: string;
  owned_by: string;
}

export interface LMStudioMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LMStudioChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: LMStudioMessage;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LMStudioCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    text: string;
    finish_reason: string;
  }[];
}

export class LMStudioProvider {
  private config = getProviderConfig('lmstudio');

  /**
   * List all available models in LM Studio
   */
  async listModels(): Promise<LMStudioModel[]> {
    const response = await fetch(`${this.config.baseUrl}/v1/models`, {
      method: 'GET',
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { data: LMStudioModel[] };
    return data.data || [];
  }

  /**
   * Generate a completion from a prompt
   */
  async generate(prompt: string, model?: string): Promise<string> {
    const selectedModel = model || this.config.defaultModel;

    const response = await fetch(`${this.config.baseUrl}/v1/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        prompt: prompt,
        max_tokens: 2048,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as LMStudioCompletionResponse;
    return data.choices[0]?.text || '';
  }

  /**
   * Chat completion with message history
   */
  async chat(messages: LMStudioMessage[], model?: string): Promise<string> {
    const selectedModel = model || this.config.defaultModel;

    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        messages: messages,
        max_tokens: 2048,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as LMStudioChatResponse;
    return data.choices[0]?.message.content || '';
  }

  /**
   * Check if LM Studio is running and accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get provider name
   */
  getName(): string {
    return this.config.name;
  }
}
