#!/usr/bin/env node
/** Ollama-only Desktop extension entrypoint -- thin wrapper, forces the
 * active provider, delegates everything else to the canonical server. */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "../config.js";
import { recordAudit } from "../telemetry/events.js";
import { createServer } from "../server/create-server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  config.activeProvider = "ollama";
  const { server } = createServer(config, recordAudit);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Local LLM Server (canonical, Ollama-only) running on stdio");
  console.error(`Ollama URL: ${config.ollama.baseUrl}`);
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
