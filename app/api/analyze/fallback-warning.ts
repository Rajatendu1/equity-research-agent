/**
 * Shared helpers for failure text that crosses a trust boundary: the
 * user-facing fallback warning, API error responses, and deployment logs.
 *
 * Upstream provider errors can echo credentials (Authorization headers,
 * api_key fields, URLs with basic auth, raw key strings). The redaction here
 * is best-effort pattern matching - it reduces accidental disclosure but is
 * not a guarantee, so logs and responses also carry an allowlisted error
 * category/status and never the raw upstream error object.
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

/** Best-effort removal of echoed credential material from arbitrary text. */
export function redactSecretMaterial(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REDACTIONS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** Redacted, whitespace-normalised, length-bounded reason. Best-effort. */
export function safeErrorReason(error: unknown, maxLength = 220): string {
  const raw = error instanceof Error && error.message ? error.message : "unknown error";
  return redactSecretMaterial(raw).replace(/\s+/g, " ").slice(0, maxLength);
}

export type ErrorCategory =
  | "auth"
  | "rate_limit"
  | "timeout"
  | "provider_5xx"
  | "network"
  | "unknown";

/** Allowlisted classification of a failure, derived from safe patterns only. */
export function errorCategory(error: unknown): ErrorCategory {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  if (/timeout|timed out|abort|ETIMEDOUT|deadline/i.test(msg)) return "timeout";
  if (/\b401\b|\b403\b|unauthori[sz]ed|invalid api key|authentication|forbidden/i.test(msg)) {
    return "auth";
  }
  if (/\b429\b|rate[- ]?limit|too many requests|quota/i.test(msg)) return "rate_limit";
  if (/\b5\d\d\b|bad gateway|service unavailable|upstream error/i.test(msg)) {
    return "provider_5xx";
  }
  if (/fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|network|DNS/i.test(msg)) {
    return "network";
  }
  return "unknown";
}

/** HTTP status code mentioned in the error text, when present. */
export function errorStatus(error: unknown): number | null {
  const msg = error instanceof Error ? error.message : "";
  const match = /\b([45]\d\d)\b/.exec(msg);
  return match ? Number(match[1]) : null;
}

/**
 * Single-line log string with allowlisted metadata and a redacted, bounded
 * reason. Use instead of logging the raw error object: deployment logs are
 * persistent and readable by operators and log pipelines.
 */
export function safeErrorLog(prefix: string, error: unknown): string {
  const category = errorCategory(error);
  const status = errorStatus(error);
  const meta = status ? `category=${category} status=${status}` : `category=${category}`;
  return `${prefix}: ${meta} reason=${safeErrorReason(error)}`;
}

/**
 * Reason text attached to the deterministic-fallback warning when the AI
 * narrative call fails. The fallback keeps the product usable, but a generic
 * "temporarily unavailable" makes a persistent outage indistinguishable from
 * a transient blip - include the bounded, redacted failure detail.
 */
export function nvidiaFallbackWarning(error: unknown): string {
  return `NVIDIA analysis was temporarily unavailable (${safeErrorReason(error)}). Vigilant returned its evidence-based deterministic report instead; retry later for the AI narrative.`;
}

/** Safe client-facing message for total analysis failure - no raw upstream text. */
export function analysisFailureMessage(error: unknown): string {
  return `Analysis failed due to an upstream error (${safeErrorReason(error)}). Please retry.`;
}
