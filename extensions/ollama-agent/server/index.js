#!/usr/bin/env node
/**
 * Ollama Agent - MCP Server
 * Connects Claude Desktop to Ollama as an external AI agent
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Configuration from environment
const config = {
  baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  defaultModel: process.env.OLLAMA_MODEL || 'llama3.2',
  timeout: parseInt(process.env.TIMEOUT || '120000', 10),
};

// Ollama API functions
async function listModels() {
  const response = await fetch(`${config.baseUrl}/api/tags`, {
    method: 'GET',
    signal: AbortSignal.timeout(config.timeout),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.models || [];
}

async function generate(prompt, model) {
  const selectedModel = model || config.defaultModel;

  const response = await fetch(`${config.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      prompt: prompt,
      stream: false,
    }),
    signal: AbortSignal.timeout(config.timeout),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.response;
}

async function chat(messages, model) {
  const selectedModel = model || config.defaultModel;

  const response = await fetch(`${config.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      messages: messages,
      stream: false,
    }),
    signal: AbortSignal.timeout(config.timeout),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.message.content;
}

async function healthCheck() {
  try {
    const response = await fetch(`${config.baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Create MCP server
const server = new Server(
  {
    name: 'ollama-agent',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
const tools = [
  {
    name: 'ollama_query',
    description: 'Send a simple prompt to Ollama and get a response. Use for quick questions or simple tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt to send to Ollama',
        },
        model: {
          type: 'string',
          description: 'Specific model to use (optional, uses default if not specified)',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'ollama_agent',
    description: 'Delegate a complex task to Ollama as an external agent. The agent will work on the task with a system prompt context. Use for tasks requiring detailed analysis or multi-step reasoning.',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The task to delegate to Ollama',
        },
        system_prompt: {
          type: 'string',
          description: 'Custom system prompt for the agent',
        },
        model: {
          type: 'string',
          description: 'Specific model to use (optional)',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'ollama_chat',
    description: 'Have a multi-turn conversation with Ollama. Pass an array of messages with roles for context-aware responses.',
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
      },
      required: ['messages'],
    },
  },
  {
    name: 'ollama_list_models',
    description: 'List all available models in Ollama.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'ollama_status',
    description: 'Check if Ollama is running and accessible.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// Handle list tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'ollama_query': {
        const result = await generate(args.prompt, args.model);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'ollama_agent': {
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
        const result = await chat(messages, args.model);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'ollama_chat': {
        const result = await chat(args.messages, args.model);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'ollama_list_models': {
        const models = await listModels();
        const modelNames = models.map(m => m.name);
        return {
          content: [{
            type: 'text',
            text: modelNames.length > 0
              ? `Available Ollama models:\n${modelNames.map(m => `- ${m}`).join('\n')}`
              : 'No models found. Pull a model with: ollama pull llama3.2',
          }],
        };
      }

      case 'ollama_status': {
        const isHealthy = await healthCheck();
        const status = isHealthy
          ? `✓ Ollama is running\n  URL: ${config.baseUrl}\n  Default model: ${config.defaultModel}`
          : `✗ Ollama is not accessible at ${config.baseUrl}\n  Make sure Ollama is running`;
        return {
          content: [{ type: 'text', text: status }],
        };
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

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Ollama Agent MCP Server running');
  console.error(`  URL: ${config.baseUrl}`);
  console.error(`  Model: ${config.defaultModel}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
