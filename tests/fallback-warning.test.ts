import assert from "node:assert/strict";
import test from "node:test";

import {
  analysisFailureMessage,
  errorCategory,
  errorStatus,
  nvidiaFallbackWarning,
  safeErrorLog,
  safeErrorReason,
} from "../app/api/analyze/fallback-warning.ts";

const KEY = "nvapi-AbCdEf0123456789SECRETKEY";

// --- Public outputs: fixed allowlisted strings + numeric status only ---

test("public warning uses fixed category text for auth failures", () => {
  const warning = nvidiaFallbackWarning(
    new Error("NVIDIA Nemotron 3 Super provider error (401): invalid api key"),
  );
  assert.match(warning, /temporarily unavailable/);
  assert.match(warning, /authentication failed/);
  assert.match(warning, /status 401/);
  assert.match(warning, /deterministic report instead/);
  // no arbitrary upstream text
  assert.ok(!warning.includes("invalid api key"));
  assert.ok(!warning.includes("Nemotron"));
});

test("public warning covers every category with allowlisted text only", () => {
  const cases: Array<[string, RegExp]> = [
    ["The operation was aborted due to timeout", /request timed out/],
    ["429 too many requests", /rate limit was reached/],
    ["502 bad gateway from upstream", /had a server error/],
    ["fetch failed: ENOTFOUND host", /could not be reached/],
    ["something entirely unexpected", /unexpected provider error/],
  ];
  for (const [message, pattern] of cases) {
    const warning = nvidiaFallbackWarning(new Error(message));
    assert.match(warning, pattern, message);
  }
});

test("public outputs never contain unknown short sensitive strings", () => {
  const secretishInputs = [
    new Error("xj7q9!zz"),
    new Error("tok123"),
    new Error("err: q9w8e7"),
    "xj7q9!zz",
    987654,
  ];
  for (const input of secretishInputs) {
    const warning = nvidiaFallbackWarning(input);
    const failure = analysisFailureMessage(input);
    for (const out of [warning, failure]) {
      assert.ok(!out.includes("xj7q9"), out);
      assert.ok(!out.includes("tok123"), out);
      assert.ok(!out.includes("q9w8e7"), out);
      assert.ok(!out.includes("987654"), out);
    }
  }
});

test("public 502 message is category-based, bounded, and actionable", () => {
  const msg = analysisFailureMessage(new Error(`502 bad gateway: Bearer ${KEY}`));
  assert.ok(!msg.includes(KEY));
  assert.ok(!msg.includes("bad gateway from upstream host internal-01"));
  assert.match(msg, /^Analysis failed due to an upstream error \(/);
  assert.match(msg, /had a server error \(status 502\)/);
  assert.match(msg, /Please retry\.$/);
  assert.ok(msg.length <= 220);
});

test("non-Error failures use the generic allowlisted public reason", () => {
  assert.match(nvidiaFallbackWarning("boom"), /unexpected provider error/);
  assert.match(nvidiaFallbackWarning(undefined), /unexpected provider error/);
  assert.match(analysisFailureMessage("boom"), /unexpected provider error/);
});

// --- Classification helpers ---

test("errorCategory classifies allowlisted failure kinds", () => {
  assert.equal(errorCategory(new Error("The operation was aborted due to timeout")), "timeout");
  assert.equal(errorCategory(new Error("401 Unauthorized: invalid api key")), "auth");
  assert.equal(errorCategory(new Error("429 too many requests")), "rate_limit");
  assert.equal(errorCategory(new Error("502 bad gateway from upstream")), "provider_5xx");
  assert.equal(errorCategory(new Error("fetch failed: ENOTFOUND host")), "network");
  assert.equal(errorCategory(new Error("something odd happened")), "unknown");
});

test("errorStatus extracts a status code only when present", () => {
  assert.equal(errorStatus(new Error("provider error (401): invalid api key")), 401);
  assert.equal(errorStatus(new Error("aborted due to timeout after 10000ms")), null);
});

// --- Operator-log path: redacted bounded reason (best-effort, not public) ---

test("safeErrorReason bounds and normalises whitespace", () => {
  const reason = safeErrorReason(new Error(`line\nbreak ${"x".repeat(500)}`));
  assert.ok(!reason.includes("\n"));
  assert.ok(reason.length <= 220);
});

test("safeErrorLog never includes raw credential material", () => {
  const line = safeErrorLog(
    "AI narrative unavailable",
    new Error(`401 Unauthorized: Authorization: Bearer ${KEY}`),
  );
  assert.ok(!line.includes(KEY));
  assert.ok(!line.includes("Bearer nvapi"));
  assert.match(line, /^AI narrative unavailable: category=auth status=401 reason=/);
  assert.match(line, /\[redacted\]/);
});

test("safeErrorLog keeps timeouts diagnosable", () => {
  const line = safeErrorLog("AI narrative unavailable", new Error("aborted due to timeout"));
  assert.match(line, /category=timeout/);
  assert.match(line, /aborted due to timeout/);
});

test("operator-log reason redacts echoed keys in provider bodies", () => {
  const reason = safeErrorReason(
    new Error("Incorrect API key provided: nvapi-Zz9yXx8Ww7Vv6Uu5Tt4Ss3. See the NVIDIA console."),
  );
  assert.ok(!reason.includes("nvapi-Zz9yXx8Ww7Vv6Uu5Tt4Ss3"));
  assert.match(reason, /\[redacted-token\]/);
});

test("operator-log reason redacts key=value leaks", () => {
  const reason = safeErrorReason(
    new Error("upstream rejected request: api_key=Ab1234567890secretkey (status 401)"),
  );
  assert.ok(!reason.includes("Ab1234567890secretkey"));
});

test("operator-log reason redacts credentials embedded in URLs", () => {
  const reason = safeErrorReason(
    new Error("fetch failed: https://svc-user:sup3rsecretP4ss@internal.example.com/v1/chat"),
  );
  assert.ok(!reason.includes("sup3rsecretP4ss"));
});

test("operator-log reason redacts long opaque strings", () => {
  const rawKey = "deadbeefcafe0123456789abcdef0123456789abcdef0123456789";
  const reason = safeErrorReason(new Error(`401: key ${rawKey} not authorized`));
  assert.ok(!reason.includes(rawKey));
});

test("joined multi-model upstream errors are redacted in operator logs", () => {
  const joined = new Error(
    `401 Unauthorized: Bearer ${KEY} | 429 rate limit exceeded | api_key=Ab1234567890secretkey`,
  );
  const line = safeErrorLog("AI narrative unavailable", joined);
  assert.ok(!line.includes(KEY));
  assert.ok(!line.includes("Ab1234567890secretkey"));
  assert.match(line, /429 rate limit exceeded/);
});
