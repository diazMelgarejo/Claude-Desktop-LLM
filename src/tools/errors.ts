import { EndpointPolicyError } from "../policy/endpoint-policy.js";
import { EffectPolicyError } from "../policy/effect-policy.js";
import { StorageError } from "../storage/filesystem-store.js";

/** Standard denied/failed-tool-call error envelope: problem + cause + fix,
 * never a raw exception message or raw URL/path that could leak internals. */
const GENERIC_PUBLIC_ERROR = "Request failed. Check local runtime status and configuration.";

/** Return details only for error classes explicitly approved for client display. */
export function publicErrorMessage(err: unknown): string {
  if (err instanceof EndpointPolicyError || err instanceof EffectPolicyError) {
    return err.message;
  }
  // Invalid user-controlled names are safe to explain. Storage not-found and
  // escape errors can contain internal filesystem paths and stay generic.
  if (err instanceof StorageError && err.code === "invalid_name") {
    return err.message;
  }
  return GENERIC_PUBLIC_ERROR;
}

export function toolErrorText(err: unknown): string {
  return `Error: ${publicErrorMessage(err)}`;
}
