/**
 * Tool effect taxonomy. Classes are NOT mutually exclusive -- a tool may
 * declare more than one (e.g. pull_model is both EXPENSIVE and LOCAL_WRITE).
 * Policy is the union of the most-restrictive rule across a tool's declared
 * classes: if ANY declared class is gated and disabled, the tool is denied.
 */
export type EffectClass = "READ_ONLY" | "MODEL_INFERENCE" | "LOCAL_WRITE" | "DESTRUCTIVE" | "EXPENSIVE";

export interface EffectPolicyOptions {
  allowDestructiveTools: boolean;
}

export class EffectPolicyError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
  ) {
    super(message);
  }
}

/** Only DESTRUCTIVE is gated today; other classes are always enabled. */
function isClassEnabled(effectClass: EffectClass, opts: EffectPolicyOptions): boolean {
  if (effectClass === "DESTRUCTIVE") return opts.allowDestructiveTools;
  return true;
}

export function isToolEnabled(effectClasses: readonly EffectClass[], opts: EffectPolicyOptions): boolean {
  return effectClasses.every((cls) => isClassEnabled(cls, opts));
}

export function assertToolEnabled(
  toolName: string,
  effectClasses: readonly EffectClass[],
  opts: EffectPolicyOptions,
): void {
  if (!isToolEnabled(effectClasses, opts)) {
    throw new EffectPolicyError(
      `Denied by effect-policy: "${toolName}" requires DESTRUCTIVE tools to be enabled. ` +
        `Set ALLOW_DESTRUCTIVE_TOOLS=1 to permit.`,
      toolName,
    );
  }
}
