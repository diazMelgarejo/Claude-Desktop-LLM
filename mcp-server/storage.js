import { homedir } from 'os';
import { join } from 'path';
import { mkdir, readFile, writeFile, readdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';

// Base storage directory
const STORAGE_DIR = join(homedir(), '.mcp-local-llm');
const CONVERSATIONS_DIR = join(STORAGE_DIR, 'conversations');
const TEMPLATES_DIR = join(STORAGE_DIR, 'templates');
const PRESETS_DIR = join(STORAGE_DIR, 'presets');

// Ensure directories exist
async function ensureDirectories() {
    for (const dir of [STORAGE_DIR, CONVERSATIONS_DIR, TEMPLATES_DIR, PRESETS_DIR]) {
        if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true });
        }
    }
}

// Conversation storage
export async function saveConversation(name, messages, metadata = {}) {
    await ensureDirectories();
    const data = {
        name,
        messages,
        metadata: {
            ...metadata,
            savedAt: new Date().toISOString(),
        },
    };
    const filepath = join(CONVERSATIONS_DIR, `${name}.json`);
    await writeFile(filepath, JSON.stringify(data, null, 2));
    return filepath;
}

export async function loadConversation(name) {
    const filepath = join(CONVERSATIONS_DIR, `${name}.json`);
    const content = await readFile(filepath, 'utf-8');
    return JSON.parse(content);
}

export async function listConversations() {
    await ensureDirectories();
    const files = await readdir(CONVERSATIONS_DIR);
    const conversations = [];

    for (const file of files) {
        if (file.endsWith('.json')) {
            try {
                const content = await readFile(join(CONVERSATIONS_DIR, file), 'utf-8');
                const data = JSON.parse(content);
                conversations.push({
                    name: data.name,
                    messageCount: data.messages.length,
                    savedAt: data.metadata.savedAt,
                    provider: data.metadata.provider,
                    model: data.metadata.model,
                });
            } catch (e) {
                // Skip invalid files
            }
        }
    }

    return conversations;
}

export async function deleteConversation(name) {
    const filepath = join(CONVERSATIONS_DIR, `${name}.json`);
    await unlink(filepath);
}

export async function exportConversation(name, format = 'json') {
    const conversation = await loadConversation(name);

    if (format === 'json') {
        return JSON.stringify(conversation, null, 2);
    } else if (format === 'markdown') {
        let md = `# ${conversation.name}\n\n`;
        md += `**Saved**: ${conversation.metadata.savedAt}\n`;
        md += `**Provider**: ${conversation.metadata.provider || 'Unknown'}\n`;
        md += `**Model**: ${conversation.metadata.model || 'Unknown'}\n\n`;
        md += `---\n\n`;

        for (const msg of conversation.messages) {
            md += `### ${msg.role.toUpperCase()}\n\n`;
            md += `${msg.content}\n\n`;
        }

        return md;
    }

    throw new Error(`Unsupported format: ${format}`);
}

// Template storage
export async function saveTemplate(name, template, description = '') {
    await ensureDirectories();
    const data = {
        name,
        template,
        description,
        createdAt: new Date().toISOString(),
    };
    const filepath = join(TEMPLATES_DIR, `${name}.json`);
    await writeFile(filepath, JSON.stringify(data, null, 2));
    return filepath;
}

export async function loadTemplate(name) {
    const filepath = join(TEMPLATES_DIR, `${name}.json`);
    const content = await readFile(filepath, 'utf-8');
    return JSON.parse(content);
}

export async function listTemplates() {
    await ensureDirectories();
    const files = await readdir(TEMPLATES_DIR);
    const templates = [];

    for (const file of files) {
        if (file.endsWith('.json')) {
            try {
                const content = await readFile(join(TEMPLATES_DIR, file), 'utf-8');
                const data = JSON.parse(content);
                templates.push({
                    name: data.name,
                    description: data.description,
                    createdAt: data.createdAt,
                });
            } catch (e) {
                // Skip invalid files
            }
        }
    }

    return templates;
}

export async function deleteTemplate(name) {
    const filepath = join(TEMPLATES_DIR, `${name}.json`);
    await unlink(filepath);
}

// Preset storage
export async function savePreset(name, config) {
    await ensureDirectories();
    const data = {
        name,
        config,
        createdAt: new Date().toISOString(),
    };
    const filepath = join(PRESETS_DIR, `${name}.json`);
    await writeFile(filepath, JSON.stringify(data, null, 2));
    return filepath;
}

export async function loadPreset(name) {
    const filepath = join(PRESETS_DIR, `${name}.json`);
    const content = await readFile(filepath, 'utf-8');
    return JSON.parse(content);
}

export async function listPresets() {
    await ensureDirectories();
    const files = await readdir(PRESETS_DIR);
    const presets = [];

    for (const file of files) {
        if (file.endsWith('.json')) {
            try {
                const content = await readFile(join(PRESETS_DIR, file), 'utf-8');
                const data = JSON.parse(content);
                presets.push({
                    name: data.name,
                    createdAt: data.createdAt,
                    config: data.config,
                });
            } catch (e) {
                // Skip invalid files
            }
        }
    }

    return presets;
}

// Knowledge Base storage
const KNOWLEDGE_BASE_DIR = join(STORAGE_DIR, 'knowledge-base');

export async function addToKnowledgeBase(title, content, embedding, metadata = {}) {
    await ensureDirectories();
    if (!existsSync(KNOWLEDGE_BASE_DIR)) {
        await mkdir(KNOWLEDGE_BASE_DIR, { recursive: true });
    }

    const id = Date.now().toString() + '-' + Math.random().toString(36).substring(7);
    const data = {
        id,
        title,
        content,
        embedding,
        metadata: {
            ...metadata,
            addedAt: new Date().toISOString(),
        },
    };

    const filepath = join(KNOWLEDGE_BASE_DIR, `${id}.json`);
    await writeFile(filepath, JSON.stringify(data, null, 2));
    return id;
}

export async function listKnowledgeBase() {
    if (!existsSync(KNOWLEDGE_BASE_DIR)) {
        return [];
    }

    const files = await readdir(KNOWLEDGE_BASE_DIR);
    const entries = [];

    for (const file of files) {
        if (file.endsWith('.json')) {
            try {
                const content = await readFile(join(KNOWLEDGE_BASE_DIR, file), 'utf-8');
                const data = JSON.parse(content);
                entries.push({
                    id: data.id,
                    title: data.title,
                    contentPreview: data.content.substring(0, 100) + '...',
                    addedAt: data.metadata.addedAt,
                    tags: data.metadata.tags || [],
                });
            } catch (e) {
                // Skip invalid files
            }
        }
    }

    return entries;
}

export async function searchKnowledgeBase(queryEmbedding, topK = 5) {
    if (!existsSync(KNOWLEDGE_BASE_DIR)) {
        return [];
    }

    const files = await readdir(KNOWLEDGE_BASE_DIR);
    const results = [];

    for (const file of files) {
        if (file.endsWith('.json')) {
            try {
                const content = await readFile(join(KNOWLEDGE_BASE_DIR, file), 'utf-8');
                const data = JSON.parse(content);

                // Cosine similarity
                const similarity = cosineSimilarity(queryEmbedding, data.embedding);
                results.push({
                    id: data.id,
                    title: data.title,
                    content: data.content,
                    similarity,
                    metadata: data.metadata,
                });
            } catch (e) {
                // Skip invalid files
            }
        }
    }

    // Sort by similarity and return top K
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
}

function cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
