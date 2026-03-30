import { Prisma } from "@prisma/client";

import { DEFAULT_OPEN_TERRITORY_LABEL, DEFAULT_ORGANIZATION_SLUG } from "@/lib/app/defaults";
import { persistenceRowToOpportunity } from "@/lib/opportunities/persistence";
import { prisma } from "@/lib/db/client";
import { COUNTIES_NEAR_ME_LABEL } from "@/lib/geo/territories";
import { calculateLeadScore } from "@/lib/scoring/lead-scoring";
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
    permitNumber: opportunity.permitNumber ?? opportunity.id,
    permitType: opportunity.opportunityType.replaceAll("_", " "),
    permitSubtype: opportunity.classification.replaceAll("_", " "),
    permitStatus: opportunity.buildReadiness.replaceAll("_", " "),
    applicationDate: opportunity.signalDate,
    issueDate: opportunity.signalDate,
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

  return {
    ...base,
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

  return {
    topBuilders: builders.slice(0, 5),
    plotQueue: opportunityData.opportunities.filter(
      (item) => !["contacted", "won", "lost", "not_a_fit"].includes(item.bidStatus)
    ),
    newestPermits: opportunityData.opportunities.slice(0, 8).map(buildPermitFromOpportunity),
    syncHealth: sources,
    followUpsDue: opportunityData.opportunities.filter((item) => item.bidStatus === "contacted" && Boolean(item.suggestedFollowUpDate))
  };
}

export function clearLiveSnapshotCache() {
  // The UI now reads only from the database, so there is no in-memory live snapshot to clear.
}
