import { NextRequest, NextResponse } from "next/server";

import { getDefaultOrganizationId } from "@/lib/app/defaults";
import { prisma } from "@/lib/db/client";
import { getOpportunityById } from "@/lib/opportunities/live-data";
import { updateOpportunityWorkflow } from "@/lib/opportunities/contacted-workflow";
import { opportunityToPersistenceData } from "@/lib/opportunities/persistence";
import { PlotOpportunity } from "@/types/domain";

function toNullableDate(value: unknown) {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { opportunityId: string } }
) {
  const body = await request.json();

  try {
    if (body.opportunity) {
      const organizationId = await getDefaultOrganizationId();
      const opportunity = body.opportunity as PlotOpportunity;
      const createData = opportunityToPersistenceData(opportunity, organizationId);
      const { id: _ignoredId, organizationId: _ignoredOrganizationId, ...updateData } = createData;

      const updated = await prisma.plotOpportunity.upsert({
        where: {
          id: params.opportunityId
        },
        update: updateData,
        create: createData
      });

      return NextResponse.json(updated);
    }

    const updated = await prisma.plotOpportunity.update({
      where: {
        id: params.opportunityId
      },
      data: {
        bidStatus: body.bidStatus,
        assignedMembershipId:
          body.assignedMembershipId !== undefined ? body.assignedMembershipId || null : undefined,
        currentStage: body.currentStage !== undefined ? body.currentStage : undefined
      }
    });

    if (
      body.bidStatus !== undefined ||
      body.inquiredAt !== undefined ||
      body.needsFollowUp !== undefined ||
      body.suggestedFollowUpDate !== undefined ||
      body.secondFollowUpDate !== undefined ||
      body.followedUpOn !== undefined ||
      body.closedAt !== undefined ||
      body.notes !== undefined ||
      body.contactStatus !== undefined ||
      body.nextAction !== undefined ||
      body.currentStage !== undefined ||
      body.contactedAt !== undefined ||
      body.lastContactedAt !== undefined ||
      body.nextFollowUpAt !== undefined ||
      body.followUpNeeded !== undefined ||
      body.interestStatus !== undefined ||
      body.outcomeStatus !== undefined ||
      body.contactSummary !== undefined ||
      body.notesSummary !== undefined ||
      body.reasonLost !== undefined ||
      body.internalNotes !== undefined ||
      body.externalSummary !== undefined ||
      body.quoteRequestedAt !== undefined ||
      body.quoteSentAt !== undefined
    ) {
      const workflowOpportunity = await updateOpportunityWorkflow(params.opportunityId, {
        currentStage: body.currentStage,
        bidStatus: body.bidStatus,
        assignedMembershipId: body.assignedMembershipId,
        inquiredAt: body.inquiredAt,
        needsFollowUp: body.needsFollowUp,
        suggestedFollowUpDate: body.suggestedFollowUpDate,
        secondFollowUpDate: body.secondFollowUpDate,
        followedUpOn: body.followedUpOn,
        closedAt: body.closedAt,
        internalNotes: body.notes,
        contactStatus: body.contactStatus,
        nextAction: body.nextAction,
        contactedAt: body.contactedAt,
        lastContactedAt: body.lastContactedAt,
        nextFollowUpAt: body.nextFollowUpAt,
        followUpNeeded: body.followUpNeeded,
        interestStatus: body.interestStatus,
        outcomeStatus: body.outcomeStatus,
        contactSummary: body.contactSummary,
        notesSummary: body.notesSummary,
        reasonLost: body.reasonLost,
        externalSummary: body.externalSummary,
        quoteRequestedAt: body.quoteRequestedAt,
        quoteSentAt: body.quoteSentAt,
        nextFollowUpDate: body.nextFollowUpDate
      });

      return NextResponse.json(workflowOpportunity);
    }

    return NextResponse.json(await getOpportunityById(updated.id));
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to persist opportunity update.",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
