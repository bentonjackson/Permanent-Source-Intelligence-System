import { NextResponse } from "next/server";

import { sources } from "@/lib/sample-data";

export async function GET() {
  return NextResponse.json(sources);
}
