import { NextRequest, NextResponse } from "next/server";

import { parseWorkbook } from "@/lib/imports/manual-import";
import { persistManualImport } from "@/lib/jobs/source-sync";
import { mapNormalizedPermitToOpportunity } from "@/lib/opportunities/mapping";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const mode = String(formData.get("mode") ?? "preview");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing import file." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = parseWorkbook(buffer);

  if (mode === "import") {
    const persisted = await persistManualImport(result.normalized);

    return NextResponse.json({
      rows: result.rows.length,
      normalized: result.normalized.length,
      imported: persisted.imported
    });
  }

  return NextResponse.json({
    rows: result.rows.length,
    normalized: result.normalized.length,
    preview: result.normalized.slice(0, 5),
    opportunities: result.normalized.slice(0, 5).map(mapNormalizedPermitToOpportunity)
  });
}
