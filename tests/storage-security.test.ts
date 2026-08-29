import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { assertSafeName, FilesystemStore, StorageError } from "../src/storage/filesystem-store.js";

describe("storage security", () => {
  let dir: string;
  let store: FilesystemStore;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "mcp-storage-test-"));
    store = new FilesystemStore(dir);
  });
  after(() => rmSync(dir, { recursive: true, force: true }));

  test("safe names remain under the expected directory", async () => {
    await store.saveConversation("My Chat", [{ role: "user", content: "hi" }]);
    assert.ok(existsSync(join(dir, "conversations", "My Chat.json")));
  });

  test("ordinary spaces, Unicode, and internal dots are preserved directly in the storage name", async () => {
    const name = "日本語 Chat with spaces.and.dots";
    await store.saveConversation(name, [{ role: "user", content: "hi" }]);
    const loaded = await store.loadConversation(name);
    assert.equal(loaded.name, name);
  });

  test("path-traversal name is rejected outright, never silently sanitized onto disk", () => {
    assert.throws(() => assertSafeName("../../../../etc/passwd"), StorageError);
  });

  test("name containing a forward slash is rejected", () => {
    assert.throws(() => assertSafeName("a/b"), StorageError);
  });

  test("name containing a backslash is rejected", () => {
    assert.throws(() => assertSafeName("a\\b"), StorageError);
  });

  test("bare '.' and '..' are rejected", () => {
    assert.throws(() => assertSafeName("."), StorageError);
    assert.throws(() => assertSafeName(".."), StorageError);
  });

  test("empty name is rejected", () => {
    assert.throws(() => assertSafeName(""), StorageError);
  });

  test("oversized name is rejected", () => {
    assert.throws(() => assertSafeName("a".repeat(129)), StorageError);
  });

  test("name with a control character is rejected", () => {
    assert.throws(() => assertSafeName("badname"), StorageError);
  });

  test("trailing dot or trailing space is rejected", () => {
    assert.throws(() => assertSafeName("trailing."), StorageError);
    assert.throws(() => assertSafeName("trailing "), StorageError);
  });

  test("reserved Windows device name is rejected", () => {
    assert.throws(() => assertSafeName("CON"), StorageError);
    assert.throws(() => assertSafeName("con"), StorageError);
  });

  test("loading a nonexistent conversation raises StorageError, not a raw fs error", async () => {
    await assert.rejects(() => store.loadConversation("never-saved-conversation-name"), StorageError);
  });

  test("templates use literal variable replacement, not RegExp-from-user-key", async () => {
    await store.saveTemplate("greeting", "Hello {{name}}, welcome to {{place}}!");
    const tmpl = await store.loadTemplate("greeting");
    assert.equal(tmpl.template, "Hello {{name}}, welcome to {{place}}!");
  });

  test("template variable key containing regex metacharacters does not throw", async () => {
    const { substituteTemplate } = await import("../src/tools/template-substitution.js");
    const result = substituteTemplate("Value: {{x}}", { "(.*)": "ignored" });
    assert.equal(result, "Value: {{x}}");
  });
});
