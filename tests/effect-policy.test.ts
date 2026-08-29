import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { assertToolEnabled, EffectPolicyError, isToolEnabled } from "../src/policy/effect-policy.js";

describe("effect policy", () => {
  test("READ_ONLY is always enabled", () => {
    assert.equal(isToolEnabled(["READ_ONLY"], { allowDestructiveTools: false }), true);
  });

  test("DESTRUCTIVE is disabled by default", () => {
    assert.equal(isToolEnabled(["DESTRUCTIVE"], { allowDestructiveTools: false }), false);
  });

  test("DESTRUCTIVE is enabled when explicitly opted in", () => {
    assert.equal(isToolEnabled(["DESTRUCTIVE"], { allowDestructiveTools: true }), true);
  });

  test("a tool with multiple classes is denied if ANY declared class is gated and disabled", () => {
    // Not a real registry tool, but exercises the union-of-most-restrictive-rule contract.
    assert.equal(isToolEnabled(["EXPENSIVE", "DESTRUCTIVE"], { allowDestructiveTools: false }), false);
  });

  test("assertToolEnabled throws EffectPolicyError with problem+cause+fix wording", () => {
    assert.throws(
      () => assertToolEnabled("delete_model", ["DESTRUCTIVE"], { allowDestructiveTools: false }),
      (err: unknown) => {
        assert.ok(err instanceof EffectPolicyError);
        assert.match(err.message, /ALLOW_DESTRUCTIVE_TOOLS=1/);
        return true;
      },
    );
  });

  test("assertToolEnabled does not throw when enabled", () => {
    assert.doesNotThrow(() => assertToolEnabled("delete_model", ["DESTRUCTIVE"], { allowDestructiveTools: true }));
  });
});
