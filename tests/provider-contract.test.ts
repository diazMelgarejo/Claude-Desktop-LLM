import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, test } from "node:test";
import { OllamaProvider } from "../src/providers/ollama.js";

const ALLOW_LOOPBACK = { allowRemoteLlm: false, allowedLlmHosts: [] as string[] };

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });
}

describe("Ollama provider contract (against a local ephemeral mock server)", () => {
  let server: Server;
  let baseUrl: string;
  let mode: "ok" | "non2xx" | "malformed" | "timeout" = "ok";

  before(async () => {
    server = createServer((req, res) => {
      if (mode === "timeout") {
        // Never respond -- exercises the client's own timeout handling.
        return;
      }
      if (mode === "non2xx") {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "internal" }));
        return;
      }
      if (mode === "malformed") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("{not valid json");
        return;
      }
      if (req.url === "/api/tags") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ models: [{ name: "llama3.2" }, { name: "mistral" }] }));
        return;
      }
      if (req.url === "/api/generate") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ response: "hello from mock ollama" }));
        return;
      }
      if (req.url === "/api/ps") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ models: [{ name: "llama3.2", size: 123, expires_at: "later" }] }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    const port = await listen(server);
    baseUrl = `http://127.0.0.1:${port}`;
  });
  after(() => server.close());

  function makeProvider(timeoutMs = 2000): OllamaProvider {
    return new OllamaProvider({ baseUrl, defaultModel: "llama3.2", timeoutMs }, { endpointPolicy: ALLOW_LOOPBACK });
  }

  test("listModels", async () => {
    mode = "ok";
    const models = await makeProvider().listModels();
    assert.deepEqual(models, ["llama3.2", "mistral"]);
  });

  test("generate", async () => {
    mode = "ok";
    const result = await makeProvider().generate("hi");
    assert.equal(result, "hello from mock ollama");
  });

  test("healthCheck true on 2xx", async () => {
    mode = "ok";
    assert.equal(await makeProvider().healthCheck(), true);
  });

  test("healthCheck false on non-2xx (never throws)", async () => {
    mode = "non2xx";
    assert.equal(await makeProvider().healthCheck(), false);
    mode = "ok";
  });

  test("non-2xx response raises a clear error for generate", async () => {
    mode = "non2xx";
    await assert.rejects(() => makeProvider().generate("hi"), /Ollama API error/);
    mode = "ok";
  });

  test("malformed JSON response raises rather than silently returning undefined", async () => {
    mode = "malformed";
    await assert.rejects(() => makeProvider().generate("hi"));
    mode = "ok";
  });

  test("timeout is enforced and raises rather than hanging forever", async () => {
    mode = "timeout";
    await assert.rejects(() => makeProvider(100).generate("hi"));
    mode = "ok";
  });

  test("provider-native running-model state (/api/ps) is the observability authority for Ollama", async () => {
    mode = "ok";
    const running = await makeProvider().listRunningModels();
    assert.deepEqual(running, [{ name: "llama3.2", size: 123, expiresAt: "later" }]);
  });
});
