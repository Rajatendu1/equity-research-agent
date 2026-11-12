import assert from "node:assert/strict";
import test from "node:test";

import { nvidiaFallbackWarning } from "../app/api/analyze/fallback-warning.ts";

test("fallback warning carries the provider failure reason", () => {
  const warning = nvidiaFallbackWarning(
    new Error("NVIDIA Nemotron 3 Super provider error (401): invalid api key"),
  );
  assert.match(warning, /temporarily unavailable/);
  assert.match(warning, /provider error \(401\)/);
  assert.match(warning, /deterministic report instead/);
});

test("fallback warning normalises whitespace and bounds long reasons", () => {
  const warning = nvidiaFallbackWarning(new Error(`line\nbreak ${"x".repeat(500)}`));
  assert.ok(!warning.includes("\n"));
  // reason is capped at 220 chars inside the fixed template
  assert.ok(warning.length <= 220 + 170);
  assert.ok(!warning.includes("x".repeat(300)));
});

test("non-Error failures degrade to a generic reason", () => {
  assert.match(nvidiaFallbackWarning("boom"), /unknown error/);
  assert.match(nvidiaFallbackWarning(undefined), /unknown error/);
});

test("401 errors must not leak an echoed API key (bearer header)", () => {
  const warning = nvidiaFallbackWarning(
    new Error(
      "401 Unauthorized from https://integrate.api.nvidia.com/v1/chat/completions: Authorization: Bearer nvapi-AbCdEf0123456789SECRETKEY",
    ),
  );
  assert.ok(!warning.includes("nvapi-AbCdEf0123456789SECRETKEY"));
  assert.ok(!warning.includes("Bearer nvapi"));
  assert.match(warning, /\[redacted\]/);
  assert.match(warning, /401 Unauthorized/);
});

test("401 errors must not leak an echoed API key (provider body)", () => {
  const warning = nvidiaFallbackWarning(
    new Error(
      "Incorrect API key provided: nvapi-Zz9yXx8Ww7Vv6Uu5Tt4Ss3. You can find your API key in the NVIDIA console.",
    ),
  );
  assert.ok(!warning.includes("nvapi-Zz9yXx8Ww7Vv6Uu5Tt4Ss3"));
  assert.match(warning, /\[redacted-token\]/);
  assert.match(warning, /Incorrect API key provided/);
});

test("key=value credential leaks are redacted", () => {
  const warning = nvidiaFallbackWarning(
    new Error("upstream rejected request: api_key=Ab1234567890secretkey (status 401)"),
  );
  assert.ok(!warning.includes("Ab1234567890secretkey"));
  assert.match(warning, /status 401/);
});

test("credentials embedded in URLs are redacted", () => {
  const warning = nvidiaFallbackWarning(
    new Error("fetch failed: https://svc-user:sup3rsecretP4ss@internal.example.com/v1/chat"),
  );
  assert.ok(!warning.includes("sup3rsecretP4ss"));
  assert.match(warning, /internal\.example\.com/);
});

test("long opaque strings are redacted as possible raw keys", () => {
  const rawKey = "deadbeefcafe0123456789abcdef0123456789abcdef0123456789";
  const warning = nvidiaFallbackWarning(new Error(`401: key ${rawKey} not authorized`));
  assert.ok(!warning.includes(rawKey));
  assert.match(warning, /\[redacted\]/);
});

test("ordinary failure reasons pass through readable and unredacted", () => {
  const warning = nvidiaFallbackWarning(
    new Error("The operation was aborted due to timeout after 10000ms"),
  );
  assert.match(warning, /aborted due to timeout after 10000ms/);
  assert.ok(!warning.includes("[redacted"));
});
