"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  ActivityDirection,
  ActivityType,
  OpportunityInterestStatus,
  OpportunityOutcomeStatus,
  PipelineStage,
  PreferredContactMethod
} from "@/types/domain";

type ContactMutationPayload = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  roleTitle?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  officePhone?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  preferredContactMethod?: PreferredContactMethod | null;
  bestTimeToContact?: string | null;
  notes?: string | null;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  confidenceScore?: number | null;
  isPrimary?: boolean;
};

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.detail ?? data?.error ?? "Request failed.");
  }

  return data;
}

export function useOpportunityActions() {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction<T>(key: string, action: () => Promise<T>) {
    setPendingKey(key);
    setError(null);

    try {
      const result = await action();
      router.refresh();
      return result;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Request failed.");
      throw caughtError;
    } finally {
      setPendingKey(null);
    }
  }

  return {
    pendingKey,
    error,
    clearError() {
      setError(null);
    },
    moveToContacted(opportunityId: string, assignedMembershipId?: string) {
      return runAction(`move:${opportunityId}`, async () =>
        readJson(
          await fetch(`/api/opportunities/${opportunityId}/move-to-contacted`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              assignedMembershipId: assignedMembershipId || null
            })
          })
        )
      );
    },
    updateWorkflow(
      opportunityId: string,
      payload: {
        assignedMembershipId?: string | null;
        currentStage?: PipelineStage | null;
        bidStatus?: string | null;
        contactedAt?: string | null;
        lastContactedAt?: string | null;
        nextFollowUpAt?: string | null;
        followUpNeeded?: boolean;
        interestStatus?: OpportunityInterestStatus | null;
        outcomeStatus?: OpportunityOutcomeStatus | null;
        contactSummary?: string | null;
        notesSummary?: string | null;
        reasonLost?: string | null;
        internalNotes?: string | null;
        externalSummary?: string | null;
        quoteRequestedAt?: string | null;
        quoteSentAt?: string | null;
        nextAction?: string | null;
        nextFollowUpDate?: string | null;
        contactStatus?: string | null;
        inquiredAt?: string | null;
        needsFollowUp?: boolean;
        suggestedFollowUpDate?: string | null;
        secondFollowUpDate?: string | null;
        followedUpOn?: string | null;
        closedAt?: string | null;
      }
    ) {
      return runAction(`workflow:${opportunityId}`, async () =>
        readJson(
          await fetch(`/api/opportunities/${opportunityId}/workflow`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          })
        )
      );
    },
    assignRep(opportunityId: string, assignedMembershipId: string | null) {
      return runAction(`assign:${opportunityId}`, async () =>
        readJson(
          await fetch(`/api/opportunities/${opportunityId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              assignedMembershipId
            })
          })
        )
      );
    },
    markNotFit(opportunityId: string) {
      return runAction(`not-fit:${opportunityId}`, async () =>
        readJson(
          await fetch(`/api/opportunities/${opportunityId}/workflow`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              bidStatus: "not_a_fit",
              currentStage: "Not a Fit",
              outcomeStatus: "not_a_fit",
              followUpNeeded: false,
              needsFollowUp: false,
              closedAt: new Date().toISOString(),
              nextAction: "No further action needed."
            })
          })
        )
      );
    },
    addContact(
      opportunityId: string,
      payload: ContactMutationPayload
    ) {
      return runAction(`contact:add:${opportunityId}`, async () =>
        readJson(
          await fetch(`/api/opportunities/${opportunityId}/contacts`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          })
        )
      );
    },
    updateContact(contactId: string, payload: ContactMutationPayload) {
      return runAction(`contact:update:${contactId}`, async () =>
        readJson(
          await fetch(`/api/contacts/${contactId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          })
        )
      );
    },
    deleteContact(contactId: string) {
      return runAction(`contact:delete:${contactId}`, async () =>
        readJson(
          await fetch(`/api/contacts/${contactId}`, {
            method: "DELETE"
          })
        )
      );
    },
    logActivity(
      opportunityId: string,
      payload: {
        contactId?: string | null;
        activityType: ActivityType;
        activityDirection?: ActivityDirection | null;
        occurredAt?: string | null;
        outcome?: string | null;
        note?: string | null;
        nextFollowUpAt?: string | null;
        interestStatus?: OpportunityInterestStatus | null;
        outcomeStatus?: OpportunityOutcomeStatus | null;
      }
    ) {
      return runAction(`activity:${opportunityId}`, async () =>
        readJson(
          await fetch(`/api/opportunities/${opportunityId}/activities`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          })
        )
      );
    }
  };
}
