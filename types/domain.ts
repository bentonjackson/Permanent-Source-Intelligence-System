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
export type ConnectorType = "document" | "search" | "portal" | "gis_planning";

export type EntityRoleType =
  | "builder"
  | "general_contractor"
  | "developer"
  | "owner"
  | "holding_company"
  | "person"
  | "unknown";

export type ContactQualityTier =
  | "high"
  | "medium"
  | "low"
  | "research_required";

export type ContactQualityBand =
  | "tier_1"
  | "tier_2"
  | "tier_3"
  | "tier_4"
  | "tier_5";

export type RegistrationStatus =
  | "active"
  | "inactive"
  | "unknown"
  | "pending"
  | "not_found";

export type SignalType =
  | "new_residential_permit"
  | "new_multifamily_permit"
  | "parcel_development"
  | "subdivision_plat"
  | "rezoning_land_use"
  | "planning_agenda"
  | "site_prep"
  | "utility_or_grading"
  | "cluster_activity"
  | "assessor_value_movement"
  | "other";

export type DevelopmentStage =
  | "early_land_signal"
  | "planning_review"
  | "plat_review"
  | "site_prep"
  | "permit_intake"
  | "permit_review"
  | "permit_issued";

export type SourceStrength = "high" | "medium" | "low";
export type ReadinessToContact = "now" | "soon" | "research" | "watch";
export type ContactResolutionStatus = "resolved" | "builder_only" | "weak_entity" | "unknown";
export type ReviewQueueType =
  | "parse_failure"
  | "weak_identity"
  | "ambiguous_match"
  | "missing_contact"
  | "missing_field"
  | "stale_source"
  | "duplicate_record"
  | "source_failure";
export type ReviewQueueStatus = "open" | "in_progress" | "resolved" | "dismissed";

export type OpportunityInterestStatus =
  | "unknown"
  | "interested"
  | "not_interested"
  | "quote_requested"
  | "quote_sent";

export type OpportunityOutcomeStatus =
  | "open"
  | "won"
  | "lost"
  | "not_a_fit";

export type PreferredContactMethod =
  | "call"
  | "email"
  | "text"
  | "website"
  | "linkedin"
  | "other";

export type ActivityType =
  | "called"
  | "left_voicemail"
  | "sent_email"
  | "received_email"
  | "texted"
  | "met"
  | "quote_discussed"
  | "follow_up_scheduled"
  | "note_added"
  | "status_changed";

export type ActivityDirection = "outbound" | "inbound" | "internal";

export interface EnrichmentAuditRecord {
  id: string;
  provider: string;
  fieldName: string | null;
  fieldValue: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  rationale: string | null;
  confidence: number;
  refreshedAt: string;
  lastVerifiedAt: string | null;
}

export interface EntityMatchRecord {
  id: string;
  rawSourceName: string;
  normalizedEntityName: string;
  preferredSalesName: string | null;
  fingerprint: string;
  roleType: EntityRoleType;
  roleConfidenceScore: number;
  matchScore: number;
  matchStrategy: string;
  sourceLabel: string;
  sourceUrl: string | null;
  rationale: string | null;
  isPrimary: boolean;
  lastCheckedAt: string;
}

