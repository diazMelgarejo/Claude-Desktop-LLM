/** Standard denied/failed-tool-call error envelope: problem + cause + fix,
 * never a raw exception message or raw URL/path that could leak internals. */
export function toolErrorText(err: unknown): string {
  if (err instanceof Error) {
    // These error classes already carry problem+cause+fix in their own
    // constructed message (see endpoint-policy.ts, effect-policy.ts,
    // filesystem-store.ts) -- pass them through as-is.
    return `Error: ${err.message}`;
  }
  return `Error: ${String(err)}`;
}
