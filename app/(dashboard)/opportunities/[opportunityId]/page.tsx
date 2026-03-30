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
            <div>
              <p className="eyebrow-label">Field Record</p>
              <CardTitle className="mt-2">Lot and source evidence</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Info label="Builder" value={opportunityEntity.displayName} />
              <Info label="County / City" value={`${opportunity.county} • ${opportunity.city}`} />
              <Info label="Project Type" value={opportunity.projectSegment.replace("_", " ")} />
              <Info label="Readiness" value={opportunity.buildReadiness.replaceAll("_", " ")} />
              <Info label="Signal Date" value={formatDate(opportunity.signalDate)} />
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <p className="eyebrow-label">Sales contact identity</p>
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
                <p className="mt-3 text-sm text-white/56">Related Entity: {opportunityEntity.relatedEntityName}</p>
              ) : null}
              {opportunity.aliases.length ? (
                <p className="mt-2 text-sm text-white/48">Aliases: {opportunity.aliases.join(", ")}</p>
              ) : null}
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <p className="eyebrow-label">Why it is in the queue</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {opportunity.reasonSummary.map((reason) => (
                  <Badge key={reason} tone="slate">
                    {reason}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
              <p className="eyebrow-label">Next step</p>
              <p className="mt-2 text-sm text-white/84">{opportunity.nextAction}</p>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <p className="eyebrow-label">Bid workflow</p>
                <CardTitle className="mt-2">Current status</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/62">
              <InfoRow label="Status" value={opportunity.bidStatus.replaceAll("_", " ")} />
              <InfoRow label="Assigned rep" value={opportunity.assignedRep} />
              <InfoRow label="When inquired" value={formatDate(opportunity.inquiredAt)} />
              <InfoRow label="Last contact" value={formatDate(opportunity.lastContactedAt ?? opportunity.contactedAt)} />
              <InfoRow label="Next follow-up" value={formatDate(opportunity.nextFollowUpAt ?? opportunity.nextFollowUpDate)} />
              <InfoRow label="Interest" value={opportunity.interestStatus.replaceAll("_", " ")} />
              <InfoRow label="Outcome" value={opportunity.outcomeStatus.replaceAll("_", " ")} />
              <InfoRow label="Contact status" value={opportunity.contactStatus} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <p className="eyebrow-label">People</p>
                <CardTitle className="mt-2">Stored contacts</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/62">
              {opportunity.contacts.length ? (
                opportunity.contacts.map((contact) => (
                  <div key={contact.id} className="rounded-[16px] border border-white/10 bg-white/[0.03] p-3">
                    <p className="font-medium text-white">
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
              <div>
                <p className="eyebrow-label">History</p>
                <CardTitle className="mt-2">Recent activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/62">
              {opportunity.activities.length ? (
                opportunity.activities.slice(0, 6).map((activity) => (
                  <div key={activity.id} className="rounded-[16px] border border-white/10 bg-white/[0.03] p-3">
                    <p className="font-medium text-white">
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
              <div>
                <p className="eyebrow-label">Builder context</p>
                <CardTitle className="mt-2">Resolved identity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/62">
              <InfoRow label="Name" value={builderEntity?.displayName ?? opportunityEntity.displayName} />
              <InfoRow label="Legal entity" value={builder?.legalEntityName ?? opportunity.legalEntityName ?? "Unknown"} />
              <InfoRow label="Role type" value={builder?.roleType?.replaceAll("_", " ") ?? opportunity.roleType.replaceAll("_", " ")} />
              <InfoRow
                label="Contact quality"
                value={builder?.contactQualityTier?.replaceAll("_", " ") ?? opportunity.contactQualityTier.replaceAll("_", " ")}
              />
              <InfoRow label="Entity confidence" value={String(builder?.entityConfidenceScore ?? opportunity.entityConfidenceScore)} />
              <InfoRow label="Email" value={builder?.contact.email ?? "Needs research"} />
              <InfoRow label="Phone" value={builder?.contact.phone ?? "Needs research"} />
              <InfoRow label="Website" value={builder?.contact.website ?? "Needs research"} />
              <InfoRow label="Open lots" value={String(builder?.openOpportunities ?? 1)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <p className="eyebrow-label">Internal notes</p>
                <CardTitle className="mt-2">Notes</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-white/62">
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
    <div className="min-w-0 rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
      <p className="data-label">{label}</p>
      <p className="data-value mt-2">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-3 last:border-0 last:pb-0">
      <p className="data-label">{label}</p>
      <p className="max-w-[60%] text-right text-sm text-white/86">{value}</p>
    </div>
  );
}
