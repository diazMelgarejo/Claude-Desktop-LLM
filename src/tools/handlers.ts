import type { AppConfig, ProviderName } from "../config.js";
import { assertToolEnabled } from "../policy/effect-policy.js";
import type { FilesystemStore } from "../storage/filesystem-store.js";
import type { LMStudioProvider } from "../providers/lmstudio.js";
import type { OllamaProvider } from "../providers/ollama.js";
import { findToolDefinition } from "./registry.js";
import { substituteTemplate } from "./template-substitution.js";
import { publicErrorMessage, toolErrorText } from "./errors.js";

export interface ToolContext {
  config: AppConfig;
  ollama: OllamaProvider;
  lmstudio: LMStudioProvider;
  store: FilesystemStore;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

function text(value: string): ToolResult {
  return { content: [{ type: "text", text: value }] };
}

function errorText(value: string): ToolResult {
  return { content: [{ type: "text", text: value }], isError: true };
}

function selectProvider(ctx: ToolContext, requested: unknown): { name: ProviderName; client: OllamaProvider | LMStudioProvider } {
  const name: ProviderName = requested === "ollama" || requested === "lmstudio" ? requested : ctx.config.activeProvider;
  return { name, client: name === "ollama" ? ctx.ollama : ctx.lmstudio };
}

function defaultModel(ctx: ToolContext, name: ProviderName): string {
  return name === "ollama" ? ctx.config.ollama.defaultModel : ctx.config.lmstudio.defaultModel;
}

export async function handleToolCall(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const definition = findToolDefinition(name);
  if (!definition) {
    return errorText(`Error: unknown tool "${name}". Not in the canonical tool registry.`);
  }
  try {
    assertToolEnabled(name, definition.effectClasses, { allowDestructiveTools: ctx.config.allowDestructiveTools });
  } catch (err) {
    return errorText(toolErrorText(err));
  }

  const provider = selectProvider(ctx, args.provider);

  switch (name) {
    case "local_llm_query": {
      const result = await provider.client.generate(args.prompt as string, args.model as string | undefined);
      return text(result);
    }
    case "local_llm_agent": {
      const messages = [
        {
          role: "system" as const,
          content:
            (args.system_prompt as string | undefined) ??
            "You are a helpful AI assistant. Complete the given task thoroughly and provide a detailed response.",
        },
        { role: "user" as const, content: args.task as string },
      ];
      const result = await provider.client.chat(messages, args.model as string | undefined);
      return text(result);
    }
    case "local_llm_chat": {
      const result = await provider.client.chat(
        args.messages as Array<{ role: "system" | "user" | "assistant"; content: string }>,
        args.model as string | undefined,
      );
      return text(result);
    }
    case "list_local_models": {
      const models = await provider.client.listModels();
      return text(
        models.length > 0
          ? `Available models (${provider.name}):\n${models.map((m) => `- ${m}`).join("\n")}`
          : `No models found. Make sure ${provider.name} is running with models loaded.`,
      );
    }
    case "switch_llm_provider": {
      if (args.provider !== "ollama" && args.provider !== "lmstudio") {
        return errorText('Error: provider must be exactly "ollama" or "lmstudio".');
      }
      ctx.config.activeProvider = args.provider;
      return text(`Switched to ${args.provider === "ollama" ? "Ollama" : "LM Studio"}`);
    }
    case "check_llm_status": {
      const [ollamaHealth, lmstudioHealth] = await Promise.all([ctx.ollama.healthCheck(), ctx.lmstudio.healthCheck()]);
      return text(
        [
          `Active Provider: ${ctx.config.activeProvider === "ollama" ? "Ollama" : "LM Studio"}`,
          "",
          `Ollama: ${ollamaHealth ? "✓ Connected" : "✗ Not available"}`,
          `  URL: ${ctx.config.ollama.baseUrl}`,
          `  Default model: ${ctx.config.ollama.defaultModel}`,
          "",
          `LM Studio: ${lmstudioHealth ? "✓ Connected" : "✗ Not available"}`,
          `  URL: ${ctx.config.lmstudio.baseUrl}`,
          `  Default model: ${ctx.config.lmstudio.defaultModel}`,
        ].join("\n"),
      );
    }
    case "pull_model": {
      if (provider.name !== "ollama") {
        return errorText("Error: pull_model is only supported with Ollama. LM Studio manages models through its UI.");
      }
      const result = await ctx.ollama.pullModel(args.model_name as string);
      return text(`Successfully pulled model: ${args.model_name as string}\nStatus: ${result}`);
    }
    case "delete_model": {
      if (provider.name !== "ollama") {
        return errorText("Error: delete_model is only supported with Ollama. LM Studio manages models through its UI.");
      }
      const result = await ctx.ollama.deleteModel(args.model_name as string);
      return text(result);
    }
    case "model_info": {
      const info = await provider.client.modelInfo(args.model_name as string);
      return text(JSON.stringify(info, null, 2));
    }
    case "list_running_models": {
      if (provider.name !== "ollama") {
        return errorText("Error: list_running_models is only supported with Ollama. LM Studio doesn't expose this via API.");
      }
      const running = await ctx.ollama.listRunningModels();
      return text(
        running.length > 0
          ? `Running models:\n${running.map((m) => `- ${m.name} (size: ${m.size ?? "?"}, expires: ${m.expiresAt ?? "?"})`).join("\n")}`
          : "No models currently loaded in memory",
      );
    }
    case "save_conversation": {
      await ctx.store.saveConversation(args.name as string, args.messages as unknown[], {
        provider: args.provider as string | undefined,
        model: args.model as string | undefined,
      });
      return text(`Conversation "${args.name as string}" saved successfully`);
    }
    case "load_conversation": {
      const conv = await ctx.store.loadConversation(args.name as string);
      return text(JSON.stringify(conv, null, 2));
    }
    case "list_conversations": {
      const convs = await ctx.store.listConversations();
      return text(
        convs.length > 0
          ? `Saved conversations:\n${convs.map((c) => `- ${c.name} (${c.messageCount} messages, ${c.provider ?? "unknown"}, saved ${c.savedAt})`).join("\n")}`
          : "No saved conversations",
      );
    }
    case "export_conversation": {
      const exported = await ctx.store.exportConversation(args.name as string, (args.format as "json" | "markdown") ?? "json");
      return text(exported);
    }
    case "save_prompt_template": {
      await ctx.store.saveTemplate(args.name as string, args.template as string, (args.description as string) ?? "");
      return text(`Template "${args.name as string}" saved successfully`);
    }
    case "load_prompt_template": {
      const tmpl = await ctx.store.loadTemplate(args.name as string);
      return text(substituteTemplate(tmpl.template, args.variables as Record<string, unknown> | undefined));
    }
    case "list_prompt_templates": {
      const tmpls = await ctx.store.listTemplates();
      return text(
        tmpls.length > 0
          ? `Saved templates:\n${tmpls.map((t) => `- ${t.name}: ${t.description || "No description"}`).join("\n")}`
          : "No saved templates",
      );
    }
    case "generate_embeddings": {
      const embeddings = await provider.client.generateEmbeddings(args.text as string, args.model as string | undefined);
      return text(`Generated embeddings (${embeddings.length} dimensions):\n${JSON.stringify(embeddings.slice(0, 10))}... (truncated)`);
    }
    case "compare_responses": {
      const results: Array<{ model: string; response?: string; error?: string }> = [];
      for (const model of args.models as string[]) {
        try {
          results.push({ model, response: await provider.client.generate(args.prompt as string, model) });
        } catch (e) {
          results.push({ model, error: publicErrorMessage(e) });
        }
      }
      return text(results.map((r) => (r.error ? `## ${r.model}\nError: ${r.error}` : `## ${r.model}\n${r.response}`)).join("\n\n---\n\n"));
    }
    case "set_model_parameters": {
      const model = (args.model as string | undefined) ?? defaultModel(ctx, provider.name);
      const result = await provider.client.generateWithParams(args.prompt as string, model, args.parameters as Record<string, unknown>);
      return text(result);
    }
    case "save_provider_preset": {
      await ctx.store.savePreset(args.name as string, args.config as Record<string, unknown>);
      return text(`Preset "${args.name as string}" saved successfully`);
    }
    case "load_provider_preset": {
      const preset = await ctx.store.loadPreset(args.name as string);
      return text(JSON.stringify(preset, null, 2));
    }
    case "list_provider_presets": {
      const presets = await ctx.store.listPresets();
      return text(presets.length > 0 ? `Saved presets:\n${presets.map((p) => `- ${p.name}: ${JSON.stringify(p.config)}`).join("\n")}` : "No saved presets");
    }
    case "batch_process": {
      const results: Array<{ prompt: string; response?: string; error?: string; success: boolean }> = [];
      for (const prompt of args.prompts as string[]) {
        try {
          const response = await provider.client.generate(prompt, args.model as string | undefined);
          results.push({ prompt: `${prompt.substring(0, 50)}...`, response, success: true });
        } catch (e) {
          results.push({ prompt: `${prompt.substring(0, 50)}...`, error: publicErrorMessage(e), success: false });
        }
      }
      const successCount = results.filter((r) => r.success).length;
      return text(
        `Batch processing complete (${successCount}/${results.length} successful):\n\n` +
          results.map((r, i) => `${i + 1}. ${r.prompt}\n${r.success ? r.response : `Error: ${r.error}`}`).join("\n\n---\n\n"),
      );
    }
    case "benchmark_model": {
      const model = (args.model as string | undefined) ?? defaultModel(ctx, provider.name);
      const testPrompt = (args.prompt as string | undefined) ?? "Explain quantum computing in one sentence.";
      const started = Date.now();
      const response = await provider.client.generate(testPrompt, model);
      const durationMs = Date.now() - started;
      const tokensEstimate = response.split(/\s+/).length * 1.3;
      const tokensPerSec = (tokensEstimate / (durationMs / 1000)).toFixed(2);
      return text(
        [
          `Benchmark Results for ${model} (${provider.name}):`,
          `Duration: ${durationMs}ms`,
          `Estimated tokens/sec: ${tokensPerSec}`,
          `Response length: ${response.length} characters`,
          "",
          `Test prompt: "${testPrompt}"`,
          `Response: ${response}`,
        ].join("\n"),
      );
    }
    case "add_to_knowledge_base": {
      const model = (args.model as string | undefined) ?? defaultModel(ctx, provider.name);
      const embedding = await provider.client.generateEmbeddings(args.content as string, model);
      const id = await ctx.store.addToKnowledgeBase(args.title as string, args.content as string, embedding, {
        tags: (args.tags as string[] | undefined) ?? [],
      });
      return text(`Added to knowledge base with ID: ${id}`);
    }
    case "semantic_search": {
      const model = (args.model as string | undefined) ?? defaultModel(ctx, provider.name);
      const queryEmbedding = await provider.client.generateEmbeddings(args.query as string, model);
      const results = await ctx.store.searchKnowledgeBase(queryEmbedding, (args.top_k as number | undefined) ?? 5);
      return text(
        results.length > 0
          ? `Found ${results.length} results:\n\n${results.map((r, i) => `${i + 1}. **${r.title}** (similarity: ${(r.similarity * 100).toFixed(1)}%)\n${r.content}\n`).join("\n---\n\n")}`
          : "No results found",
      );
    }
    case "list_knowledge_base": {
      const entries = await ctx.store.listKnowledgeBase();
      return text(entries.length > 0 ? `Knowledge base (${entries.length} entries):\n${entries.map((e) => `- ${e.title} (${e.addedAt})`).join("\n")}` : "Knowledge base is empty");
    }
    case "summarize_context": {
      const prompt = `Summarize the following text${args.max_length ? ` in about ${args.max_length as number} words` : ""}:\n\n${args.text as string}`;
      return text(await provider.client.generate(prompt));
    }
    case "extract_key_points": {
      const prompt = `Extract ${(args.max_points as number | undefined) ?? 5} key points from the following text as bullet points:\n\n${args.text as string}`;
      return text(await provider.client.generate(prompt));
    }
    case "code_review": {
      const langHint = args.language ? ` (${args.language as string})` : "";
      const prompt = `Perform a code review of the following code${langHint}. Analyze for:\n- Bugs and potential issues\n- Best practices\n- Performance improvements\n- Security concerns\n- Code style\n\nCode:\n\`\`\`\n${args.code as string}\n\`\`\``;
      return text(await provider.client.generate(prompt));
    }
    case "generate_tests": {
      const framework = (args.framework as string | undefined) ?? "generic";
      const prompt = `Generate comprehensive unit tests for the following code using ${framework}:\n\n\`\`\`\n${args.code as string}\n\`\`\`\n\nInclude:\n- Test cases for normal operation\n- Edge cases\n- Error handling\n- Mock data if needed`;
      return text(await provider.client.generate(prompt));
    }
    case "explain_code": {
      const level = (args.detail_level as string | undefined) ?? "detailed";
      const prompt =
        level === "brief"
          ? `Briefly explain what this code does:\n\n\`\`\`\n${args.code as string}\n\`\`\``
          : `Provide a detailed explanation of this code, including:\n- What it does\n- How it works\n- Key algorithms or patterns used\n- Input/output\n\n\`\`\`\n${args.code as string}\n\`\`\``;
      return text(await provider.client.generate(prompt));
    }
    default:
      return errorText(`Error: unknown tool "${name}"`);
  }
}
