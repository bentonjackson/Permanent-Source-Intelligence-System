import { calculateOpportunityScore } from "@/lib/scoring/lead-scoring";
import {
  buildBuilderIdentityKey,
  buildOpportunityIdentityKey,
  buildPermitIdentityKey,
  buildPropertyIdentityKey,
  buildStableOpportunityId
} from "@/lib/connectors/shared/identity";
import { NormalizedPermitInput } from "@/lib/connectors/shared/types";
import {
  inferBuildReadiness,
  inferOpportunityType,
  inferProjectSegment,
  inferVacancyConfidence,
  normalizeBuilderName
} from "@/lib/connectors/shared/normalization";
import { DEFAULT_OPEN_TERRITORY_LABEL } from "@/lib/app/defaults";
import { resolveEntityIdentity } from "@/lib/entities/contact-identity";
import { hydrateOpportunityIntelligence } from "@/lib/intelligence/lead-intelligence";
import { PlotOpportunity } from "@/types/domain";

function sourceDomain(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return sourceUrl;
  }
}

function inferSignalType(record: NormalizedPermitInput) {
  if (record.signalType) {
    return record.signalType;
  }

  if (record.classification === "multi_family") {
    return "new_multifamily_permit" as const;
  }

  if (record.classification === "single_family_home" || record.classification === "new_residential_construction") {
    return "new_residential_permit" as const;
  }

  if (record.subdivision || record.lotNumber) {
    return "subdivision_plat" as const;
  }

  return "other" as const;
}

function inferDevelopmentStage(record: NormalizedPermitInput, buildReadiness: PlotOpportunity["buildReadiness"]) {
  if (record.developmentStage) {
    return record.developmentStage;
  }

  if (buildReadiness === "permit_issued") {
    return "permit_issued" as const;
  }

  if (buildReadiness === "permit_review") {
    return "permit_review" as const;
  }

  if (buildReadiness === "plan_submitted") {
    return record.subdivision ? "plat_review" as const : "planning_review" as const;
  }

  return record.subdivision || record.lotNumber ? "early_land_signal" as const : "permit_intake" as const;
}

function inferSourceStrength(record: NormalizedPermitInput) {
  if (record.sourceStrength) {
    return record.sourceStrength;
  }

  if (record.sourceJurisdiction.toLowerCase().includes("permit")) {
    return "high" as const;
  }

  if (record.classification === "single_family_home" || record.classification === "multi_family") {
    return "high" as const;
  }

  return record.subdivision || record.lotNumber ? "medium" as const : "low" as const;
}

function inferReadinessToContact(opportunity: Pick<PlotOpportunity, "preferredSalesName" | "buildReadiness" | "projectSegment">) {
  if (!opportunity.preferredSalesName) {
    return "research" as const;
  }

  if (opportunity.buildReadiness === "permit_issued") {
    return "now" as const;
  }

  if (opportunity.buildReadiness === "permit_review") {
    return "soon" as const;
  }

  return opportunity.projectSegment === "commercial" ? "watch" as const : "soon" as const;
}

function inferBidStatus(record: NormalizedPermitInput) {
  const identity = resolveEntityIdentity(record);

  if (record.classification === "remodel_repair" || record.classification === "accessory_building") {
    return "not_reviewed" as const;
  }

  return identity.preferredSalesName ? "ready_to_contact" : "researching_builder";
}

function inferNextAction(opportunity: Omit<PlotOpportunity, "reasonSummary" | "opportunityScore">) {
  if (!opportunity.preferredSalesName) {
    return "Research the best builder or contractor contact before calling on this parcel.";
  }

  if (opportunity.buildReadiness === "permit_issued") {
    return "Call first and ask for the insulation and shelving bid before competitors do.";
  }

  if (opportunity.buildReadiness === "permit_review") {
    return "Reach out early and position for insulation and shelving once the permit clears.";
  }

  return "Watch the permit closely and line up the builder contact before the next filing moves forward.";
}

