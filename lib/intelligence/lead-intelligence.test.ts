import { describe, expect, it } from "vitest";

import { builders, plotOpportunities } from "@/lib/sample-data";

import {
  buildContractorMetrics,
  hydrateOpportunityIntelligence,
  inferJobFit,
  inferLeadType,
  inferOpportunityReason,
  inferRecencyBucket
} from "./lead-intelligence";

describe("lead intelligence", () => {
  it("classifies builder-like opportunities as builder leads", () => {
    expect(inferLeadType(plotOpportunities[0])).toBe("builder");
  });

  it("flags combined insulation and shelving fit when garage-oriented signals are present", () => {
    expect(
      inferJobFit({
        ...plotOpportunities[0],
        reasonSummary: ["High-value garage build", "New construction"]
      })
    ).toBe("both");
  });

  it("detects new-build opportunity reasons from the record narrative", () => {
    expect(inferOpportunityReason(plotOpportunities[4])).toBe("new_build");
  });

  it("assigns a recent bucket for fresh signals", () => {
    const fresh = hydrateOpportunityIntelligence({
      ...plotOpportunities[0],
      signalDate: new Date().toISOString()
    });

    expect(fresh.recencyBucket).toBe("0_7_days");
    expect(inferRecencyBucket(fresh.signalDate)).toBe("0_7_days");
  });

  it("builds contractor metrics from grouped permits and locations", () => {
    const metrics = buildContractorMetrics(builders[0]);

    expect(metrics.totalPermits).toBeGreaterThan(0);
    expect(metrics.locations.length).toBeGreaterThan(0);
    expect(metrics.projectTypes.length).toBeGreaterThan(0);
  });
});
