import { corridorBoostForCounty } from "@/lib/geo/territories";
import { BuilderRecord, PermitRecord, PlotOpportunity } from "@/types/domain";

export interface ScoreBreakdown {
  total: number;
  reasons: string[];
  breakdown: Array<{
    label: string;
    value: number;
  }>;
}

export const OPPORTUNITY_SCORING_WEIGHTS = {
  freshPermit: 18,
  recentPermit: 10,
  olderPermit: -8,
  stalePermit: -18,
  singleFamily: 16,
  multifamily: 14,
  commercial: 12,
  strongValue: 12,
  mediumValue: 6,
  builderIdentified: 10,
  contactStrong: 12,
  contactPartial: 6,
  noContactPenalty: -12,
  bothFit: 12,
  insulationFit: 8,
  shelvingFit: 7,
  weakFit: -8,
  activeStage: 8,
  nearComplete: -6,
  closedPenalty: -20,
  missingLocation: -10,
  newlyIssuedBoost: 8,
  clusterBoost: 6,
  activeBuilderBoost: 8,
  noRecentActivityPenalty: -6
} as const;

function addScore(
  breakdown: ScoreBreakdown["breakdown"],
  reasons: string[],
  label: string,
  value: number,
  reason?: string
) {
  if (!value) {
    return 0;
  }

  breakdown.push({ label, value });

  if (reason) {
    reasons.push(reason);
  }

  return value;
}

function scorePermit(permit: PermitRecord) {
  let score = 0;
  const reasons: string[] = [];
  const breakdown: ScoreBreakdown["breakdown"] = [];

  if (permit.classification === "single_family_home") {
    score += addScore(breakdown, reasons, "single_family", OPPORTUNITY_SCORING_WEIGHTS.singleFamily, "Single-family residential construction.");
  }

  if (permit.classification === "multi_family") {
    score += addScore(breakdown, reasons, "multifamily", OPPORTUNITY_SCORING_WEIGHTS.multifamily, "Multifamily construction activity.");
  }

  if (permit.classification === "commercial") {
    score += addScore(breakdown, reasons, "commercial", OPPORTUNITY_SCORING_WEIGHTS.commercial, "Commercial construction activity.");
  }

  if (permit.permitStatus.toLowerCase().includes("issued")) {
    score += addScore(breakdown, reasons, "permit_issued", OPPORTUNITY_SCORING_WEIGHTS.freshPermit, "Permit already issued.");
  } else if (permit.permitStatus.toLowerCase().includes("review") || permit.permitStatus.toLowerCase().includes("applied")) {
    score += addScore(breakdown, reasons, "permit_review", OPPORTUNITY_SCORING_WEIGHTS.recentPermit, "Permit in early-stage review window.");
  }

  const projectValue = permit.projectValue ?? permit.estimatedProjectValue ?? 0;

  if (projectValue >= 400000) {
    score += addScore(breakdown, reasons, "high_value", OPPORTUNITY_SCORING_WEIGHTS.strongValue, "High project valuation.");
  } else if (projectValue >= 150000) {
    score += addScore(breakdown, reasons, "medium_value", OPPORTUNITY_SCORING_WEIGHTS.mediumValue, "Solid project valuation.");
  }

  score += corridorBoostForCounty(permit.sourceJurisdiction === "Waterloo" ? "Black Hawk" : "Linn");

  return { score, reasons, breakdown };
}

