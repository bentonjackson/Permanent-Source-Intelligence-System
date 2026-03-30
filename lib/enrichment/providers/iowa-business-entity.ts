import {
  BuilderEnrichmentContribution,
  BuilderEnrichmentInput,
  BuilderEnrichmentProvider
} from "@/lib/enrichment/types";

const SOS_SEARCH_URL = "https://sos.iowa.gov/search/business/search.aspx";

export const iowaBusinessEntityProvider: BuilderEnrichmentProvider = {
  key: "iowa-business-entity",
  label: "Iowa Secretary of State Business Entities Search",
  async enrich(input: BuilderEnrichmentInput): Promise<BuilderEnrichmentContribution> {
    const query = input.primaryCandidate?.rawName ?? input.builder.company.legalName ?? input.builder.name;

    return {
      provider: this.key,
      businessEntityStatus: query ? "pending" : "not_found",
      fieldCandidates: [
        {
          fieldName: "businessEntitySearch",
          fieldValue: query,
          confidence: query ? 42 : 0,
          sourceLabel: this.label,
          sourceUrl: SOS_SEARCH_URL,
          rationale: query
            ? "Official Iowa business-entity lookup registered for this builder identity."
            : "No company-style name available for Iowa business-entity lookup."
        }
      ],
      matchCandidates: query
        ? [
            {
              rawSourceName: query,
              normalizedEntityName: input.primaryCandidate?.rawName ? input.primaryCandidate.rawName.toLowerCase() : "",
              preferredSalesName: input.primaryCandidate?.rawName ?? null,
              fingerprint: input.primaryCandidate?.rawName ? input.primaryCandidate.rawName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() : "",
              roleType: input.primaryCandidate ? "builder" : "unknown",
              roleConfidenceScore: input.primaryCandidate ? 46 : 12,
              matchScore: input.primaryCandidate ? 44 : 10,
              matchStrategy: "iowa-business-entity-lookup-ready",
              sourceLabel: this.label,
              sourceUrl: SOS_SEARCH_URL,
              rationale: "Official Iowa business entity search should be used as the primary legal-name validation step.",
              payload: {
                query
              }
            }
          ]
        : []
    };
  }
};
