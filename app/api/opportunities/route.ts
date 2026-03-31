import { NextRequest, NextResponse } from "next/server";

import { getOpportunityData } from "@/lib/opportunities/live-data";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const payload = await getOpportunityData({
    county: searchParams.get("county"),
    city: searchParams.get("city"),
    jurisdiction: searchParams.get("jurisdiction"),
    territory: searchParams.get("territory"),
    search: searchParams.get("search"),
    jobFit: (searchParams.get("jobFit") as "all" | "insulation" | "shelving" | "both" | "low" | null) ?? "all",
    recency: (searchParams.get("recency") as "all" | "0_7_days" | "8_30_days" | "31_90_days" | "older" | null) ?? "all",
    minScore: searchParams.get("minScore") ? Number(searchParams.get("minScore")) : null,
    hasContactInfo: searchParams.get("hasContactInfo") === "true" ? true : null,
    notYetContacted: searchParams.get("notYetContacted") === "true" ? true : null,
    projectSegment: (searchParams.get("projectSegment") as "all" | "single_family" | "multifamily" | "commercial" | null) ?? "all",
    status: (searchParams.get("status") as "all" | "queue" | "contacted" | "closed" | null) ?? "all",
    sort: (searchParams.get("sort") as "score" | "newest" | "suggested_follow_up" | "inquired_at" | null) ?? "score"
  });

  if (searchParams.get("format") === "csv") {
    const header = [
      "preferred_sales_name",
      "address",
      "city",
      "county",
      "lead_type",
      "job_fit",
      "score",
      "primary_phone",
      "primary_email",
      "website",
      "next_action",
      "source_name",
      "source_url"
    ];
    const rows = payload.opportunities.map((opportunity) =>
      [
        opportunity.preferredSalesName ?? opportunity.builderName ?? "Unknown Builder",
        opportunity.address,
        opportunity.city,
        opportunity.county,
        opportunity.leadType,
        opportunity.jobFit,
        String(opportunity.opportunityScore),
        opportunity.phone ?? "",
        opportunity.email ?? "",
        opportunity.website ?? "",
        opportunity.nextAction,
        opportunity.sourceName,
        opportunity.sourceUrl
      ]
        .map((value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`)
        .join(",")
    );

    return new NextResponse([header.join(","), ...rows].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"buildsignal-opportunities.csv\""
      }
    });
  }

  return NextResponse.json({
    opportunities: payload.opportunities,
    counties: payload.counties,
    cities: payload.cities,
    jurisdictions: payload.jurisdictions,
    territories: payload.territories
  });
}
