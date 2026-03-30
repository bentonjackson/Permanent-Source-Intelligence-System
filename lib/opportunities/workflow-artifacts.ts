import {
  BidStatus,
  ContactQualityBand,
  ContactQualityTier,
  ContactResolutionStatus,
  PipelineStage,
  Prisma
} from "@prisma/client";

import { prisma } from "@/lib/db/client";

type DbClient = Prisma.TransactionClient | typeof prisma;

const contactResolutionStatusToPrisma: Record<
  "resolved" | "builder_only" | "weak_entity" | "unknown",
  ContactResolutionStatus
> = {
  resolved: ContactResolutionStatus.RESOLVED,
  builder_only: ContactResolutionStatus.BUILDER_ONLY,
  weak_entity: ContactResolutionStatus.WEAK_ENTITY,
  unknown: ContactResolutionStatus.UNKNOWN
};

function normalizeText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function deriveContactResolutionStatus(input: {
  roleType?: string | null;
  preferredSalesName?: string | null;
  entityConfidenceScore?: number | null;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  primaryWebsite?: string | null;
}) {
  const roleType = (input.roleType ?? "unknown").toLowerCase();
  const confidence = input.entityConfidenceScore ?? 0;
  const hasContactChannel = Boolean(input.primaryPhone || input.primaryEmail || input.primaryWebsite);

  if (
    input.preferredSalesName &&
    confidence >= 64 &&
    ["builder", "general_contractor", "developer"].includes(roleType)
  ) {
    return hasContactChannel ? ("resolved" as const) : ("builder_only" as const);
  }

  if (input.preferredSalesName && confidence >= 52) {
    return "builder_only" as const;
  }

  if (["owner", "holding_company", "person"].includes(roleType)) {
    return "weak_entity" as const;
  }

  return "unknown" as const;
}

export async function recordOpportunityStageHistory(
  db: DbClient,
  input: {
    organizationId: string;
    opportunityId: string;
    fromStage: PipelineStage | null;
    toStage: PipelineStage;
    fromBidStatus: BidStatus | null;
    toBidStatus: BidStatus;
    note?: string | null;
    sourceLabel?: string | null;
    changedByMembershipId?: string | null;
  }
) {
  if (input.fromStage === input.toStage && input.fromBidStatus === input.toBidStatus) {
    return null;
  }

  return db.opportunityStageHistory.create({
    data: {
      organizationId: input.organizationId,
      opportunityId: input.opportunityId,
      fromStage: input.fromStage ?? null,
      toStage: input.toStage,
      fromBidStatus: input.fromBidStatus ?? null,
      toBidStatus: input.toBidStatus,
      note: normalizeText(input.note),
      sourceLabel: normalizeText(input.sourceLabel),
      changedByMembershipId: input.changedByMembershipId ?? null
    }
  });
}

export async function upsertOpportunityContactSnapshot(
  db: DbClient,
  input: {
    organizationId: string;
    opportunityId: string;
    primaryEntityId?: string | null;
    primaryEntityName?: string | null;
    primaryContactId?: string | null;
    primaryContactName?: string | null;
    primaryPhone?: string | null;
    primaryEmail?: string | null;
    primaryWebsite?: string | null;
    contactQualityTier?: ContactQualityTier | null;
    contactQualityBand?: ContactQualityBand | null;
    contactQualityScore?: number | null;
    entityConfidenceScore?: number | null;
    nextBestAction?: string | null;
    contactResolutionStatus?: ContactResolutionStatus | null;
    resolutionNotes?: string | null;
    lastContactResolutionRunAt?: Date | null;
  }
) {
  const status =
    input.contactResolutionStatus ??
    contactResolutionStatusToPrisma[
      deriveContactResolutionStatus({
        preferredSalesName: input.primaryEntityName,
        entityConfidenceScore: input.entityConfidenceScore,
        primaryPhone: input.primaryPhone,
        primaryEmail: input.primaryEmail,
        primaryWebsite: input.primaryWebsite
      })
    ];

  return db.opportunityContactSnapshot.upsert({
    where: {
      opportunityId: input.opportunityId
    },
    update: {
      primaryEntityId: input.primaryEntityId ?? null,
      primaryEntityName: normalizeText(input.primaryEntityName),
      primaryContactId: input.primaryContactId ?? null,
      primaryContactName: normalizeText(input.primaryContactName),
      primaryPhone: normalizeText(input.primaryPhone),
      primaryEmail: normalizeText(input.primaryEmail),
      primaryWebsite: normalizeText(input.primaryWebsite),
      contactQualityTier: input.contactQualityTier ?? ContactQualityTier.RESEARCH_REQUIRED,
      contactQualityBand: input.contactQualityBand ?? ContactQualityBand.TIER_5,
      contactQualityScore: input.contactQualityScore ?? 0,
      entityConfidenceScore: input.entityConfidenceScore ?? 0,
      nextBestAction: normalizeText(input.nextBestAction),
      contactResolutionStatus: status,
      resolutionNotes: normalizeText(input.resolutionNotes),
      lastContactResolutionRunAt: input.lastContactResolutionRunAt ?? new Date()
    },
    create: {
      organizationId: input.organizationId,
      opportunityId: input.opportunityId,
      primaryEntityId: input.primaryEntityId ?? null,
      primaryEntityName: normalizeText(input.primaryEntityName),
      primaryContactId: input.primaryContactId ?? null,
      primaryContactName: normalizeText(input.primaryContactName),
      primaryPhone: normalizeText(input.primaryPhone),
      primaryEmail: normalizeText(input.primaryEmail),
      primaryWebsite: normalizeText(input.primaryWebsite),
      contactQualityTier: input.contactQualityTier ?? ContactQualityTier.RESEARCH_REQUIRED,
      contactQualityBand: input.contactQualityBand ?? ContactQualityBand.TIER_5,
      contactQualityScore: input.contactQualityScore ?? 0,
      entityConfidenceScore: input.entityConfidenceScore ?? 0,
      nextBestAction: normalizeText(input.nextBestAction),
      contactResolutionStatus: status,
      resolutionNotes: normalizeText(input.resolutionNotes),
      lastContactResolutionRunAt: input.lastContactResolutionRunAt ?? new Date()
    }
  });
}
