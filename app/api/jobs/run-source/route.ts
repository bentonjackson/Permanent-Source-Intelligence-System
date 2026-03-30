import { NextRequest, NextResponse } from "next/server";

import { runAllScheduledSyncs, runScheduledSync } from "@/lib/jobs/source-sync";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = body.sourceId ? await runScheduledSync(body.sourceId) : await runAllScheduledSyncs();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to run source sync.",
        detail: error instanceof Error ? error.message : "Unknown source sync failure."
      },
      { status: 500 }
    );
  }
}
