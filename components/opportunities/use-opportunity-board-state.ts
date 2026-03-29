"use client";

import { useEffect, useMemo, useState } from "react";

import { PlotOpportunity } from "@/types/domain";

const storageKey = "psis-opportunity-board-state";

export interface OpportunityBoardEntry {
  bidStatus: PlotOpportunity["bidStatus"];
  inquiredAt: string;
  needsFollowUp: boolean;
  suggestedFollowUpDate: string;
  secondFollowUpDate: string;
  followedUpOn: string;
  closedAt: string;
  notes: string;
}

function buildInitialState(opportunities: PlotOpportunity[]) {
  return Object.fromEntries(
    opportunities.map((opportunity) => [
      opportunity.id,
        {
          bidStatus: opportunity.bidStatus,
          inquiredAt: opportunity.inquiredAt ?? "",
          needsFollowUp: opportunity.needsFollowUp,
          suggestedFollowUpDate: opportunity.suggestedFollowUpDate ?? "",
          secondFollowUpDate: opportunity.secondFollowUpDate ?? "",
          followedUpOn: opportunity.followedUpOn ?? "",
          closedAt: opportunity.closedAt ?? "",
          notes: opportunity.notes.join("\n")
        }
    ])
  ) as Record<string, OpportunityBoardEntry>;
}

async function persistEntry(id: string, patch: Partial<OpportunityBoardEntry>) {
  try {
    await fetch(`/api/opportunities/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patch)
    });
  } catch {
    // Keep local optimistic state even if persistence is unavailable in the current environment.
  }
}

export function useOpportunityBoardState(opportunities: PlotOpportunity[]) {
  const [state, setState] = useState<Record<string, OpportunityBoardEntry>>(() => buildInitialState(opportunities));

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const persisted = JSON.parse(raw) as Record<string, Partial<OpportunityBoardEntry>>;
      setState((current) => {
        const next = buildInitialState(opportunities);

        for (const [id, entry] of Object.entries(persisted)) {
          if (!next[id]) continue;
          next[id] = {
            ...next[id],
            ...entry
          };
        }

        return { ...current, ...next };
      });
    } catch {
      // Ignore malformed local data and continue with seeded defaults.
    }
  }, [opportunities]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  const merged = useMemo(
    () =>
      opportunities.map((opportunity) => ({
        ...opportunity,
        ...state[opportunity.id],
        notes: (state[opportunity.id]?.notes ?? "").split("\n").filter(Boolean)
      })),
    [opportunities, state]
  );

  function updateEntry(id: string, patch: Partial<OpportunityBoardEntry>) {
    setState((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch
      }
    }));
    void persistEntry(id, patch);
  }

  function setOutcome(id: string, outcome: "won" | "lost") {
    const closedAt = new Date().toISOString();
    setState((current) => ({
      ...current,
      [id]: {
        ...current[id],
        bidStatus: outcome,
        needsFollowUp: false,
        closedAt
      }
    }));
    void persistEntry(id, {
      bidStatus: outcome,
      needsFollowUp: false,
      closedAt
    });
  }

  function markContacted(id: string) {
    const inquiredAt = new Date().toISOString();
    const suggestedFollowUpDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    setState((current) => ({
      ...current,
      [id]: {
        ...current[id],
        bidStatus: "contacted",
        inquiredAt,
        needsFollowUp: true,
        suggestedFollowUpDate,
        closedAt: ""
      }
    }));

    void persistEntry(id, {
      bidStatus: "contacted",
      inquiredAt,
      needsFollowUp: true,
      suggestedFollowUpDate,
      closedAt: ""
    });
  }

  return {
    merged,
    state,
    updateEntry,
    setOutcome,
    markContacted
  };
}
