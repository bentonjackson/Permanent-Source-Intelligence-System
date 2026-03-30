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
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="p-4 text-sm text-red-100">{error}</CardContent>
        </Card>
      ) : null}
      <Card className="overflow-hidden">
        <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <div className="min-w-0">
            <p className="eyebrow-label">County</p>
            <select
              className="mt-2 h-10 w-full rounded-md border border-white/12 bg-white/[0.04] px-3 text-sm text-white"
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
            <p className="eyebrow-label">City</p>
            <select
              className="mt-2 h-10 w-full rounded-md border border-white/12 bg-white/[0.04] px-3 text-sm text-white"
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
            <p className="eyebrow-label">Jurisdiction</p>
            <select
              className="mt-2 h-10 w-full rounded-md border border-white/12 bg-white/[0.04] px-3 text-sm text-white"
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
            <p className="eyebrow-label">Territory</p>
            <select
              className="mt-2 h-10 w-full rounded-md border border-white/12 bg-white/[0.04] px-3 text-sm text-white"
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
            <p className="eyebrow-label">Project Type</p>
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
            <p className="eyebrow-label">Sort By</p>
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
                className="flex w-full items-center justify-between gap-4 border-b border-white/10 bg-white/[0.02] px-6 py-5 text-left text-white transition-colors duration-200 hover:bg-white/[0.04]"
                onClick={() => toggleCounty(countyGroup.county)}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPinned className="h-4 w-4 text-red-300" />
                    <span className="font-serif text-[1.35rem] tracking-[-0.04em]">{countyGroup.county} County</span>
                  </div>
                  <p className="text-sm text-white/52">
                    {countyGroup.builders.length} builder group{countyGroup.builders.length === 1 ? "" : "s"} • {countyOpenParcels} open parcel{countyOpenParcels === 1 ? "" : "s"}
                  </p>
                </div>
                <ChevronDown className={`h-5 w-5 text-white/60 transition-transform duration-200 ${isCountyOpen ? "rotate-180" : ""}`} />
              </button>
              {isCountyOpen ? (
                <CardContent className="space-y-4 p-4 md:p-6 animate-[panel-in_220ms_ease-out]">
                  {countyGroup.builders.map((builderGroup) => {
                    const isBuilderOpen = openBuilders[builderGroup.key] ?? false;
                    const topScore = Math.max(...builderGroup.items.map((item) => item.opportunityScore));
                    const previewEntity = builderGroup.items
                      .map((item) => getOpportunityEntityPresentation(item).relatedEntityName)
                      .find(Boolean);

                    return (
                      <div key={builderGroup.key} className="rounded-[16px] border border-white/10 bg-white/[0.035] shadow-panel">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors duration-200 hover:bg-white/[0.03]"
                          onClick={() => toggleBuilder(builderGroup.key)}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-serif text-[1.15rem] tracking-[-0.03em] text-white">
                              {builderGroup.name}
                              {previewEntity ? (
                                <span className="ml-2 font-sans text-sm font-normal text-white/42">{previewEntity}</span>
                              ) : null}
                            </p>
                            <p className="mt-2 text-sm text-white/52">
                              {builderGroup.items.length} active propert{builderGroup.items.length === 1 ? "y" : "ies"} • best score {topScore}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge tone={builderGroup.items.some((item) => item.preferredSalesName) ? "slate" : "amber"}>
                              {builderGroup.items.some((item) => item.preferredSalesName) ? "Sales-ready identity" : "Research contact"}
                            </Badge>
                            <ChevronDown className={`h-5 w-5 text-white/60 transition-transform duration-200 ${isBuilderOpen ? "rotate-180" : ""}`} />
                          </div>
                        </button>
                        {isBuilderOpen ? (
                          <div className="space-y-3 border-t border-white/10 p-4 animate-[panel-in_220ms_ease-out]">
                            {builderGroup.items.map((opportunity) => {
                              const entity = getOpportunityEntityPresentation(opportunity);

                              return (
                                <div key={opportunity.id} className="rounded-[16px] border border-white/10 bg-[#171a1f] p-4 transition-all duration-200 hover:-translate-y-[1px] hover:border-white/14 hover:bg-[#1a1d22] hover:shadow-panel">
                                  <div className="flex min-w-0 flex-col gap-4 border-b border-white/8 pb-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                      <p className="font-serif text-[1.22rem] tracking-[-0.03em] text-white">
                                        {entity.displayName}
                                      </p>
                                      <p className="mt-2 text-base font-medium text-white/84">
                                        {opportunity.address || opportunity.parcelNumber || "Unmapped lot"}
                                      </p>
                                      <p className="mt-1 text-sm text-white/52">
                                        {opportunity.city}, {opportunity.county}
                                        {opportunity.subdivision ? ` • ${opportunity.subdivision}` : ""}
                                        {opportunity.lotNumber ? ` • ${opportunity.lotNumber}` : ""}
                                      </p>
                                      {entity.relatedEntityName ? (
                                        <p className="mt-2 text-sm text-white/38">Landowner / related entity: {entity.relatedEntityName}</p>
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
                                    <Info label="Signal" value={opportunity.opportunityType.replaceAll("_", " ")} />
                                    <Info label="Contact Tier" value={formatQualityTier(opportunity.contactQualityTier)} />
                                    <Info label="Entity Confidence" value={`${opportunity.entityConfidenceScore}`} />
                                  </div>
                                  <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
                                    <div className="space-y-4">
                                      <div className="rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
                                        <p className="eyebrow-label">Best contact information</p>
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
                                            <a className="text-link" href={`tel:${opportunity.phone}`}>
                                              Call {opportunity.phone}
                                            </a>
                                          ) : null}
                                          {opportunity.email ? (
                                            <a className="text-link" href={`mailto:${opportunity.email}`}>
                                              Email contact
                                            </a>
                                          ) : null}
                                          {opportunity.website ? (
                                            <a className="text-link" href={opportunity.website} target="_blank" rel="noreferrer">
                                              Open company site
                                            </a>
                                          ) : null}
                                          {opportunity.sourceUrl ? (
                                            <a className="text-link" href={opportunity.sourceUrl} target="_blank" rel="noreferrer">
                                              Open official source
                                            </a>
                                          ) : null}
                                        </div>
                                        {opportunity.aliases.length ? (
                                          <p className="mt-3 text-sm text-white/44">Aliases: {opportunity.aliases.join(", ")}</p>
                                        ) : null}
                                      </div>
                                      <div className="rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
                                        <p className="eyebrow-label">Why it is ranked here</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {opportunity.reasonSummary.map((reason) => (
                                            <Badge key={reason} tone="slate">
                                              {reason}
                                            </Badge>
                                          ))}
                                        </div>
                                        <p className="mt-4 text-sm text-white/78">{opportunity.nextAction}</p>
                                        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-white/36">
                                          {opportunity.sourceJurisdiction} • {opportunity.sourceName} • {formatDate(opportunity.signalDate)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
                                      <p className="eyebrow-label">Rep workflow</p>
                                      <label className="field-shell mt-3">
                                        <span>Assign rep</span>
                                        <select
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
                                          disabled={pendingKey === `move:${opportunity.id}`}
                                          onClick={() => void moveToContacted(opportunity.id, opportunity.assignedMembershipId ?? undefined)}
                                        >
                                          Move to Contacted
                                        </Button>
                                        <Button
                                          variant="outline"
                                          className="border-red-500/32 text-red-100 hover:bg-red-500/12"
                                          disabled={pendingKey === `not-fit:${opportunity.id}`}
                                          onClick={() => void markNotFit(opportunity.id)}
                                        >
                                          Mark Not a Fit
                                        </Button>
                                      </div>
                                      <Link href={`/opportunities/${opportunity.id}`} className="text-link mt-5 inline-flex">
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
          <CardContent className="p-6 text-sm text-white/58">
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
    <div className="min-w-0 rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
      <p className="data-label">{label}</p>
      <p className="data-value mt-2">{value}</p>
    </div>
  );
}
