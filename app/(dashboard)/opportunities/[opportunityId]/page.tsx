import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { builders, plotOpportunities } from "@/lib/sample-data";
import { formatDate } from "@/lib/utils";

export default function OpportunityDetailPage({ params }: { params: { opportunityId: string } }) {
  const opportunity = plotOpportunities.find((entry) => entry.id === params.opportunityId);

  if (!opportunity) {
    notFound();
  }

  const builder = opportunity.builderId ? builders.find((entry) => entry.id === opportunity.builderId) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Opportunity Detail"
        title={opportunity.address || opportunity.parcelNumber || "Plot opportunity"}
        description="Review the lot, source evidence, likely builder, and next action needed to ask for the insulation bid."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Lot and source evidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Info label="Builder" value={opportunity.builderName ?? "Needs research"} />
              <Info label="County / City" value={`${opportunity.county} • ${opportunity.city}`} />
              <Info label="Project Type" value={opportunity.projectSegment.replace("_", " ")} />
              <Info label="Readiness" value={opportunity.buildReadiness.replaceAll("_", " ")} />
              <Info label="Signal Date" value={formatDate(opportunity.signalDate)} />
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Why it is in the queue</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {opportunity.reasonSummary.map((reason) => (
                  <Badge key={reason} tone="slate">
                    {reason}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Next step</p>
              <p className="mt-2 text-sm text-slate-800">{opportunity.nextAction}</p>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bid workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>Status: {opportunity.bidStatus.replaceAll("_", " ")}</p>
              <p>Assigned rep: {opportunity.assignedRep}</p>
              <p>When inquired: {formatDate(opportunity.inquiredAt)}</p>
              <p>Contact status: {opportunity.contactStatus}</p>
              <p>Follow-up management: use the Contacted section</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Builder context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>Name: {builder?.name ?? opportunity.builderName ?? "Unknown"}</p>
              <p>Email: {builder?.contact.email ?? "Needs research"}</p>
              <p>Phone: {builder?.contact.phone ?? "Needs research"}</p>
              <p>Open lots: {builder?.openOpportunities ?? 1}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              {opportunity.notes.length ? (
                opportunity.notes.map((note) => <p key={note}>• {note}</p>)
              ) : (
                <p>No notes yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
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
