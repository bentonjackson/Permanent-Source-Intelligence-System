"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBuilderEntityPresentation } from "@/lib/entities/contact-identity";
import { formatDate } from "@/lib/utils";
import { BuilderRecord } from "@/types/domain";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function BuilderList({ builders }: { builders: BuilderRecord[] }) {
  const [openBuilders, setOpenBuilders] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(builders.slice(0, 2).map((builder) => [builder.id, true]))
  );

  function toggleBuilder(builderId: string) {
    setOpenBuilders((current) => ({
      ...current,
      [builderId]: !current[builderId]
    }));
  }

  return (
    <div className="space-y-4">
      {builders.map((builder) => {
        const entity = getBuilderEntityPresentation(builder);
        const isOpen = openBuilders[builder.id] ?? false;

        return (
          <Card key={builder.id} className="overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors duration-200 hover:bg-white/[0.03]"
              onClick={() => toggleBuilder(builder.id)}
            >
              <div className="min-w-0">
                <p className="eyebrow-label">Builder dossier</p>
                <CardTitle className="mt-2 text-[1.35rem]">{entity.displayName}</CardTitle>
                {entity.relatedEntityName ? (
                  <p className="mt-2 text-sm text-white/42">Related entity: {entity.relatedEntityName}</p>
                ) : null}
                <p className="mt-3 text-sm text-white/56">
                  {builder.openOpportunities} open lots to work across {builder.counties.join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden flex-wrap justify-end gap-2 sm:flex">
                  <Badge tone="red">Priority {builder.leadScore}</Badge>
                  <Badge tone="slate">{builder.pipelineStage}</Badge>
                  <Badge tone={builder.preferredSalesName ? "slate" : "amber"}>
                    {builder.contactQualityTier.replaceAll("_", " ")}
                  </Badge>
                </div>
                <ChevronDown className={`h-5 w-5 shrink-0 text-white/56 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </button>
            {isOpen ? (
              <CardContent className="grid gap-6 border-t border-white/10 lg:grid-cols-[1.2fr_0.8fr] animate-[panel-in_220ms_ease-out]">
                <div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Stat label="Open Lots" value={String(builder.openOpportunities)} />
                    <Stat label="Active Properties" value={String(builder.activeProperties)} />
                    <Stat label="Total Value" value={formatCurrency(builder.totalEstimatedValue || builder.totalImprovementValue)} />
                    <Stat label="Last Activity" value={formatDate(builder.lastActivityAt)} />
                  </div>
                  <div className="mt-4 space-y-3">
                    {builder.properties.map((property) => (
                      <div key={property.id} className="rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="font-medium text-white">{property.address}</p>
                            <p className="text-sm text-white/56">
                              {property.city}, {property.county}
                              {property.subdivision ? ` • ${property.subdivision}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {property.permits.map((permit) => (
                              <Badge key={permit.id} tone={permit.classification === "single_family_home" ? "green" : "slate"}>
                                {permit.permitStatus}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="eyebrow-label">Builder summary</p>
                  <p className="mt-3 font-serif text-xl tracking-[-0.03em] text-white">Rep-ready dossier</p>
                  <div className="mt-4 space-y-2 text-sm text-white/58">
                    <p>Preferred sales name: {entity.displayName}</p>
                    <p>Legal entity: {builder.legalEntityName ?? "Unknown"}</p>
                    <p>Aliases: {builder.aliases.length ? builder.aliases.join(", ") : "None stored"}</p>
                    <p>Role type: {builder.roleType.replaceAll("_", " ")}</p>
                    <p>Contact quality: {formatBand(builder.contactQualityBand)} • score {builder.contactQualityScore}</p>
                    <p>Entity confidence: {builder.entityConfidenceScore}</p>
                    <p>Role confidence: {builder.roleConfidenceScore}</p>
                    <p>Best contact: {builder.contact.email ?? builder.contact.phone ?? builder.preferredContactTarget ?? "Needs contact research"}</p>
                    <p>Contractor registration: {builder.contractorRegistrationNumber ?? "Not found"} • {builder.contractorRegistrationStatus.replaceAll("_", " ")}</p>
                    <p>Builder heat: {builder.builderHeatScore}</p>
                    <p>Next best action: {builder.nextBestAction}</p>
                    <p>Last seen area: {builder.lastSeenLocation}</p>
                    <p>Open opportunities: {builder.openOpportunities}</p>
                    <p>Counties active in: {builder.counties.join(", ")}</p>
                    <p>Next follow-up: {formatDate(builder.nextFollowUpDate)}</p>
                  </div>
                  <Link
                    href={`/builders/${builder.id}`}
                    className="text-link mt-6 inline-flex"
                  >
                    Open builder view
                  </Link>
                </div>
              </CardContent>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

function formatBand(value: BuilderRecord["contactQualityBand"]) {
  return value.replaceAll("_", " ").toUpperCase().replace("TIER ", "Tier ");
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
      <p className="data-label">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
