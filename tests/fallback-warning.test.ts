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
