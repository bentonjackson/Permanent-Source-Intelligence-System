import { Prisma, ReviewQueueStatus, ReviewQueueType } from "@prisma/client";

import { prisma } from "@/lib/db/client";

type DbClient = Prisma.TransactionClient | typeof prisma;

function normalizeText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function openStatusFilter() {
  return {
    in: [ReviewQueueStatus.OPEN, ReviewQueueStatus.IN_PROGRESS]
  };
}

export async function upsertReviewQueueItem(
  db: DbClient,
  input: {
    organizationId: string;
    reviewType: ReviewQueueType;
    title: string;
    details?: string | null;
    rationale?: string | null;
    sourceId?: string | null;
    rawRecordId?: string | null;
    builderId?: string | null;
    opportunityId?: string | null;
    sourceUrl?: string | null;
    fingerprint?: string | null;
    priority?: number | null;
    confidenceScore?: number | null;
  }
) {
  const existing = await db.reviewQueueItem.findFirst({
    where: {
      organizationId: input.organizationId,
      reviewType: input.reviewType,
      status: openStatusFilter(),
      ...(input.fingerprint
        ? { fingerprint: input.fingerprint }
        : {
            sourceId: input.sourceId ?? null,
            rawRecordId: input.rawRecordId ?? null,
            builderId: input.builderId ?? null,
            opportunityId: input.opportunityId ?? null
          })
    }
  });

  if (existing) {
    return db.reviewQueueItem.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        details: normalizeText(input.details),
        rationale: normalizeText(input.rationale),
        sourceUrl: normalizeText(input.sourceUrl),
        priority: input.priority ?? existing.priority,
        confidenceScore: input.confidenceScore ?? existing.confidenceScore,
        lastSeenAt: new Date(),
        sourceId: input.sourceId ?? existing.sourceId,
        rawRecordId: input.rawRecordId ?? existing.rawRecordId,
        builderId: input.builderId ?? existing.builderId,
        opportunityId: input.opportunityId ?? existing.opportunityId
      }
    });
  }

  return db.reviewQueueItem.create({
    data: {
      organizationId: input.organizationId,
      reviewType: input.reviewType,
      status: ReviewQueueStatus.OPEN,
      title: input.title,
      details: normalizeText(input.details),
      rationale: normalizeText(input.rationale),
      sourceId: input.sourceId ?? null,
      rawRecordId: input.rawRecordId ?? null,
      builderId: input.builderId ?? null,
      opportunityId: input.opportunityId ?? null,
      sourceUrl: normalizeText(input.sourceUrl),
      fingerprint: normalizeText(input.fingerprint),
      priority: input.priority ?? 50,
      confidenceScore: input.confidenceScore ?? 0
    }
  });
}

export async function resolveReviewQueueItems(
  db: DbClient,
  input: {
    organizationId: string;
    reviewType: ReviewQueueType;
    sourceId?: string | null;
    rawRecordId?: string | null;
    builderId?: string | null;
    opportunityId?: string | null;
    fingerprint?: string | null;
  }
) {
  return db.reviewQueueItem.updateMany({
    where: {
      organizationId: input.organizationId,
      reviewType: input.reviewType,
      status: openStatusFilter(),
      ...(input.fingerprint
        ? { fingerprint: input.fingerprint }
        : {
            ...(input.sourceId ? { sourceId: input.sourceId } : {}),
            ...(input.rawRecordId ? { rawRecordId: input.rawRecordId } : {}),
            ...(input.builderId ? { builderId: input.builderId } : {}),
            ...(input.opportunityId ? { opportunityId: input.opportunityId } : {})
          })
    },
    data: {
      status: ReviewQueueStatus.RESOLVED,
      resolvedAt: new Date(),
      lastSeenAt: new Date()
    }
  });
}
