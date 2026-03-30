import { NextRequest, NextResponse } from "next/server";

import { getContactedOpportunities } from "@/lib/opportunities/contacted-workflow";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const payload = await getContactedOpportunities({
    county: searchParams.get("county"),
    city: searchParams.get("city"),
    jurisdiction: searchParams.get("jurisdiction"),
    territory: searchParams.get("territory")
  });

  return NextResponse.json(payload);
}
