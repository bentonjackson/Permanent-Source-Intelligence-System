import { normalizeWhitespace } from "@/lib/connectors/shared/normalization";
import {
  buildPreferredSalesName,
  normalizeEntityName,
  resolveEntityIdentity
} from "@/lib/entities/contact-identity";
import {
  BuilderEnrichmentContribution,
  BuilderEnrichmentInput,
  BuilderEnrichmentProvider
} from "@/lib/enrichment/types";

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export const internalRecordsProvider: BuilderEnrichmentProvider = {
  key: "internal-records",
  label: "Internal scraped records",
  async enrich(input: BuilderEnrichmentInput): Promise<BuilderEnrichmentContribution> {
    const strongest = input.primaryCandidate;
    const distinctRawNames = [...new Set(input.allCandidates.map((candidate) => candidate.rawName))];
    const strongestIdentity = strongest
      ? resolveEntityIdentity({
          builderName: strongest.matchedField === "builder" ? strongest.rawName : null,
          contractorName: strongest.matchedField === "general_contractor" ? strongest.rawName : null,
          developerName: strongest.matchedField === "developer" ? strongest.rawName : null,
          ownerName: strongest.matchedField === "owner" ? strongest.rawName : null
        })
      : null;

    const roleConfidenceDelta = strongest
      ? Math.min(18, strongest.occurrenceCount * 3 + strongest.countyCount * 4 + strongest.propertyCount * 2)
      : 0;
    const entityConfidenceDelta = strongest
      ? Math.min(20, strongest.occurrenceCount * 4 + strongest.countyCount * 4 + strongest.cityCount * 2)
      : 0;
    const phone = firstNonEmpty(
      input.builder.phone,
      input.builder.company.phone,
      ...input.builder.contacts.map((contact) => contact.phone),
      ...input.builder.opportunities.map((opportunity) => opportunity.phone)
    );
    const email = firstNonEmpty(
      input.builder.email,
      input.builder.company.email,
      ...input.builder.contacts.map((contact) => contact.email),
      ...input.builder.opportunities.map((opportunity) => opportunity.email)
    );
    const website = firstNonEmpty(
      input.builder.website,
      input.builder.company.website,
      ...input.builder.opportunities.map((opportunity) => opportunity.website)
    );
    const mailingAddress = firstNonEmpty(input.builder.mailingAddress, input.builder.company.mailingAddress);
    const cityState = firstNonEmpty(input.builder.cityState, input.builder.company.cityState);

    return {
      provider: this.key,
      preferredSalesName:
        strongestIdentity?.preferredSalesName ??
        buildPreferredSalesName(strongest?.rawName ?? input.builder.rawSourceName ?? input.builder.company.legalName),
      legalEntityName:
        strongest?.rawName ??
        input.builder.company.legalName ??
        input.builder.rawSourceName ??
        input.builder.name,
      roleType: strongestIdentity?.roleType,
      roleConfidenceDelta,
      entityConfidenceDelta,
      phone,
      email,
      website,
      mailingAddress,
      cityState,
      aliases: distinctRawNames,
      fieldCandidates: [
        {
          fieldName: "preferredSalesName",
          fieldValue:
            strongestIdentity?.preferredSalesName ??
            buildPreferredSalesName(strongest?.rawName ?? input.builder.rawSourceName ?? input.builder.company.legalName),
          confidence: Math.min(100, 55 + entityConfidenceDelta),
          sourceLabel: this.label,
          sourceUrl: strongest?.sourceUrl ?? null,
          rationale: strongest
            ? `Name matched across ${strongest.occurrenceCount} internal record(s) in ${strongest.countyCount} county bucket(s).`
            : "Using the strongest repeated internal company identity."
        },
        {
          fieldName: "phone",
          fieldValue: phone,
          confidence: phone ? 62 : 0,
          sourceLabel: this.label,
          sourceUrl: null,
          rationale: phone ? "Phone carried forward from existing builder/company/contact history." : "No phone found in internal records."
        },
        {
          fieldName: "email",
          fieldValue: email,
          confidence: email ? 58 : 0,
          sourceLabel: this.label,
          sourceUrl: null,
          rationale: email ? "Email carried forward from existing builder/company/contact history." : "No email found in internal records."
        },
        {
          fieldName: "website",
          fieldValue: website,
          confidence: website ? 60 : 0,
          sourceLabel: this.label,
          sourceUrl: website,
          rationale: website ? "Website carried forward from existing builder/company history." : "No website found in internal records."
        }
      ],
      matchCandidates: input.allCandidates.map((candidate, index) => {
        const identity = resolveEntityIdentity({
          builderName: candidate.matchedField === "builder" ? candidate.rawName : null,
          contractorName: candidate.matchedField === "general_contractor" ? candidate.rawName : null,
          developerName: candidate.matchedField === "developer" ? candidate.rawName : null,
          ownerName: candidate.matchedField === "owner" ? candidate.rawName : null
        });

        return {
          rawSourceName: candidate.rawName,
          normalizedEntityName: normalizeEntityName(candidate.rawName),
          preferredSalesName: identity.preferredSalesName,
          fingerprint: normalizeEntityName(candidate.rawName),
          roleType: identity.roleType,
          roleConfidenceScore: Math.min(100, identity.entityConfidenceScore + roleConfidenceDelta),
          matchScore: Math.min(100, candidate.score),
          matchStrategy: "internal-cross-record-match",
          sourceLabel: candidate.sourceLabel,
          sourceUrl: candidate.sourceUrl ?? null,
          rationale: `Seen across ${candidate.occurrenceCount} record(s), ${candidate.cityCount} city bucket(s), and ${candidate.countyCount} county bucket(s).`,
          payload: {
            matchedField: candidate.matchedField,
            propertyCount: candidate.propertyCount
          },
          isPrimary: index === 0
        };
      }),
      nextBestActionHint:
        strongestIdentity?.preferredSalesName && phone
          ? "Call builder"
          : strongestIdentity?.preferredSalesName
            ? "Research phone / website"
            : "Research builder/contractor"
    };
  }
};
