import { NextRequest, NextResponse } from "next/server";

import { getOpportunityData } from "@/lib/opportunities/live-data";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const payload = await getOpportunityData({
    county: searchParams.get("county"),
    city: searchParams.get("city"),
    jurisdiction: searchParams.get("jurisdiction"),
    territory: searchParams.get("territory"),
    projectSegment: (searchParams.get("projectSegment") as "all" | "single_family" | "multifamily" | "commercial" | null) ?? "all",
    status: (searchParams.get("status") as "all" | "queue" | "contacted" | "closed" | null) ?? "all",
    sort: (searchParams.get("sort") as "score" | "newest" | "suggested_follow_up" | "inquired_at" | null) ?? "score"
  });

  return NextResponse.json({
    opportunities: payload.opportunities,
    counties: payload.counties,
    cities: payload.cities,
    jurisdictions: payload.jurisdictions,
    territories: payload.territories
  });
}
