import { NextRequest, NextResponse } from "next/server";

import { runScheduledSync } from "@/lib/jobs/source-sync";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await runScheduledSync(body.sourceId);

  return NextResponse.json(result);
}
