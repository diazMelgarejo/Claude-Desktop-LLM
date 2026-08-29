import { guardedFetch } from "../policy/endpoint-policy.js";
import type { ChatMessage, ModelInfo, ProviderClient, ProviderConfig, ProviderDeps, RunningModel } from "./provider.js";
import { fetchJson, timed } from "./provider.js";

function assertOk(res: { ok: boolean; status: number; statusText: string }, label: string): void {
  if (!res.ok) {
    throw new Error(`Ollama API error (${label}): ${res.status} ${res.statusText}`);
  }
}

export class OllamaProvider implements ProviderClient {
  readonly name = "ollama" as const;

  constructor(
    private readonly config: ProviderConfig,
    private readonly deps: ProviderDeps,
  ) {}

  async generate(prompt: string, model?: string): Promise<string> {
    const selected = model ?? this.config.defaultModel;
    return timed("ollama", "generate", selected, this.deps.observe, async () => {
      const res = await fetchJson(
        `${this.config.baseUrl}/api/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: selected, prompt, stream: false }),
        },
        this.deps,
        this.config.timeoutMs,
      );
      assertOk(res, "generate");
      const data = (await res.json()) as { response: string };
      return data.response;
    });
  }

  async chat(messages: ChatMessage[], model?: string): Promise<string> {
    const selected = model ?? this.config.defaultModel;
    return timed("ollama", "chat", selected, this.deps.observe, async () => {
      const res = await fetchJson(
        `${this.config.baseUrl}/api/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: selected, messages, stream: false }),
        },
        this.deps,
        this.config.timeoutMs,
      );
      assertOk(res, "chat");
      const data = (await res.json()) as { message: { content: string } };
      return data.message.content;
    });
  }

  async listModels(): Promise<string[]> {
    const res = await fetchJson(`${this.config.baseUrl}/api/tags`, { method: "GET" }, this.deps, this.config.timeoutMs);
    assertOk(res, "listModels");
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return (data.models ?? []).map((m) => m.name);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetchJson(`${this.config.baseUrl}/api/tags`, { method: "GET" }, this.deps, 5000);
      if (!res.ok) return false;
      await res.json();
      return true;
    } catch {
      return false;
    }
  }

  async pullModel(modelName: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await guardedFetch(
        `${this.config.baseUrl}/api/pull`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: modelName }),
          signal: controller.signal,
        },
        this.deps.endpointPolicy,
      );
      if (!response.ok || !response.body) {
        throw new Error(`Ollama API error (pullModel): ${response.status} ${response.statusText}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let lastStatus = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n").filter((l) => l.trim())) {
          try {
            const parsed = JSON.parse(line) as { status?: string };
            if (parsed.status) lastStatus = parsed.status;
          } catch {
            // Ignore partial/malformed lines mid-stream.
          }
        }
      }
      return lastStatus || "Model pull completed";
    } finally {
      clearTimeout(timer);
    }
  }

  async deleteModel(modelName: string): Promise<string> {
    const res = await fetchJson(
      `${this.config.baseUrl}/api/delete`,
      { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: modelName }) },
      this.deps,
      this.config.timeoutMs,
    );
    assertOk(res, "deleteModel");
    res.finish();
    return `Model ${modelName} deleted successfully`;
  }

  async modelInfo(modelName: string): Promise<ModelInfo> {
    const res = await fetchJson(
      `${this.config.baseUrl}/api/show`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: modelName }) },
      this.deps,
      this.config.timeoutMs,
    );
    assertOk(res, "modelInfo");
    const data = (await res.json()) as {
      size?: number;
      details?: { family?: string; parameter_size?: string; quantization_level?: string };
      modified_at?: string;
    };
    return {
      name: modelName,
      size: data.size ?? "Unknown",
      family: data.details?.family ?? "Unknown",
      parameterSize: data.details?.parameter_size ?? "Unknown",
      quantization: data.details?.quantization_level ?? "Unknown",
      modified: data.modified_at ?? "Unknown",
    };
  }

  /** Provider-native runtime state -- loaded models, VRAM/size, expiry. Per
   * the corrected observability direction: this IS the observability
   * authority for Ollama, not a generic redacted-event pipeline. */
  async listRunningModels(): Promise<RunningModel[]> {
    const res = await fetchJson(`${this.config.baseUrl}/api/ps`, { method: "GET" }, this.deps, this.config.timeoutMs);
    assertOk(res, "listRunningModels");
    const data = (await res.json()) as { models?: Array<{ name: string; size?: number; expires_at?: string }> };
    return (data.models ?? []).map((m) => ({ name: m.name, size: m.size, expiresAt: m.expires_at }));
  }

  async generateEmbeddings(text: string, model?: string): Promise<number[]> {
    const selected = model ?? this.config.defaultModel;
    const res = await fetchJson(
      `${this.config.baseUrl}/api/embeddings`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: selected, prompt: text }) },
      this.deps,
      this.config.timeoutMs,
    );
    assertOk(res, "generateEmbeddings");
    const data = (await res.json()) as { embedding: number[] };
    return data.embedding;
  }

  async generateWithParams(prompt: string, model: string, parameters: Record<string, unknown>): Promise<string> {
    const res = await fetchJson(
      `${this.config.baseUrl}/api/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false, options: parameters }),
      },
      this.deps,
      this.config.timeoutMs,
    );
    assertOk(res, "generateWithParams");
    const data = (await res.json()) as { response: string };
    return data.response;
  }
}
