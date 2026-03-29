import { NextResponse } from "next/server";

import { builders } from "@/lib/sample-data";

export async function GET() {
  return NextResponse.json(
    builders.map((builder) => ({
      id: builder.id,
      name: builder.name,
      stage: builder.pipelineStage,
      score: builder.leadScore,
      followUp: builder.nextFollowUpDate
    }))
  );
}
