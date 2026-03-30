import { Prisma } from "@prisma/client";

import { ensureBaselineMetadata } from "@/lib/app/defaults";
import { normalizeWhitespace } from "@/lib/connectors/shared/normalization";
import {
  buildPreferredSalesName,
  normalizeEntityName,
  resolveEntityIdentity,
  stripLegalSuffixes
} from "@/lib/entities/contact-identity";
import { prisma } from "@/lib/db/client";
import { internalRecordsProvider } from "@/lib/enrichment/providers/internal-records";
import { iowaBusinessEntityProvider } from "@/lib/enrichment/providers/iowa-business-entity";
import { iowaContractorRegistrationProvider } from "@/lib/enrichment/providers/iowa-contractor-registration";
import { publicContactDiscoveryProvider } from "@/lib/enrichment/providers/public-contact-discovery";
import {
  BuilderEnrichmentContribution,
  BuilderEnrichmentInput,
  BuilderEnrichmentSummary,
  BuilderEnrichmentProvider,
  EnrichmentFieldCandidate,
  EnrichmentMatchCandidate,
  NameCandidate
} from "@/lib/enrichment/types";
import {
  deriveContactResolutionStatus,
  upsertOpportunityContactSnapshot
} from "@/lib/opportunities/workflow-artifacts";
import {
  resolveReviewQueueItems,
  upsertReviewQueueItem
} from "@/lib/review/review-queue";
import {
  ContactQualityBand,
  ContactQualityTier,
  EntityRoleType,
  RegistrationStatus
} from "@/types/domain";

const providers: BuilderEnrichmentProvider[] = [
  internalRecordsProvider,
  iowaBusinessEntityProvider,
  iowaContractorRegistrationProvider,
  publicContactDiscoveryProvider
];

const opportunityInclude = {
  source: true,
  permit: true
} satisfies Prisma.PlotOpportunityInclude;

type BuilderSnapshot = Prisma.BuilderGetPayload<{
  include: {
    company: true;
    aliases: true;
    contacts: true;
    plotOpportunities: {
      include: typeof opportunityInclude;
    };
  };
}>;

