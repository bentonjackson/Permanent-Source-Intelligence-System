import { createHash } from "node:crypto";

import {
  BidStatus,
  Prisma,
  ReviewQueueType,
  SourceRecordChangeStatus,
  SourceRecordParseStatus,
  SourceSyncStatus
} from "@prisma/client";

import { DEFAULT_ORGANIZATION_SLUG, ensureBaselineMetadata } from "@/lib/app/defaults";
import { getConnector } from "@/lib/connectors/registry";
import { normalizeBuilderName, normalizeWhitespace } from "@/lib/connectors/shared/normalization";
import { NormalizedPermitInput } from "@/lib/connectors/shared/types";
import { prisma } from "@/lib/db/client";
import { runBuilderEnrichment } from "@/lib/enrichment/builder-enrichment";
import { resolveEntityIdentity } from "@/lib/entities/contact-identity";
import { mapNormalizedPermitToOpportunity } from "@/lib/opportunities/mapping";
import { opportunityToPersistenceData } from "@/lib/opportunities/persistence";
import {
  getOfficialSourceDefinition,
  officialSourceDefinitions,
  type OfficialSourceDefinition
} from "@/lib/sources/official-sources";
import {
  resolveReviewQueueItems,
  upsertReviewQueueItem
} from "@/lib/review/review-queue";

function toDecimal(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return new Prisma.Decimal(value);
}

function toJson(value: Record<string, unknown>) {
  return value as Prisma.InputJsonValue;
}

function buildRecordKey(record: NormalizedPermitInput) {
  return normalizeWhitespace(
    record.permitNumber || record.parcelNumber || record.address || record.sourceUrl || record.dedupeHash
  ) || record.dedupeHash;
}

function buildContentHash(record: NormalizedPermitInput) {
  return createHash("sha256").update(JSON.stringify(record.rawPayload ?? {})).digest("hex");
}

function sourceRunStatusFromCount(count: number) {
  return count > 0 ? SourceSyncStatus.success : SourceSyncStatus.warning;
}

const bidStatusPriority: Record<BidStatus, number> = {
  [BidStatus.NOT_REVIEWED]: 0,
  [BidStatus.RESEARCHING_BUILDER]: 1,
  [BidStatus.READY_TO_CONTACT]: 2,
  [BidStatus.CONTACTED]: 3,
  [BidStatus.BID_REQUESTED]: 4,
  [BidStatus.QUOTED]: 5,
  [BidStatus.WON]: 6,
  [BidStatus.LOST]: 6,
  [BidStatus.NOT_A_FIT]: 6
};

function countMissingCriticalFields(record: NormalizedPermitInput) {
  let count = 0;

  if (!normalizeWhitespace(record.address) && !normalizeWhitespace(record.parcelNumber)) {
    count += 1;
  }

  if (
    !normalizeWhitespace(record.builderName) &&
    !normalizeWhitespace(record.contractorName) &&
    !normalizeWhitespace(record.ownerName) &&
    !normalizeWhitespace(record.developerName)
  ) {
    count += 1;
  }

  if (!record.issueDate && !record.applicationDate) {
    count += 1;
  }

  return count;
}

async function createSourceHealthCheck(input: {
  organizationId: string;
  sourceId: string;
  runId?: string | null;
  status: SourceSyncStatus;
  fetchedCount?: number;
  normalizedCount?: number;
  parseFailureCount?: number;
  missingFieldCount?: number;
  duplicateCount?: number;
  errorMessage?: string | null;
  notes?: string | null;
}) {
  await prisma.sourceHealthCheck.create({
    data: {
      organizationId: input.organizationId,
      sourceId: input.sourceId,
      runId: input.runId ?? null,
      status: input.status,
      fetchedCount: input.fetchedCount ?? 0,
      normalizedCount: input.normalizedCount ?? 0,
      parseFailureCount: input.parseFailureCount ?? 0,
      missingFieldCount: input.missingFieldCount ?? 0,
      duplicateCount: input.duplicateCount ?? 0,
      errorMessage: input.errorMessage ?? null,
      notes: input.notes ?? null
    }
  });
}

async function markStaleRunningSyncs(olderThanMinutes = 20) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const staleRuns = await prisma.sourceSyncRun.findMany({
    where: {
      status: SourceSyncStatus.running,
      finishedAt: null,
      startedAt: {
        lt: cutoff
      }
    },
    select: {
      id: true,
      sourceId: true
    }
  });

  if (!staleRuns.length) {
    return 0;
  }

  const staleRunIds = staleRuns.map((run) => run.id);
  const staleSourceIds = [...new Set(staleRuns.map((run) => run.sourceId))];
  const now = new Date();

  await prisma.sourceSyncRun.updateMany({
    where: {
      id: {
        in: staleRunIds
      }
    },
    data: {
      status: SourceSyncStatus.failed,
      finishedAt: now,
      message: "Marked stale after a prior sync stopped reporting progress."
    }
  });

  await prisma.source.updateMany({
    where: {
      id: {
        in: staleSourceIds
      },
      syncStatus: SourceSyncStatus.running
    },
    data: {
      syncStatus: SourceSyncStatus.warning
    }
  });

  return staleRuns.length;
}

async function closeCompetingRunningSyncs(sourceId: string, keepRunId: string) {
  await prisma.sourceSyncRun.updateMany({
    where: {
      sourceId,
      status: SourceSyncStatus.running,
      finishedAt: null,
      id: {
        not: keepRunId
      }
    },
    data: {
      status: SourceSyncStatus.failed,
      finishedAt: new Date(),
      message: "Superseded by a newer sync run for the same source."
    }
  });
}

function normalizeAddressKey(value: string | null | undefined) {
  return normalizeWhitespace(value ?? "")
    .replace(/[.,]/g, "")
    .toLowerCase();
}

function firstNonEmpty<T>(...values: Array<T | null | undefined>) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
}

function maxDate(...values: Array<Date | null | undefined>) {
  return values.filter((value): value is Date => Boolean(value)).sort((left, right) => left.getTime() - right.getTime()).at(-1) ?? null;
}

function minDate(...values: Array<Date | null | undefined>) {
  return values.filter((value): value is Date => Boolean(value)).sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
}

async function runConnectorWithRetry(
  sourceName: string,
  runConnector: (signal: AbortSignal) => Promise<Awaited<ReturnType<ReturnType<typeof getConnector>["run"]>>>,
  options?: {
    timeoutMs?: number;
    onRetry?: (attempt: number, error: Error) => Promise<void>;
  }
) {
  let lastError: unknown = null;
  const timeoutMs = options?.timeoutMs ?? 45000;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`${sourceName} connector run timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);

    try {
      return await runConnector(controller.signal);
    } catch (error) {
      lastError = error;

      if (attempt === 2) {
        break;
      }

      if (options?.onRetry) {
        await options.onRetry(
          attempt,
          error instanceof Error ? error : new Error(`${sourceName} connector failed.`)
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${sourceName} connector failed after retry.`);
}

