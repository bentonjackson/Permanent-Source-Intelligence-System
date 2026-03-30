import { describe, expect, it } from "vitest";

import { deriveContactResolutionStatus } from "./workflow-artifacts";

describe("workflow artifact contact resolution", () => {
  it("marks strong builder identities with a direct channel as resolved", () => {
    expect(
      deriveContactResolutionStatus({
        roleType: "builder",
        preferredSalesName: "ABC Custom Homes",
        entityConfidenceScore: 84,
        primaryPhone: "319-555-1111"
      })
    ).toBe("resolved");
  });

  it("marks a builder-only identity without direct contact as builder_only", () => {
    expect(
      deriveContactResolutionStatus({
        roleType: "builder",
        preferredSalesName: "ABC Custom Homes",
        entityConfidenceScore: 70
      })
    ).toBe("builder_only");
  });

  it("marks owner or holding-company records as weak entities", () => {
    expect(
      deriveContactResolutionStatus({
        roleType: "holding_company",
        preferredSalesName: null,
        entityConfidenceScore: 34
      })
    ).toBe("weak_entity");
  });

  it("marks missing identity as unknown", () => {
    expect(
      deriveContactResolutionStatus({
        roleType: "unknown",
        preferredSalesName: null,
        entityConfidenceScore: 0
      })
    ).toBe("unknown");
  });
});
