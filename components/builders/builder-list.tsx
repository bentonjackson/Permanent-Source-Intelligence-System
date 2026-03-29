import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { BuilderRecord } from "@/types/domain";

export function BuilderList({ builders }: { builders: BuilderRecord[] }) {
  return (
    <div className="space-y-4">
      {builders.map((builder) => (
        <Card key={builder.id}>
          <CardHeader>
            <div>
              <CardTitle>{builder.name}</CardTitle>
              <p className="mt-2 text-sm text-slate-600">
                {builder.openOpportunities} open lots to work across {builder.counties.join(", ")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="red">Priority {builder.leadScore}</Badge>
              <Badge tone="slate">{builder.pipelineStage}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Open Lots" value={String(builder.openOpportunities)} />
                <Stat label="Active Properties" value={String(builder.activeProperties)} />
                <Stat label="Last Seen" value={builder.lastSeenLocation} />
                <Stat label="Next Follow-Up" value={formatDate(builder.nextFollowUpDate)} />
              </div>
              <div className="mt-4 space-y-3">
                {builder.properties.map((property) => (
                  <div key={property.id} className="rounded-2xl border bg-slate-50 p-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{property.address}</p>
                        <p className="text-sm text-slate-600">
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
            <div className="rounded-2xl border bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">Rep-ready summary</p>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>Best contact: {builder.contact.email ?? builder.contact.phone ?? "Needs contact research"}</p>
                <p>Last seen area: {builder.lastSeenLocation}</p>
                <p>Open opportunities: {builder.openOpportunities}</p>
              </div>
              <Link
                href={`/builders/${builder.id}`}
                className="mt-6 inline-flex text-sm font-medium text-red-700"
              >
                Open builder view
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