function mergeJsonNotes(values: Array<Prisma.JsonValue | null | undefined>) {
  const merged = new Set<string>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        const normalized = normalizeWhitespace(String(entry));
        if (normalized) {
          merged.add(normalized);
        }
      }
      continue;
    }

    if (typeof value === "string") {
      const normalized = normalizeWhitespace(value);
      if (normalized) {
        merged.add(normalized);
      }
    }
  }

  return merged.size ? [...merged] : Prisma.JsonNull;
}

function buildOpportunityDuplicateKey(opportunity: {
  permitId: string | null;
  sourceId: string | null;
  permitNumber: string | null;
  sourceUrl: string | null;
  parcelNumber: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  normalizedEntityName: string | null;
  signalDate: Date;
}) {
  if (opportunity.permitId) {
    return `permit:${opportunity.permitId}`;
  }

  if (opportunity.sourceId && opportunity.permitNumber) {
    return `source-permit:${opportunity.sourceId}:${normalizeWhitespace(opportunity.permitNumber)?.toLowerCase()}`;
  }

  if (opportunity.sourceId && opportunity.sourceUrl && opportunity.parcelNumber) {
    return `source-url-parcel:${opportunity.sourceId}:${opportunity.sourceUrl}:${normalizeWhitespace(opportunity.parcelNumber)?.toLowerCase()}`;
  }

  return [
    "source-address",
    opportunity.sourceId ?? "no-source",
    normalizeAddressKey(opportunity.address),
    normalizeWhitespace(opportunity.city ?? "")?.toLowerCase() ?? "",
    normalizeWhitespace(opportunity.county ?? "")?.toLowerCase() ?? "",
    normalizeWhitespace(opportunity.normalizedEntityName ?? "")?.toLowerCase() ?? "",
    opportunity.signalDate.toISOString().slice(0, 10)
  ].join(":");
}

async function deduplicateProperties() {
  const properties = await prisma.property.findMany({
    include: {
      city: true,
      parcel: true,
      _count: {
        select: {
          permits: true,
          plotOpportunities: true,
          notes: true,
          activities: true
        }
      }
    }
  });

  const groups = new Map<string, typeof properties>();

  for (const property of properties) {
    const key =
      property.parcelNumber
        ? `parcel:${normalizeWhitespace(property.parcelNumber)?.toLowerCase()}`
        : [
            "address",
            normalizeAddressKey(property.normalizedAddress ?? property.address),
            property.city?.name ? normalizeWhitespace(property.city.name)?.toLowerCase() : "",
            property.countyId ?? "",
            normalizeWhitespace(property.lotNumber ?? "")?.toLowerCase() ?? "",
            normalizeWhitespace(property.subdivision ?? "")?.toLowerCase() ?? ""
          ].join(":");

    const existing = groups.get(key) ?? [];
    existing.push(property);
    groups.set(key, existing);
  }

  let deletedCount = 0;

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    const ranked = [...group].sort((left, right) => {
      const leftStrength =
        left._count.permits + left._count.plotOpportunities + left._count.notes + left._count.activities + (left.parcel ? 1 : 0);
      const rightStrength =
        right._count.permits + right._count.plotOpportunities + right._count.notes + right._count.activities + (right.parcel ? 1 : 0);

      if (rightStrength !== leftStrength) {
        return rightStrength - leftStrength;
      }

      return left.id.localeCompare(right.id);
    });

    const canonical = ranked[0];
    const duplicates = ranked.slice(1);

    await prisma.property.update({
      where: { id: canonical.id },
      data: {
        address: firstNonEmpty(canonical.address, ...duplicates.map((item) => item.address)) ?? canonical.address,
        normalizedAddress:
          firstNonEmpty(canonical.normalizedAddress, ...duplicates.map((item) => item.normalizedAddress)) ?? canonical.normalizedAddress,
        cityId: firstNonEmpty(canonical.cityId, ...duplicates.map((item) => item.cityId)),
        countyId: firstNonEmpty(canonical.countyId, ...duplicates.map((item) => item.countyId)),
        zip: firstNonEmpty(canonical.zip, ...duplicates.map((item) => item.zip)),
        subdivision: firstNonEmpty(canonical.subdivision, ...duplicates.map((item) => item.subdivision)),
        lotNumber: firstNonEmpty(canonical.lotNumber, ...duplicates.map((item) => item.lotNumber)),
        parcelNumber: firstNonEmpty(canonical.parcelNumber, ...duplicates.map((item) => item.parcelNumber)),
        landValue:
          toDecimal(Math.max(...[canonical.landValue, ...duplicates.map((item) => item.landValue)].map((value) => Number(value ?? 0)))) ??
          canonical.landValue,
        improvementValue:
          toDecimal(
            Math.max(...[canonical.improvementValue, ...duplicates.map((item) => item.improvementValue)].map((value) => Number(value ?? 0)))
          ) ?? canonical.improvementValue
      }
    });

    for (const duplicate of duplicates) {
      await prisma.permit.updateMany({
        where: {
          propertyId: duplicate.id
        },
        data: {
          propertyId: canonical.id
        }
      });

      await prisma.plotOpportunity.updateMany({
        where: {
          propertyId: duplicate.id
        },
        data: {
          propertyId: canonical.id
        }
      });

      await prisma.activity.updateMany({
        where: {
          propertyId: duplicate.id
        },
        data: {
          propertyId: canonical.id
        }
      });

      await prisma.note.updateMany({
        where: {
          propertyId: duplicate.id
        },
        data: {
          propertyId: canonical.id
        }
      });

      if (duplicate.parcel && !canonical.parcel) {
        await prisma.parcel.update({
          where: {
            id: duplicate.parcel.id
          },
          data: {
            propertyId: canonical.id
          }
        });
      }

      await prisma.property.delete({
        where: {
          id: duplicate.id
        }
      });

      deletedCount += 1;
    }
  }

  return deletedCount;
}

