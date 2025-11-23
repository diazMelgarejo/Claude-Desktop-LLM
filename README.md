# MCP Local LLM

MCP server to connect Claude Desktop to local LLMs (Ollama, LM Studio) as external agents.

## Features

- Connect Claude Desktop to **Ollama** or **LM Studio** running locally
- Use local LLMs as external agents for delegated tasks
- Switch between providers dynamically
- Support for multiple models
- Simple query, chat, and agent delegation tools

## Prerequisites

- Node.js 18+
- One of the following local LLM providers:
  - [Ollama](https://ollama.ai/) running on `http://localhost:11434`
  - [LM Studio](https://lmstudio.ai/) running on `http://localhost:1234`

## Installation

```bash
# Clone the repository
git clone https://github.com/yayoboy/Claude-Desktop-LLM.git
cd Claude-Desktop-LLM

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration for Claude Desktop

Add the server to your Claude Desktop configuration file:

### macOS
`~/Library/Application Support/Claude/claude_desktop_config.json`

### Windows
`%APPDATA%\Claude\claude_desktop_config.json`

### Linux
`~/.config/Claude/claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "local-llm": {
      "command": "node",
      "args": ["/path/to/Claude-Desktop-LLM/dist/index.js"],
      "env": {
        "OLLAMA_URL": "http://localhost:11434",
        "OLLAMA_MODEL": "llama3.2",
        "LMSTUDIO_URL": "http://localhost:1234",
        "LMSTUDIO_MODEL": "default",
        "DEFAULT_PROVIDER": "ollama"
      }
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `llama3.2` | Default Ollama model |
| `LMSTUDIO_URL` | `http://localhost:1234` | LM Studio API endpoint |
| `LMSTUDIO_MODEL` | `default` | Default LM Studio model |
| `DEFAULT_PROVIDER` | `ollama` | Default provider (`ollama` or `lmstudio`) |

## Available Tools

### `local_llm_query`
Send a simple prompt to the local LLM and get a response.

```
Use local_llm_query to ask: "What is the capital of France?"
```

### `local_llm_agent`
Delegate a complex task to the local LLM agent with optional system prompt.

```
Use local_llm_agent to analyze this code and suggest improvements: [code here]
```

### `local_llm_chat`
Have a multi-turn conversation with message history.

### `list_local_models`
List all available models from the local LLM provider.

### `switch_llm_provider`
Switch between Ollama and LM Studio.

### `check_llm_status`
Check the health status of both providers.

## Usage Examples

Once configured, you can use these tools in Claude Desktop:

1. **Simple query:**
   > "Use the local LLM to explain quantum computing"

2. **Delegate task:**
   > "Ask the local LLM agent to write a Python function that sorts a list"

3. **Check status:**
   > "Check the status of local LLM providers"

4. **Switch provider:**
   > "Switch to LM Studio as the local LLM provider"

5. **List models:**
   > "List available models in Ollama"

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Start the built server
npm start
```

## Troubleshooting

### "Connection refused" errors
- Make sure Ollama or LM Studio is running
- Verify the correct port (Ollama: 11434, LM Studio: 1234)

### "Model not found" errors
- List available models with `list_local_models`
- Pull the model in Ollama: `ollama pull llama3.2`
- Load the model in LM Studio

### Timeout errors
- Large models may need more time; the default timeout is 2 minutes
- Consider using a smaller model for faster responses

## License

MIT