export function calculateLeadScore(builder: BuilderRecord): ScoreBreakdown {
  let total = 0;
  const reasons = new Set<string>();
  const breakdown: ScoreBreakdown["breakdown"] = [];

  for (const property of builder.properties) {
    for (const permit of property.permits) {
      const permitScore = scorePermit(permit);
      total += permitScore.score;
      permitScore.reasons.forEach((reason) => reasons.add(reason));
      breakdown.push(...permitScore.breakdown);
    }
  }

  total += builder.activeProperties * 4;
  total += builder.counties.length > 1 ? 10 : 4;
  total += builder.contact.email ? 8 : 0;
  total += builder.contact.phone ? 6 : 0;
  total += builder.preferredSalesName ? 8 : 0;
  total += builder.contactQualityTier === "high" ? 8 : builder.contactQualityTier === "medium" ? 4 : 0;
  total += builder.contractorMetrics.permitsLast30Days * 2;
  total += builder.contractorMetrics.outreachStatus === "partner" ? 6 : 0;
  total += builder.contractorMetrics.avgProjectValue >= 300000 ? 8 : builder.contractorMetrics.avgProjectValue >= 150000 ? 4 : 0;
  if (builder.contractorMetrics.projectTypes.some((type) => /garage|basement|addition|residential|shelving|insulation/i.test(type))) {
    reasons.add("Project types match insulation and shelving work.");
  }

  return {
    total: Math.min(100, total),
    reasons: [...reasons],
    breakdown
  };
}

