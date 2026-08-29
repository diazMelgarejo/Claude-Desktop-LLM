#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "../config.js";
import { recordAudit } from "../telemetry/events.js";
import { createServer } from "../server/create-server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const { server } = createServer(config, recordAudit);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("MCP Local LLM Server (canonical, combined) running on stdio");
  console.error(`Active Provider: ${config.activeProvider === "ollama" ? "Ollama" : "LM Studio"}`);
  console.error(`Ollama URL: ${config.ollama.baseUrl}`);
  console.error(`LM Studio URL: ${config.lmstudio.baseUrl}`);
  if (!config.allowRemoteLlm) {
    console.error("Remote LLM access disabled (local-only). Set ALLOW_REMOTE_LLM=1 and ALLOWED_LLM_HOSTS to enable.");
  }
  if (!config.allowDestructiveTools) {
    console.error("Destructive tools disabled. Set ALLOW_DESTRUCTIVE_TOOLS=1 to enable (e.g. delete_model).");
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
