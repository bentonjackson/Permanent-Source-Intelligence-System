"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOpportunityEntityPresentation } from "@/lib/entities/contact-identity";
import { COUNTIES_NEAR_ME_LABEL } from "@/lib/geo/territories";
import { PlotOpportunity } from "@/types/domain";
import { formatDate } from "@/lib/utils";

export function ClosedJobsBoard({
  opportunities,
  counties,
  selectedCounty
}: {
  opportunities: PlotOpportunity[];
  counties: string[];
  selectedCounty: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"awarded" | "declined">("awarded");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function updateCounty(county: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (!county || county === COUNTIES_NEAR_ME_LABEL) {
      params.delete("county");
    } else {
      params.set("county", county);
    }

    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  const jobs = useMemo(
    () => opportunities.filter((opportunity) => opportunity.bidStatus === (tab === "awarded" ? "won" : "lost")),
    [opportunities, tab]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow-label">County</p>
            <select
              className="mt-2 h-10 rounded-md border border-white/12 bg-white/[0.04] px-3 text-sm text-white"
              value={selectedCounty}
              onChange={(event) => updateCounty(event.target.value)}
            >
              {counties.map((county) => (
                <option key={county} value={county}>
                  {county}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="eyebrow-label">Closed jobs</p>
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
        jobs.map((opportunity) => {
          const entity = getOpportunityEntityPresentation(opportunity);
          const expanded = expandedId === opportunity.id;

          return (
            <Card key={opportunity.id}>
              <CardHeader className="gap-0 p-0">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 rounded-[18px] px-5 py-4 text-left transition-colors duration-200 hover:bg-white/[0.04]"
                  onClick={() => setExpandedId((current) => (current === opportunity.id ? null : opportunity.id))}
                  aria-label={expanded ? "Collapse closed job details" : "Expand closed job details"}
                >
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow-label">{tab === "awarded" ? "Awarded" : "Declined"}</p>
                    <CardTitle className="mt-2 truncate text-[1.18rem]">{entity.displayName}</CardTitle>
                    <p className="mt-2 break-words text-sm text-white/56">
                      {opportunity.address || opportunity.parcelNumber || "Closed job"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={tab === "awarded" ? "green" : "red"}>{tab === "awarded" ? "Awarded" : "Declined"}</Badge>
                    {expanded ? <ChevronUp className="h-5 w-5 text-white/56" /> : <ChevronDown className="h-5 w-5 text-white/56" />}
                  </div>
                </button>
              </CardHeader>
              {expanded ? (
                <CardContent className="space-y-4 animate-[panel-in_220ms_ease-out]">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Info label="Parcel" value={opportunity.parcelNumber ?? opportunity.address} />
                    <Info label="Location" value={[opportunity.city, opportunity.county].filter(Boolean).join(", ")} />
                    <Info label="Inquired" value={formatDate(opportunity.inquiredAt)} />
                    <Info label="Closed" value={formatDate(opportunity.closedAt)} />
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-3">
                      <Info label="Legal entity" value={opportunity.legalEntityName ?? "Unknown"} />
                      <Info label="Role / quality" value={`${opportunity.roleType.replaceAll("_", " ")} • ${opportunity.contactQualityTier.replaceAll("_", " ")}`} />
                      <Info label="Project Type" value={opportunity.projectSegment.replace("_", " ")} />
                      <Info label="Source" value={opportunity.sourceName} />
                    </div>
                    <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="eyebrow-label">Final notes</p>
                      <div className="mt-3 space-y-2 text-sm text-white/70">
                        {opportunity.notes.length ? opportunity.notes.map((note) => <p key={note}>• {note}</p>) : <p>No notes logged.</p>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              ) : null}
            </Card>
          );
        })
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-white/56">No {tab} jobs yet.</CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string | null; value: string | null }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
      <p className="data-label">{label || "Field"}</p>
      <p className="data-value mt-2">{value || "N/A"}</p>
    </div>
  );
}
