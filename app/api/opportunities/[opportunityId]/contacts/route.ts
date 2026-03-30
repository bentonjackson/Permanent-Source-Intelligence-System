import { NextRequest, NextResponse } from "next/server";

import { createOpportunityContact } from "@/lib/opportunities/contacted-workflow";

export async function POST(
  request: NextRequest,
  { params }: { params: { opportunityId: string } }
) {
  try {
    const body = await request.json();
    const opportunity = await createOpportunityContact(params.opportunityId, body);

    return NextResponse.json(opportunity);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create contact.",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
