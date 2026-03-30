"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PreviewOpportunity {
  id: string;
  address: string;
  county: string;
  builderName: string | null;
  opportunityScore: number;
}

export function ManualImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<"preview" | "import" | null>(null);
  const [result, setResult] = useState<{
    rows: number;
    normalized: number;
    preview?: PreviewOpportunity[];
    imported?: number;
  } | null>(null);
  const canSubmit = useMemo(() => Boolean(file), [file]);

  async function submit(mode: "preview" | "import") {
    if (!file) {
      return;
    }

    setLoading(mode);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);

    try {
      const response = await fetch("/api/imports", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Import request failed.");
      }

      setResult(payload);
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual CSV / XLSX import</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Use this when a county source changes format or when operations needs a fallback import. Preview first, then write into the same deduplicated database pipeline.
        </p>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-700"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => submit("preview")} disabled={!canSubmit || loading !== null}>
            {loading === "preview" ? "Previewing..." : "Preview import"}
          </Button>
          <Button className="bg-neutral-950 hover:bg-neutral-800" onClick={() => submit("import")} disabled={!canSubmit || loading !== null}>
            {loading === "import" ? "Importing..." : "Import to database"}
          </Button>
        </div>
        {result ? (
          <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
            <p>{result.rows} row(s) read • {result.normalized} normalized record(s)</p>
            {typeof result.imported === "number" ? (
              <p className="mt-2 font-medium">{result.imported} record(s) written into the database.</p>
            ) : null}
            {result.preview?.length ? (
              <div className="mt-3 space-y-2">
                {result.preview.map((opportunity) => (
                  <div key={opportunity.id} className="rounded-xl border bg-white p-3">
                    <p className="font-medium text-slate-900">{opportunity.address}</p>
                    <p className="text-slate-600">{opportunity.builderName ?? "Builder needs research"} • {opportunity.county}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
