import { Prisma } from "@prisma/client";

import { DEFAULT_OPEN_TERRITORY_LABEL, DEFAULT_ORGANIZATION_SLUG } from "@/lib/app/defaults";
import { persistenceRowToOpportunity } from "@/lib/opportunities/persistence";
import { prisma } from "@/lib/db/client";
import { COUNTIES_NEAR_ME_LABEL } from "@/lib/geo/territories";
import { buildContractorMetrics, hydrateOpportunityIntelligence } from "@/lib/intelligence/lead-intelligence";
import { calculateLeadScore, calculateOpportunityScore } from "@/lib/scoring/lead-scoring";
import { computeSourceHealthScore } from "@/lib/connectors/shared/validation";
import {
  computeLiveDataConfidence,
  evaluateSourceFreshness,
  inferSourceDataOrigin,
  summarizeRawRecordChanges,
  summarizeTransformationConsistency
} from "@/lib/validation/live-data-validation";
import {
  BuilderRecord,
  DashboardSnapshot,
  PermitRecord,
  PlotOpportunity,
  ReviewQueueItemRecord,
  SourceRecord
} from "@/types/domain";

export type OpportunityStatusFilter = "all" | "queue" | "contacted" | "closed";
export type OpportunitySort = "score" | "newest" | "suggested_follow_up" | "inquired_at";

export interface OpportunityQuery {
  county?: string | null;
  city?: string | null;
  jurisdiction?: string | null;
  territory?: string | null;
  search?: string | null;
  jobFit?: PlotOpportunity["jobFit"] | "all" | null;
  recency?: PlotOpportunity["recencyBucket"] | "all" | null;
  minScore?: number | null;
  hasContactInfo?: boolean | null;
  notYetContacted?: boolean | null;
  projectSegment?: "all" | PlotOpportunity["projectSegment"];
  status?: OpportunityStatusFilter;
  sort?: OpportunitySort;
}

const opportunityInclude = {
  property: {
    include: {
      city: true,
      county: true,
      parcel: true
    }
  },
  builder: {
    include: {
      company: true,
      aliases: true,
      contacts: true,
      entityMatches: {
        orderBy: {
          matchScore: "desc"
        }
      },
      enrichmentResults: {
        orderBy: {
          refreshedAt: "desc"
        }
      }
    }
  },
  source: {
    include: {
      jurisdiction: {
        include: {
          city: true,
          county: true
        }
      }
    }
  },
  permit: true,
  assignedMembership: true,
  contacts: {
    orderBy: [
      {
        isPrimary: "desc"
      },
      {
        updatedAt: "desc"
      }
    ]
  },
  activities: {
    include: {
      contact: true,
      createdByMembership: true
    },
    orderBy: {
      occurredAt: "desc"
    }
  },
  contactSnapshot: true,
  stageHistory: {
    include: {
      changedByMembership: true
    },
    orderBy: {
      changedAt: "desc"
    }
  },
  entityMatches: {
    orderBy: {
      matchScore: "desc"
    }
  },
  enrichmentResults: {
    orderBy: {
      refreshedAt: "desc"
    }
  }
} satisfies Prisma.PlotOpportunityInclude;

