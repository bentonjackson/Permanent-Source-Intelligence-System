import { differenceInHours, parseISO } from "date-fns";

import { hydrateOpportunityIntelligence } from "@/lib/intelligence/lead-intelligence";
import { calculateOpportunityScore } from "@/lib/scoring/lead-scoring";
import { PlotOpportunity, SourceDataOrigin, SourceFreshnessState, SourceRecord } from "@/types/domain";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function cronThresholds(syncFrequency: string) {
  const normalized = syncFrequency.trim().toLowerCase();

  if (normalized === "manual") {
    return { freshHours: 168, staleHours: 336 };
  }

  const hourlyMatch = normalized.match(/\*\/(\d+)/);

  if (hourlyMatch) {
    const interval = Number(hourlyMatch[1]);
    return {
      freshHours: Math.max(2, interval * 2),
      staleHours: Math.max(4, interval * 5)
    };
  }

  if (/^\d+\s+\d+\s+\*\s+\*\s+\*$/.test(normalized)) {
    return { freshHours: 30, staleHours: 48 };
  }

  return { freshHours: 24, staleHours: 48 };
}

export function inferSourceDataOrigin(sourceUrl: string | null | undefined): SourceDataOrigin {
  const value = (sourceUrl ?? "").trim().toLowerCase();

  if (!value) {
    return "unknown";
  }

  if (value.startsWith("mock://")) {
    return "mock";
  }

  if (value.startsWith("manual://")) {
    return "manual";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return "live";
  }

  return "unknown";
}

export function evaluateSourceFreshness(input: {
  syncFrequency: string;
  syncStatus: SourceRecord["syncStatus"];
  lastSuccessfulSync: string | null;
}) {
  if (input.syncStatus === "failed") {
    return {
      state: "failed" as SourceFreshnessState,
      detail: "Most recent source sync failed."
    };
  }

  if (!input.lastSuccessfulSync) {
    return {
      state: "unknown" as SourceFreshnessState,
      detail: "No successful live sync recorded yet."
    };
  }

  const ageHours = Math.max(0, differenceInHours(new Date(), parseISO(input.lastSuccessfulSync)));
  const thresholds = cronThresholds(input.syncFrequency);

  if (ageHours > thresholds.staleHours) {
    return {
      state: "stale" as SourceFreshnessState,
      detail: `Last successful sync is ${ageHours}h old, past the stale threshold.`
    };
  }

  if (ageHours > thresholds.freshHours) {
    return {
      state: "aging" as SourceFreshnessState,
      detail: `Last successful sync is ${ageHours}h old and should be checked soon.`
    };
  }

  return {
    state: "fresh" as SourceFreshnessState,
    detail: `Last successful sync is ${ageHours}h old and inside the freshness window.`
  };
}

export function summarizeRawRecordChanges(
  statuses: Array<"NEW" | "UPDATED" | "UNCHANGED" | "ERROR">
) {
  return statuses.reduce(
    (summary, status) => {
      if (status === "NEW") summary.newRecordCount += 1;
      if (status === "UPDATED") summary.updatedRecordCount += 1;
      if (status === "UNCHANGED") summary.unchangedRecordCount += 1;
      if (status === "ERROR") summary.errorRecordCount += 1;
      return summary;
    },
    {
      newRecordCount: 0,
      updatedRecordCount: 0,
      unchangedRecordCount: 0,
      errorRecordCount: 0
    }
  );
}

export function computeLiveDataConfidence(input: {
  sourceConfidenceScore: number;
  sourceFreshnessScore: number;
  syncStatus: SourceRecord["syncStatus"];
  freshnessState: SourceFreshnessState;
  latestFetchedCount: number;
  latestNormalizedCount: number;
  parseFailureCount: number;
  missingFieldCount: number;
  duplicateCount: number;
  dataOrigin: SourceDataOrigin;
}) {
  let score = 0;

  score += input.sourceConfidenceScore * 0.24;
  score += input.sourceFreshnessScore * 0.18;

  if (input.syncStatus === "success") score += 16;
  if (input.syncStatus === "warning") score += 4;
  if (input.syncStatus === "failed") score -= 26;

  if (input.freshnessState === "fresh") score += 18;
  if (input.freshnessState === "aging") score += 6;
  if (input.freshnessState === "stale") score -= 16;
  if (input.freshnessState === "failed") score -= 20;
  if (input.freshnessState === "unknown") score -= 8;

  if (input.dataOrigin === "live") score += 10;
  if (input.dataOrigin === "manual") score -= 4;
  if (input.dataOrigin === "mock") score -= 32;

  const normalizationRatio =
    input.latestFetchedCount > 0 ? input.latestNormalizedCount / input.latestFetchedCount : 0;
  score += normalizationRatio * 18;

  score -= Math.min(18, input.parseFailureCount * 2);
  score -= Math.min(16, input.missingFieldCount * 1.5);
  score -= Math.min(12, input.duplicateCount * 1.5);

  return Math.round(clamp(score));
}

export function validateOpportunityTransformation(opportunity: PlotOpportunity) {
  const recomputed = hydrateOpportunityIntelligence({
    ...opportunity
  });
  const rescored = calculateOpportunityScore(recomputed);
  const mismatches: string[] = [];

  if (recomputed.leadType !== opportunity.leadType) mismatches.push("leadType");
  if (recomputed.jobFit !== opportunity.jobFit) mismatches.push("jobFit");
  if (recomputed.projectStageStatus !== opportunity.projectStageStatus) mismatches.push("projectStageStatus");
  if (recomputed.opportunityReason !== opportunity.opportunityReason) mismatches.push("opportunityReason");
  if (recomputed.recencyBucket !== opportunity.recencyBucket) mismatches.push("recencyBucket");
  if ((recomputed.marketCluster ?? null) !== (opportunity.marketCluster ?? null)) mismatches.push("marketCluster");
  if (rescored.total !== opportunity.opportunityScore) mismatches.push("opportunityScore");

  return {
    ok: mismatches.length === 0,
    mismatches,
    recomputedScore: rescored.total,
    recomputed
  };
}

export function summarizeTransformationConsistency(opportunities: PlotOpportunity[], sampleSize = 25) {
  const sampled = opportunities.slice(0, sampleSize);
  const invalid = sampled
    .map((opportunity) => ({
      opportunityId: opportunity.id,
      ...validateOpportunityTransformation(opportunity)
    }))
    .filter((result) => !result.ok);

  return {
    sampledCount: sampled.length,
    mismatchCount: invalid.length,
    invalid
  };
}
