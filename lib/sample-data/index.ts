import { resolveEntityIdentity } from "@/lib/entities/contact-identity";
import { BuilderRecord, DashboardSnapshot, PlotOpportunity, SourceRecord } from "@/types/domain";

const builderDefaults = {
  rawSourceName: null,
  preferredSalesName: null,
  legalEntityName: null,
  aliases: [],
  roleType: "unknown",
  entityConfidenceScore: 0,
  roleConfidenceScore: 0,
  contactQualityTier: "research_required",
  contactQualityBand: "tier_5",
  contactQualityScore: 0,
  preferredContactTarget: "Research contact",
  contractorRegistrationNumber: null,
  contractorRegistrationStatus: "unknown",
  businessEntityNumber: null,
  businessEntityStatus: "unknown",
  mailingAddress: null,
  cityState: null,
  lastEnrichedAt: null,
  nextBestAction: "Research contact",
  builderHeatScore: 0,
  totalEstimatedValue: 0,
  totalLandValue: 0,
  totalImprovementValue: 0,
  lastActivityAt: null,
  entityMatches: [],
  enrichmentAudit: []
} satisfies Pick<
  BuilderRecord,
  | "rawSourceName"
  | "preferredSalesName"
  | "legalEntityName"
  | "aliases"
  | "roleType"
  | "entityConfidenceScore"
  | "roleConfidenceScore"
  | "contactQualityTier"
  | "contactQualityBand"
  | "contactQualityScore"
  | "preferredContactTarget"
  | "contractorRegistrationNumber"
  | "contractorRegistrationStatus"
  | "businessEntityNumber"
  | "businessEntityStatus"
  | "mailingAddress"
  | "cityState"
  | "lastEnrichedAt"
  | "nextBestAction"
  | "builderHeatScore"
  | "totalEstimatedValue"
  | "totalLandValue"
  | "totalImprovementValue"
  | "lastActivityAt"
  | "entityMatches"
  | "enrichmentAudit"
>;

const opportunityDefaults = {
  assignedMembershipId: null,
  rawSourceName: null,
  normalizedEntityName: null,
  preferredSalesName: null,
  legalEntityName: null,
  aliases: [],
  roleType: "unknown",
  entityConfidenceScore: 0,
  roleConfidenceScore: 0,
  contactQualityTier: "research_required",
  contactQualityBand: "tier_5",
  contactQualityScore: 0,
  preferredContactTarget: "Research contact",
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
  estimatedProjectValue: null,
  landValue: null,
  improvementValue: null,
  signalType: "other",
  developmentStage: "permit_review",
  sourceStrength: "medium",
  readinessToContact: "research",
  clusterId: null,
  currentStage: "New",
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
  contactResolutionStatus: "unknown",
  lastContactResolutionRunAt: null,
  stageHistory: [],
  contactSnapshot: null,
  entityMatches: [],
  enrichmentAudit: [],
  contacts: [],
  activities: []
} satisfies Pick<
  PlotOpportunity,
  | "assignedMembershipId"
  | "rawSourceName"
  | "normalizedEntityName"
  | "preferredSalesName"
  | "legalEntityName"
  | "aliases"
  | "roleType"
  | "entityConfidenceScore"
  | "roleConfidenceScore"
  | "contactQualityTier"
  | "contactQualityBand"
  | "contactQualityScore"
  | "preferredContactTarget"
  | "phone"
  | "email"
  | "website"
  | "contractorRegistrationNumber"
  | "contractorRegistrationStatus"
  | "businessEntityNumber"
  | "businessEntityStatus"
  | "mailingAddress"
  | "cityState"
  | "lastEnrichedAt"
  | "estimatedProjectValue"
  | "landValue"
  | "improvementValue"
  | "signalType"
  | "developmentStage"
  | "sourceStrength"
  | "readinessToContact"
  | "clusterId"
  | "currentStage"
  | "contactedAt"
  | "lastContactedAt"
  | "nextFollowUpAt"
  | "followUpNeeded"
  | "interestStatus"
  | "outcomeStatus"
  | "contactSummary"
  | "notesSummary"
  | "outreachCount"
  | "callCount"
  | "emailCount"
  | "textCount"
  | "reasonLost"
  | "internalNotes"
  | "externalSummary"
  | "quoteRequestedAt"
  | "quoteSentAt"
  | "contactResolutionStatus"
  | "lastContactResolutionRunAt"
  | "stageHistory"
  | "contactSnapshot"
  | "entityMatches"
  | "enrichmentAudit"
  | "contacts"
  | "activities"
