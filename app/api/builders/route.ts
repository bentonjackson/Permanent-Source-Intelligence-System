import { NextRequest, NextResponse } from "next/server";

import { getBuilderRecords } from "@/lib/opportunities/live-data";
import { calculateLeadScore } from "@/lib/scoring/lead-scoring";

export async function GET(request: NextRequest) {
  const builders = await getBuilderRecords();
  const payload = builders.map((builder) => ({
    ...builder,
    computedScore: calculateLeadScore(builder)
  }));

  if (request.nextUrl.searchParams.get("format") === "csv") {
    const header = [
      "builder",
      "normalized_name",
      "total_permits",
      "permits_last_30_days",
      "avg_project_value",
      "counties",
      "phone",
      "email",
      "website",
      "outreach_status",
      "next_best_action"
    ];
    const rows = payload.map((builder) =>
      [
        builder.name,
        builder.normalizedName,
        String(builder.contractorMetrics.totalPermits),
        String(builder.contractorMetrics.permitsLast30Days),
        String(builder.contractorMetrics.avgProjectValue),
        builder.counties.join(" | "),
        builder.contact.phone ?? "",
        builder.contact.email ?? "",
        builder.contact.website ?? "",
        builder.contractorMetrics.outreachStatus,
        builder.nextBestAction
      ]
        .map((value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`)
        .join(",")
    );

    return new NextResponse([header.join(","), ...rows].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"buildsignal-contractors.csv\""
      }
    });
  }

  return NextResponse.json(payload);
}
