import { corridorBoostForCounty } from "@/lib/geo/territories";
import { BuilderRecord, PermitRecord, PlotOpportunity } from "@/types/domain";

export interface ScoreBreakdown {
  total: number;
  reasons: string[];
}

function scorePermit(permit: PermitRecord) {
  let score = 0;
  const reasons: string[] = [];

  if (permit.classification === "single_family_home") {
    score += 22;
    reasons.push("Single-family residential construction.");
  }

  if (permit.permitStatus.toLowerCase().includes("issued")) {
    score += 12;
    reasons.push("Permit already issued.");
  } else if (permit.permitStatus.toLowerCase().includes("review") || permit.permitStatus.toLowerCase().includes("applied")) {
    score += 8;
    reasons.push("Permit in early-stage review window.");
  }

  if ((permit.estimatedProjectValue ?? 0) >= 400000) {
    score += 10;
    reasons.push("High project valuation.");
  }

  score += corridorBoostForCounty(permit.sourceJurisdiction === "Waterloo" ? "Black Hawk" : "Linn");

  return { score, reasons };
}

export function calculateLeadScore(builder: BuilderRecord): ScoreBreakdown {
  let total = 0;
  const reasons = new Set<string>();

  for (const property of builder.properties) {
    for (const permit of property.permits) {
      const permitScore = scorePermit(permit);
      total += permitScore.score;
      permitScore.reasons.forEach((reason) => reasons.add(reason));
    }
  }

  total += builder.activeProperties * 4;
  total += builder.counties.length > 1 ? 10 : 4;
  total += builder.contact.email ? 8 : 0;
  total += builder.contact.phone ? 6 : 0;
  total += builder.preferredSalesName ? 8 : 0;
  total += builder.contactQualityTier === "high" ? 8 : builder.contactQualityTier === "medium" ? 4 : 0;

  return {
    total: Math.min(100, total),
    reasons: [...reasons]
  };
}

export function calculateOpportunityScore(opportunity: PlotOpportunity) {
  let total = 0;
  const reasons: string[] = [];

  if (
    opportunity.opportunityType === "vacant_lot_new_build" ||
    opportunity.opportunityType === "subdivision_lot"
  ) {
    total += 28;
    reasons.push("Vacant or subdivision lot with new-build signal");
  }

  if (opportunity.classification === "single_family_home") {
    total += 22;
    reasons.push("Single-family construction signal");
  }

  if (opportunity.classification === "multi_family") {
    total += 20;
    reasons.push("Multifamily project with insulation scope");
  }

  if (opportunity.classification === "commercial") {
    total += 18;
    reasons.push("Commercial lot with potential insulation or shelving scope");
  }

  if (opportunity.buildReadiness === "permit_review") {
    total += 14;
    reasons.push("Permit is in review");
  }

  if (opportunity.buildReadiness === "permit_issued") {
    total += 16;
    reasons.push("Permit already issued");
  }

  if (opportunity.preferredSalesName) {
    total += 10;
    reasons.push("Builder identified");
  } else if (opportunity.rawSourceName) {
    total += 2;
    reasons.push("Related entity found, but contact still needs research");
  }

  total += corridorBoostForCounty(opportunity.county);

  if (opportunity.bidStatus === "quoted" || opportunity.bidStatus === "won" || opportunity.bidStatus === "lost") {
    total -= 18;
  }

  if (!opportunity.address && !opportunity.parcelNumber) {
    total -= 12;
  }

  return {
    total: Math.max(0, Math.min(100, total)),
    reasons
  };
}
