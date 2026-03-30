import {
  BidStatus,
  ContactResolutionStatus,
  PipelineStage,
  Prisma
} from "@prisma/client";

import { getDefaultOrganizationId } from "@/lib/app/defaults";
import { prisma } from "@/lib/db/client";
import { getOpportunityById, getOpportunityData } from "@/lib/opportunities/live-data";
import {
  deriveContactResolutionStatus,
  recordOpportunityStageHistory,
  upsertOpportunityContactSnapshot
} from "@/lib/opportunities/workflow-artifacts";
import {
  ActivityDirection,
  ActivityType,
  OpportunityInterestStatus,
  OpportunityOutcomeStatus,
  PipelineStage as DomainPipelineStage,
  PlotOpportunity,
  PreferredContactMethod
} from "@/types/domain";

type Tx = Prisma.TransactionClient;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNullableDate(value: unknown) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function splitFullName(value: string | null) {
  if (!value) {
    return {
      firstName: null,
      lastName: null
    };
  }

  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    return {
      firstName: parts[0] ?? null,
      lastName: null
    };
  }

  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(" ") || null
  };
}

function stageFromBidStatus(value: BidStatus): PipelineStage {
  if (value === BidStatus.CONTACTED) return PipelineStage.CONTACTED;
  if (value === BidStatus.BID_REQUESTED || value === BidStatus.QUOTED) return PipelineStage.QUOTED;
  if (value === BidStatus.WON) return PipelineStage.WON;
  if (value === BidStatus.LOST) return PipelineStage.LOST;
  if (value === BidStatus.NOT_A_FIT) return PipelineStage.NOT_A_FIT;
  if (value === BidStatus.READY_TO_CONTACT) return PipelineStage.READY_TO_BID;
  if (value === BidStatus.RESEARCHING_BUILDER) return PipelineStage.RESEARCH_BUILDER;
  return PipelineStage.NEW;
}

function bidStatusFromStage(value: PipelineStage): BidStatus {
  if (value === PipelineStage.CONTACTED) return BidStatus.CONTACTED;
  if (value === PipelineStage.QUOTED) return BidStatus.QUOTED;
  if (value === PipelineStage.WON) return BidStatus.WON;
  if (value === PipelineStage.LOST) return BidStatus.LOST;
  if (value === PipelineStage.NOT_A_FIT) return BidStatus.NOT_A_FIT;
  if (value === PipelineStage.READY_TO_BID) return BidStatus.READY_TO_CONTACT;
  if (value === PipelineStage.RESEARCH_BUILDER) return BidStatus.RESEARCHING_BUILDER;
  return BidStatus.NOT_REVIEWED;
}

function toPrismaStage(value: DomainPipelineStage | null | undefined) {
  if (value === "Contacted") return PipelineStage.CONTACTED;
  if (value === "Quoted") return PipelineStage.QUOTED;
  if (value === "Won") return PipelineStage.WON;
  if (value === "Lost") return PipelineStage.LOST;
  if (value === "Not a Fit") return PipelineStage.NOT_A_FIT;
  if (value === "Ready to Bid") return PipelineStage.READY_TO_BID;
  if (value === "Research Builder") return PipelineStage.RESEARCH_BUILDER;
  return PipelineStage.NEW;
}

function nextActionForStatus(input: {
  bidStatus: BidStatus;
  hasPrimaryPhone: boolean;
  followUpNeeded: boolean;
}) {
  if (input.bidStatus === BidStatus.WON || input.bidStatus === BidStatus.LOST || input.bidStatus === BidStatus.NOT_A_FIT) {
    return "No further action needed.";
  }

  if (input.followUpNeeded) {
    return "Complete the next follow-up and log the response.";
  }

  if (input.hasPrimaryPhone) {
    return "Call the primary contact and log the result.";
  }

  return "Research phone / website";
}

function isClosedBidStatus(value: BidStatus) {
  return value === BidStatus.WON || value === BidStatus.LOST || value === BidStatus.NOT_A_FIT;
}

function isClosedPipelineStage(value: PipelineStage) {
  return value === PipelineStage.WON || value === PipelineStage.LOST || value === PipelineStage.NOT_A_FIT;
}

const contactResolutionStatusMap: Record<
  ReturnType<typeof deriveContactResolutionStatus>,
  ContactResolutionStatus