async function deduplicatePlotOpportunities(organizationId: string) {
  const opportunities = await prisma.plotOpportunity.findMany({
    where: {
      organizationId
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  const groups = new Map<string, typeof opportunities>();

  for (const opportunity of opportunities) {
    const key = buildOpportunityDuplicateKey(opportunity);
    const existing = groups.get(key) ?? [];
    existing.push(opportunity);
    groups.set(key, existing);
  }

  let deletedCount = 0;
  const affectedBuilderIds = new Set<string>();

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    const ranked = [...group].sort((left, right) => {
      const leftNotes = Array.isArray(left.notes) ? left.notes.length : 0;
      const rightNotes = Array.isArray(right.notes) ? right.notes.length : 0;
      const leftScore =
        bidStatusPriority[left.bidStatus] * 1000 +
        (left.preferredSalesName ? 100 : 0) +
        (left.builderId ? 50 : 0) +
        (leftNotes * 5) +
        left.opportunityScore;
      const rightScore =
        bidStatusPriority[right.bidStatus] * 1000 +
        (right.preferredSalesName ? 100 : 0) +
        (right.builderId ? 50 : 0) +
        (rightNotes * 5) +
        right.opportunityScore;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return right.updatedAt.getTime() - left.updatedAt.getTime();
    });

    const canonical = ranked[0];
    const duplicates = ranked.slice(1);

    await prisma.plotOpportunity.update({
      where: {
        id: canonical.id
      },
      data: {
        propertyId: firstNonEmpty(canonical.propertyId, ...duplicates.map((item) => item.propertyId)),
        permitId: firstNonEmpty(canonical.permitId, ...duplicates.map((item) => item.permitId)),
        builderId: firstNonEmpty(canonical.builderId, ...duplicates.map((item) => item.builderId)),
        sourceId: firstNonEmpty(canonical.sourceId, ...duplicates.map((item) => item.sourceId)),
        assignedMembershipId: firstNonEmpty(canonical.assignedMembershipId, ...duplicates.map((item) => item.assignedMembershipId)),
        address: firstNonEmpty(canonical.address, ...duplicates.map((item) => item.address)),
        city: firstNonEmpty(canonical.city, ...duplicates.map((item) => item.city)),
        county: firstNonEmpty(canonical.county, ...duplicates.map((item) => item.county)),
        subdivision: firstNonEmpty(canonical.subdivision, ...duplicates.map((item) => item.subdivision)),
        parcelNumber: firstNonEmpty(canonical.parcelNumber, ...duplicates.map((item) => item.parcelNumber)),
        lotNumber: firstNonEmpty(canonical.lotNumber, ...duplicates.map((item) => item.lotNumber)),
        builderName: firstNonEmpty(canonical.builderName, ...duplicates.map((item) => item.builderName)),
        likelyCompanyName: firstNonEmpty(canonical.likelyCompanyName, ...duplicates.map((item) => item.likelyCompanyName)),
        rawSourceName: firstNonEmpty(canonical.rawSourceName, ...duplicates.map((item) => item.rawSourceName)),
        normalizedEntityName: firstNonEmpty(canonical.normalizedEntityName, ...duplicates.map((item) => item.normalizedEntityName)),
        preferredSalesName: firstNonEmpty(canonical.preferredSalesName, ...duplicates.map((item) => item.preferredSalesName)),
        legalEntityName: firstNonEmpty(canonical.legalEntityName, ...duplicates.map((item) => item.legalEntityName)),
        roleType:
          [canonical, ...duplicates].sort((left, right) => right.entityConfidenceScore - left.entityConfidenceScore)[0]?.roleType ?? canonical.roleType,
        entityConfidenceScore: Math.max(canonical.entityConfidenceScore, ...duplicates.map((item) => item.entityConfidenceScore)),
        contactQualityTier:
          [canonical, ...duplicates].sort((left, right) => left.contactQualityTier.localeCompare(right.contactQualityTier))[0]
            ?.contactQualityTier ?? canonical.contactQualityTier,
        currentStage:
          [...group].sort((left, right) => bidStatusPriority[right.bidStatus] - bidStatusPriority[left.bidStatus])[0]?.currentStage ??
          canonical.currentStage,
        preferredContactTarget: firstNonEmpty(canonical.preferredContactTarget, ...duplicates.map((item) => item.preferredContactTarget)),
        permitNumber: firstNonEmpty(canonical.permitNumber, ...duplicates.map((item) => item.permitNumber)),
        sourceName: firstNonEmpty(canonical.sourceName, ...duplicates.map((item) => item.sourceName)),
        sourceJurisdiction: firstNonEmpty(canonical.sourceJurisdiction, ...duplicates.map((item) => item.sourceJurisdiction)),
        sourceUrl: firstNonEmpty(canonical.sourceUrl, ...duplicates.map((item) => item.sourceUrl)),
        vacancyConfidence: Math.max(canonical.vacancyConfidence, ...duplicates.map((item) => item.vacancyConfidence)),
        opportunityScore: Math.max(canonical.opportunityScore, ...duplicates.map((item) => item.opportunityScore)),
        contactedAt: minDate(canonical.contactedAt, ...duplicates.map((item) => item.contactedAt)),
        lastContactedAt: maxDate(canonical.lastContactedAt, ...duplicates.map((item) => item.lastContactedAt)),
        nextFollowUpAt: minDate(canonical.nextFollowUpAt, ...duplicates.map((item) => item.nextFollowUpAt)),
        followUpNeeded: [canonical, ...duplicates].some((item) => item.followUpNeeded),
        interestStatus: firstNonEmpty(canonical.interestStatus, ...duplicates.map((item) => item.interestStatus)),
        outcomeStatus: firstNonEmpty(canonical.outcomeStatus, ...duplicates.map((item) => item.outcomeStatus)),
        contactSummary: firstNonEmpty(canonical.contactSummary, ...duplicates.map((item) => item.contactSummary)),
        notesSummary: firstNonEmpty(canonical.notesSummary, ...duplicates.map((item) => item.notesSummary)),
        outreachCount: canonical.outreachCount + duplicates.reduce((sum, item) => sum + item.outreachCount, 0),
        callCount: canonical.callCount + duplicates.reduce((sum, item) => sum + item.callCount, 0),
        emailCount: canonical.emailCount + duplicates.reduce((sum, item) => sum + item.emailCount, 0),
        textCount: canonical.textCount + duplicates.reduce((sum, item) => sum + item.textCount, 0),
        reasonLost: firstNonEmpty(canonical.reasonLost, ...duplicates.map((item) => item.reasonLost)),
        internalNotes: firstNonEmpty(canonical.internalNotes, ...duplicates.map((item) => item.internalNotes)),
        externalSummary: firstNonEmpty(canonical.externalSummary, ...duplicates.map((item) => item.externalSummary)),
        quoteRequestedAt: minDate(canonical.quoteRequestedAt, ...duplicates.map((item) => item.quoteRequestedAt)),
        quoteSentAt: minDate(canonical.quoteSentAt, ...duplicates.map((item) => item.quoteSentAt)),
        contactStatus: firstNonEmpty(canonical.contactStatus, ...duplicates.map((item) => item.contactStatus)),
        nextAction: firstNonEmpty(canonical.nextAction, ...duplicates.map((item) => item.nextAction)),
        nextFollowUpDate: minDate(canonical.nextFollowUpDate, ...duplicates.map((item) => item.nextFollowUpDate)),
        inquiredAt: minDate(canonical.inquiredAt, ...duplicates.map((item) => item.inquiredAt)),
        needsFollowUp: [canonical, ...duplicates].some((item) => item.needsFollowUp),
        suggestedFollowUpDate: minDate(canonical.suggestedFollowUpDate, ...duplicates.map((item) => item.suggestedFollowUpDate)),
        secondFollowUpDate: minDate(canonical.secondFollowUpDate, ...duplicates.map((item) => item.secondFollowUpDate)),
        followedUpOn: maxDate(canonical.followedUpOn, ...duplicates.map((item) => item.followedUpOn)),
        notes: mergeJsonNotes([canonical.notes, ...duplicates.map((item) => item.notes)]),
        closedAt: maxDate(canonical.closedAt, ...duplicates.map((item) => item.closedAt)),
        signalDate: minDate(canonical.signalDate, ...duplicates.map((item) => item.signalDate)) ?? canonical.signalDate,
        bidStatus:
          [...group].sort((left, right) => bidStatusPriority[right.bidStatus] - bidStatusPriority[left.bidStatus])[0]?.bidStatus ??
          canonical.bidStatus
      }
    });

    for (const duplicate of duplicates) {
      if (duplicate.builderId) {
        affectedBuilderIds.add(duplicate.builderId);
      }

      await prisma.contact.updateMany({
        where: {
          opportunityId: duplicate.id
        },
        data: {
          opportunityId: canonical.id
        }
      });

      await prisma.activity.updateMany({
        where: {
          opportunityId: duplicate.id
        },
        data: {
          opportunityId: canonical.id
        }
      });

      await prisma.plotOpportunity.delete({
        where: {
          id: duplicate.id
        }
      });

      deletedCount += 1;
    }

    if (canonical.builderId) {
      affectedBuilderIds.add(canonical.builderId);
    }
  }

  return {
    deletedCount,
    affectedBuilderIds
  };
}

async function cleanupDuplicateRecords(organizationId: string) {
  const deletedProperties = await deduplicateProperties();
  const opportunityCleanup = await deduplicatePlotOpportunities(organizationId);

  return {
    deletedProperties,
    deletedOpportunities: opportunityCleanup.deletedCount,
    affectedBuilderIds: opportunityCleanup.affectedBuilderIds
  };
}

export async function runDuplicateCleanup() {
  const baseline = await ensureBaselineMetadata();
  const cleanup = await cleanupDuplicateRecords(baseline.organizationId);

  for (const builderId of cleanup.affectedBuilderIds) {
    await refreshBuilderRollup(baseline.organizationId, builderId);
  }

  return {
    deletedProperties: cleanup.deletedProperties,
    deletedOpportunities: cleanup.deletedOpportunities
  };
}

async function ensureCityAndCounty(cityName: string, countyName: string) {
  const county = await prisma.county.upsert({
    where: {
      name: countyName
    },
    update: {},
    create: {
      name: countyName
    }
  });

  const normalizedCity = normalizeWhitespace(cityName);

  if (!normalizedCity) {
    return {
      countyId: county.id,
      cityId: null as string | null
    };
  }

  const city = await prisma.city.upsert({
    where: {
      name_countyId: {
        name: normalizedCity,
        countyId: county.id
      }
    },
    update: {},
    create: {
      name: normalizedCity,
      countyId: county.id
    }
  });

  return {
    countyId: county.id,
    cityId: city.id
  };
}

async function upsertBuilderRecord(organizationId: string, record: NormalizedPermitInput) {
  const identity = resolveEntityIdentity(record);
  const rawName = identity.rawSourceName ?? "";
  const normalizedName = identity.normalizedEntityName ?? normalizeBuilderName(rawName);

  if (!normalizedName) {
    return null;
  }

  const company = await prisma.company.upsert({
    where: {
      organizationId_normalizedName: {
        organizationId,
        normalizedName
      }
    },
    update: {
      legalName: identity.legalEntityName || rawName || normalizedName,
      rawSourceName: identity.rawSourceName,
      preferredSalesName: identity.preferredSalesName,
      roleType: identity.roleType.toUpperCase() as never,
      contactQualityTier: identity.contactQualityTier.toUpperCase() as never,
      preferredContactTarget: identity.preferredContactTarget,
      entityConfidenceScore: identity.entityConfidenceScore
    },
    create: {
      organizationId,
      legalName: identity.legalEntityName || rawName || normalizedName,
      normalizedName,
      rawSourceName: identity.rawSourceName,
      preferredSalesName: identity.preferredSalesName,
      roleType: identity.roleType.toUpperCase() as never,
      contactQualityTier: identity.contactQualityTier.toUpperCase() as never,
      preferredContactTarget: identity.preferredContactTarget,
      entityConfidenceScore: identity.entityConfidenceScore
    }
  });

  const builder = await prisma.builder.upsert({
    where: {
      organizationId_normalizedName: {
        organizationId,
        normalizedName
      }
    },
    update: {
      companyId: company.id,
      name: identity.legalEntityName || rawName || normalizedName,
      rawSourceName: identity.rawSourceName,
      preferredSalesName: identity.preferredSalesName,
      roleType: identity.roleType.toUpperCase() as never,
      contactQualityTier: identity.contactQualityTier.toUpperCase() as never,
      preferredContactTarget: identity.preferredContactTarget,
      confidenceScore: identity.entityConfidenceScore
    },
    create: {
      organizationId,
      companyId: company.id,
      name: identity.legalEntityName || rawName || normalizedName,
      normalizedName,
      rawSourceName: identity.rawSourceName,
      preferredSalesName: identity.preferredSalesName,
      roleType: identity.roleType.toUpperCase() as never,
      contactQualityTier: identity.contactQualityTier.toUpperCase() as never,
      preferredContactTarget: identity.preferredContactTarget,
      confidenceScore: identity.entityConfidenceScore
    }
  });

  if (rawName) {
    const existingAlias = await prisma.builderAlias.findFirst({
      where: {
        builderId: builder.id,
        rawName
      },
      select: {
        id: true
      }
    });

    if (!existingAlias) {
      await prisma.builderAlias.create({
        data: {
          builderId: builder.id,
          rawName
        }
      });
    }
  }

  return builder;
}

async function upsertPropertyRecord(record: NormalizedPermitInput) {
  const { countyId, cityId } = await ensureCityAndCounty(record.city, record.county);
  const normalizedAddress = normalizeWhitespace(record.address);
  const propertyData = {
    address: normalizedAddress || record.address,
    normalizedAddress,
    cityId,
    countyId,
    state: record.state || "IA",
    zip: record.zip ?? null,
    subdivision: record.subdivision ?? null,
    lotNumber: record.lotNumber ?? null,
    parcelNumber: record.parcelNumber ?? null,
    landValue: toDecimal(record.landValue),
    improvementValue: toDecimal(record.improvementValue)
  };

  let property =
    record.parcelNumber
      ? await prisma.property.upsert({
          where: {
            parcelNumber: record.parcelNumber
          },
          update: propertyData,
          create: {
            ...propertyData,
            parcel: {
              create: {
                parcelNumber: record.parcelNumber
              }
            }
          }
        })
      : await prisma.property.findFirst({
          where: {
            normalizedAddress,
            cityId,
            countyId
          }
        });

  if (!property) {
    property = await prisma.property.create({
      data: propertyData
    });
  } else if (!record.parcelNumber) {
    property = await prisma.property.update({
      where: {
        id: property.id
      },
      data: propertyData
    });
  }

  if (record.parcelNumber) {
    await prisma.parcel.upsert({
      where: {
        parcelNumber: record.parcelNumber
      },
      update: {
        propertyId: property.id
      },
      create: {
        propertyId: property.id,
        parcelNumber: record.parcelNumber
      }
    });
  }

  return property;
}

async function upsertCapturedSignalRecord(options: {
  sourceDbId: string;
  runId: string;
  record: NormalizedPermitInput;
}) {
  const now = new Date();
  const recordKey = buildRecordKey(options.record);
  const contentHash = buildContentHash(options.record);
  const existing = await prisma.rawRecord.findUnique({
    where: {
      sourceId_dedupeHash: {
        sourceId: options.sourceDbId,
        dedupeHash: options.record.dedupeHash
      }
    },
    select: {
      id: true,
      contentHash: true,
      firstSeenAt: true
    }
  });

  const changeStatus =
    !existing
      ? SourceRecordChangeStatus.NEW
      : existing.contentHash === contentHash
        ? SourceRecordChangeStatus.UNCHANGED
        : SourceRecordChangeStatus.UPDATED;

  return existing
    ? prisma.rawRecord.update({
        where: {
          id: existing.id
        },
        data: {
          runId: options.runId,
          externalId: options.record.permitNumber || options.record.parcelNumber || options.record.address || recordKey,
          sourceUrl: options.record.sourceUrl,
          recordKey,
          contentHash,
          payload: toJson(options.record.rawPayload),
          fetchedAt: now,
          lastSeenAt: now,
          changeStatus,
          parseStatus: SourceRecordParseStatus.PARSED,
          errorMessage: null
        }
      })
    : prisma.rawRecord.create({
        data: {
          sourceId: options.sourceDbId,
          runId: options.runId,
          externalId: options.record.permitNumber || options.record.parcelNumber || options.record.address || recordKey,
          sourceUrl: options.record.sourceUrl,
          recordKey,
          contentHash,
          firstSeenAt: now,
          lastSeenAt: now,
          changeStatus,
          parseStatus: SourceRecordParseStatus.PARSED,
          payload: toJson(options.record.rawPayload),
          dedupeHash: options.record.dedupeHash,
          fetchedAt: now
        }
      });
}

async function upsertPermitRecord(options: {
  sourceDbId: string;
  propertyId: string;
  builderId: string | null;
  record: NormalizedPermitInput;
}) {
  const permitData = {
    sourceId: options.sourceDbId,
    propertyId: options.propertyId,
    builderId: options.builderId,
    permitNumber: options.record.permitNumber,
    permitType: options.record.permitType,
    permitSubtype: options.record.permitSubtype ?? null,
    permitStatus: options.record.permitStatus,
    applicationDate: options.record.applicationDate ? new Date(options.record.applicationDate) : null,
    issueDate: options.record.issueDate ? new Date(options.record.issueDate) : null,
    projectDescription: options.record.projectDescription ?? null,
    estimatedProjectValue: toDecimal(options.record.estimatedProjectValue),
    landValue: toDecimal(options.record.landValue),
    improvementValue: toDecimal(options.record.improvementValue),
    ownerName: options.record.ownerName ?? null,
    contractorName: options.record.contractorName ?? null,
    developerName: options.record.developerName ?? null,
    sourceUrl: options.record.sourceUrl,
    classification: options.record.classification.toUpperCase() as never,
    dedupeHash: options.record.dedupeHash
  };
  const existingPermit = await prisma.permit.findFirst({
    where: {
      OR: [
        {
          dedupeHash: options.record.dedupeHash
        },
        {
          permitNumber: options.record.permitNumber,
          sourceUrl: options.record.sourceUrl
        }
      ]
    },
    select: {
      id: true
    }
  });

  return existingPermit
    ? prisma.permit.update({
        where: {
          id: existingPermit.id
        },
        data: permitData
      })
    : prisma.permit.create({
        data: permitData
      });
}

async function upsertOpportunityLead(options: {
  organizationId: string;
  sourceDbId: string;
  propertyId: string;
  permitId: string;
  builder:
    | {
        id: string;
        name: string;
        rawSourceName: string | null;
        normalizedName: string;
        preferredSalesName: string | null;
        roleType: string;
        confidenceScore: number;
        contactQualityTier: string;
        preferredContactTarget: string | null;
      }
    | null;
  record: NormalizedPermitInput;
}) {
  const opportunity = mapNormalizedPermitToOpportunity(options.record);
  const persistenceData = opportunityToPersistenceData(
    {
      ...opportunity,
      assignedMembershipId: null,
      assignedRep: "Open Territory",
      builderId: options.builder?.id ?? opportunity.builderId,
      builderName: options.builder?.name ?? opportunity.builderName,
      likelyCompanyName: options.builder?.name ?? opportunity.likelyCompanyName,
      rawSourceName: options.builder?.rawSourceName ?? opportunity.rawSourceName,
      normalizedEntityName: options.builder?.normalizedName ?? opportunity.normalizedEntityName,
      preferredSalesName: options.builder?.preferredSalesName ?? opportunity.preferredSalesName,
      legalEntityName: options.builder?.name ?? opportunity.legalEntityName,
      roleType: (options.builder?.roleType?.toLowerCase() as typeof opportunity.roleType) ?? opportunity.roleType,
      entityConfidenceScore: options.builder?.confidenceScore ?? opportunity.entityConfidenceScore,
      contactQualityTier:
        (options.builder?.contactQualityTier?.toLowerCase() as typeof opportunity.contactQualityTier) ??
        opportunity.contactQualityTier,
      preferredContactTarget: options.builder?.preferredContactTarget ?? opportunity.preferredContactTarget
    },
    options.organizationId
  );
  const {
    id: _ignoredId,
    organizationId: _ignoredOrganizationId,
    assignedMembershipId: _ignoredAssignedMembershipId,
    currentStage: _ignoredCurrentStage,
    bidStatus: _ignoredBidStatus,
    contactedAt: _ignoredContactedAt,
    lastContactedAt: _ignoredLastContactedAt,
    nextFollowUpAt: _ignoredNextFollowUpAt,
    followUpNeeded: _ignoredFollowUpNeeded,
    interestStatus: _ignoredInterestStatus,
    outcomeStatus: _ignoredOutcomeStatus,
    contactSummary: _ignoredContactSummary,
    notesSummary: _ignoredNotesSummary,
    outreachCount: _ignoredOutreachCount,
    callCount: _ignoredCallCount,
    emailCount: _ignoredEmailCount,
    textCount: _ignoredTextCount,
    reasonLost: _ignoredReasonLost,
    internalNotes: _ignoredInternalNotes,
    externalSummary: _ignoredExternalSummary,
    quoteRequestedAt: _ignoredQuoteRequestedAt,
    quoteSentAt: _ignoredQuoteSentAt,
    contactStatus: _ignoredContactStatus,
    nextAction: _ignoredNextAction,
    nextFollowUpDate: _ignoredNextFollowUpDate,
    inquiredAt: _ignoredInquiredAt,
    needsFollowUp: _ignoredNeedsFollowUp,
    suggestedFollowUpDate: _ignoredSuggestedFollowUpDate,
    secondFollowUpDate: _ignoredSecondFollowUpDate,
    followedUpOn: _ignoredFollowedUpOn,
    notes: _ignoredNotes,
    closedAt: _ignoredClosedAt,
    ...updateData
  } = persistenceData;

  return prisma.plotOpportunity.upsert({
    where: {
      id: opportunity.id
    },
    update: {
      ...updateData,
      propertyId: options.propertyId,
      permitId: options.permitId,
      builderId: options.builder?.id ?? null,
      sourceId: options.sourceDbId,
      address: opportunity.address,
      city: opportunity.city,
      county: opportunity.county,
      subdivision: opportunity.subdivision,
      parcelNumber: opportunity.parcelNumber,
      lotNumber: opportunity.lotNumber,
      builderName: options.builder?.name ?? opportunity.builderName
    },
    create: {
      ...persistenceData,
      propertyId: options.propertyId,
      permitId: options.permitId,
      builderId: options.builder?.id ?? null,
      sourceId: options.sourceDbId,
      address: opportunity.address,
      city: opportunity.city,
      county: opportunity.county,
      subdivision: opportunity.subdivision,
      parcelNumber: opportunity.parcelNumber,
      lotNumber: opportunity.lotNumber,
      builderName: options.builder?.name ?? opportunity.builderName
    }
  });
}

async function refreshBuilderRollup(organizationId: string, builderId: string) {
  const opportunities = await prisma.plotOpportunity.findMany({
    where: {
      organizationId,
      builderId
    },
    include: {
      property: true,
      permit: true
    }
  });

  const openOpportunities = opportunities.filter(
    (opportunity) =>
      !new Set<BidStatus>([BidStatus.WON, BidStatus.LOST, BidStatus.NOT_A_FIT]).has(opportunity.bidStatus)
  );
  const activePropertyIds = new Set(openOpportunities.map((opportunity) => opportunity.propertyId).filter(Boolean));
  const counties = new Set(
    openOpportunities
      .map((opportunity) => opportunity.county ?? opportunity.property?.countyId ?? null)
      .filter(Boolean)
  );
  const totalLandValue = opportunities.reduce((sum, opportunity) => {
    const value = opportunity.property?.landValue ?? opportunity.permit?.landValue;
    return sum + Number(value ?? 0);
  }, 0);
  const totalImprovementValue = opportunities.reduce((sum, opportunity) => {
    const value = opportunity.property?.improvementValue ?? opportunity.permit?.improvementValue ?? opportunity.permit?.estimatedProjectValue;
    return sum + Number(value ?? 0);
  }, 0);
  const builderHeatScore = Math.min(100, activePropertyIds.size * 12 + counties.size * 10 + openOpportunities.length * 6);

  await prisma.builder.update({
    where: {
      id: builderId
    },
    data: {
      activeProperties: activePropertyIds.size,
      totalLandValue: toDecimal(totalLandValue),
      totalImprovementValue: toDecimal(totalImprovementValue),
      builderHeatScore
    }
  });
}

async function syncRecordReviewState(input: {
  organizationId: string;
  sourceDbId: string;
  rawRecordId: string;
  record: NormalizedPermitInput;
  builderId?: string | null;
  opportunityId?: string | null;
}) {
  const identity = resolveEntityIdentity(input.record);
  const missingFieldCount = countMissingCriticalFields(input.record);

  if (missingFieldCount > 0) {
    await upsertReviewQueueItem(prisma, {
      organizationId: input.organizationId,
      reviewType: ReviewQueueType.MISSING_FIELD,
      title: "Review incomplete source record",
      details: input.record.address || input.record.parcelNumber || input.record.permitNumber,
      rationale: `This record is missing ${missingFieldCount} critical field${missingFieldCount === 1 ? "" : "s"} and should be checked before it drives sales action.`,
      sourceId: input.sourceDbId,
      rawRecordId: input.rawRecordId,
      builderId: input.builderId ?? null,
      opportunityId: input.opportunityId ?? null,
      sourceUrl: input.record.sourceUrl,
      fingerprint: `${input.sourceDbId}:${input.record.dedupeHash}:missing-field`,
      confidenceScore: Math.max(10, 100 - missingFieldCount * 20),
      priority: 74
    });
  } else {
    await resolveReviewQueueItems(prisma, {
      organizationId: input.organizationId,
      reviewType: ReviewQueueType.MISSING_FIELD,
      rawRecordId: input.rawRecordId
    });
  }

  if (!identity.preferredSalesName || identity.entityConfidenceScore < 64) {
    await upsertReviewQueueItem(prisma, {
      organizationId: input.organizationId,
      reviewType: ReviewQueueType.WEAK_IDENTITY,
      title: "Research builder identity",
      details:
        identity.rawSourceName ??
        input.record.ownerName ??
        input.record.contractorName ??
        input.record.developerName ??
        "Unknown entity",
      rationale: "This record does not yet resolve to a confident builder or contractor identity.",
      sourceId: input.sourceDbId,
      rawRecordId: input.rawRecordId,
      builderId: input.builderId ?? null,
      opportunityId: input.opportunityId ?? null,
      sourceUrl: input.record.sourceUrl,
      fingerprint: `${input.sourceDbId}:${input.record.dedupeHash}:weak-identity`,
      confidenceScore: identity.entityConfidenceScore,
      priority: 82
    });
  } else {
    await resolveReviewQueueItems(prisma, {
      organizationId: input.organizationId,
      reviewType: ReviewQueueType.WEAK_IDENTITY,
      rawRecordId: input.rawRecordId
    });
  }

  return {
    missingFieldCount,
    hasWeakIdentity: !identity.preferredSalesName || identity.entityConfidenceScore < 64
  };
}

async function persistNormalizedRecords(options: {
  organizationId: string;
  sourceDbId: string;
  runId: string;
  normalized: NormalizedPermitInput[];
}) {
  const builderIds = new Set<string>();
  let dedupedCount = 0;
  let parseFailureCount = 0;
  let missingFieldCount = 0;

  for (const record of options.normalized) {
    const capturedSignal = await upsertCapturedSignalRecord({
      sourceDbId: options.sourceDbId,
      runId: options.runId,
      record
    });

    try {
      const property = await upsertPropertyRecord(record);
      const builder = await upsertBuilderRecord(options.organizationId, record);

      if (builder) {
        builderIds.add(builder.id);
      }

      const permit = await upsertPermitRecord({
        sourceDbId: options.sourceDbId,
        propertyId: property.id,
        builderId: builder?.id ?? null,
        record
      });

      const opportunity = await upsertOpportunityLead({
        organizationId: options.organizationId,
        sourceDbId: options.sourceDbId,
        propertyId: property.id,
        permitId: permit.id,
        builder,
        record
      });

      await prisma.rawRecord.update({
        where: {
          id: capturedSignal.id
        },
        data: {
          permitId: permit.id,
          parseStatus: SourceRecordParseStatus.PARSED,
          errorMessage: null
        }
      });

      const reviewState = await syncRecordReviewState({
        organizationId: options.organizationId,
        sourceDbId: options.sourceDbId,
        rawRecordId: capturedSignal.id,
        builderId: builder?.id ?? null,
        opportunityId: opportunity.id,
        record
      });

      missingFieldCount += reviewState.missingFieldCount;
      await resolveReviewQueueItems(prisma, {
        organizationId: options.organizationId,
        reviewType: ReviewQueueType.PARSE_FAILURE,
        rawRecordId: capturedSignal.id
      });

      dedupedCount += 1;
    } catch (error) {
      parseFailureCount += 1;
      await prisma.rawRecord.update({
        where: {
          id: capturedSignal.id
        },
        data: {
          parseStatus: SourceRecordParseStatus.FAILED,
          changeStatus: SourceRecordChangeStatus.ERROR,
          errorMessage: error instanceof Error ? error.message : "Unknown record persistence failure."
        }
      });

      await upsertReviewQueueItem(prisma, {
        organizationId: options.organizationId,
        reviewType: ReviewQueueType.PARSE_FAILURE,
        title: "Review failed source record",
        details: record.address || record.parcelNumber || record.permitNumber,
        rationale: error instanceof Error ? error.message : "Unknown record persistence failure.",
        sourceId: options.sourceDbId,
        rawRecordId: capturedSignal.id,
        sourceUrl: record.sourceUrl,
        fingerprint: `${options.sourceDbId}:${record.dedupeHash}:parse-failure`,
        confidenceScore: 0,
        priority: 90
      });
      continue;
    }
  }

  const cleanup = await cleanupDuplicateRecords(options.organizationId);

  for (const builderId of cleanup.affectedBuilderIds) {
    builderIds.add(builderId);
  }

  for (const builderId of builderIds) {
    await refreshBuilderRollup(options.organizationId, builderId);
  }

  return {
    dedupedCount,
    parseFailureCount,
    missingFieldCount,
    duplicatePropertiesDeleted: cleanup.deletedProperties,
    duplicateOpportunitiesDeleted: cleanup.deletedOpportunities,
    builderIds: [...builderIds]
  };
}

async function executeConnectorSync(sourceDefinitionId: string) {
  const sourceDefinition = getOfficialSourceDefinition(sourceDefinitionId);

  if (!sourceDefinition) {
    throw new Error(`Unknown source: ${sourceDefinitionId}`);
  }

  const connector = getConnector(sourceDefinition.parserType);
  const baseline = await ensureBaselineMetadata();
  const source = await prisma.source.findUniqueOrThrow({
    where: {
      organizationId_slug: {
        organizationId: baseline.organizationId,
        slug: sourceDefinition.slug
      }
    }
  });

  const run = await prisma.sourceSyncRun.create({
    data: {
      sourceId: source.id,
      status: SourceSyncStatus.running,
      message: `Starting sync for ${sourceDefinition.name}.`
    }
  });

  await closeCompetingRunningSyncs(source.id, run.id);

  try {
    await prisma.sourceSyncLog.create({
      data: {
        runId: run.id,
        level: "info",
        message: `Starting connector run for ${sourceDefinition.name}.`
      }
    });

    const result = await runConnectorWithRetry(
      sourceDefinition.name,
      (signal) =>
      connector.run({
        sourceId: source.id,
        sourceSlug: source.slug,
        organizationId: baseline.organizationId,
        runId: run.id,
        signal
      }),
      {
        onRetry: async (attempt, error) => {
          await prisma.sourceSyncLog.create({
            data: {
              runId: run.id,
              level: "warning",
              message: `Retrying ${sourceDefinition.name} after attempt ${attempt} failed: ${error.message}`
            }
          });
        }
      }
    );
    const persisted = await persistNormalizedRecords({
      organizationId: baseline.organizationId,
      sourceDbId: source.id,
      runId: run.id,
      normalized: result.normalized
    });
    if (persisted.builderIds.length) {
      await runBuilderEnrichment({
        organizationId: baseline.organizationId,
        builderIds: persisted.builderIds
      });
    }
    const status = sourceRunStatusFromCount(result.normalized.length);

    await prisma.sourceSyncLog.createMany({
      data: result.logs.map((log) => ({
        runId: run.id,
        level: log.level,
        message: log.message
      }))
    });

    await prisma.sourceSyncRun.update({
      where: {
        id: run.id
      },
      data: {
        status,
        fetchedCount: result.fetched.length,
        normalizedCount: result.normalized.length,
        dedupedCount: persisted.dedupedCount,
        finishedAt: new Date(),
        message: `Persisted ${persisted.dedupedCount} normalized record(s) from ${sourceDefinition.name}. Removed ${persisted.duplicateOpportunitiesDeleted} duplicate opportunit${persisted.duplicateOpportunitiesDeleted === 1 ? "y" : "ies"}.`
      }
    });

    await prisma.source.update({
      where: {
        id: source.id
      },
      data: {
        sourceConfidenceScore: result.reliabilityScore,
        sourceFreshnessScore: Math.min(100, 65 + Math.min(result.normalized.length, 20)),
        syncStatus: status,
        lastSuccessfulSync: new Date()
      }
    });

    await createSourceHealthCheck({
      organizationId: baseline.organizationId,
      sourceId: source.id,
      runId: run.id,
      status,
      fetchedCount: result.fetched.length,
      normalizedCount: result.normalized.length,
      parseFailureCount: persisted.parseFailureCount,
      missingFieldCount: persisted.missingFieldCount,
      duplicateCount: persisted.duplicateOpportunitiesDeleted + persisted.duplicatePropertiesDeleted,
      notes:
        result.normalized.length > 0
          ? `Connector completed successfully for ${sourceDefinition.name}.`
          : `Connector ran, but no normalized records were produced for ${sourceDefinition.name}.`
    });

    if (result.fetched.length > 0 && result.normalized.length === 0) {
      await upsertReviewQueueItem(prisma, {
        organizationId: baseline.organizationId,
        sourceId: source.id,
        reviewType: ReviewQueueType.PARSE_FAILURE,
        title: "Review low-yield connector run",
        details: `${sourceDefinition.name} fetched ${result.fetched.length} record(s) but normalized 0.`,
        rationale: "The connector ran successfully but produced no usable normalized records. Review layout drift or parser coverage.",
        sourceUrl: sourceDefinition.sourceUrl,
        fingerprint: `${source.id}:low-yield`,
        confidenceScore: 18,
        priority: 88
      });
    } else {
      await resolveReviewQueueItems(prisma, {
        organizationId: baseline.organizationId,
        sourceId: source.id,
        reviewType: ReviewQueueType.PARSE_FAILURE,
        fingerprint: `${source.id}:low-yield`
      });
    }

    await resolveReviewQueueItems(prisma, {
      organizationId: baseline.organizationId,
      sourceId: source.id,
      reviewType: ReviewQueueType.SOURCE_FAILURE,
      fingerprint: `${source.id}:source-failure`
    });

    return {
      source: sourceDefinition,
      summary: {
        fetched: result.fetched.length,
        normalized: result.normalized.length,
        deduped: persisted.dedupedCount,
        reliabilityScore: result.reliabilityScore
      }
    };
  } catch (error) {
    await prisma.sourceSyncLog.create({
      data: {
        runId: run.id,
        level: "error",
        message: error instanceof Error ? error.message : "Unknown source sync failure."
      }
    });

    await prisma.sourceSyncRun.update({
      where: {
        id: run.id
      },
      data: {
        status: SourceSyncStatus.failed,
        finishedAt: new Date(),
        message: error instanceof Error ? error.message : "Unknown source sync failure."
      }
    });

    await prisma.source.update({
      where: {
        id: source.id
      },
      data: {
        syncStatus: SourceSyncStatus.failed
      }
    });

    await createSourceHealthCheck({
      organizationId: baseline.organizationId,
      sourceId: source.id,
      runId: run.id,
      status: SourceSyncStatus.failed,
      errorMessage: error instanceof Error ? error.message : "Unknown source sync failure.",
      notes: `Connector failure for ${sourceDefinition.name}.`
    });

    await upsertReviewQueueItem(prisma, {
      organizationId: baseline.organizationId,
      sourceId: source.id,
      reviewType: ReviewQueueType.SOURCE_FAILURE,
      title: "Review failed source connector",
      details: sourceDefinition.name,
      rationale: error instanceof Error ? error.message : "Unknown source sync failure.",
      sourceUrl: sourceDefinition.sourceUrl,
      fingerprint: `${source.id}:source-failure`,
      confidenceScore: 0,
      priority: 95
    });

    throw error;
  }
}

export async function persistManualImport(normalized: NormalizedPermitInput[]) {
  const baseline = await ensureBaselineMetadata();
  const manualSource = await prisma.source.upsert({
    where: {
      organizationId_slug: {
        organizationId: baseline.organizationId,
        slug: "manual-import"
      }
    },
    update: {
      active: false,
      sourceType: "manual import",
      parserType: "manual-xlsx",
      sourceUrl: "manual://import"
    },
    create: {
      organizationId: baseline.organizationId,
      name: "Manual Import",
      slug: "manual-import",
      county: null,
      city: null,
      sourceScope: "manual",
      countyRadiusEligible: false,
      countySelectorVisible: false,
      officialSourceType: "manual import fallback",
      sourceType: "manual import",
      parserType: "manual-xlsx",
      sourceUrl: "manual://import",
      active: false,
      authRequired: false,
      syncFrequency: "manual"
    }
  });

  const run = await prisma.sourceSyncRun.create({
    data: {
      sourceId: manualSource.id,
      status: SourceSyncStatus.running,
      message: "Starting manual import."
    }
  });

  try {
    const persisted = await persistNormalizedRecords({
      organizationId: baseline.organizationId,
      sourceDbId: manualSource.id,
      runId: run.id,
      normalized
    });
    if (persisted.builderIds.length) {
      await runBuilderEnrichment({
        organizationId: baseline.organizationId,
        builderIds: persisted.builderIds
      });
    }

    await prisma.sourceSyncRun.update({
      where: {
        id: run.id
      },
      data: {
        status: sourceRunStatusFromCount(normalized.length),
        fetchedCount: normalized.length,
        normalizedCount: normalized.length,
        dedupedCount: persisted.dedupedCount,
        finishedAt: new Date(),
        message: `Imported ${persisted.dedupedCount} record(s) from manual workbook. Removed ${persisted.duplicateOpportunitiesDeleted} duplicate opportunit${persisted.duplicateOpportunitiesDeleted === 1 ? "y" : "ies"}.`
      }
    });

    await prisma.source.update({
      where: {
        id: manualSource.id
      },
      data: {
        syncStatus: sourceRunStatusFromCount(normalized.length),
        lastSuccessfulSync: new Date(),
        sourceFreshnessScore: Math.min(100, 60 + Math.min(normalized.length, 20))
      }
    });

    return {
      sourceId: manualSource.id,
      imported: persisted.dedupedCount
    };
  } catch (error) {
    await prisma.sourceSyncRun.update({
      where: {
        id: run.id
      },
      data: {
        status: SourceSyncStatus.failed,
        finishedAt: new Date(),
        message: error instanceof Error ? error.message : "Unknown manual import failure."
      }
    });

    throw error;
  }
}

export async function runScheduledSync(sourceId: string) {
  await markStaleRunningSyncs();
  return executeConnectorSync(sourceId);
}

export async function runAllScheduledSyncs() {
  await markStaleRunningSyncs();

  const results: Array<
    | Awaited<ReturnType<typeof executeConnectorSync>>
    | {
        source: ReturnType<typeof getOfficialSourceDefinition> extends OfficialSourceDefinition | null ? OfficialSourceDefinition : never;
        summary: {
          fetched: number;
          normalized: number;
          deduped: number;
          reliabilityScore: number;
        };
        error: string;
      }
  > = [];

  for (const source of officialSourceDefinitions.filter((item) => item.active)) {
    try {
      results.push(await executeConnectorSync(source.id));
    } catch (error) {
      results.push({
        source,
        summary: {
          fetched: 0,
          normalized: 0,
          deduped: 0,
          reliabilityScore: 0
        },
        error: error instanceof Error ? error.message : "Unknown source sync failure."
      });
    }
  }

  await runBuilderEnrichment();

  return results;
}

export async function syncCatalogState() {
  await ensureBaselineMetadata();
  return prisma.source.findMany({
    where: {
      organization: {
        slug: DEFAULT_ORGANIZATION_SLUG
      }
    },
    select: {
      id: true,
      slug: true,
      name: true,
      active: true
    }
  });
}
