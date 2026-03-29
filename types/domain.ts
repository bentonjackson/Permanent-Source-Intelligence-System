export type PipelineStage =
  | "New"
  | "Research Builder"
  | "Ready to Bid"
  | "Contacted"
  | "Quoted"
  | "Won"
  | "Lost"
  | "Not a Fit";

export type OpportunityType =
  | "vacant_lot_new_build"
  | "subdivision_lot"
  | "pre_issuance_home"
  | "issued_new_home"
  | "other_non_priority";

export type BuildReadiness =
  | "early_signal"
  | "plan_submitted"
  | "permit_review"
  | "permit_issued";

export type ProjectSegment =
  | "single_family"
  | "multifamily"
  | "commercial";

export type BidStatus =
  | "not_reviewed"
  | "researching_builder"
  | "ready_to_contact"
  | "contacted"
  | "bid_requested"
  | "quoted"
  | "won"
  | "lost"
  | "not_a_fit";

export type PermitClassification =
  | "new_residential_construction"
  | "single_family_home"
  | "multi_family"
  | "accessory_building"
  | "remodel_repair"
  | "commercial"
  | "unknown_needs_review";

export type SyncStatus = "idle" | "running" | "success" | "warning" | "failed";

export interface BuilderRecord {
  id: string;
  name: string;
  normalizedName: string;
  counties: string[];
  cities: string[];
  activeProperties: number;
  openOpportunities: number;
  leadScore: number;
  pipelineStage: PipelineStage;
  nextFollowUpDate: string | null;
  assignedRep: string;
  lastSeenLocation: string;
  contact: {
    phone: string | null;
    email: string | null;
    website: string | null;
  };
  properties: PropertyRecord[];
  openOpportunityIds: string[];
}

export interface PropertyRecord {
  id: string;
  address: string;
  city: string;
  county: string;
  subdivision: string | null;
  parcelNumber: string | null;
  lotNumber: string | null;
  permits: PermitRecord[];
  noteCount: number;
}

export interface PlotOpportunity {
  id: string;
  address: string;
  city: string;
  county: string;
  subdivision: string | null;
  parcelNumber: string | null;
  lotNumber: string | null;
  builderId: string | null;
  builderName: string | null;
  likelyCompanyName: string | null;
  permitNumber: string | null;
  sourceName: string;
  sourceJurisdiction: string;
  sourceUrl: string;
  signalDate: string;
  classification: PermitClassification;
  projectSegment: ProjectSegment;
  opportunityType: OpportunityType;
  buildReadiness: BuildReadiness;
  vacancyConfidence: number;
  opportunityScore: number;
  bidStatus: BidStatus;
  assignedRep: string;
  nextAction: string;
  nextFollowUpDate: string | null;
  contactStatus: string;
  notesCount: number;
  inquiredAt: string | null;
  needsFollowUp: boolean;
  suggestedFollowUpDate: string | null;
  secondFollowUpDate: string | null;
  followedUpOn: string | null;
  closedAt: string | null;
  notes: string[];
  reasonSummary: string[];
}

export interface PermitRecord {
  id: string;
  permitNumber: string;
  permitType: string;
  permitSubtype: string | null;
  permitStatus: string;
  applicationDate: string | null;
  issueDate: string | null;
  estimatedProjectValue: number | null;
  landValue: number | null;
  improvementValue: number | null;
  classification: PermitClassification;
  sourceJurisdiction: string;
  sourceName: string;
  sourceUrl: string;
}

export interface SourceRecord {
  id: string;
  name: string;
  slug: string;
  jurisdiction: string;
  county: string;
  city: string;
  sourceType: string;
  parserType: string;
  sourceUrl: string;
  active: boolean;
  syncFrequency: string;
  authRequired: boolean;
  lastSuccessfulSync: string | null;
  syncStatus: SyncStatus;
  sourceConfidenceScore: number;
  sourceFreshnessScore: number;
  logs: {
    timestamp: string;
    level: "info" | "warning" | "error";
    message: string;
  }[];
}

export interface DashboardSnapshot {
  topBuilders: BuilderRecord[];
  plotQueue: PlotOpportunity[];
  newestPermits: PermitRecord[];
  syncHealth: SourceRecord[];
  followUpsDue: PlotOpportunity[];
}