> = {
  resolved: ContactResolutionStatus.RESOLVED,
  builder_only: ContactResolutionStatus.BUILDER_ONLY,
  weak_entity: ContactResolutionStatus.WEAK_ENTITY,
  unknown: ContactResolutionStatus.UNKNOWN
};

async function fetchOpportunityContext(tx: Tx, opportunityId: string, organizationId: string) {
  const opportunity = await tx.plotOpportunity.findFirst({
    where: {
      id: opportunityId,
      organizationId
    },
    include: {
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
        orderBy: {
          occurredAt: "desc"
        }
      },
      assignedMembership: true
    }
  });

  if (!opportunity) {
    throw new Error("Opportunity not found.");
  }

  return opportunity;
}

async function createActivityRow(
  tx: Tx,
  input: {
    organizationId: string;
    opportunityId: string;
    propertyId: string | null;
    assignedMembershipId: string | null;
    contactId?: string | null;
    activityType: ActivityType;
    activityDirection: ActivityDirection;
    occurredAt?: Date | null;
    outcome?: string | null;
    note?: string | null;
  }
) {
  return tx.activity.create({
    data: {
      organizationId: input.organizationId,
      opportunityId: input.opportunityId,
      propertyId: input.propertyId,
      contactId: input.contactId ?? null,
      leadId: null,
      type: input.activityType,
      direction: input.activityDirection,
      occurredAt: input.occurredAt ?? new Date(),
      outcome: input.outcome ?? null,
      note: input.note ?? null,
      description: input.note ?? input.activityType.replaceAll("_", " "),
      createdByMembershipId: input.assignedMembershipId ?? null
    }
  });
}

async function refreshOpportunityWorkflowRollup(tx: Tx, opportunityId: string, organizationId: string) {
  const opportunity = await fetchOpportunityContext(tx, opportunityId, organizationId);
  const primaryContact = opportunity.contacts.find((contact) => contact.isPrimary) ?? opportunity.contacts[0] ?? null;
  const outreachActivities = opportunity.activities.filter((activity) =>
    [
      "called",
      "left_voicemail",
      "sent_email",
      "received_email",
      "texted",
      "met",
      "quote_discussed"
    ].includes(activity.type)
  );
  const lastContactedAt =
    outreachActivities.sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())[0]?.occurredAt ??
    opportunity.lastContactedAt ??
    opportunity.contactedAt ??
    opportunity.inquiredAt ??
    null;
  const latestActivity = opportunity.activities[0] ?? null;
  const notesSummary =
    opportunity.internalNotes ??
    latestActivity?.note ??
    opportunity.notesSummary ??
    null;
  const contactSummary = primaryContact
    ? [primaryContact.fullName, primaryContact.roleTitle, primaryContact.phone ?? primaryContact.email]
        .filter(Boolean)
        .join(" • ")
    : opportunity.contactSummary ?? null;
  const outreachCount = outreachActivities.length;
  const callCount = opportunity.activities.filter((activity) =>
    ["called", "left_voicemail"].includes(activity.type)
  ).length;
  const emailCount = opportunity.activities.filter((activity) =>
    ["sent_email", "received_email"].includes(activity.type)
  ).length;
  const textCount = opportunity.activities.filter((activity) => activity.type === "texted").length;
  const nextAction = nextActionForStatus({
    bidStatus: opportunity.bidStatus,
    hasPrimaryPhone: Boolean(primaryContact?.phone || primaryContact?.mobilePhone || primaryContact?.officePhone),
    followUpNeeded: opportunity.followUpNeeded || opportunity.needsFollowUp
  });
  const resolutionStatusKey = deriveContactResolutionStatus({
    roleType: opportunity.roleType.toLowerCase(),
    preferredSalesName: opportunity.preferredSalesName ?? opportunity.legalEntityName ?? opportunity.builderName,
    entityConfidenceScore: opportunity.entityConfidenceScore,
    primaryPhone: primaryContact?.phone ?? primaryContact?.mobilePhone ?? primaryContact?.officePhone ?? null,
    primaryEmail: primaryContact?.email ?? null,
    primaryWebsite: primaryContact?.website ?? null
  });
  const resolutionNotes = primaryContact
    ? "Primary contact stored on the opportunity."
    : opportunity.preferredSalesName
      ? "Builder identity is resolved. Add a direct phone or email to improve outreach quality."
      : "Weak or unknown builder identity. Research the builder or contractor before calling.";

  await tx.plotOpportunity.update({
    where: {
      id: opportunityId
    },
    data: {
      contactSummary,
      notesSummary,
      outreachCount,
      callCount,
      emailCount,
      textCount,
      lastContactedAt,
      nextAction,
      notes:
        opportunity.internalNotes != null
          ? opportunity.internalNotes
              .split("\n")
              .map((entry) => entry.trim())
              .filter(Boolean)
          : opportunity.notes ?? Prisma.JsonNull,
      contactResolutionStatus: contactResolutionStatusMap[resolutionStatusKey],
      lastContactResolutionRunAt: new Date(),
      contactStatus:
        latestActivity?.outcome ??
        opportunity.contactStatus ??
        (primaryContact ? "Primary contact stored" : "Needs contact research")
    }
  });

  await upsertOpportunityContactSnapshot(tx, {
    organizationId,
    opportunityId,
    primaryEntityId: opportunity.builderId ?? null,
    primaryEntityName: opportunity.preferredSalesName ?? opportunity.legalEntityName ?? opportunity.builderName ?? null,
    primaryContactId: primaryContact?.id ?? null,
    primaryContactName: primaryContact?.fullName ?? null,
    primaryPhone: primaryContact?.phone ?? primaryContact?.mobilePhone ?? primaryContact?.officePhone ?? null,
    primaryEmail: primaryContact?.email ?? null,
    primaryWebsite: primaryContact?.website ?? null,
    contactQualityTier: opportunity.contactQualityTier,
    contactQualityBand: opportunity.contactQualityBand,
    contactQualityScore: opportunity.contactQualityScore,
    entityConfidenceScore: opportunity.entityConfidenceScore,
    nextBestAction: nextAction,
    contactResolutionStatus: contactResolutionStatusMap[resolutionStatusKey],
    resolutionNotes,
    lastContactResolutionRunAt: new Date()
  });
}

