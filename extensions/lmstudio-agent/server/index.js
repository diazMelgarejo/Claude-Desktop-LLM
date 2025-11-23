#!/usr/bin/env node
/**
 * LM Studio Agent - MCP Server
 * Connects Claude Desktop to LM Studio as an external AI agent
 * Uses OpenAI-compatible API
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Configuration from environment
const config = {
  baseUrl: process.env.LMSTUDIO_URL || 'http://localhost:1234',
  defaultModel: process.env.LMSTUDIO_MODEL || 'default',
  timeout: parseInt(process.env.TIMEOUT || '120000', 10),
};

// LM Studio API functions (OpenAI-compatible)
async function listModels() {
  const response = await fetch(`${config.baseUrl}/v1/models`, {
    method: 'GET',
    signal: AbortSignal.timeout(config.timeout),
  });

  if (!response.ok) {
    throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || [];
}

async function generate(prompt, model) {
  const selectedModel = model || config.defaultModel;

  const response = await fetch(`${config.baseUrl}/v1/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      prompt: prompt,
      max_tokens: 2048,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(config.timeout),
  });

  if (!response.ok) {
    throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.text || '';
}

async function chat(messages, model) {
  const selectedModel = model || config.defaultModel;

  const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      messages: messages,
      max_tokens: 2048,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(config.timeout),
  });

  if (!response.ok) {
    throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message.content || '';
}

async function healthCheck() {
  try {
    const response = await fetch(`${config.baseUrl}/v1/models`, {
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
    name: 'lmstudio-agent',
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
    name: 'lmstudio_query',
    description: 'Send a simple prompt to LM Studio and get a response. Use for quick questions or simple tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt to send to LM Studio',
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
    name: 'lmstudio_agent',
    description: 'Delegate a complex task to LM Studio as an external agent. The agent will work on the task with a system prompt context. Use for tasks requiring detailed analysis or multi-step reasoning.',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The task to delegate to LM Studio',
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
    name: 'lmstudio_chat',
    description: 'Have a multi-turn conversation with LM Studio. Pass an array of messages with roles for context-aware responses.',
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
    name: 'lmstudio_list_models',
    description: 'List all available models in LM Studio.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'lmstudio_status',
    description: 'Check if LM Studio is running and accessible.',
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
      case 'lmstudio_query': {
        const result = await generate(args.prompt, args.model);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'lmstudio_agent': {
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

      case 'lmstudio_chat': {
        const result = await chat(args.messages, args.model);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'lmstudio_list_models': {
        const models = await listModels();
        const modelNames = models.map(m => m.id);
        return {
          content: [{
            type: 'text',
            text: modelNames.length > 0
              ? `Available LM Studio models:\n${modelNames.map(m => `- ${m}`).join('\n')}`
              : 'No models found. Load a model in LM Studio first.',
          }],
        };
      }

      case 'lmstudio_status': {
        const isHealthy = await healthCheck();
        const status = isHealthy
          ? `✓ LM Studio is running\n  URL: ${config.baseUrl}\n  Default model: ${config.defaultModel}`
          : `✗ LM Studio is not accessible at ${config.baseUrl}\n  Make sure LM Studio is running with Local Server enabled`;
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

  console.error('LM Studio Agent MCP Server running');
  console.error(`  URL: ${config.baseUrl}`);
  console.error(`  Model: ${config.defaultModel}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
