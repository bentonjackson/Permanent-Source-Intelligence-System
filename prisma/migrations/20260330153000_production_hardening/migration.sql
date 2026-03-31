ALTER TABLE "SourceSyncRun"
ADD COLUMN "newRecordCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "updatedRecordCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "unchangedRecordCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "errorRecordCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "blockedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "completenessScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "driftScore" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "RawRecord"
ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "blockedReason" TEXT;

ALTER TABLE "Builder"
ADD COLUMN "builderIdentityKey" TEXT;

ALTER TABLE "Contact"
ADD COLUMN "normalizedEmail" TEXT,
ADD COLUMN "normalizedPhone" TEXT,
ADD COLUMN "contactSourceRank" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Property"
ADD COLUMN "propertyIdentityKey" TEXT,
ADD COLUMN "sourceFingerprint" TEXT,
ADD COLUMN "sourceRecordVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "lastSourceChangedAt" TIMESTAMP(3),
ADD COLUMN "changeSummary" JSONB;

ALTER TABLE "PlotOpportunity"
ADD COLUMN "opportunityIdentityKey" TEXT,
ADD COLUMN "sourceFingerprint" TEXT,
ADD COLUMN "sourceRecordVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "lastSourceChangedAt" TIMESTAMP(3),
ADD COLUMN "scoreBreakdown" JSONB,
ADD COLUMN "requiresReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "duplicateRiskScore" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Permit"
ADD COLUMN "permitIdentityKey" TEXT,
ADD COLUMN "sourceFingerprint" TEXT,
ADD COLUMN "sourceRecordVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "lastSourceChangedAt" TIMESTAMP(3),
ADD COLUMN "changeSummary" JSONB;

ALTER TABLE "SourceHealthCheck"
ADD COLUMN "blockedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "completenessScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "healthScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "warningFlags" JSONB;

CREATE INDEX "Builder_builderIdentityKey_idx" ON "Builder"("builderIdentityKey");
CREATE INDEX "Contact_builderId_normalizedEmail_idx" ON "Contact"("builderId", "normalizedEmail");
CREATE INDEX "Contact_companyId_normalizedEmail_idx" ON "Contact"("companyId", "normalizedEmail");
CREATE INDEX "Property_propertyIdentityKey_idx" ON "Property"("propertyIdentityKey");
CREATE INDEX "Property_normalizedAddress_cityId_countyId_idx" ON "Property"("normalizedAddress", "cityId", "countyId");
CREATE INDEX "PlotOpportunity_opportunityIdentityKey_idx" ON "PlotOpportunity"("opportunityIdentityKey");
CREATE INDEX "PlotOpportunity_organizationId_bidStatus_opportunityScore_idx" ON "PlotOpportunity"("organizationId", "bidStatus", "opportunityScore");
CREATE INDEX "PlotOpportunity_organizationId_currentStage_updatedAt_idx" ON "PlotOpportunity"("organizationId", "currentStage", "updatedAt");
CREATE INDEX "Permit_permitIdentityKey_idx" ON "Permit"("permitIdentityKey");
CREATE INDEX "Permit_issueDate_permitStatus_idx" ON "Permit"("issueDate", "permitStatus");
