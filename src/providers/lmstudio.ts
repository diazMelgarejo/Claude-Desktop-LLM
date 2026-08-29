import { guardedFetch } from "../policy/endpoint-policy.js";
import type { ChatMessage, ModelInfo, ProviderClient, ProviderConfig, ProviderDeps } from "./provider.js";
import { timed } from "./provider.js";

async function fetchJson(
  url: string,
  init: RequestInit,
  deps: ProviderDeps,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await guardedFetch(url, { ...init, signal: controller.signal }, deps.endpointPolicy);
    return { ok: response.ok, status: response.status, statusText: response.statusText, json: () => response.json() };
  } finally {
    clearTimeout(timer);
  }
}

function assertOk(res: { ok: boolean; status: number; statusText: string }, label: string): void {
  if (!res.ok) {
    throw new Error(`LM Studio API error (${label}): ${res.status} ${res.statusText}`);
  }
}

export class LMStudioProvider implements ProviderClient {
  readonly name = "lmstudio" as const;

  constructor(
    private readonly config: ProviderConfig,
    private readonly deps: ProviderDeps,
  ) {}

  async generate(prompt: string, model?: string): Promise<string> {
    const selected = model ?? this.config.defaultModel;
    return timed("lmstudio", "generate", selected, this.deps.observe, async () => {
      const res = await fetchJson(
        `${this.config.baseUrl}/v1/completions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: selected, prompt, max_tokens: 2048, temperature: 0.7 }),
        },
        this.deps,
        this.config.timeoutMs,
      );
      assertOk(res, "generate");
      const data = (await res.json()) as { choices: Array<{ text?: string }> };
      return data.choices[0]?.text ?? "";
    });
  }

  async chat(messages: ChatMessage[], model?: string): Promise<string> {
    const selected = model ?? this.config.defaultModel;
    return timed("lmstudio", "chat", selected, this.deps.observe, async () => {
      const res = await fetchJson(
        `${this.config.baseUrl}/v1/chat/completions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: selected, messages, max_tokens: 2048, temperature: 0.7 }),
        },
        this.deps,
        this.config.timeoutMs,
      );
      assertOk(res, "chat");
      const data = (await res.json()) as { choices: Array<{ message?: { content?: string } }> };
      return data.choices[0]?.message?.content ?? "";
    });
  }

  async listModels(): Promise<string[]> {
    const res = await fetchJson(`${this.config.baseUrl}/v1/models`, { method: "GET" }, this.deps, this.config.timeoutMs);
    assertOk(res, "listModels");
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    return (data.data ?? []).map((m) => m.id);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetchJson(`${this.config.baseUrl}/v1/models`, { method: "GET" }, this.deps, 5000);
      return res.ok;
    } catch {
      return false;
    }
  }

  async modelInfo(modelName: string): Promise<ModelInfo> {
    const res = await fetchJson(`${this.config.baseUrl}/v1/models`, { method: "GET" }, this.deps, this.config.timeoutMs);
    assertOk(res, "modelInfo");
    const data = (await res.json()) as { data?: Array<{ id: string; owned_by?: string; created?: number }> };
    const model = (data.data ?? []).find((m) => m.id === modelName);
    if (!model) {
      throw new Error(`Model ${modelName} not found`);
    }
    return {
      name: model.id,
      ownedBy: model.owned_by ?? "Unknown",
      created: model.created ?? "Unknown",
      note: "LM Studio provides limited model information via its OpenAI-compatible API.",
    };
  }

  async generateEmbeddings(text: string, model?: string): Promise<number[]> {
    const selected = model ?? this.config.defaultModel;
    const res = await fetchJson(
      `${this.config.baseUrl}/v1/embeddings`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: selected, input: text }) },
      this.deps,
      this.config.timeoutMs,
    );
    assertOk(res, "generateEmbeddings");
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  }

  async generateWithParams(prompt: string, model: string, parameters: Record<string, unknown>): Promise<string> {
    const res = await fetchJson(
      `${this.config.baseUrl}/v1/completions`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, prompt, ...parameters }) },
      this.deps,
      this.config.timeoutMs,
    );
    assertOk(res, "generateWithParams");
    const data = (await res.json()) as { choices: Array<{ text?: string }> };
    return data.choices[0]?.text ?? "";
  }
}
