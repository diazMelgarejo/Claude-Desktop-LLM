#!/usr/bin/env node
/**
 * MCP Server for Local LLM Integration
 * Connects Claude Desktop to Ollama or LM Studio as external agents
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import {
  queryLocalLLM,
  delegateToAgent,
  chatWithLLM,
  listModels,
  switchProvider,
  getActiveProviderName,
  checkProvidersHealth,
} from './tools/agent-tools.js';

// Zod schemas are for internal validation
const QuerySchema = z.object({
  prompt: z.string().describe('The prompt to send to the local LLM'),
  model: z.string().optional().describe('Specific model to use (optional)'),
  provider: z.enum(['ollama', 'lmstudio']).optional().describe('Provider to use (optional)'),
});

const AgentSchema = z.object({
  task: z.string().describe('The task to delegate to the local LLM agent'),
  system_prompt: z.string().optional().describe('Custom system prompt for the agent'),
  model: z.string().optional().describe('Specific model to use (optional)'),
  provider: z.enum(['ollama', 'lmstudio']).optional().describe('Provider to use (optional)'),
});

const ChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })).describe('Array of chat messages'),
  model: z.string().optional().describe('Specific model to use (optional)'),
  provider: z.enum(['ollama', 'lmstudio']).optional().describe('Provider to use (optional)'),
});

const ListModelsSchema = z.object({
  provider: z.enum(['ollama', 'lmstudio']).optional().describe('Provider to list models from'),
});

const SwitchProviderSchema = z.object({
  provider: z.enum(['ollama', 'lmstudio']).describe('Provider to switch to'),
});

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
const tools: ToolSchema[] = [
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
          description: 'Provider to use (optional)',
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
          description: 'Custom system prompt for the agent',
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
          description: 'Provider to list models from',
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
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'local_llm_query': {
        const parsed = QuerySchema.parse(args);
        const result = await queryLocalLLM(parsed.prompt, parsed.model, parsed.provider);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'local_llm_agent': {
        const parsed = AgentSchema.parse(args);
        const result = await delegateToAgent(
          parsed.task,
          parsed.system_prompt,
          parsed.model,
          parsed.provider
        );
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'local_llm_chat': {
        const parsed = ChatSchema.parse(args);
        const result = await chatWithLLM(parsed.messages, parsed.model, parsed.provider);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'list_local_models': {
        const parsed = ListModelsSchema.parse(args);
        const models = await listModels(parsed.provider);
        return {
          content: [{
            type: 'text',
            text: models.length > 0
              ? `Available models:\n${models.map(m => `- ${m}`).join('\n')}`
              : 'No models found. Make sure Ollama or LM Studio is running with models loaded.',
          }],
        };
      }

      case 'switch_llm_provider': {
        const parsed = SwitchProviderSchema.parse(args);
        const result = switchProvider(parsed.provider);
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'check_llm_status': {
        const health = await checkProvidersHealth();
        const status = [
          `Active Provider: ${getActiveProviderName()}`,
          '',
          `Ollama: ${health.ollama ? '✓ Connected' : '✗ Not available'}`,
          `LM Studio: ${health.lmstudio ? '✓ Connected' : '✗ Not available'}`,
        ].join('\n');
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

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Local LLM Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
