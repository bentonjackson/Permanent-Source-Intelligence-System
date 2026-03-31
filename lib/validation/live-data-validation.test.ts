import { describe, expect, it } from "vitest";

import { plotOpportunities } from "@/lib/sample-data";

import {
  computeLiveDataConfidence,
  evaluateSourceFreshness,
  inferSourceDataOrigin,
  summarizeRawRecordChanges,
  validateOpportunityTransformation
} from "./live-data-validation";

describe("live data validation", () => {
  it("classifies http sources as live and manual/mock adapters explicitly", () => {
    expect(inferSourceDataOrigin("https://example.gov/permits")).toBe("live");
    expect(inferSourceDataOrigin("manual://johnson-county")).toBe("manual");
    expect(inferSourceDataOrigin("mock://fixture")).toBe("mock");
  });

  it("marks recent successful daily sources as fresh", () => {
    const result = evaluateSourceFreshness({
      syncFrequency: "0 6 * * *",
      syncStatus: "success",
      lastSuccessfulSync: new Date().toISOString()
    });

    expect(result.state).toBe("fresh");
  });

  it("marks old successful sources as stale", () => {
    const old = new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString();
    const result = evaluateSourceFreshness({
      syncFrequency: "0 6 * * *",
      syncStatus: "success",
      lastSuccessfulSync: old
    });

    expect(result.state).toBe("stale");
  });

  it("summarizes raw record changes by status", () => {
    expect(
      summarizeRawRecordChanges(["NEW", "UPDATED", "UNCHANGED", "UNCHANGED", "ERROR"])
    ).toEqual({
      newRecordCount: 1,
      updatedRecordCount: 1,
      unchangedRecordCount: 2,
      errorRecordCount: 1
    });
  });

  it("scores live, fresh, clean batches above stale or mock ones", () => {
    const strong = computeLiveDataConfidence({
      sourceConfidenceScore: 88,
      sourceFreshnessScore: 82,
      syncStatus: "success",
      freshnessState: "fresh",
      latestFetchedCount: 20,
      latestNormalizedCount: 18,
      parseFailureCount: 0,
      missingFieldCount: 1,
      duplicateCount: 0,
      dataOrigin: "live"
    });
    const weak = computeLiveDataConfidence({
      sourceConfidenceScore: 70,
      sourceFreshnessScore: 50,
      syncStatus: "warning",
      freshnessState: "stale",
      latestFetchedCount: 20,
      latestNormalizedCount: 1,
      parseFailureCount: 6,
      missingFieldCount: 8,
      duplicateCount: 4,
      dataOrigin: "mock"
    });

    expect(strong).toBeGreaterThan(weak);
  });

  it("detects transformation mismatches when stored fields drift", () => {
    const drifted = {
      ...plotOpportunities[0],
      leadType: "unknown" as const,
      jobFit: "low" as const,
      opportunityScore: 1
    };
    const result = validateOpportunityTransformation(drifted);

    expect(result.ok).toBe(false);
    expect(result.mismatches).toContain("leadType");
    expect(result.mismatches).toContain("jobFit");
    expect(result.mismatches).toContain("opportunityScore");
  });
});
