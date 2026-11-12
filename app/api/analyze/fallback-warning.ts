/**
 * Reason text attached to the deterministic-fallback warning when the AI
 * narrative call fails. The fallback keeps the product usable, but a generic
 * "temporarily unavailable" makes a persistent outage indistinguishable from
 * a transient blip - include the bounded, secret-free failure detail.
 *
 * Upstream provider errors can echo credentials (Authorization headers,
 * api_key fields, URLs with basic auth, raw key strings), so the reason is
 * redacted before it is bounded and shown to the caller.
 */
const REDACTIONS: Array<[RegExp, string]> = [
  // Authorization headers / bearer tokens.
  [/bearer\s+[a-z0-9._~+/=-]+/gi, "Bearer [redacted]"],
  // Recognisable API-token shapes (nvapi-*, sk-*, gsk_*, hf_*, ghp_*, AIza*, ...).
  [/\b(?:nvapi|gsk|xai|hf|ghp|AIza|sk(?:-ant)?)[-_][A-Za-z0-9_-]{8,}\b/g, "[redacted-token]"],
  // key=value, key: value, "key": "value" credential leaks.
  [/(api[-_ ]?key|access[-_ ]?token|auth[-_ ]?token|authorization|client[-_ ]?secret|password|secret)("?\s*[:=]\s*"?)[^\s,"'}&]+/gi, "$1$2[redacted]"],
  // Credentials embedded in a URL (scheme://user:pass@host).
  [/(\/\/[^/\s:]+:)[^@\s]+(@)/g, "$1[redacted]$2"],
  // Long opaque strings (raw hex/base64-ish secrets without a known prefix).
  [/\b[A-Za-z0-9+/=_-]{32,}\b/g, "[redacted]"],
];

export function nvidiaFallbackWarning(error: unknown): string {
  const raw = error instanceof Error && error.message ? error.message : "unknown error";
  let reason = raw;
  for (const [pattern, replacement] of REDACTIONS) {
    reason = reason.replace(pattern, replacement);
  }
  reason = reason.replace(/\s+/g, " ").slice(0, 220);
  return `NVIDIA analysis was temporarily unavailable (${reason}). Vigilant returned its evidence-based deterministic report instead; retry later for the AI narrative.`;
}
