import { describe, expect, it } from "vitest";

import { builders, plotOpportunities } from "@/lib/sample-data";
import { calculateLeadScore, calculateOpportunityScore } from "@/lib/scoring/lead-scoring";

describe("calculateLeadScore", () => {
  it("prioritizes seeded single-family builders highly", () => {
    const score = calculateLeadScore(builders[0]);

    expect(score.total).toBeGreaterThan(70);
    expect(score.reasons.some((reason) => reason.includes("Single-family"))).toBe(true);
  });
});

describe("calculateOpportunityScore", () => {
  it("prioritizes vacant lots and pre-build signals", () => {
    const score = calculateOpportunityScore(plotOpportunities[4]);

    expect(score.total).toBeGreaterThan(70);
    expect(score.reasons.some((reason) => reason.includes("Vacant"))).toBe(true);
  });
});