>;

function deriveQualityMeta(tier: BuilderRecord["contactQualityTier"]) {
  if (tier === "high") {
    return { band: "tier_1" as const, score: 96 };
  }

  if (tier === "medium") {
    return { band: "tier_2" as const, score: 78 };
  }

  if (tier === "low") {
    return { band: "tier_3" as const, score: 56 };
  }

  return { band: "tier_5" as const, score: 18 };
}

function stageFromBidStatus(status: PlotOpportunity["bidStatus"]): PlotOpportunity["currentStage"] {
  if (status === "contacted") return "Contacted";
  if (status === "won") return "Won";
  if (status === "lost") return "Lost";
  if (status === "quoted" || status === "bid_requested") return "Quoted";
  if (status === "ready_to_contact") return "Ready to Bid";
  if (status === "researching_builder") return "Research Builder";
  if (status === "not_a_fit") return "Not a Fit";
  return "New";
}

function withBuilderIdentity(
  builder: BuilderSeedRecord
): BuilderRecord {
  const identity = resolveEntityIdentity(
    {
      builderName: builder.name,
      contractorName: null,
      developerName: null,
      ownerName: null
    },
    builder.contact
  );
  const quality = deriveQualityMeta(identity.contactQualityTier);

  return {
    ...builder,
    rawSourceName: identity.rawSourceName,
    preferredSalesName: identity.preferredSalesName,
    legalEntityName: identity.legalEntityName,
    aliases: [],
    roleType: identity.roleType,
    entityConfidenceScore: identity.entityConfidenceScore,
    roleConfidenceScore: Math.max(0, Math.min(100, Math.round(identity.entityConfidenceScore * 0.72))),
    contactQualityTier: identity.contactQualityTier,
    contactQualityBand: quality.band,
    contactQualityScore: quality.score,
    preferredContactTarget: identity.preferredContactTarget
  };
}

function withOpportunityIdentity(
  opportunity: OpportunitySeedRecord
): PlotOpportunity {
  const identity = resolveEntityIdentity(
    {
      builderName: opportunity.builderName,
      contractorName: null,
      developerName: null,
      ownerName: opportunity.builderName ? null : opportunity.likelyCompanyName
    },
    {}
  );
  const quality = deriveQualityMeta(identity.contactQualityTier);

  return {
    ...opportunity,
    rawSourceName: identity.rawSourceName,
    normalizedEntityName: identity.normalizedEntityName,
    preferredSalesName: identity.preferredSalesName,
    legalEntityName: identity.legalEntityName,
    aliases: [],
    roleType: identity.roleType,
    entityConfidenceScore: identity.entityConfidenceScore,
    roleConfidenceScore: Math.max(0, Math.min(100, Math.round(identity.entityConfidenceScore * 0.72))),
    contactQualityTier: identity.contactQualityTier,
    contactQualityBand: quality.band,
    contactQualityScore: quality.score,
    preferredContactTarget: identity.preferredContactTarget,
    currentStage: stageFromBidStatus(opportunity.bidStatus),
    contactedAt: opportunity.inquiredAt,
    lastContactedAt: opportunity.followedUpOn ?? opportunity.inquiredAt,
    nextFollowUpAt: opportunity.nextFollowUpDate,
    followUpNeeded: opportunity.needsFollowUp,
    contactSummary: opportunity.contactStatus,
    notesSummary: opportunity.notes[0] ?? null,
    outreachCount: opportunity.bidStatus === "contacted" ? 1 : 0,
    callCount: opportunity.bidStatus === "contacted" ? 1 : 0,
    phone: null,
    email: null,
    website: null,
    signalType: opportunity.signalType,
    developmentStage: opportunity.developmentStage,
    sourceStrength: opportunity.sourceStrength,
    readinessToContact: opportunity.readinessToContact,
    clusterId: opportunity.clusterId,
    contactResolutionStatus:
      identity.preferredSalesName && identity.entityConfidenceScore >= 64
        ? "builder_only"
        : ["owner", "holding_company", "person"].includes(identity.roleType)
          ? "weak_entity"
          : "unknown",
    lastContactResolutionRunAt: null,
    stageHistory: [],
    contactSnapshot: null
  };
}

