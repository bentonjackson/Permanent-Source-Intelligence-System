import { createHash } from "crypto";

import { NormalizedPermitInput } from "@/lib/connectors/shared/types";
import {
  BuildReadiness,
  OpportunityType,
  PermitClassification,
  PlotOpportunity,
  ProjectSegment
} from "@/types/domain";

export function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeKey(value: string | null | undefined) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseCurrency(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/[$,\s]/g, "");

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDateToIso(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  const candidate = typeof value === "number" ? String(value) : String(value).trim();
  if (!candidate || candidate === "--") {
    return null;
  }

  const direct = new Date(candidate);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString();
  }

  const slashMatch = candidate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    const parsed = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

export function normalizeBuilderName(name: string | null | undefined) {
  return normalizeWhitespace(name)
    .toLowerCase()
    .replace(/\b(incorporated|inc|llc|l\.l\.c\.|ltd|limited|corp|corporation|co|company|pllc|llp|lp)\b/g, "")
    .replace(/[.,/]+/g, " ")
    .replace(/[^a-z0-9&]+/g, " ")
    .trim();
}

export function buildDedupeHash(parts: Array<string | number | null | undefined>) {
  return createHash("sha256")
    .update(parts.map((part) => normalizeWhitespace(part == null ? "" : String(part))).join("|"))
    .digest("hex");
}

export function inferClassification(values: Array<string | null | undefined>): PermitClassification {
  const haystack = values.map((value) => normalizeWhitespace(value).toLowerCase()).join(" ");

  if (/(single[\s-]?family|sfd|single family dwelling|new home)/.test(haystack)) {
    return "single_family_home";
  }

  if (/(multi[\s-]?family|townhome|townhome unit|duplex|triplex|apartment|condo)/.test(haystack)) {
    return "multi_family";
  }

  if (/(commercial|tenant improvement|warehouse|retail|office|shell building)/.test(haystack)) {
    return "commercial";
  }

  if (/(garage|shed|accessory)/.test(haystack)) {
    return "accessory_building";
  }

  if (/(remodel|repair|alteration|addition|replace|reroof|re-roof|kitchen|bath)/.test(haystack)) {
    return "remodel_repair";
  }

  if (/(new|construction|foundation|dwelling|building permit)/.test(haystack)) {
    return "new_residential_construction";
  }

  return "unknown_needs_review";
}

export function inferProjectSegment(classification: PermitClassification, values: Array<string | null | undefined>): ProjectSegment {
  if (classification === "single_family_home" || classification === "new_residential_construction") {
    return "single_family";
  }

  if (classification === "multi_family") {
    return "multifamily";
  }

  if (classification === "commercial") {
    return "commercial";
  }

  const haystack = values.map((value) => normalizeWhitespace(value).toLowerCase()).join(" ");

  if (/(multi[\s-]?family|duplex|triplex|apartment|townhome)/.test(haystack)) {
    return "multifamily";
  }

  if (/(commercial|retail|warehouse|office)/.test(haystack)) {
    return "commercial";
  }

  return "single_family";
}

export function inferBuildReadiness(status: string | null | undefined): BuildReadiness {
  const normalized = normalizeWhitespace(status).toLowerCase();

  if (/(issued|active|approved|final)/.test(normalized)) {
    return "permit_issued";
  }

  if (/(review|application|applied|submitted|intake)/.test(normalized)) {
    return "permit_review";
  }

  if (/(plan|planning|subdivision|zoning|hearing)/.test(normalized)) {
    return "plan_submitted";
  }

  return "early_signal";
}

export function inferOpportunityType(input: {
  classification: PermitClassification;
  buildReadiness: BuildReadiness;
  subdivision?: string | null;
  lotNumber?: string | null;
  parcelNumber?: string | null;
}): OpportunityType {
  const lotLike = Boolean(normalizeWhitespace(input.subdivision) || normalizeWhitespace(input.lotNumber) || normalizeWhitespace(input.parcelNumber));

  if (lotLike && input.buildReadiness !== "permit_issued") {
    return "subdivision_lot";
  }

  if (
    input.classification === "single_family_home" ||
    input.classification === "new_residential_construction"
  ) {
    return input.buildReadiness === "permit_issued" ? "issued_new_home" : "pre_issuance_home";
  }

  if (lotLike) {
    return "vacant_lot_new_build";
  }

  return "other_non_priority";
}

export function inferVacancyConfidence(input: {
  opportunityType: OpportunityType;
  classification: PermitClassification;
  lotNumber?: string | null;
  parcelNumber?: string | null;
  subdivision?: string | null;
}): number {
  let confidence = 40;

  if (input.opportunityType === "subdivision_lot" || input.opportunityType === "vacant_lot_new_build") {
    confidence += 28;
  }

  if (input.classification === "single_family_home" || input.classification === "new_residential_construction") {
    confidence += 16;
  }

  if (input.lotNumber) {
    confidence += 8;
  }

  if (input.parcelNumber) {
    confidence += 6;
  }

  if (input.subdivision) {
    confidence += 4;
  }

  return Math.min(100, confidence);
}

export function deriveOpportunityId(record: NormalizedPermitInput) {
  return `opp-${record.dedupeHash.slice(0, 20)}`;
}

export function rowFromAliasMap(
  row: Record<string, unknown>,
  aliases: string[]
) {
  const normalizedRow = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), value])
  );

  for (const alias of aliases) {
    const value = normalizedRow[normalizeKey(alias)];
    if (value !== undefined && value !== null && normalizeWhitespace(String(value))) {
      return value;
    }
  }

  return null;
}

export function buildReasonSummary(opportunity: PlotOpportunity) {
  return opportunity.reasonSummary.slice(0, 3);
}
