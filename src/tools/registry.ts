import type { EffectClass } from "../policy/effect-policy.js";

export interface ToolDefinition {
  name: string;
  description: string;
  effectClasses: readonly EffectClass[];
  inputSchema: Record<string, unknown>;
}

const providerEnum = { type: "string", enum: ["ollama", "lmstudio"], description: "Provider to use (optional)" };

/** Single source of truth for all 33 tools -- schema + effect classification.
 * README and packaging manifests should be generated from this, not hand-synced
 * (the plan's own §3 P2 finding: docs/tool-count drift is a direct symptom of
 * not having one canonical registry -- this file is that registry). */
export const TOOL_REGISTRY: readonly ToolDefinition[] = [
  {
    name: "local_llm_query",
    description: "Send a simple prompt to the local LLM and get a response.",
    effectClasses: ["MODEL_INFERENCE"],
    inputSchema: {
      type: "object",
      properties: { prompt: { type: "string" }, model: { type: "string" }, provider: providerEnum },
      required: ["prompt"],
    },
  },
  {
    name: "local_llm_agent",
    description: "Delegate a complex task to the local LLM agent with a system-prompt context.",
    effectClasses: ["MODEL_INFERENCE"],
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string" },
        system_prompt: { type: "string" },
        model: { type: "string" },
        provider: providerEnum,
      },
      required: ["task"],
    },
  },
  {
    name: "local_llm_chat",
    description: "Multi-turn conversation with the local LLM.",
    effectClasses: ["MODEL_INFERENCE"],
    inputSchema: {
      type: "object",
      properties: {
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: { role: { type: "string", enum: ["system", "user", "assistant"] }, content: { type: "string" } },
            required: ["role", "content"],
          },
        },
        model: { type: "string" },
        provider: providerEnum,
      },
      required: ["messages"],
    },
  },
  {
    name: "list_local_models",
    description: "List all available models from the local LLM provider.",
    effectClasses: ["READ_ONLY"],
    inputSchema: { type: "object", properties: { provider: providerEnum }, required: [] },
  },
  {
    name: "switch_llm_provider",
    description: "Switch between Ollama and LM Studio as the active provider.",
    effectClasses: ["LOCAL_WRITE"],
    inputSchema: {
      type: "object",
      properties: { provider: { type: "string", enum: ["ollama", "lmstudio"] } },
      required: ["provider"],
    },
  },
  {
    name: "check_llm_status",
    description: "Check health of both providers and show which is active.",
    effectClasses: ["READ_ONLY"],
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pull_model",
    description: "Download a model from the Ollama registry (Ollama only).",
    effectClasses: ["EXPENSIVE", "LOCAL_WRITE"],
    inputSchema: {
      type: "object",
      properties: { model_name: { type: "string" }, provider: { type: "string", enum: ["ollama"] } },
      required: ["model_name"],
    },
  },
  {
    name: "delete_model",
    description: "Delete a model to free disk space (Ollama only).",
    effectClasses: ["DESTRUCTIVE"],
    inputSchema: {
      type: "object",
      properties: { model_name: { type: "string" }, provider: { type: "string", enum: ["ollama"] } },
      required: ["model_name"],
    },
  },
  {
    name: "model_info",
    description: "Get detailed information about a specific model.",
    effectClasses: ["READ_ONLY"],
    inputSchema: {
      type: "object",
      properties: { model_name: { type: "string" }, provider: providerEnum },
      required: ["model_name"],
    },
  },
  {
    name: "list_running_models",
    description: "List currently loaded/running models in memory (Ollama only).",
    effectClasses: ["READ_ONLY"],
    inputSchema: { type: "object", properties: { provider: { type: "string", enum: ["ollama"] } }, required: [] },
  },
  {
    name: "save_conversation",
    description: "Save the current conversation for later retrieval.",
    effectClasses: ["LOCAL_WRITE"],
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        messages: { type: "array" },
        provider: { type: "string" },
        model: { type: "string" },
      },
      required: ["name", "messages"],
    },
  },
  {
    name: "load_conversation",
    description: "Load a previously saved conversation.",
    effectClasses: ["READ_ONLY"],
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "list_conversations",
    description: "List all saved conversations.",
    effectClasses: ["READ_ONLY"],
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "export_conversation",
    description: "Export a conversation to JSON or Markdown.",
    effectClasses: ["READ_ONLY"],
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, format: { type: "string", enum: ["json", "markdown"] } },
      required: ["name"],
    },
  },
  {
    name: "save_prompt_template",
    description: "Save a reusable prompt template.",
    effectClasses: ["LOCAL_WRITE"],
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, template: { type: "string" }, description: { type: "string" } },
      required: ["name", "template"],
    },
  },
  {
    name: "load_prompt_template",
    description: "Load a saved prompt template, substituting {{variable}} placeholders literally.",
    effectClasses: ["READ_ONLY"],
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, variables: { type: "object" } },
      required: ["name"],
    },
  },
  {
    name: "list_prompt_templates",
    description: "List all saved prompt templates.",
    effectClasses: ["READ_ONLY"],
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "generate_embeddings",
    description: "Generate vector embeddings for text.",
    effectClasses: ["MODEL_INFERENCE"],
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" }, model: { type: "string" }, provider: providerEnum },
      required: ["text"],
    },
  },
  {
    name: "compare_responses",
    description: "Compare responses from different models to the same prompt.",
    effectClasses: ["MODEL_INFERENCE"],
    inputSchema: {
      type: "object",
      properties: { prompt: { type: "string" }, models: { type: "array", items: { type: "string" } }, provider: providerEnum },
      required: ["prompt", "models"],
    },
  },
  {
    name: "set_model_parameters",
    description: "Generate text with custom parameters (temperature, top_p, max_tokens, etc.).",
    effectClasses: ["MODEL_INFERENCE"],
    inputSchema: {
      type: "object",
      properties: { prompt: { type: "string" }, model: { type: "string" }, parameters: { type: "object" }, provider: providerEnum },
      required: ["prompt", "parameters"],
    },
  },
  {
    name: "save_provider_preset",
    description: "Save a configuration preset for a provider.",
    effectClasses: ["LOCAL_WRITE"],
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, config: { type: "object" } },
      required: ["name", "config"],
    },
  },
  {
    name: "load_provider_preset",
    description: "Load a saved provider preset.",
    effectClasses: ["READ_ONLY"],
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "list_provider_presets",
    description: "List all saved provider presets.",
    effectClasses: ["READ_ONLY"],
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "batch_process",
    description: "Process multiple prompts in batch.",
    effectClasses: ["EXPENSIVE", "MODEL_INFERENCE"],
    inputSchema: {
      type: "object",
      properties: { prompts: { type: "array", items: { type: "string" } }, model: { type: "string" }, provider: providerEnum },
      required: ["prompts"],
    },
  },
  {
    name: "benchmark_model",
    description: "Benchmark a model with a standard prompt.",
    effectClasses: ["EXPENSIVE", "MODEL_INFERENCE"],
    inputSchema: {
      type: "object",
      properties: { model: { type: "string" }, prompt: { type: "string" }, provider: providerEnum },
      required: [],
    },
  },
  {
    name: "add_to_knowledge_base",
    description: "Add a document to the knowledge base with semantic embeddings.",
    effectClasses: ["MODEL_INFERENCE", "LOCAL_WRITE"],
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        provider: providerEnum,
      },
      required: ["title", "content"],
    },
  },
  {
    name: "semantic_search",
    description: "Search the knowledge base using semantic similarity.",
    effectClasses: ["MODEL_INFERENCE", "READ_ONLY"],
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, top_k: { type: "number" }, provider: providerEnum },
      required: ["query"],
    },
  },
  {
    name: "list_knowledge_base",
    description: "List all entries in the knowledge base.",
    effectClasses: ["READ_ONLY"],
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "summarize_context",
    description: "Summarize long text or conversations.",
    effectClasses: ["MODEL_INFERENCE"],
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" }, max_length: { type: "number" }, provider: providerEnum },
      required: ["text"],
    },
  },
  {
    name: "extract_key_points",
    description: "Extract key points from text as bullet points.",
    effectClasses: ["MODEL_INFERENCE"],
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" }, max_points: { type: "number" }, provider: providerEnum },
      required: ["text"],
    },
  },
  {
    name: "code_review",
    description: "Automated code review for best practices, bugs, and improvements.",
    effectClasses: ["MODEL_INFERENCE"],
    inputSchema: {
      type: "object",
      properties: { code: { type: "string" }, language: { type: "string" }, provider: providerEnum },
      required: ["code"],
    },
  },
  {
    name: "generate_tests",
    description: "Generate unit tests for the provided code.",
    effectClasses: ["MODEL_INFERENCE"],
    inputSchema: {
      type: "object",
      properties: { code: { type: "string" }, framework: { type: "string" }, provider: providerEnum },
      required: ["code"],
    },
  },
  {
    name: "explain_code",
    description: "Get detailed explanations of how code works.",
    effectClasses: ["MODEL_INFERENCE"],
    inputSchema: {
      type: "object",
      properties: { code: { type: "string" }, detail_level: { type: "string", enum: ["brief", "detailed"] }, provider: providerEnum },
      required: ["code"],
    },
  },
] as const;

export function findToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY.find((t) => t.name === name);
}
