-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('NEW_RESIDENTIAL_PERMIT', 'NEW_MULTIFAMILY_PERMIT', 'PARCEL_DEVELOPMENT', 'SUBDIVISION_PLAT', 'REZONING_LAND_USE', 'PLANNING_AGENDA', 'SITE_PREP', 'UTILITY_OR_GRADING', 'CLUSTER_ACTIVITY', 'ASSESSOR_VALUE_MOVEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DevelopmentStage" AS ENUM ('EARLY_LAND_SIGNAL', 'PLANNING_REVIEW', 'PLAT_REVIEW', 'SITE_PREP', 'PERMIT_INTAKE', 'PERMIT_REVIEW', 'PERMIT_ISSUED');

-- CreateEnum
CREATE TYPE "SourceStrength" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ReadinessToContact" AS ENUM ('NOW', 'SOON', 'RESEARCH', 'WATCH');

-- CreateEnum
CREATE TYPE "ContactResolutionStatus" AS ENUM ('RESOLVED', 'BUILDER_ONLY', 'WEAK_ENTITY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReviewQueueType" AS ENUM ('PARSE_FAILURE', 'WEAK_IDENTITY', 'AMBIGUOUS_MATCH', 'MISSING_CONTACT', 'MISSING_FIELD', 'STALE_SOURCE', 'DUPLICATE_RECORD', 'SOURCE_FAILURE');

-- CreateEnum
CREATE TYPE "ReviewQueueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Builder" ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "rawSourceNames" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "rawSourceNames" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "PlotOpportunity" ADD COLUMN     "clusterId" TEXT,
ADD COLUMN     "contactResolutionStatus" "ContactResolutionStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "developmentStage" "DevelopmentStage" NOT NULL DEFAULT 'PERMIT_REVIEW',
ADD COLUMN     "lastContactResolutionRunAt" TIMESTAMP(3),
ADD COLUMN     "readinessToContact" "ReadinessToContact" NOT NULL DEFAULT 'RESEARCH',
ADD COLUMN     "signalType" "SignalType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "sourceStrength" "SourceStrength" NOT NULL DEFAULT 'MEDIUM';

-- CreateTable
CREATE TABLE "OpportunityStageHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "fromStage" "PipelineStage",
    "toStage" "PipelineStage" NOT NULL,
    "fromBidStatus" "BidStatus",
    "toBidStatus" "BidStatus" NOT NULL,
    "note" TEXT,
    "sourceLabel" TEXT,
    "changedByMembershipId" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityContactSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "primaryEntityId" TEXT,
    "primaryContactId" TEXT,
    "primaryEntityName" TEXT,
    "primaryContactName" TEXT,
    "primaryPhone" TEXT,
    "primaryEmail" TEXT,
    "primaryWebsite" TEXT,
    "contactQualityTier" "ContactQualityTier" NOT NULL DEFAULT 'RESEARCH_REQUIRED',
    "contactQualityBand" "ContactQualityBand" NOT NULL DEFAULT 'TIER_5',
    "contactQualityScore" INTEGER NOT NULL DEFAULT 0,
    "entityConfidenceScore" INTEGER NOT NULL DEFAULT 0,
    "nextBestAction" TEXT,
    "contactResolutionStatus" "ContactResolutionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "resolutionNotes" TEXT,
    "lastContactResolutionRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityContactSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceHealthCheck" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "runId" TEXT,
    "status" "SourceSyncStatus" NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "httpStatus" INTEGER,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "normalizedCount" INTEGER NOT NULL DEFAULT 0,
    "parseFailureCount" INTEGER NOT NULL DEFAULT 0,
    "missingFieldCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "notes" TEXT,

    CONSTRAINT "SourceHealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewQueueItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceId" TEXT,
    "rawRecordId" TEXT,
    "builderId" TEXT,
    "opportunityId" TEXT,
    "reviewType" "ReviewQueueType" NOT NULL,
    "status" "ReviewQueueStatus" NOT NULL DEFAULT 'OPEN',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "rationale" TEXT,
    "sourceUrl" TEXT,
    "fingerprint" TEXT,
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpportunityStageHistory_opportunityId_changedAt_idx" ON "OpportunityStageHistory"("opportunityId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityContactSnapshot_opportunityId_key" ON "OpportunityContactSnapshot"("opportunityId");

-- CreateIndex
CREATE INDEX "ReviewQueueItem_organizationId_status_priority_idx" ON "ReviewQueueItem"("organizationId", "status", "priority");

-- CreateIndex
CREATE INDEX "ReviewQueueItem_sourceId_status_idx" ON "ReviewQueueItem"("sourceId", "status");

-- CreateIndex
CREATE INDEX "ReviewQueueItem_opportunityId_status_idx" ON "ReviewQueueItem"("opportunityId", "status");

-- AddForeignKey
ALTER TABLE "OpportunityStageHistory" ADD CONSTRAINT "OpportunityStageHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityStageHistory" ADD CONSTRAINT "OpportunityStageHistory_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "PlotOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityStageHistory" ADD CONSTRAINT "OpportunityStageHistory_changedByMembershipId_fkey" FOREIGN KEY ("changedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityContactSnapshot" ADD CONSTRAINT "OpportunityContactSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityContactSnapshot" ADD CONSTRAINT "OpportunityContactSnapshot_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "PlotOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityContactSnapshot" ADD CONSTRAINT "OpportunityContactSnapshot_primaryEntityId_fkey" FOREIGN KEY ("primaryEntityId") REFERENCES "Builder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityContactSnapshot" ADD CONSTRAINT "OpportunityContactSnapshot_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceHealthCheck" ADD CONSTRAINT "SourceHealthCheck_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceHealthCheck" ADD CONSTRAINT "SourceHealthCheck_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceHealthCheck" ADD CONSTRAINT "SourceHealthCheck_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SourceSyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueueItem" ADD CONSTRAINT "ReviewQueueItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueueItem" ADD CONSTRAINT "ReviewQueueItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueueItem" ADD CONSTRAINT "ReviewQueueItem_rawRecordId_fkey" FOREIGN KEY ("rawRecordId") REFERENCES "RawRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueueItem" ADD CONSTRAINT "ReviewQueueItem_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "Builder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueueItem" ADD CONSTRAINT "ReviewQueueItem_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "PlotOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

