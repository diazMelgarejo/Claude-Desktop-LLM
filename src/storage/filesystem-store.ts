/**
 * Canonical, hardened filesystem storage. Replaces the identical
 * mcp-server/storage.js copies formerly duplicated across mcp-server/ and
 * both extensions' server/ directories.
 *
 * Fixes the P0 path-traversal vulnerability: the old code joined a
 * tool-controlled `name` argument directly into a filesystem path
 * (`join(CONVERSATIONS_DIR, `${name}.json`)`), so a name containing `../`
 * could escape the intended storage directory.
 *
 * Validation matches the canonical Phase-1 patch spec (2026-08-29 closure):
 * permits ordinary names including spaces, Unicode, and internal dots;
 * rejects path separators, control characters, `.`/`..`, trailing dot/space,
 * and Windows-reserved basenames; caps length; then verifies the resolved
 * parent directory as defense-in-depth against any remaining edge case.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: "invalid_name" | "not_found" | "escape_attempt",
  ) {
    super(message);
  }
}

const MAX_NAME_LENGTH = 128;
const CONTROL_CHAR_MAX_CODE = 0x1f;
const FORBIDDEN_PRINTABLE_CHARS = /[<>:"/\\|?*]/;
const RESERVED_WINDOWS_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

export function assertSafeName(name: string): string {
  if (!name || name.length === 0) {
    throw new StorageError("name must not be empty", "invalid_name");
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new StorageError(`name exceeds ${MAX_NAME_LENGTH} characters`, "invalid_name");
  }
  if (name === "." || name === "..") {
    throw new StorageError(`name must not be "." or ".."`, "invalid_name");
  }
  if (FORBIDDEN_PRINTABLE_CHARS.test(name)) {
    throw new StorageError(`name contains a forbidden character: ${JSON.stringify(name)}`, "invalid_name");
  }
  for (let i = 0; i < name.length; i++) {
    if (name.charCodeAt(i) <= CONTROL_CHAR_MAX_CODE) {
      throw new StorageError(`name contains a control character at index ${i}`, "invalid_name");
    }
  }
  if (name.endsWith(".") || name.endsWith(" ")) {
    throw new StorageError("name must not end with a dot or a space", "invalid_name");
  }
  const reservedStem = name.toLowerCase().split(".", 1)[0];
  if (RESERVED_WINDOWS_NAMES.has(reservedStem)) {
    throw new StorageError(`name ${JSON.stringify(name)} is a reserved Windows device name`, "invalid_name");
  }
  return name;
}

function safeJoin(baseDir: string, name: string): string {
  assertSafeName(name);
  const resolvedBase = resolve(baseDir);
  const filepath = resolve(join(resolvedBase, `${name}.json`));
  if (dirname(filepath) !== resolvedBase) {
    throw new StorageError(`resolved path escapes storage root: ${filepath}`, "escape_attempt");
  }
  return filepath;
}

export interface StorageDirs {
  root: string;
  conversations: string;
  templates: string;
  presets: string;
  knowledgeBase: string;
}

export function resolveStorageDirs(overrideRoot?: string): StorageDirs {
  const root = overrideRoot ?? process.env.MCP_LOCAL_LLM_STORAGE_DIR ?? join(homedir(), ".mcp-local-llm");
  return {
    root,
    conversations: join(root, "conversations"),
    templates: join(root, "templates"),
    presets: join(root, "presets"),
    knowledgeBase: join(root, "knowledge-base"),
  };
}

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    // 0o700: user-only permissions, per plan §4.1.
    await mkdir(dir, { recursive: true, mode: 0o700 });
  }
}

async function writeJson(filepath: string, data: unknown): Promise<void> {
  await writeFile(filepath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

async function readJson<T>(filepath: string): Promise<T> {
  try {
    const content = await readFile(filepath, "utf-8");
    return JSON.parse(content) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new StorageError(`not found: ${filepath}`, "not_found");
    }
    throw err;
  }
}

async function listJsonEntries<T>(dir: string): Promise<T[]> {
  await ensureDir(dir);
  const files = await readdir(dir);
  const entries: T[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      entries.push(await readJson<T>(join(dir, file)));
    } catch {
      // Skip unreadable/corrupt entries, matching prior behavior.
    }
  }
  return entries;
}

export interface ConversationRecord {
  name: string;
  messages: unknown[];
  metadata: { provider?: string; model?: string; savedAt: string };
}

export class FilesystemStore {
  private readonly dirs: StorageDirs;

  constructor(overrideRoot?: string) {
    this.dirs = resolveStorageDirs(overrideRoot);
  }

  async saveConversation(
    name: string,
    messages: unknown[],
    metadata: { provider?: string; model?: string } = {},
  ): Promise<string> {
    await ensureDir(this.dirs.conversations);
    const filepath = safeJoin(this.dirs.conversations, name);
    const record: ConversationRecord = { name, messages, metadata: { ...metadata, savedAt: new Date().toISOString() } };
    await writeJson(filepath, record);
    return name;
  }

  async loadConversation(name: string): Promise<ConversationRecord> {
    return readJson<ConversationRecord>(safeJoin(this.dirs.conversations, name));
  }

  async deleteConversation(name: string): Promise<void> {
    await unlink(safeJoin(this.dirs.conversations, name));
  }

  async listConversations(): Promise<
    Array<{ name: string; messageCount: number; savedAt: string; provider?: string; model?: string }>
  > {
    const records = await listJsonEntries<ConversationRecord>(this.dirs.conversations);
    return records.map((r) => ({
      name: r.name,
      messageCount: r.messages.length,
      savedAt: r.metadata.savedAt,
      provider: r.metadata.provider,
      model: r.metadata.model,
    }));
  }

  async exportConversation(name: string, format: "json" | "markdown"): Promise<string> {
    const conversation = await this.loadConversation(name);
    if (format === "json") {
      return JSON.stringify(conversation, null, 2);
    }
    let md = `# ${conversation.name}\n\n`;
    md += `**Saved**: ${conversation.metadata.savedAt}\n`;
    md += `**Provider**: ${conversation.metadata.provider ?? "Unknown"}\n`;
    md += `**Model**: ${conversation.metadata.model ?? "Unknown"}\n\n---\n\n`;
    for (const msg of conversation.messages as Array<{ role: string; content: string }>) {
      md += `### ${msg.role.toUpperCase()}\n\n${msg.content}\n\n`;
    }
    return md;
  }

  async saveTemplate(name: string, template: string, description = ""): Promise<string> {
    await ensureDir(this.dirs.templates);
    await writeJson(safeJoin(this.dirs.templates, name), { name, template, description, createdAt: new Date().toISOString() });
    return name;
  }

  async loadTemplate(name: string): Promise<{ name: string; template: string; description: string }> {
    return readJson(safeJoin(this.dirs.templates, name));
  }

  async listTemplates(): Promise<Array<{ name: string; description: string; createdAt: string }>> {
    return listJsonEntries(this.dirs.templates);
  }

  async savePreset(name: string, config: Record<string, unknown>): Promise<string> {
    await ensureDir(this.dirs.presets);
    await writeJson(safeJoin(this.dirs.presets, name), { name, config, createdAt: new Date().toISOString() });
    return name;
  }

  async loadPreset(name: string): Promise<{ name: string; config: Record<string, unknown> }> {
    return readJson(safeJoin(this.dirs.presets, name));
  }

  async listPresets(): Promise<Array<{ name: string; config: Record<string, unknown> }>> {
    return listJsonEntries(this.dirs.presets);
  }

  async addToKnowledgeBase(
    title: string,
    content: string,
    embedding: number[],
    metadata: { tags?: string[] } = {},
  ): Promise<string> {
    await ensureDir(this.dirs.knowledgeBase);
    const id = `kb_${Date.now().toString(36)}_${createHash("sha256").update(content, "utf8").digest("hex").slice(0, 12)}`;
    await writeJson(safeJoin(this.dirs.knowledgeBase, id), {
      id,
      title,
      content,
      embedding,
      metadata: { ...metadata, addedAt: new Date().toISOString() },
    });
    return id;
  }

  async listKnowledgeBase(): Promise<Array<{ id: string; title: string; addedAt: string; tags: string[] }>> {
    if (!existsSync(this.dirs.knowledgeBase)) return [];
    const entries = await listJsonEntries<{
      id: string;
      title: string;
      metadata: { addedAt: string; tags?: string[] };
    }>(this.dirs.knowledgeBase);
    return entries.map((e) => ({ id: e.id, title: e.title, addedAt: e.metadata.addedAt, tags: e.metadata.tags ?? [] }));
  }

  async searchKnowledgeBase(
    queryEmbedding: number[],
    topK: number,
  ): Promise<Array<{ title: string; content: string; similarity: number }>> {
    if (!existsSync(this.dirs.knowledgeBase)) return [];
    const entries = await listJsonEntries<{ title: string; content: string; embedding: number[] }>(this.dirs.knowledgeBase);
    return entries
      .map((e) => ({ title: e.title, content: e.content, similarity: cosineSimilarity(queryEmbedding, e.embedding) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
