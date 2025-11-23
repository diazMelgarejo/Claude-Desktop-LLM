#!/usr/bin/env node
/**
 * MCP Server for Local LLM Integration (CLI Version)
 * Connects Claude Code CLI to Ollama or LM Studio as external agents
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as storage from './storage.js';
import * as advancedApi from './advanced-api.js';


// Configuration from environment variables
const config = {
  ollama: {
    baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    defaultModel: process.env.OLLAMA_MODEL || 'llama3.2',
    timeout: parseInt(process.env.TIMEOUT || '120000', 10),
  },
  lmstudio: {
    baseUrl: process.env.LMSTUDIO_URL || 'http://localhost:1234',
    defaultModel: process.env.LMSTUDIO_MODEL || 'default',
    timeout: parseInt(process.env.TIMEOUT || '120000', 10),
  },
  activeProvider: (process.env.ACTIVE_PROVIDER || 'ollama').toLowerCase(),
};

// Ollama API functions
async function ollamaGenerate(prompt, model) {
  const selectedModel = model || config.ollama.defaultModel;
  const response = await fetch(`${config.ollama.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      prompt: prompt,
      stream: false,
    }),
    signal: AbortSignal.timeout(config.ollama.timeout),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.response;
}

async function ollamaChat(messages, model) {
  const selectedModel = model || config.ollama.defaultModel;
  const response = await fetch(`${config.ollama.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      messages: messages,
      stream: false,
    }),
    signal: AbortSignal.timeout(config.ollama.timeout),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.message.content;
}

async function ollamaListModels() {
  const response = await fetch(`${config.ollama.baseUrl}/api/tags`, {
    method: 'GET',
    signal: AbortSignal.timeout(config.ollama.timeout),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return (data.models || []).map(m => m.name);
}

async function ollamaHealthCheck() {
  try {
    const response = await fetch(`${config.ollama.baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// LM Studio API functions
async function lmstudioGenerate(prompt, model) {
  const selectedModel = model || config.lmstudio.defaultModel;
  const response = await fetch(`${config.lmstudio.baseUrl}/v1/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      prompt: prompt,
      max_tokens: 2048,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(config.lmstudio.timeout),
  });

  if (!response.ok) {
    throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.text || '';
}

async function lmstudioChat(messages, model) {
  const selectedModel = model || config.lmstudio.defaultModel;
  const response = await fetch(`${config.lmstudio.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      messages: messages,
      max_tokens: 2048,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(config.lmstudio.timeout),
  });

  if (!response.ok) {
    throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message.content || '';
}

async function lmstudioListModels() {
  const response = await fetch(`${config.lmstudio.baseUrl}/v1/models`, {
    method: 'GET',
    signal: AbortSignal.timeout(config.lmstudio.timeout),
  });

  if (!response.ok) {
    throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return (data.data || []).map(m => m.id);
}

async function lmstudioHealthCheck() {
  try {
    const response = await fetch(`${config.lmstudio.baseUrl}/v1/models`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Model Management - Ollama
async function ollamaPullModel(modelName) {
  const response = await fetch(`${config.ollama.baseUrl}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  // Stream response to get progress
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let lastStatus = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(l => l.trim());

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.status) {
          lastStatus = data.status;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  return lastStatus || 'Model pull completed';
}

async function ollamaDeleteModel(modelName) {
  const response = await fetch(`${config.ollama.baseUrl}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName }),
    signal: AbortSignal.timeout(config.ollama.timeout),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  return `Model ${modelName} deleted successfully`;
}

async function ollamaModelInfo(modelName) {
  const response = await fetch(`${config.ollama.baseUrl}/api/show`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName }),
    signal: AbortSignal.timeout(config.ollama.timeout),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    name: modelName,
    size: data.size || 'Unknown',
    family: data.details?.family || 'Unknown',
    parameter_size: data.details?.parameter_size || 'Unknown',
    quantization: data.details?.quantization_level || 'Unknown',
    modified: data.modified_at || 'Unknown',
    modelInfo: data.modelInfo || {},
  };
}

async function ollamaListRunningModels() {
  const response = await fetch(`${config.ollama.baseUrl}/api/ps`, {
    method: 'GET',
    signal: AbortSignal.timeout(config.ollama.timeout),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return (data.models || []).map(m => ({
    name: m.name,
    size: m.size,
    expires_at: m.expires_at,
  }));
}

// Model Management - LM Studio
async function lmstudioModelInfo(modelName) {
  const response = await fetch(`${config.lmstudio.baseUrl}/v1/models`, {
    method: 'GET',
    signal: AbortSignal.timeout(config.lmstudio.timeout),
  });

  if (!response.ok) {
    throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const model = (data.data || []).find(m => m.id === modelName);

  if (!model) {
    throw new Error(`Model ${modelName} not found`);
  }

  return {
    name: model.id,
    owned_by: model.owned_by || 'Unknown',
    created: model.created || 'Unknown',
    // LM Studio provides limited info via OpenAI-compatible API
    note: 'LM Studio provides limited model information via API',
  };
}

// Create MCP server
const server = new Server(
  {
    name: 'mcp-local-llm',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
const tools = [
  {
    name: 'local_llm_query',
    description: 'Send a simple prompt to the local LLM and get a response. Use this for quick questions or simple tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt to send to the local LLM',
        },
        model: {
          type: 'string',
          description: 'Specific model to use (optional)',
        },
        provider: {
          type: 'string',
          enum: ['ollama', 'lmstudio'],
          description: 'Provider to use (optional, defaults to active provider)',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'local_llm_agent',
    description: 'Delegate a complex task to the local LLM agent. The agent will work on the task with a system prompt context. Use this for tasks that require detailed analysis or multi-step reasoning.',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The task to delegate to the local LLM agent',
        },
        system_prompt: {
          type: 'string',
          description: 'Custom system prompt for the agent (optional)',
        },
        model: {
          type: 'string',
          description: 'Specific model to use (optional)',
        },
        provider: {
          type: 'string',
          enum: ['ollama', 'lmstudio'],
          description: 'Provider to use (optional)',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'local_llm_chat',
    description: 'Have a multi-turn conversation with the local LLM. Pass an array of messages with roles (system, user, assistant) for context-aware responses.',
    inputSchema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: {
                type: 'string',
                enum: ['system', 'user', 'assistant'],
              },
              content: {
                type: 'string',
              },
            },
            required: ['role', 'content'],
          },
          description: 'Array of chat messages',
        },
        model: {
          type: 'string',
          description: 'Specific model to use (optional)',
        },
        provider: {
          type: 'string',
          enum: ['ollama', 'lmstudio'],
          description: 'Provider to use (optional)',
        },
      },
      required: ['messages'],
    },
  },
  {
    name: 'list_local_models',
    description: 'List all available models from the local LLM provider (Ollama or LM Studio).',
    inputSchema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['ollama', 'lmstudio'],
          description: 'Provider to list models from (optional, defaults to active provider)',
        },
      },
      required: [],
    },
  },
  {
    name: 'switch_llm_provider',
    description: 'Switch between Ollama and LM Studio as the active LLM provider.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['ollama', 'lmstudio'],
          description: 'Provider to switch to',
        },
      },
      required: ['provider'],
    },
  },
  {
    name: 'check_llm_status',
    description: 'Check the health status of both Ollama and LM Studio providers and show which one is currently active.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'pull_model',
    description: 'Download a model from Ollama registry. Note: This is Ollama-specific. LM Studio manages models through its UI.',
    inputSchema: {
      type: 'object',
      properties: {
        model_name: {
          type: 'string',
          description: 'Name of the model to pull (e.g., "llama3.2", "mistral", "codellama")',
        },
        provider: {
          type: 'string',
          enum: ['ollama'],
          description: 'Provider (ollama only)',
        },
      },
      required: ['model_name'],
    },
  },
  {
    name: 'delete_model',
    description: 'Delete a model to free up disk space. Note: Ollama-specific. LM Studio manages models through its UI.',
    inputSchema: {
      type: 'object',
      properties: {
        model_name: {
          type: 'string',
          description: 'Name of the model to delete',
        },
        provider: {
          type: 'string',
          enum: ['ollama'],
          description: 'Provider (ollama only)',
        },
      },
      required: ['model_name'],
    },
  },
  {
    name: 'model_info',
    description: 'Get detailed information about a specific model (size, parameters, family, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        model_name: {
          type: 'string',
          description: 'Name of the model to get info for',
        },
        provider: {
          type: 'string',
          enum: ['ollama', 'lmstudio'],
          description: 'Provider to query (optional, defaults to active provider)',
        },
      },
      required: ['model_name'],
    },
  },
  {
    name: 'list_running_models',
    description: 'List currently loaded/running models in memory. Note: Ollama-specific. LM Studio doesn\'t provide this via API.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['ollama'],
          description: 'Provider (ollama only)',
        },
      },
      required: [],
    },
  },
  {
    name: 'save_conversation',
    description: 'Save the current conversation for later retrieval.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the conversation' },
        messages: { type: 'array', description: 'Array of messages to save' },
        provider: { type: 'string', description: 'Provider used (optional)' },
        model: { type: 'string', description: 'Model used (optional)' },
      },
      required: ['name', 'messages'],
    },
  },
  {
    name: 'load_conversation',
    description: 'Load a previously saved conversation.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the conversation' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_conversations',
    description: 'List all saved conversations.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'export_conversation',
    description: 'Export a conversation to JSON or Markdown format.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Conversation name' },
        format: { type: 'string', enum: ['json', 'markdown'], description: 'Export format' },
      },
      required: ['name'],
    },
  },
  {
    name: 'save_prompt_template',
    description: 'Save a reusable prompt template.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Template name' },
        template: { type: 'string', description: 'Template content (use {{variable}} for variables)' },
        description: { type: 'string', description: 'Template description (optional)' },
      },
      required: ['name', 'template'],
    },
  },
  {
    name: 'load_prompt_template',
    description: 'Load a saved prompt template.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Template name' },
        variables: { type: 'object', description: 'Variables to fill in template (optional)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_prompt_templates',
    description: 'List all saved prompt templates.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'generate_embeddings',
    description: 'Generate vector embeddings for text (useful for RAG, semantic search).',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to generate embeddings for' },
        model: { type: 'string', description: 'Model to use (optional)' },
        provider: { type: 'string', enum: ['ollama', 'lmstudio'], description: 'Provider (optional)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'compare_responses',
    description: 'Compare responses from different models to the same prompt.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Prompt to send to models' },
        models: { type: 'array', items: { type: 'string' }, description: 'List of models to compare' },
        provider: { type: 'string', enum: ['ollama', 'lmstudio'], description: 'Provider (optional)' },
      },
      required: ['prompt', 'models'],
    },
  },
  {
    name: 'set_model_parameters',
    description: 'Generate text with custom parameters (temperature, top_p, max_tokens, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Prompt to generate from' },
        model: { type: 'string', description: 'Model to use (optional)' },
        parameters: {
          type: 'object',
          description: 'Generation parameters (temperature, top_p, top_k, max_tokens, etc.)',
        },
        provider: { type: 'string', enum: ['ollama', 'lmstudio'], description: 'Provider (optional)' },
      },
      required: ['prompt', 'parameters'],
    },
  },
  {
    name: 'save_provider_preset',
    description: 'Save a configuration preset for a provider (parameters, model, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Preset name' },
        config: { type: 'object', description: 'Configuration (model, temperature, top_p, etc.)' },
      },
      required: ['name', 'config'],
    },
  },
  {
    name: 'load_provider_preset',
    description: 'Load a saved provider preset.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Preset name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_provider_presets',
    description: 'List all saved provider presets.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'batch_process',
    description: 'Process multiple prompts in batch and return all results.',
    inputSchema: {
      type: 'object',
      properties: {
        prompts: { type: 'array', items: { type: 'string' }, description: 'Array of prompts to process' },
        model: { type: 'string', description: 'Model to use (optional)' },
        provider: { type: 'string', enum: ['ollama', 'lmstudio'], description: 'Provider (optional)' },
      },
      required: ['prompts'],
    },
  },
  {
    name: 'benchmark_model',
    description: 'Benchmark a model with a standard prompt to measure performance.',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Model to benchmark (optional, uses default)' },
        prompt: { type: 'string', description: 'Custom prompt (optional, uses standard)' },
        provider: { type: 'string', enum: ['ollama', 'lmstudio'], description: 'Provider (optional)' },
      },
      required: [],
    },
  },
  // RAG Enhancement
  {
    name: 'add_to_knowledge_base',
    description: 'Add a document to the knowledge base with semantic embeddings for later retrieval.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Document title' },
        content: { type: 'string', description: 'Document content' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags (optional)' },
        provider: { type: 'string', enum: ['ollama', 'lmstudio'], description: 'Provider (optional)' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'semantic_search',
    description: 'Search the knowledge base using semantic similarity.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        top_k: { type: 'number', description: 'Number of results (default 5)' },
        provider: { type: 'string', enum: ['ollama', 'lmstudio'], description: 'Provider (optional)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_knowledge_base',
    description: 'List all entries in the knowledge base.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  // Context Management
  {
    name: 'summarize_context',
    description: 'Summarize long text or conversations to condense information.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to summarize' },
        max_length: { type: 'number', description: 'Max summary length in words (optional)' },
        provider: { type: 'string', enum: ['ollama', 'lmstudio'], description: 'Provider (optional)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'extract_key_points',
    description: 'Extract key points from text as bullet points.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to extract from' },
        max_points: { type: 'number', description: 'Max number of points (default 5)' },
        provider: { type: 'string', enum: ['ollama', 'lmstudio'], description: 'Provider (optional)' },
      },
      required: ['text'],
    },
  },
  // Code Tools
  {
    name: 'code_review',
    description: 'Perform automated code review for best practices, bugs, and improvements.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to review' },
        language: { type: 'string', description: 'Programming language (optional)' },
        provider: { type: 'string', enum: ['ollama', 'lmstudio'], description: 'Provider (optional)' },
      },
      required: ['code'],
    },
  },
  {
    name: 'generate_tests',
    description: 'Generate unit tests for the provided code.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to generate tests for' },
        framework: { type: 'string', description: 'Test framework (e.g., jest, pytest)' },
        provider: { type: 'string', enum: ['ollama', 'lmstudio'], description: 'Provider (optional)' },
      },
      required: ['code'],
    },
  },
  {
    name: 'explain_code',
    description: 'Get detailed explanations of how code works.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to explain' },
        detail_level: { type: 'string', enum: ['brief', 'detailed'], description: 'Level of detail' },
        provider: { type: 'string', enum: ['ollama', 'lmstudio'], description: 'Provider (optional)' },
      },
      required: ['code'],
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const provider = args.provider || config.activeProvider;

    switch (name) {
      case 'local_llm_query': {
        const result = provider === 'ollama'
          ? await ollamaGenerate(args.prompt, args.model)
          : await lmstudioGenerate(args.prompt, args.model);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'local_llm_agent': {
        const messages = [
          {
            role: 'system',
            content: args.system_prompt || 'You are a helpful AI assistant. Complete the given task thoroughly and provide a detailed response.',
          },
          {
            role: 'user',
            content: args.task,
          },
        ];
        const result = provider === 'ollama'
          ? await ollamaChat(messages, args.model)
          : await lmstudioChat(messages, args.model);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'local_llm_chat': {
        const result = provider === 'ollama'
          ? await ollamaChat(args.messages, args.model)
          : await lmstudioChat(args.messages, args.model);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'list_local_models': {
        const models = provider === 'ollama'
          ? await ollamaListModels()
          : await lmstudioListModels();
        return {
          content: [{
            type: 'text',
            text: models.length > 0
              ? `Available models (${provider}):\n${models.map(m => `- ${m}`).join('\n')}`
              : `No models found. Make sure ${provider} is running with models loaded.`,
          }],
        };
      }

      case 'switch_llm_provider': {
        config.activeProvider = args.provider;
        return {
          content: [{
            type: 'text',
            text: `Switched to ${args.provider === 'ollama' ? 'Ollama' : 'LM Studio'}`
          }],
        };
      }

      case 'check_llm_status': {
        const [ollamaHealth, lmstudioHealth] = await Promise.all([
          ollamaHealthCheck(),
          lmstudioHealthCheck(),
        ]);
        const status = [
          `Active Provider: ${config.activeProvider === 'ollama' ? 'Ollama' : 'LM Studio'}`,
          '',
          `Ollama: ${ollamaHealth ? '✓ Connected' : '✗ Not available'}`,
          `  URL: ${config.ollama.baseUrl}`,
          `  Default model: ${config.ollama.defaultModel}`,
          '',
          `LM Studio: ${lmstudioHealth ? '✓ Connected' : '✗ Not available'}`,
          `  URL: ${config.lmstudio.baseUrl}`,
          `  Default model: ${config.lmstudio.defaultModel}`,
        ].join('\n');
        return {
          content: [{ type: 'text', text: status }],
        };
      }

      case 'pull_model': {
        if (provider !== 'ollama') {
          return {
            content: [{ type: 'text', text: 'Error: pull_model is only supported with Ollama. LM Studio manages models through its UI.' }],
            isError: true,
          };
        }
        const result = await ollamaPullModel(args.model_name);
        return {
          content: [{ type: 'text', text: `Successfully pulled model: ${args.model_name}\nStatus: ${result}` }],
        };
      }

      case 'delete_model': {
        if (provider !== 'ollama') {
          return {
            content: [{ type: 'text', text: 'Error: delete_model is only supported with Ollama. LM Studio manages models through its UI.' }],
            isError: true,
          };
        }
        const result = await ollamaDeleteModel(args.model_name);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'model_info': {
        const info = provider === 'ollama'
          ? await ollamaModelInfo(args.model_name)
          : await lmstudioModelInfo(args.model_name);

        const formatted = provider === 'ollama'
          ? [
            `Model: ${info.name}`,
            `Size: ${info.size}`,
            `Family: ${info.family}`,
            `Parameter Size: ${info.parameter_size}`,
            `Quantization: ${info.quantization}`,
            `Modified: ${info.modified}`,
          ].join('\n')
          : [
            `Model: ${info.name}`,
            `Owned By: ${info.owned_by}`,
            `Created: ${info.created}`,
            `Note: ${info.note}`,
          ].join('\n');

        return {
          content: [{ type: 'text', text: formatted }],
        };
      }

      case 'list_running_models': {
        if (provider !== 'ollama') {
          return {
            content: [{ type: 'text', text: 'Error: list_running_models is only supported with Ollama. LM Studio doesn\'t expose this information via API.' }],
            isError: true,
          };
        }
        const running = await ollamaListRunningModels();
        const text = running.length > 0
          ? `Running models:\n${running.map(m => `- ${m.name} (size: ${m.size}, expires: ${m.expires_at})`).join('\n')}`
          : 'No models currently loaded in memory';
        return {
          content: [{ type: 'text', text }],
        };
      }

      // Conversation Management
      case 'save_conversation': {
        await storage.saveConversation(args.name, args.messages, { provider: args.provider, model: args.model });
        return { content: [{ type: 'text', text: `Conversation "${args.name}" saved successfully` }] };
      }

      case 'load_conversation': {
        const conv = await storage.loadConversation(args.name);
        return { content: [{ type: 'text', text: JSON.stringify(conv, null, 2) }] };
      }

      case 'list_conversations': {
        const convs = await storage.listConversations();
        const text = convs.length > 0
          ? `Saved conversations:\n${convs.map(c => `- ${c.name} (${c.messageCount} messages, ${c.provider || 'unknown'}, saved ${c.savedAt})`).join('\n')}`
          : 'No saved conversations';
        return { content: [{ type: 'text', text }] };
      }

      case 'export_conversation': {
        const exported = await storage.exportConversation(args.name, args.format || 'json');
        return { content: [{ type: 'text', text: exported }] };
      }

      // Template Management
      case 'save_prompt_template': {
        await storage.saveTemplate(args.name, args.template, args.description || '');
        return { content: [{ type: 'text', text: `Template "${args.name}" saved successfully` }] };
      }

      case 'load_prompt_template': {
        const tmpl = await storage.loadTemplate(args.name);
        let result = tmpl.template;
        if (args.variables) {
          for (const [key, value] of Object.entries(args.variables)) {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
          }
        }
        return { content: [{ type: 'text', text: result }] };
      }

      case 'list_prompt_templates': {
        const tmpls = await storage.listTemplates();
        const text = tmpls.length > 0
          ? `Saved templates:\n${tmpls.map(t => `- ${t.name}: ${t.description || 'No description'}`).join('\n')}`
          : 'No saved templates';
        return { content: [{ type: 'text', text }] };
      }

      // Advanced Features
      case 'generate_embeddings': {
        const model = args.model || (provider === 'ollama' ? config.ollama.defaultModel : config.lmstudio.defaultModel);
        const embeddings = provider === 'ollama'
          ? await advancedApi.ollamaGenerateEmbeddings(args.text, model, config.ollama.baseUrl, config.ollama.timeout)
          : await advancedApi.lmstudioGenerateEmbeddings(args.text, model, config.lmstudio.baseUrl, config.lmstudio.timeout);
        return { content: [{ type: 'text', text: `Generated embeddings (${embeddings.length} dimensions):\n${JSON.stringify(embeddings.slice(0, 10))}... (truncated)` }] };
      }

      case 'compare_responses': {
        const results = [];
        for (const model of args.models) {
          try {
            const response = provider === 'ollama'
              ? await ollamaGenerate(args.prompt, model)
              : await lmstudioGenerate(args.prompt, model);
            results.push({ model, response });
          } catch (e) {
            results.push({ model, error: e.message });
          }
        }
        const text = results.map(r => r.error ? `## ${r.model}\nError: ${r.error}` : `## ${r.model}\n${r.response}`).join('\n\n---\n\n');
        return { content: [{ type: 'text', text }] };
      }

      case 'set_model_parameters': {
        const model = args.model || (provider === 'ollama' ? config.ollama.defaultModel : config.lmstudio.defaultModel);
        const result = provider === 'ollama'
          ? await advancedApi.ollamaGenerateWithParams(args.prompt, model, args.parameters, config.ollama.baseUrl, config.ollama.timeout)
          : await advancedApi.lmstudioGenerateWithParams(args.prompt, model, args.parameters, config.lmstudio.baseUrl, config.lmstudio.timeout);
        return { content: [{ type: 'text', text: result }] };
      }

      // Provider Presets
      case 'save_provider_preset': {
        await storage.savePreset(args.name, args.config);
        return { content: [{ type: 'text', text: `Preset "${args.name}" saved successfully` }] };
      }

      case 'load_provider_preset': {
        const preset = await storage.loadPreset(args.name);
        return { content: [{ type: 'text', text: JSON.stringify(preset, null, 2) }] };
      }

      case 'list_provider_presets': {
        const presets = await storage.listPresets();
        const text = presets.length > 0
          ? `Saved presets:\n${presets.map(p => `- ${p.name}: ${JSON.stringify(p.config)}`).join('\n')}`
          : 'No saved presets';
        return { content: [{ type: 'text', text }] };
      }

      // Batch Processing
      case 'batch_process': {
        const results = [];
        for (const prompt of args.prompts) {
          try {
            const response = provider === 'ollama'
              ? await ollamaGenerate(prompt, args.model)
              : await lmstudioGenerate(prompt, args.model);
            results.push({ prompt: prompt.substring(0, 50) + '...', response, success: true });
          } catch (e) {
            results.push({ prompt: prompt.substring(0, 50) + '...', error: e.message, success: false });
          }
        }
        const text = `Batch processing complete (${results.filter(r => r.success).length}/${results.length} successful):\n\n` +
          results.map((r, i) => `${i + 1}. ${r.prompt}\n${r.success ? r.response : `Error: ${r.error}`}`).join('\n\n---\n\n');
        return { content: [{ type: 'text', text }] };
      }

      // Benchmark
      case 'benchmark_model': {
        const model = args.model || (provider === 'ollama' ? config.ollama.defaultModel : config.lmstudio.defaultModel);
        const testPrompt = args.prompt || 'Explain quantum computing in one sentence.';
        const startTime = Date.now();

        const response = provider === 'ollama'
          ? await ollamaGenerate(testPrompt, model)
          : await lmstudioGenerate(testPrompt, model);

        const endTime = Date.now();
        const duration = endTime - startTime;
        const tokensEstimate = response.split(/\s+/).length * 1.3; // rough estimate
        const tokensPerSec = (tokensEstimate / (duration / 1000)).toFixed(2);

        const text = [
          `Benchmark Results for ${model} (${provider}):`,
          `Duration: ${duration}ms`,
          `Estimated tokens/sec: ${tokensPerSec}`,
          `Response length: ${response.length} characters`,
          ``,
          `Test prompt: "${testPrompt}"`,
          `Response: ${response}`,
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      }

      // RAG Enhancement
      case 'add_to_knowledge_base': {
        const model = args.model || (provider === 'ollama' ? config.ollama.defaultModel : config.lmstudio.defaultModel);
        const embedding = provider === 'ollama'
          ? await advancedApi.ollamaGenerateEmbeddings(args.content, model, config.ollama.baseUrl, config.ollama.timeout)
          : await advancedApi.lmstudioGenerateEmbeddings(args.content, model, config.lmstudio.baseUrl, config.lmstudio.timeout);

        const id = await storage.addToKnowledgeBase(args.title, args.content, embedding, { tags: args.tags || [] });
        return { content: [{ type: 'text', text: `Added to knowledge base with ID: ${id}` }] };
      }

      case 'semantic_search': {
        const model = args.model || (provider === 'ollama' ? config.ollama.defaultModel : config.lmstudio.defaultModel);
        const queryEmbedding = provider === 'ollama'
          ? await advancedApi.ollamaGenerateEmbeddings(args.query, model, config.ollama.baseUrl, config.ollama.timeout)
          : await advancedApi.lmstudioGenerateEmbeddings(args.query, model, config.lmstudio.baseUrl, config.lmstudio.timeout);

        const results = await storage.searchKnowledgeBase(queryEmbedding, args.top_k || 5);
        const text = results.length > 0
          ? `Found ${results.length} results:\n\n` + results.map((r, i) => `${i + 1}. **${r.title}** (similarity: ${(r.similarity * 100).toFixed(1)}%)\n${r.content}\n`).join('\n---\n\n')
          : 'No results found';
        return { content: [{ type: 'text', text }] };
      }

      case 'list_knowledge_base': {
        const entries = await storage.listKnowledgeBase();
        const text = entries.length > 0
          ? `Knowledge base (${entries.length} entries):\n${entries.map(e => `- ${e.title} (${e.addedAt})`).join('\n')}`
          : 'Knowledge base is empty';
        return { content: [{ type: 'text', text }] };
      }

      // Context Management
      case 'summarize_context': {
        const prompt = `Summarize the following text${args.max_length ? ` in about ${args.max_length} words` : ''}:\n\n${args.text}`;
        const summary = provider === 'ollama'
          ? await ollamaGenerate(prompt)
          : await lmstudioGenerate(prompt);
        return { content: [{ type: 'text', text: summary }] };
      }

      case 'extract_key_points': {
        const prompt = `Extract ${args.max_points || 5} key points from the following text as bullet points:\n\n${args.text}`;
        const keyPoints = provider === 'ollama'
          ? await ollamaGenerate(prompt)
          : await lmstudioGenerate(prompt);
        return { content: [{ type: 'text', text: keyPoints }] };
      }

      // Code Tools
      case 'code_review': {
        const langHint = args.language ? ` (${args.language})` : '';
        const prompt = `Perform a code review of the following code${langHint}. Analyze for:\n- Bugs and potential issues\n- Best practices\n- Performance improvements\n- Security concerns\n- Code style\n\nCode:\n\`\`\`\n${args.code}\n\`\`\``;
        const review = provider === 'ollama'
          ? await ollamaGenerate(prompt)
          : await lmstudioGenerate(prompt);
        return { content: [{ type: 'text', text: review }] };
      }

      case 'generate_tests': {
        const framework = args.framework || 'generic';
        const prompt = `Generate comprehensive unit tests for the following code using ${framework}:\n\n\`\`\`\n${args.code}\n\`\`\`\n\nInclude:\n- Test cases for normal operation\n- Edge cases\n- Error handling\n- Mock data if needed`;
        const tests = provider === 'ollama'
          ? await ollamaGenerate(prompt)
          : await lmstudioGenerate(prompt);
        return { content: [{ type: 'text', text: tests }] };
      }

      case 'explain_code': {
        const level = args.detail_level || 'detailed';
        const prompt = level === 'brief'
          ? `Briefly explain what this code does:\n\n\`\`\`\n${args.code}\n\`\`\``
          : `Provide a detailed explanation of this code, including:\n- What it does\n- How it works\n- Key algorithms or patterns used\n- Input/output\n\n\`\`\`\n${args.code}\n\`\`\``;
        const explanation = provider === 'ollama'
          ? await ollamaGenerate(prompt)
          : await lmstudioGenerate(prompt);
        return { content: [{ type: 'text', text: explanation }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('MCP Local LLM Server running on stdio');
  console.error(`Active Provider: ${config.activeProvider === 'ollama' ? 'Ollama' : 'LM Studio'}`);
  console.error(`Ollama URL: ${config.ollama.baseUrl}`);
  console.error(`LM Studio URL: ${config.lmstudio.baseUrl}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
