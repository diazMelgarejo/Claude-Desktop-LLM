# Claude Desktop LLM Extensions

MCP extensions (.mcpb) to connect Claude Desktop to local LLMs as external agents.

**Also includes**: Standalone MCP server for Claude Code CLI in the `mcp-server/` directory.

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

#### Core Tools
| Tool | Description |
|------|-------------|
| `ollama_query` | Send a prompt and get a response |
| `ollama_agent` | Delegate complex tasks with system prompt |
| `ollama_chat` | Multi-turn conversation  |
| `ollama_list_models` | List available models |
| `ollama_status` | Check connection status |

#### Model Management (NEW)
| Tool | Description |
|------|-------------|
| `pull_model` | Download models from Ollama |
| `delete_model` | Remove models to free space |
| `model_info` | Get detailed model information |
| `list_running_models` | Show models in memory |

#### Conversation Management (NEW)
| Tool | Description |
|------|-------------|
| `save_conversation` | Save conversations for later |
| `load_conversation` | Load saved conversations |
| `list_conversations` | List all saved conversations |
| `export_conversation` | Export to JSON/Markdown |

#### Prompt Templates (NEW)
| Tool | Description |
|------|-------------|
| `save_prompt_template` | Save reusable templates |
| `load_prompt_template` | Load templates with variables |
| `list_prompt_templates` | List all templates |

#### Advanced Features (NEW)
| Tool | Description |
|------|-------------|
| `generate_embeddings` | Generate vector embeddings for RAG |
| `compare_responses` | Compare multiple model responses |
| `set_model_parameters` | Custom generation parameters |

#### RAG Enhancement (NEW)
| Tool | Description |
|------|-------------|
| `add_to_knowledge_base` | Store documents with embeddings |
| `semantic_search` | Vector similarity search |
| `list_knowledge_base` | Browse knowledge base |

#### Context Management (NEW)
| Tool | Description |
|------|-------------|
| `summarize_context` | Condense long conversations |
| `extract_key_points` | Bullet-point extraction |

#### Code Tools (NEW)
| Tool | Description |
|------|-------------|
| `code_review` | Automated code analysis |
| `generate_tests` | Unit test generation |
| `explain_code` | Detailed explanations |

### LM Studio Agent Tools

#### Core Tools
| Tool | Description |
|------|-------------|
| `lmstudio_query` | Send a prompt and get a response |
| `lmstudio_agent` | Delegate complex tasks with system prompt |
| `lmstudio_chat` | Multi-turn conversation |
| `lmstudio_list_models` | List available models |
| `lmstudio_status` | Check connection status |

#### Extended Tools (NEW)
| Tool | Description |
|------|-------------|
| `model_info` | Get model information (limited) |
| All conversation management tools | Full support |
| All template tools | Full support |
| `generate_embeddings` | Generate embeddings |
| `compare_responses` | Compare model responses |
| `set_model_parameters` | Custom parameters |

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

## For Claude Code CLI

A standalone MCP server is available in the `mcp-server/` directory for use with Claude Code CLI.

### Quick Setup

**Option 1: Global Installation (Recommended)**

```bash
cd mcp-server
npm install -g .
```

Then configure Claude Code CLI (e.g., `~/.config/claude/mcp_config.json`):

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

**Option 2: Local Installation**

```bash
cd mcp-server
npm install
```

Configure with absolute path:
```json
{
  "mcpServers": {
    "local-llm": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/index.js"],
      "env": {
        "ACTIVE_PROVIDER": "ollama"
      }
    }
  }
}
```

> **Note**: Claude Code CLI richiede la configurazione manuale del file JSON. Non esiste un meccanismo di auto-configurazione.

See [mcp-server/README.md](mcp-server/README.md) for detailed documentation.

### Available Tools (27 total)

**Model Management** (4): pull_model, delete_model, model_info, list_running_models  
**Conversations** (4): save_conversation, load_conversation, list_conversations, export_conversation  
**Templates** (3): save_prompt_template, load_prompt_template, list_prompt_templates  
**Advanced** (3): generate_embeddings, compare_responses, set_model_parameters  
**Presets** (3): save_provider_preset, load_provider_preset, list_provider_presets  
**Performance** (2): batch_process, benchmark_model  
**RAG Enhancement** (3): add_to_knowledge_base, semantic_search, list_knowledge_base  
**Context Management** (2): summarize_context, extract_key_points  
**Code Tools** (3): code_review, generate_tests, explain_code

Plus all core tools (query, agent, chat, list models, switch provider, status).

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
├── mcp-server/                # Standalone MCP server for CLI
│   ├── index.js              # Main server file
│   ├── package.json
│   ├── README.md
│   └── config.example.json
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
