import { NextResponse } from "next/server";

import { dashboardSnapshot } from "@/lib/sample-data";

export async function GET() {
  return NextResponse.json(dashboardSnapshot);
}
