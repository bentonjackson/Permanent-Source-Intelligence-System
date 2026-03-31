import { differenceInDays, parseISO } from "date-fns";

import { BuilderRecord, JobFit, LeadType, OpportunityReason, PlotOpportunity, ProjectStageStatus, RecencyBucket } from "@/types/domain";

const INSULATION_KEYWORDS = [
  "insulation",
  "basement",
  "attic",
  "garage",
  "energy",
  "weatherization",
  "addition",
  "new build",
  "new construction"
];

const SHELVING_KEYWORDS = [
  "garage",
  "closet",
  "storage",
  "shelving",
  "pantry",
  "built-in",
  "mudroom"
];

function safeText(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

export function parseAddressParts(address: string | null | undefined, fallbackCity?: string | null) {
  const normalized = (address ?? "").replace(/\s+/g, " ").trim();
  const zip = normalized.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] ?? null;
  const state = normalized.match(/\b(IA|Iowa)\b/i) ? "IA" : null;

  return {
    city: fallbackCity ?? null,
    state,
    zip
  };
}

export function inferLeadType(opportunity: Pick<PlotOpportunity, "roleType" | "projectSegment" | "preferredSalesName" | "rawSourceName">): LeadType {
  if (opportunity.projectSegment === "commercial") {
    return "commercial";
  }

  if (opportunity.roleType === "builder" || opportunity.roleType === "developer") {
    return "builder";
  }

  if (opportunity.roleType === "general_contractor") {
    return "contractor";
  }

  if (opportunity.roleType === "owner" || opportunity.roleType === "person") {
    return "homeowner";
  }

  if (opportunity.preferredSalesName || opportunity.rawSourceName) {
    return "contractor";
  }

  return "unknown";
}

export function inferJobFit(opportunity: Pick<PlotOpportunity, "classification" | "projectSegment" | "opportunityType" | "sourceName" | "sourceJurisdiction" | "nextAction" | "reasonSummary">): JobFit {
  const text = safeText(
    opportunity.classification,
    opportunity.projectSegment,
    opportunity.opportunityType,
    opportunity.sourceName,
    opportunity.sourceJurisdiction,
    opportunity.nextAction,
    ...opportunity.reasonSummary
  );

  const hasInsulation = INSULATION_KEYWORDS.some((keyword) => text.includes(keyword));
  const hasShelving = SHELVING_KEYWORDS.some((keyword) => text.includes(keyword));

  if (hasInsulation && hasShelving) {
    return "both";
  }

  if (hasShelving) {
    return "shelving";
  }

  if (hasInsulation || opportunity.classification === "single_family_home" || opportunity.classification === "multi_family") {
    return "insulation";
  }

  return "low";
}

export function inferProjectStageStatus(opportunity: Pick<PlotOpportunity, "bidStatus" | "buildReadiness">): ProjectStageStatus {
  if (["won", "lost", "not_a_fit"].includes(opportunity.bidStatus)) {
    return "closed";
  }

  if (opportunity.bidStatus === "quoted") {
    return "near_complete";
  }

  if (opportunity.buildReadiness === "permit_issued" || opportunity.bidStatus === "contacted" || opportunity.bidStatus === "bid_requested") {
    return "active";
  }

  return "new";
}

export function inferOpportunityReason(opportunity: Pick<PlotOpportunity, "classification" | "opportunityType" | "reasonSummary" | "nextAction">): OpportunityReason {
  const text = safeText(opportunity.classification, opportunity.opportunityType, opportunity.nextAction, ...opportunity.reasonSummary);

  if (opportunity.opportunityType === "vacant_lot_new_build" || opportunity.opportunityType === "issued_new_home" || opportunity.opportunityType === "pre_issuance_home") {
    return "new_build";
  }

  if (text.includes("garage")) {
    return "garage";
  }

  if (text.includes("basement")) {
    return "basement";
  }

  if (text.includes("addition")) {
    return "addition";
  }

  if (text.includes("remodel")) {
    return "remodel";
  }

  if (text.includes("commercial")) {
    return "commercial_shell";
  }

  if (text.includes("new-build") || text.includes("new build") || text.includes("single-family") || text.includes("subdivision")) {
    return "new_build";
  }

  return "unknown";
}

