import { NextResponse } from "next/server";

import { plotOpportunities } from "@/lib/sample-data";

export async function GET() {
  return NextResponse.json(plotOpportunities);
}
