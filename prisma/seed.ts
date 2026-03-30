import { PrismaClient, RoleKey } from "@prisma/client";

import { cedarRapids75MileCounties, seededTerritories } from "../lib/geo/territories";
import { officialSourceDefinitions } from "../lib/sources/official-sources";

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: {
      slug: "eastern-iowa-insulation"
    },
    update: {},
    create: {
      name: "Eastern Iowa Insulation",
      slug: "eastern-iowa-insulation"
    }
  });

  await prisma.leadStageHistory.deleteMany({
    where: {
      lead: {
        builder: {
          normalizedName: "hawkeye ridge"
        }
      }
    }
  });

  await prisma.lead.deleteMany({
    where: {
      builder: {
        normalizedName: "hawkeye ridge"
      }
    }
  });

  await prisma.plotOpportunity.deleteMany({
    where: {
      OR: [
        {
          sourceId: null
        },
        {
          builderName: {
            contains: "Hawkeye",
            mode: "insensitive"
          }
        },
        {
          address: {
            contains: "Prairie Crest",
            mode: "insensitive"
          }
        },
        {
          sourceName: {
            contains: "Coralville Official Source",
            mode: "insensitive"
          }
        },
        {
          sourceUrl: {
            contains: "permitportal.coralville.org"
          }
        }
      ]
    }
  });

  await prisma.permit.deleteMany({
    where: {
      sourceUrl: {
        contains: "example.gov"
      }
    }
  });

  await prisma.property.deleteMany({
    where: {
      address: {
        contains: "Prairie Crest",
        mode: "insensitive"
      }
    }
  });

  await prisma.builder.deleteMany({
    where: {
      normalizedName: "hawkeye ridge"
    }
  });

  await prisma.company.deleteMany({
    where: {
      normalizedName: "hawkeye ridge"
    }
  });

  await prisma.source.deleteMany({
    where: {
      slug: "cedar-rapids-building-services"
    }
  });

  await prisma.membership.upsert({
    where: {
      id: "seed-admin-membership"
    },
    update: {},
    create: {
      id: "seed-admin-membership",
      organizationId: organization.id,
      clerkUserId: "user_demo_admin",
      email: "admin@easterniowainsulation.com",
      displayName: "Demo Admin",
      role: RoleKey.admin
    }
  });

  await prisma.membership.upsert({
    where: {
      id: "seed-rep-membership"
    },
    update: {},
    create: {
      id: "seed-rep-membership",
      organizationId: organization.id,
      clerkUserId: "user_demo_rep",
      email: "sales@easterniowainsulation.com",
      displayName: "Territory Rep",
      role: RoleKey.rep
    }
  });

  const countyIds = new Map<string, string>();

  for (const countyName of cedarRapids75MileCounties) {
    const county = await prisma.county.upsert({
      where: {
        name: countyName
      },
      update: {},
      create: {
        name: countyName
      }
    });

    countyIds.set(countyName, county.id);
  }

  const jurisdictionIds = new Map<string, string>();

  for (const source of officialSourceDefinitions) {
    const countyId = countyIds.get(source.county);

    if (!countyId) {
      continue;
    }

    let cityId: string | undefined;

    if (source.city) {
      const city = await prisma.city.upsert({
        where: {
          name_countyId: {
            name: source.city,
            countyId
          }
        },
        update: {},
        create: {
          name: source.city,
          countyId
        }
      });

      cityId = city.id;
    }

    const jurisdiction = await prisma.jurisdiction.upsert({
      where: {
        name_countyId: {
          name: source.jurisdiction,
          countyId
        }
      },
      update: {
        cityId: cityId ?? null
      },
      create: {
        name: source.jurisdiction,
        countyId,
        cityId
      }
    });

    jurisdictionIds.set(source.id, jurisdiction.id);
  }

  for (const source of officialSourceDefinitions) {
    await prisma.source.upsert({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: source.slug
        }
      },
      update: {
        jurisdictionId: jurisdictionIds.get(source.id) ?? null,
        name: source.name,
        county: source.county,
        city: source.city,
        sourceScope: source.sourceScope ?? null,
        countyRadiusEligible: source.countyRadiusEligible ?? false,
        countySelectorVisible: source.countySelectorVisible ?? false,
        officialSourceType: source.officialSourceType ?? null,
        connectorType: source.connectorType.toUpperCase() as never,
        priorityRank: source.priorityRank,
        sourceType: source.sourceType,
        parserType: source.parserType,
        sourceUrl: source.sourceUrl,
        active: source.active,
        authRequired: source.authRequired,
        syncFrequency: source.syncFrequency
      },
      create: {
        organizationId: organization.id,
        jurisdictionId: jurisdictionIds.get(source.id) ?? null,
        name: source.name,
        slug: source.slug,
        county: source.county,
        city: source.city,
        sourceScope: source.sourceScope ?? null,
        countyRadiusEligible: source.countyRadiusEligible ?? false,
        countySelectorVisible: source.countySelectorVisible ?? false,
        officialSourceType: source.officialSourceType ?? null,
        connectorType: source.connectorType.toUpperCase() as never,
        priorityRank: source.priorityRank,
        sourceType: source.sourceType,
        parserType: source.parserType,
        sourceUrl: source.sourceUrl,
        active: source.active,
        authRequired: source.authRequired,
        syncFrequency: source.syncFrequency,
        sourceConfidenceScore: source.sourceConfidenceScore,
        sourceFreshnessScore: source.sourceFreshnessScore
      }
    });
  }

  for (const territory of seededTerritories) {
    await prisma.territory.upsert({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: territory.id
        }
      },
      update: {
        name: territory.name,
        type: territory.type,
        radiusMiles: territory.radiusMiles ?? null
      },
      create: {
        organizationId: organization.id,
        name: territory.name,
        slug: territory.id,
        type: territory.type,
        radiusMiles: territory.radiusMiles ?? null
      }
    });
  }

  console.log("Seeded organization, memberships, counties, territories, and source registry.");
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
