-- AlterTable
ALTER TABLE "Contact"
ADD COLUMN "opportunityId" TEXT,
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "companyName" TEXT,
ADD COLUMN "mobilePhone" TEXT,
ADD COLUMN "officePhone" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "linkedinUrl" TEXT,
ADD COLUMN "preferredContactMethod" TEXT,
ADD COLUMN "bestTimeToContact" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "confidenceScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PlotOpportunity"
ADD COLUMN "currentStage" "PipelineStage" NOT NULL DEFAULT 'NEW',
ADD COLUMN "contactedAt" TIMESTAMP(3),
ADD COLUMN "lastContactedAt" TIMESTAMP(3),
ADD COLUMN "nextFollowUpAt" TIMESTAMP(3),
ADD COLUMN "followUpNeeded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "interestStatus" TEXT,
ADD COLUMN "outcomeStatus" TEXT,
ADD COLUMN "contactSummary" TEXT,
ADD COLUMN "notesSummary" TEXT,
ADD COLUMN "outreachCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "callCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "emailCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "textCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reasonLost" TEXT,
ADD COLUMN "internalNotes" TEXT,
ADD COLUMN "externalSummary" TEXT,
ADD COLUMN "quoteRequestedAt" TIMESTAMP(3),
ADD COLUMN "quoteSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Activity"
ALTER COLUMN "leadId" DROP NOT NULL,
ALTER COLUMN "description" DROP NOT NULL,
ADD COLUMN "opportunityId" TEXT,
ADD COLUMN "contactId" TEXT,
ADD COLUMN "direction" TEXT,
ADD COLUMN "outcome" TEXT,
ADD COLUMN "note" TEXT,
ADD COLUMN "createdByMembershipId" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill PlotOpportunity workflow state from the pre-existing queue/contact fields.
UPDATE "PlotOpportunity"
SET
  "currentStage" = CASE
    WHEN "bidStatus" = 'CONTACTED' THEN 'CONTACTED'::"PipelineStage"
    WHEN "bidStatus" IN ('BID_REQUESTED', 'QUOTED') THEN 'QUOTED'::"PipelineStage"
    WHEN "bidStatus" = 'WON' THEN 'WON'::"PipelineStage"
    WHEN "bidStatus" = 'LOST' THEN 'LOST'::"PipelineStage"
    WHEN "bidStatus" = 'NOT_A_FIT' THEN 'NOT_A_FIT'::"PipelineStage"
    WHEN "bidStatus" = 'READY_TO_CONTACT' THEN 'READY_TO_BID'::"PipelineStage"
    WHEN "bidStatus" = 'RESEARCHING_BUILDER' THEN 'RESEARCH_BUILDER'::"PipelineStage"
    ELSE 'NEW'::"PipelineStage"
  END,
  "contactedAt" = COALESCE("contactedAt", "inquiredAt"),
  "lastContactedAt" = COALESCE("lastContactedAt", "followedUpOn", "inquiredAt"),
  "nextFollowUpAt" = COALESCE("nextFollowUpAt", "nextFollowUpDate", "suggestedFollowUpDate"),
  "followUpNeeded" = COALESCE("followUpNeeded", "needsFollowUp", false),
  "interestStatus" = COALESCE("interestStatus", 'unknown'),
  "outcomeStatus" = COALESCE(
    "outcomeStatus",
    CASE
      WHEN "bidStatus" = 'WON' THEN 'won'
      WHEN "bidStatus" = 'LOST' THEN 'lost'
      WHEN "bidStatus" = 'NOT_A_FIT' THEN 'not_a_fit'
      ELSE 'open'
    END
  ),
  "contactSummary" = COALESCE("contactSummary", "contactStatus"),
  "internalNotes" = COALESCE(
    "internalNotes",
    CASE
      WHEN jsonb_typeof("notes") = 'array' THEN (
        SELECT string_agg(entry, E'\n')
        FROM jsonb_array_elements_text("notes") AS entry
      )
      ELSE NULL
    END
  ),
  "notesSummary" = COALESCE(
    "notesSummary",
    CASE
      WHEN jsonb_typeof("notes") = 'array' THEN (
        SELECT string_agg(entry, E'\n')
        FROM jsonb_array_elements_text("notes") AS entry
      )
      ELSE NULL
    END
  ),
  "reasonLost" = COALESCE(
    "reasonLost",
    CASE
      WHEN "bidStatus" = 'LOST' THEN "contactStatus"
      ELSE NULL
    END
  );

-- Indexes
CREATE INDEX "Contact_opportunityId_isPrimary_idx" ON "Contact"("opportunityId", "isPrimary");
CREATE INDEX "PlotOpportunity_organizationId_currentStage_nextFollowUpAt_idx" ON "PlotOpportunity"("organizationId", "currentStage", "nextFollowUpAt");
CREATE INDEX "Activity_opportunityId_occurredAt_idx" ON "Activity"("opportunityId", "occurredAt");

-- AddForeignKey
ALTER TABLE "Contact"
ADD CONSTRAINT "Contact_opportunityId_fkey"
FOREIGN KEY ("opportunityId") REFERENCES "PlotOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity"
ADD CONSTRAINT "Activity_opportunityId_fkey"
FOREIGN KEY ("opportunityId") REFERENCES "PlotOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity"
ADD CONSTRAINT "Activity_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity"
ADD CONSTRAINT "Activity_createdByMembershipId_fkey"
FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
