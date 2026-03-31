import { describe, expect, it } from "vitest";

import { NormalizedPermitInput } from "@/lib/connectors/shared/types";

import {
  assessSourceDrift,
  computeSourceHealthScore,
  validateNormalizedPermitRecord
} from "./validation";

function baseRecord(overrides: Partial<NormalizedPermitInput> = {}): NormalizedPermitInput {
  return {
    dedupeHash: "hash-a",
    permitNumber: "CR-2026-001842",
    permitType: "Residential New Construction",
    permitSubtype: "Single Family Dwelling",
    permitStatus: "Issued",
    applicationDate: "2026-03-21T00:00:00.000Z",
    issueDate: "2026-03-24T00:00:00.000Z",
    projectDescription: "New single family home",
    estimatedProjectValue: 425000,
    landValue: 95000,
    improvementValue: 330000,
    address: "1024 Prairie Crest Dr",
    city: "Cedar Rapids",
    county: "Linn",
    state: "IA",
    zip: "52403",
    parcelNumber: "14-32-101-004",
    lotNumber: "12",
    subdivision: "Prairie Crest",
    builderName: "ABC Homes LLC",
    contractorName: null,
    ownerName: null,
    developerName: null,
    sourceJurisdiction: "Cedar Rapids",
    sourceUrl: "https://example.gov/permits/CR-2026-001842",
    classification: "single_family_home",
    rawPayload: {},
    ...overrides
  };
}

describe("normalized permit validation", () => {
  it("accepts complete records with high completeness", () => {
    const result = validateNormalizedPermitRecord(baseRecord());

    expect(result.isValid).toBe(true);
    expect(result.completenessScore).toBeGreaterThanOrEqual(85);
    expect(result.blockedReasons).toHaveLength(0);
  });

  it("allows parcel-only records but flags them for review", () => {
    const result = validateNormalizedPermitRecord(
      baseRecord({
        address: "",
        parcelNumber: "14-32-101-004"
      })
    );

    expect(result.isValid).toBe(true);
    expect(result.reviewRequired).toBe(true);
    expect(result.issues.some((issue) => issue.includes("parcel-only"))).toBe(true);
  });

  it("blocks records with no address, parcel, or date", () => {
    const result = validateNormalizedPermitRecord(
      baseRecord({
        address: "",
        parcelNumber: null,
        issueDate: null,
        applicationDate: null
      })
    );

    expect(result.isValid).toBe(false);
    expect(result.blockedReasons).toContain("Missing address and parcel identifier.");
    expect(result.blockedReasons).toContain("Missing issue/application date.");
  });
});

describe("source drift and health scoring", () => {
  it("flags sharp drops in normalized output and completeness", () => {
    const drift = assessSourceDrift({
      previousNormalizedCount: 20,
      previousCompletenessScore: 90,
      previousErrorRate: 0.02,
      currentFetchedCount: 20,
      currentNormalizedCount: 4,
      currentCompletenessScore: 58,
      currentErrorCount: 7
    });

    expect(drift.warningFlags).toContain("sharp_normalized_drop");
    expect(drift.warningFlags).toContain("completeness_drop");
    expect(drift.warningFlags).toContain("parse_error_spike");
  });

  it("scores healthier sources above degraded ones", () => {
    const healthy = computeSourceHealthScore({
      availabilityScore: 96,
      completenessScore: 88,
      freshnessScore: 90,
      parseFailureCount: 0,
      missingFieldCount: 1,
      duplicateCount: 0,
      blockedCount: 0,
      warningFlags: []
    });
    const degraded = computeSourceHealthScore({
      availabilityScore: 68,
      completenessScore: 44,
      freshnessScore: 52,
      parseFailureCount: 6,
      missingFieldCount: 9,
      duplicateCount: 4,
      blockedCount: 3,
      warningFlags: ["sharp_normalized_drop", "completeness_drop"]
    });

    expect(healthy).toBeGreaterThan(degraded);
  });
});
