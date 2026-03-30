"use client";

import { ChevronDown, MapPinned } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useOpportunityActions } from "@/components/opportunities/use-opportunity-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getOpportunityEntityPresentation } from "@/lib/entities/contact-identity";
import { COUNTIES_NEAR_ME_LABEL } from "@/lib/geo/territories";
import { formatDate } from "@/lib/utils";
import { PlotOpportunity } from "@/types/domain";

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

function formatCurrency(value: number | null) {
  if (value == null) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function builderGroupKey(opportunity: PlotOpportunity) {
  return opportunity.builderId ?? opportunity.normalizedEntityName ?? opportunity.builderName ?? opportunity.likelyCompanyName ?? `unknown-${opportunity.county}`;
}

function formatIdentityRole(value: PlotOpportunity["roleType"]) {
  return value.replaceAll("_", " ");
}

function formatQualityTier(value: PlotOpportunity["contactQualityTier"]) {
  return value.replaceAll("_", " ");
}

function formatQualityBand(value: PlotOpportunity["contactQualityBand"]) {
  return value.replaceAll("_", " ").toUpperCase().replace("TIER ", "Tier ");
}

function normalizeCityKey(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "")
    .toLowerCase();
}

export function PlotQueue({
  opportunities,
  counties,
  cities,
  jurisdictions,
  territories,
  selectedCounty,
  selectedCity,
  selectedJurisdiction,
  selectedTerritory,
  reps
}: {
  opportunities: PlotOpportunity[];
  counties: string[];
  cities: string[];
  jurisdictions: string[];
  territories: string[];
  selectedCounty: string;
  selectedCity: string;
  selectedJurisdiction: string;
  selectedTerritory: string;
  reps: Array<{ id: string; displayName: string; email: string | null }>;
}) {
  const merged = opportunities;
  const { assignRep, markNotFit, moveToContacted, pendingKey, error } = useOpportunityActions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [segmentFilter, setSegmentFilter] = useState<"all" | PlotOpportunity["projectSegment"]>("all");
  const [sortBy, setSortBy] = useState<"score" | "newest">("score");
  const [openCounties, setOpenCounties] = useState<Record<string, boolean>>({});
  const [openBuilders, setOpenBuilders] = useState<Record<string, boolean>>({});
  const resolvedSelectedCity =
    cities.find((city) => normalizeCityKey(city) === normalizeCityKey(selectedCity)) ?? selectedCity;

  function updateFilter(key: string, value: string, defaultValue: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (!value || value === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  const filteredOpportunities = useMemo(() => {
    const base =
      segmentFilter === "all"
        ? merged
        : merged.filter((opportunity) => opportunity.projectSegment === segmentFilter);

    const activeOnly = base.filter(
      (opportunity) =>
        !["contacted", "won", "lost", "not_a_fit"].includes(opportunity.bidStatus)
    );

    return [...activeOnly].sort((left, right) => {
      if (sortBy === "newest") {
        return new Date(right.signalDate).getTime() - new Date(left.signalDate).getTime();
      }

      return right.opportunityScore - left.opportunityScore;
    });
  }, [merged, segmentFilter, sortBy]);

  const groupedOpportunities = useMemo(() => {
    const countiesMap = new Map<
      string,
      Array<{ key: string; name: string; items: PlotOpportunity[] }>
    >();

    for (const opportunity of filteredOpportunities) {
      const countyKey = opportunity.county || "Unknown County";
      const builderKey = builderGroupKey(opportunity);
      const builderName =
        getOpportunityEntityPresentation(opportunity).displayName;

      if (!countiesMap.has(countyKey)) {
        countiesMap.set(countyKey, []);
      }

      const builders = countiesMap.get(countyKey)!;
      const existing = builders.find((builder) => builder.key === builderKey);

      if (existing) {
        existing.items.push(opportunity);
      } else {
        builders.push({
          key: builderKey,
          name: builderName,
          items: [opportunity]
        });
      }
    }

    const preferredOrder = counties.filter((county) => county !== COUNTIES_NEAR_ME_LABEL);

    return [...countiesMap.entries()]
      .sort((left, right) => {
        const leftIndex = preferredOrder.indexOf(left[0]);
        const rightIndex = preferredOrder.indexOf(right[0]);

        if (leftIndex === -1 && rightIndex === -1) {
          return left[0].localeCompare(right[0]);
        }

        if (leftIndex === -1) {
          return 1;
        }

        if (rightIndex === -1) {
          return -1;
        }

        return leftIndex - rightIndex;
      })
      .map(([county, builders]) => ({
        county,
        builders: builders
          .sort((left, right) => Math.max(...right.items.map((item) => item.opportunityScore)) - Math.max(...left.items.map((item) => item.opportunityScore)))
      }));
  }, [counties, filteredOpportunities]);

  useEffect(() => {
    const nextState: Record<string, boolean> = {};

    for (const group of groupedOpportunities) {
      if (selectedCounty !== COUNTIES_NEAR_ME_LABEL) {
        nextState[group.county] = group.county === selectedCounty;
      } else if (openCounties[group.county] !== undefined) {
        nextState[group.county] = openCounties[group.county];
      } else {
        nextState[group.county] = groupedOpportunities.length <= 3;
      }
    }

    setOpenCounties(nextState);
  }, [groupedOpportunities, selectedCounty]);

  useEffect(() => {
    const nextState: Record<string, boolean> = {};

    for (const county of groupedOpportunities) {
      for (const builder of county.builders) {
        if (openBuilders[builder.key] !== undefined) {
          nextState[builder.key] = openBuilders[builder.key];
        } else {
          nextState[builder.key] = county.builders.length <= 2;
        }
      }
    }

    setOpenBuilders(nextState);
  }, [groupedOpportunities]);

  function toggleCounty(county: string) {
    setOpenCounties((current) => ({
      ...current,
      [county]: !current[county]
    }));
  }

  function toggleBuilder(key: string) {
    setOpenBuilders((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}
      <Card className="border-dashed">
        <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">County</p>
            <select
              className="mt-2 h-9 w-full rounded-xl border bg-white px-3 text-sm"
              value={selectedCounty}
              onChange={(event) => updateFilter("county", event.target.value, COUNTIES_NEAR_ME_LABEL)}
            >
              {counties.map((county) => (
                <option key={county} value={county}>
                  {county}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">City</p>
            <select
              className="mt-2 h-9 w-full rounded-xl border bg-white px-3 text-sm"
              value={resolvedSelectedCity}
              onChange={(event) => updateFilter("city", event.target.value, "All cities")}
            >
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">Jurisdiction</p>
            <select
              className="mt-2 h-9 w-full rounded-xl border bg-white px-3 text-sm"
              value={selectedJurisdiction}
              onChange={(event) => updateFilter("jurisdiction", event.target.value, "All jurisdictions")}
            >
              {jurisdictions.map((jurisdiction) => (
                <option key={jurisdiction} value={jurisdiction}>
                  {jurisdiction}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">Territory</p>
            <select
              className="mt-2 h-9 w-full rounded-xl border bg-white px-3 text-sm"
              value={selectedTerritory}
              onChange={(event) => updateFilter("territory", event.target.value, "All territories")}
            >
              {territories.map((territory) => (
                <option key={territory} value={territory}>
                  {territory}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">Project Type</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterButton active={segmentFilter === "all"} onClick={() => setSegmentFilter("all")}>
                All
              </FilterButton>
              <FilterButton active={segmentFilter === "single_family"} onClick={() => setSegmentFilter("single_family")}>
                Single-Family
              </FilterButton>
              <FilterButton active={segmentFilter === "multifamily"} onClick={() => setSegmentFilter("multifamily")}>
                Multifamily
              </FilterButton>
              <FilterButton active={segmentFilter === "commercial"} onClick={() => setSegmentFilter("commercial")}>
                Commercial
              </FilterButton>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">Sort By</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterButton active={sortBy === "score"} onClick={() => setSortBy("score")}>
                Highest Score
              </FilterButton>
              <FilterButton active={sortBy === "newest"} onClick={() => setSortBy("newest")}>
                Newest Signal
              </FilterButton>
            </div>
          </div>
        </CardContent>
      </Card>
      {groupedOpportunities.length ? (
        groupedOpportunities.map((countyGroup) => {
          const isCountyOpen = openCounties[countyGroup.county] ?? false;
          const countyOpenParcels = countyGroup.builders.reduce((sum, builder) => sum + builder.items.length, 0);

          return (
            <Card key={countyGroup.county} className="overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 bg-neutral-950 px-6 py-5 text-left text-white"
                onClick={() => toggleCounty(countyGroup.county)}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPinned className="h-4 w-4 text-red-400" />
                    <span className="text-lg font-semibold">{countyGroup.county} County</span>
                  </div>
                  <p className="text-sm text-neutral-300">
                    {countyGroup.builders.length} builder group{countyGroup.builders.length === 1 ? "" : "s"} • {countyOpenParcels} open parcel{countyOpenParcels === 1 ? "" : "s"}
                  </p>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform ${isCountyOpen ? "rotate-180" : ""}`} />
              </button>
              {isCountyOpen ? (
                <CardContent className="space-y-4 p-4 md:p-6">
                  {countyGroup.builders.map((builderGroup) => {
                    const isBuilderOpen = openBuilders[builderGroup.key] ?? false;
                    const topScore = Math.max(...builderGroup.items.map((item) => item.opportunityScore));
                    const previewEntity = builderGroup.items
                      .map((item) => getOpportunityEntityPresentation(item).relatedEntityName)
                      .find(Boolean);

                    return (
                      <div key={builderGroup.key} className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                          onClick={() => toggleBuilder(builderGroup.key)}
                        >
                          <div>
                            <p className="text-base font-semibold text-slate-950">
                              {builderGroup.name}
                              {previewEntity ? (
                                <span className="ml-2 font-normal text-slate-500">{previewEntity}</span>
                              ) : null}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {builderGroup.items.length} active propert{builderGroup.items.length === 1 ? "y" : "ies"} • best score {topScore}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge tone={builderGroup.items.some((item) => item.preferredSalesName) ? "slate" : "amber"}>
                              {builderGroup.items.some((item) => item.preferredSalesName) ? "Sales-ready identity" : "Research contact"}
                            </Badge>
                            <ChevronDown className={`h-5 w-5 transition-transform ${isBuilderOpen ? "rotate-180" : ""}`} />
                          </div>
                        </button>
                        {isBuilderOpen ? (
                          <div className="space-y-3 border-t border-neutral-200 p-4">
                            {builderGroup.items.map((opportunity) => {
                              const entity = getOpportunityEntityPresentation(opportunity);

                              return (
                                <div key={opportunity.id} className="rounded-2xl border bg-slate-50 p-4">
                                  <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                      <p className="text-base font-semibold text-slate-950">
                                        {opportunity.address || opportunity.parcelNumber || "Unmapped lot"}
                                      </p>
                                      <p className="mt-1 text-sm text-slate-600">
                                        {opportunity.city}, {opportunity.county}
                                        {opportunity.subdivision ? ` • ${opportunity.subdivision}` : ""}
                                        {opportunity.lotNumber ? ` • ${opportunity.lotNumber}` : ""}
                                      </p>
                                      <p className="mt-2 text-sm font-medium text-slate-900">{entity.displayName}</p>
                                      {entity.relatedEntityName ? (
                                        <p className="text-sm text-slate-600">Related Entity: {entity.relatedEntityName}</p>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <Badge tone="red">Score {opportunity.opportunityScore}</Badge>
                                      <Badge tone={opportunity.projectSegment === "commercial" ? "red" : opportunity.projectSegment === "multifamily" ? "amber" : "slate"}>
                                        {opportunity.projectSegment.replace("_", "-")}
                                      </Badge>
                                      <Badge tone="slate">{opportunity.buildReadiness.replaceAll("_", " ")}</Badge>
                                      <Badge tone={bidStatusTone[opportunity.bidStatus]}>
                                        {opportunity.bidStatus.replaceAll("_", " ")}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                    <Info label="Parcel / Lot" value={[opportunity.parcelNumber, opportunity.lotNumber].filter(Boolean).join(" • ") || "N/A"} />
                                    <Info label="Value" value={formatCurrency(opportunity.estimatedProjectValue ?? opportunity.improvementValue ?? opportunity.landValue)} />
                                    <Info label="Permit Signal" value={opportunity.opportunityType.replaceAll("_", " ")} />
                                    <Info label="Stage" value={opportunity.bidStatus.replaceAll("_", " ")} />
                                    <Info label="Signal Date" value={formatDate(opportunity.signalDate)} />
                                  </div>
                                  <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
                                    <div className="space-y-4">
                                      <div className="rounded-2xl border bg-white p-4">
                                        <p className="text-xs uppercase tracking-wide text-slate-500">Best contact information</p>
                                        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                          <Info label="Preferred sales name" value={entity.displayName} />
                                          <Info label="Legal entity" value={opportunity.legalEntityName ?? "Unknown"} />
                                          <Info label="Role type" value={formatIdentityRole(opportunity.roleType)} />
                                          <Info label="Contact quality" value={`${formatQualityBand(opportunity.contactQualityBand)} • ${opportunity.contactQualityScore}`} />
                                          <Info label="Confidence" value={`${opportunity.entityConfidenceScore}`} />
                                          <Info label="Role confidence" value={`${opportunity.roleConfidenceScore}`} />
                                          <Info label="Best contact target" value={opportunity.preferredContactTarget ?? "Research contact"} />
                                          <Info label="Direct phone" value={opportunity.phone ?? "Needs research"} />
                                          <Info label="Direct email" value={opportunity.email ?? "Needs research"} />
                                          <Info label="Company website" value={opportunity.website ?? "Needs research"} />
                                          <Info label="Contractor reg." value={[opportunity.contractorRegistrationNumber, opportunity.contractorRegistrationStatus.replaceAll("_", " ")].filter(Boolean).join(" • ") || "Unknown"} />
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-4 text-sm">
                                          {opportunity.phone ? (
                                            <a className="font-medium text-red-700" href={`tel:${opportunity.phone}`}>
                                              Call {opportunity.phone}
                                            </a>
                                          ) : null}
                                          {opportunity.email ? (
                                            <a className="font-medium text-red-700" href={`mailto:${opportunity.email}`}>
                                              Email contact
                                            </a>
                                          ) : null}
                                          {opportunity.website ? (
                                            <a className="font-medium text-red-700" href={opportunity.website} target="_blank" rel="noreferrer">
                                              Open company site
                                            </a>
                                          ) : null}
                                          {opportunity.sourceUrl ? (
                                            <a className="font-medium text-red-700" href={opportunity.sourceUrl} target="_blank" rel="noreferrer">
                                              Open official source
                                            </a>
                                          ) : null}
                                        </div>
                                        {opportunity.aliases.length ? (
                                          <p className="mt-3 text-sm text-slate-600">Aliases: {opportunity.aliases.join(", ")}</p>
                                        ) : null}
                                      </div>
                                      <div className="rounded-2xl border bg-white p-4">
                                        <p className="text-xs uppercase tracking-wide text-slate-500">Why it is ranked here</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {opportunity.reasonSummary.map((reason) => (
                                            <Badge key={reason} tone="slate">
                                              {reason}
                                            </Badge>
                                          ))}
                                        </div>
                                        <p className="mt-4 text-sm text-slate-700">{opportunity.nextAction}</p>
                                        <p className="mt-3 text-xs text-slate-500">
                                          {opportunity.sourceJurisdiction} • {opportunity.sourceName} • {formatDate(opportunity.signalDate)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="rounded-2xl border bg-white p-4">
                                      <p className="text-xs uppercase tracking-wide text-slate-500">Rep workflow</p>
                                      <label className="mt-3 block text-sm text-slate-700">
                                        <span className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Assign rep</span>
                                        <select
                                          className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                                          value={opportunity.assignedMembershipId ?? ""}
                                          onChange={(event) => {
                                            void assignRep(opportunity.id, event.target.value || null);
                                          }}
                                        >
                                          {reps.map((rep) => (
                                            <option key={rep.id || "open-territory"} value={rep.id}>
                                              {rep.displayName}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <div className="mt-4 flex flex-wrap gap-2">
                                        <Button
                                          className="bg-neutral-950 hover:bg-neutral-800"
                                          disabled={pendingKey === `move:${opportunity.id}`}
                                          onClick={() => void moveToContacted(opportunity.id, opportunity.assignedMembershipId ?? undefined)}
                                        >
                                          Move to Contacted
                                        </Button>
                                        <Button
                                          variant="outline"
                                          className="border-red-600 text-red-700 hover:bg-red-50"
                                          disabled={pendingKey === `not-fit:${opportunity.id}`}
                                          onClick={() => void markNotFit(opportunity.id)}
                                        >
                                          Mark Not a Fit
                                        </Button>
                                      </div>
                                      <Link href={`/opportunities/${opportunity.id}`} className="mt-4 inline-flex text-sm font-medium text-red-700">
                                        Open opportunity detail
                                      </Link>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </CardContent>
              ) : null}
            </Card>
          );
        })
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">
            No database-backed opportunities matched the current county and project filters.
          </CardContent>
        </Card>
      )}
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
    <div className="min-w-0 rounded-2xl border bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