export async function moveOpportunityToContacted(opportunityId: string, input?: { assignedMembershipId?: string | null }) {
  const organizationId = await getDefaultOrganizationId();

  await prisma.$transaction(async (tx) => {
    const opportunity = await fetchOpportunityContext(tx, opportunityId, organizationId);
    const now = new Date();
    const defaultFollowUp = opportunity.nextFollowUpAt ?? opportunity.nextFollowUpDate ?? addDays(now, 2);
    const alreadyContacted = opportunity.bidStatus === BidStatus.CONTACTED && opportunity.currentStage === PipelineStage.CONTACTED;

    await tx.plotOpportunity.update({
      where: {
        id: opportunityId
      },
      data: {
        assignedMembershipId:
          input?.assignedMembershipId !== undefined ? input.assignedMembershipId || null : opportunity.assignedMembershipId,
        bidStatus: isClosedBidStatus(opportunity.bidStatus) ? opportunity.bidStatus : BidStatus.CONTACTED,
        currentStage:
          isClosedPipelineStage(opportunity.currentStage) ? opportunity.currentStage : PipelineStage.CONTACTED,
        contactedAt: opportunity.contactedAt ?? opportunity.inquiredAt ?? now,
        inquiredAt: opportunity.inquiredAt ?? now,
        lastContactedAt: now,
        nextFollowUpAt: opportunity.nextFollowUpAt ?? defaultFollowUp,
        nextFollowUpDate: opportunity.nextFollowUpDate ?? defaultFollowUp,
        suggestedFollowUpDate: opportunity.suggestedFollowUpDate ?? defaultFollowUp,
        followUpNeeded: true,
        needsFollowUp: true,
        interestStatus: opportunity.interestStatus ?? "unknown",
        outcomeStatus:
          opportunity.outcomeStatus ??
          (opportunity.bidStatus === BidStatus.WON
            ? "won"
            : opportunity.bidStatus === BidStatus.LOST
              ? "lost"
              : opportunity.bidStatus === BidStatus.NOT_A_FIT
                ? "not_a_fit"
                : "open"),
        contactStatus: opportunity.contactStatus ?? "Moved into Contacted",
        nextAction: opportunity.nextAction ?? "Log outreach and schedule the next follow-up."
      }
    });

    if (!alreadyContacted) {
      await createActivityRow(tx, {
        organizationId,
        opportunityId,
        propertyId: opportunity.propertyId ?? null,
        assignedMembershipId: opportunity.assignedMembershipId ?? input?.assignedMembershipId ?? null,
        activityType: "status_changed",
        activityDirection: "internal",
        occurredAt: now,
        outcome: "Contacted",
        note: "Moved to Contacted from Plot Queue."
      });

      await recordOpportunityStageHistory(tx, {
        organizationId,
        opportunityId,
        fromStage: opportunity.currentStage,
        toStage: PipelineStage.CONTACTED,
        fromBidStatus: opportunity.bidStatus,
        toBidStatus: BidStatus.CONTACTED,
        note: "Moved to Contacted from Plot Queue.",
        sourceLabel: "contacted-workflow",
        changedByMembershipId: input?.assignedMembershipId ?? opportunity.assignedMembershipId ?? null
      });
    }

    await refreshOpportunityWorkflowRollup(tx, opportunityId, organizationId);
  });

  return getOpportunityById(opportunityId);
}