type BuilderSeedRecord = Omit<
  BuilderRecord,
  | "rawSourceName"
  | "preferredSalesName"
  | "legalEntityName"
  | "aliases"
  | "roleType"
  | "entityConfidenceScore"
  | "contactQualityTier"
  | "preferredContactTarget"
>;

type OpportunitySeedRecord = Omit<
  PlotOpportunity,
  | "rawSourceName"
  | "normalizedEntityName"
  | "preferredSalesName"
  | "legalEntityName"
  | "aliases"
  | "roleType"
  | "entityConfidenceScore"
  | "contactQualityTier"
  | "preferredContactTarget"
  | "phone"
  | "email"
  | "website"
>;

export const sources: SourceRecord[] = [
  {
    id: "src-cedar-rapids-real",
    name: "Cedar Rapids Building Services",
    slug: "cedar-rapids-building-services",
    jurisdiction: "Cedar Rapids",
    county: "Linn",
    city: "Cedar Rapids",
    connectorType: "document",
    priorityRank: 10,
    sourceType: "public permit search portal",
    parserType: "real-civic-source",
    sourceUrl: "https://example.gov/cedar-rapids/permits",
    active: true,
    syncFrequency: "0 */6 * * *",
    authRequired: false,
    lastSuccessfulSync: "2026-03-29T11:15:00.000Z",
    syncStatus: "success",
    sourceConfidenceScore: 94,
    sourceFreshnessScore: 88,
    logs: [
      {
        timestamp: "2026-03-29T11:15:00.000Z",
        level: "info",
        message: "146 records fetched, 31 normalized, 4 new grouped leads updated."
      },
      {
        timestamp: "2026-03-29T11:15:06.000Z",
        level: "info",
        message: "Idempotent rerun detected 31 existing hashes and skipped duplicates."
      }
    ]
  },
  {
    id: "src-johnson-import",
    name: "Johnson County Manual Import",
    slug: "johnson-county-import",
    jurisdiction: "Johnson County",
    county: "Johnson",
    city: "Iowa City",
    connectorType: "search",
    priorityRank: 40,
    sourceType: "manual import",
    parserType: "manual-xlsx",
    sourceUrl: "manual://johnson-county",
    active: true,
    syncFrequency: "manual",
    authRequired: false,
    lastSuccessfulSync: "2026-03-28T15:42:00.000Z",
    syncStatus: "warning",
    sourceConfidenceScore: 76,
    sourceFreshnessScore: 61,
    logs: [
      {
        timestamp: "2026-03-28T15:42:00.000Z",
        level: "warning",
        message: "6 rows missing builder name; records queued for review."
      }
    ]
  },
  {
    id: "src-waterloo-mock",
    name: "Waterloo Mock Feed",
    slug: "waterloo-mock-feed",
    jurisdiction: "Waterloo",
    county: "Black Hawk",
    city: "Waterloo",
    connectorType: "portal",
    priorityRank: 60,
    sourceType: "public permit viewer",
    parserType: "mock-structured",
    sourceUrl: "mock://waterloo-demo",
    active: true,
    syncFrequency: "0 5 * * *",
    authRequired: false,
    lastSuccessfulSync: "2026-03-29T10:02:00.000Z",
    syncStatus: "success",
    sourceConfidenceScore: 82,
    sourceFreshnessScore: 79,
    logs: [
      {
        timestamp: "2026-03-29T10:02:00.000Z",
        level: "info",
        message: "Mock fixture sync completed for local UI testing."
      }
    ]
  }
];

