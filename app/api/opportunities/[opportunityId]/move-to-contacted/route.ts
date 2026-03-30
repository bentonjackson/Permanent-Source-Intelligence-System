import { NextRequest, NextResponse } from "next/server";

import { moveOpportunityToContacted } from "@/lib/opportunities/contacted-workflow";

export async function POST(
  request: NextRequest,
  { params }: { params: { opportunityId: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const opportunity = await moveOpportunityToContacted(params.opportunityId, {
      assignedMembershipId: body.assignedMembershipId ?? undefined
    });

    return NextResponse.json(opportunity);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to move opportunity to Contacted.",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