export async function updateOpportunityWorkflow(
  opportunityId: string,
  input: {
    assignedMembershipId?: string | null;
    currentStage?: DomainPipelineStage | null;
    bidStatus?: PlotOpportunity["bidStatus"] | null;
    contactedAt?: string | null;
    lastContactedAt?: string | null;
    nextFollowUpAt?: string | null;
    followUpNeeded?: boolean;
    interestStatus?: OpportunityInterestStatus | null;
    outcomeStatus?: OpportunityOutcomeStatus | null;
    contactSummary?: string | null;
    notesSummary?: string | null;
    reasonLost?: string | null;
    internalNotes?: string | null;
    externalSummary?: string | null;
    quoteRequestedAt?: string | null;
    quoteSentAt?: string | null;
    nextAction?: string | null;
    nextFollowUpDate?: string | null;
    contactStatus?: string | null;
    inquiredAt?: string | null;
    needsFollowUp?: boolean;
    suggestedFollowUpDate?: string | null;
    secondFollowUpDate?: string | null;
    followedUpOn?: string | null;
    closedAt?: string | null;
  }
) {
  const organizationId = await getDefaultOrganizationId();

  await prisma.$transaction(async (tx) => {
    const opportunity = await fetchOpportunityContext(tx, opportunityId, organizationId);
    const nextBidStatus =
      input.bidStatus != null
        ? (input.bidStatus.toUpperCase() as BidStatus)
        : input.currentStage
          ? bidStatusFromStage(toPrismaStage(input.currentStage))
          : opportunity.bidStatus;
    const nextStage =
      input.currentStage != null
        ? toPrismaStage(input.currentStage)
        : input.bidStatus != null
          ? stageFromBidStatus(nextBidStatus)
          : opportunity.currentStage;
    const nextOutcomeStatus =
      input.outcomeStatus ??
      (nextBidStatus === BidStatus.WON
        ? "won"
        : nextBidStatus === BidStatus.LOST
          ? "lost"
          : nextBidStatus === BidStatus.NOT_A_FIT
            ? "not_a_fit"
            : opportunity.outcomeStatus ??
              "open");

    await tx.plotOpportunity.update({
      where: {
        id: opportunityId
      },
      data: {
        assignedMembershipId:
          input.assignedMembershipId !== undefined ? input.assignedMembershipId || null : undefined,
        bidStatus: nextBidStatus,
        currentStage: nextStage,
        contactedAt: input.contactedAt !== undefined ? toNullableDate(input.contactedAt) : undefined,
        lastContactedAt: input.lastContactedAt !== undefined ? toNullableDate(input.lastContactedAt) : undefined,
        nextFollowUpAt: input.nextFollowUpAt !== undefined ? toNullableDate(input.nextFollowUpAt) : undefined,
        followUpNeeded:
          input.followUpNeeded !== undefined
            ? input.followUpNeeded
            : input.needsFollowUp !== undefined
              ? input.needsFollowUp
              : undefined,
        interestStatus: input.interestStatus !== undefined ? input.interestStatus ?? "unknown" : undefined,
        outcomeStatus: nextOutcomeStatus,
        contactSummary: input.contactSummary !== undefined ? toNullableString(input.contactSummary) : undefined,
        notesSummary: input.notesSummary !== undefined ? toNullableString(input.notesSummary) : undefined,
        reasonLost: input.reasonLost !== undefined ? toNullableString(input.reasonLost) : undefined,
        internalNotes: input.internalNotes !== undefined ? toNullableString(input.internalNotes) : undefined,
        externalSummary: input.externalSummary !== undefined ? toNullableString(input.externalSummary) : undefined,
        quoteRequestedAt:
          input.quoteRequestedAt !== undefined ? toNullableDate(input.quoteRequestedAt) : undefined,
        quoteSentAt: input.quoteSentAt !== undefined ? toNullableDate(input.quoteSentAt) : undefined,
        nextAction: input.nextAction !== undefined ? toNullableString(input.nextAction) : undefined,
        nextFollowUpDate:
          input.nextFollowUpDate !== undefined ? toNullableDate(input.nextFollowUpDate) : undefined,
        contactStatus: input.contactStatus !== undefined ? toNullableString(input.contactStatus) : undefined,
        inquiredAt: input.inquiredAt !== undefined ? toNullableDate(input.inquiredAt) : undefined,
        needsFollowUp:
          input.needsFollowUp !== undefined
            ? input.needsFollowUp
            : input.followUpNeeded !== undefined
              ? input.followUpNeeded
              : undefined,
        suggestedFollowUpDate:
          input.suggestedFollowUpDate !== undefined ? toNullableDate(input.suggestedFollowUpDate) : undefined,
        secondFollowUpDate:
          input.secondFollowUpDate !== undefined ? toNullableDate(input.secondFollowUpDate) : undefined,
        followedUpOn:
          input.followedUpOn !== undefined ? toNullableDate(input.followedUpOn) : undefined,
        closedAt: input.closedAt !== undefined ? toNullableDate(input.closedAt) : undefined
      }
    });

    if (nextBidStatus !== opportunity.bidStatus || nextStage !== opportunity.currentStage) {
      await createActivityRow(tx, {
        organizationId,
        opportunityId,
        propertyId: opportunity.propertyId ?? null,
        assignedMembershipId: input.assignedMembershipId ?? opportunity.assignedMembershipId ?? null,
        activityType: "status_changed",
        activityDirection: "internal",
        outcome: input.interestStatus ?? nextOutcomeStatus,
        note: `Status updated to ${nextStage.replaceAll("_", " ").toLowerCase()}.`
      });

      await recordOpportunityStageHistory(tx, {
        organizationId,
        opportunityId,
        fromStage: opportunity.currentStage,
        toStage: nextStage,
        fromBidStatus: opportunity.bidStatus,
        toBidStatus: nextBidStatus,
        note: `Status updated to ${nextStage.replaceAll("_", " ").toLowerCase()}.`,
        sourceLabel: "contacted-workflow",
        changedByMembershipId:
          input.assignedMembershipId !== undefined
            ? input.assignedMembershipId ?? null
            : opportunity.assignedMembershipId ?? null
      });
    }

    await refreshOpportunityWorkflowRollup(tx, opportunityId, organizationId);
  });

  return getOpportunityById(opportunityId);
}

