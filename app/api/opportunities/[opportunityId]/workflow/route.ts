import { NextRequest, NextResponse } from "next/server";

import { updateOpportunityWorkflow } from "@/lib/opportunities/contacted-workflow";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { opportunityId: string } }
) {
  try {
    const body = await request.json();
    const opportunity = await updateOpportunityWorkflow(params.opportunityId, body);

    return NextResponse.json(opportunity);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update contacted workflow.",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
