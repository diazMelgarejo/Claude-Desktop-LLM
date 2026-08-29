import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ConfigError, loadConfig } from "../src/config.js";

describe("config", () => {
  test("defaults are sane and local-only", () => {
    const config = loadConfig({});
    assert.equal(config.activeProvider, "ollama");
    assert.equal(config.allowRemoteLlm, false);
    assert.deepEqual(config.allowedLlmHosts, []);
    assert.equal(config.allowDestructiveTools, false);
  });

  test("ACTIVE_PROVIDER must be a valid enum value", () => {
    assert.throws(() => loadConfig({ ACTIVE_PROVIDER: "bogus" }), ConfigError);
  });

  test("invalid TIMEOUT fails closed", () => {
    assert.throws(() => loadConfig({ TIMEOUT: "not-a-number" }), ConfigError);
    assert.throws(() => loadConfig({ TIMEOUT: "-5" }), ConfigError);
  });

  test("invalid provider URL fails closed", () => {
    assert.throws(() => loadConfig({ OLLAMA_URL: "not a url" }), ConfigError);
  });

  test("ACTIVE_PROVIDER wins over the deprecated DEFAULT_PROVIDER when both set", () => {
    const config = loadConfig({ ACTIVE_PROVIDER: "lmstudio", DEFAULT_PROVIDER: "ollama" });
    assert.equal(config.activeProvider, "lmstudio");
  });

  test("DEFAULT_PROVIDER alone still works (deprecated compatibility window)", () => {
    const config = loadConfig({ DEFAULT_PROVIDER: "lmstudio" });
    assert.equal(config.activeProvider, "lmstudio");
  });

  test("ALLOW_REMOTE_LLM and ALLOW_DESTRUCTIVE_TOOLS accept common truthy spellings", () => {
    for (const truthy of ["1", "true", "TRUE", "yes", "on"]) {
      assert.equal(loadConfig({ ALLOW_REMOTE_LLM: truthy }).allowRemoteLlm, true, truthy);
      assert.equal(loadConfig({ ALLOW_DESTRUCTIVE_TOOLS: truthy }).allowDestructiveTools, true, truthy);
    }
  });

  test("ALLOWED_LLM_HOSTS is parsed as a normalized, trimmed, lowercased list", () => {
    const config = loadConfig({ ALLOWED_LLM_HOSTS: " Example.com, 10.0.0.5 ,,other.host " });
    assert.deepEqual(config.allowedLlmHosts, ["example.com", "10.0.0.5", "other.host"]);
  });
});
