import { NormalizedPermitInput } from "@/lib/connectors/shared/types";
import { normalizeWhitespace } from "@/lib/connectors/shared/normalization";
import {
  BuilderRecord,
  ContactQualityTier,
  EntityRoleType,
  PlotOpportunity
} from "@/types/domain";

const legalSuffixPattern =
  /\b(incorporated|inc|llc|l\.l\.c\.|l\s+l\s+c|corp|corporation|co|company|ltd|limited|pllc|llp|lp)\b\.?/gi;

const holdingCompanyPattern = /\b(holding|holdings|properties|property|investments|investment|capital|management)\b/i;
const builderPattern = /\b(builder|builders|homes|homebuilders|custom homes|construction|contracting|contractor|developers?|development|communities)\b/i;
const organizationPattern = /\b(llc|inc|corp|corporation|co|company|companies|group|partners|enterprise|enterprises|association|associates)\b/i;
const businessWordPattern = /\b(pools?|electric|electrical|plumbing|roofing|concrete|masonry|excavating|landscaping|fence|flooring|painting|insulation|shelving|services?)\b/i;

function cleanupPunctuation(value: string) {
  return normalizeWhitespace(value.replace(/[,_/]+/g, " ").replace(/\s*&\s*/g, " & ").replace(/[.]+/g, " "));
}

export function stripLegalSuffixes(value: string | null | undefined) {
  const normalized = cleanupPunctuation(normalizeWhitespace(value));
  return cleanupPunctuation(normalized.replace(/\bet al\b/gi, " ").replace(legalSuffixPattern, ""));
}

export function normalizeEntityName(value: string | null | undefined) {
  return stripLegalSuffixes(value)
    .toLowerCase()
    .replace(/[^a-z0-9&]+/g, " ")
    .trim();
}

function toDisplayTitle(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 3 && /[A-Z]/.test(part)) {
        return part.toUpperCase();
      }

      if (/^[A-Z0-9&-]+$/.test(part) && part.length <= 3) {
        return part;
      }

      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

export function buildPreferredSalesName(value: string | null | undefined) {
  const stripped = stripLegalSuffixes(value);
  return stripped ? toDisplayTitle(stripped) : null;
}

