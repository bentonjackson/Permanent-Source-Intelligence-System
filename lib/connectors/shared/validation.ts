import { NormalizedPermitInput } from "@/lib/connectors/shared/types";

import { normalizeWhitespace, parseCurrency } from "./normalization";

export interface RecordValidationResult {
  isValid: boolean;
  reviewRequired: boolean;
  completenessScore: number;
  issues: string[];
  blockedReasons: string[];
}

export interface SourceDriftAssessment {
  warningFlags: string[];
  driftScore: number;
}

function pushIssue(target: string[], condition: boolean, message: string) {
  if (condition) {
    target.push(message);
  }
}

function normalizeStatus(value: string | null | undefined) {
  return normalizeWhitespace(value).toLowerCase();
}

export function validateNormalizedPermitRecord(record: NormalizedPermitInput): RecordValidationResult {
  const issues: string[] = [];
  const blockedReasons: string[] = [];
  let completenessScore = 100;

  const hasAddress = Boolean(normalizeWhitespace(record.address));
  const hasParcel = Boolean(normalizeWhitespace(record.parcelNumber));
  const hasPermitNumber = Boolean(normalizeWhitespace(record.permitNumber));
  const hasDate = Boolean(record.issueDate || record.applicationDate);
  const hasStatus = Boolean(normalizeStatus(record.permitStatus));
  const hasJurisdiction = Boolean(normalizeWhitespace(record.sourceJurisdiction));
  const parsedValue =
    record.estimatedProjectValue ??
    parseCurrency(record.rawPayload?.estimatedProjectValue) ??
    parseCurrency(record.rawPayload?.projectValue);

  if (!hasAddress && !hasParcel) {
    blockedReasons.push("Missing address and parcel identifier.");
    completenessScore -= 40;
  } else if (!hasAddress) {
    issues.push("Missing street address; parcel-only record should be reviewed.");
    completenessScore -= 18;
  }

  if (!hasPermitNumber && !normalizeWhitespace(record.projectDescription) && !hasParcel) {
    blockedReasons.push("Missing permit number and other stable source identifiers.");
    completenessScore -= 24;
  } else if (!hasPermitNumber) {
    issues.push("Missing permit number; falling back to parcel/address identity.");
    completenessScore -= 10;
  }

  if (!hasDate) {
    blockedReasons.push("Missing issue/application date.");
    completenessScore -= 20;
  }

  if (!hasStatus) {
    blockedReasons.push("Missing permit status.");
    completenessScore -= 16;
  }

  if (!hasJurisdiction) {
    issues.push("Missing source jurisdiction.");
    completenessScore -= 8;
  }

  if (normalizeStatus(record.permitStatus) === "unknown") {
    issues.push("Permit status normalized to unknown.");
    completenessScore -= 8;
  }

  if (parsedValue != null && parsedValue < 0) {
    blockedReasons.push("Negative project value is invalid.");
    completenessScore -= 12;
  }

  pushIssue(
    issues,
    !normalizeWhitespace(record.city) || !normalizeWhitespace(record.county),
    "Missing city or county context."
  );
  if (!normalizeWhitespace(record.city) || !normalizeWhitespace(record.county)) {
    completenessScore -= 10;
  }

  pushIssue(
    issues,
    record.classification === "unknown_needs_review",
    "Permit classification needs review."
  );
  if (record.classification === "unknown_needs_review") {
    completenessScore -= 8;
  }

  return {
    isValid: blockedReasons.length === 0,
    reviewRequired: blockedReasons.length > 0 || issues.length > 0,
    completenessScore: Math.max(0, Math.min(100, Math.round(completenessScore))),
    issues,
    blockedReasons
  };
}

export function assessSourceDrift(input: {
  previousNormalizedCount?: number | null;
  previousCompletenessScore?: number | null;
  previousErrorRate?: number | null;
  currentFetchedCount: number;
  currentNormalizedCount: number;
  currentCompletenessScore: number;
  currentErrorCount: number;
}) {
  const warningFlags: string[] = [];

  if (input.currentFetchedCount > 0 && input.currentNormalizedCount === 0) {
    warningFlags.push("zero_normalized_output");
  }

  if (
    input.previousNormalizedCount != null &&
    input.previousNormalizedCount >= 5 &&
    input.currentNormalizedCount < Math.ceil(input.previousNormalizedCount * 0.4)
  ) {
    warningFlags.push("sharp_normalized_drop");
  }

  if (
    input.previousCompletenessScore != null &&
    input.currentCompletenessScore + 20 < input.previousCompletenessScore
  ) {
    warningFlags.push("completeness_drop");
  }

  const currentErrorRate =
    input.currentFetchedCount > 0 ? input.currentErrorCount / input.currentFetchedCount : 0;

  if (
    input.previousErrorRate != null &&
    currentErrorRate > 0.2 &&
    currentErrorRate - input.previousErrorRate >= 0.15
  ) {
    warningFlags.push("parse_error_spike");
  }

  return {
    warningFlags,
    driftScore: Math.max(0, 100 - warningFlags.length * 28)
  } satisfies SourceDriftAssessment;
}

export function computeSourceHealthScore(input: {
  availabilityScore: number;
  completenessScore: number;
  freshnessScore: number;
  parseFailureCount: number;
  missingFieldCount: number;
  duplicateCount: number;
  blockedCount: number;
  warningFlags: string[];
}) {
  let score = 0;

  score += input.availabilityScore * 0.28;
  score += input.completenessScore * 0.26;
  score += input.freshnessScore * 0.24;
  score -= Math.min(18, input.parseFailureCount * 3);
  score -= Math.min(16, input.missingFieldCount * 1.25);
  score -= Math.min(12, input.duplicateCount * 1.5);
  score -= Math.min(12, input.blockedCount * 1.5);
  score -= input.warningFlags.length * 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}
