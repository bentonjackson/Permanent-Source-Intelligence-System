import { RoleKey } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import { cedarRapids75MileCounties, seededTerritories } from "@/lib/geo/territories";
import { officialSourceDefinitions } from "@/lib/sources/official-sources";

export const DEFAULT_ORGANIZATION_NAME = "Eastern Iowa Insulation";
export const DEFAULT_ORGANIZATION_SLUG = "eastern-iowa-insulation";
export const DEFAULT_OPEN_TERRITORY_LABEL = "Open Territory";
export const DEFAULT_ADMIN_MEMBERSHIP_ID = "seed-admin-membership";

export async function ensureBaselineMetadata() {
  const organization = await prisma.organization.upsert({
    where: {
      slug: DEFAULT_ORGANIZATION_SLUG
    },
    update: {},
    create: {
      name: DEFAULT_ORGANIZATION_NAME,
      slug: DEFAULT_ORGANIZATION_SLUG
    }
  });

  await prisma.membership.upsert({
    where: {
      id: DEFAULT_ADMIN_MEMBERSHIP_ID
    },
    update: {},
    create: {
      id: DEFAULT_ADMIN_MEMBERSHIP_ID,
      organizationId: organization.id,
      clerkUserId: "user_demo_admin",
      email: "admin@easterniowainsulation.com",
      displayName: "Demo Admin",
      role: RoleKey.admin
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

    countyIds.set(county.name, county.id);
  }

  const cityIds = new Map<string, string>();
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
      cityIds.set(`${source.city}:${source.county}`, city.id);
    }

    if (source.jurisdiction) {
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
    const territoryRecord = await prisma.territory.upsert({
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

    await prisma.territoryRule.deleteMany({
      where: {
        territoryId: territoryRecord.id
      }
    });

    const ruleRows = [
      ...territory.counties.map((value) => ({
        territoryId: territoryRecord.id,
        ruleType: "county",
        ruleValue: value
      })),
      ...territory.cities.map((value) => ({
        territoryId: territoryRecord.id,
        ruleType: "city",
        ruleValue: value
      }))
    ];

    if (ruleRows.length) {
      await prisma.territoryRule.createMany({
        data: ruleRows
      });
    }
  }

  return {
    organizationId: organization.id,
    cityIds,
    countyIds
  };
}

export async function getDefaultOrganizationId() {
  const organization = await prisma.organization.findUnique({
    where: {
      slug: DEFAULT_ORGANIZATION_SLUG
    },
    select: {
      id: true
    }
  });

  if (organization) {
    return organization.id;
  }

  return (await ensureBaselineMetadata()).organizationId;
}

export async function getRepOptions() {
  const organizationId = await getDefaultOrganizationId();

  const memberships = await prisma.membership.findMany({
    where: {
      organizationId
    },
    orderBy: {
      displayName: "asc"
    },
    select: {
      id: true,
      displayName: true,
      email: true
    }
  });

  return [
    {
      id: "",
      displayName: DEFAULT_OPEN_TERRITORY_LABEL,
      email: null as string | null
    },
    ...memberships
  ];
}
