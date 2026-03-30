import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBuilderEntityPresentation, getOpportunityEntityPresentation } from "@/lib/entities/contact-identity";
import { PageHeader } from "@/components/layout/page-header";
import { getBuilderRecords, getOpportunityById } from "@/lib/opportunities/live-data";
import { formatDate } from "@/lib/utils";

export default async function OpportunityDetailPage({ params }: { params: { opportunityId: string } }) {
  const [opportunity, builders] = await Promise.all([
    getOpportunityById(params.opportunityId),
    getBuilderRecords()
  ]);

  if (!opportunity) {
    notFound();
  }

  const builder = opportunity.builderId ? builders.find((entry) => entry.id === opportunity.builderId) : null;
  const opportunityEntity = getOpportunityEntityPresentation(opportunity);
  const builderEntity = builder ? getBuilderEntityPresentation(builder) : null;

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
              <Info label="Builder" value={opportunityEntity.displayName} />
              <Info label="County / City" value={`${opportunity.county} • ${opportunity.city}`} />
              <Info label="Project Type" value={opportunity.projectSegment.replace("_", " ")} />
              <Info label="Readiness" value={opportunity.buildReadiness.replaceAll("_", " ")} />
              <Info label="Signal Date" value={formatDate(opportunity.signalDate)} />
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Sales contact identity</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Info label="Preferred sales name" value={opportunityEntity.displayName} />
                <Info label="Legal entity" value={opportunity.legalEntityName ?? "Unknown"} />
                <Info label="Role type" value={opportunity.roleType.replaceAll("_", " ")} />
                <Info label="Contact quality" value={opportunity.contactQualityTier.replaceAll("_", " ")} />
                <Info label="Confidence" value={`${opportunity.entityConfidenceScore}`} />
                <Info label="Preferred contact" value={opportunity.preferredContactTarget ?? "Research contact"} />
                <Info label="Phone" value={opportunity.phone ?? "Needs research"} />
                <Info label="Email / Website" value={opportunity.email ?? opportunity.website ?? "Needs research"} />
              </div>
              {opportunityEntity.relatedEntityName ? (
                <p className="mt-3 text-sm text-slate-600">Related Entity: {opportunityEntity.relatedEntityName}</p>
              ) : null}
              {opportunity.aliases.length ? (
                <p className="mt-2 text-sm text-slate-600">Aliases: {opportunity.aliases.join(", ")}</p>
              ) : null}
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
              <p>Last contact: {formatDate(opportunity.lastContactedAt ?? opportunity.contactedAt)}</p>
              <p>Next follow-up: {formatDate(opportunity.nextFollowUpAt ?? opportunity.nextFollowUpDate)}</p>
              <p>Interest: {opportunity.interestStatus.replaceAll("_", " ")}</p>
              <p>Outcome: {opportunity.outcomeStatus.replaceAll("_", " ")}</p>
              <p>Contact status: {opportunity.contactStatus}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Stored contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              {opportunity.contacts.length ? (
                opportunity.contacts.map((contact) => (
                  <div key={contact.id} className="rounded-2xl border bg-slate-50 p-3">
                    <p className="font-medium text-slate-900">
                      {contact.fullName ?? "Unnamed contact"}
                      {contact.isPrimary ? " • Primary" : ""}
                    </p>
                    <p>{[contact.roleTitle, contact.companyName].filter(Boolean).join(" • ") || "Contact record"}</p>
                    <p>{contact.phone ?? contact.mobilePhone ?? contact.officePhone ?? "No phone stored"}</p>
                    <p>{contact.email ?? contact.website ?? "No email or website stored"}</p>
                  </div>
                ))
              ) : (
                <p>No contacts stored yet.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              {opportunity.activities.length ? (
                opportunity.activities.slice(0, 6).map((activity) => (
                  <div key={activity.id} className="rounded-2xl border bg-slate-50 p-3">
                    <p className="font-medium text-slate-900">
                      {activity.activityType.replaceAll("_", " ")} • {formatDate(activity.occurredAt)}
                    </p>
                    <p>{activity.contactName ?? activity.outcome ?? "No outcome recorded"}</p>
                    {activity.note ? <p>{activity.note}</p> : null}
                  </div>
                ))
              ) : (
                <p>No activity logged yet.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Builder context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>Name: {builderEntity?.displayName ?? opportunityEntity.displayName}</p>
              <p>Legal entity: {builder?.legalEntityName ?? opportunity.legalEntityName ?? "Unknown"}</p>
              <p>Role type: {builder?.roleType?.replaceAll("_", " ") ?? opportunity.roleType.replaceAll("_", " ")}</p>
              <p>Contact quality: {builder?.contactQualityTier?.replaceAll("_", " ") ?? opportunity.contactQualityTier.replaceAll("_", " ")}</p>
              <p>Entity confidence: {builder?.entityConfidenceScore ?? opportunity.entityConfidenceScore}</p>
              <p>Email: {builder?.contact.email ?? "Needs research"}</p>
              <p>Phone: {builder?.contact.phone ?? "Needs research"}</p>
              <p>Website: {builder?.contact.website ?? "Needs research"}</p>
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
