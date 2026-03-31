import {
  BidStatus as PrismaBidStatus,
  BuildReadiness as PrismaBuildReadiness,
  ContactResolutionStatus as PrismaContactResolutionStatus,
  ContactQualityBand as PrismaContactQualityBand,
  ContactQualityTier as PrismaContactQualityTier,
  DevelopmentStage as PrismaDevelopmentStage,
  EntityRoleType as PrismaEntityRoleType,
  OpportunityType as PrismaOpportunityType,
  PipelineStage as PrismaPipelineStage,
  PermitClassification as PrismaPermitClassification,
  PlotOpportunity as PrismaPlotOpportunity,
  ProjectSegment as PrismaProjectSegment,
  ReadinessToContact as PrismaReadinessToContact,
  RegistrationStatus as PrismaRegistrationStatus,
  SignalType as PrismaSignalType,
  SourceStrength as PrismaSourceStrength,
  Prisma
} from "@prisma/client";

import {
  BidStatus,
  BuildReadiness,
  ContactResolutionStatus,
  ContactQualityBand,
  ContactQualityTier,
  DevelopmentStage,
  EntityRoleType,
  OpportunityType,
  PipelineStage,
  PermitClassification,
  PlotOpportunity,
  ProjectSegment,
  ReadinessToContact,
  RegistrationStatus,
  SignalType,
  SourceStrength
} from "@/types/domain";

const bidStatusToPrisma: Record<BidStatus, PrismaBidStatus> = {
  not_reviewed: PrismaBidStatus.NOT_REVIEWED,
  researching_builder: PrismaBidStatus.RESEARCHING_BUILDER,
  ready_to_contact: PrismaBidStatus.READY_TO_CONTACT,
  contacted: PrismaBidStatus.CONTACTED,
  bid_requested: PrismaBidStatus.BID_REQUESTED,
  quoted: PrismaBidStatus.QUOTED,
  won: PrismaBidStatus.WON,
  lost: PrismaBidStatus.LOST,
  not_a_fit: PrismaBidStatus.NOT_A_FIT
};

const bidStatusFromPrisma: Record<PrismaBidStatus, BidStatus> = {
  NOT_REVIEWED: "not_reviewed",
  RESEARCHING_BUILDER: "researching_builder",
  READY_TO_CONTACT: "ready_to_contact",
  CONTACTED: "contacted",
  BID_REQUESTED: "bid_requested",
  QUOTED: "quoted",
  WON: "won",
  LOST: "lost",
  NOT_A_FIT: "not_a_fit"
};

const buildReadinessToPrisma: Record<BuildReadiness, PrismaBuildReadiness> = {
  early_signal: PrismaBuildReadiness.EARLY_SIGNAL,
  plan_submitted: PrismaBuildReadiness.PLAN_SUBMITTED,
  permit_review: PrismaBuildReadiness.PERMIT_REVIEW,
  permit_issued: PrismaBuildReadiness.PERMIT_ISSUED
};

const buildReadinessFromPrisma: Record<PrismaBuildReadiness, BuildReadiness> = {
  EARLY_SIGNAL: "early_signal",
  PLAN_SUBMITTED: "plan_submitted",
  PERMIT_REVIEW: "permit_review",
  PERMIT_ISSUED: "permit_issued"
};

const signalTypeToPrisma: Record<SignalType, PrismaSignalType> = {
  new_residential_permit: PrismaSignalType.NEW_RESIDENTIAL_PERMIT,
  new_multifamily_permit: PrismaSignalType.NEW_MULTIFAMILY_PERMIT,
  parcel_development: PrismaSignalType.PARCEL_DEVELOPMENT,
  subdivision_plat: PrismaSignalType.SUBDIVISION_PLAT,
  rezoning_land_use: PrismaSignalType.REZONING_LAND_USE,
  planning_agenda: PrismaSignalType.PLANNING_AGENDA,
  site_prep: PrismaSignalType.SITE_PREP,
  utility_or_grading: PrismaSignalType.UTILITY_OR_GRADING,
  cluster_activity: PrismaSignalType.CLUSTER_ACTIVITY,
  assessor_value_movement: PrismaSignalType.ASSESSOR_VALUE_MOVEMENT,
  other: PrismaSignalType.OTHER
};