export const builders = ([
  {
    ...builderDefaults,
    id: "bld-hawkeye-homes",
    name: "Hawkeye Ridge Homes",
    normalizedName: "hawkeye ridge homes",
    counties: ["Linn", "Johnson"],
    cities: ["Cedar Rapids", "Coralville"],
    activeProperties: 7,
    openOpportunities: 5,
    leadScore: 96,
    pipelineStage: "Ready to Bid",
    nextFollowUpDate: "2026-03-30T15:00:00.000Z",
    assignedRep: "Mason Keller",
    lastSeenLocation: "Prairie Crest, Cedar Rapids",
    contact: {
      phone: "(319) 555-0184",
      email: "estimating@hawkeyeridgehomes.com",
      website: "https://hawkeyeridgehomes.com"
    },
    openOpportunityIds: ["opp-1", "opp-2", "opp-5"],
    properties: [
      {
        id: "prop-1",
        address: "1024 Prairie Crest Dr",
        city: "Cedar Rapids",
        county: "Linn",
        subdivision: "Prairie Crest",
        parcelNumber: "14-32-101-004",
        lotNumber: "Lot 12",
        noteCount: 2,
        permits: [
          {
            id: "permit-1",
            permitNumber: "CR-2026-001842",
            permitType: "Residential New Construction",
            permitSubtype: "Single Family Dwelling",
            permitStatus: "Issued",
            applicationDate: "2026-03-21T00:00:00.000Z",
            issueDate: "2026-03-24T00:00:00.000Z",
            estimatedProjectValue: 465000,
            landValue: 98000,
            improvementValue: 367000,
            classification: "single_family_home",
            sourceJurisdiction: "Cedar Rapids",
            sourceName: "Cedar Rapids Building Services",
            sourceUrl: "https://example.gov/permits/CR-2026-001842"
          }
        ]
      },
      {
        id: "prop-2",
        address: "412 Harvest View Ln",
        city: "Coralville",
        county: "Johnson",
        subdivision: "Harvest View",
        parcelNumber: "10-09-403-012",
        lotNumber: "Lot 7",
        noteCount: 1,
        permits: [
          {
            id: "permit-2",
            permitNumber: "IC-2026-000644",
            permitType: "Residential New Construction",
            permitSubtype: "Single Family Dwelling",
            permitStatus: "Plan Review",
            applicationDate: "2026-03-26T00:00:00.000Z",
            issueDate: null,
            estimatedProjectValue: 418000,
            landValue: 115000,
            improvementValue: 303000,
            classification: "single_family_home",
            sourceJurisdiction: "Coralville",
            sourceName: "Johnson County Manual Import",
            sourceUrl: "manual://johnson-county/IC-2026-000644"
          }
        ]
      }
    ]
  },
  {
    ...builderDefaults,
    id: "bld-corridor-custom",
    name: "Corridor Custom Builders LLC",
    normalizedName: "corridor custom builders",
    counties: ["Linn"],
    cities: ["Marion", "Cedar Rapids"],
    activeProperties: 4,
    openOpportunities: 3,
    leadScore: 84,
    pipelineStage: "Contacted",
    nextFollowUpDate: "2026-04-01T13:00:00.000Z",
    assignedRep: "Ava Sinclair",
    lastSeenLocation: "Echo Valley, Marion",
    contact: {
      phone: "(319) 555-0118",
      email: "office@corridorcustom.com",
      website: "https://corridorcustom.example"
    },
    openOpportunityIds: ["opp-3"],
    properties: [
      {
        id: "prop-3",
        address: "1190 Echo Valley Trl",
        city: "Marion",
        county: "Linn",
        subdivision: "Echo Valley",
        parcelNumber: "12-11-201-018",
        lotNumber: "Lot 4",
        noteCount: 3,
        permits: [
          {
            id: "permit-3",
            permitNumber: "MA-2026-000218",
            permitType: "Residential New Construction",
            permitSubtype: "Single Family Dwelling",
            permitStatus: "Issued",
            applicationDate: "2026-03-18T00:00:00.000Z",
            issueDate: "2026-03-25T00:00:00.000Z",
            estimatedProjectValue: 436000,
            landValue: 102000,
            improvementValue: 334000,
            classification: "single_family_home",
            sourceJurisdiction: "Marion",
            sourceName: "Cedar Rapids Building Services",
            sourceUrl: "https://example.gov/permits/MA-2026-000218"
          }
        ]
      }
    ]
  },
  {
    ...builderDefaults,
    id: "bld-river-bend",
    name: "River Bend Development Group",
    normalizedName: "river bend development group",
    counties: ["Black Hawk"],
    cities: ["Waterloo"],
    activeProperties: 3,
    openOpportunities: 2,
    leadScore: 68,
    pipelineStage: "Research Builder",
    nextFollowUpDate: null,
    assignedRep: "Open Territory",
    lastSeenLocation: "Blue Stem Estates, Waterloo",
    contact: {
      phone: null,
      email: null,
      website: null
    },
    openOpportunityIds: ["opp-4"],
    properties: [
      {
        id: "prop-4",
        address: "2716 Blue Stem Ct",
        city: "Waterloo",
        county: "Black Hawk",
        subdivision: "Blue Stem Estates",
        parcelNumber: "8912-18-401-004",
        lotNumber: "Lot 3",
        noteCount: 0,
        permits: [
          {
            id: "permit-4",
            permitNumber: "WL-2026-00091",
            permitType: "Residential Permit",
            permitSubtype: "Single Family Dwelling",
            permitStatus: "Applied",
            applicationDate: "2026-03-23T00:00:00.000Z",
            issueDate: null,
            estimatedProjectValue: 451000,
            landValue: 110000,
            improvementValue: 341000,
            classification: "single_family_home",
            sourceJurisdiction: "Waterloo",
            sourceName: "Waterloo Mock Feed",
            sourceUrl: "mock://waterloo-demo/WL-2026-00091"
          }
        ]
      }
    ]
  },
  {
    ...builderDefaults,
    id: "bld-corridor-multifamily",
    name: "Corridor Living Communities",
    normalizedName: "corridor living communities",
    counties: ["Johnson", "Linn"],
    cities: ["Iowa City", "Cedar Rapids"],
    activeProperties: 2,
    openOpportunities: 2,
    leadScore: 82,
    pipelineStage: "Ready to Bid",
    nextFollowUpDate: "2026-03-31T11:30:00.000Z",
    assignedRep: "Mason Keller",
    lastSeenLocation: "River Oaks, Iowa City",
    contact: {
      phone: "(319) 555-0139",
      email: "precon@corridorliving.com",
      website: "https://corridorliving.example"
    },
    openOpportunityIds: ["opp-6"],
    properties: [
      {
        id: "prop-5",
        address: "805 River Oaks Dr",
        city: "Iowa City",
        county: "Johnson",
        subdivision: "River Oaks",
        parcelNumber: "11-44-201-008",
        lotNumber: "Parcel B",
        noteCount: 1,
        permits: [
          {
            id: "permit-5",
            permitNumber: "IC-2026-001102",
            permitType: "Residential New Construction",
            permitSubtype: "Multi-Family",
            permitStatus: "Plan Review",
            applicationDate: "2026-03-27T00:00:00.000Z",
            issueDate: null,
            estimatedProjectValue: 2400000,
            landValue: 390000,
            improvementValue: 2010000,
            classification: "multi_family",
            sourceJurisdiction: "Iowa City",
            sourceName: "Johnson County Manual Import",
            sourceUrl: "manual://johnson-county/IC-2026-001102"
          }
        ]
      }
    ]
  },
  {
    ...builderDefaults,
    id: "bld-redline-commercial",
    name: "Redline Commercial Contractors",
    normalizedName: "redline commercial contractors",
    counties: ["Linn"],
    cities: ["Cedar Rapids"],
    activeProperties: 2,
    openOpportunities: 1,
    leadScore: 74,
    pipelineStage: "Research Builder",
    nextFollowUpDate: "2026-04-02T10:00:00.000Z",
    assignedRep: "Ava Sinclair",
    lastSeenLocation: "Edgewood Logistics Park, Cedar Rapids",
    contact: {
      phone: "(319) 555-0176",
      email: "estimating@redlinecommercial.com",
      website: "https://redlinecommercial.example"
    },
    openOpportunityIds: ["opp-7"],
    properties: [
      {
        id: "prop-6",
        address: "2400 Commerce Park Rd",
        city: "Cedar Rapids",
        county: "Linn",
        subdivision: "Edgewood Logistics Park",
        parcelNumber: "13-20-440-011",
        lotNumber: "Lot 5",
        noteCount: 0,
        permits: [
          {
            id: "permit-6",
            permitNumber: "CR-2026-002019",
            permitType: "Commercial New Construction",
            permitSubtype: "Warehouse / Office",
            permitStatus: "Applied",
            applicationDate: "2026-03-28T00:00:00.000Z",
            issueDate: null,
            estimatedProjectValue: 3100000,
            landValue: 515000,
            improvementValue: 2585000,
            classification: "commercial",
            sourceJurisdiction: "Cedar Rapids",
            sourceName: "Cedar Rapids Building Services",
            sourceUrl: "https://example.gov/permits/CR-2026-002019"
          }
        ]
      }
    ]
  }
] satisfies BuilderSeedRecord[]).map(withBuilderIdentity);

