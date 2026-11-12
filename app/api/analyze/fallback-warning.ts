/**
 * Reason text attached to the deterministic-fallback warning when the AI
 * narrative call fails. The fallback keeps the product usable, but a generic
 * "temporarily unavailable" makes a persistent outage indistinguishable from
 * a transient blip - include the bounded, secret-free failure detail.
 */
export function nvidiaFallbackWarning(error: unknown): string {
  const reason =
    error instanceof Error && error.message
      ? error.message.replace(/\s+/g, " ").slice(0, 220)
      : "unknown error";
  return `NVIDIA analysis was temporarily unavailable (${reason}). Vigilant returned its evidence-based deterministic report instead; retry later for the AI narrative.`;
}
