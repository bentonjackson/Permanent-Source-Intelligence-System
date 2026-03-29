"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlotOpportunity } from "@/types/domain";
import { formatDate } from "@/lib/utils";
import { useOpportunityBoardState } from "@/components/opportunities/use-opportunity-board-state";

export function ClosedJobsBoard({ opportunities }: { opportunities: PlotOpportunity[] }) {
  const { merged } = useOpportunityBoardState(opportunities);
  const [tab, setTab] = useState<"awarded" | "declined">("awarded");

  const jobs = useMemo(
    () => merged.filter((opportunity) => opportunity.bidStatus === (tab === "awarded" ? "won" : "lost")),
    [merged, tab]
  );

  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Closed Jobs</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant={tab === "awarded" ? "default" : "outline"} className="h-9" onClick={() => setTab("awarded")}>
                Awarded
              </Button>
              <Button variant={tab === "declined" ? "default" : "outline"} className="h-9" onClick={() => setTab("declined")}>
                Declined
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {jobs.length ? (
        jobs.map((opportunity) => (
          <Card key={opportunity.id}>
            <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>{opportunity.address || opportunity.parcelNumber || "Closed job"}</CardTitle>
                <p className="mt-2 text-sm text-slate-600">
                  {opportunity.builderName ?? "Unknown builder"} • {opportunity.parcelNumber ?? "No parcel"} {opportunity.lotNumber ? `• ${opportunity.lotNumber}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={tab === "awarded" ? "green" : "red"}>{tab === "awarded" ? "Awarded" : "Declined"}</Badge>
                <Badge tone="slate">Inquired {formatDate(opportunity.inquiredAt)}</Badge>
                <Badge tone="slate">Closed {formatDate(opportunity.closedAt)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3">
                <Info label="Parcel" value={opportunity.parcelNumber ?? opportunity.address} />
                <Info label="Builder" value={opportunity.builderName ?? "Unknown"} />
                <Info label="Project Type" value={opportunity.projectSegment.replace("_", " ")} />
                <Info label="Source" value={opportunity.sourceName} />
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Final notes</p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  {opportunity.notes.length ? opportunity.notes.map((note) => <p key={note}>• {note}</p>) : <p>No notes logged.</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">
            No {tab} jobs yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value || "N/A"}</p>
    </div>
  );
}