const signalTypeFromPrisma: Record<PrismaSignalType, SignalType> = {
  NEW_RESIDENTIAL_PERMIT: "new_residential_permit",
  NEW_MULTIFAMILY_PERMIT: "new_multifamily_permit",
  PARCEL_DEVELOPMENT: "parcel_development",
  SUBDIVISION_PLAT: "subdivision_plat",
  REZONING_LAND_USE: "rezoning_land_use",
  PLANNING_AGENDA: "planning_agenda",
  SITE_PREP: "site_prep",
  UTILITY_OR_GRADING: "utility_or_grading",
  CLUSTER_ACTIVITY: "cluster_activity",
  ASSESSOR_VALUE_MOVEMENT: "assessor_value_movement",
  OTHER: "other"
};

const developmentStageToPrisma: Record<DevelopmentStage, PrismaDevelopmentStage> = {
  early_land_signal: PrismaDevelopmentStage.EARLY_LAND_SIGNAL,
  planning_review: PrismaDevelopmentStage.PLANNING_REVIEW,
  plat_review: PrismaDevelopmentStage.PLAT_REVIEW,
  site_prep: PrismaDevelopmentStage.SITE_PREP,
  permit_intake: PrismaDevelopmentStage.PERMIT_INTAKE,
  permit_review: PrismaDevelopmentStage.PERMIT_REVIEW,
  permit_issued: PrismaDevelopmentStage.PERMIT_ISSUED
};

const developmentStageFromPrisma: Record<PrismaDevelopmentStage, DevelopmentStage> = {
  EARLY_LAND_SIGNAL: "early_land_signal",
  PLANNING_REVIEW: "planning_review",
  PLAT_REVIEW: "plat_review",
  SITE_PREP: "site_prep",
  PERMIT_INTAKE: "permit_intake",
  PERMIT_REVIEW: "permit_review",
  PERMIT_ISSUED: "permit_issued"
};

const sourceStrengthToPrisma: Record<SourceStrength, PrismaSourceStrength> = {
  high: PrismaSourceStrength.HIGH,
  medium: PrismaSourceStrength.MEDIUM,
  low: PrismaSourceStrength.LOW
};

const sourceStrengthFromPrisma: Record<PrismaSourceStrength, SourceStrength> = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low"
};

const readinessToContactToPrisma: Record<ReadinessToContact, PrismaReadinessToContact> = {
  now: PrismaReadinessToContact.NOW,
  soon: PrismaReadinessToContact.SOON,
  research: PrismaReadinessToContact.RESEARCH,
  watch: PrismaReadinessToContact.WATCH
};

const readinessToContactFromPrisma: Record<PrismaReadinessToContact, ReadinessToContact> = {
  NOW: "now",
  SOON: "soon",
  RESEARCH: "research",
  WATCH: "watch"
};

const contactResolutionStatusToPrisma: Record<ContactResolutionStatus, PrismaContactResolutionStatus> = {
  resolved: PrismaContactResolutionStatus.RESOLVED,
  builder_only: PrismaContactResolutionStatus.BUILDER_ONLY,
  weak_entity: PrismaContactResolutionStatus.WEAK_ENTITY,
  unknown: PrismaContactResolutionStatus.UNKNOWN
};

const contactResolutionStatusFromPrisma: Record<PrismaContactResolutionStatus, ContactResolutionStatus> = {
  RESOLVED: "resolved",
  BUILDER_ONLY: "builder_only",
  WEAK_ENTITY: "weak_entity",
  UNKNOWN: "unknown"
};

const opportunityTypeToPrisma: Record<OpportunityType, PrismaOpportunityType> = {
  vacant_lot_new_build: PrismaOpportunityType.VACANT_LOT_NEW_BUILD,
  subdivision_lot: PrismaOpportunityType.SUBDIVISION_LOT,
  pre_issuance_home: PrismaOpportunityType.PRE_ISSUANCE_HOME,
  issued_new_home: PrismaOpportunityType.ISSUED_NEW_HOME,
  other_non_priority: PrismaOpportunityType.OTHER_NON_PRIORITY
};

const opportunityTypeFromPrisma: Record<PrismaOpportunityType, OpportunityType> = {
  VACANT_LOT_NEW_BUILD: "vacant_lot_new_build",
  SUBDIVISION_LOT: "subdivision_lot",
  PRE_ISSUANCE_HOME: "pre_issuance_home",
  ISSUED_NEW_HOME: "issued_new_home",
  OTHER_NON_PRIORITY: "other_non_priority"
};

