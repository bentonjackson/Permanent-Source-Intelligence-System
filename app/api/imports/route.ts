import { NextRequest, NextResponse } from "next/server";

import { parseWorkbook } from "@/lib/imports/manual-import";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing import file." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = parseWorkbook(buffer);

  return NextResponse.json({
    rows: result.rows.length,
    normalized: result.normalized.length,
    preview: result.normalized.slice(0, 5)
  });
}