export interface BuilderRecord {
  id: string;
  name: string;
  normalizedName: string;
  rawSourceName: string | null;
  preferredSalesName: string | null;
  legalEntityName: string | null;
  aliases: string[];
  roleType: EntityRoleType;
  entityConfidenceScore: number;
  roleConfidenceScore: number;
  contactQualityTier: ContactQualityTier;
  contactQualityBand: ContactQualityBand;
  contactQualityScore: number;
  preferredContactTarget: string | null;
  contractorRegistrationNumber: string | null;
  contractorRegistrationStatus: RegistrationStatus;
  businessEntityNumber: string | null;
  businessEntityStatus: RegistrationStatus;
  mailingAddress: string | null;
  cityState: string | null;
  lastEnrichedAt: string | null;
  nextBestAction: string;
  builderHeatScore: number;
  counties: string[];
  cities: string[];
  activeProperties: number;
  openOpportunities: number;
  leadScore: number;
  totalEstimatedValue: number;
  totalLandValue: number;
  totalImprovementValue: number;
  pipelineStage: PipelineStage;
  nextFollowUpDate: string | null;
  assignedRep: string;
  lastSeenLocation: string;
  lastActivityAt: string | null;
  contact: {
    phone: string | null;
    email: string | null;
    website: string | null;
    sourceLabel?: string | null;
    sourceUrl?: string | null;
  };
  properties: PropertyRecord[];
  openOpportunityIds: string[];
  entityMatches: EntityMatchRecord[];
  enrichmentAudit: EnrichmentAuditRecord[];
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

export interface OpportunityContact {
  id: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  roleTitle: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  officePhone: string | null;
  website: string | null;
  linkedinUrl: string | null;
  preferredContactMethod: PreferredContactMethod | null;
  bestTimeToContact: string | null;
  notes: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  confidenceScore: number;
  qualityScore: number;
  qualityBand: ContactQualityBand;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string | null;
}

export interface OpportunityActivity {
  id: string;
  contactId: string | null;
  contactName: string | null;
  activityType: ActivityType;
  activityDirection: ActivityDirection;
  occurredAt: string;
  outcome: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface OpportunityStageHistoryRecord {
  id: string;
  fromStage: PipelineStage | null;
  toStage: PipelineStage;
  fromBidStatus: BidStatus | null;
  toBidStatus: BidStatus;
  note: string | null;
  sourceLabel: string | null;
  changedBy: string | null;
  changedAt: string;
}

export interface OpportunityContactSnapshotRecord {
  primaryEntityId: string | null;
  primaryEntityName: string | null;
  primaryContactId: string | null;
  primaryContactName: string | null;
  primaryPhone: string | null;
  primaryEmail: string | null;
  primaryWebsite: string | null;
  contactQualityTier: ContactQualityTier;
  contactQualityBand: ContactQualityBand;
  contactQualityScore: number;
  entityConfidenceScore: number;
  nextBestAction: string | null;
  contactResolutionStatus: ContactResolutionStatus;
  resolutionNotes: string | null;
  lastContactResolutionRunAt: string | null;
}

export interface ReviewQueueItemRecord {
  id: string;
  reviewType: ReviewQueueType;
  status: ReviewQueueStatus;
  priority: number;
  title: string;
  details: string | null;
  rationale: string | null;
  sourceUrl: string | null;
  confidenceScore: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  sourceName: string | null;
  builderName: string | null;
  opportunityId: string | null;
}

export interface PlotOpportunity {
  id: string;
  assignedMembershipId: string | null;
  address: string;
  city: string;
  county: string;
  subdivision: string | null;
  parcelNumber: string | null;
  lotNumber: string | null;
  builderId: string | null;
  builderName: string | null;
  likelyCompanyName: string | null;
  rawSourceName: string | null;
  normalizedEntityName: string | null;
  preferredSalesName: string | null;
  legalEntityName: string | null;
  aliases: string[];
  roleType: EntityRoleType;
  entityConfidenceScore: number;
  roleConfidenceScore: number;
  contactQualityTier: ContactQualityTier;
  contactQualityBand: ContactQualityBand;
  contactQualityScore: number;
  preferredContactTarget: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  contractorRegistrationNumber: string | null;
  contractorRegistrationStatus: RegistrationStatus;
  businessEntityNumber: string | null;
  businessEntityStatus: RegistrationStatus;
  mailingAddress: string | null;
  cityState: string | null;
  lastEnrichedAt: string | null;
  permitNumber: string | null;
  sourceName: string;
  sourceJurisdiction: string;
  sourceUrl: string;
  signalType: SignalType;
  developmentStage: DevelopmentStage;
  sourceStrength: SourceStrength;
  readinessToContact: ReadinessToContact;
  clusterId: string | null;
  signalDate: string;
  estimatedProjectValue: number | null;
  landValue: number | null;
  improvementValue: number | null;
  classification: PermitClassification;
  projectSegment: ProjectSegment;
  opportunityType: OpportunityType;
  buildReadiness: BuildReadiness;
  vacancyConfidence: number;
  opportunityScore: number;
  bidStatus: BidStatus;
  currentStage: PipelineStage;
  assignedRep: string;
  nextAction: string;
  contactedAt: string | null;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  followUpNeeded: boolean;
  interestStatus: OpportunityInterestStatus;
  outcomeStatus: OpportunityOutcomeStatus;
  contactSummary: string | null;
  notesSummary: string | null;
  outreachCount: number;
  callCount: number;
  emailCount: number;
  textCount: number;
  reasonLost: string | null;
  internalNotes: string | null;
  externalSummary: string | null;
  quoteRequestedAt: string | null;
  quoteSentAt: string | null;
  nextFollowUpDate: string | null;
  contactStatus: string;
  notesCount: number;
  inquiredAt: string | null;
  needsFollowUp: boolean;
  contactResolutionStatus: ContactResolutionStatus;
  lastContactResolutionRunAt: string | null;
  suggestedFollowUpDate: string | null;
  secondFollowUpDate: string | null;
  followedUpOn: string | null;
  closedAt: string | null;
  notes: string[];
  reasonSummary: string[];
  contacts: OpportunityContact[];
  activities: OpportunityActivity[];
  stageHistory: OpportunityStageHistoryRecord[];
  contactSnapshot: OpportunityContactSnapshotRecord | null;
  entityMatches: EntityMatchRecord[];
  enrichmentAudit: EnrichmentAuditRecord[];
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
  sourceScope?: "city" | "county" | "supplemental" | "manual";
  countyRadiusEligible?: boolean;
  countySelectorVisible?: boolean;
  officialSourceType?: string;
  connectorType: ConnectorType;
  priorityRank: number;
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
  lastHealthCheckedAt?: string | null;
  parseFailureCount?: number;
  missingFieldCount?: number;
  duplicateCount?: number;
  openReviewCount?: number;
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
