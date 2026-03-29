"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlotOpportunity } from "@/types/domain";
import { formatDate } from "@/lib/utils";
import { useOpportunityBoardState } from "@/components/opportunities/use-opportunity-board-state";

function buildFollowUpOptions() {
  const dates: string[] = [];
  const start = new Date("2026-03-29T00:00:00.000Z");

  for (let index = 0; index < 14; index += 1) {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    dates.push(next.toISOString().slice(0, 10));
  }

  return dates;
}

const followUpOptions = buildFollowUpOptions();

export function ContactedLeadsBoard({ opportunities }: { opportunities: PlotOpportunity[] }) {
  const { merged, state, updateEntry, setOutcome } = useOpportunityBoardState(opportunities);
  const [expandedId, setExpandedId] = useState<string | null>(opportunities[0]?.id ?? null);
  const [sortBy, setSortBy] = useState<"suggested_follow_up" | "inquired_at">("suggested_follow_up");

  const contacted = useMemo(
    () => merged.filter((opportunity) => opportunity.inquiredAt || opportunity.bidStatus === "contacted"),
    [merged]
  );

  const sortedContacted = useMemo(() => {
    return [...contacted].sort((left, right) => {
      if (sortBy === "inquired_at") {
        const leftDate = left.inquiredAt ? new Date(left.inquiredAt).getTime() : Number.MAX_SAFE_INTEGER;
        const rightDate = right.inquiredAt ? new Date(right.inquiredAt).getTime() : Number.MAX_SAFE_INTEGER;
        return leftDate - rightDate;
      }

      const leftLocal = state[left.id];
      const rightLocal = state[right.id];
      const leftDate = leftLocal?.suggestedFollowUpDate ? new Date(leftLocal.suggestedFollowUpDate).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDate = rightLocal?.suggestedFollowUpDate ? new Date(rightLocal.suggestedFollowUpDate).getTime() : Number.MAX_SAFE_INTEGER;
      return leftDate - rightDate;
    });
  }, [contacted, sortBy, state]);

  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Sort Contacted Leads</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant={sortBy === "suggested_follow_up" ? "default" : "outline"} className="h-9" onClick={() => setSortBy("suggested_follow_up")}>
                Suggested Follow-Up Date
              </Button>
              <Button variant={sortBy === "inquired_at" ? "default" : "outline"} className="h-9" onClick={() => setSortBy("inquired_at")}>
                Inquiry Date
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {sortedContacted.map((opportunity) => {
        const local = state[opportunity.id];
        const expanded = expandedId === opportunity.id;

        return (
          <Card key={opportunity.id}>
            <CardHeader className="gap-4">
              <button
                type="button"
                className="flex w-full flex-col gap-3 text-left lg:flex-row lg:items-center lg:justify-between"
                onClick={() => setExpandedId((current) => (current === opportunity.id ? null : opportunity.id))}
              >
                <div>
                  <CardTitle>{opportunity.address || opportunity.parcelNumber || "Parcel lead"}</CardTitle>
                  <p className="mt-2 text-sm text-slate-600">
                    {opportunity.builderName ?? "Builder needs research"} • {opportunity.parcelNumber ?? "No parcel"} {opportunity.lotNumber ? `• ${opportunity.lotNumber}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="blue">Inquired {formatDate(opportunity.inquiredAt)}</Badge>
                  <Badge tone={local?.needsFollowUp ? "red" : "slate"}>
                    {local?.needsFollowUp ? "Follow-up needed" : "No follow-up"}
                  </Badge>
                  <Badge tone="slate">
                    Suggested {formatDate(local?.suggestedFollowUpDate || null)}
                  </Badge>
                  <Button
                    className="h-8 bg-neutral-950 px-3 text-xs hover:bg-neutral-800"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOutcome(opportunity.id, "won");
                      setExpandedId(null);
                    }}
                  >
                    Award Job
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 border-red-600 px-3 text-xs text-red-700 hover:bg-red-50"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOutcome(opportunity.id, "lost");
                      setExpandedId(null);
                    }}
                  >
                    Decline Job
                  </Button>
                  {expanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                </div>
              </button>
            </CardHeader>
            {expanded ? (
              <CardContent className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-3">
                  <Info label="Parcel you inquired on" value={opportunity.parcelNumber ?? opportunity.address} />
                  <Info label="When you inquired" value={formatDate(opportunity.inquiredAt)} />
                  <Info label="Source" value={opportunity.sourceName} />
                  <Info label="Current contact status" value={opportunity.contactStatus} />
                </div>
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm text-slate-700">
                      <span className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Needs follow-up</span>
                      <select
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                        value={local?.needsFollowUp ? "yes" : "no"}
                        onChange={(event) => {
                          updateEntry(opportunity.id, {
                            needsFollowUp: event.target.value === "yes"
                          });
                        }}
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                    <label className="text-sm text-slate-700">
                      <span className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Followed up on</span>
                      <select
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                        value={local?.followedUpOn ?? ""}
                        onChange={(event) => {
                          updateEntry(opportunity.id, {
                            followedUpOn: event.target.value
                          });
                        }}
                      >
                        <option value="">Not set</option>
                        {followUpOptions.map((date) => (
                          <option key={date} value={date}>
                            {date}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-slate-700">
                      <span className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Suggested follow-up date</span>
                      <select
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                        value={local?.suggestedFollowUpDate ?? ""}
                        onChange={(event) => {
                          updateEntry(opportunity.id, {
                            suggestedFollowUpDate: event.target.value
                          });
                        }}
                      >
                        <option value="">Not set</option>
                        {followUpOptions.map((date) => (
                          <option key={date} value={date}>
                            {date}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-slate-700">
                      <span className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Second follow-up date</span>
                      <select
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                        value={local?.secondFollowUpDate ?? ""}
                        onChange={(event) => {
                          updateEntry(opportunity.id, {
                            secondFollowUpDate: event.target.value
                          });
                        }}
                      >
                        <option value="">Not set</option>
                        {followUpOptions.map((date) => (
                          <option key={date} value={date}>
                            {date}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="mt-4 block text-sm text-slate-700">
                    <span className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Notes</span>
                    <textarea
                      className="min-h-[120px] w-full rounded-2xl border bg-white px-3 py-3 text-sm"
                      value={local?.notes ?? ""}
                      onChange={(event) => {
                        updateEntry(opportunity.id, {
                          notes: event.target.value
                        });
                      }}
                      placeholder="Add call notes, bid feedback, shelving interest, or next-step context."
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      className="bg-neutral-950 hover:bg-neutral-800"
                      onClick={() => {
                        setOutcome(opportunity.id, "won");
                        setExpandedId(null);
                      }}
                    >
                      Award Job
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-600 text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setOutcome(opportunity.id, "lost");
                        setExpandedId(null);
                      }}
                    >
                      Decline Job
                    </Button>
                  </div>
                </div>
              </CardContent>
            ) : null}
          </Card>
        );
      })}
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
