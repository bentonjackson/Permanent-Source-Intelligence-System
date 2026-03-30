import { NextResponse } from "next/server";

import { runDiagnostics } from "@/lib/diagnostics/run-diagnostics";

export async function POST() {
  try {
    const result = await runDiagnostics();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to run diagnostics."
      },
      {
        status: 500
      }
    );
  }
}