const sourceFieldWeight: Record<NameCandidate["matchedField"], number> = {
  builder: 32,
  general_contractor: 28,
  developer: 22,
  owner: 10,
  unknown: 6
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function toNullableJson(value: Record<string, unknown> | null | undefined) {
  return value ? (value as Prisma.InputJsonValue) : Prisma.JsonNull;
}

function buildFingerprint(value: string | null | undefined) {
  return normalizeEntityName(stripLegalSuffixes(value))
    .replace(/\bet al\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isHoldingCompanyName(value: string | null | undefined) {
  return /\b(holding|holdings|trust|properties|property|investments|investment|land)\b/i.test(
    normalizeWhitespace(value)
  );
}

function isBuilderLikeName(value: string | null | undefined) {
  return /\b(builder|builders|homes|homebuilders|construction|contracting|contractor|development|developer|communities)\b/i.test(
    normalizeWhitespace(value)
  );
}

function isOrganizationName(value: string | null | undefined) {
  return /\b(llc|l\.l\.c\.|inc|corp|corporation|co|company|group|partners|pllc|llp|lp)\b/i.test(
    normalizeWhitespace(value)
  );
}

function isLikelyPersonName(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return (
    Boolean(normalized) &&
    tokens.length >= 2 &&
    tokens.length <= 4 &&
    tokens.every((token) => /^[A-Z][a-z'.-]+$/.test(token) || /^[A-Z]\.?$/.test(token))
  );
}

function normalizeDisplayName(value: string | null | undefined) {
  return buildPreferredSalesName(value) ?? (normalizeWhitespace(value) || null);
}

function contactTierFromBand(band: ContactQualityBand): ContactQualityTier {
  if (band === "tier_1") {
    return "high";
  }

  if (band === "tier_2") {
    return "medium";
  }

  if (band === "tier_3") {
    return "low";
  }

  return "research_required";
}

function deriveContactQuality(input: {
  preferredSalesName: string | null;
  roleType: EntityRoleType;
  phone: string | null;
  email: string | null;
  website: string | null;
}) {
  if (input.preferredSalesName && input.phone && input.website) {
    return {
      band: "tier_1" as const,
      tier: "high" as const,
      score: 96
    };
  }

  if (
    input.preferredSalesName &&
    ["builder", "general_contractor", "developer"].includes(input.roleType) &&
    (input.phone || input.website)
  ) {
    return {
      band: "tier_2" as const,
      tier: "medium" as const,
      score: 78
    };
  }

  if (input.preferredSalesName) {
    return {
      band: "tier_3" as const,
      tier: "low" as const,
      score: 56
    };
  }

  if (["owner", "holding_company", "person"].includes(input.roleType)) {
    return {
      band: "tier_4" as const,
      tier: "research_required" as const,
      score: 28
    };
  }

  return {
    band: "tier_5" as const,
    tier: "research_required" as const,
    score: 10
  };
}

function deriveNextBestAction(input: {
  preferredSalesName: string | null;
  roleType: EntityRoleType;
  phone: string | null;
  email: string | null;
  signalDates: Date[];
}) {
  const newestSignal = [...input.signalDates].sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const stale =
    newestSignal != null
      ? Date.now() - newestSignal.getTime() > 1000 * 60 * 60 * 24 * 45
      : false;

  if (input.preferredSalesName && input.phone) {
    return "Call builder";
  }

  if (input.preferredSalesName) {
    return "Research phone / website";
  }

  if (["owner", "holding_company", "person"].includes(input.roleType)) {
    return "Research builder/contractor";
  }

  return stale ? "Watch only or deprioritize" : "Research contact";
}

function deriveBuilderHeat(opportunities: BuilderSnapshot["plotOpportunities"]) {
  const activeOpportunities = opportunities.filter((opportunity) => !["WON", "LOST", "NOT_A_FIT"].includes(opportunity.bidStatus));
  const activeProperties = new Set(activeOpportunities.map((item) => item.propertyId).filter(Boolean));
  const counties = new Set(activeOpportunities.map((item) => item.county).filter(Boolean));
  const cities = new Set(activeOpportunities.map((item) => item.city).filter(Boolean));
  const recentCount = activeOpportunities.filter((item) => Date.now() - item.signalDate.getTime() < 1000 * 60 * 60 * 24 * 30).length;
  const totalValue = activeOpportunities.reduce(
    (sum, item) => sum + Number(item.permit?.estimatedProjectValue ?? item.permit?.improvementValue ?? 0),
    0
  );

  return clamp(
    activeProperties.size * 12 +
      counties.size * 12 +
      cities.size * 4 +
      recentCount * 7 +
      Math.min(18, Math.round(totalValue / 150000))
  );
}

function collectNameCandidates(builder: BuilderSnapshot): NameCandidate[] {
  const collected = new Map<
    string,
    NameCandidate & { counties: Set<string>; cities: Set<string>; properties: Set<string>; maxFieldWeight: number }
  >();

  function pushCandidate(input: {
    rawName: string | null | undefined;
    matchedField: NameCandidate["matchedField"];
    sourceLabel: string;
    sourceUrl?: string | null;
    county?: string | null;
    city?: string | null;
    propertyKey?: string | null;
  }) {
    const rawName = normalizeWhitespace(input.rawName);

    if (!rawName) {
      return;
    }

    const key = `${buildFingerprint(rawName)}::${input.matchedField}`;
    const existing = collected.get(key);

    if (existing) {
      existing.occurrenceCount += 1;
      if (input.county) existing.counties.add(input.county);
      if (input.city) existing.cities.add(input.city);
      if (input.propertyKey) existing.properties.add(input.propertyKey);
      existing.maxFieldWeight = Math.max(existing.maxFieldWeight, sourceFieldWeight[input.matchedField]);
      existing.sourceUrl = existing.sourceUrl ?? input.sourceUrl ?? null;
      return;
    }

    collected.set(key, {
      rawName,
      matchedField: input.matchedField,
      sourceLabel: input.sourceLabel,
      sourceUrl: input.sourceUrl ?? null,
      occurrenceCount: 1,
      countyCount: input.county ? 1 : 0,
      cityCount: input.city ? 1 : 0,
      propertyCount: input.propertyKey ? 1 : 0,
      score: 0,
      counties: new Set(input.county ? [input.county] : []),
      cities: new Set(input.city ? [input.city] : []),
      properties: new Set(input.propertyKey ? [input.propertyKey] : []),
      maxFieldWeight: sourceFieldWeight[input.matchedField]
    });
  }

  pushCandidate({
    rawName: builder.rawSourceName,
    matchedField: "builder",
    sourceLabel: "Builder record"
  });
  pushCandidate({
    rawName: builder.name,
    matchedField: "builder",
    sourceLabel: "Builder record"
  });
  pushCandidate({
    rawName: builder.company?.rawSourceName,
    matchedField: "builder",
    sourceLabel: "Company record"
  });
  pushCandidate({
    rawName: builder.company?.legalName,
    matchedField: "builder",
    sourceLabel: "Company record"
  });

  for (const alias of builder.aliases) {
    pushCandidate({
      rawName: alias.rawName,
      matchedField: "builder",
      sourceLabel: alias.sourceLabel ?? "Stored alias",
      sourceUrl: alias.sourceUrl ?? null
    });
  }

  for (const opportunity of builder.plotOpportunities) {
    const propertyKey = opportunity.parcelNumber ?? opportunity.address ?? opportunity.id;

    pushCandidate({
      rawName: opportunity.rawSourceName,
      matchedField: "builder",
      sourceLabel: opportunity.source?.name ?? "Opportunity record",
      sourceUrl: opportunity.source?.sourceUrl ?? opportunity.sourceUrl ?? null,
      county: opportunity.county,
      city: opportunity.city,
      propertyKey
    });
    pushCandidate({
      rawName: opportunity.builderName,
      matchedField: "builder",
      sourceLabel: opportunity.source?.name ?? "Opportunity record",
      sourceUrl: opportunity.source?.sourceUrl ?? opportunity.sourceUrl ?? null,
      county: opportunity.county,
      city: opportunity.city,
      propertyKey
    });
    pushCandidate({
      rawName: opportunity.likelyCompanyName,
      matchedField: "builder",
      sourceLabel: opportunity.source?.name ?? "Opportunity record",
      sourceUrl: opportunity.source?.sourceUrl ?? opportunity.sourceUrl ?? null,
      county: opportunity.county,
      city: opportunity.city,
      propertyKey
    });
    pushCandidate({
      rawName: opportunity.legalEntityName,
      matchedField: "builder",
      sourceLabel: opportunity.source?.name ?? "Opportunity record",
      sourceUrl: opportunity.source?.sourceUrl ?? opportunity.sourceUrl ?? null,
      county: opportunity.county,
      city: opportunity.city,
      propertyKey
    });
    pushCandidate({
      rawName: opportunity.permit?.contractorName,
      matchedField: "general_contractor",
      sourceLabel: opportunity.source?.name ?? "Permit record",
      sourceUrl: opportunity.permit?.sourceUrl ?? opportunity.source?.sourceUrl ?? null,
      county: opportunity.county,
      city: opportunity.city,
      propertyKey
    });
    pushCandidate({
      rawName: opportunity.permit?.developerName,
      matchedField: "developer",
      sourceLabel: opportunity.source?.name ?? "Permit record",
      sourceUrl: opportunity.permit?.sourceUrl ?? opportunity.source?.sourceUrl ?? null,
      county: opportunity.county,
      city: opportunity.city,
      propertyKey
    });
    pushCandidate({
      rawName: opportunity.permit?.ownerName,
      matchedField: "owner",
      sourceLabel: opportunity.source?.name ?? "Permit record",
      sourceUrl: opportunity.permit?.sourceUrl ?? opportunity.source?.sourceUrl ?? null,
      county: opportunity.county,
      city: opportunity.city,
      propertyKey
    });
  }

  return [...collected.values()]
    .map((candidate) => {
      const builderLikeBoost = isBuilderLikeName(candidate.rawName) ? 20 : 0;
      const organizationBoost = isOrganizationName(candidate.rawName) ? 8 : 0;
      const holdingPenalty = isHoldingCompanyName(candidate.rawName) ? -18 : 0;
      const personPenalty = isLikelyPersonName(candidate.rawName) ? -12 : 0;
      const score =
        candidate.maxFieldWeight +
        candidate.occurrenceCount * 8 +
        candidate.counties.size * 8 +
        candidate.cities.size * 4 +
        candidate.properties.size * 3 +
        builderLikeBoost +
        organizationBoost +
        holdingPenalty +
        personPenalty;

      return {
        rawName: candidate.rawName,
        matchedField: candidate.matchedField,
        sourceLabel: candidate.sourceLabel,
        sourceUrl: candidate.sourceUrl ?? null,
        occurrenceCount: candidate.occurrenceCount,
        countyCount: candidate.counties.size,
        cityCount: candidate.cities.size,
        propertyCount: candidate.properties.size,
        score
      } satisfies NameCandidate;
    })
    .sort((left, right) => right.score - left.score);
}

function toPrismaRole(value: EntityRoleType) {
  return value.toUpperCase() as never;
}

function toPrismaQualityTier(value: ContactQualityTier) {
  return value.toUpperCase() as never;
}

function toPrismaQualityBand(value: ContactQualityBand) {
  return value.toUpperCase() as never;
}

function toPrismaRegistrationStatus(value: RegistrationStatus) {
  return value.toUpperCase() as never;
}

function toPrismaContactResolutionStatus(
  value: ReturnType<typeof deriveContactResolutionStatus>
) {
  if (value === "resolved") return "RESOLVED" as const;
  if (value === "builder_only") return "BUILDER_ONLY" as const;
  if (value === "weak_entity") return "WEAK_ENTITY" as const;
  return "UNKNOWN" as const;
}

async function upsertCompanyForSummary(
  organizationId: string,
  summary: BuilderEnrichmentSummary,
  existingCompanyId: string | null
) {
  if (!summary.normalizedEntityName) {
    return existingCompanyId ? prisma.company.findUnique({ where: { id: existingCompanyId } }) : null;
  }

  return prisma.company.upsert({
    where: {
      organizationId_normalizedName: {
        organizationId,
        normalizedName: summary.normalizedEntityName
      }
    },
    update: {
      legalName: summary.legalEntityName ?? summary.preferredSalesName ?? summary.rawSourceName ?? summary.normalizedEntityName,
      rawSourceName: summary.rawSourceName,
      rawSourceNames: [...new Set([summary.rawSourceName, ...summary.aliases].filter((value): value is string => Boolean(value)))],
      preferredSalesName: summary.preferredSalesName,
      roleType: toPrismaRole(summary.roleType),
      contactQualityTier: toPrismaQualityTier(summary.contactQualityTier),
      preferredContactTarget: summary.preferredContactTarget,
      entityConfidenceScore: summary.entityConfidenceScore,
      phone: summary.phone,
      email: summary.email,
      website: summary.website,
      mailingAddress: summary.mailingAddress,
      cityState: summary.cityState,
      contractorRegistrationNumber: summary.contractorRegistrationNumber,
      contractorRegistrationStatus: toPrismaRegistrationStatus(summary.contractorRegistrationStatus),
      businessEntityNumber: summary.businessEntityNumber,
      businessEntityStatus: toPrismaRegistrationStatus(summary.businessEntityStatus),
      roleConfidenceScore: summary.roleConfidenceScore,
      contactQualityScore: summary.contactQualityScore,
      contactQualityBand: toPrismaQualityBand(summary.contactQualityBand),
      contactSource: summary.fieldCandidates[0]?.sourceLabel ?? null,
      contactUrl: summary.fieldCandidates.find((item) => item.fieldName === "website")?.sourceUrl ?? null,
      lastEnrichedAt: new Date(),
      lastVerifiedAt: summary.fieldCandidates.find((item) => item.lastVerifiedAt)?.lastVerifiedAt ?? new Date(),
      matchProvenance: toNullableJson({
        nextBestAction: summary.nextBestAction,
        aliases: summary.aliases,
        builderHeatScore: summary.builderHeatScore
      })
    },
    create: {
      organizationId,
      legalName: summary.legalEntityName ?? summary.preferredSalesName ?? summary.rawSourceName ?? summary.normalizedEntityName,
      normalizedName: summary.normalizedEntityName,
      rawSourceName: summary.rawSourceName,
      rawSourceNames: [...new Set([summary.rawSourceName, ...summary.aliases].filter((value): value is string => Boolean(value)))],
      preferredSalesName: summary.preferredSalesName,
      roleType: toPrismaRole(summary.roleType),
      contactQualityTier: toPrismaQualityTier(summary.contactQualityTier),
      preferredContactTarget: summary.preferredContactTarget,
      entityConfidenceScore: summary.entityConfidenceScore,
      phone: summary.phone,
      email: summary.email,
      website: summary.website,
      mailingAddress: summary.mailingAddress,
      cityState: summary.cityState,
      contractorRegistrationNumber: summary.contractorRegistrationNumber,
      contractorRegistrationStatus: toPrismaRegistrationStatus(summary.contractorRegistrationStatus),
      businessEntityNumber: summary.businessEntityNumber,
      businessEntityStatus: toPrismaRegistrationStatus(summary.businessEntityStatus),
      roleConfidenceScore: summary.roleConfidenceScore,
      contactQualityScore: summary.contactQualityScore,
      contactQualityBand: toPrismaQualityBand(summary.contactQualityBand),
      contactSource: summary.fieldCandidates[0]?.sourceLabel ?? null,
      contactUrl: summary.fieldCandidates.find((item) => item.fieldName === "website")?.sourceUrl ?? null,
      lastEnrichedAt: new Date(),
      lastVerifiedAt: summary.fieldCandidates.find((item) => item.lastVerifiedAt)?.lastVerifiedAt ?? new Date(),
      matchProvenance: toNullableJson({
        nextBestAction: summary.nextBestAction,
        aliases: summary.aliases,
        builderHeatScore: summary.builderHeatScore
      })
    }
  });
}

async function mergeBuilderIntoCanonical(canonicalId: string, duplicateId: string) {
  if (canonicalId === duplicateId) {
    return;
  }

  await prisma.permit.updateMany({
    where: { builderId: duplicateId },
    data: { builderId: canonicalId }
  });

  await prisma.plotOpportunity.updateMany({
    where: { builderId: duplicateId },
    data: { builderId: canonicalId }
  });

  await prisma.contact.updateMany({
    where: { builderId: duplicateId },
    data: { builderId: canonicalId }
  });

  await prisma.lead.updateMany({
    where: { builderId: duplicateId },
    data: { builderId: canonicalId }
  });

  await prisma.builderAlias.updateMany({
    where: { builderId: duplicateId },
    data: { builderId: canonicalId }
  });

  await prisma.entityMatch.updateMany({
    where: { builderId: duplicateId },
    data: { builderId: canonicalId }
  });

  await prisma.enrichmentResult.updateMany({
    where: { builderId: duplicateId },
    data: { builderId: canonicalId }
  });

  await prisma.builder.delete({
    where: { id: duplicateId }
  });
}

async function upsertBuilderForSummary(
  organizationId: string,
  builder: BuilderSnapshot,
  companyId: string | null,
  summary: BuilderEnrichmentSummary
) {
  const canonical =
    summary.normalizedEntityName
      ? await prisma.builder.findFirst({
          where: {
            organizationId,
            normalizedName: summary.normalizedEntityName
          }
        })
      : null;
  const canonicalId = canonical?.id ?? builder.id;

  if (canonical && canonical.id !== builder.id) {
    await mergeBuilderIntoCanonical(canonical.id, builder.id);
  }

  const updated = await prisma.builder.update({
    where: {
      id: canonicalId
    },
    data: {
      companyId,
      name: summary.legalEntityName ?? summary.preferredSalesName ?? builder.name,
      normalizedName: summary.normalizedEntityName ?? builder.normalizedName,
      rawSourceName: summary.rawSourceName,
      rawSourceNames: [...new Set([summary.rawSourceName, ...summary.aliases].filter((value): value is string => Boolean(value)))],
      preferredSalesName: summary.preferredSalesName,
      roleType: toPrismaRole(summary.roleType),
      contactQualityTier: toPrismaQualityTier(summary.contactQualityTier),
      preferredContactTarget: summary.preferredContactTarget,
      phone: summary.phone,
      email: summary.email,
      website: summary.website,
      mailingAddress: summary.mailingAddress,
      cityState: summary.cityState,
      contractorRegistrationNumber: summary.contractorRegistrationNumber,
      contractorRegistrationStatus: toPrismaRegistrationStatus(summary.contractorRegistrationStatus),
      businessEntityNumber: summary.businessEntityNumber,
      businessEntityStatus: toPrismaRegistrationStatus(summary.businessEntityStatus),
      confidenceScore: summary.entityConfidenceScore,
      roleConfidenceScore: summary.roleConfidenceScore,
      contactQualityScore: summary.contactQualityScore,
      contactQualityBand: toPrismaQualityBand(summary.contactQualityBand),
      builderHeatScore: summary.builderHeatScore,
      nextBestAction: summary.nextBestAction,
      lastEnrichedAt: new Date(),
      lastVerifiedAt: summary.fieldCandidates.find((item) => item.lastVerifiedAt)?.lastVerifiedAt ?? new Date(),
      matchProvenance: toNullableJson({
        nextBestAction: summary.nextBestAction,
        aliases: summary.aliases,
        matchCount: summary.matchCandidates.length
      })
    }
  });

  return updated;
}

async function syncAliases(builderId: string, aliases: string[]) {
  const existing = await prisma.builderAlias.findMany({
    where: { builderId }
  });
  const existingByRaw = new Map(existing.map((alias) => [alias.rawName, alias]));

  for (const rawName of aliases) {
    const normalized = normalizeWhitespace(rawName);

    if (!normalized) {
      continue;
    }

    const current = existingByRaw.get(normalized);
    const data = {
      normalizedName: normalizeEntityName(normalized),
      fingerprint: buildFingerprint(normalized),
      sourceLabel: current?.sourceLabel ?? "Builder enrichment engine",
      sourceUrl: current?.sourceUrl ?? null,
      lastSeenAt: new Date()
    };

    if (current) {
      await prisma.builderAlias.update({
        where: { id: current.id },
        data
      });
      continue;
    }

    await prisma.builderAlias.create({
      data: {
        builderId,
        rawName: normalized,
        ...data
      }
    });
  }
}

async function syncPrimaryContact(
  organizationId: string,
  builderId: string,
  companyId: string | null,
  summary: BuilderEnrichmentSummary
) {
  const existing = await prisma.contact.findFirst({
    where: {
      builderId,
      isPrimary: true
    }
  });
  const websiteAudit = summary.fieldCandidates.find((item) => item.fieldName === "website");
  const contact = {
    organizationId,
    builderId,
    companyId,
    fullName: summary.preferredSalesName ?? summary.legalEntityName ?? "Unknown Builder",
    email: summary.email,
    phone: summary.phone,
    roleTitle: summary.roleType.replaceAll("_", " "),
    publicProfileUrl: summary.website,
    mailingAddress: summary.mailingAddress,
    cityState: summary.cityState,
    sourceLabel: websiteAudit?.sourceLabel ?? summary.fieldCandidates[0]?.sourceLabel ?? "Builder enrichment engine",
    sourceUrl: websiteAudit?.sourceUrl ?? summary.website ?? null,
    qualityScore: summary.contactQualityScore,
    qualityBand: toPrismaQualityBand(summary.contactQualityBand),
    isPrimary: true,
    lastVerifiedAt: summary.fieldCandidates.find((item) => item.lastVerifiedAt)?.lastVerifiedAt ?? new Date(),
    lastEnrichedAt: new Date()
  };

  return existing
    ? prisma.contact.update({
        where: { id: existing.id },
        data: contact
      })
    : prisma.contact.create({
        data: contact
      });
}

async function syncEntityMatches(
  organizationId: string,
  builderId: string,
  companyId: string | null,
  opportunityIds: string[],
  matches: EnrichmentMatchCandidate[]
) {
  await prisma.entityMatch.deleteMany({
    where: {
      OR: [
        { builderId },
        companyId ? { companyId } : undefined,
        opportunityIds.length ? { plotOpportunityId: { in: opportunityIds } } : undefined
      ].filter(Boolean) as Prisma.EntityMatchWhereInput[]
    }
  });

  if (!matches.length) {
    return;
  }

  for (const match of matches) {
    await prisma.entityMatch.create({
      data: {
        organizationId,
        builderId,
        companyId,
        rawSourceName: match.rawSourceName,
        normalizedEntityName: match.normalizedEntityName,
        preferredSalesName: match.preferredSalesName,
        fingerprint: match.fingerprint,
        roleType: toPrismaRole(match.roleType),
        roleConfidenceScore: match.roleConfidenceScore,
        matchScore: match.matchScore,
        matchStrategy: match.matchStrategy,
        sourceLabel: match.sourceLabel,
        sourceUrl: match.sourceUrl ?? null,
        rationale: match.rationale,
        payload: (match.payload as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        isPrimary: Boolean(match.isPrimary),
        lastCheckedAt: new Date()
      }
    });
  }
}

async function syncEnrichmentAudit(
  organizationId: string,
  builderId: string,
  companyId: string | null,
  opportunityIds: string[],
  fields: EnrichmentFieldCandidate[]
) {
  await prisma.enrichmentResult.deleteMany({
    where: {
      OR: [
        { builderId },
        companyId ? { companyId } : undefined,
        opportunityIds.length ? { plotOpportunityId: { in: opportunityIds } } : undefined
      ].filter(Boolean) as Prisma.EnrichmentResultWhereInput[]
    }
  });

  for (const field of fields) {
    await prisma.enrichmentResult.create({
      data: {
        organizationId,
        builderId,
        companyId,
        provider: field.sourceLabel,
        fieldName: field.fieldName,
        fieldValue: field.fieldValue,
        sourceLabel: field.sourceLabel,
        sourceUrl: field.sourceUrl ?? null,
        rationale: field.rationale,
        payload: (field.payload as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        confidence: field.confidence,
        refreshedAt: new Date(),
        lastVerifiedAt: field.lastVerifiedAt ?? null
      }
    });
  }
}

async function syncOpportunities(builderId: string, summary: BuilderEnrichmentSummary, opportunityIds: string[]) {
  if (!opportunityIds.length) {
    return;
  }

  const resolutionStatus = deriveContactResolutionStatus({
    roleType: summary.roleType,
    preferredSalesName: summary.preferredSalesName,
    entityConfidenceScore: summary.entityConfidenceScore,
    primaryPhone: summary.phone,
    primaryEmail: summary.email,
    primaryWebsite: summary.website
  });

  await prisma.plotOpportunity.updateMany({
    where: {
      id: {
        in: opportunityIds
      }
    },
    data: {
      builderId,
      builderName: summary.legalEntityName ?? summary.preferredSalesName ?? summary.rawSourceName,
      likelyCompanyName: summary.legalEntityName ?? summary.preferredSalesName,
      rawSourceName: summary.rawSourceName,
      normalizedEntityName: summary.normalizedEntityName,
      preferredSalesName: summary.preferredSalesName,
      legalEntityName: summary.legalEntityName,
      roleType: toPrismaRole(summary.roleType),
      entityConfidenceScore: summary.entityConfidenceScore,
      roleConfidenceScore: summary.roleConfidenceScore,
      contactQualityTier: toPrismaQualityTier(summary.contactQualityTier),
      contactQualityScore: summary.contactQualityScore,
      contactQualityBand: toPrismaQualityBand(summary.contactQualityBand),
      preferredContactTarget: summary.preferredContactTarget,
      contractorRegistrationNumber: summary.contractorRegistrationNumber,
      contractorRegistrationStatus: toPrismaRegistrationStatus(summary.contractorRegistrationStatus),
      businessEntityNumber: summary.businessEntityNumber,
      businessEntityStatus: toPrismaRegistrationStatus(summary.businessEntityStatus),
      mailingAddress: summary.mailingAddress,
      cityState: summary.cityState,
      nextAction: summary.nextBestAction,
      contactResolutionStatus: toPrismaContactResolutionStatus(resolutionStatus),
      lastContactResolutionRunAt: new Date(),
      lastEnrichedAt: new Date(),
      matchProvenance: toNullableJson({
        builderHeatScore: summary.builderHeatScore,
        aliases: summary.aliases,
        preferredContactTarget: summary.preferredContactTarget
      })
    }
  });
}

async function syncOpportunityContactSnapshots(
  organizationId: string,
  builderId: string,
  primaryContact: { id: string; fullName: string | null } | null,
  summary: BuilderEnrichmentSummary,
  opportunityIds: string[]
) {
  const resolutionStatus = deriveContactResolutionStatus({
    roleType: summary.roleType,
    preferredSalesName: summary.preferredSalesName,
    entityConfidenceScore: summary.entityConfidenceScore,
    primaryPhone: summary.phone,
    primaryEmail: summary.email,
    primaryWebsite: summary.website
  });
  const resolutionNotes =
    resolutionStatus === "resolved"
      ? "Builder identity and primary contact channel are strong enough for outreach."
      : resolutionStatus === "builder_only"
        ? "Builder identity is strong, but direct contact information still needs strengthening."
        : resolutionStatus === "weak_entity"
          ? "The best-known entity still looks like an owner, holding company, or person-only record."
          : "Builder/contact resolution is still incomplete and should be reviewed.";

  for (const opportunityId of opportunityIds) {
    await upsertOpportunityContactSnapshot(prisma, {
      organizationId,
      opportunityId,
      primaryEntityId: builderId,
      primaryEntityName: summary.preferredSalesName ?? summary.legalEntityName ?? summary.rawSourceName,
      primaryContactId: primaryContact?.id ?? null,
      primaryContactName: primaryContact?.fullName ?? null,
      primaryPhone: summary.phone,
      primaryEmail: summary.email,
      primaryWebsite: summary.website,
      contactQualityTier: toPrismaQualityTier(summary.contactQualityTier),
      contactQualityBand: toPrismaQualityBand(summary.contactQualityBand),
      contactQualityScore: summary.contactQualityScore,
      entityConfidenceScore: summary.entityConfidenceScore,
      nextBestAction: summary.nextBestAction,
      contactResolutionStatus: toPrismaContactResolutionStatus(resolutionStatus),
      resolutionNotes,
      lastContactResolutionRunAt: new Date()
    });
  }
}

async function syncOpportunityReviewQueue(
  organizationId: string,
  sourceLabel: string,
  summary: BuilderEnrichmentSummary,
  opportunityIds: string[],
  builderId: string
) {
  const ambiguous =
    summary.matchCandidates.length > 1 &&
    Math.abs(summary.matchCandidates[0]!.matchScore - summary.matchCandidates[1]!.matchScore) <= 6;
  const hasContactChannel = Boolean(summary.phone || summary.email || summary.website);
  const weakIdentity = !summary.preferredSalesName || summary.entityConfidenceScore < 64;
  const holdingLike = ["holding_company", "owner", "person", "unknown"].includes(summary.roleType);

  for (const opportunityId of opportunityIds) {
    if (weakIdentity || holdingLike) {
      await upsertReviewQueueItem(prisma, {
        organizationId,
        reviewType: "WEAK_IDENTITY",
        title: "Research builder identity",
        details: summary.rawSourceName ?? summary.legalEntityName ?? "Unknown entity",
        rationale: "The enrichment engine could not promote this record to a confident builder/company identity yet.",
        builderId,
        opportunityId,
        fingerprint: `${builderId}:weak-identity`,
        confidenceScore: summary.entityConfidenceScore,
        priority: 82
      });
    } else {
      await resolveReviewQueueItems(prisma, {
        organizationId,
        reviewType: "WEAK_IDENTITY",
        opportunityId
      });
    }

    if (!hasContactChannel) {
      await upsertReviewQueueItem(prisma, {
        organizationId,
        reviewType: "MISSING_CONTACT",
        title: "Research builder contact",
        details: summary.preferredSalesName ?? summary.legalEntityName ?? "Unknown Builder",
        rationale: "The builder/company identity is present, but no strong phone, email, or website is attached yet.",
        builderId,
        opportunityId,
        fingerprint: `${builderId}:missing-contact`,
        confidenceScore: summary.contactQualityScore,
        priority: 72
      });
    } else {
      await resolveReviewQueueItems(prisma, {
        organizationId,
        reviewType: "MISSING_CONTACT",
        opportunityId
      });
    }

    if (ambiguous) {
      await upsertReviewQueueItem(prisma, {
        organizationId,
        reviewType: "AMBIGUOUS_MATCH",
        title: "Review ambiguous builder match",
        details: summary.preferredSalesName ?? summary.legalEntityName ?? "Ambiguous entity",
        rationale: `Multiple enrichment candidates scored closely for ${sourceLabel}.`,
        builderId,
        opportunityId,
        fingerprint: `${builderId}:ambiguous-match`,
        confidenceScore: summary.entityConfidenceScore,
        priority: 68
      });
    } else {
      await resolveReviewQueueItems(prisma, {
        organizationId,
        reviewType: "AMBIGUOUS_MATCH",
        opportunityId
      });
    }
  }
}

async function loadBuilderSnapshots(organizationId: string, builderIds?: string[]) {
  return prisma.builder.findMany({
    where: {
      organizationId,
      ...(builderIds?.length ? { id: { in: builderIds } } : {})
    },
    include: {
      company: true,
      aliases: true,
      contacts: true,
      plotOpportunities: {
        include: opportunityInclude
      }
    },
    orderBy: {
      normalizedName: "asc"
    }
  });
}

async function summarizeBuilder(builder: BuilderSnapshot): Promise<BuilderEnrichmentSummary> {
  const allCandidates = collectNameCandidates(builder);
  const primaryCandidate = allCandidates[0] ?? null;
  const identity = resolveEntityIdentity({
    builderName: primaryCandidate?.matchedField === "builder" ? primaryCandidate.rawName : null,
    contractorName: primaryCandidate?.matchedField === "general_contractor" ? primaryCandidate.rawName : null,
    developerName: primaryCandidate?.matchedField === "developer" ? primaryCandidate.rawName : null,
    ownerName: primaryCandidate?.matchedField === "owner" ? primaryCandidate.rawName : null
  });
  const providerInput: BuilderEnrichmentInput = {
    organizationId: builder.organizationId,
    builder: {
      id: builder.id,
      normalizedName: builder.normalizedName,
      name: builder.name,
      rawSourceName: builder.rawSourceName,
      preferredSalesName: builder.preferredSalesName,
      roleType: builder.roleType.toLowerCase() as EntityRoleType,
      confidenceScore: builder.confidenceScore,
      phone: builder.phone,
      email: builder.email,
      website: builder.website,
      mailingAddress: builder.mailingAddress,
      cityState: builder.cityState,
      company: {
        id: builder.company?.id ?? null,
        legalName: builder.company?.legalName ?? null,
        rawSourceName: builder.company?.rawSourceName ?? null,
        preferredSalesName: builder.company?.preferredSalesName ?? null,
        phone: builder.company?.phone ?? null,
        email: builder.company?.email ?? null,
        website: builder.company?.website ?? null,
        mailingAddress: builder.company?.mailingAddress ?? null,
        cityState: builder.company?.cityState ?? null
      },
      contacts: builder.contacts.map((contact) => ({
        id: contact.id,
        fullName: contact.fullName,
        phone: contact.phone,
        email: contact.email,
        roleTitle: contact.roleTitle,
        sourceLabel: contact.sourceLabel,
        sourceUrl: contact.sourceUrl,
        isPrimary: contact.isPrimary
      })),
      aliases: builder.aliases.map((alias) => ({
        rawName: alias.rawName,
        normalizedName: alias.normalizedName,
        fingerprint: alias.fingerprint,
        sourceLabel: alias.sourceLabel,
        sourceUrl: alias.sourceUrl
      })),
      opportunities: builder.plotOpportunities.map((opportunity) => ({
        id: opportunity.id,
        address: opportunity.address,
        city: opportunity.city,
        county: opportunity.county,
        parcelNumber: opportunity.parcelNumber,
        signalDate: opportunity.signalDate,
        rawSourceName: opportunity.rawSourceName,
        builderName: opportunity.builderName,
        likelyCompanyName: opportunity.likelyCompanyName,
        legalEntityName: opportunity.legalEntityName,
        phone: null,
        email: null,
        website: null,
        permit: opportunity.permit
          ? {
              ownerName: opportunity.permit.ownerName,
              contractorName: opportunity.permit.contractorName,
              developerName: opportunity.permit.developerName,
              estimatedProjectValue: Number(opportunity.permit.estimatedProjectValue ?? 0) || null
            }
          : null,
        source: opportunity.source
          ? {
              name: opportunity.source.name,
              sourceUrl: opportunity.source.sourceUrl
            }
          : null
      }))
    },
    primaryCandidate,
    allCandidates
  };

  const contributions = await Promise.all(providers.map((provider) => provider.enrich(providerInput)));
  const fieldCandidates = contributions.flatMap((contribution) => contribution.fieldCandidates ?? []);
  const matchCandidates = contributions.flatMap((contribution) => contribution.matchCandidates ?? []);
  const aliases = [...new Set([...(contributions.flatMap((contribution) => contribution.aliases ?? [])), ...allCandidates.map((item) => item.rawName)])];
  const rawPreferredSalesName =
    contributions.find((contribution) => contribution.preferredSalesName)?.preferredSalesName ??
    identity.preferredSalesName ??
    primaryCandidate?.rawName ??
    builder.name;
  const preferredSalesName = normalizeDisplayName(rawPreferredSalesName);
  const legalEntityName =
    contributions.find((contribution) => contribution.legalEntityName)?.legalEntityName ??
    primaryCandidate?.rawName ??
    builder.company?.legalName ??
    builder.name;
  const phone =
    contributions.find((contribution) => contribution.phone)?.phone ??
    builder.phone ??
    builder.company?.phone ??
    null;
  const email =
    contributions.find((contribution) => contribution.email)?.email ??
    builder.email ??
    builder.company?.email ??
    null;
  const website =
    contributions.find((contribution) => contribution.website)?.website ??
    builder.website ??
    builder.company?.website ??
    null;
  const mailingAddress =
    contributions.find((contribution) => contribution.mailingAddress)?.mailingAddress ??
    builder.mailingAddress ??
    builder.company?.mailingAddress ??
    null;
  const cityState =
    contributions.find((contribution) => contribution.cityState)?.cityState ??
    builder.cityState ??
    builder.company?.cityState ??
    null;
  const derivedRoleType =
    contributions.find((contribution) => contribution.roleType)?.roleType ??
    identity.roleType ??
    "unknown";
  const entityConfidenceScore = clamp(
    identity.entityConfidenceScore + contributions.reduce((sum, contribution) => sum + (contribution.entityConfidenceDelta ?? 0), 0)
  );
  const roleConfidenceScore = clamp(
    Math.round(entityConfidenceScore * 0.7) +
      contributions.reduce((sum, contribution) => sum + (contribution.roleConfidenceDelta ?? 0), 0)
  );
  const contractorRegistrationNumber =
    contributions.find((contribution) => contribution.contractorRegistrationNumber)?.contractorRegistrationNumber ?? null;
  const contractorRegistrationStatus =
    contributions.find((contribution) => contribution.contractorRegistrationStatus)?.contractorRegistrationStatus ?? "unknown";
  const businessEntityNumber =
    contributions.find((contribution) => contribution.businessEntityNumber)?.businessEntityNumber ?? null;
  const businessEntityStatus =
    contributions.find((contribution) => contribution.businessEntityStatus)?.businessEntityStatus ?? "unknown";
  const hasExternalValidation = Boolean(
    phone ||
      email ||
      website ||
      contractorRegistrationNumber ||
      businessEntityNumber ||
      matchCandidates.length
  );
  const fallbackRoleType =
    primaryCandidate?.matchedField === "general_contractor"
      ? "general_contractor"
      : primaryCandidate?.matchedField === "developer"
        ? "developer"
        : "builder";
  const roleType =
    ["unknown", "owner", "person"].includes(derivedRoleType) &&
    primaryCandidate &&
    !isHoldingCompanyName(primaryCandidate.rawName) &&
    (primaryCandidate.score >= 36 || hasExternalValidation)
      ? fallbackRoleType
      : derivedRoleType;
  const quality = deriveContactQuality({
    preferredSalesName,
    roleType,
    phone,
    email,
    website
  });
  const nextBestAction =
    contributions.find((contribution) => contribution.nextBestActionHint)?.nextBestActionHint ??
    deriveNextBestAction({
      preferredSalesName,
      roleType,
      phone,
      email,
      signalDates: builder.plotOpportunities.map((opportunity) => opportunity.signalDate)
    });

  return {
    rawSourceName: primaryCandidate?.rawName ?? builder.rawSourceName ?? builder.name,
    normalizedEntityName: buildFingerprint(legalEntityName),
    preferredSalesName,
    legalEntityName,
    roleType,
    entityConfidenceScore,
    roleConfidenceScore,
    contactQualityTier: quality.tier,
    contactQualityBand: quality.band,
    contactQualityScore: quality.score,
    preferredContactTarget:
      preferredSalesName && entityConfidenceScore >= 64 ? preferredSalesName : "Unknown Builder",
    phone,
    email,
    website,
    mailingAddress,
    cityState,
    contractorRegistrationNumber,
    contractorRegistrationStatus,
    businessEntityNumber,
    businessEntityStatus,
    builderHeatScore: deriveBuilderHeat(builder.plotOpportunities),
    nextBestAction,
    aliases,
    fieldCandidates,
    matchCandidates: matchCandidates.length
      ? matchCandidates.map((match, index) => ({
          ...match,
          isPrimary: index === 0 ? true : Boolean(match.isPrimary)
        }))
      : primaryCandidate
        ? [
            {
              rawSourceName: primaryCandidate.rawName,
              normalizedEntityName: buildFingerprint(primaryCandidate.rawName),
              preferredSalesName,
              fingerprint: buildFingerprint(primaryCandidate.rawName),
              roleType,
              roleConfidenceScore,
              matchScore: primaryCandidate.score,
              matchStrategy: "primary-name-candidate",
              sourceLabel: primaryCandidate.sourceLabel,
              sourceUrl: primaryCandidate.sourceUrl ?? null,
              rationale: "Primary entity name candidate selected by the builder enrichment engine.",
              isPrimary: true
            }
          ]
        : []
    };
}

export async function runBuilderEnrichment(options?: {
  organizationId?: string;
  builderIds?: string[];
}) {
  const baseline = options?.organizationId
    ? { organizationId: options.organizationId }
    : await ensureBaselineMetadata();
  const builders = await loadBuilderSnapshots(baseline.organizationId, options?.builderIds);
  const summaries: Array<{ builderId: string; preferredSalesName: string | null }> = [];

  for (const builder of builders) {
    const summary = await summarizeBuilder(builder);
    const company = await upsertCompanyForSummary(
      baseline.organizationId,
      summary,
      builder.companyId ?? null
    );
    const updatedBuilder = await upsertBuilderForSummary(
      baseline.organizationId,
      builder,
      company?.id ?? null,
      summary
    );
    const opportunityIds = builder.plotOpportunities.map((opportunity) => opportunity.id);

    await syncAliases(updatedBuilder.id, summary.aliases);
    const primaryContact = await syncPrimaryContact(
      baseline.organizationId,
      updatedBuilder.id,
      company?.id ?? null,
      summary
    );
    await syncEntityMatches(
      baseline.organizationId,
      updatedBuilder.id,
      company?.id ?? null,
      opportunityIds,
      summary.matchCandidates
    );
    await syncEnrichmentAudit(
      baseline.organizationId,
      updatedBuilder.id,
      company?.id ?? null,
      opportunityIds,
      summary.fieldCandidates
    );
    await syncOpportunities(updatedBuilder.id, summary, opportunityIds);
    await syncOpportunityContactSnapshots(
      baseline.organizationId,
      updatedBuilder.id,
      primaryContact
        ? {
            id: primaryContact.id,
            fullName: primaryContact.fullName ?? null
          }
        : null,
      summary,
      opportunityIds
    );
    await syncOpportunityReviewQueue(
      baseline.organizationId,
      builder.name,
      summary,
      opportunityIds,
      updatedBuilder.id
    );

    summaries.push({
      builderId: updatedBuilder.id,
      preferredSalesName: summary.preferredSalesName
    });
  }

  return {
    processed: builders.length,
    summaries
  };
}
