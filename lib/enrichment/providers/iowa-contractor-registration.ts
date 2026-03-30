import {
  BuilderEnrichmentContribution,
  BuilderEnrichmentInput,
  BuilderEnrichmentProvider
} from "@/lib/enrichment/types";

const DIAL_CONTRACTOR_URL = "https://dial.iowa.gov/licenses/building/contractors";

export const iowaContractorRegistrationProvider: BuilderEnrichmentProvider = {
  key: "iowa-contractor-registration",
  label: "Iowa DIAL Contractor Registration",
  async enrich(input: BuilderEnrichmentInput): Promise<BuilderEnrichmentContribution> {
    const likelyContractor =
      input.primaryCandidate &&
      ["builder", "general_contractor", "developer"].includes(input.primaryCandidate.matchedField);

    return {
      provider: this.key,
      contractorRegistrationStatus: likelyContractor ? "pending" : "unknown",
      fieldCandidates: [
        {
          fieldName: "contractorRegistrationLookup",
          fieldValue: input.primaryCandidate?.rawName ?? input.builder.name,
          confidence: likelyContractor ? 46 : 22,
          sourceLabel: this.label,
          sourceUrl: DIAL_CONTRACTOR_URL,
          rationale: likelyContractor
            ? "Official Iowa contractor registration lookup queued for contractor/building validation."
            : "Name is available for official contractor registration review, but the identity is not yet a strong contractor match."
        }
      ],
      matchCandidates: likelyContractor && input.primaryCandidate
        ? [
            {
              rawSourceName: input.primaryCandidate.rawName,
              normalizedEntityName: input.primaryCandidate.rawName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
              preferredSalesName: input.primaryCandidate.rawName,
              fingerprint: input.primaryCandidate.rawName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
              roleType: "general_contractor",
              roleConfidenceScore: 48,
              matchScore: 45,
              matchStrategy: "iowa-contractor-registration-lookup-ready",
              sourceLabel: this.label,
              sourceUrl: DIAL_CONTRACTOR_URL,
              rationale: "Official contractor-registration lookup is the primary contractor validation step for this builder identity."
            }
          ]
        : []
    };
  }
};
