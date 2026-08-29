import assert from "node:assert/strict";
import { createServer } from "node:http";
import { describe, test } from "node:test";
import { EndpointPolicyError, guardedFetch, validateAndPin } from "../src/policy/endpoint-policy.js";

const DENY_ALL = { allowRemoteLlm: false, allowedLlmHosts: [] as string[] };

describe("endpoint policy", () => {
  test("loopback hostname is accepted by default", async () => {
    const { pinnedIp } = await validateAndPin("http://localhost:11434/api/tags", DENY_ALL);
    assert.equal(pinnedIp, "127.0.0.1");
  });

  test("loopback IP literal is accepted by default", async () => {
    const { pinnedIp } = await validateAndPin("http://127.0.0.1:11434/api/tags", DENY_ALL);
    assert.equal(pinnedIp, "127.0.0.1");
  });

  test("URL userinfo is rejected", async () => {
    await assert.rejects(
      () => validateAndPin("http://user:pass@localhost:11434", DENY_ALL),
      (err: unknown) => err instanceof EndpointPolicyError && err.code === "userinfo_present",
    );
  });

  test("unsupported scheme is rejected", async () => {
    await assert.rejects(
      () => validateAndPin("ftp://localhost/file", DENY_ALL),
      (err: unknown) => err instanceof EndpointPolicyError && err.code === "scheme_disallowed",
    );
  });

  test("non-loopback destination is denied by default", async () => {
    // IP literal -- deterministic, no real DNS/network dependency.
    await assert.rejects(
      () => validateAndPin("http://10.0.0.5/", DENY_ALL),
      (err: unknown) => err instanceof EndpointPolicyError && err.code === "non_loopback_denied",
    );
  });

  test("explicit opt-in permits a specific allowed host", async () => {
    // IP literal -- deterministic, no real DNS/network dependency.
    const { pinnedIp } = await validateAndPin("http://10.0.0.5/", {
      allowRemoteLlm: true,
      allowedLlmHosts: ["10.0.0.5"],
    });
    assert.equal(pinnedIp, "10.0.0.5");
  });

  test("opt-in flag alone (without the host on the allowlist) still denies", async () => {
    // IP literal -- deterministic, no real DNS/network dependency, per the
    // plan's own "never depend on a live network in required tests" rule.
    await assert.rejects(
      () => validateAndPin("http://10.0.0.5/", { allowRemoteLlm: true, allowedLlmHosts: ["example.com"] }),
      (err: unknown) => err instanceof EndpointPolicyError && err.code === "non_loopback_denied",
    );
  });

  test("guardedFetch actually reaches a real loopback ephemeral server", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      const response = await guardedFetch(`http://127.0.0.1:${port}/`, {}, DENY_ALL);
      assert.equal(response.status, 200);
      const body = (await response.json()) as { ok: boolean };
      assert.equal(body.ok, true);
    } finally {
      server.close();
    }
  });

  test("redirect to a denied non-loopback target is not silently followed", async () => {
    const server = createServer((_req, res) => {
      // IP literal -- deterministic, no real DNS/network dependency.
      res.writeHead(302, { Location: "http://10.0.0.5/private" });
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      await assert.rejects(
        () => guardedFetch(`http://127.0.0.1:${port}/`, {}, DENY_ALL),
        (err: unknown) => err instanceof EndpointPolicyError && err.code === "non_loopback_denied",
      );
    } finally {
      server.close();
    }
  });
});
