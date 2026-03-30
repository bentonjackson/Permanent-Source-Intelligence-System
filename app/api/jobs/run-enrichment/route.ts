import { NextResponse } from "next/server";

import { runBuilderEnrichment } from "@/lib/enrichment/builder-enrichment";

export async function POST() {
  const result = await runBuilderEnrichment();
  return NextResponse.json(result);
}
