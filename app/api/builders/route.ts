import { NextResponse } from "next/server";

import { getBuilderRecords } from "@/lib/opportunities/live-data";
import { calculateLeadScore } from "@/lib/scoring/lead-scoring";

export async function GET() {
  const builders = await getBuilderRecords();
  const payload = builders.map((builder) => ({
    ...builder,
    computedScore: calculateLeadScore(builder)
  }));

  return NextResponse.json(payload);
}