function isLikelyPersonName(value: string) {
  if (builderPattern.test(value) || organizationPattern.test(value) || businessWordPattern.test(value)) {
    return false;
  }

  const tokens = normalizeWhitespace(value)
    .split(/\s+/)
    .filter((token) => token && token !== "&");
  const initialCount = tokens.filter((token) => /^[A-Z]\.?$/i.test(token)).length;

  if (initialCount >= 2) {
    return false;
  }

  return (
    tokens.length >= 2 &&
    tokens.length <= 4 &&
    tokens.every((token) => /^[A-Z][a-z'.-]+$/.test(token) || /^[A-Z]\.?$/.test(token)) &&
    tokens.some((token) => token.replace(/\./g, "").length > 1)
  );
}

function looksLikeSalesBuilderEntity(value: string | null | undefined) {
  const raw = normalizeWhitespace(value);

  if (!raw) {
    return false;
  }

  if (holdingCompanyPattern.test(raw) || isLikelyPersonName(raw) || businessWordPattern.test(raw)) {
    return false;
  }

  if (builderPattern.test(raw)) {
    return true;
  }

  return organizationPattern.test(raw);
}

export interface ResolvedEntityIdentity {
  rawSourceName: string | null;
  normalizedEntityName: string | null;
  preferredSalesName: string | null;
  legalEntityName: string | null;
  roleType: EntityRoleType;
  entityConfidenceScore: number;
  contactQualityTier: ContactQualityTier;
  preferredContactTarget: string | null;
}

function inferRoleType(input: {
  matchedField: "builder" | "general_contractor" | "developer" | "owner" | "unknown";
  rawSourceName: string | null;
}): EntityRoleType {
  const raw = normalizeWhitespace(input.rawSourceName);

  if (!raw) {
    return "unknown";
  }

  if (holdingCompanyPattern.test(raw)) {
    return "holding_company";
  }

  const looksLikePerson = isLikelyPersonName(raw);
  const hasBuilderTerms = builderPattern.test(raw);
  const looksLikeOrganization = hasBuilderTerms || organizationPattern.test(raw);

  if (looksLikePerson && !looksLikeOrganization) {
    return "person";
  }

  if (input.matchedField === "builder") {
    return looksLikeOrganization ? "builder" : "unknown";
  }

  if (input.matchedField === "general_contractor") {
    return looksLikeOrganization ? "general_contractor" : "unknown";
  }

  if (input.matchedField === "developer") {
    return looksLikeOrganization ? "developer" : "unknown";
  }

  if (input.matchedField === "owner") {
    if (looksLikeSalesBuilderEntity(raw)) {
      return "builder";
    }

    return looksLikeOrganization ? "owner" : "person";
  }

  if (hasBuilderTerms) {
    return "builder";
  }

  if (looksLikeSalesBuilderEntity(raw)) {
    return "builder";
  }

  return looksLikeOrganization ? "owner" : "unknown";
}

function inferEntityConfidence(roleType: EntityRoleType, rawSourceName: string | null) {
  const raw = normalizeWhitespace(rawSourceName);

  if (!raw) {
    return 0;
  }

  let score =
    roleType === "builder"
      ? 90
      : roleType === "general_contractor"
        ? 84
        : roleType === "developer"
          ? 76
          : roleType === "person"
            ? 58
            : roleType === "owner"
              ? 48
              : roleType === "holding_company"
                ? 38
                : 24;

  if (builderPattern.test(raw) && (roleType === "builder" || roleType === "general_contractor" || roleType === "developer")) {
    score += 6;
  }

  if (roleType === "builder" && looksLikeSalesBuilderEntity(raw) && !builderPattern.test(raw)) {
    score += 4;
  }

  if (isLikelyPersonName(raw) && roleType !== "builder") {
    score -= 6;
  }

  return Math.max(0, Math.min(100, score));
}

function inferContactQualityTier(input: {
  preferredSalesName: string | null;
  entityConfidenceScore: number;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}) {
  const contactSignals = [input.phone, input.email, input.website].filter(Boolean).length;

  if (!input.preferredSalesName || input.entityConfidenceScore < 64) {
    return contactSignals ? "low" : "research_required";
  }

  if (input.phone && input.email) {
    return "high";
  }

  if (contactSignals >= 2) {
    return "medium";
  }

  return contactSignals === 1 ? "low" : "research_required";
}

export function resolveEntityIdentity(
  record: Pick<
    NormalizedPermitInput,
    "builderName" | "contractorName" | "developerName" | "ownerName"
  >,
  contact?: { phone?: string | null; email?: string | null; website?: string | null }
): ResolvedEntityIdentity {
  const rawSourceName =
    normalizeWhitespace(record.builderName) ||
    normalizeWhitespace(record.contractorName) ||
    normalizeWhitespace(record.developerName) ||
    normalizeWhitespace(record.ownerName) ||
    null;
  const matchedField =
    normalizeWhitespace(record.builderName)
      ? "builder"
      : normalizeWhitespace(record.contractorName)
        ? "general_contractor"
        : normalizeWhitespace(record.developerName)
          ? "developer"
          : normalizeWhitespace(record.ownerName)
            ? "owner"
            : "unknown";
  const roleType = inferRoleType({
    matchedField,
    rawSourceName
  });
  const entityConfidenceScore = inferEntityConfidence(roleType, rawSourceName);
  const legalEntityName = rawSourceName;
  const normalizedEntityName = normalizeEntityName(rawSourceName);
  const preferredSalesName =
    entityConfidenceScore >= 64 && !["owner", "holding_company", "unknown"].includes(roleType)
      ? buildPreferredSalesName(rawSourceName)
      : roleType === "person" && entityConfidenceScore >= 55
        ? buildPreferredSalesName(rawSourceName)
        : null;
  const contactQualityTier = inferContactQualityTier({
    preferredSalesName,
    entityConfidenceScore,
    phone: contact?.phone ?? null,
    email: contact?.email ?? null,
    website: contact?.website ?? null
  });

  return {
    rawSourceName,
    normalizedEntityName,
    preferredSalesName,
    legalEntityName,
    roleType,
    entityConfidenceScore,
    contactQualityTier,
    preferredContactTarget: preferredSalesName && entityConfidenceScore >= 64 ? preferredSalesName : "Research contact"
  };
}

function isStrongSalesIdentity(input: {
  preferredSalesName: string | null;
  roleType: EntityRoleType;
  entityConfidenceScore: number;
}) {
  return (
    Boolean(input.preferredSalesName) &&
    input.entityConfidenceScore >= 64 &&
    ["builder", "general_contractor", "developer", "person"].includes(input.roleType)
  );
}

export function getOpportunityEntityPresentation(opportunity: PlotOpportunity) {
  const strong = isStrongSalesIdentity(opportunity);

  return {
    displayName: strong ? opportunity.preferredSalesName ?? "Unknown Builder" : "Unknown Builder",
    relatedEntityName:
      strong
        ? null
        : opportunity.legalEntityName ?? opportunity.rawSourceName ?? opportunity.normalizedEntityName ?? null,
    nextAction:
      strong
        ? opportunity.nextAction
        : "Research contact"
  };
}

export function getBuilderEntityPresentation(builder: BuilderRecord) {
  const strong = isStrongSalesIdentity(builder);

  return {
    displayName: strong ? builder.preferredSalesName ?? builder.name : "Unknown Builder",
    relatedEntityName:
      strong
        ? null
        : builder.legalEntityName ?? builder.rawSourceName ?? builder.normalizedName ?? null,
    nextAction:
      strong
        ? builder.contact.email ?? builder.contact.phone ?? builder.preferredContactTarget ?? "Ready to bid"
        : "Research contact"
  };
}