const classificationToPrisma: Record<PermitClassification, PrismaPermitClassification> = {
  new_residential_construction: PrismaPermitClassification.NEW_RESIDENTIAL_CONSTRUCTION,
  single_family_home: PrismaPermitClassification.SINGLE_FAMILY_HOME,
  multi_family: PrismaPermitClassification.MULTI_FAMILY,
  accessory_building: PrismaPermitClassification.ACCESSORY_BUILDING,
  remodel_repair: PrismaPermitClassification.REMODEL_REPAIR,
  commercial: PrismaPermitClassification.COMMERCIAL,
  unknown_needs_review: PrismaPermitClassification.UNKNOWN_NEEDS_REVIEW
};

const classificationFromPrisma: Record<PrismaPermitClassification, PermitClassification> = {
  NEW_RESIDENTIAL_CONSTRUCTION: "new_residential_construction",
  SINGLE_FAMILY_HOME: "single_family_home",
  MULTI_FAMILY: "multi_family",
  ACCESSORY_BUILDING: "accessory_building",
  REMODEL_REPAIR: "remodel_repair",
  COMMERCIAL: "commercial",
  UNKNOWN_NEEDS_REVIEW: "unknown_needs_review"
};

const projectSegmentToPrisma: Record<ProjectSegment, PrismaProjectSegment> = {
  single_family: PrismaProjectSegment.SINGLE_FAMILY,
  multifamily: PrismaProjectSegment.MULTIFAMILY,
  commercial: PrismaProjectSegment.COMMERCIAL
};

const projectSegmentFromPrisma: Record<PrismaProjectSegment, ProjectSegment> = {
  SINGLE_FAMILY: "single_family",
  MULTIFAMILY: "multifamily",
  COMMERCIAL: "commercial"
};

const entityRoleTypeToPrisma: Record<EntityRoleType, PrismaEntityRoleType> = {
  builder: PrismaEntityRoleType.BUILDER,
  general_contractor: PrismaEntityRoleType.GENERAL_CONTRACTOR,
  developer: PrismaEntityRoleType.DEVELOPER,
  owner: PrismaEntityRoleType.OWNER,
  holding_company: PrismaEntityRoleType.HOLDING_COMPANY,
  person: PrismaEntityRoleType.PERSON,
  unknown: PrismaEntityRoleType.UNKNOWN
};

const entityRoleTypeFromPrisma: Record<PrismaEntityRoleType, EntityRoleType> = {
  BUILDER: "builder",
  GENERAL_CONTRACTOR: "general_contractor",
  DEVELOPER: "developer",
  OWNER: "owner",
  HOLDING_COMPANY: "holding_company",
  PERSON: "person",
  UNKNOWN: "unknown"
};

const contactQualityTierToPrisma: Record<ContactQualityTier, PrismaContactQualityTier> = {
  high: PrismaContactQualityTier.HIGH,
  medium: PrismaContactQualityTier.MEDIUM,
  low: PrismaContactQualityTier.LOW,
  research_required: PrismaContactQualityTier.RESEARCH_REQUIRED
};

const contactQualityTierFromPrisma: Record<PrismaContactQualityTier, ContactQualityTier> = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  RESEARCH_REQUIRED: "research_required"
};

const contactQualityBandToPrisma: Record<ContactQualityBand, PrismaContactQualityBand> = {
  tier_1: PrismaContactQualityBand.TIER_1,
  tier_2: PrismaContactQualityBand.TIER_2,
  tier_3: PrismaContactQualityBand.TIER_3,
  tier_4: PrismaContactQualityBand.TIER_4,
  tier_5: PrismaContactQualityBand.TIER_5
};

const contactQualityBandFromPrisma: Record<PrismaContactQualityBand, ContactQualityBand> = {
  TIER_1: "tier_1",
  TIER_2: "tier_2",
  TIER_3: "tier_3",
  TIER_4: "tier_4",
  TIER_5: "tier_5"
};

const registrationStatusToPrisma: Record<RegistrationStatus, PrismaRegistrationStatus> = {
  active: PrismaRegistrationStatus.ACTIVE,
  inactive: PrismaRegistrationStatus.INACTIVE,
  unknown: PrismaRegistrationStatus.UNKNOWN,
  pending: PrismaRegistrationStatus.PENDING,
  not_found: PrismaRegistrationStatus.NOT_FOUND
};