export async function createOpportunityContact(
  opportunityId: string,
  input: {
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    roleTitle?: string | null;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    mobilePhone?: string | null;
    officePhone?: string | null;
    website?: string | null;
    linkedinUrl?: string | null;
    preferredContactMethod?: PreferredContactMethod | null;
    bestTimeToContact?: string | null;
    notes?: string | null;
    sourceLabel?: string | null;
    sourceUrl?: string | null;
    confidenceScore?: number | null;
    isPrimary?: boolean;
  }
) {
  const organizationId = await getDefaultOrganizationId();

  await prisma.$transaction(async (tx) => {
    const opportunity = await fetchOpportunityContext(tx, opportunityId, organizationId);
    const fullName = toNullableString(input.fullName) ?? null;
    const names = splitFullName(fullName);
    const firstName = toNullableString(input.firstName) ?? names.firstName;
    const lastName = toNullableString(input.lastName) ?? names.lastName;
    const shouldBePrimary = input.isPrimary ?? opportunity.contacts.length === 0;

    if (shouldBePrimary) {
      await tx.contact.updateMany({
        where: {
          opportunityId
        },
        data: {
          isPrimary: false
        }
      });
    }

    await tx.contact.create({
      data: {
        organizationId,
        builderId: opportunity.builderId,
        companyId: null,
        opportunityId,
        fullName,
        firstName,
        lastName,
        roleTitle: toNullableString(input.roleTitle),
        companyName: toNullableString(input.companyName) ?? opportunity.legalEntityName ?? opportunity.builderName,
        email: toNullableString(input.email),
        phone: toNullableString(input.phone),
        mobilePhone: toNullableString(input.mobilePhone),
        officePhone: toNullableString(input.officePhone),
        publicProfileUrl: null,
        website: toNullableString(input.website),
        linkedinUrl: toNullableString(input.linkedinUrl),
        preferredContactMethod: input.preferredContactMethod ?? null,
        bestTimeToContact: toNullableString(input.bestTimeToContact),
        notes: toNullableString(input.notes),
        mailingAddress: opportunity.mailingAddress,
        cityState: opportunity.cityState,
        sourceLabel: toNullableString(input.sourceLabel) ?? opportunity.sourceName,
        sourceUrl: toNullableString(input.sourceUrl) ?? opportunity.sourceUrl,
        confidenceScore: input.confidenceScore ?? 60,
        qualityScore: input.confidenceScore ?? 60,
        qualityBand:
          input.confidenceScore && input.confidenceScore >= 85
            ? "TIER_1"
            : input.confidenceScore && input.confidenceScore >= 65
              ? "TIER_2"
              : input.confidenceScore && input.confidenceScore >= 45
                ? "TIER_3"
                : "TIER_4",
        isPrimary: shouldBePrimary
      }
    });

    await refreshOpportunityWorkflowRollup(tx, opportunityId, organizationId);
  });

  return getOpportunityById(opportunityId);
}

