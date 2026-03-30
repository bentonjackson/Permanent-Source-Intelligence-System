"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Copy,
  Mail,
  Phone,
  Plus,
  Save,
  Trash2
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useOpportunityActions } from "@/components/opportunities/use-opportunity-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOpportunityEntityPresentation } from "@/lib/entities/contact-identity";
import { COUNTIES_NEAR_ME_LABEL } from "@/lib/geo/territories";
import { formatDate } from "@/lib/utils";
import {
  ActivityDirection,
  ActivityType,
  OpportunityContact,
  OpportunityInterestStatus,
  PipelineStage,
  PlotOpportunity,
  PreferredContactMethod
} from "@/types/domain";

type SortMode = "next_follow_up" | "last_contacted" | "outreach";

interface ContactDraft {
  fullName: string;
  roleTitle: string;
  companyName: string;
  email: string;
  phone: string;
  mobilePhone: string;
  officePhone: string;
  website: string;
  linkedinUrl: string;
  preferredContactMethod: PreferredContactMethod | "";
  bestTimeToContact: string;
  notes: string;
  isPrimary: boolean;
}

interface ActivityDraft {
  activityType: ActivityType;
  activityDirection: ActivityDirection;
  occurredAt: string;
  contactId: string;
  outcome: string;
  note: string;
  nextFollowUpAt: string;
}

interface StatusDraft {
  assignedMembershipId: string;
  interestStatus: OpportunityInterestStatus;
  nextFollowUpAt: string;
  followUpNeeded: boolean;
  internalNotes: string;
}

