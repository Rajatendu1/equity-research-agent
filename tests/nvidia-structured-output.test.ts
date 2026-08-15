import assert from "node:assert/strict";
import test from "node:test";

import {
  aiReportJsonSchema,
  parseStructuredAnalysis,
} from "../app/api/analyze/structured-output.ts";

const completeReport = {
  verdict: "Wait / watchlist",
  summary: "Evidence is mixed.",
  positives: ["Cash flow improved."],
  risks: ["Valuation is elevated."],
  marketExpectations: "Growth is already priced in.",
  assumptions: ["Margins remain stable."],
  invalidation: ["Debt rises materially."],
  nextChecks: ["Verify the next filing."],
  financialRead: "Profitability is stable.",
  valuationRead: "The multiple is demanding.",
  governanceRead: "No primary review was completed.",
  missingData: ["Latest annual report review."],
};

test("NVIDIA structured-output JSON schema constrains every AiReport field", () => {
  assert.equal(aiReportJsonSchema.type, "object");
  assert.equal(aiReportJsonSchema.additionalProperties, false);
  assert.deepEqual(
    [...aiReportJsonSchema.required].sort(),
    Object.keys(aiReportJsonSchema.properties).sort(),
  );
  assert.deepEqual(aiReportJsonSchema.properties.verdict.enum, [
    "Potentially investable",
    "Wait / watchlist",
    "Avoid",
    "Insufficient evidence",
  ]);
});

test("parses an exact guided JSON response", () => {
  assert.deepEqual(parseStructuredAnalysis(JSON.stringify(completeReport)), completeReport);
});

test("defensively parses fenced and provider-prefixed JSON", () => {
  assert.deepEqual(
    parseStructuredAnalysis(`\`\`\`json\n${JSON.stringify(completeReport)}\n\`\`\``),
    completeReport,
  );
  assert.deepEqual(
    parseStructuredAnalysis(`Result:\n${JSON.stringify(completeReport)}`),
    completeReport,
  );
});

test("rejects a response without a JSON object", () => {
  assert.throws(
    () => parseStructuredAnalysis("No structured response was generated."),
    /malformed analysis/,
  );
});