export async function updateOpportunityContact(
  contactId: string,
  input: {
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    roleTitle?: string | null;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    mobilePhone?: string | null;
    officePhone?: string | null;
    website?: string | null;
    linkedinUrl?: string | null;
    preferredContactMethod?: PreferredContactMethod | null;
    bestTimeToContact?: string | null;
    notes?: string | null;
    sourceLabel?: string | null;
    sourceUrl?: string | null;
    confidenceScore?: number | null;
    isPrimary?: boolean;
  }
) {
  const organizationId = await getDefaultOrganizationId();

  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      organizationId
    },
    select: {
      id: true,
      opportunityId: true
    }
  });

  if (!contact?.opportunityId) {
    throw new Error("Contact not found.");
  }

  const opportunityId = contact.opportunityId;

  await prisma.$transaction(async (tx) => {
    const fullName = toNullableString(input.fullName) ?? null;
    const names = splitFullName(fullName);

    if (input.isPrimary) {
      await tx.contact.updateMany({
        where: {
          opportunityId: contact.opportunityId
        },
        data: {
          isPrimary: false
        }
      });
    }

    await tx.contact.update({
      where: {
        id: contactId
      },
      data: {
        fullName,
        firstName: toNullableString(input.firstName) ?? names.firstName,
        lastName: toNullableString(input.lastName) ?? names.lastName,
        roleTitle: input.roleTitle !== undefined ? toNullableString(input.roleTitle) : undefined,
        companyName: input.companyName !== undefined ? toNullableString(input.companyName) : undefined,
        email: input.email !== undefined ? toNullableString(input.email) : undefined,
        phone: input.phone !== undefined ? toNullableString(input.phone) : undefined,
        mobilePhone: input.mobilePhone !== undefined ? toNullableString(input.mobilePhone) : undefined,
        officePhone: input.officePhone !== undefined ? toNullableString(input.officePhone) : undefined,
        website: input.website !== undefined ? toNullableString(input.website) : undefined,
        linkedinUrl: input.linkedinUrl !== undefined ? toNullableString(input.linkedinUrl) : undefined,
        preferredContactMethod:
          input.preferredContactMethod !== undefined ? input.preferredContactMethod : undefined,
        bestTimeToContact:
          input.bestTimeToContact !== undefined ? toNullableString(input.bestTimeToContact) : undefined,
        notes: input.notes !== undefined ? toNullableString(input.notes) : undefined,
        sourceLabel: input.sourceLabel !== undefined ? toNullableString(input.sourceLabel) : undefined,
        sourceUrl: input.sourceUrl !== undefined ? toNullableString(input.sourceUrl) : undefined,
        confidenceScore: input.confidenceScore !== undefined && input.confidenceScore !== null ? input.confidenceScore : undefined,
        qualityScore: input.confidenceScore !== undefined && input.confidenceScore !== null ? input.confidenceScore : undefined,
        isPrimary: input.isPrimary !== undefined ? input.isPrimary : undefined
      }
    });

    await refreshOpportunityWorkflowRollup(tx, opportunityId, organizationId);
  });

  return getOpportunityById(opportunityId);
}

