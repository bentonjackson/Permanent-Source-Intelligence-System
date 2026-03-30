import { describe, expect, it } from "vitest";

import { mapNormalizedPermitToOpportunity } from "@/lib/opportunities/mapping";

import {
  buildPreferredSalesName,
  getOpportunityEntityPresentation,
  normalizeEntityName,
  resolveEntityIdentity
} from "./contact-identity";

function baseRecord(overrides: Partial<Parameters<typeof mapNormalizedPermitToOpportunity>[0]> = {}) {
  return {
    dedupeHash: "test-hash",
    permitNumber: "P-123",
    permitType: "New Single Family Dwelling",
    permitSubtype: null,
    permitStatus: "Issued",
    applicationDate: "2026-03-01T00:00:00.000Z",
    issueDate: "2026-03-05T00:00:00.000Z",
    projectDescription: "New home",
    estimatedProjectValue: 420000,
    landValue: 90000,
    improvementValue: 330000,
    address: "101 Main St",
    city: "Cedar Rapids",
    county: "Linn",
    state: "IA",
    zip: "52401",
    parcelNumber: "123456",
    lotNumber: "17",
    subdivision: "West Ridge",
    builderName: null,
    contractorName: null,
    ownerName: null,
    developerName: null,
    sourceJurisdiction: "Cedar Rapids",
    sourceUrl: "https://example.com/permit/123",
    classification: "single_family_home" as const,
    rawPayload: {},
    ...overrides
  };
}

describe("contact identity normalization", () => {
  it("groups common builder name variants under the same normalized entity", () => {
    const names = [
      "ABC Homes LLC",
      "ABC Homes, L.L.C.",
      "ABC HOMES"
    ];

    const normalized = new Set(names.map((name) => normalizeEntityName(name)));
    const preferred = new Set(names.map((name) => buildPreferredSalesName(name)));

    expect(normalized.size).toBe(1);
    expect([...normalized][0]).toBe("abc homes");
    expect(preferred.size).toBe(1);
    expect([...preferred][0]).toBe("ABC Homes");
  });

  it("treats person-only records as weak builder identities until a company match exists", () => {
    const identity = resolveEntityIdentity({
      builderName: null,
      contractorName: null,
      developerName: null,
      ownerName: "John Smith"
    });
    const opportunity = mapNormalizedPermitToOpportunity(
      baseRecord({
        ownerName: "John Smith"
      })
    );
    const presentation = getOpportunityEntityPresentation(opportunity);

    expect(identity.roleType).toBe("person");
    expect(opportunity.contactResolutionStatus).toBe("weak_entity");
    expect(presentation.displayName).toBe("Unknown Builder");
    expect(presentation.nextAction).toBe("Research contact");
  });

  it("flags holding-company names as weak lead identities instead of strong builders", () => {
    const identity = resolveEntityIdentity({
      builderName: null,
      contractorName: null,
      developerName: null,
      ownerName: "Prairie Land Holdings LLC"
    });
    const opportunity = mapNormalizedPermitToOpportunity(
      baseRecord({
        ownerName: "Prairie Land Holdings LLC"
      })
    );
    const presentation = getOpportunityEntityPresentation(opportunity);

    expect(identity.roleType).toBe("holding_company");
    expect(opportunity.contactResolutionStatus).toBe("weak_entity");
    expect(presentation.displayName).toBe("Unknown Builder");
    expect(presentation.relatedEntityName).toBe("Prairie Land Holdings LLC");
  });
});
