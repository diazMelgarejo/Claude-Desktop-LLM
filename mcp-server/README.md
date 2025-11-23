# MCP Local LLM Server (CLI Version)

This is a standalone MCP server that connects Claude Code CLI to local LLM providers (Ollama and LM Studio).

## Installation

### Option 1: Global Installation (Recommended)

Install the MCP server globally via npm:

```bash
cd mcp-server
npm install -g .
```

This installs the `mcp-local-llm` command globally.

### Option 2: Local Installation

Install dependencies locally:

```bash
cd mcp-server
npm install
```

## Configuration for Claude Code CLI

Add this configuration to your Claude Code CLI MCP settings file (typically `~/.config/claude/mcp_config.json` or similar):

### If Installed Globally

```json
{
  "mcpServers": {
    "local-llm": {
      "command": "mcp-local-llm",
      "env": {
        "OLLAMA_URL": "http://localhost:11434",
        "OLLAMA_MODEL": "llama3.2",
        "ACTIVE_PROVIDER": "ollama"
      }
    }
  }
}
```

### If Installed Locally

```json
{
  "mcpServers": {
    "local-llm": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/index.js"],
      "env": {
        "OLLAMA_URL": "http://localhost:11434",
        "OLLAMA_MODEL": "llama3.2",
        "ACTIVE_PROVIDER": "ollama"
      }
    }
  }
}
```

**Note**: Claude Code CLI requires manual configuration of the MCP settings file. There is no automatic configuration mechanism.

## Environment Variables

- `OLLAMA_URL`: Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL`: Default Ollama model (default: `llama3.2`)
- `LMSTUDIO_URL`: LM Studio server URL (default: `http://localhost:1234`)
- `LMSTUDIO_MODEL`: Default LM Studio model (default: `default`)
- `ACTIVE_PROVIDER`: Initial active provider - `ollama` or `lmstudio` (default: `ollama`)
- `TIMEOUT`: Request timeout in milliseconds (default: `120000`)

## Available Tools

### 1. `local_llm_query`
Send a simple prompt to the local LLM.

**Parameters:**
- `prompt` (required): The prompt to send
- `model` (optional): Specific model to use
- `provider` (optional): `ollama` or `lmstudio` (defaults to active provider)

### 2. `local_llm_agent`
Delegate a complex task to the LLM agent with system prompt context.

**Parameters:**
- `task` (required): The task to delegate
- `system_prompt` (optional): Custom system prompt
- `model` (optional): Specific model to use
- `provider` (optional): `ollama` or `lmstudio`

### 3. `local_llm_chat`
Multi-turn conversation with message history.

**Parameters:**
- `messages` (required): Array of `{role, content}` objects
- `model` (optional): Specific model to use
- `provider` (optional): `ollama` or `lmstudio`

### 4. `list_local_models`
List available models from a provider.

**Parameters:**
- `provider` (optional): `ollama` or `lmstudio` (defaults to active provider)

### 5. `switch_llm_provider`
Switch between Ollama and LM Studio.

**Parameters:**
- `provider` (required): `ollama` or `lmstudio`

### 6. `check_llm_status`
Check health status of both providers and show active provider.

## Usage Examples

Once configured in Claude Code CLI, you can use natural language to invoke these tools:

- "Use the local LLM to summarize this code"
- "Ask Ollama to explain this function"
- "Switch to LM Studio and list available models"
- "Check the status of local LLM providers"

## Requirements

- Node.js 18 or higher
- Ollama or LM Studio running locally
- Claude Code CLI with MCP support

## Troubleshooting

1. **Server not starting**: Check that Node.js is installed and the path in the config is correct
2. **Connection errors**: Verify Ollama/LM Studio is running and URLs are correct
3. **No models found**: Make sure models are loaded in your LLM provider

## License

MIT
