import { createHash } from "node:crypto";

import { NormalizedPermitInput } from "@/lib/connectors/shared/types";

import { normalizeBuilderName, normalizeKey, normalizeWhitespace } from "./normalization";

function hashKey(prefix: string, value: string) {
  return `${prefix}-${createHash("sha256").update(value).digest("hex").slice(0, 20)}`;
}

function normalizeIdentityValue(value: string | null | undefined) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[.,/#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePermitNumber(value: string | null | undefined) {
  return normalizeIdentityValue(value).replace(/[^a-z0-9]+/g, "");
}

function normalizeCounty(value: string | null | undefined) {
  return normalizeIdentityValue(value).replace(/\bcounty\b/g, "").trim();
}

function normalizeSourceKey(record: Pick<NormalizedPermitInput, "sourceJurisdiction" | "sourceUrl">, sourceSlug?: string | null) {
  if (sourceSlug) {
    return normalizeKey(sourceSlug);
  }

  const jurisdiction = normalizeKey(record.sourceJurisdiction);

  if (jurisdiction) {
    return jurisdiction;
  }

  try {
    const url = new URL(record.sourceUrl);
    return normalizeKey(`${url.hostname}${url.pathname}`);
  } catch {
    return normalizeKey(record.sourceUrl);
  }
}

function isGenericBuilderIdentity(normalizedName: string) {
  const parts = normalizedName.split(" ").filter(Boolean);

  return parts.length <= 1 || normalizedName.length < 8;
}

export function buildPermitIdentityKey(
  record: Pick<
    NormalizedPermitInput,
    "permitNumber" | "address" | "parcelNumber" | "issueDate" | "applicationDate" | "permitType" | "sourceJurisdiction" | "sourceUrl"
  >,
  sourceSlug?: string | null
) {
  const sourceKey = normalizeSourceKey(record, sourceSlug);
  const permitNumber = normalizePermitNumber(record.permitNumber);

  if (permitNumber) {
    return `permit:${sourceKey}:${permitNumber}`;
  }

  return [
    "permit",
    sourceKey,
    normalizeIdentityValue(record.parcelNumber),
    normalizeIdentityValue(record.address),
    normalizeIdentityValue(record.issueDate ?? record.applicationDate),
    normalizeIdentityValue(record.permitType)
  ]
    .filter(Boolean)
    .join(":");
}

export function buildPropertyIdentityKey(
  record: Pick<
    NormalizedPermitInput,
    "parcelNumber" | "address" | "city" | "county" | "state" | "zip" | "lotNumber" | "subdivision"
  >
) {
  const parcelNumber = normalizeIdentityValue(record.parcelNumber);

  if (parcelNumber) {
    return [
      "property",
      "parcel",
      normalizeIdentityValue(record.state || "IA"),
      parcelNumber
    ].join(":");
  }

  return [
    "property",
    "address",
    normalizeIdentityValue(record.address),
    normalizeIdentityValue(record.city),
    normalizeCounty(record.county),
    normalizeIdentityValue(record.state || "IA"),
    normalizeIdentityValue(record.zip),
    normalizeIdentityValue(record.subdivision),
    normalizeIdentityValue(record.lotNumber)
  ]
    .filter(Boolean)
    .join(":");
}

export function buildBuilderIdentityKey(input: {
  builderName?: string | null;
  contractorName?: string | null;
  developerName?: string | null;
  ownerName?: string | null;
  county?: string | null;
}) {
  const rawName =
    input.builderName ??
    input.contractorName ??
    input.developerName ??
    input.ownerName ??
    "";
  const normalizedName = normalizeBuilderName(rawName);

  if (!normalizedName) {
    return null;
  }

  if (isGenericBuilderIdentity(normalizedName) && input.county) {
    return `builder:${normalizedName}:${normalizeCounty(input.county)}`;
  }

  return `builder:${normalizedName}`;
}

export function buildOpportunityIdentityKey(
  record: Pick<
    NormalizedPermitInput,
    | "permitNumber"
    | "address"
    | "parcelNumber"
    | "issueDate"
    | "applicationDate"
    | "permitType"
    | "sourceJurisdiction"
    | "sourceUrl"
    | "city"
    | "county"
    | "state"
    | "zip"
    | "lotNumber"
    | "subdivision"
    | "classification"
  >,
  sourceSlug?: string | null
) {
  const permitIdentityKey = buildPermitIdentityKey(record, sourceSlug);
  const propertyIdentityKey = buildPropertyIdentityKey(record);

  return [
    "opportunity",
    permitIdentityKey,
    propertyIdentityKey,
    normalizeIdentityValue(record.classification)
  ]
    .filter(Boolean)
    .join(":");
}

export function buildStableOpportunityId(record: NormalizedPermitInput, sourceSlug?: string | null) {
  return hashKey("opp", buildOpportunityIdentityKey(record, sourceSlug));
}

export function buildSourceFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

export function summarizeChangedFields(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
  fields: string[]
) {
  const changedFields: string[] = [];

  for (const field of fields) {
    const previousValue = previous[field];
    const nextValue = next[field];
    const normalizedPrevious =
      previousValue == null ? null : typeof previousValue === "string" ? normalizeWhitespace(previousValue) : JSON.stringify(previousValue);
    const normalizedNext =
      nextValue == null ? null : typeof nextValue === "string" ? normalizeWhitespace(nextValue) : JSON.stringify(nextValue);

    if (normalizedPrevious !== normalizedNext) {
      changedFields.push(field);
    }
  }

  return changedFields;
}