export const plotOpportunities = ([
  {
    ...opportunityDefaults,
    id: "opp-1",
    address: "1024 Prairie Crest Dr",
    city: "Cedar Rapids",
    county: "Linn",
    subdivision: "Prairie Crest",
    parcelNumber: "14-32-101-004",
    lotNumber: "Lot 12",
    builderId: "bld-hawkeye-homes",
    builderName: "Hawkeye Ridge Homes",
    likelyCompanyName: "Hawkeye Ridge Homes LLC",
    permitNumber: "CR-2026-001842",
    sourceName: "Cedar Rapids Building Services",
    sourceJurisdiction: "Cedar Rapids",
    sourceUrl: "https://example.gov/permits/CR-2026-001842",
    signalDate: "2026-03-24T00:00:00.000Z",
    classification: "single_family_home",
    projectSegment: "single_family",
    opportunityType: "issued_new_home",
    buildReadiness: "permit_issued",
    vacancyConfidence: 92,
    opportunityScore: 96,
    bidStatus: "contacted",
    assignedRep: "Mason Keller",
    nextAction: "Call builder and ask to bid insulation package",
    nextFollowUpDate: "2026-03-30T15:00:00.000Z",
    contactStatus: "Builder contact found",
    notesCount: 2,
    inquiredAt: "2026-03-29T09:15:00.000Z",
    needsFollowUp: true,
    suggestedFollowUpDate: "2026-03-31",
    secondFollowUpDate: "2026-04-03",
    followedUpOn: "",
    closedAt: null,
    notes: [
      "Left a voicemail with estimating asking to bid insulation and shelving.",
      "Need to call back after permit package review."
    ],
    reasonSummary: ["Permit issued", "Single-family home", "Builder identified"]
  },
  {
    ...opportunityDefaults,
    id: "opp-2",
    address: "412 Harvest View Ln",
    city: "Coralville",
    county: "Johnson",
    subdivision: "Harvest View",
    parcelNumber: "10-09-403-012",
    lotNumber: "Lot 7",
    builderId: "bld-hawkeye-homes",
    builderName: "Hawkeye Ridge Homes",
    likelyCompanyName: "Hawkeye Ridge Homes LLC",
    permitNumber: "IC-2026-000644",
    sourceName: "Johnson County Manual Import",
    sourceJurisdiction: "Coralville",
    sourceUrl: "manual://johnson-county/IC-2026-000644",
    signalDate: "2026-03-26T00:00:00.000Z",
    classification: "single_family_home",
    projectSegment: "single_family",
    opportunityType: "pre_issuance_home",
    buildReadiness: "permit_review",
    vacancyConfidence: 88,
    opportunityScore: 93,
    bidStatus: "researching_builder",
    assignedRep: "Mason Keller",
    nextAction: "Confirm builder contact and prep intro email",
    nextFollowUpDate: "2026-03-31T16:00:00.000Z",
    contactStatus: "Need estimator contact",
    notesCount: 1,
    inquiredAt: null,
    needsFollowUp: false,
    suggestedFollowUpDate: null,
    secondFollowUpDate: null,
    followedUpOn: null,
    closedAt: null,
    notes: [],
    reasonSummary: ["Permit in review", "Single-family home", "Priority county"]
  },
  {
    ...opportunityDefaults,
    id: "opp-3",
    address: "1190 Echo Valley Trl",
    city: "Marion",
    county: "Linn",
    subdivision: "Echo Valley",
    parcelNumber: "12-11-201-018",
    lotNumber: "Lot 4",
    builderId: "bld-corridor-custom",
    builderName: "Corridor Custom Builders LLC",
    likelyCompanyName: "Corridor Custom Builders LLC",
    permitNumber: "MA-2026-000218",
    sourceName: "Cedar Rapids Building Services",
    sourceJurisdiction: "Marion",
    sourceUrl: "https://example.gov/permits/MA-2026-000218",
    signalDate: "2026-03-25T00:00:00.000Z",
    classification: "single_family_home",
    projectSegment: "single_family",
    opportunityType: "issued_new_home",
    buildReadiness: "permit_issued",
    vacancyConfidence: 90,
    opportunityScore: 89,
    bidStatus: "contacted",
    assignedRep: "Ava Sinclair",
    nextAction: "Follow up on bid request sent Friday",
    nextFollowUpDate: "2026-04-01T13:00:00.000Z",
    contactStatus: "Estimator reached",
    notesCount: 3,
    inquiredAt: "2026-03-28T14:30:00.000Z",
    needsFollowUp: true,
    suggestedFollowUpDate: "2026-04-01",
    secondFollowUpDate: "2026-04-05",
    followedUpOn: "2026-03-29",
    closedAt: null,
    notes: [
      "Spoke with estimator and asked to bid both insulation and shelving.",
      "Waiting on plans and takeoff details."
    ],
    reasonSummary: ["Issued permit", "Builder identified", "Subdivision activity"]
  },
  {
    ...opportunityDefaults,
    id: "opp-4",
    address: "2716 Blue Stem Ct",
    city: "Waterloo",
    county: "Black Hawk",
    subdivision: "Blue Stem Estates",
    parcelNumber: "8912-18-401-004",
    lotNumber: "Lot 3",
    builderId: "bld-river-bend",
    builderName: "River Bend Development Group",
    likelyCompanyName: null,
    permitNumber: "WL-2026-00091",
    sourceName: "Waterloo Mock Feed",
    sourceJurisdiction: "Waterloo",
    sourceUrl: "mock://waterloo-demo/WL-2026-00091",
    signalDate: "2026-03-23T00:00:00.000Z",
    classification: "single_family_home",
    projectSegment: "single_family",
    opportunityType: "subdivision_lot",
    buildReadiness: "plan_submitted",
    vacancyConfidence: 84,
    opportunityScore: 76,
    bidStatus: "researching_builder",
    assignedRep: "Open Territory",
    nextAction: "Find builder phone number before outreach",
    nextFollowUpDate: null,
    contactStatus: "No direct contact yet",
    notesCount: 0,
    inquiredAt: null,
    needsFollowUp: false,
    suggestedFollowUpDate: null,
    secondFollowUpDate: null,
    followedUpOn: null,
    closedAt: null,
    notes: [],
    reasonSummary: ["Subdivision lot", "Early-stage build signal", "Builder needs research"]
  },
  {
    ...opportunityDefaults,
    id: "opp-5",
    address: "1032 Prairie Crest Dr",
    city: "Cedar Rapids",
    county: "Linn",
    subdivision: "Prairie Crest",
    parcelNumber: "14-32-101-005",
    lotNumber: "Lot 13",
    builderId: "bld-hawkeye-homes",
    builderName: "Hawkeye Ridge Homes",
    likelyCompanyName: "Hawkeye Ridge Homes LLC",
    permitNumber: null,
    sourceName: "Cedar Rapids Building Services",
    sourceJurisdiction: "Cedar Rapids",
    sourceUrl: "https://example.gov/permits/prairie-crest-lot-13",
    signalDate: "2026-03-27T00:00:00.000Z",
    classification: "new_residential_construction",
    projectSegment: "single_family",
    opportunityType: "vacant_lot_new_build",
    buildReadiness: "early_signal",
    vacancyConfidence: 95,
    opportunityScore: 91,
    bidStatus: "not_reviewed",
    assignedRep: "Mason Keller",
    nextAction: "Review lot record and confirm builder timeline",
    nextFollowUpDate: "2026-03-30T10:00:00.000Z",
    contactStatus: "Not reviewed yet",
    notesCount: 0,
    inquiredAt: null,
    needsFollowUp: false,
    suggestedFollowUpDate: null,
    secondFollowUpDate: null,
    followedUpOn: null,
    closedAt: null,
    notes: [],
    reasonSummary: ["Vacant lot", "Same builder on nearby lots", "Inside preferred corridor"]
  },
  {
    ...opportunityDefaults,
    id: "opp-6",
    address: "805 River Oaks Dr",
    city: "Iowa City",
    county: "Johnson",
    subdivision: "River Oaks",
    parcelNumber: "11-44-201-008",
    lotNumber: "Parcel B",
    builderId: "bld-corridor-multifamily",
    builderName: "Corridor Living Communities",
    likelyCompanyName: "Corridor Living Communities",
    permitNumber: "IC-2026-001102",
    sourceName: "Johnson County Manual Import",
    sourceJurisdiction: "Iowa City",
    sourceUrl: "manual://johnson-county/IC-2026-001102",
    signalDate: "2026-03-27T00:00:00.000Z",
    classification: "multi_family",
    projectSegment: "multifamily",
    opportunityType: "pre_issuance_home",
    buildReadiness: "permit_review",
    vacancyConfidence: 81,
    opportunityScore: 86,
    bidStatus: "ready_to_contact",
    assignedRep: "Mason Keller",
    nextAction: "Call preconstruction manager for insulation package and shelving scope",
    nextFollowUpDate: "2026-03-31T11:30:00.000Z",
    contactStatus: "Precon contact identified",
    notesCount: 1,
    inquiredAt: null,
    needsFollowUp: false,
    suggestedFollowUpDate: null,
    secondFollowUpDate: null,
    followedUpOn: null,
    closedAt: null,
    notes: [],
    reasonSummary: ["Multifamily permit in review", "Builder identified", "Large insulation scope"]
  },
  {
    ...opportunityDefaults,
    id: "opp-7",
    address: "2400 Commerce Park Rd",
    city: "Cedar Rapids",
    county: "Linn",
    subdivision: "Edgewood Logistics Park",
    parcelNumber: "13-20-440-011",
    lotNumber: "Lot 5",
    builderId: "bld-redline-commercial",
    builderName: "Redline Commercial Contractors",
    likelyCompanyName: "Redline Commercial Contractors",
    permitNumber: "CR-2026-002019",
    sourceName: "Cedar Rapids Building Services",
    sourceJurisdiction: "Cedar Rapids",
    sourceUrl: "https://example.gov/permits/CR-2026-002019",
    signalDate: "2026-03-28T00:00:00.000Z",
    classification: "commercial",
    projectSegment: "commercial",
    opportunityType: "vacant_lot_new_build",
    buildReadiness: "plan_submitted",
    vacancyConfidence: 79,
    opportunityScore: 78,
    bidStatus: "researching_builder",
    assignedRep: "Ava Sinclair",
    nextAction: "Confirm GC and ask about insulation and shelving bid packages",
    nextFollowUpDate: "2026-04-02T10:00:00.000Z",
    contactStatus: "Need PM or estimator direct line",
    notesCount: 0,
    inquiredAt: null,
    needsFollowUp: false,
    suggestedFollowUpDate: null,
    secondFollowUpDate: null,
    followedUpOn: null,
    closedAt: null,
    notes: [],
    reasonSummary: ["Commercial lot filing", "Early build signal", "Cedar Rapids corridor"]
  }
] satisfies OpportunitySeedRecord[]).map(withOpportunityIdentity);

export const dashboardSnapshot: DashboardSnapshot = {
  topBuilders: builders,
  plotQueue: plotOpportunities,
  newestPermits: builders.flatMap((builder) => builder.properties.flatMap((property) => property.permits)).slice(0, 4),
  syncHealth: sources,
  followUpsDue: plotOpportunities.filter((opportunity) => Boolean(opportunity.nextFollowUpDate))
};