export function calculateOpportunityScore(opportunity: PlotOpportunity) {
  let total = 0;
  const reasons: string[] = [];
  const breakdown: ScoreBreakdown["breakdown"] = [];

  if (
    opportunity.opportunityType === "vacant_lot_new_build" ||
    opportunity.opportunityType === "subdivision_lot"
  ) {
    total += addScore(breakdown, reasons, "plot_signal", 28, "Vacant or subdivision lot with new-build signal");
  }

  if (opportunity.classification === "single_family_home") {
    total += addScore(breakdown, reasons, "single_family", OPPORTUNITY_SCORING_WEIGHTS.singleFamily, "Single-family construction signal");
  }

  if (opportunity.classification === "multi_family") {
    total += addScore(breakdown, reasons, "multifamily", OPPORTUNITY_SCORING_WEIGHTS.multifamily, "Multifamily project with insulation scope");
  }

  if (opportunity.classification === "commercial") {
    total += addScore(breakdown, reasons, "commercial", OPPORTUNITY_SCORING_WEIGHTS.commercial, "Commercial lot with potential insulation or shelving scope");
  }

  if (opportunity.buildReadiness === "permit_review") {
    total += addScore(breakdown, reasons, "permit_review", OPPORTUNITY_SCORING_WEIGHTS.recentPermit, "Permit is in review");
  }

  if (opportunity.buildReadiness === "permit_issued") {
    total += addScore(breakdown, reasons, "permit_issued", OPPORTUNITY_SCORING_WEIGHTS.freshPermit, "Permit already issued");
    if (opportunity.recencyBucket === "0_7_days") {
      total += addScore(breakdown, reasons, "newly_issued", OPPORTUNITY_SCORING_WEIGHTS.newlyIssuedBoost, "Newly issued permit deserves immediate attention");
    }
  }

  if (opportunity.preferredSalesName) {
    total += addScore(breakdown, reasons, "builder_identified", OPPORTUNITY_SCORING_WEIGHTS.builderIdentified, "Builder identified");
  } else if (opportunity.rawSourceName) {
    total += addScore(breakdown, reasons, "related_entity_only", 2, "Related entity found, but contact still needs research");
  }

  if (opportunity.contactQualityBand === "tier_1" || opportunity.contactQualityBand === "tier_2") {
    total += addScore(breakdown, reasons, "strong_contact", OPPORTUNITY_SCORING_WEIGHTS.contactStrong, "Strong contact information available");
  } else if (opportunity.phone || opportunity.email || opportunity.website) {
    total += addScore(breakdown, reasons, "partial_contact", OPPORTUNITY_SCORING_WEIGHTS.contactPartial, "Some contact information available");
  } else {
    total += addScore(breakdown, reasons, "missing_contact", OPPORTUNITY_SCORING_WEIGHTS.noContactPenalty, "No direct contact information yet");
  }

  if (opportunity.jobFit === "both") {
    total += addScore(breakdown, reasons, "job_fit_both", OPPORTUNITY_SCORING_WEIGHTS.bothFit, "Strong fit for insulation and shelving");
  } else if (opportunity.jobFit === "insulation") {
    total += addScore(breakdown, reasons, "job_fit_insulation", OPPORTUNITY_SCORING_WEIGHTS.insulationFit, "Good insulation fit");
  } else if (opportunity.jobFit === "shelving") {
    total += addScore(breakdown, reasons, "job_fit_shelving", OPPORTUNITY_SCORING_WEIGHTS.shelvingFit, "Good shelving fit");
  } else {
    total += addScore(breakdown, reasons, "job_fit_low", OPPORTUNITY_SCORING_WEIGHTS.weakFit);
  }

  const projectValue = opportunity.estimatedProjectValue ?? opportunity.improvementValue ?? opportunity.landValue ?? 0;

  if (projectValue >= 400000) {
    total += addScore(breakdown, reasons, "high_value", OPPORTUNITY_SCORING_WEIGHTS.strongValue, "High-value project");
  } else if (projectValue >= 150000) {
    total += addScore(breakdown, reasons, "medium_value", OPPORTUNITY_SCORING_WEIGHTS.mediumValue, "Meaningful project value");
  }

  if (opportunity.recencyBucket === "0_7_days") {
    total += addScore(breakdown, reasons, "fresh_recency", OPPORTUNITY_SCORING_WEIGHTS.freshPermit, "Fresh lead from the last 7 days");
  } else if (opportunity.recencyBucket === "8_30_days") {
    total += addScore(breakdown, reasons, "recent_recency", OPPORTUNITY_SCORING_WEIGHTS.recentPermit);
  } else if (opportunity.recencyBucket === "31_90_days") {
    total += addScore(breakdown, reasons, "aging_recency", OPPORTUNITY_SCORING_WEIGHTS.noRecentActivityPenalty, "Lead is aging without a newer signal");
  } else if (opportunity.recencyBucket === "older") {
    total += addScore(breakdown, reasons, "older_recency", OPPORTUNITY_SCORING_WEIGHTS.stalePermit, "Older lead signal");
  }

  if (opportunity.projectStageStatus === "active") {
    total += addScore(breakdown, reasons, "active_stage", OPPORTUNITY_SCORING_WEIGHTS.activeStage);
  } else if (opportunity.projectStageStatus === "near_complete") {
    total += addScore(breakdown, reasons, "near_complete", OPPORTUNITY_SCORING_WEIGHTS.nearComplete);
  } else if (opportunity.projectStageStatus === "closed") {
    total += addScore(breakdown, reasons, "closed_stage", OPPORTUNITY_SCORING_WEIGHTS.closedPenalty, "Closed-stage opportunity");
  }

  if (opportunity.bidStatus === "researching_builder") {
    total += addScore(breakdown, reasons, "research_builder_penalty", -8, "Builder still needs contact research");
  }

  total += addScore(
    breakdown,
    reasons,
    "county_corridor",
    corridorBoostForCounty(opportunity.county),
    corridorBoostForCounty(opportunity.county) > 0 ? "Inside the target corridor" : undefined
  );

  if (opportunity.bidStatus === "quoted" || opportunity.bidStatus === "won" || opportunity.bidStatus === "lost") {
    total += addScore(breakdown, reasons, "closed_bid_status", OPPORTUNITY_SCORING_WEIGHTS.closedPenalty);
  }

  if (!opportunity.address && !opportunity.parcelNumber) {
    total += addScore(breakdown, reasons, "missing_location", OPPORTUNITY_SCORING_WEIGHTS.missingLocation);
  }

  if (opportunity.clusterId || opportunity.marketCluster) {
    total += addScore(breakdown, reasons, "cluster_activity", OPPORTUNITY_SCORING_WEIGHTS.clusterBoost, "Nearby cluster activity raises the odds of a larger builder push");
  }

  if (opportunity.preferredSalesName && opportunity.contactQualityBand !== "tier_5") {
    total += addScore(breakdown, reasons, "active_builder_identity", OPPORTUNITY_SCORING_WEIGHTS.activeBuilderBoost, "Resolved builder identity with usable contact coverage");
  }

  return {
    total: Math.max(0, Math.min(100, total)),
    reasons,
    breakdown
  };
}
