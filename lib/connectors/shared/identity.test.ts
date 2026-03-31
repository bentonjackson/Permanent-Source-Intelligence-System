import { describe, expect, it } from "vitest";

import {
  buildBuilderIdentityKey,
  buildOpportunityIdentityKey,
  buildPermitIdentityKey,
  buildPropertyIdentityKey,
  buildStableOpportunityId,
  summarizeChangedFields
} from "@/lib/connectors/shared/identity";
import { NormalizedPermitInput } from "@/lib/connectors/shared/types";

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
    address: "1024 Prairie Crest Dr.",
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

describe("identity helpers", () => {
  it("keeps permit identity stable when formatting changes but the permit number does not", () => {
    const a = buildPermitIdentityKey(baseRecord());
    const b = buildPermitIdentityKey(
      baseRecord({
        permitNumber: " CR 2026 001842 ",
        address: "1024   Prairie Crest Drive"
      })
    );

    expect(a).toBe(b);
  });

  it("keeps property identity stable across address punctuation and whitespace changes", () => {
    const a = buildPropertyIdentityKey(baseRecord({ parcelNumber: null }));
    const b = buildPropertyIdentityKey(
      baseRecord({
        parcelNumber: null,
        address: "1024 Prairie   Crest Dr",
        subdivision: "Prairie  Crest"
      })
    );

    expect(a).toBe(b);
  });

  it("scopes generic builder identities by county to reduce over-merging", () => {
    const linn = buildBuilderIdentityKey({ builderName: "Summit", county: "Linn" });
    const johnson = buildBuilderIdentityKey({ builderName: "Summit", county: "Johnson" });

    expect(linn).not.toBe(johnson);
  });

  it("builds a stable opportunity id from canonical fields instead of the raw dedupe hash", () => {
    const a = buildStableOpportunityId(baseRecord({ dedupeHash: "hash-a" }));
    const b = buildStableOpportunityId(baseRecord({ dedupeHash: "hash-b" }));

    expect(a).toBe(b);
    expect(buildOpportunityIdentityKey(baseRecord())).toContain("opportunity:");
  });

  it("summarizes changed fields deterministically", () => {
    expect(
      summarizeChangedFields(
        {
          permitStatus: "Review",
          contractorName: null,
          estimatedProjectValue: "0"
        },
        {
          permitStatus: "Issued",
          contractorName: "ABC Homes",
          estimatedProjectValue: 350000
        },
        ["permitStatus", "contractorName", "estimatedProjectValue"]
      )
    ).toEqual(["permitStatus", "contractorName", "estimatedProjectValue"]);
  });
});