export async function deleteOpportunityContact(contactId: string) {
  const organizationId = await getDefaultOrganizationId();

  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      organizationId
    },
    select: {
      id: true,
      opportunityId: true,
      isPrimary: true
    }
  });

  if (!contact?.opportunityId) {
    throw new Error("Contact not found.");
  }

  const opportunityId = contact.opportunityId;

  await prisma.$transaction(async (tx) => {
    await tx.contact.delete({
      where: {
        id: contactId
      }
    });

    if (contact.isPrimary) {
      const fallback = await tx.contact.findFirst({
        where: {
          opportunityId
        },
        orderBy: {
          updatedAt: "desc"
        }
      });

      if (fallback) {
        await tx.contact.update({
          where: {
            id: fallback.id
          },
          data: {
            isPrimary: true
          }
        });
      }
    }

    await refreshOpportunityWorkflowRollup(tx, opportunityId, organizationId);
  });

  return getOpportunityById(opportunityId);
}

export async function logOpportunityActivity(
  opportunityId: string,
  input: {
    contactId?: string | null;
    activityType: ActivityType;
    activityDirection?: ActivityDirection | null;
    occurredAt?: string | null;
    outcome?: string | null;
    note?: string | null;
    nextFollowUpAt?: string | null;
    interestStatus?: OpportunityInterestStatus | null;
    outcomeStatus?: OpportunityOutcomeStatus | null;
  }
) {
  const organizationId = await getDefaultOrganizationId();

  await prisma.$transaction(async (tx) => {
    const opportunity = await fetchOpportunityContext(tx, opportunityId, organizationId);
    const occurredAt = toNullableDate(input.occurredAt) ?? new Date();
    const direction =
      input.activityDirection ??
      (["received_email"].includes(input.activityType) ? "inbound" : input.activityType === "note_added" || input.activityType === "status_changed"
        ? "internal"
        : "outbound");

    await createActivityRow(tx, {
      organizationId,
      opportunityId,
      propertyId: opportunity.propertyId ?? null,
      assignedMembershipId: opportunity.assignedMembershipId ?? null,
      contactId: input.contactId ?? null,
      activityType: input.activityType,
      activityDirection: direction,
      occurredAt,
      outcome: toNullableString(input.outcome),
      note: toNullableString(input.note)
    });

    await tx.plotOpportunity.update({
      where: {
        id: opportunityId
      },
      data: {
        lastContactedAt:
          ["internal"].includes(direction) && input.activityType !== "quote_discussed"
            ? opportunity.lastContactedAt
            : occurredAt,
        followedUpOn:
          input.activityType === "follow_up_scheduled" ? occurredAt : opportunity.followedUpOn,
        nextFollowUpAt:
          input.nextFollowUpAt !== undefined ? toNullableDate(input.nextFollowUpAt) : undefined,
        nextFollowUpDate:
          input.nextFollowUpAt !== undefined ? toNullableDate(input.nextFollowUpAt) : undefined,
        suggestedFollowUpDate:
          input.nextFollowUpAt !== undefined ? toNullableDate(input.nextFollowUpAt) : undefined,
        followUpNeeded:
          input.nextFollowUpAt !== undefined ? Boolean(toNullableDate(input.nextFollowUpAt)) : undefined,
        needsFollowUp:
          input.nextFollowUpAt !== undefined ? Boolean(toNullableDate(input.nextFollowUpAt)) : undefined,
        interestStatus: input.interestStatus !== undefined ? input.interestStatus ?? "unknown" : undefined,
        outcomeStatus: input.outcomeStatus !== undefined ? input.outcomeStatus ?? "open" : undefined,
        quoteRequestedAt:
          input.activityType === "quote_discussed" && input.outcome === "Quote requested"
            ? occurredAt
            : opportunity.quoteRequestedAt,
        quoteSentAt:
          input.activityType === "quote_discussed" && input.outcome === "Quote sent"
            ? occurredAt
            : opportunity.quoteSentAt
      }
    });

    await refreshOpportunityWorkflowRollup(tx, opportunityId, organizationId);
  });

  return getOpportunityById(opportunityId);
}

export async function getContactedOpportunities(query: {
  county?: string | null;
  city?: string | null;
  jurisdiction?: string | null;
  territory?: string | null;
}) {
  return getOpportunityData({
    ...query,
    status: "contacted"
  });
}