function isoLocalDateTime(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function nextFollowUpLabel(opportunity: PlotOpportunity) {
  return opportunity.nextFollowUpAt ?? opportunity.nextFollowUpDate ?? opportunity.suggestedFollowUpDate ?? null;
}

function formatStage(value: PipelineStage) {
  return value;
}

function formatInterest(value: OpportunityInterestStatus) {
  return value.replaceAll("_", " ");
}

function buildContactDraft(opportunity: PlotOpportunity, contact?: OpportunityContact | null): ContactDraft {
  return {
    fullName: contact?.fullName ?? "",
    roleTitle: contact?.roleTitle ?? "",
    companyName: contact?.companyName ?? opportunity.legalEntityName ?? opportunity.builderName ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    mobilePhone: contact?.mobilePhone ?? "",
    officePhone: contact?.officePhone ?? "",
    website: contact?.website ?? opportunity.website ?? "",
    linkedinUrl: contact?.linkedinUrl ?? "",
    preferredContactMethod: contact?.preferredContactMethod ?? "",
    bestTimeToContact: contact?.bestTimeToContact ?? "",
    notes: contact?.notes ?? "",
    isPrimary: contact?.isPrimary ?? opportunity.contacts.length === 0
  };
}

function contactDraftToPayload(values: ContactDraft) {
  return {
    fullName: values.fullName,
    roleTitle: values.roleTitle,
    companyName: values.companyName,
    email: values.email,
    phone: values.phone,
    mobilePhone: values.mobilePhone,
    officePhone: values.officePhone,
    website: values.website,
    linkedinUrl: values.linkedinUrl,
    preferredContactMethod: values.preferredContactMethod || null,
    bestTimeToContact: values.bestTimeToContact,
    notes: values.notes,
    isPrimary: values.isPrimary
  };
}

function buildActivityDraft(opportunity: PlotOpportunity): ActivityDraft {
  return {
    activityType: "called",
    activityDirection: "outbound",
    occurredAt: isoLocalDateTime(new Date().toISOString()),
    contactId: opportunity.contacts.find((contact) => contact.isPrimary)?.id ?? "",
    outcome: "",
    note: "",
    nextFollowUpAt: isoLocalDateTime(nextFollowUpLabel(opportunity))
  };
}

function buildStatusDraft(opportunity: PlotOpportunity): StatusDraft {
  return {
    assignedMembershipId: opportunity.assignedMembershipId ?? "",
    interestStatus: opportunity.interestStatus,
    nextFollowUpAt: isoLocalDateTime(nextFollowUpLabel(opportunity)),
    followUpNeeded: opportunity.followUpNeeded || opportunity.needsFollowUp,
    internalNotes: opportunity.internalNotes ?? opportunity.notes.join("\n")
  };
}

function primaryContactFor(opportunity: PlotOpportunity) {
  return opportunity.contacts.find((contact) => contact.isPrimary) ?? opportunity.contacts[0] ?? null;
}

function quickCopy(value: string | null | undefined) {
  if (!value || typeof navigator === "undefined" || !navigator.clipboard) {
    return;
  }

  void navigator.clipboard.writeText(value);
}

export function ContactedLeadsBoard({
  opportunities,
  counties,
  selectedCounty,
  reps
}: {
  opportunities: PlotOpportunity[];
  counties: string[];
  selectedCounty: string;
  reps: Array<{ id: string; displayName: string; email: string | null }>;
}) {
  const {
    addContact,
    assignRep,
    deleteContact,
    error,
    logActivity,
    pendingKey,
    updateContact,
    updateWorkflow
  } = useOpportunityActions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>("next_follow_up");
  const [contactEditor, setContactEditor] = useState<{
    opportunityId: string;
    contactId: string | null;
    values: ContactDraft;
  } | null>(null);
  const [activityDrafts, setActivityDrafts] = useState<Record<string, ActivityDraft>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, StatusDraft>>({});

  useEffect(() => {
    setActivityDrafts(
      Object.fromEntries(opportunities.map((opportunity) => [opportunity.id, buildActivityDraft(opportunity)]))
    );
    setStatusDrafts(
      Object.fromEntries(opportunities.map((opportunity) => [opportunity.id, buildStatusDraft(opportunity)]))
    );
  }, [opportunities]);

  function updateCounty(county: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (!county || county === COUNTIES_NEAR_ME_LABEL) {
      params.delete("county");
    } else {
      params.set("county", county);
    }

    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  const sortedOpportunities = useMemo(() => {
    return [...opportunities].sort((left, right) => {
      if (sortBy === "last_contacted") {
        return (right.lastContactedAt ?? "").localeCompare(left.lastContactedAt ?? "");
      }

      if (sortBy === "outreach") {
        return right.outreachCount - left.outreachCount;
      }

      return (left.nextFollowUpAt ?? left.nextFollowUpDate ?? left.suggestedFollowUpDate ?? "9999-12-31").localeCompare(
        right.nextFollowUpAt ?? right.nextFollowUpDate ?? right.suggestedFollowUpDate ?? "9999-12-31"
      );
    });
  }, [opportunities, sortBy]);

  async function handleQuickActivity(opportunity: PlotOpportunity, activityType: ActivityType) {
    const primaryContact = primaryContactFor(opportunity);

    await logActivity(opportunity.id, {
      activityType,
      activityDirection: activityType === "received_email" ? "inbound" : "outbound",
      occurredAt: new Date().toISOString(),
      contactId: primaryContact?.id ?? null,
      note:
        activityType === "called"
          ? "Quick call logged from Contacted."
          : activityType === "sent_email"
            ? "Quick email logged from Contacted."
            : "Quick outreach logged from Contacted."
    });
  }

  async function handleQuickFollowUp(opportunity: PlotOpportunity) {
    const nextFollowUp = addDaysLocal(2);

    await updateWorkflow(opportunity.id, {
      nextFollowUpAt: nextFollowUp,
      nextFollowUpDate: nextFollowUp,
      followUpNeeded: true,
      needsFollowUp: true,
      currentStage: "Contacted"
    });
  }

  async function handleOutcome(opportunity: PlotOpportunity, outcome: "won" | "lost") {
    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(
            outcome === "won"
              ? "Confirm this card as awarded?"
              : "Confirm this card as not awarded?"
          );

    if (!confirmed) {
      return;
    }

    await updateWorkflow(opportunity.id, {
      bidStatus: outcome,
      currentStage: outcome === "won" ? "Won" : "Lost",
      outcomeStatus: outcome,
      followUpNeeded: false,
      needsFollowUp: false,
      closedAt: new Date().toISOString()
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Card className="border-red-500/28 bg-red-500/10">
          <CardContent className="p-4 text-sm text-red-100">{error}</CardContent>
        </Card>
      ) : null}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <p className="eyebrow-label">County</p>
              <select
                className="mt-2 h-10 w-full rounded-md border border-white/12 bg-white/[0.04] px-3 text-sm text-white"
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
              <p className="eyebrow-label">Sort</p>
              <select
                className="mt-2 h-10 w-full rounded-md border border-white/12 bg-white/[0.04] px-3 text-sm text-white"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortMode)}
              >
                <option value="next_follow_up">Next follow-up</option>
                <option value="last_contacted">Last contacted</option>
                <option value="outreach">Most outreach</option>
              </select>
            </div>
          </div>
          <div className="text-sm text-white/56">
            <p className="font-serif text-xl tracking-[-0.03em] text-white">{sortedOpportunities.length} active contacted leads</p>
            <p className="mt-2">Everything shown here is read from Postgres and stays after refreshes or future syncs.</p>
          </div>
        </CardContent>
      </Card>
      {sortedOpportunities.length ? (
        sortedOpportunities.map((opportunity) => {
          const expanded = expandedId === opportunity.id;
          const entity = getOpportunityEntityPresentation(opportunity);
          const primaryContact = primaryContactFor(opportunity);
          const lastActivity = opportunity.activities[0] ?? null;
          const statusDraft = statusDrafts[opportunity.id] ?? buildStatusDraft(opportunity);
          const activityDraft = activityDrafts[opportunity.id] ?? buildActivityDraft(opportunity);

          return (
            <Card key={opportunity.id}>
              <CardHeader className="gap-0 p-0">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 rounded-[18px] px-5 py-4 text-left transition-colors duration-200 hover:bg-white/[0.04]"
                  onClick={() => setExpandedId((current) => (current === opportunity.id ? null : opportunity.id))}
                  aria-label={expanded ? "Collapse details" : "Expand details"}
                >
                  <div className="min-w-0 flex-1">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] lg:items-start">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-[1.18rem]">{entity.displayName}</CardTitle>
                        <p className="mt-2 break-words text-sm text-white/82">
                          {opportunity.address || "Address pending"}
                        </p>
                        <p className="mt-1 break-words text-sm text-white/46">
                          {[opportunity.city, opportunity.county].filter(Boolean).join(", ")}
                          {opportunity.parcelNumber ? ` • Parcel ${opportunity.parcelNumber}` : ""}
                          {opportunity.lotNumber ? ` • Lot ${opportunity.lotNumber}` : ""}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="data-label">Primary contact</p>
                        <p className="mt-2 break-words text-sm font-medium text-white/88">
                          {primaryContact?.fullName ?? "No contact stored"}
                        </p>
                        <p className="mt-2 break-words text-sm text-white/56">
                          {primaryContact?.phone ?? primaryContact?.mobilePhone ?? opportunity.phone ?? "Phone needed"}
                        </p>
                        <p className="mt-1 break-words text-sm text-white/42">
                          {primaryContact?.email ?? opportunity.email ?? "Email needed"}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="data-label">Workspace status</p>
                        <p className="mt-2 text-sm font-medium text-white/88">
                          Last contact {formatDate(opportunity.lastContactedAt ?? opportunity.contactedAt)}
                        </p>
                        <p className="mt-1 text-sm text-white/56">
                          Next follow-up {formatDate(nextFollowUpLabel(opportunity))}
                        </p>
                        <p className="mt-1 text-sm text-white/42">
                          {formatInterest(opportunity.interestStatus)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={opportunity.followUpNeeded || opportunity.needsFollowUp ? "red" : "slate"}>
                      {opportunity.followUpNeeded || opportunity.needsFollowUp ? "Follow-up due" : "Working"}
                    </Badge>
                    {expanded ? <ChevronUp className="h-5 w-5 text-white/56" /> : <ChevronDown className="h-5 w-5 text-white/56" />}
                  </div>
                </button>
              </CardHeader>
              {expanded ? (
                <CardContent className="space-y-5 animate-[panel-in_220ms_ease-out]">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <Summary label="Primary contact" value={primaryContact?.fullName ?? "No contact yet"} />
                    <Summary
                      label="Best phone"
                      value={primaryContact?.phone ?? primaryContact?.mobilePhone ?? opportunity.phone ?? "Needs research"}
                    />
                    <Summary label="Best email" value={primaryContact?.email ?? opportunity.email ?? "Needs research"} />
                    <Summary label="Last contact" value={formatDate(opportunity.lastContactedAt ?? opportunity.contactedAt)} />
                    <Summary label="Assigned rep" value={opportunity.assignedRep} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8"
                      disabled={pendingKey === `activity:${opportunity.id}`}
                      onClick={() => void handleQuickActivity(opportunity, "called")}
                    >
                      Log Call
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8"
                      disabled={pendingKey === `activity:${opportunity.id}`}
                      onClick={() => void handleQuickActivity(opportunity, "sent_email")}
                    >
                      Log Email
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8"
                      disabled={pendingKey === `workflow:${opportunity.id}`}
                      onClick={() => void handleQuickFollowUp(opportunity)}
                    >
                      Schedule Follow-Up
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8"
                      disabled={pendingKey === `workflow:${opportunity.id}`}
                      onClick={() =>
                        void updateWorkflow(opportunity.id, {
                          interestStatus: "interested",
                          contactStatus: "Interested"
                        })
                      }
                    >
                      Mark Interested
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8"
                      disabled={pendingKey === `workflow:${opportunity.id}`}
                      onClick={() =>
                        void updateWorkflow(opportunity.id, {
                          interestStatus: "not_interested",
                          contactStatus: "Not interested"
                        })
                      }
                    >
                      Not Interested
                    </Button>
                    <Button
                      type="button"
                      className="h-8"
                      disabled={pendingKey === `workflow:${opportunity.id}`}
                      onClick={() => void handleOutcome(opportunity, "won")}
                    >
                      Move to Won
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 border-red-500/32 text-red-100 hover:bg-red-500/12"
                      disabled={pendingKey === `workflow:${opportunity.id}`}
                      onClick={() => void handleOutcome(opportunity, "lost")}
                    >
                      Move to Lost
                    </Button>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                    <CardSection title="Lead Summary">
                      <InfoRow label="Preferred sales name" value={entity.displayName} />
                      <InfoRow label="Legal entity" value={opportunity.legalEntityName ?? "Unknown"} />
                      <InfoRow label="Role / confidence" value={`${opportunity.roleType.replaceAll("_", " ")} • ${opportunity.entityConfidenceScore}`} />
                      <InfoRow label="Contact quality" value={`${opportunity.contactQualityBand.replaceAll("_", " ")} • ${opportunity.contactQualityScore}`} />
                      <InfoRow label="Source" value={`${opportunity.sourceJurisdiction} • ${opportunity.sourceName}`} />
                      <InfoRow label="Value" value={formatCurrency(opportunity.estimatedProjectValue ?? opportunity.improvementValue ?? opportunity.landValue)} />
                      <InfoRow label="Last action" value={lastActivity ? `${lastActivity.activityType.replaceAll("_", " ")} • ${formatDate(lastActivity.occurredAt)}` : "No outreach logged yet"} />
                    </CardSection>
                    <CardSection title="Workflow">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Assigned rep">
                          <select
                            value={statusDraft.assignedMembershipId}
                            onChange={(event) =>
                              setStatusDrafts((current) => ({
                                ...current,
                                [opportunity.id]: {
                                  ...statusDraft,
                                  assignedMembershipId: event.target.value
                                }
                              }))
                            }
                          >
                            {reps.map((rep) => (
                              <option key={rep.id || "open-territory"} value={rep.id}>
                                {rep.displayName}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Interest status">
                          <select
                            value={statusDraft.interestStatus}
                            onChange={(event) =>
                              setStatusDrafts((current) => ({
                                ...current,
                                [opportunity.id]: {
                                  ...statusDraft,
                                  interestStatus: event.target.value as OpportunityInterestStatus
                                }
                              }))
                            }
                          >
                            {["unknown", "interested", "not_interested", "quote_requested", "quote_sent"].map((value) => (
                              <option key={value} value={value}>
                                {formatInterest(value as OpportunityInterestStatus)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Next follow-up">
                          <input
                            type="datetime-local"
                            value={statusDraft.nextFollowUpAt}
                            onChange={(event) =>
                              setStatusDrafts((current) => ({
                                ...current,
                                [opportunity.id]: {
                                  ...statusDraft,
                                  nextFollowUpAt: event.target.value
                                }
                              }))
                            }
                          />
                        </Field>
                        <Field label="Follow-up needed">
                          <select
                            value={statusDraft.followUpNeeded ? "yes" : "no"}
                            onChange={(event) =>
                              setStatusDrafts((current) => ({
                                ...current,
                                [opportunity.id]: {
                                  ...statusDraft,
                                  followUpNeeded: event.target.value === "yes"
                                }
                              }))
                            }
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </Field>
                      </div>
                      <div className="mt-4 grid gap-4">
                        <Field label="Comments">
                          <textarea
                            className="min-h-[110px]"
                            value={statusDraft.internalNotes}
                            onChange={(event) =>
                              setStatusDrafts((current) => ({
                                ...current,
                                [opportunity.id]: {
                                  ...statusDraft,
                                  internalNotes: event.target.value
                                }
                              }))
                            }
                          />
                        </Field>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            disabled={pendingKey === `workflow:${opportunity.id}`}
                            onClick={async () => {
                              const selectedRep = reps.find((rep) => rep.id === statusDraft.assignedMembershipId);

                              if (selectedRep) {
                                await assignRep(opportunity.id, statusDraft.assignedMembershipId || null);
                              }

                              await updateWorkflow(opportunity.id, {
                                assignedMembershipId: statusDraft.assignedMembershipId || null,
                                interestStatus: statusDraft.interestStatus,
                                nextFollowUpAt: localInputToIso(statusDraft.nextFollowUpAt),
                                nextFollowUpDate: localInputToIso(statusDraft.nextFollowUpAt),
                                followUpNeeded: statusDraft.followUpNeeded,
                                needsFollowUp: statusDraft.followUpNeeded,
                                internalNotes: statusDraft.internalNotes || null
                              });
                            }}
                          >
                            <Save className="mr-2 h-4 w-4" />
                            Save Comments
                          </Button>
                          <Button type="button" variant="outline" onClick={() => void router.push(`/opportunities/${opportunity.id}`)}>
                            Open Full Record
                          </Button>
                        </div>
                      </div>
                    </CardSection>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                    <CardSection title="Contacts">
                      <div className="space-y-3">
                        {opportunity.contacts.length ? (
                          opportunity.contacts.map((contact) => (
                            <div key={contact.id} className="rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium text-white">{contact.fullName ?? "Unnamed contact"}</p>
                                    {contact.isPrimary ? <Badge tone="green">Primary</Badge> : null}
                                  </div>
                                  <p className="text-sm text-white/56">
                                    {[contact.roleTitle, contact.companyName].filter(Boolean).join(" • ") || "Contact record"}
                                  </p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/34">
                                    Confidence {contact.confidenceScore} • {contact.qualityBand.replaceAll("_", " ")}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {contact.phone ? (
                                    <Button type="button" variant="outline" className="h-8 px-3" onClick={() => quickCopy(contact.phone)}>
                                      <Copy className="mr-2 h-3.5 w-3.5" />
                                      Copy Phone
                                    </Button>
                                  ) : null}
                                  {contact.email ? (
                                    <Button type="button" variant="outline" className="h-8 px-3" onClick={() => quickCopy(contact.email)}>
                                      <Copy className="mr-2 h-3.5 w-3.5" />
                                      Copy Email
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 px-3"
                                    onClick={() =>
                                      setContactEditor({
                                        opportunityId: opportunity.id,
                                        contactId: contact.id,
                                        values: buildContactDraft(opportunity, contact)
                                      })
                                    }
                                  >
                                    Edit
                                  </Button>
                                  {!contact.isPrimary ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-8 px-3"
                                      disabled={pendingKey === `contact:update:${contact.id}`}
                                      onClick={() => void updateContact(contact.id, { isPrimary: true })}
                                    >
                                      Mark Primary
                                    </Button>
                                  ) : null}
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-8 border-red-500/32 px-3 text-red-100 hover:bg-red-500/12"
                                    disabled={pendingKey === `contact:delete:${contact.id}`}
                                    onClick={() => void deleteContact(contact.id)}
                                  >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                    Delete
                                  </Button>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/72">
                                {contact.phone ? (
                                  <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-2 text-red-200 hover:text-white">
                                    <Phone className="h-4 w-4" />
                                    {contact.phone}
                                  </a>
                                ) : null}
                                {contact.email ? (
                                  <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2 text-red-200 hover:text-white">
                                    <Mail className="h-4 w-4" />
                                    {contact.email}
                                  </a>
                                ) : null}
                                {contact.website ? (
                                  <a href={contact.website} target="_blank" rel="noreferrer" className="text-red-200 hover:text-white">
                                    {contact.website}
                                  </a>
                                ) : null}
                              </div>
                              {contact.notes ? <p className="mt-3 text-sm text-white/56">{contact.notes}</p> : null}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-white/56">No stored contacts yet. Add one so this lead is easier to work every day.</p>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setContactEditor({
                              opportunityId: opportunity.id,
                              contactId: null,
                              values: buildContactDraft(opportunity)
                            })
                          }
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Contact
                        </Button>
                      </div>
                      {contactEditor?.opportunityId === opportunity.id ? (
                        <form
                          className="mt-4 rounded-[14px] border border-white/10 bg-white/[0.03] p-4"
                          onSubmit={async (event) => {
                            event.preventDefault();

                            if (contactEditor.contactId) {
                              await updateContact(contactEditor.contactId, contactDraftToPayload(contactEditor.values));
                            } else {
                              await addContact(opportunity.id, contactDraftToPayload(contactEditor.values));
                            }

                            setContactEditor(null);
                          }}
                        >
                          <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Full name">
                              <input
                                value={contactEditor.values.fullName}
                                onChange={(event) =>
                                  setContactEditor((current) =>
                                    current
                                      ? {
                                          ...current,
                                          values: {
                                            ...current.values,
                                            fullName: event.target.value
                                          }
                                        }
                                      : current
                                  )
                                }
                              />
                            </Field>
                            <Field label="Title">
                              <input
                                value={contactEditor.values.roleTitle}
                                onChange={(event) =>
                                  setContactEditor((current) =>
                                    current
                                      ? {
                                          ...current,
                                          values: {
                                            ...current.values,
                                            roleTitle: event.target.value
                                          }
                                        }
                                      : current
                                  )
                                }
                              />
                            </Field>
                            <Field label="Company">
                              <input
                                value={contactEditor.values.companyName}
                                onChange={(event) =>
                                  setContactEditor((current) =>
                                    current
                                      ? {
                                          ...current,
                                          values: {
                                            ...current.values,
                                            companyName: event.target.value
                                          }
                                        }
                                      : current
                                  )
                                }
                              />
                            </Field>
                            <Field label="Phone">
                              <input
                                value={contactEditor.values.phone}
                                onChange={(event) =>
                                  setContactEditor((current) =>
                                    current
                                      ? {
                                          ...current,
                                          values: {
                                            ...current.values,
                                            phone: event.target.value
                                          }
                                        }
                                      : current
                                  )
                                }
                              />
                            </Field>
                            <Field label="Mobile">
                              <input
                                value={contactEditor.values.mobilePhone}
                                onChange={(event) =>
                                  setContactEditor((current) =>
                                    current
                                      ? {
                                          ...current,
                                          values: {
                                            ...current.values,
                                            mobilePhone: event.target.value
                                          }
                                        }
                                      : current
                                  )
                                }
                              />
                            </Field>
                            <Field label="Office">
                              <input
                                value={contactEditor.values.officePhone}
                                onChange={(event) =>
                                  setContactEditor((current) =>
                                    current
                                      ? {
                                          ...current,
                                          values: {
                                            ...current.values,
                                            officePhone: event.target.value
                                          }
                                        }
                                      : current
                                  )
                                }
                              />
                            </Field>
                            <Field label="Email">
                              <input
                                value={contactEditor.values.email}
                                onChange={(event) =>
                                  setContactEditor((current) =>
                                    current
                                      ? {
                                          ...current,
                                          values: {
                                            ...current.values,
                                            email: event.target.value
                                          }
                                        }
                                      : current
                                  )
                                }
                              />
                            </Field>
                            <Field label="Website">
                              <input
                                value={contactEditor.values.website}
                                onChange={(event) =>
                                  setContactEditor((current) =>
                                    current
                                      ? {
                                          ...current,
                                          values: {
                                            ...current.values,
                                            website: event.target.value
                                          }
                                        }
                                      : current
                                  )
                                }
                              />
                            </Field>
                            <Field label="Preferred method">
                              <select
                                value={contactEditor.values.preferredContactMethod}
                                onChange={(event) =>
                                  setContactEditor((current) =>
                                    current
                                      ? {
                                          ...current,
                                          values: {
                                            ...current.values,
                                            preferredContactMethod: event.target.value as PreferredContactMethod | ""
                                          }
                                        }
                                      : current
                                  )
                                }
                              >
                                <option value="">Not set</option>
                                {["call", "email", "text", "website", "linkedin", "other"].map((method) => (
                                  <option key={method} value={method}>
                                    {method}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Best time">
                              <input
                                value={contactEditor.values.bestTimeToContact}
                                onChange={(event) =>
                                  setContactEditor((current) =>
                                    current
                                      ? {
                                          ...current,
                                          values: {
                                            ...current.values,
                                            bestTimeToContact: event.target.value
                                          }
                                        }
                                      : current
                                  )
                                }
                              />
                            </Field>
                          </div>
                          <Field className="mt-4" label="Notes">
                            <textarea
                              className="min-h-[90px]"
                              value={contactEditor.values.notes}
                              onChange={(event) =>
                                setContactEditor((current) =>
                                  current
                                    ? {
                                        ...current,
                                        values: {
                                          ...current.values,
                                          notes: event.target.value
                                        }
                                      }
                                    : current
                                )
                              }
                            />
                          </Field>
                          <label className="mt-4 inline-flex items-center gap-2 text-sm text-white/68">
                            <input
                              type="checkbox"
                              checked={contactEditor.values.isPrimary}
                              onChange={(event) =>
                                setContactEditor((current) =>
                                  current
                                    ? {
                                        ...current,
                                        values: {
                                          ...current.values,
                                          isPrimary: event.target.checked
                                        }
                                      }
                                    : current
                                )
                              }
                            />
                            Mark as primary contact
                          </label>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button type="submit">
                              <Save className="mr-2 h-4 w-4" />
                              Save Contact
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setContactEditor(null)}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : null}
                    </CardSection>

                    <CardSection title="Activity & Follow-Up">
                      <form
                        className="rounded-[14px] border border-white/10 bg-white/[0.03] p-4"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          await logActivity(opportunity.id, {
                            activityType: activityDraft.activityType,
                            activityDirection: activityDraft.activityDirection,
                            occurredAt: localInputToIso(activityDraft.occurredAt),
                            contactId: activityDraft.contactId || null,
                            outcome: activityDraft.outcome || null,
                            note: activityDraft.note || null,
                            nextFollowUpAt: localInputToIso(activityDraft.nextFollowUpAt)
                          });
                        }}
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Activity type">
                            <select
                              value={activityDraft.activityType}
                              onChange={(event) =>
                                setActivityDrafts((current) => ({
                                  ...current,
                                  [opportunity.id]: {
                                    ...activityDraft,
                                    activityType: event.target.value as ActivityType
                                  }
                                }))
                              }
                            >
                              {[
                                "called",
                                "left_voicemail",
                                "sent_email",
                                "received_email",
                                "texted",
                                "met",
                                "quote_discussed",
                                "follow_up_scheduled",
                                "note_added",
                                "status_changed"
                              ].map((type) => (
                                <option key={type} value={type}>
                                  {type.replaceAll("_", " ")}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Direction">
                            <select
                              value={activityDraft.activityDirection}
                              onChange={(event) =>
                                setActivityDrafts((current) => ({
                                  ...current,
                                  [opportunity.id]: {
                                    ...activityDraft,
                                    activityDirection: event.target.value as ActivityDirection
                                  }
                                }))
                              }
                            >
                              {["outbound", "inbound", "internal"].map((direction) => (
                                <option key={direction} value={direction}>
                                  {direction}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Occurred at">
                            <input
                              type="datetime-local"
                              value={activityDraft.occurredAt}
                              onChange={(event) =>
                                setActivityDrafts((current) => ({
                                  ...current,
                                  [opportunity.id]: {
                                    ...activityDraft,
                                    occurredAt: event.target.value
                                  }
                                }))
                              }
                            />
                          </Field>
                          <Field label="Related contact">
                            <select
                              value={activityDraft.contactId}
                              onChange={(event) =>
                                setActivityDrafts((current) => ({
                                  ...current,
                                  [opportunity.id]: {
                                    ...activityDraft,
                                    contactId: event.target.value
                                  }
                                }))
                              }
                            >
                              <option value="">No linked contact</option>
                              {opportunity.contacts.map((contact) => (
                                <option key={contact.id} value={contact.id}>
                                  {contact.fullName ?? "Unnamed contact"}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Outcome">
                            <input
                              value={activityDraft.outcome}
                              onChange={(event) =>
                                setActivityDrafts((current) => ({
                                  ...current,
                                  [opportunity.id]: {
                                    ...activityDraft,
                                    outcome: event.target.value
                                  }
                                }))
                              }
                            />
                          </Field>
                          <Field label="Next follow-up">
                            <input
                              type="datetime-local"
                              value={activityDraft.nextFollowUpAt}
                              onChange={(event) =>
                                setActivityDrafts((current) => ({
                                  ...current,
                                  [opportunity.id]: {
                                    ...activityDraft,
                                    nextFollowUpAt: event.target.value
                                  }
                                }))
                              }
                            />
                          </Field>
                        </div>
                        <Field className="mt-4" label="Note">
                          <textarea
                            className="min-h-[90px]"
                            value={activityDraft.note}
                            onChange={(event) =>
                              setActivityDrafts((current) => ({
                                ...current,
                                [opportunity.id]: {
                                  ...activityDraft,
                                  note: event.target.value
                                }
                              }))
                            }
                          />
                        </Field>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            type="submit"
                            disabled={pendingKey === `activity:${opportunity.id}`}
                          >
                            <CalendarClock className="mr-2 h-4 w-4" />
                            Log Outreach
                          </Button>
                        </div>
                      </form>
                      <div className="mt-4 space-y-3">
                        {opportunity.activities.length ? (
                          opportunity.activities.map((activity) => (
                            <div key={activity.id} className="rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-white">{activity.activityType.replaceAll("_", " ")}</p>
                                  <p className="text-sm text-white/56">
                                    {formatDate(activity.occurredAt)} • {activity.activityDirection}
                                    {activity.createdBy ? ` • ${activity.createdBy}` : ""}
                                  </p>
                                </div>
                                {activity.outcome ? <Badge tone="slate">{activity.outcome}</Badge> : null}
                              </div>
                              {activity.note ? <p className="mt-3 text-sm text-white/70">{activity.note}</p> : null}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-white/56">No outreach history stored yet.</p>
                        )}
                      </div>
                    </CardSection>
                  </div>
                </CardContent>
              ) : null}
            </Card>
          );
        })
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-white/56">
            No contacted jobs matched the current county filter yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function addDaysLocal(days: number) {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function localInputToIso(value: string | null | undefined) {
  return value ? new Date(value).toISOString() : null;
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="data-label">{label}</p>
      <p className="data-value mt-2">{value}</p>
    </div>
  );
}

function CardSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-[16px] border border-white/10 bg-white/[0.03] p-4 shadow-panel">
      <p className="eyebrow-label">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] items-start gap-3 border-b border-white/8 py-2 last:border-b-0">
      <p className="text-sm text-white/42">{label}</p>
      <p className="min-w-0 break-words text-left text-sm font-medium leading-snug text-white/90">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
  className = ""
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field-shell ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

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
