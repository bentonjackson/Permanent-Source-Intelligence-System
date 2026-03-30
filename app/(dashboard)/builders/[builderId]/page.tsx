import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBuilderEntityPresentation } from "@/lib/entities/contact-identity";
import { PageHeader } from "@/components/layout/page-header";
import { getBuilderRecord, getOpportunityData } from "@/lib/opportunities/live-data";
import { formatDate } from "@/lib/utils";

export default async function BuilderDetailPage({ params }: { params: { builderId: string } }) {
  const [builder, data] = await Promise.all([
    getBuilderRecord(params.builderId),
    getOpportunityData()
  ]);

  if (!builder) {
    notFound();
  }

  const entity = getBuilderEntityPresentation(builder);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Builder View"
        title={entity.displayName}
        description="See the builder's active lots, enriched identity, contact quality, and what the next outreach step should be."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Active lots and permits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {builder.properties.map((property) => (
              <div key={property.id} className="rounded-2xl border bg-slate-50 p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{property.address}</p>
                    <p className="text-sm text-slate-600">
                      {property.city}, {property.county} {property.subdivision ? `• ${property.subdivision}` : ""}
                    </p>
                  </div>
                  <Badge tone="slate">{property.noteCount} notes</Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {property.permits.map((permit) => (
                    <div key={permit.id} className="rounded-2xl border bg-white p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-medium">{permit.permitNumber}</p>
                          <p className="text-sm text-slate-600">{permit.permitType}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge tone="slate">{permit.classification}</Badge>
                          <Badge tone="red">{permit.permitStatus}</Badge>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <Info label="Permit Number" value={permit.permitNumber} />
                        <Info label="Source" value={permit.sourceName} />
                        <Info label="Issue Date" value={formatDate(permit.issueDate)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Builder summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>Preferred sales name: {entity.displayName}</p>
              <p>Legal entity: {builder.legalEntityName ?? "Unknown"}</p>
              <p>Aliases: {builder.aliases.length ? builder.aliases.join(", ") : "None stored"}</p>
              <p>Role type: {builder.roleType.replaceAll("_", " ")}</p>
              <p>Role confidence: {builder.roleConfidenceScore}</p>
              <p>Contact quality: {formatBand(builder.contactQualityBand)} • score {builder.contactQualityScore}</p>
              <p>Entity confidence: {builder.entityConfidenceScore}</p>
              <p>Preferred contact target: {builder.preferredContactTarget ?? "Research contact"}</p>
              <p>Phone: {builder.contact.phone ?? "Needs research"}</p>
              <p>Email: {builder.contact.email ?? "Needs research"}</p>
              <p>Website: {builder.contact.website ?? "Needs research"}</p>
              <p>Mailing address: {builder.mailingAddress ?? "Needs research"}</p>
              <p>City / state: {builder.cityState ?? "Needs research"}</p>
              <p>Contractor registration: {builder.contractorRegistrationNumber ?? "Not found"} • {builder.contractorRegistrationStatus.replaceAll("_", " ")}</p>
              <p>Business entity: {builder.businessEntityNumber ?? "Not found"} • {builder.businessEntityStatus.replaceAll("_", " ")}</p>
              <p>Builder heat: {builder.builderHeatScore}</p>
              <p>Next best action: {builder.nextBestAction}</p>
              <p>Last enriched: {formatDate(builder.lastEnrichedAt)}</p>
              <p>Stage: {builder.pipelineStage}</p>
              <p>Assigned rep: {builder.assignedRep}</p>
              <p>Next follow-up: {formatDate(builder.nextFollowUpDate)}</p>
              <p>Open opportunities: {builder.openOpportunities}</p>
              <p>Total active value: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(builder.totalEstimatedValue || builder.totalImprovementValue)}</p>
              <p>Counties active in: {builder.counties.join(", ")}</p>
              <p>Last seen area: {builder.lastSeenLocation}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Entity matches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              {builder.entityMatches.length ? builder.entityMatches.slice(0, 6).map((match) => (
                <div key={match.id} className="rounded-2xl border bg-slate-50 p-3">
                  <p className="font-medium text-slate-900">
                    {match.preferredSalesName ?? match.rawSourceName}
                  </p>
                  <p className="mt-1">{match.sourceLabel} • {match.matchStrategy}</p>
                  <p className="mt-1">Role: {match.roleType.replaceAll("_", " ")} • confidence {match.roleConfidenceScore}</p>
                  <p className="mt-1 text-slate-500">{match.rationale}</p>
                </div>
              )) : <p>No enrichment matches stored yet.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Enrichment audit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              {builder.enrichmentAudit.length ? builder.enrichmentAudit.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-2xl border bg-slate-50 p-3">
                  <p className="font-medium text-slate-900">
                    {item.fieldName ?? item.provider}: {item.fieldValue ?? "No value"}
                  </p>
                  <p className="mt-1">{item.sourceLabel ?? item.provider} • confidence {item.confidence}</p>
                  <p className="mt-1 text-slate-500">{item.rationale ?? "No rationale stored."}</p>
                </div>
              )) : <p>No enrichment audit rows stored yet.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Open opportunities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              {data.opportunities
                .filter((opportunity) => opportunity.builderId === builder.id)
                .map((opportunity) => (
                  <p key={opportunity.id}>• {opportunity.address}: {opportunity.preferredSalesName ?? "Unknown Builder"} • {opportunity.nextAction}</p>
                ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatBand(value: string) {
  return value.replaceAll("_", " ").toUpperCase().replace("TIER ", "Tier ");
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}
