export const aiReportJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: {
      type: "string",
      enum: [
        "Potentially investable",
        "Wait / watchlist",
        "Avoid",
        "Insufficient evidence",
      ],
    },
    summary: { type: "string" },
    positives: { type: "array", items: { type: "string" }, maxItems: 3 },
    risks: { type: "array", items: { type: "string" }, maxItems: 3 },
    marketExpectations: { type: "string" },
    assumptions: { type: "array", items: { type: "string" }, maxItems: 3 },
    invalidation: { type: "array", items: { type: "string" }, maxItems: 3 },
    nextChecks: { type: "array", items: { type: "string" }, maxItems: 3 },
    financialRead: { type: "string" },
    valuationRead: { type: "string" },
    governanceRead: { type: "string" },
    missingData: { type: "array", items: { type: "string" }, maxItems: 5 },
  },
  required: [
    "verdict",
    "summary",
    "positives",
    "risks",
    "marketExpectations",
    "assumptions",
    "invalidation",
    "nextChecks",
    "financialRead",
    "valuationRead",
    "governanceRead",
    "missingData",
  ],
} as const;

export function parseStructuredAnalysis(output: string): unknown {
  const trimmed = output.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  try {
    return JSON.parse(unfenced) as unknown;
  } catch {
    const firstBrace = unfenced.indexOf("{");
    const lastBrace = unfenced.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(unfenced.slice(firstBrace, lastBrace + 1)) as unknown;
    }
    throw new Error("NVIDIA Nemotron 3 Ultra returned malformed analysis.");
  }
}
