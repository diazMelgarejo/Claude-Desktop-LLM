import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { AppConfig } from "../src/config.js";
import { LMStudioProvider } from "../src/providers/lmstudio.js";
import { OllamaProvider } from "../src/providers/ollama.js";
import { FilesystemStore, StorageError } from "../src/storage/filesystem-store.js";
import { toolErrorText } from "../src/tools/errors.js";
import { handleToolCall, type ToolContext } from "../src/tools/handlers.js";

const endpointPolicy = { allowRemoteLlm: false, allowedLlmHosts: [] as string[] };

function makeContext(): ToolContext {
  const config: AppConfig = {
    ollama: { baseUrl: "http://127.0.0.1:11434", defaultModel: "llama3.2", timeoutMs: 100 },
    lmstudio: { baseUrl: "http://127.0.0.1:1234", defaultModel: "default", timeoutMs: 100 },
    activeProvider: "ollama",
    allowRemoteLlm: false,
    allowedLlmHosts: [],
    allowDestructiveTools: false,
  };
  return {
    config,
    ollama: new OllamaProvider(config.ollama, { endpointPolicy }),
    lmstudio: new LMStudioProvider(config.lmstudio, { endpointPolicy }),
    store: new FilesystemStore(),
  };
}

describe("tool handler review hardening", () => {
  test("invalid provider selection does not mutate activeProvider", async () => {
    const ctx = makeContext();
    const result = await handleToolCall("switch_llm_provider", { provider: "invalid" }, ctx);
    assert.equal(result.isError, true);
    assert.equal(ctx.config.activeProvider, "ollama");
  });

  test("arbitrary Error messages are not exposed to MCP clients", () => {
    const result = toolErrorText(new Error("provider failed at https://secret.internal/model/private"));
    assert.equal(result, "Error: Request failed. Check local runtime status and configuration.");
    assert.doesNotMatch(result, /secret\.internal|private/);
  });

  test("only explicitly safe storage validation errors expose details", () => {
    assert.equal(
      toolErrorText(new StorageError("name contains a forbidden character", "invalid_name")),
      "Error: name contains a forbidden character",
    );
    assert.equal(
      toolErrorText(new StorageError("not found: /home/example/.mcp-local-llm/private.json", "not_found")),
      "Error: Request failed. Check local runtime status and configuration.",
    );
  });
});
