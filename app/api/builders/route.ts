import { NextResponse } from "next/server";

import { builders } from "@/lib/sample-data";
import { calculateLeadScore } from "@/lib/scoring/lead-scoring";

export async function GET() {
  const payload = builders.map((builder) => ({
    ...builder,
    computedScore: calculateLeadScore(builder)
  }));

  return NextResponse.json(payload);
}
