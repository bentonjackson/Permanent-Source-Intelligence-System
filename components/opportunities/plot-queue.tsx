"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOpportunityBoardState } from "@/components/opportunities/use-opportunity-board-state";
import { PlotOpportunity } from "@/types/domain";
import { formatDate } from "@/lib/utils";

const bidStatusTone: Record<PlotOpportunity["bidStatus"], "slate" | "amber" | "green" | "blue" | "red"> = {
  not_reviewed: "slate",
  researching_builder: "amber",
  ready_to_contact: "red",
  contacted: "blue",
  bid_requested: "red",
  quoted: "green",
  won: "green",
  lost: "red",
  not_a_fit: "red"
};

export function PlotQueue({ opportunities }: { opportunities: PlotOpportunity[] }) {
  const { merged, markContacted } = useOpportunityBoardState(opportunities);
  const [segmentFilter, setSegmentFilter] = useState<"all" | PlotOpportunity["projectSegment"]>("all");
  const [sortBy, setSortBy] = useState<"score" | "newest">("score");

  const filteredOpportunities = useMemo(() => {
    const base =
      segmentFilter === "all"
        ? merged
        : merged.filter((opportunity) => opportunity.projectSegment === segmentFilter);

    const activeOnly = base.filter(
      (opportunity) =>
        opportunity.bidStatus !== "contacted" &&
        opportunity.bidStatus !== "won" &&
        opportunity.bidStatus !== "lost"
    );

    return [...activeOnly].sort((left, right) => {
      if (sortBy === "score") {
        return right.opportunityScore - left.opportunityScore;
      }

      if (sortBy === "newest") {
        return new Date(right.signalDate).getTime() - new Date(left.signalDate).getTime();
      }

      return 0;
    });
  }, [merged, segmentFilter, sortBy]);

  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Project Type</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterButton active={segmentFilter === "all"} onClick={() => setSegmentFilter("all")}>All</FilterButton>
              <FilterButton active={segmentFilter === "single_family"} onClick={() => setSegmentFilter("single_family")}>Single-Family</FilterButton>
              <FilterButton active={segmentFilter === "multifamily"} onClick={() => setSegmentFilter("multifamily")}>Multifamily</FilterButton>
              <FilterButton active={segmentFilter === "commercial"} onClick={() => setSegmentFilter("commercial")}>Commercial</FilterButton>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Sort By</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterButton active={sortBy === "score"} onClick={() => setSortBy("score")}>Highest Score</FilterButton>
              <FilterButton active={sortBy === "newest"} onClick={() => setSortBy("newest")}>Newest Signal</FilterButton>
            </div>
          </div>
        </CardContent>
      </Card>
      {filteredOpportunities.map((opportunity) => (
        <Card key={opportunity.id}>
          <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>{opportunity.address || opportunity.parcelNumber || "Unmapped lot"}</CardTitle>
              <p className="mt-2 text-sm text-slate-600">
                {opportunity.city}, {opportunity.county}
                {opportunity.subdivision ? ` • ${opportunity.subdivision}` : ""}
                {opportunity.lotNumber ? ` • ${opportunity.lotNumber}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="red">Score {opportunity.opportunityScore}</Badge>
              <Badge tone={opportunity.projectSegment === "commercial" ? "red" : opportunity.projectSegment === "multifamily" ? "amber" : "slate"}>
                {opportunity.projectSegment.replace("_", "-")}
              </Badge>
              <Badge tone="slate">{opportunity.buildReadiness.replaceAll("_", " ")}</Badge>
              <Badge tone={bidStatusTone[opportunity.bidStatus]}>{opportunity.bidStatus.replaceAll("_", " ")}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Info label="Builder" value={opportunity.builderName ?? "Needs research"} />
              <Info label="Parcel / Lot" value={[opportunity.parcelNumber, opportunity.lotNumber].filter(Boolean).join(" • ") || "N/A"} />
              <Info label="Source" value={opportunity.sourceName} />
              <Info label="Signal Date" value={formatDate(opportunity.signalDate)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Why this matters</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {opportunity.reasonSummary.map((reason) => (
                    <Badge key={reason} tone="slate">
                      {reason}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Next Action</p>
                <p className="mt-2 text-sm text-slate-800">{opportunity.nextAction}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    className="bg-neutral-950 hover:bg-neutral-800"
                    onClick={() => markContacted(opportunity.id)}
                  >
                    Move to Contacted
                  </Button>
                  <Link href={`/opportunities/${opportunity.id}`} className="inline-flex items-center text-sm font-medium text-red-700">
                    Open opportunity detail
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FilterButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button variant={active ? "default" : "outline"} className="h-9" onClick={onClick}>
      {children}
    </Button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