export function inferRecencyBucket(signalDate: string): RecencyBucket {
  const days = Math.max(0, differenceInDays(new Date(), parseISO(signalDate)));

  if (days <= 7) {
    return "0_7_days";
  }

  if (days <= 30) {
    return "8_30_days";
  }

  if (days <= 90) {
    return "31_90_days";
  }

  return "older";
}

export function inferMarketCluster(opportunity: Pick<PlotOpportunity, "clusterId" | "subdivision" | "addressZip" | "city" | "county">) {
  return opportunity.clusterId ?? opportunity.subdivision ?? opportunity.addressZip ?? ([opportunity.city, opportunity.county].filter(Boolean).join(" • ") || null);
}

export function hydrateOpportunityIntelligence(opportunity: PlotOpportunity): PlotOpportunity {
  const addressParts = parseAddressParts(opportunity.address, opportunity.city);
  const addressState = opportunity.addressState ?? addressParts.state ?? "IA";
  const addressZip = opportunity.addressZip ?? addressParts.zip;
  const neighborhood = opportunity.neighborhood ?? opportunity.subdivision ?? addressZip;
  const leadType = inferLeadType(opportunity);
  const jobFit = inferJobFit(opportunity);
  const projectStageStatus = inferProjectStageStatus(opportunity);
  const opportunityReason = inferOpportunityReason(opportunity);
  const recencyBucket = inferRecencyBucket(opportunity.signalDate);
  const marketCluster = inferMarketCluster({
    clusterId: opportunity.clusterId,
    subdivision: opportunity.subdivision,
    addressZip,
    city: opportunity.city,
    county: opportunity.county
  });

  return {
    ...opportunity,
    addressState,
    addressZip,
    neighborhood,
    leadType,
    jobFit,
    projectStageStatus,
    opportunityReason,
    recencyBucket,
    marketCluster
  };
}

export function buildContractorMetrics(builder: BuilderRecord) {
  const permits = builder.properties.flatMap((property) => property.permits);
  const now = new Date();
  const values = permits.map((permit) => permit.projectValue ?? permit.estimatedProjectValue ?? 0).filter((value) => value > 0);
  const projectTypes = [...new Set(permits.map((permit) => permit.permitType).filter(Boolean))];
  const locations = [...new Set(builder.properties.map((property) => `${property.city}, ${property.county}`).filter(Boolean))];
  const countWindow = (days: number) =>
    permits.filter((permit) => {
      const date = permit.issueDate ?? permit.applicationDate;
      if (!date) {
        return false;
      }

      return differenceInDays(now, parseISO(date)) <= days;
    }).length;

  return {
    totalPermits: permits.length,
    permitsLast30Days: countWindow(30),
    permitsLast60Days: countWindow(60),
    permitsLast90Days: countWindow(90),
    avgProjectValue: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0,
    projectTypes,
    locations,
    outreachStatus:
      builder.pipelineStage === "Contacted"
        ? "contacted"
        : builder.pipelineStage === "Won"
          ? "partner"
          : "new",
    exportLabel: `${builder.name} outreach`
  } satisfies BuilderRecord["contractorMetrics"];
}

export function recommendationForOpportunity(opportunity: PlotOpportunity) {
  if (opportunity.opportunityScore >= 85) {
    return "High-priority lead";
  }

  if (opportunity.jobFit === "both" && opportunity.contactQualityBand === "tier_1") {
    return "Builder ready for insulation and shelving outreach";
  }

  if (opportunity.contactQualityBand === "tier_5") {
    return "Research contact before outreach";
  }

  if (opportunity.projectStageStatus === "closed") {
    return "Closed lead";
  }

  return "Review and prioritize";
}
