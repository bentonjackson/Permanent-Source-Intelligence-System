import { NextResponse } from "next/server";

import { getSourceRecords } from "@/lib/opportunities/live-data";

export async function GET() {
  return NextResponse.json(await getSourceRecords());
}
