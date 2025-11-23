# Claude Desktop LLM Extensions

MCP extensions (.mcpb) to connect Claude Desktop to local LLMs as external agents.

## Available Extensions

### Ollama Agent
Connect to [Ollama](https://ollama.ai/) running locally.

### LM Studio Agent
Connect to [LM Studio](https://lmstudio.ai/) running locally.

## Installation

### Method 1: Install Pre-built Extensions

1. Download the `.mcpb` files from [Releases](../../releases)
2. Open **Claude Desktop**
3. Go to **Settings → Extensions**
4. Click **"Advanced settings"** → **"Install Extension..."**
5. Select the `.mcpb` file
6. **Configure** the extension with your settings:
   - Server URL
   - Default model
   - Timeout

### Method 2: Build From Source

```bash
# Clone the repository
git clone https://github.com/yayoboy/Claude-Desktop-LLM.git
cd Claude-Desktop-LLM

# Install mcpb CLI (optional, for proper packaging)
npm install -g @anthropic-ai/mcpb

# Build extensions
chmod +x scripts/build-extensions.sh
./scripts/build-extensions.sh
```

Extensions will be created in `dist/`:
- `ollama-agent.mcpb`
- `lmstudio-agent.mcpb`

## Configuration

After installing an extension, click **"Configure"** in Claude Desktop to set:

| Setting | Description | Default |
|---------|-------------|---------|
| Server URL | LLM server endpoint | `http://localhost:11434` (Ollama) or `http://localhost:1234` (LM Studio) |
| Default Model | Model to use by default | `llama3.2` (Ollama) or `default` (LM Studio) |
| Timeout | Request timeout in ms | `120000` |

## Available Tools

### Ollama Agent Tools

| Tool | Description |
|------|-------------|
| `ollama_query` | Send a prompt and get a response |
| `ollama_agent` | Delegate complex tasks with system prompt |
| `ollama_chat` | Multi-turn conversation |
| `ollama_list_models` | List available models |
| `ollama_status` | Check connection status |

### LM Studio Agent Tools

| Tool | Description |
|------|-------------|
| `lmstudio_query` | Send a prompt and get a response |
| `lmstudio_agent` | Delegate complex tasks with system prompt |
| `lmstudio_chat` | Multi-turn conversation |
| `lmstudio_list_models` | List available models |
| `lmstudio_status` | Check connection status |

## Usage Examples

Once installed, ask Claude:

1. **Simple query:**
   > "Ask Ollama to explain quantum computing"

2. **Delegate task:**
   > "Use the Ollama agent to review this code and suggest improvements"

3. **Check status:**
   > "Check if Ollama is running"

4. **List models:**
   > "List available Ollama models"

## Prerequisites

- **Ollama**: Download from [ollama.ai](https://ollama.ai/) and run `ollama serve`
- **LM Studio**: Download from [lmstudio.ai](https://lmstudio.ai/) and enable Local Server

## Project Structure

```
Claude-Desktop-LLM/
├── extensions/
│   ├── ollama-agent/
│   │   ├── manifest.json      # Extension metadata & config
│   │   ├── package.json
│   │   └── server/
│   │       └── index.js       # MCP server
│   └── lmstudio-agent/
│       ├── manifest.json
│       ├── package.json
│       └── server/
│           └── index.js
├── scripts/
│   └── build-extensions.sh    # Build script
└── dist/                      # Built .mcpb files
```

## Troubleshooting

### "Connection refused" errors
- Make sure Ollama/LM Studio is running
- Verify the correct URL in extension settings

### "Model not found" errors
- Ollama: Pull the model with `ollama pull llama3.2`
- LM Studio: Load a model in the application

### Timeout errors
- Increase the timeout in extension settings
- Consider using a smaller/faster model

## License

MIT
