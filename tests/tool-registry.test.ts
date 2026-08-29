import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isToolEnabled } from "../src/policy/effect-policy.js";
import { findToolDefinition, TOOL_REGISTRY } from "../src/tools/registry.js";

describe("tool registry", () => {
  test("preserves parity with the original 33-tool surface (count)", () => {
    assert.equal(TOOL_REGISTRY.length, 33);
  });

  test("every tool has a unique name", () => {
    const names = TOOL_REGISTRY.map((t) => t.name);
    assert.equal(new Set(names).size, names.length);
  });

  test("every tool declares at least one effect class", () => {
    for (const tool of TOOL_REGISTRY) {
      assert.ok(tool.effectClasses.length > 0, tool.name);
    }
  });

  test("delete_model is the only DESTRUCTIVE tool and is disabled by default", () => {
    const destructive = TOOL_REGISTRY.filter((t) => t.effectClasses.includes("DESTRUCTIVE"));
    assert.deepEqual(
      destructive.map((t) => t.name),
      ["delete_model"],
    );
    assert.equal(isToolEnabled(destructive[0].effectClasses, { allowDestructiveTools: false }), false);
  });

  test("findToolDefinition resolves a known tool and returns undefined for an unknown one", () => {
    assert.ok(findToolDefinition("local_llm_query"));
    assert.equal(findToolDefinition("not_a_real_tool"), undefined);
  });
});
