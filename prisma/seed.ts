import {
  PrismaClient,
  PipelineStage,
  RoleKey,
  SourceSyncStatus,
  PermitClassification,
  OpportunityType,
  BuildReadiness,
  BidStatus
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "eastern-iowa-insulation" },
    update: {},
    create: {
      name: "Eastern Iowa Insulation",
      slug: "eastern-iowa-insulation"
    }
  });

  const counties = ["Linn", "Johnson", "Benton", "Buchanan", "Black Hawk"];
  const countyRecords = await Promise.all(
    counties.map((name) =>
      prisma.county.upsert({
        where: { name },
        update: {},
        create: { name }
      })
    )
  );

  const linn = countyRecords.find((county) => county.name === "Linn");
  const johnson = countyRecords.find((county) => county.name === "Johnson");
  const blackHawk = countyRecords.find((county) => county.name === "Black Hawk");

  const cedarRapids = await prisma.city.upsert({
    where: { name_countyId: { name: "Cedar Rapids", countyId: linn!.id } },
    update: {},
    create: { name: "Cedar Rapids", countyId: linn!.id }
  });

  const coralville = await prisma.city.upsert({
    where: { name_countyId: { name: "Coralville", countyId: johnson!.id } },
    update: {},
    create: { name: "Coralville", countyId: johnson!.id }
  });

  const waterloo = await prisma.city.upsert({
    where: { name_countyId: { name: "Waterloo", countyId: blackHawk!.id } },
    update: {},
    create: { name: "Waterloo", countyId: blackHawk!.id }
  });

  const jurisdiction = await prisma.jurisdiction.upsert({
    where: { name_countyId: { name: "Cedar Rapids", countyId: linn!.id } },
    update: {},
    create: {
      name: "Cedar Rapids",
      countyId: linn!.id,
      cityId: cedarRapids.id
    }
  });

  await prisma.membership.upsert({
    where: { id: "seed-admin-membership" },
    update: {},
    create: {
      id: "seed-admin-membership",
      organizationId: org.id,
      clerkUserId: "user_demo_admin",
      email: "admin@easterniowainsulation.com",
      displayName: "Demo Admin",
      role: RoleKey.admin
    }
  });

  const source = await prisma.source.upsert({
    where: {
      organizationId_slug: {
        organizationId: org.id,
        slug: "cedar-rapids-building-services"
      }
    },
    update: {},
    create: {
      organizationId: org.id,
      jurisdictionId: jurisdiction.id,
      name: "Cedar Rapids Building Services",
      slug: "cedar-rapids-building-services",
      sourceType: "public permit search portal",
      parserType: "real-civic-source",
      sourceUrl: "https://example.gov/cedar-rapids/permits",
      syncFrequency: "0 */6 * * *",
      sourceConfidenceScore: 94,
      sourceFreshnessScore: 88,
      syncStatus: SourceSyncStatus.success
    }
  });

  const company = await prisma.company.upsert({
    where: {
      organizationId_normalizedName: {
        organizationId: org.id,
        normalizedName: "hawkeye ridge"
      }
    },
    update: {},
    create: {
      organizationId: org.id,
      legalName: "Hawkeye Ridge Homes LLC",
      normalizedName: "hawkeye ridge",
      phone: "(319) 555-0184",
      email: "estimating@hawkeyeridgehomes.com",
      website: "https://hawkeyeridgehomes.com"
    }
  });

  const builder = await prisma.builder.upsert({
    where: {
      organizationId_normalizedName: {
        organizationId: org.id,
        normalizedName: "hawkeye ridge"
      }
    },
    update: {},
    create: {
      organizationId: org.id,
      companyId: company.id,
      name: "Hawkeye Ridge Homes",
      normalizedName: "hawkeye ridge",
      confidenceScore: 93,
      builderHeatScore: 91,
      activeProperties: 7,
      totalLandValue: 805000,
      totalImprovementValue: 2925000
    }
  });

  const property = await prisma.property.create({
    data: {
      address: "1024 Prairie Crest Dr",
      cityId: cedarRapids.id,
      countyId: linn!.id,
      subdivision: "Prairie Crest",
      lotNumber: "Lot 12",
      parcel: {
        create: {
          parcelNumber: "14-32-101-004"
        }
      }
    }
  });

  await prisma.permit.upsert({
    where: { dedupeHash: "seed:CR-2026-001842" },
    update: {},
    create: {
      jurisdictionId: jurisdiction.id,
      propertyId: property.id,
      builderId: builder.id,
      permitNumber: "CR-2026-001842",
      permitType: "Residential New Construction",
      permitSubtype: "Single Family Dwelling",
      permitStatus: "Issued",
      applicationDate: new Date("2026-03-21"),
      issueDate: new Date("2026-03-24"),
      projectDescription: "Single-family home",
      estimatedProjectValue: 465000,
      landValue: 98000,
      improvementValue: 367000,
      sourceUrl: "https://example.gov/permits/CR-2026-001842",
      classification: PermitClassification.SINGLE_FAMILY_HOME,
      dedupeHash: "seed:CR-2026-001842"
    }
  });

  const lead = await prisma.lead.create({
    data: {
      organizationId: org.id,
      builderId: builder.id,
      companyId: company.id,
      assignedMembershipId: "seed-admin-membership",
      stage: PipelineStage.READY_TO_BID,
      score: 96,
      clusterOpportunityScore: 91,
      nextFollowUpDate: new Date("2026-03-30T15:00:00Z")
    }
  });

  await prisma.leadStageHistory.create({
    data: {
      leadId: lead.id,
      stage: PipelineStage.READY_TO_BID,
      note: "Seeded grouped single-family lead."
    }
  });

  await prisma.plotOpportunity.create({
    data: {
      organizationId: org.id,
      propertyId: property.id,
      builderId: builder.id,
      sourceId: source.id,
      assignedMembershipId: "seed-admin-membership",
      opportunityType: OpportunityType.ISSUED_NEW_HOME,
      buildReadiness: BuildReadiness.PERMIT_ISSUED,
      bidStatus: BidStatus.READY_TO_CONTACT,
      vacancyConfidence: 92,
      opportunityScore: 96,
      contactStatus: "Builder contact found",
      nextAction: "Call builder and ask to bid insulation package",
      nextFollowUpDate: new Date("2026-03-30T15:00:00Z"),
      signalDate: new Date("2026-03-24T00:00:00Z"),
      sourceEvidence: {
        permitNumber: "CR-2026-001842",
        address: "1024 Prairie Crest Dr"
      }
    }
  });

  await prisma.sourceSyncRun.create({
    data: {
      sourceId: source.id,
      status: SourceSyncStatus.success,
      fetchedCount: 1,
      normalizedCount: 1,
      dedupedCount: 1,
      finishedAt: new Date(),
      message: "Seed sync run for demo data.",
      logs: {
        create: [
          {
            level: "info",
            message: "Fetched 1 record from Cedar Rapids fixture."
          }
        ]
      }
    }
  });

  await prisma.territory.createMany({
    data: [
      {
        organizationId: org.id,
        name: "Cedar Rapids Metro",
        slug: "cedar-rapids-metro",
        type: "city_bundle"
      },
      {
        organizationId: org.id,
        name: "Cedar Rapids to Waterloo Corridor",
        slug: "cedar-rapids-to-waterloo",
        type: "corridor"
      }
    ],
    skipDuplicates: true
  });

  void coralville;
  void waterloo;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