const registrationStatusFromPrisma: Record<PrismaRegistrationStatus, RegistrationStatus> = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  UNKNOWN: "unknown",
  PENDING: "pending",
  NOT_FOUND: "not_found"
};

const pipelineStageToPrisma: Record<PipelineStage, PrismaPipelineStage> = {
  New: PrismaPipelineStage.NEW,
  "Research Builder": PrismaPipelineStage.RESEARCH_BUILDER,
  "Ready to Bid": PrismaPipelineStage.READY_TO_BID,
  Contacted: PrismaPipelineStage.CONTACTED,
  Quoted: PrismaPipelineStage.QUOTED,
  Won: PrismaPipelineStage.WON,
  Lost: PrismaPipelineStage.LOST,
  "Not a Fit": PrismaPipelineStage.NOT_A_FIT
};

const pipelineStageFromPrisma: Record<PrismaPipelineStage, PipelineStage> = {
  NEW: "New",
  RESEARCH_BUILDER: "Research Builder",
  READY_TO_BID: "Ready to Bid",
  CONTACTED: "Contacted",
  QUOTED: "Quoted",
  WON: "Won",
  LOST: "Lost",
  NOT_A_FIT: "Not a Fit"
};

function toNullableDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export function opportunityToPersistenceData(opportunity: PlotOpportunity, organizationId: string) {
  return {
    id: opportunity.id,
    organizationId,
    assignedMembershipId: opportunity.assignedMembershipId,
    opportunityIdentityKey: opportunity.opportunityIdentityKey || null,
    sourceFingerprint: opportunity.sourceFingerprint || null,
    sourceRecordVersion: opportunity.sourceRecordVersion,
    lastSourceChangedAt: toNullableDate(opportunity.lastSourceChangedAt),
    scoreBreakdown: toJsonValue(opportunity.scoreBreakdown),
    requiresReview: opportunity.requiresReview,
    duplicateRiskScore: opportunity.duplicateRiskScore,
    address: opportunity.address || null,
    city: opportunity.city || null,
    county: opportunity.county || null,
    subdivision: opportunity.subdivision || null,
    parcelNumber: opportunity.parcelNumber || null,
    lotNumber: opportunity.lotNumber || null,
    builderName: opportunity.builderName || null,
    likelyCompanyName: opportunity.likelyCompanyName || null,
    rawSourceName: opportunity.rawSourceName || null,
    normalizedEntityName: opportunity.normalizedEntityName || null,
    preferredSalesName: opportunity.preferredSalesName || null,
    legalEntityName: opportunity.legalEntityName || null,
    roleType: entityRoleTypeToPrisma[opportunity.roleType],
    entityConfidenceScore: opportunity.entityConfidenceScore,
    roleConfidenceScore: opportunity.roleConfidenceScore,
    contactQualityTier: contactQualityTierToPrisma[opportunity.contactQualityTier],
    contactQualityScore: opportunity.contactQualityScore,
    contactQualityBand: contactQualityBandToPrisma[opportunity.contactQualityBand],
    preferredContactTarget: opportunity.preferredContactTarget || null,
    contractorRegistrationNumber: opportunity.contractorRegistrationNumber || null,
    contractorRegistrationStatus: registrationStatusToPrisma[opportunity.contractorRegistrationStatus],
    businessEntityNumber: opportunity.businessEntityNumber || null,
    businessEntityStatus: registrationStatusToPrisma[opportunity.businessEntityStatus],
    mailingAddress: opportunity.mailingAddress || null,
    cityState: opportunity.cityState || null,
    permitNumber: opportunity.permitNumber || null,
    sourceName: opportunity.sourceName || null,
    sourceJurisdiction: opportunity.sourceJurisdiction || null,
    sourceUrl: opportunity.sourceUrl || null,
    classification: classificationToPrisma[opportunity.classification],
    signalType: signalTypeToPrisma[opportunity.signalType],
    developmentStage: developmentStageToPrisma[opportunity.developmentStage],
    sourceStrength: sourceStrengthToPrisma[opportunity.sourceStrength],
    readinessToContact: readinessToContactToPrisma[opportunity.readinessToContact],
    clusterId: opportunity.clusterId || null,
    projectSegment: projectSegmentToPrisma[opportunity.projectSegment],
    opportunityType: opportunityTypeToPrisma[opportunity.opportunityType],
    buildReadiness: buildReadinessToPrisma[opportunity.buildReadiness],
    bidStatus: bidStatusToPrisma[opportunity.bidStatus],
    vacancyConfidence: opportunity.vacancyConfidence,
    opportunityScore: opportunity.opportunityScore,
    currentStage: pipelineStageToPrisma[opportunity.currentStage],
    contactedAt: toNullableDate(opportunity.contactedAt),
    lastContactedAt: toNullableDate(opportunity.lastContactedAt),
    nextFollowUpAt: toNullableDate(opportunity.nextFollowUpAt),
    followUpNeeded: opportunity.followUpNeeded,
    interestStatus: opportunity.interestStatus,
    outcomeStatus: opportunity.outcomeStatus,
    contactSummary: opportunity.contactSummary || null,
    notesSummary: opportunity.notesSummary || null,
    outreachCount: opportunity.outreachCount,
    callCount: opportunity.callCount,
    emailCount: opportunity.emailCount,
    textCount: opportunity.textCount,
    reasonLost: opportunity.reasonLost || null,
    internalNotes: opportunity.internalNotes || null,
    externalSummary: opportunity.externalSummary || null,
    quoteRequestedAt: toNullableDate(opportunity.quoteRequestedAt),
    quoteSentAt: toNullableDate(opportunity.quoteSentAt),
    contactStatus: opportunity.contactStatus || null,
    nextAction: opportunity.nextAction || null,
    nextFollowUpDate: toNullableDate(opportunity.nextFollowUpDate),
    inquiredAt: toNullableDate(opportunity.inquiredAt),
    needsFollowUp: opportunity.needsFollowUp,
    contactResolutionStatus: contactResolutionStatusToPrisma[opportunity.contactResolutionStatus],
    lastContactResolutionRunAt: toNullableDate(opportunity.lastContactResolutionRunAt),
    suggestedFollowUpDate: toNullableDate(opportunity.suggestedFollowUpDate),
    secondFollowUpDate: toNullableDate(opportunity.secondFollowUpDate),
    followedUpOn: toNullableDate(opportunity.followedUpOn),
    notes: opportunity.notes,
    closedAt: toNullableDate(opportunity.closedAt),
    signalDate: new Date(opportunity.signalDate),
    matchProvenance: toJsonValue({
      preferredContactTarget: opportunity.preferredContactTarget,
      entityMatches: opportunity.entityMatches,
      enrichmentAudit: opportunity.enrichmentAudit
    }),
    lastEnrichedAt: toNullableDate(opportunity.lastEnrichedAt),
    sourceEvidence: toJsonValue({
      reasonSummary: opportunity.reasonSummary,
      sourceUrl: opportunity.sourceUrl,
      sourceName: opportunity.sourceName,
      leadType: opportunity.leadType,
      jobFit: opportunity.jobFit,
      projectStageStatus: opportunity.projectStageStatus,
      opportunityReason: opportunity.opportunityReason,
      recencyBucket: opportunity.recencyBucket,
      marketCluster: opportunity.marketCluster,
      addressState: opportunity.addressState,
      addressZip: opportunity.addressZip,
      neighborhood: opportunity.neighborhood,
      propertyIdentityKey: opportunity.propertyIdentityKey,
      permitIdentityKey: opportunity.permitIdentityKey,
      builderIdentityKey: opportunity.builderIdentityKey,
      sourceChangeSummary: opportunity.sourceChangeSummary
    })
  };
}

