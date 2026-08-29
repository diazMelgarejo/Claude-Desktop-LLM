/**
 * Secondary, optional audit sink -- NOT the observability authority.
 *
 * Corrected direction (per review): observability is provider-native
 * (Ollama's own /api/ps + generation timing, LM Studio's own v1 lifecycle
 * data -- see providers/ollama.ts, providers/lmstudio.ts). This module is
 * only a local, append-only, redacted record of what happened, for
 * operators who want one; nothing reads from it to make decisions, and its
 * failure must never affect a live model request.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ProviderObservation } from "../providers/provider.js";

export interface AuditEvent {
  ts: string;
  toolClass: string;
  provider: string;
  outcome: "ok" | "error";
  durationMs: number;
  errorClass?: string;
}

function sinkPath(): string {
  const override = process.env.MCP_LOCAL_LLM_TELEMETRY_DIR;
  const dir = override ?? join(homedir(), ".mcp-local-llm", "telemetry");
  const day = new Date().toISOString().slice(0, 10);
  return join(dir, `events-${day}.jsonl`);
}

/** Fire-and-forget: never throws, never delays or fails the caller. */
export function recordAudit(obs: ProviderObservation): void {
  const event: AuditEvent = {
    ts: new Date().toISOString(),
    toolClass: obs.operation,
    provider: obs.provider,
    outcome: obs.outcome,
    durationMs: Math.round(obs.durationMs),
    errorClass: obs.errorClass,
  };
  const path = sinkPath();
  void mkdir(dirname(path), { recursive: true, mode: 0o700 })
    .then(() => appendFile(path, JSON.stringify(event) + "\n", { mode: 0o600 }))
    .catch(() => {
      // Telemetry failure never fails the originating model request.
    });
}
