"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActionSelect } from "@/components/ui/action-select";
import { Badge } from "@/components/ui/badge";
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
        <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/72 break-words">{message}</div>
      ) : null}
      {sources.map((source) => (
        <Card key={source.id}>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle className="break-words">{source.name}</CardTitle>
              <p className="mt-2 break-words text-sm text-white/56">
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
              {source.freshnessState ? (
                <Badge tone={freshnessTone(source.freshnessState)}>
                  {source.freshnessState}
                </Badge>
              ) : null}
              {source.dataOrigin ? (
                <Badge tone={source.dataOrigin === "live" ? "green" : source.dataOrigin === "manual" ? "amber" : "red"}>
                  {source.dataOrigin}
                </Badge>
              ) : null}
              <Badge tone="red">Confidence {source.sourceConfidenceScore}</Badge>
              {typeof source.liveDataConfidence === "number" ? (
                <Badge tone={source.liveDataConfidence >= 75 ? "green" : source.liveDataConfidence >= 55 ? "amber" : "red"}>
                  Live {source.liveDataConfidence}
                </Badge>
              ) : null}
              {typeof source.healthScore === "number" ? (
                <Badge tone={source.healthScore >= 75 ? "green" : source.healthScore >= 55 ? "amber" : "red"}>
                  Health {source.healthScore}
                </Badge>
              ) : null}
              {(source.warningFlags?.length ?? 0) > 0 ? <Badge tone="amber">Warnings {source.warningFlags?.length}</Badge> : null}
              <ActionSelect
                placeholder={pendingSourceId === source.id ? "Running..." : "Actions"}
                onSelect={async (value) => {
                  if (value === "rerun") {
                    await rerunSource(source);
                  }
                }}
                options={[
                  { label: "Re-run source", value: "rerun", disabled: !source.active || pendingSourceId === source.id },
                  { label: `Completeness ${source.completenessScore ?? 0}`, value: "completeness", disabled: true },
                  { label: `Drift ${source.driftScore ?? 0}`, value: "drift", disabled: true }
                ]}
              />
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="min-w-0 grid gap-3 sm:grid-cols-2">
              <Info label="Last Success" value={formatDate(source.lastSuccessfulSync)} />
              <Info label="Freshness" value={source.freshnessDetail ?? "No freshness detail yet"} />
              <Info label="Fetched / Normalized" value={`${source.latestFetchedCount ?? 0} / ${source.latestNormalizedCount ?? 0}`} />
              <Info label="New / Updated" value={`${source.newRecordCount ?? 0} / ${source.updatedRecordCount ?? 0}`} />
              <Info label="Open Reviews" value={String(source.openReviewCount ?? 0)} />
              <Info label="Source URL" value={source.sourceUrl} url={source.sourceUrl} />
            </div>
            <div className="space-y-4">
              <details className="min-w-0 rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.18em] text-white/72">
                  Diagnostics details
                </summary>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Info label="Parser" value={source.parserType} />
                  <Info label="Connector Type" value={source.connectorType.replaceAll("_", " ")} />
                  <Info label="Priority" value={String(source.priorityRank)} />
                  <Info label="Official Type" value={source.officialSourceType ?? source.sourceType} />
                  <Info label="Frequency" value={source.syncFrequency} />
                  <Info label="Last Health Check" value={formatDate(source.lastHealthCheckedAt ?? null)} />
                  <Info label="Freshness Score" value={`${source.sourceFreshnessScore}`} />
                  <Info label="Completeness" value={`${source.completenessScore ?? 0}`} />
                  <Info label="Health Score" value={`${source.healthScore ?? 0}`} />
                  <Info label="Unchanged / Errors" value={`${source.unchangedRecordCount ?? 0} / ${source.errorRecordCount ?? 0}`} />
                  <Info label="Parse Failures" value={String(source.parseFailureCount ?? 0)} />
                  <Info label="Blocked Records" value={String(source.blockedCount ?? 0)} />
                  <Info label="Missing Fields" value={String(source.missingFieldCount ?? 0)} />
                  <Info label="Duplicates" value={String(source.duplicateCount ?? 0)} />
                  <Info label="Drift Score" value={String(source.driftScore ?? 0)} />
                  <Info
                    label="Warning Flags"
                    value={source.warningFlags?.length ? source.warningFlags.join(", ") : "None"}
                  />
                </div>
              </details>
              <div className="min-w-0 rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
                <p className="eyebrow-label">Recent sync logs</p>
                <div className="mt-3 space-y-3">
                  {source.logs.length ? source.logs.map((log) => (
                    <div key={`${source.id}-${log.timestamp}`} className="rounded-[14px] border border-white/10 bg-[#171a1f] p-3">
                      <p className="data-label">{log.level}</p>
                      <p className="mt-2 break-words text-sm text-white/72">{log.message}</p>
                    </div>
                  )) : (
                    <div className="rounded-[14px] border border-white/10 bg-[#171a1f] p-3 text-sm text-white/56">
                      No sync logs yet. Run the background sync to populate this source.
                    </div>
                  )}
                </div>
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

function freshnessTone(state: NonNullable<SourceRecord["freshnessState"]>): "slate" | "amber" | "green" | "blue" | "red" {
  if (state === "fresh") {
    return "green";
  }

  if (state === "aging") {
    return "amber";
  }

  if (state === "stale" || state === "failed") {
    return "red";
  }

  return "slate";
}

function Info({
  label,
  value,
  url
}: {
  label: string;
  value: string;
  url?: string;
}) {
  return (
    <div className="min-w-0 rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
      <p className="data-label">{label}</p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block break-all text-sm font-medium text-white hover:text-red-100"
        >
          {value}
        </a>
      ) : (
        <p className="mt-2 break-words text-sm font-medium text-white">{value}</p>
      )}
    </div>
  );
}
