/**
 * Shared helpers for failure text that crosses a trust boundary.
 *
 * Public outputs (user-facing warnings, API error responses) are built ONLY
 * from fixed allowlisted strings plus a numeric status code - arbitrary
 * upstream error text never appears in them, redacted or not, because
 * pattern redaction cannot catch an unrecognised short secret.
 *
 * Operator logs (safeErrorLog) may retain a redacted, length-bounded reason:
 * the redaction is best-effort pattern matching, documented as not a
 * guarantee, and logs stay inside the deployment (operators/log pipelines).
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

/**
 * Redacted, whitespace-normalised, length-bounded reason. Best-effort only:
 * use in operator logs, never in public responses.
 */
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

/** Fixed, allowlisted public explanation per category - no upstream text. */
const PUBLIC_REASONS: Record<ErrorCategory, string> = {
  auth: "the AI provider rejected the request (authentication failed)",
  rate_limit: "the AI provider rate limit was reached",
  timeout: "the AI provider request timed out",
  provider_5xx: "the AI provider had a server error",
  network: "the AI provider could not be reached",
  unknown: "an unexpected provider error occurred",
};

/** Public-safe detail: fixed allowlisted string plus numeric status only. */
export function publicErrorDetail(error: unknown): string {
  const status = errorStatus(error);
  return `${PUBLIC_REASONS[errorCategory(error)]}${status ? ` (status ${status})` : ""}`;
}

/**
 * Single-line operator log string: allowlisted category/status plus a
 * best-effort-redacted, bounded reason. The raw error object is never logged.
 * Not for public responses - the redacted reason is still upstream text.
 */
export function safeErrorLog(prefix: string, error: unknown): string {
  const category = errorCategory(error);
  const status = errorStatus(error);
  const meta = status ? `category=${category} status=${status}` : `category=${category}`;
  return `${prefix}: ${meta} reason=${safeErrorReason(error)}`;
}

/**
 * User-facing warning when the AI narrative call fails: fixed category text
 * and numeric status only - no upstream error text, redacted or otherwise.
 */
export function nvidiaFallbackWarning(error: unknown): string {
  return `NVIDIA analysis was temporarily unavailable (${publicErrorDetail(error)}). Vigilant returned its evidence-based deterministic report instead; retry later for the AI narrative.`;
}

/** Safe client-facing message for total analysis failure. */
export function analysisFailureMessage(error: unknown): string {
  return `Analysis failed due to an upstream error (${publicErrorDetail(error)}). Please retry.`;
}