function parseNotes(value: PrismaPlotOpportunity["notes"]) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split("\n").map((entry) => entry.trim()).filter(Boolean);
  }

  if (value && typeof value === "object" && "notes" in value && Array.isArray((value as { notes?: unknown[] }).notes)) {
    return (value as { notes?: unknown[] }).notes!.map((entry) => String(entry)).filter(Boolean);
  }

  return [];
}

export function persistenceRowToOpportunity(row: PrismaPlotOpportunity): PlotOpportunity {
  const notes = parseNotes(row.notes);
  const sourceEvidence =
    row.sourceEvidence && typeof row.sourceEvidence === "object"
      ? (row.sourceEvidence as {
          reasonSummary?: unknown[];
          leadType?: PlotOpportunity["leadType"];
          jobFit?: PlotOpportunity["jobFit"];
          projectStageStatus?: PlotOpportunity["projectStageStatus"];
          opportunityReason?: PlotOpportunity["opportunityReason"];
          recencyBucket?: PlotOpportunity["recencyBucket"];
          marketCluster?: string | null;
          addressState?: string | null;
          addressZip?: string | null;
          neighborhood?: string | null;
          propertyIdentityKey?: string | null;
          permitIdentityKey?: string | null;
          builderIdentityKey?: string | null;
          sourceChangeSummary?: string[];
        })
      : null;
  const reasonSummary =
    sourceEvidence && "reasonSummary" in sourceEvidence
      ? Array.isArray(sourceEvidence.reasonSummary)
        ? sourceEvidence.reasonSummary!.map((entry) => String(entry))
        : []
      : [];

  return {
    id: row.id,
    assignedMembershipId: row.assignedMembershipId ?? null,
    opportunityIdentityKey: row.opportunityIdentityKey ?? null,
    propertyIdentityKey: sourceEvidence?.propertyIdentityKey ?? null,
    permitIdentityKey: sourceEvidence?.permitIdentityKey ?? null,
    builderIdentityKey: sourceEvidence?.builderIdentityKey ?? null,
    sourceFingerprint: row.sourceFingerprint ?? null,
    sourceRecordVersion: row.sourceRecordVersion ?? 1,
    lastSourceChangedAt: row.lastSourceChangedAt?.toISOString() ?? null,
    sourceChangeSummary:
      sourceEvidence && Array.isArray(sourceEvidence.sourceChangeSummary)
        ? sourceEvidence.sourceChangeSummary.map((entry) => String(entry))
        : [],
    scoreBreakdown: Array.isArray(row.scoreBreakdown)
      ? row.scoreBreakdown
          .map((entry) =>
            entry && typeof entry === "object" && "label" in entry && "value" in entry
              ? {
                  label: String((entry as { label: unknown }).label),
                  value: Number((entry as { value: unknown }).value)
                }
              : null
          )
          .filter(
            (
              entry
            ): entry is PlotOpportunity["scoreBreakdown"][number] =>
              entry !== null && Number.isFinite(entry.value)
          )
      : [],
    requiresReview: row.requiresReview,
    duplicateRiskScore: row.duplicateRiskScore,
    address: row.address ?? "",
    city: row.city ?? "",
    county: row.county ?? "",
    subdivision: row.subdivision ?? null,
    parcelNumber: row.parcelNumber ?? null,
    lotNumber: row.lotNumber ?? null,
    builderId: row.builderId ?? null,
    builderName: row.builderName ?? null,
    likelyCompanyName: row.likelyCompanyName ?? null,
    rawSourceName: row.rawSourceName ?? null,
    normalizedEntityName: row.normalizedEntityName ?? null,
    preferredSalesName: row.preferredSalesName ?? null,
    legalEntityName: row.legalEntityName ?? null,
    aliases: [],
    roleType: entityRoleTypeFromPrisma[row.roleType],
    entityConfidenceScore: row.entityConfidenceScore,
    roleConfidenceScore: row.roleConfidenceScore,
    contactQualityTier: contactQualityTierFromPrisma[row.contactQualityTier],
    contactQualityBand: contactQualityBandFromPrisma[row.contactQualityBand],
    contactQualityScore: row.contactQualityScore,
    preferredContactTarget: row.preferredContactTarget ?? null,
    phone: null,
    email: null,
    website: null,
    contractorRegistrationNumber: row.contractorRegistrationNumber ?? null,
    contractorRegistrationStatus: registrationStatusFromPrisma[row.contractorRegistrationStatus],
    businessEntityNumber: row.businessEntityNumber ?? null,
    businessEntityStatus: registrationStatusFromPrisma[row.businessEntityStatus],
    mailingAddress: row.mailingAddress ?? null,
    cityState: row.cityState ?? null,
    lastEnrichedAt: row.lastEnrichedAt?.toISOString() ?? null,
    permitNumber: row.permitNumber ?? null,
    sourceName: row.sourceName ?? "Official source",
    sourceJurisdiction: row.sourceJurisdiction ?? "",
    sourceUrl: row.sourceUrl ?? "",
    signalType: signalTypeFromPrisma[row.signalType],
    developmentStage: developmentStageFromPrisma[row.developmentStage],
    sourceStrength: sourceStrengthFromPrisma[row.sourceStrength],
    readinessToContact: readinessToContactFromPrisma[row.readinessToContact],
    clusterId: row.clusterId ?? null,
    signalDate: row.signalDate.toISOString(),
    addressState: sourceEvidence?.addressState ?? "IA",
    addressZip: sourceEvidence?.addressZip ?? null,
    neighborhood: sourceEvidence?.neighborhood ?? null,
    estimatedProjectValue: null,
    landValue: null,
    improvementValue: null,
    classification: classificationFromPrisma[row.classification],
    projectSegment: projectSegmentFromPrisma[row.projectSegment],
    leadType: sourceEvidence?.leadType ?? "unknown",
    jobFit: sourceEvidence?.jobFit ?? "low",
    projectStageStatus: sourceEvidence?.projectStageStatus ?? "new",
    opportunityReason: sourceEvidence?.opportunityReason ?? "unknown",
    recencyBucket: sourceEvidence?.recencyBucket ?? "older",
    marketCluster: sourceEvidence?.marketCluster ?? row.clusterId ?? null,
    opportunityType: opportunityTypeFromPrisma[row.opportunityType],
    buildReadiness: buildReadinessFromPrisma[row.buildReadiness],
    vacancyConfidence: row.vacancyConfidence,
    opportunityScore: row.opportunityScore,
    bidStatus: bidStatusFromPrisma[row.bidStatus],
    currentStage: pipelineStageFromPrisma[row.currentStage],
    assignedRep: "Open Territory",
    nextAction: row.nextAction ?? "Review opportunity",
    contactedAt: row.contactedAt?.toISOString() ?? null,
    lastContactedAt: row.lastContactedAt?.toISOString() ?? null,
    nextFollowUpAt: row.nextFollowUpAt?.toISOString() ?? null,
    followUpNeeded: row.followUpNeeded,
    interestStatus:
      (row.interestStatus as PlotOpportunity["interestStatus"] | null) ?? "unknown",
    outcomeStatus:
      (row.outcomeStatus as PlotOpportunity["outcomeStatus"] | null) ?? "open",
    contactSummary: row.contactSummary ?? null,
    notesSummary: row.notesSummary ?? null,
    outreachCount: row.outreachCount,
    callCount: row.callCount,
    emailCount: row.emailCount,
    textCount: row.textCount,
    reasonLost: row.reasonLost ?? null,
    internalNotes: row.internalNotes ?? null,
    externalSummary: row.externalSummary ?? null,
    quoteRequestedAt: row.quoteRequestedAt?.toISOString() ?? null,
    quoteSentAt: row.quoteSentAt?.toISOString() ?? null,
    nextFollowUpDate: row.nextFollowUpDate?.toISOString() ?? null,
    contactStatus: row.contactStatus ?? "Needs review",
    notesCount: notes.length,
    inquiredAt: row.inquiredAt?.toISOString() ?? null,
    needsFollowUp: row.needsFollowUp,
    contactResolutionStatus: contactResolutionStatusFromPrisma[row.contactResolutionStatus],
    lastContactResolutionRunAt: row.lastContactResolutionRunAt?.toISOString() ?? null,
    suggestedFollowUpDate: row.suggestedFollowUpDate?.toISOString().slice(0, 10) ?? null,
    secondFollowUpDate: row.secondFollowUpDate?.toISOString().slice(0, 10) ?? null,
    followedUpOn: row.followedUpOn?.toISOString().slice(0, 10) ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    notes,
    reasonSummary,
    contacts: [],
    activities: [],
    stageHistory: [],
    contactSnapshot: null,
    entityMatches:
      row.matchProvenance && typeof row.matchProvenance === "object" && "entityMatches" in row.matchProvenance
        ? (((row.matchProvenance as { entityMatches?: unknown[] }).entityMatches ?? []) as PlotOpportunity["entityMatches"])
        : [],
    enrichmentAudit:
      row.matchProvenance && typeof row.matchProvenance === "object" && "enrichmentAudit" in row.matchProvenance
        ? (((row.matchProvenance as { enrichmentAudit?: unknown[] }).enrichmentAudit ?? []) as PlotOpportunity["enrichmentAudit"])
        : []
  };
}
