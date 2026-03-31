import { describe, expect, it } from "vitest";

import { builders, plotOpportunities } from "@/lib/sample-data";
import { calculateLeadScore, calculateOpportunityScore } from "@/lib/scoring/lead-scoring";

describe("calculateLeadScore", () => {
  it("prioritizes seeded single-family builders highly", () => {
    const score = calculateLeadScore(builders[0]);

    expect(score.total).toBeGreaterThan(70);
    expect(score.reasons.some((reason) => reason.includes("Single-family"))).toBe(true);
    expect(score.breakdown.length).toBeGreaterThan(0);
  });
});

describe("calculateOpportunityScore", () => {
  it("prioritizes vacant lots and pre-build signals", () => {
    const score = calculateOpportunityScore(plotOpportunities[4]);

    expect(score.total).toBeGreaterThan(40);
    expect(score.reasons.some((reason) => reason.includes("Vacant"))).toBe(true);
  });

  it("ranks stronger contact-ready leads above weak research leads", () => {
    const strong = calculateOpportunityScore(plotOpportunities[0]);
    const weak = calculateOpportunityScore(plotOpportunities[3]);

    expect(strong.total).toBeGreaterThan(weak.total);
    expect(strong.reasons.some((reason) => reason.includes("Strong contact") || reason.includes("Builder identified"))).toBe(true);
    expect(strong.breakdown.some((item) => item.label === "builder_identified")).toBe(true);
  });

  it("keeps multifamily and commercial opportunities competitive when fit is strong", () => {
    const multifamily = calculateOpportunityScore(plotOpportunities[5]);
    const commercial = calculateOpportunityScore(plotOpportunities[6]);

    expect(multifamily.total).toBeGreaterThan(50);
    expect(commercial.total).toBeGreaterThan(40);
  });

  it("applies stronger time decay to older leads than to fresh issued permits", () => {
    const fresh = calculateOpportunityScore({
      ...plotOpportunities[0],
      recencyBucket: "0_7_days",
      buildReadiness: "permit_issued"
    });
    const stale = calculateOpportunityScore({
      ...plotOpportunities[0],
      recencyBucket: "older",
      buildReadiness: "early_signal",
      phone: null,
      email: null,
      website: null
    });

    expect(fresh.total).toBeGreaterThan(stale.total);
    expect(stale.reasons.some((reason) => reason.includes("Older lead signal"))).toBe(true);
  });
});
