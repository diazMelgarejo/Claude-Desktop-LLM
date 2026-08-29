/**
 * Layer-3-equivalent endpoint policy for this Node process: local-first,
 * deny-by-default for non-loopback destinations, with connection-time IP
 * pinning to close the DNS-rebinding TOCTOU gap (redirect revalidation alone
 * is insufficient -- a hostname can resolve to loopback at check-time and a
 * different address at connect-time). Pattern mirrors Perpetua-Tools'
 * src/utils/ssrf_pinned_adapter.py: resolve once, pin the connection to the
 * resolved IP, keep the original hostname for the Host header / TLS SNI.
 */
import { lookup as dnsLookup } from "node:dns";
import { isIP } from "node:net";
import { Agent as UndiciAgent } from "undici";

export class EndpointPolicyError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "scheme_disallowed"
      | "userinfo_present"
      | "no_hostname"
      | "non_loopback_denied"
      | "dns_resolution_failed"
      | "redirect_limit"
      | "redirect_denied",
  ) {
    super(message);
  }
}

export interface EndpointPolicyOptions {
  allowRemoteLlm: boolean;
  allowedLlmHosts: string[];
}

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);
const MAX_REDIRECTS = 3;

function isLoopbackAddress(address: string): boolean {
  if (address === "127.0.0.1" || address === "::1") return true;
  if (address.startsWith("127.")) return true;
  // IPv4-mapped IPv6 loopback, e.g. ::ffff:127.0.0.1
  if (address.startsWith("::ffff:127.")) return true;
  return false;
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized.endsWith(".localhost");
}

function assertStructurallyValid(url: URL): void {
  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    throw new EndpointPolicyError(`scheme not allowed: ${url.protocol}`, "scheme_disallowed");
  }
  if (url.username || url.password) {
    throw new EndpointPolicyError("userinfo is not allowed in endpoint URLs", "userinfo_present");
  }
  if (!url.hostname) {
    throw new EndpointPolicyError("URL has no hostname", "no_hostname");
  }
}

async function resolveHostname(hostname: string): Promise<string> {
  if (isIP(hostname)) return hostname;
  return await new Promise<string>((resolve, reject) => {
    dnsLookup(hostname, { family: 0 }, (err, address) => {
      if (err || !address) {
        reject(
          new EndpointPolicyError(`DNS resolution failed for ${JSON.stringify(hostname)}`, "dns_resolution_failed"),
        );
        return;
      }
      resolve(address);
    });
  });
}

/**
 * Validate a single (already-resolved) hop and return the pinned IP to
 * connect to. Does not follow redirects -- callers handle hop iteration.
 */
export async function validateAndPin(
  rawUrl: string,
  opts: EndpointPolicyOptions,
): Promise<{ url: URL; pinnedIp: string }> {
  const url = new URL(rawUrl);
  assertStructurallyValid(url);

  const hostnameIsLoopback = isLoopbackHostname(url.hostname);
  const resolvedIp = hostnameIsLoopback && !isIP(url.hostname) ? "127.0.0.1" : await resolveHostname(url.hostname);
  const addressIsLoopback = isLoopbackAddress(resolvedIp) || hostnameIsLoopback;

  if (!addressIsLoopback) {
    const hostAllowed = opts.allowedLlmHosts.includes(url.hostname.toLowerCase());
    if (!opts.allowRemoteLlm || !hostAllowed) {
      throw new EndpointPolicyError(
        `non-loopback destination denied by default: ${url.hostname} (${resolvedIp}). ` +
          `Set ALLOW_REMOTE_LLM=1 and add "${url.hostname}" to ALLOWED_LLM_HOSTS to permit.`,
        "non_loopback_denied",
      );
    }
  }

  return { url, pinnedIp: resolvedIp };
}

/**
 * Build an undici Agent (Node's own bundled fetch implementation) pinned to a
 * single resolved IP for one request, via a custom connect.lookup. This is
 * the actual mechanism global `fetch(url, { dispatcher })` honors -- a plain
 * `node:http`/`node:https` Agent passed as `agent:` has no effect on fetch,
 * which is why this uses `undici` directly rather than Node's http module.
 * The original hostname is preserved for the Host header / TLS SNI (undici's
 * `connect.lookup` only substitutes the resolved address, not the identity
 * used for the handshake or the request line).
 */
function pinnedDispatcher(pinnedIp: string): UndiciAgent {
  return new UndiciAgent({
    connect: {
      // Same signature as node:dns.lookup -- undici calls this in place of
      // its own DNS resolution, so returning the already-vetted IP here is
      // what actually pins the TCP connection.
      lookup: (_hostname, _options, callback) => {
        callback(null, pinnedIp, isIP(pinnedIp) === 6 ? 6 : 4);
      },
    },
  });
}

/**
 * Fetch with endpoint policy enforcement: validates + pins the connection at
 * connect time (not merely at a pre-flight check), manually revalidates each
 * redirect hop, and never auto-follows a redirect without re-running policy.
 */
export async function guardedFetch(
  rawUrl: string,
  init: RequestInit & { signal?: AbortSignal } = {},
  opts: EndpointPolicyOptions,
  hop = 0,
): Promise<Response> {
  if (hop > MAX_REDIRECTS) {
    throw new EndpointPolicyError(`redirect limit ${MAX_REDIRECTS} exceeded`, "redirect_limit");
  }
  const { url, pinnedIp } = await validateAndPin(rawUrl, opts);
  const dispatcher = pinnedDispatcher(pinnedIp);
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      redirect: "manual",
      // @ts-expect-error -- `dispatcher` is undici/Node's own fetch extension point for
      // this exact purpose; not yet in the standard lib.dom.d.ts RequestInit type.
      dispatcher,
    });
  } finally {
    void dispatcher.close();
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) {
      throw new EndpointPolicyError("redirect without Location header", "redirect_denied");
    }
    const next = new URL(location, url).toString();
    return guardedFetch(next, init, opts, hop + 1);
  }

  return response;
}
