import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { builders, plotOpportunities } from "@/lib/sample-data";
import { formatDate } from "@/lib/utils";

export default function BuilderDetailPage({ params }: { params: { builderId: string } }) {
  const builder = builders.find((entry) => entry.id === params.builderId);

  if (!builder) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Builder View"
        title={builder.name}
        description="See the builder's active lots, where they are building, and what the next bid step should be."
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
              <p>Stage: {builder.pipelineStage}</p>
              <p>Assigned rep: {builder.assignedRep}</p>
              <p>Next follow-up: {formatDate(builder.nextFollowUpDate)}</p>
              <p>Open opportunities: {builder.openOpportunities}</p>
              <p>Last seen area: {builder.lastSeenLocation}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Open opportunities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              {plotOpportunities
                .filter((opportunity) => opportunity.builderId === builder.id)
                .map((opportunity) => (
                  <p key={opportunity.id}>• {opportunity.address}: {opportunity.nextAction}</p>
                ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}
