-- CreateEnum
CREATE TYPE "RoleKey" AS ENUM ('admin', 'rep');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('NEW', 'RESEARCH_BUILDER', 'READY_TO_BID', 'CONTACTED', 'QUOTED', 'WON', 'LOST', 'NOT_A_FIT');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('VACANT_LOT_NEW_BUILD', 'SUBDIVISION_LOT', 'PRE_ISSUANCE_HOME', 'ISSUED_NEW_HOME', 'OTHER_NON_PRIORITY');

-- CreateEnum
CREATE TYPE "BuildReadiness" AS ENUM ('EARLY_SIGNAL', 'PLAN_SUBMITTED', 'PERMIT_REVIEW', 'PERMIT_ISSUED');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('NOT_REVIEWED', 'RESEARCHING_BUILDER', 'READY_TO_CONTACT', 'CONTACTED', 'BID_REQUESTED', 'QUOTED', 'WON', 'LOST', 'NOT_A_FIT');

-- CreateEnum
CREATE TYPE "ProjectSegment" AS ENUM ('SINGLE_FAMILY', 'MULTIFAMILY', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "PermitClassification" AS ENUM ('NEW_RESIDENTIAL_CONSTRUCTION', 'SINGLE_FAMILY_HOME', 'MULTI_FAMILY', 'ACCESSORY_BUILDING', 'REMODEL_REPAIR', 'COMMERCIAL', 'UNKNOWN_NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "SourceSyncStatus" AS ENUM ('idle', 'running', 'success', 'warning', 'failed');

-- CreateEnum
CREATE TYPE "EntityRoleType" AS ENUM ('BUILDER', 'GENERAL_CONTRACTOR', 'DEVELOPER', 'OWNER', 'HOLDING_COMPANY', 'PERSON', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ContactQualityTier" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'RESEARCH_REQUIRED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "RoleKey" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "County" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'IA',

    CONSTRAINT "County_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countyId" TEXT NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jurisdiction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countyId" TEXT NOT NULL,
    "cityId" TEXT,

    CONSTRAINT "Jurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "radiusMiles" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryRule" (
    "id" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "ruleValue" TEXT NOT NULL,

    CONSTRAINT "TerritoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jurisdictionId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "county" TEXT,
    "city" TEXT,
    "sourceScope" TEXT,
    "countyRadiusEligible" BOOLEAN NOT NULL DEFAULT false,
    "countySelectorVisible" BOOLEAN NOT NULL DEFAULT false,
    "officialSourceType" TEXT,
    "sourceType" TEXT NOT NULL,
    "parserType" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "authRequired" BOOLEAN NOT NULL DEFAULT false,
    "syncFrequency" TEXT NOT NULL,
    "sourceConfidenceScore" INTEGER NOT NULL DEFAULT 0,
    "sourceFreshnessScore" INTEGER NOT NULL DEFAULT 0,
    "syncStatus" "SourceSyncStatus" NOT NULL DEFAULT 'idle',
    "lastSuccessfulSync" TIMESTAMP(3),

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSyncRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "SourceSyncStatus" NOT NULL DEFAULT 'running',
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "normalizedCount" INTEGER NOT NULL DEFAULT 0,
    "dedupedCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,

    CONSTRAINT "SourceSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSyncLog" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawRecord" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "runId" TEXT,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeHash" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "permitId" TEXT,

    CONSTRAINT "RawRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Builder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "rawSourceName" TEXT,
    "preferredSalesName" TEXT,
    "roleType" "EntityRoleType" NOT NULL DEFAULT 'UNKNOWN',
    "contactQualityTier" "ContactQualityTier" NOT NULL DEFAULT 'RESEARCH_REQUIRED',
    "preferredContactTarget" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "builderHeatScore" INTEGER NOT NULL DEFAULT 0,
    "activeProperties" INTEGER NOT NULL DEFAULT 0,
    "totalLandValue" DECIMAL(12,2),
    "totalImprovementValue" DECIMAL(12,2),

    CONSTRAINT "Builder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderAlias" (
    "id" TEXT NOT NULL,
    "builderId" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,

    CONSTRAINT "BuilderAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "rawSourceName" TEXT,
    "preferredSalesName" TEXT,
    "roleType" "EntityRoleType" NOT NULL DEFAULT 'UNKNOWN',
    "contactQualityTier" "ContactQualityTier" NOT NULL DEFAULT 'RESEARCH_REQUIRED',
    "preferredContactTarget" TEXT,
    "entityConfidenceScore" INTEGER NOT NULL DEFAULT 0,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "mailingAddress" TEXT,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "builderId" TEXT,
    "companyId" TEXT,
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "roleTitle" TEXT,
    "publicProfileUrl" TEXT,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "normalizedAddress" TEXT,
    "cityId" TEXT,
    "countyId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'IA',
    "zip" TEXT,
    "subdivision" TEXT,
    "lotNumber" TEXT,
    "parcelNumber" TEXT,
    "landValue" DECIMAL(12,2),
    "improvementValue" DECIMAL(12,2),

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlotOpportunity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT,
    "permitId" TEXT,
    "builderId" TEXT,
    "sourceId" TEXT,
    "assignedMembershipId" TEXT,
    "address" TEXT,
    "city" TEXT,
    "county" TEXT,
    "subdivision" TEXT,
    "parcelNumber" TEXT,
    "lotNumber" TEXT,
    "builderName" TEXT,
    "likelyCompanyName" TEXT,
    "rawSourceName" TEXT,
    "normalizedEntityName" TEXT,
    "preferredSalesName" TEXT,
    "legalEntityName" TEXT,
    "roleType" "EntityRoleType" NOT NULL DEFAULT 'UNKNOWN',
    "entityConfidenceScore" INTEGER NOT NULL DEFAULT 0,
    "contactQualityTier" "ContactQualityTier" NOT NULL DEFAULT 'RESEARCH_REQUIRED',
    "preferredContactTarget" TEXT,
    "permitNumber" TEXT,
    "sourceName" TEXT,
    "sourceJurisdiction" TEXT,
    "sourceUrl" TEXT,
    "classification" "PermitClassification" NOT NULL DEFAULT 'UNKNOWN_NEEDS_REVIEW',
    "projectSegment" "ProjectSegment" NOT NULL DEFAULT 'SINGLE_FAMILY',
    "opportunityType" "OpportunityType" NOT NULL,
    "buildReadiness" "BuildReadiness" NOT NULL,
    "bidStatus" "BidStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
    "vacancyConfidence" INTEGER NOT NULL DEFAULT 0,
    "opportunityScore" INTEGER NOT NULL DEFAULT 0,
    "contactStatus" TEXT,
    "nextAction" TEXT,
    "nextFollowUpDate" TIMESTAMP(3),
    "inquiredAt" TIMESTAMP(3),
    "needsFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "suggestedFollowUpDate" TIMESTAMP(3),
    "secondFollowUpDate" TIMESTAMP(3),
    "followedUpOn" TIMESTAMP(3),
    "notes" JSONB,
    "closedAt" TIMESTAMP(3),
    "signalDate" TIMESTAMP(3) NOT NULL,
    "sourceEvidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlotOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "parcelNumber" TEXT NOT NULL,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permit" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "jurisdictionId" TEXT,
    "propertyId" TEXT,
    "builderId" TEXT,
    "permitNumber" TEXT NOT NULL,
    "permitType" TEXT NOT NULL,
    "permitSubtype" TEXT,
    "permitStatus" TEXT NOT NULL,
    "applicationDate" TIMESTAMP(3),
    "issueDate" TIMESTAMP(3),
    "projectDescription" TEXT,
    "estimatedProjectValue" DECIMAL(12,2),
    "landValue" DECIMAL(12,2),
    "improvementValue" DECIMAL(12,2),
    "ownerName" TEXT,
    "contractorName" TEXT,
    "developerName" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "classification" "PermitClassification" NOT NULL DEFAULT 'UNKNOWN_NEEDS_REVIEW',
    "dedupeHash" TEXT NOT NULL,

    CONSTRAINT "Permit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "builderId" TEXT,
    "companyId" TEXT,
    "stage" "PipelineStage" NOT NULL DEFAULT 'NEW',
    "assignedMembershipId" TEXT,
    "outreachCount" INTEGER NOT NULL DEFAULT 0,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "emailCount" INTEGER NOT NULL DEFAULT 0,
    "lastContactDate" TIMESTAMP(3),
    "nextFollowUpDate" TIMESTAMP(3),
    "interestStatus" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "clusterOpportunityScore" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadStageHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "stage" "PipelineStage" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "LeadStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "propertyId" TEXT,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "propertyId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadTag" (
    "leadId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "LeadTag_pkey" PRIMARY KEY ("leadId","tagId")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "watchType" TEXT NOT NULL,
    "watchValue" TEXT NOT NULL,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrichmentResult" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "confidence" INTEGER NOT NULL,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrichmentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadScoreSnapshot" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "clusterOpportunityScore" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "County_name_key" ON "County"("name");

-- CreateIndex
CREATE UNIQUE INDEX "City_name_countyId_key" ON "City"("name", "countyId");

-- CreateIndex
CREATE UNIQUE INDEX "Jurisdiction_name_countyId_key" ON "Jurisdiction"("name", "countyId");

-- CreateIndex
CREATE UNIQUE INDEX "Territory_organizationId_slug_key" ON "Territory"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Source_organizationId_slug_key" ON "Source"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "RawRecord_sourceId_dedupeHash_key" ON "RawRecord"("sourceId", "dedupeHash");

-- CreateIndex
CREATE UNIQUE INDEX "Builder_organizationId_normalizedName_key" ON "Builder"("organizationId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Company_organizationId_normalizedName_key" ON "Company"("organizationId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Property_parcelNumber_key" ON "Property"("parcelNumber");

-- CreateIndex
CREATE INDEX "PlotOpportunity_organizationId_opportunityScore_idx" ON "PlotOpportunity"("organizationId", "opportunityScore");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_propertyId_key" ON "Parcel"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_parcelNumber_key" ON "Parcel"("parcelNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Permit_dedupeHash_key" ON "Permit"("dedupeHash");

-- CreateIndex
CREATE UNIQUE INDEX "Permit_permitNumber_sourceUrl_key" ON "Permit"("permitNumber", "sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "County"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jurisdiction" ADD CONSTRAINT "Jurisdiction_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "County"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jurisdiction" ADD CONSTRAINT "Jurisdiction_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryRule" ADD CONSTRAINT "TerritoryRule_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSyncRun" ADD CONSTRAINT "SourceSyncRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSyncLog" ADD CONSTRAINT "SourceSyncLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SourceSyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawRecord" ADD CONSTRAINT "RawRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawRecord" ADD CONSTRAINT "RawRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SourceSyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawRecord" ADD CONSTRAINT "RawRecord_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Builder" ADD CONSTRAINT "Builder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Builder" ADD CONSTRAINT "Builder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuilderAlias" ADD CONSTRAINT "BuilderAlias_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "Builder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "Builder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "County"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotOpportunity" ADD CONSTRAINT "PlotOpportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotOpportunity" ADD CONSTRAINT "PlotOpportunity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotOpportunity" ADD CONSTRAINT "PlotOpportunity_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotOpportunity" ADD CONSTRAINT "PlotOpportunity_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "Builder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotOpportunity" ADD CONSTRAINT "PlotOpportunity_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotOpportunity" ADD CONSTRAINT "PlotOpportunity_assignedMembershipId_fkey" FOREIGN KEY ("assignedMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "Builder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "Builder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedMembershipId_fkey" FOREIGN KEY ("assignedMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStageHistory" ADD CONSTRAINT "LeadStageHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadTag" ADD CONSTRAINT "LeadTag_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadTag" ADD CONSTRAINT "LeadTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrichmentResult" ADD CONSTRAINT "EnrichmentResult_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoreSnapshot" ADD CONSTRAINT "LeadScoreSnapshot_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

