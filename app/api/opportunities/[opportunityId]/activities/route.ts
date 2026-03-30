import { NextRequest, NextResponse } from "next/server";

import { logOpportunityActivity } from "@/lib/opportunities/contacted-workflow";

export async function POST(
  request: NextRequest,
  { params }: { params: { opportunityId: string } }
) {
  try {
    const body = await request.json();
    const opportunity = await logOpportunityActivity(params.opportunityId, body);

    return NextResponse.json(opportunity);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to log activity.",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
