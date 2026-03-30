import { NextResponse } from "next/server";

import { getOpportunityById } from "@/lib/opportunities/live-data";

export async function GET(
  _request: Request,
  { params }: { params: { opportunityId: string } }
) {
  const opportunity = await getOpportunityById(params.opportunityId);

  if (!opportunity) {
    return NextResponse.json(
      {
        error: "Contacted opportunity not found."
      },
      { status: 404 }
    );
  }

  return NextResponse.json(opportunity);
}