export function mapNormalizedPermitToOpportunity(record: NormalizedPermitInput): PlotOpportunity {
  const identity = resolveEntityIdentity(record);
  const buildReadiness = inferBuildReadiness(record.permitStatus);
  const signalType = inferSignalType(record);
  const opportunityType = inferOpportunityType({
    classification: record.classification,
    buildReadiness,
    subdivision: record.subdivision,
    lotNumber: record.lotNumber,
    parcelNumber: record.parcelNumber
  });
  const projectSegment = inferProjectSegment(record.classification, [
    record.permitType,
    record.permitSubtype,
    record.projectDescription
  ]);
  const permitIdentityKey = buildPermitIdentityKey(record);
  const propertyIdentityKey = buildPropertyIdentityKey(record);
  const builderIdentityKey = buildBuilderIdentityKey(record);
  const opportunityIdentityKey = buildOpportunityIdentityKey(record);
  const base: Omit<PlotOpportunity, "opportunityScore" | "reasonSummary"> = {
    id: buildStableOpportunityId(record),
    assignedMembershipId: null,
    opportunityIdentityKey,
    propertyIdentityKey,
    permitIdentityKey,
    builderIdentityKey,
    sourceFingerprint: null,
    sourceRecordVersion: 1,
    lastSourceChangedAt: null,
    sourceChangeSummary: [],
    scoreBreakdown: [],
    requiresReview: false,
    duplicateRiskScore: 0,
    address: record.address,
    city: record.city,
    county: record.county,
    subdivision: record.subdivision ?? null,
    parcelNumber: record.parcelNumber ?? null,
    lotNumber: record.lotNumber ?? null,
    builderId: identity.normalizedEntityName || normalizeBuilderName(record.builderName) || null,
    builderName: identity.rawSourceName ?? null,
    likelyCompanyName: identity.legalEntityName ?? null,
    rawSourceName: identity.rawSourceName,
    normalizedEntityName: identity.normalizedEntityName,
    preferredSalesName: identity.preferredSalesName,
    legalEntityName: identity.legalEntityName,
    aliases: [],
    roleType: identity.roleType,
    entityConfidenceScore: identity.entityConfidenceScore,
    roleConfidenceScore: identity.entityConfidenceScore,
    contactQualityTier: identity.contactQualityTier,
    contactQualityBand: identity.preferredSalesName ? "tier_3" : "tier_5",
    contactQualityScore: identity.preferredSalesName ? 56 : 10,
    preferredContactTarget: identity.preferredContactTarget,
    phone: null,
    email: null,
    website: null,
    contractorRegistrationNumber: null,
    contractorRegistrationStatus: "unknown",
    businessEntityNumber: null,
    businessEntityStatus: "unknown",
    mailingAddress: null,
    cityState: null,
    lastEnrichedAt: null,
    permitNumber: record.permitNumber,
    sourceName: record.sourceJurisdiction ? `${record.sourceJurisdiction} Official Source` : "Official Source",
    sourceJurisdiction: record.sourceJurisdiction,
    sourceUrl: record.sourceUrl,
    signalType,
    developmentStage: inferDevelopmentStage(record, buildReadiness),
    sourceStrength: inferSourceStrength(record),
    readinessToContact: "research",
    clusterId: record.clusterId ?? record.subdivisionId ?? record.subdivision ?? null,
    signalDate: record.issueDate ?? record.applicationDate ?? new Date().toISOString(),
    addressState: "IA",
    addressZip: null,
    neighborhood: record.subdivision ?? null,
    estimatedProjectValue: record.estimatedProjectValue ?? null,
    landValue: record.landValue ?? null,
    improvementValue: record.improvementValue ?? null,
    classification: record.classification,
    projectSegment,
    leadType: "unknown",
    jobFit: "low",
    projectStageStatus: "new",
    opportunityReason: "unknown",
    recencyBucket: "older",
    marketCluster: record.clusterId ?? record.subdivisionId ?? record.subdivision ?? null,
    opportunityType,
    buildReadiness,
    vacancyConfidence: inferVacancyConfidence({
      opportunityType,
      classification: record.classification,
      lotNumber: record.lotNumber,
      parcelNumber: record.parcelNumber,
      subdivision: record.subdivision
    }),
    bidStatus: inferBidStatus(record),
    currentStage:
      identity.preferredSalesName ? "Ready to Bid" : "Research Builder",
    assignedRep: DEFAULT_OPEN_TERRITORY_LABEL,
    nextAction: "",
    contactedAt: null,
    lastContactedAt: null,
    nextFollowUpAt: null,
    followUpNeeded: false,
    interestStatus: "unknown",
    outcomeStatus: "open",
    contactSummary: null,
    notesSummary: null,
    outreachCount: 0,
    callCount: 0,
    emailCount: 0,
    textCount: 0,
    reasonLost: null,
    internalNotes: null,
    externalSummary: null,
    quoteRequestedAt: null,
    quoteSentAt: null,
    nextFollowUpDate: null,
    contactStatus: identity.preferredSalesName
      ? `Sales-ready contact identity from ${sourceDomain(record.sourceUrl)}`
      : `Related entity found from ${sourceDomain(record.sourceUrl)}; builder still needs research`,
    notesCount: 0,
    inquiredAt: null,
    needsFollowUp: false,
    contactResolutionStatus: identity.preferredSalesName ? "builder_only" : ["owner", "holding_company", "person"].includes(identity.roleType) ? "weak_entity" : "unknown",
    lastContactResolutionRunAt: null,
    suggestedFollowUpDate: null,
    secondFollowUpDate: null,
    followedUpOn: null,
    closedAt: null,
    notes: [],
    stageHistory: [],
    contactSnapshot: null,
    entityMatches: [],
    enrichmentAudit: [],
    contacts: [],
    activities: []
  };

  base.readinessToContact = inferReadinessToContact(base);
  base.nextAction = inferNextAction(base);
  const hydrated = hydrateOpportunityIntelligence({
    ...base,
    opportunityScore: 0,
    reasonSummary: []
  });
  const score = calculateOpportunityScore(hydrated);

  return {
    ...hydrated,
    opportunityScore: score.total,
    reasonSummary: score.reasons,
    scoreBreakdown: score.breakdown
  };
}
