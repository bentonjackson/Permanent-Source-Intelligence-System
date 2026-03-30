-- CreateEnum
CREATE TYPE "ContactQualityBand" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3', 'TIER_4', 'TIER_5');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNKNOWN', 'PENDING', 'NOT_FOUND');

-- AlterTable
ALTER TABLE "Builder" ADD COLUMN     "businessEntityNumber" TEXT,
ADD COLUMN     "businessEntityStatus" "RegistrationStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "cityState" TEXT,
ADD COLUMN     "contactQualityBand" "ContactQualityBand" NOT NULL DEFAULT 'TIER_5',
ADD COLUMN     "contactQualityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "contractorRegistrationNumber" TEXT,
ADD COLUMN     "contractorRegistrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "lastEnrichedAt" TIMESTAMP(3),
ADD COLUMN     "mailingAddress" TEXT,
ADD COLUMN     "matchProvenance" JSONB,
ADD COLUMN     "nextBestAction" TEXT,
ADD COLUMN     "roleConfidenceScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "BuilderAlias" ADD COLUMN     "fingerprint" TEXT,
ADD COLUMN     "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "normalizedName" TEXT,
ADD COLUMN     "sourceLabel" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "businessEntityNumber" TEXT,
ADD COLUMN     "businessEntityStatus" "RegistrationStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "cityState" TEXT,
ADD COLUMN     "contactQualityBand" "ContactQualityBand" NOT NULL DEFAULT 'TIER_5',
ADD COLUMN     "contactQualityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "contactSource" TEXT,
ADD COLUMN     "contactUrl" TEXT,
ADD COLUMN     "contractorRegistrationNumber" TEXT,
ADD COLUMN     "contractorRegistrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "lastEnrichedAt" TIMESTAMP(3),
ADD COLUMN     "matchProvenance" JSONB,
ADD COLUMN     "roleConfidenceScore" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "cityState" TEXT,
ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastEnrichedAt" TIMESTAMP(3),
ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "mailingAddress" TEXT,
ADD COLUMN     "qualityBand" "ContactQualityBand" NOT NULL DEFAULT 'TIER_5',
ADD COLUMN     "qualityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sourceLabel" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "EnrichmentResult" ADD COLUMN     "builderId" TEXT,
ADD COLUMN     "fieldName" TEXT,
ADD COLUMN     "fieldValue" TEXT,
ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "plotOpportunityId" TEXT,
ADD COLUMN     "rationale" TEXT,
ADD COLUMN     "sourceLabel" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ALTER COLUMN "companyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PlotOpportunity" ADD COLUMN     "businessEntityNumber" TEXT,
ADD COLUMN     "businessEntityStatus" "RegistrationStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "cityState" TEXT,
ADD COLUMN     "contactQualityBand" "ContactQualityBand" NOT NULL DEFAULT 'TIER_5',
ADD COLUMN     "contactQualityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "contractorRegistrationNumber" TEXT,
ADD COLUMN     "contractorRegistrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "lastEnrichedAt" TIMESTAMP(3),
ADD COLUMN     "mailingAddress" TEXT,
ADD COLUMN     "matchProvenance" JSONB,
ADD COLUMN     "roleConfidenceScore" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EntityMatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "builderId" TEXT,
    "companyId" TEXT,
    "plotOpportunityId" TEXT,
    "rawSourceName" TEXT NOT NULL,
    "normalizedEntityName" TEXT NOT NULL,
    "preferredSalesName" TEXT,
    "fingerprint" TEXT NOT NULL,
    "roleType" "EntityRoleType" NOT NULL DEFAULT 'UNKNOWN',
    "roleConfidenceScore" INTEGER NOT NULL DEFAULT 0,
    "matchScore" INTEGER NOT NULL DEFAULT 0,
    "matchStrategy" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "rationale" TEXT,
    "payload" JSONB,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityMatch_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EntityMatch" ADD CONSTRAINT "EntityMatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityMatch" ADD CONSTRAINT "EntityMatch_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "Builder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityMatch" ADD CONSTRAINT "EntityMatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityMatch" ADD CONSTRAINT "EntityMatch_plotOpportunityId_fkey" FOREIGN KEY ("plotOpportunityId") REFERENCES "PlotOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrichmentResult" ADD CONSTRAINT "EnrichmentResult_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrichmentResult" ADD CONSTRAINT "EnrichmentResult_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "Builder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrichmentResult" ADD CONSTRAINT "EnrichmentResult_plotOpportunityId_fkey" FOREIGN KEY ("plotOpportunityId") REFERENCES "PlotOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