type OpportunityRow = Prisma.PlotOpportunityGetPayload<{ include: typeof opportunityInclude }>;

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) {
    return null;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildPermitFromOpportunity(opportunity: PlotOpportunity): PermitRecord {
  return {
    id: `${opportunity.id}-permit`,
    permitIdentityKey: opportunity.permitIdentityKey,
    sourceFingerprint: opportunity.sourceFingerprint,
    sourceRecordVersion: opportunity.sourceRecordVersion,
    lastSourceChangedAt: opportunity.lastSourceChangedAt,
    sourceChangeSummary: opportunity.sourceChangeSummary,
    permitNumber: opportunity.permitNumber ?? opportunity.id,
    permitType: opportunity.opportunityType.replaceAll("_", " "),
    permitSubtype: opportunity.classification.replaceAll("_", " "),
    permitStatus: opportunity.buildReadiness.replaceAll("_", " "),
    applicationDate: opportunity.signalDate,
    issueDate: opportunity.signalDate,
    city: opportunity.city || null,
    state: opportunity.addressState,
    zip: opportunity.addressZip,
    contractorName: opportunity.builderName ?? opportunity.preferredSalesName ?? null,
    companyName: opportunity.legalEntityName ?? opportunity.likelyCompanyName ?? null,
    permitDescription: opportunity.reasonSummary.join(" • ") || null,
    projectValue: opportunity.estimatedProjectValue ?? opportunity.improvementValue ?? opportunity.landValue,
    estimatedProjectValue: opportunity.estimatedProjectValue,
    landValue: opportunity.landValue,
    improvementValue: opportunity.improvementValue,
    classification: opportunity.classification,
    sourceJurisdiction: opportunity.sourceJurisdiction,
    sourceName: opportunity.sourceName,
    sourceUrl: opportunity.sourceUrl
  };
}

function mapDbOpportunity(row: OpportunityRow): PlotOpportunity {
  const base = persistenceRowToOpportunity(row);
  const sourceJurisdiction =
    row.source?.jurisdiction?.name ??
    row.sourceJurisdiction ??
    row.source?.city ??
    row.source?.county ??
    "";

  const hydrated = hydrateOpportunityIntelligence({
    ...base,
    opportunityIdentityKey: row.opportunityIdentityKey ?? base.opportunityIdentityKey,
    propertyIdentityKey: base.propertyIdentityKey ?? row.property?.propertyIdentityKey ?? null,
    permitIdentityKey: base.permitIdentityKey ?? row.permit?.permitIdentityKey ?? null,
    builderIdentityKey:
      base.builderIdentityKey ?? row.builder?.builderIdentityKey ?? row.normalizedEntityName ?? null,
    sourceFingerprint: row.sourceFingerprint ?? row.permit?.sourceFingerprint ?? row.property?.sourceFingerprint ?? null,
    sourceRecordVersion: row.sourceRecordVersion ?? row.permit?.sourceRecordVersion ?? row.property?.sourceRecordVersion ?? 1,
    lastSourceChangedAt:
      row.lastSourceChangedAt?.toISOString() ??
      row.permit?.lastSourceChangedAt?.toISOString() ??
      row.property?.lastSourceChangedAt?.toISOString() ??
      null,
    sourceChangeSummary: base.sourceChangeSummary,
    scoreBreakdown: base.scoreBreakdown,
    requiresReview: row.requiresReview,
    duplicateRiskScore: row.duplicateRiskScore,
    assignedMembershipId: row.assignedMembershipId ?? null,
    address: row.address ?? row.property?.address ?? "",
    city: row.city ?? row.property?.city?.name ?? "",
    county: row.county ?? row.property?.county?.name ?? "",
    subdivision: row.subdivision ?? row.property?.subdivision ?? null,
    parcelNumber: row.parcelNumber ?? row.property?.parcelNumber ?? row.property?.parcel?.parcelNumber ?? null,
    lotNumber: row.lotNumber ?? row.property?.lotNumber ?? null,
    builderId: row.builderId ?? null,
    builderName: row.builder?.name ?? row.builderName ?? null,
    likelyCompanyName: row.likelyCompanyName ?? row.builder?.company?.legalName ?? row.builder?.name ?? null,
    rawSourceName: row.rawSourceName ?? row.builder?.rawSourceName ?? row.builder?.name ?? null,
    normalizedEntityName: row.normalizedEntityName ?? row.builder?.normalizedName ?? null,
    preferredSalesName:
      row.preferredSalesName ?? row.builder?.preferredSalesName ?? row.builder?.company?.preferredSalesName ?? null,
    legalEntityName: row.legalEntityName ?? row.builder?.company?.legalName ?? row.builder?.name ?? null,
    aliases: row.builder?.aliases?.map((alias) => alias.rawName) ?? [],
    roleType: row.roleType.toLowerCase() as PlotOpportunity["roleType"],
    entityConfidenceScore: row.entityConfidenceScore ?? row.builder?.confidenceScore ?? 0,
    roleConfidenceScore: row.roleConfidenceScore ?? row.builder?.roleConfidenceScore ?? 0,
    contactQualityTier: row.contactQualityTier.toLowerCase() as PlotOpportunity["contactQualityTier"],
    contactQualityBand: row.contactQualityBand.toLowerCase() as PlotOpportunity["contactQualityBand"],
    contactQualityScore: row.contactQualityScore ?? row.builder?.contactQualityScore ?? 0,
    preferredContactTarget: row.preferredContactTarget ?? row.builder?.preferredContactTarget ?? null,
    phone:
      row.contactSnapshot?.primaryPhone ??
      row.contacts.find((contact) => contact.isPrimary)?.phone ??
      row.builder?.phone ??
      row.builder?.contacts?.find((contact) => contact.isPrimary)?.phone ??
      row.builder?.company?.phone ??
      null,
    email:
      row.contactSnapshot?.primaryEmail ??
      row.contacts.find((contact) => contact.isPrimary)?.email ??
      row.builder?.email ??
      row.builder?.contacts?.find((contact) => contact.isPrimary)?.email ??
      row.builder?.company?.email ??
      null,
    website:
      row.contactSnapshot?.primaryWebsite ??
      row.contacts.find((contact) => contact.isPrimary)?.website ??
      row.builder?.website ??
      row.builder?.company?.website ??
      null,
    contractorRegistrationNumber: row.contractorRegistrationNumber ?? row.builder?.contractorRegistrationNumber ?? row.builder?.company?.contractorRegistrationNumber ?? null,
    contractorRegistrationStatus:
      (row.contractorRegistrationStatus?.toLowerCase() as PlotOpportunity["contractorRegistrationStatus"]) ??
      (row.builder?.contractorRegistrationStatus?.toLowerCase() as PlotOpportunity["contractorRegistrationStatus"]) ??
      "unknown",
    businessEntityNumber: row.businessEntityNumber ?? row.builder?.businessEntityNumber ?? row.builder?.company?.businessEntityNumber ?? null,
    businessEntityStatus:
      (row.businessEntityStatus?.toLowerCase() as PlotOpportunity["businessEntityStatus"]) ??
      (row.builder?.businessEntityStatus?.toLowerCase() as PlotOpportunity["businessEntityStatus"]) ??
      "unknown",
    mailingAddress: row.mailingAddress ?? row.builder?.mailingAddress ?? row.builder?.company?.mailingAddress ?? null,
    cityState: row.cityState ?? row.builder?.cityState ?? row.builder?.company?.cityState ?? null,
    lastEnrichedAt: row.lastEnrichedAt?.toISOString() ?? row.builder?.lastEnrichedAt?.toISOString() ?? null,
    sourceName: row.source?.name ?? row.sourceName ?? "Official source",
    sourceJurisdiction,
    sourceUrl: row.source?.sourceUrl ?? row.sourceUrl ?? row.permit?.sourceUrl ?? "",
    estimatedProjectValue: toNumber(row.permit?.estimatedProjectValue),
    landValue: toNumber(row.permit?.landValue ?? row.property?.landValue),
    improvementValue: toNumber(row.permit?.improvementValue ?? row.property?.improvementValue),
    assignedRep: row.assignedMembership?.displayName ?? DEFAULT_OPEN_TERRITORY_LABEL,
    contactResolutionStatus:
      (row.contactSnapshot?.contactResolutionStatus?.toLowerCase() as PlotOpportunity["contactResolutionStatus"] | undefined) ??
      base.contactResolutionStatus,
    lastContactResolutionRunAt:
      row.contactSnapshot?.lastContactResolutionRunAt?.toISOString() ??
      row.lastContactResolutionRunAt?.toISOString() ??
      base.lastContactResolutionRunAt,
    contacts: row.contacts.map((contact) => ({
      id: contact.id,
      fullName: contact.fullName ?? null,
      firstName: contact.firstName ?? null,
      lastName: contact.lastName ?? null,
      roleTitle: contact.roleTitle ?? null,
      companyName: contact.companyName ?? null,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      mobilePhone: contact.mobilePhone ?? null,
      officePhone: contact.officePhone ?? null,
      website: contact.website ?? null,
      linkedinUrl: contact.linkedinUrl ?? null,
      preferredContactMethod:
        (contact.preferredContactMethod as PlotOpportunity["contacts"][number]["preferredContactMethod"] | null) ?? null,
      bestTimeToContact: contact.bestTimeToContact ?? null,
      notes: contact.notes ?? null,
      sourceLabel: contact.sourceLabel ?? null,
      sourceUrl: contact.sourceUrl ?? null,
      confidenceScore: contact.confidenceScore,
      qualityScore: contact.qualityScore,
      qualityBand: contact.qualityBand.toLowerCase() as PlotOpportunity["contacts"][number]["qualityBand"],
      isPrimary: contact.isPrimary,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
      lastVerifiedAt: contact.lastVerifiedAt?.toISOString() ?? null
      ,
      normalizedEmail: contact.normalizedEmail ?? null,
      normalizedPhone: contact.normalizedPhone ?? null,
      contactSourceRank: contact.contactSourceRank
    })),
    activities: row.activities.map((activity) => ({
      id: activity.id,
      contactId: activity.contactId ?? null,
      contactName: activity.contact?.fullName ?? null,
      activityType: (activity.type as PlotOpportunity["activities"][number]["activityType"]) ?? "note_added",
      activityDirection:
        (activity.direction as PlotOpportunity["activities"][number]["activityDirection"] | null) ?? "internal",
      occurredAt: activity.occurredAt.toISOString(),
      outcome: activity.outcome ?? null,
      note: activity.note ?? activity.description ?? null,
      createdBy: activity.createdByMembership?.displayName ?? null,
      createdAt: activity.createdAt.toISOString()
    })),
    stageHistory: row.stageHistory.map((item) => ({
      id: item.id,
      fromStage: item.fromStage ? (item.fromStage as PlotOpportunity["stageHistory"][number]["fromStage"]) : null,
      toStage: item.toStage as PlotOpportunity["stageHistory"][number]["toStage"],
      fromBidStatus: item.fromBidStatus
        ? (item.fromBidStatus.toLowerCase() as PlotOpportunity["stageHistory"][number]["fromBidStatus"])
        : null,
      toBidStatus: item.toBidStatus.toLowerCase() as PlotOpportunity["stageHistory"][number]["toBidStatus"],
      note: item.note ?? null,
      sourceLabel: item.sourceLabel ?? null,
      changedBy: item.changedByMembership?.displayName ?? null,
      changedAt: item.changedAt.toISOString()
    })),
    contactSnapshot: row.contactSnapshot
      ? {
          primaryEntityId: row.contactSnapshot.primaryEntityId ?? null,
          primaryEntityName: row.contactSnapshot.primaryEntityName ?? null,
          primaryContactId: row.contactSnapshot.primaryContactId ?? null,
          primaryContactName: row.contactSnapshot.primaryContactName ?? null,
          primaryPhone: row.contactSnapshot.primaryPhone ?? null,
          primaryEmail: row.contactSnapshot.primaryEmail ?? null,
          primaryWebsite: row.contactSnapshot.primaryWebsite ?? null,
          contactQualityTier:
            row.contactSnapshot.contactQualityTier.toLowerCase() as NonNullable<PlotOpportunity["contactSnapshot"]>["contactQualityTier"],
          contactQualityBand:
            row.contactSnapshot.contactQualityBand.toLowerCase() as NonNullable<PlotOpportunity["contactSnapshot"]>["contactQualityBand"],
          contactQualityScore: row.contactSnapshot.contactQualityScore,
          entityConfidenceScore: row.contactSnapshot.entityConfidenceScore,
          nextBestAction: row.contactSnapshot.nextBestAction ?? null,
          contactResolutionStatus:
            row.contactSnapshot.contactResolutionStatus.toLowerCase() as NonNullable<PlotOpportunity["contactSnapshot"]>["contactResolutionStatus"],
          resolutionNotes: row.contactSnapshot.resolutionNotes ?? null,
          lastContactResolutionRunAt: row.contactSnapshot.lastContactResolutionRunAt?.toISOString() ?? null
        }
      : null,
    entityMatches: row.entityMatches.map((match) => ({
      id: match.id,
      rawSourceName: match.rawSourceName,
      normalizedEntityName: match.normalizedEntityName,
      preferredSalesName: match.preferredSalesName ?? null,
      fingerprint: match.fingerprint,
      roleType: match.roleType.toLowerCase() as PlotOpportunity["roleType"],
      roleConfidenceScore: match.roleConfidenceScore,
      matchScore: match.matchScore,
      matchStrategy: match.matchStrategy,
      sourceLabel: match.sourceLabel,
      sourceUrl: match.sourceUrl ?? null,
      rationale: match.rationale ?? null,
      isPrimary: match.isPrimary,
      lastCheckedAt: match.lastCheckedAt.toISOString()
    })),
    enrichmentAudit: row.enrichmentResults.map((result) => ({
      id: result.id,
      provider: result.provider,
      fieldName: result.fieldName ?? null,
      fieldValue: result.fieldValue ?? null,
      sourceLabel: result.sourceLabel ?? null,
      sourceUrl: result.sourceUrl ?? null,
      rationale: result.rationale ?? null,
      confidence: result.confidence,
      refreshedAt: result.refreshedAt.toISOString(),
      lastVerifiedAt: result.lastVerifiedAt?.toISOString() ?? null
    }))
  });

  const rescored = calculateOpportunityScore(hydrated);

  return {
    ...hydrated,
    opportunityScore: rescored.total,
    reasonSummary: rescored.reasons,
    scoreBreakdown: rescored.breakdown
  };
}

async function loadOpportunityRows() {
  return prisma.plotOpportunity.findMany({
    where: {
      organization: {
        slug: DEFAULT_ORGANIZATION_SLUG
      }
    },
    include: opportunityInclude
  });
}

function applyOpportunityFilters(
  opportunities: PlotOpportunity[],
  query: OpportunityQuery = {},
  territories: Array<{ name: string; counties: string[]; cities: string[] }> = []
) {
  const countyFilter = query.county && query.county !== COUNTIES_NEAR_ME_LABEL ? query.county : null;
  const cityFilter = query.city && query.city !== "All cities" ? query.city : null;
  const jurisdictionFilter =
    query.jurisdiction && query.jurisdiction !== "All jurisdictions" ? query.jurisdiction : null;
  const territoryFilter = query.territory && query.territory !== "All territories" ? query.territory : null;
  const search = query.search?.trim().toLowerCase() ?? "";
  const jobFit = query.jobFit && query.jobFit !== "all" ? query.jobFit : null;
  const recency = query.recency && query.recency !== "all" ? query.recency : null;
  const minScore = typeof query.minScore === "number" && Number.isFinite(query.minScore) ? query.minScore : null;
  const hasContactInfo = query.hasContactInfo ?? false;
  const notYetContacted = query.notYetContacted ?? false;
  const projectSegment = query.projectSegment && query.projectSegment !== "all" ? query.projectSegment : null;
  const status = query.status ?? "all";
  const sort = query.sort ?? "score";
  const selectedTerritory = territoryFilter
    ? territories.find((territory) => territory.name === territoryFilter) ?? null
    : null;

  const filtered = opportunities.filter((opportunity) => {
    if (countyFilter && opportunity.county !== countyFilter) {
      return false;
    }

    if (cityFilter && normalizeCityKey(opportunity.city) !== normalizeCityKey(cityFilter)) {
      return false;
    }

    if (jurisdictionFilter && opportunity.sourceJurisdiction !== jurisdictionFilter) {
      return false;
    }

    if (selectedTerritory) {
      const countyMatch = selectedTerritory.counties.length === 0 || selectedTerritory.counties.includes(opportunity.county);
      const cityMatch =
        selectedTerritory.cities.length === 0 ||
        selectedTerritory.cities.some((city) => normalizeCityKey(city) === normalizeCityKey(opportunity.city));

      if (!countyMatch && !cityMatch) {
        return false;
      }
    }

    if (projectSegment && opportunity.projectSegment !== projectSegment) {
      return false;
    }

    if (jobFit && opportunity.jobFit !== jobFit) {
      return false;
    }

    if (recency && opportunity.recencyBucket !== recency) {
      return false;
    }

    if (minScore !== null && opportunity.opportunityScore < minScore) {
      return false;
    }

    if (hasContactInfo && !(opportunity.phone || opportunity.email || opportunity.website)) {
      return false;
    }

    if (notYetContacted && opportunity.bidStatus === "contacted") {
      return false;
    }

    if (search) {
      const haystack = [
        opportunity.address,
        opportunity.parcelNumber,
        opportunity.lotNumber,
        opportunity.city,
        opportunity.county,
        opportunity.builderName,
        opportunity.preferredSalesName,
        opportunity.legalEntityName,
        opportunity.sourceName,
        opportunity.sourceJurisdiction,
        ...opportunity.reasonSummary
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (status === "queue") {
      return !["contacted", "won", "lost", "not_a_fit"].includes(opportunity.bidStatus);
    }

    if (status === "contacted") {
      return opportunity.bidStatus === "contacted";
    }

    if (status === "closed") {
      return opportunity.bidStatus === "won" || opportunity.bidStatus === "lost";
    }

    return true;
  });

  return [...filtered].sort((left, right) => {
    if (sort === "newest") {
      return new Date(right.signalDate).getTime() - new Date(left.signalDate).getTime();
    }

    if (sort === "suggested_follow_up") {
      return (left.suggestedFollowUpDate ?? "9999-12-31").localeCompare(right.suggestedFollowUpDate ?? "9999-12-31");
    }

    if (sort === "inquired_at") {
      return (left.inquiredAt ?? "9999-12-31").localeCompare(right.inquiredAt ?? "9999-12-31");
    }

    return right.opportunityScore - left.opportunityScore;
  });
}

function normalizeCityKey(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "")
    .toLowerCase();
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getCanonicalCityName(value: string | null | undefined) {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ");

  if (!trimmed) {
    return null;
  }

  if (/[a-z]/.test(trimmed)) {
    return trimmed
      .split(" ")
      .filter(Boolean)
      .map((part) => {
        if (part === part.toUpperCase()) {
          return toTitleCase(part);
        }

        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join(" ");
  }

  return toTitleCase(trimmed);
}

function maxIso(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
}

export async function getOpportunityData(query: OpportunityQuery = {}) {
  const rows = await loadOpportunityRows();
  const opportunities = rows.map(mapDbOpportunity);
  const [counties, territories] = await Promise.all([
    prisma.county.findMany({
      orderBy: {
        name: "asc"
      },
      select: {
        name: true
      }
    }),
    prisma.territory.findMany({
      where: {
        organization: {
          slug: DEFAULT_ORGANIZATION_SLUG
        }
      },
      orderBy: {
        name: "asc"
      },
      include: {
        rules: {
          select: {
            ruleType: true,
            ruleValue: true
          }
        }
      }
    })
  ]);
  const territoryFilters = territories.map((territory) => ({
    name: territory.name,
    counties: territory.rules.filter((rule) => rule.ruleType === "county").map((rule) => rule.ruleValue),
    cities: territory.rules
      .filter((rule) => rule.ruleType === "city")
      .map((rule) => getCanonicalCityName(rule.ruleValue) ?? rule.ruleValue)
  }));
  const cityMap = new Map<string, string>();

  for (const opportunity of opportunities) {
    const canonicalCity = getCanonicalCityName(opportunity.city);

    if (!canonicalCity) {
      continue;
    }

    const key = normalizeCityKey(canonicalCity);

    if (!cityMap.has(key)) {
      cityMap.set(key, canonicalCity);
    }
  }

  const cities = [...cityMap.values()].sort((left, right) => left.localeCompare(right));
  const jurisdictions = Array.from(
    new Set(opportunities.map((opportunity) => opportunity.sourceJurisdiction).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right));

  return {
    opportunities: applyOpportunityFilters(opportunities, query, territoryFilters),
    counties: [COUNTIES_NEAR_ME_LABEL, ...counties.map((county) => county.name)],
    cities: ["All cities", ...cities],
    jurisdictions: ["All jurisdictions", ...jurisdictions],
    territories: ["All territories", ...territoryFilters.map((territory) => territory.name)]
  };
}

export async function getOpportunityById(opportunityId: string) {
  const row = await prisma.plotOpportunity.findFirst({
    where: {
      id: opportunityId,
      organization: {
        slug: DEFAULT_ORGANIZATION_SLUG
      }
    },
    include: opportunityInclude
  });

  return row ? mapDbOpportunity(row) : null;
}

export async function getBuilderRecords() {
  const builders = await prisma.builder.findMany({
    where: {
      organization: {
        slug: DEFAULT_ORGANIZATION_SLUG
      }
    },
    include: {
      company: true,
      aliases: true,
      contacts: true,
      entityMatches: {
        orderBy: {
          matchScore: "desc"
        }
      },
      enrichmentResults: {
        orderBy: {
          refreshedAt: "desc"
        }
      },
      plotOpportunities: {
        include: opportunityInclude
      }
    },
    orderBy: [
      {
        builderHeatScore: "desc"
      },
      {
        name: "asc"
      }
    ]
  });

  return builders
    .map((builder) => {
      const opportunities = builder.plotOpportunities.map(mapDbOpportunity);
      const propertyMap = new Map<string, BuilderRecord["properties"][number]>();

      for (const opportunity of opportunities) {
        const propertyKey =
          opportunity.parcelNumber ?? `${opportunity.address}|${opportunity.city}|${opportunity.county}`;
        const existing = propertyMap.get(propertyKey);
        const permit = buildPermitFromOpportunity(opportunity);

        if (existing) {
          existing.permits.push(permit);
          existing.noteCount = Math.max(existing.noteCount, opportunity.notes.length);
        } else {
          propertyMap.set(propertyKey, {
            id: propertyKey,
            address: opportunity.address,
            city: opportunity.city,
            county: opportunity.county,
            subdivision: opportunity.subdivision,
            parcelNumber: opportunity.parcelNumber,
            lotNumber: opportunity.lotNumber,
            permits: [permit],
            noteCount: opportunity.notes.length
          });
        }
      }

      const openOpportunities = opportunities.filter(
        (opportunity) => !["won", "lost", "not_a_fit"].includes(opportunity.bidStatus)
      );
      const lastOpportunity = [...opportunities].sort((left, right) => right.signalDate.localeCompare(left.signalDate))[0];
      const nextFollowUp =
        openOpportunities
          .map((opportunity) => opportunity.suggestedFollowUpDate ?? opportunity.nextFollowUpDate)
          .filter(Boolean)
          .sort()[0] ?? null;
      const record: BuilderRecord = {
        id: builder.id,
        name: builder.preferredSalesName ?? builder.name,
        normalizedName: builder.normalizedName,
        builderIdentityKey: builder.builderIdentityKey ?? null,
        rawSourceName: builder.rawSourceName ?? builder.name,
        preferredSalesName: builder.preferredSalesName ?? null,
        legalEntityName: builder.company?.legalName ?? builder.name,
        aliases: builder.aliases.map((alias) => alias.rawName),
        roleType: builder.roleType.toLowerCase() as BuilderRecord["roleType"],
        entityConfidenceScore: builder.confidenceScore,
        roleConfidenceScore: builder.roleConfidenceScore,
        contactQualityTier: builder.contactQualityTier.toLowerCase() as BuilderRecord["contactQualityTier"],
        contactQualityBand: builder.contactQualityBand.toLowerCase() as BuilderRecord["contactQualityBand"],
        contactQualityScore: builder.contactQualityScore,
        preferredContactTarget: builder.preferredContactTarget ?? null,
        contractorRegistrationNumber: builder.contractorRegistrationNumber ?? builder.company?.contractorRegistrationNumber ?? null,
        contractorRegistrationStatus:
          (builder.contractorRegistrationStatus.toLowerCase() as BuilderRecord["contractorRegistrationStatus"]) ??
          "unknown",
        businessEntityNumber: builder.businessEntityNumber ?? builder.company?.businessEntityNumber ?? null,
        businessEntityStatus:
          (builder.businessEntityStatus.toLowerCase() as BuilderRecord["businessEntityStatus"]) ??
          "unknown",
        mailingAddress: builder.mailingAddress ?? builder.company?.mailingAddress ?? null,
        cityState: builder.cityState ?? builder.company?.cityState ?? null,
        lastEnrichedAt: builder.lastEnrichedAt?.toISOString() ?? null,
        nextBestAction: builder.nextBestAction ?? "Research contact",
        builderHeatScore: builder.builderHeatScore,
        counties: [...new Set(opportunities.map((opportunity) => opportunity.county).filter(Boolean))],
        cities: [...new Set(opportunities.map((opportunity) => opportunity.city).filter(Boolean))],
        activeProperties: builder.activeProperties || propertyMap.size,
        openOpportunities: openOpportunities.length,
        leadScore: 0,
        totalEstimatedValue: openOpportunities.reduce(
          (sum, opportunity) => sum + (opportunity.estimatedProjectValue ?? opportunity.improvementValue ?? 0),
          0
        ),
        totalLandValue: toNumber(builder.totalLandValue) ?? 0,
        totalImprovementValue: toNumber(builder.totalImprovementValue) ?? 0,
        pipelineStage:
          openOpportunities.some((opportunity) => opportunity.bidStatus === "contacted")
            ? "Contacted"
            : openOpportunities.some((opportunity) => opportunity.bidStatus === "ready_to_contact")
              ? "Ready to Bid"
              : openOpportunities.some((opportunity) => opportunity.bidStatus === "researching_builder")
                ? "Research Builder"
                : openOpportunities.some((opportunity) => opportunity.bidStatus === "won")
                  ? "Won"
                  : openOpportunities.some((opportunity) => opportunity.bidStatus === "lost")
                    ? "Lost"
                    : "New",
        nextFollowUpDate: nextFollowUp,
        assignedRep:
          openOpportunities.find((opportunity) => opportunity.assignedRep !== DEFAULT_OPEN_TERRITORY_LABEL)
            ?.assignedRep ?? DEFAULT_OPEN_TERRITORY_LABEL,
        lastSeenLocation: lastOpportunity ? `${lastOpportunity.city}, ${lastOpportunity.county}` : "Unknown",
        lastActivityAt: maxIso(
          opportunities.flatMap((opportunity) => [
            opportunity.signalDate,
            opportunity.inquiredAt,
            opportunity.followedUpOn,
            opportunity.closedAt
          ])
        ),
        contact: {
          phone: builder.phone ?? builder.contacts.find((contact) => contact.isPrimary)?.phone ?? builder.company?.phone ?? null,
          email: builder.email ?? builder.contacts.find((contact) => contact.isPrimary)?.email ?? builder.company?.email ?? null,
          website: builder.website ?? builder.company?.website ?? null,
          sourceLabel: builder.contacts.find((contact) => contact.isPrimary)?.sourceLabel ?? builder.company?.contactSource ?? null,
          sourceUrl: builder.contacts.find((contact) => contact.isPrimary)?.sourceUrl ?? builder.company?.contactUrl ?? null
        },
        contractorMetrics: {
          totalPermits: 0,
          permitsLast30Days: 0,
          permitsLast60Days: 0,
          permitsLast90Days: 0,
          avgProjectValue: 0,
          projectTypes: [],
          locations: [],
          outreachStatus: "new",
          exportLabel: `${builder.preferredSalesName ?? builder.name} outreach`
        },
        properties: [...propertyMap.values()],
        openOpportunityIds: openOpportunities.map((opportunity) => opportunity.id),
        entityMatches: builder.entityMatches.map((match) => ({
          id: match.id,
          rawSourceName: match.rawSourceName,
          normalizedEntityName: match.normalizedEntityName,
          preferredSalesName: match.preferredSalesName ?? null,
          fingerprint: match.fingerprint,
          roleType: match.roleType.toLowerCase() as BuilderRecord["roleType"],
          roleConfidenceScore: match.roleConfidenceScore,
          matchScore: match.matchScore,
          matchStrategy: match.matchStrategy,
          sourceLabel: match.sourceLabel,
          sourceUrl: match.sourceUrl ?? null,
          rationale: match.rationale ?? null,
          isPrimary: match.isPrimary,
          lastCheckedAt: match.lastCheckedAt.toISOString()
        })),
        enrichmentAudit: builder.enrichmentResults.map((result) => ({
          id: result.id,
          provider: result.provider,
          fieldName: result.fieldName ?? null,
          fieldValue: result.fieldValue ?? null,
          sourceLabel: result.sourceLabel ?? null,
          sourceUrl: result.sourceUrl ?? null,
          rationale: result.rationale ?? null,
          confidence: result.confidence,
          refreshedAt: result.refreshedAt.toISOString(),
          lastVerifiedAt: result.lastVerifiedAt?.toISOString() ?? null
        }))
      };

      const score = calculateLeadScore(record);
      record.leadScore = score.total;
      record.contractorMetrics = buildContractorMetrics(record);

      return record;
    })
    .filter((builder) => builder.properties.length > 0);
}

export async function getBuilderRecord(builderId: string) {
  const builders = await getBuilderRecords();
  return builders.find((builder) => builder.id === builderId) ?? null;
}

export async function getSourceRecords() {
  const sources = await prisma.source.findMany({
    where: {
      organization: {
        slug: DEFAULT_ORGANIZATION_SLUG
      }
    },
    include: {
      syncRuns: {
        orderBy: {
          startedAt: "desc"
        },
        take: 1,
        include: {
          logs: {
            orderBy: {
              createdAt: "desc"
            },
            take: 5
          },
          rawRecords: {
            select: {
              changeStatus: true
            }
          }
        }
      },
      healthChecks: {
        orderBy: {
          checkedAt: "desc"
        },
        take: 1
      },
      reviewQueueItems: {
        where: {
          status: {
            in: ["OPEN", "IN_PROGRESS"]
          }
        },
        select: {
          id: true
        }
      }
    },
    orderBy: [
      {
        active: "desc"
      },
      {
        priorityRank: "asc"
      },
      {
        county: "asc"
      },
      {
        name: "asc"
      }
    ]
  });

  return sources.map((source) => {
    const latestRun = source.syncRuns[0];
    const latestHealth = source.healthChecks[0];
    const dataOrigin = inferSourceDataOrigin(source.sourceUrl);
    const changeCounts = summarizeRawRecordChanges(
      latestRun?.rawRecords.map((record) => record.changeStatus) ?? []
    );
    const freshness = evaluateSourceFreshness({
      syncFrequency: source.syncFrequency,
      syncStatus: source.syncStatus,
      lastSuccessfulSync: source.lastSuccessfulSync?.toISOString() ?? null
    });
    const liveDataConfidence = computeLiveDataConfidence({
      sourceConfidenceScore: source.sourceConfidenceScore,
      sourceFreshnessScore: source.sourceFreshnessScore,
      syncStatus: source.syncStatus,
      freshnessState: freshness.state,
      latestFetchedCount: latestRun?.fetchedCount ?? 0,
      latestNormalizedCount: latestRun?.normalizedCount ?? 0,
      parseFailureCount: latestHealth?.parseFailureCount ?? 0,
      missingFieldCount: latestHealth?.missingFieldCount ?? 0,
      duplicateCount: latestHealth?.duplicateCount ?? 0,
      dataOrigin
    });
    const healthScore = computeSourceHealthScore({
      availabilityScore: source.syncStatus === "success" ? 96 : source.syncStatus === "warning" ? 68 : source.syncStatus === "failed" ? 18 : 52,
      completenessScore: latestHealth?.completenessScore ?? latestRun?.completenessScore ?? 0,
      freshnessScore: source.sourceFreshnessScore,
      parseFailureCount: latestHealth?.parseFailureCount ?? 0,
      missingFieldCount: latestHealth?.missingFieldCount ?? 0,
      duplicateCount: latestHealth?.duplicateCount ?? 0,
      blockedCount: latestHealth?.blockedCount ?? latestRun?.blockedCount ?? 0,
      warningFlags:
        latestHealth?.warningFlags && Array.isArray(latestHealth.warningFlags)
          ? latestHealth.warningFlags.map((flag) => String(flag))
          : []
    });
    const warningFlags =
      latestHealth?.warningFlags && Array.isArray(latestHealth.warningFlags)
        ? latestHealth.warningFlags.map((flag) => String(flag))
        : [];

    return {
      id: source.id,
      name: source.name,
      slug: source.slug,
      jurisdiction: source.city ?? source.county ?? source.name,
      county: source.county ?? "Unknown",
      city: source.city ?? "Unassigned",
      sourceScope: (source.sourceScope as SourceRecord["sourceScope"]) ?? undefined,
      countyRadiusEligible: source.countyRadiusEligible,
      countySelectorVisible: source.countySelectorVisible,
      officialSourceType: source.officialSourceType ?? undefined,
      connectorType: source.connectorType.toLowerCase() as SourceRecord["connectorType"],
      priorityRank: source.priorityRank,
      sourceType: source.sourceType,
      parserType: source.parserType,
      sourceUrl: source.sourceUrl,
      active: source.active,
      syncFrequency: source.syncFrequency,
      authRequired: source.authRequired,
      lastSuccessfulSync: source.lastSuccessfulSync?.toISOString() ?? null,
      syncStatus: source.syncStatus,
      sourceConfidenceScore: source.sourceConfidenceScore,
      sourceFreshnessScore: source.sourceFreshnessScore,
      dataOrigin,
      freshnessState: freshness.state,
      freshnessDetail: freshness.detail,
      liveDataConfidence,
      latestFetchedCount: latestRun?.fetchedCount ?? 0,
      latestNormalizedCount: latestRun?.normalizedCount ?? 0,
      latestDedupedCount: latestRun?.dedupedCount ?? 0,
      newRecordCount: changeCounts.newRecordCount,
      updatedRecordCount: changeCounts.updatedRecordCount,
      unchangedRecordCount: changeCounts.unchangedRecordCount,
      errorRecordCount: changeCounts.errorRecordCount,
      blockedCount: latestHealth?.blockedCount ?? latestRun?.blockedCount ?? 0,
      completenessScore: latestHealth?.completenessScore ?? latestRun?.completenessScore ?? 0,
      healthScore,
      driftScore: latestRun?.driftScore ?? 0,
      warningFlags,
      lastHealthCheckedAt: latestHealth?.checkedAt.toISOString() ?? null,
      parseFailureCount: latestHealth?.parseFailureCount ?? 0,
      missingFieldCount: latestHealth?.missingFieldCount ?? 0,
      duplicateCount: latestHealth?.duplicateCount ?? 0,
      openReviewCount: source.reviewQueueItems.length,
      logs:
        latestRun?.logs.map((log) => ({
          timestamp: log.createdAt.toISOString(),
          level: log.level as "info" | "warning" | "error",
          message: log.message
        })) ?? []
    } satisfies SourceRecord;
  });
}

export async function getOpenReviewQueueItems(limit = 12): Promise<ReviewQueueItemRecord[]> {
  const items = await prisma.reviewQueueItem.findMany({
    where: {
      organization: {
        slug: DEFAULT_ORGANIZATION_SLUG
      },
      status: {
        in: ["OPEN", "IN_PROGRESS"]
      }
    },
    include: {
      source: true,
      builder: true,
      opportunity: true
    },
    orderBy: [
      {
        priority: "desc"
      },
      {
        createdAt: "desc"
      }
    ],
    take: limit
  });

  return items.map((item) => ({
    id: item.id,
    reviewType: item.reviewType.toLowerCase() as ReviewQueueItemRecord["reviewType"],
    status: item.status.toLowerCase() as ReviewQueueItemRecord["status"],
    priority: item.priority,
    title: item.title,
    details: item.details ?? null,
    rationale: item.rationale ?? null,
    sourceUrl: item.sourceUrl ?? null,
    confidenceScore: item.confidenceScore,
    firstSeenAt: item.firstSeenAt.toISOString(),
    lastSeenAt: item.lastSeenAt.toISOString(),
    resolvedAt: item.resolvedAt?.toISOString() ?? null,
    sourceName: item.source?.name ?? null,
    builderName: item.builder?.preferredSalesName ?? item.builder?.name ?? null,
    opportunityId: item.opportunityId ?? null
  }));
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [opportunityData, sources, builders] = await Promise.all([
    getOpportunityData(),
    getSourceRecords(),
    getBuilderRecords()
  ]);

  const plotQueue = opportunityData.opportunities.filter(
    (item) => !["contacted", "won", "lost", "not_a_fit"].includes(item.bidStatus)
  );
  const highPriority = plotQueue.filter((item) => item.opportunityScore >= 80);
  const newThisWeek = plotQueue.filter((item) => item.recencyBucket === "0_7_days");
  const topNeighborhoods = [...new Map(
    plotQueue
      .filter((item) => item.marketCluster)
      .map((item) => [item.marketCluster as string, plotQueue.filter((candidate) => candidate.marketCluster === item.marketCluster).length])
  ).entries()]
    .sort((left, right) => right[1] - left[1]);
  const missingContact = plotQueue.filter((item) => !item.phone && !item.email && !item.website);
  const unreviewed = plotQueue.filter((item) => item.bidStatus === "not_reviewed" || item.bidStatus === "researching_builder");
  const validation = summarizeTransformationConsistency(opportunityData.opportunities);

  return {
    topBuilders: builders.slice(0, 5),
    plotQueue,
    newestPermits: opportunityData.opportunities.slice(0, 8).map(buildPermitFromOpportunity),
    syncHealth: sources,
    followUpsDue: opportunityData.opportunities.filter((item) => item.bidStatus === "contacted" && Boolean(item.suggestedFollowUpDate)),
    insights: [
      {
        id: "new-permits",
        label: "New permits this week",
        value: String(newThisWeek.length),
        detail: "Fresh permit and development signals from the last 7 days.",
        href: "/dashboard?sort=newest"
      },
      {
        id: "high-priority",
        label: "High-priority leads",
        value: String(highPriority.length),
        detail: "Queue records scoring 80+ with strong fit or urgency.",
        href: "/dashboard"
      },
      {
        id: "active-contractors",
        label: "Active contractors",
        value: String(builders.filter((builder) => builder.contractorMetrics.totalPermits > 0).length),
        detail: "Builders and contractors with current permit activity.",
        href: "/builders"
      },
      {
        id: "top-neighborhoods",
        label: "Top neighborhoods",
        value: topNeighborhoods[0]?.[0] ?? "N/A",
        detail: topNeighborhoods[0] ? `${topNeighborhoods[0][1]} active leads in the hottest cluster.` : "No active clustering yet.",
        href: "/dashboard"
      },
      {
        id: "missing-contact",
        label: "Missing contact data",
        value: String(missingContact.length),
        detail: "Leads that still need phone, email, or website research.",
        href: "/dashboard"
      },
      {
        id: "unreviewed",
        label: "Unreviewed leads",
        value: String(unreviewed.length),
        detail: "Records still waiting for builder verification or contact review.",
        href: "/dashboard"
      },
      {
        id: "validation",
        label: "Validation mismatches",
        value: String(validation.mismatchCount),
        detail: "Sampled opportunities whose stored intelligence no longer matches recomputed values.",
        href: "/sources"
      }
    ],
    savedViews: [
      {
        id: "new-high-priority",
        label: "New high-priority leads",
        description: "Fresh, high-scoring opportunities to work first.",
        href: "/dashboard?minScore=80&recency=0_7_days"
      },
      {
        id: "contractor-targets",
        label: "Contractor targets",
        description: "Most active builder and contractor relationships.",
        href: "/builders"
      },
      {
        id: "uncontacted-leads",
        label: "Uncontacted leads",
        description: "Queue items that have not moved into Contacted yet.",
        href: "/dashboard"
      },
      {
        id: "shelving-opportunities",
        label: "Shelving opportunities",
        description: "Garage and storage-friendly records worth a shelving pitch.",
        href: "/dashboard?jobFit=shelving"
      },
      {
        id: "insulation-opportunities",
        label: "Insulation opportunities",
        description: "High-fit insulation projects across the corridor.",
        href: "/dashboard?jobFit=insulation"
      }
    ]
  };
}

export function clearLiveSnapshotCache() {
  // The UI now reads only from the database, so there is no in-memory live snapshot to clear.
}
