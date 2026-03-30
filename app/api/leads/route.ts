import { NextResponse } from "next/server";

import { getBuilderRecords } from "@/lib/opportunities/live-data";

export async function GET() {
  const builders = await getBuilderRecords();
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
