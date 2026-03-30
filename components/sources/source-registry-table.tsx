"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { SourceRecord } from "@/types/domain";

export function SourceRegistryTable({ sources }: { sources: SourceRecord[] }) {
  const router = useRouter();
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function rerunSource(source: SourceRecord) {
    setPendingSourceId(source.id);
    setMessage(null);

    try {
      const response = await fetch("/api/jobs/run-source", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sourceId: source.slug
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.detail ?? payload.error ?? "Source rerun failed.");
      }

      setMessage(`Re-ran ${source.name}. Refreshing with the latest stored source health and logs.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to rerun the selected source.");
    } finally {
      setPendingSourceId(null);
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700">{message}</div>
      ) : null}
      {sources.map((source) => (
        <Card key={source.id}>
          <CardHeader>
            <div>
              <CardTitle>{source.name}</CardTitle>
              <p className="mt-2 text-sm text-slate-600">
                {source.city}, {source.county} • {source.sourceType}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={source.active ? "green" : "amber"}>
                {source.active ? "active" : "inactive"}
              </Badge>
              <Badge tone={statusTone(source)}>
                {statusLabel(source)}
              </Badge>
              <Badge tone="red">Confidence {source.sourceConfidenceScore}</Badge>
              {source.active ? (
                <Button
                  variant="outline"
                  className="h-8 rounded-full"
                  disabled={pendingSourceId === source.id}
                  onClick={() => rerunSource(source)}
                >
                  {pendingSourceId === source.id ? "Running..." : "Re-run"}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Parser" value={source.parserType} />
              <Info label="Connector Type" value={source.connectorType.replaceAll("_", " ")} />
              <Info label="Priority" value={String(source.priorityRank)} />
              <Info label="Official Type" value={source.officialSourceType ?? source.sourceType} />
              <Info label="Frequency" value={source.syncFrequency} />
              <Info label="Last Success" value={formatDate(source.lastSuccessfulSync)} />
              <Info label="Last Health Check" value={formatDate(source.lastHealthCheckedAt ?? null)} />
              <Info label="Freshness" value={`${source.sourceFreshnessScore}`} />
              <Info label="Parse Failures" value={String(source.parseFailureCount ?? 0)} />
              <Info label="Missing Fields" value={String(source.missingFieldCount ?? 0)} />
              <Info label="Open Reviews" value={String(source.openReviewCount ?? 0)} />
              <Info label="Source URL" value={source.sourceUrl} />
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">Recent sync logs</p>
              <div className="mt-3 space-y-3">
                {source.logs.length ? source.logs.map((log) => (
                  <div key={`${source.id}-${log.timestamp}`} className="rounded-2xl border bg-white p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{log.level}</p>
                    <p className="mt-1 text-sm text-slate-700">{log.message}</p>
                  </div>
                )) : (
                  <div className="rounded-2xl border bg-white p-3 text-sm text-slate-600">
                    No sync logs yet. Run the background sync to populate this source.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function statusLabel(source: SourceRecord) {
  if (!source.active) {
    return "inactive";
  }

  return source.syncStatus;
}

function statusTone(source: SourceRecord): "slate" | "amber" | "green" | "blue" | "red" {
  if (!source.active) {
    return "slate";
  }

  if (source.syncStatus === "success") {
    return "green";
  }

  if (source.syncStatus === "running") {
    return "blue";
  }

  if (source.syncStatus === "warning") {
    return "amber";
  }

  return "red";
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
