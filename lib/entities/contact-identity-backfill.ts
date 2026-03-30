import { prisma } from "@/lib/db/client";
import { normalizeWhitespace } from "@/lib/connectors/shared/normalization";
import { resolveEntityIdentity } from "@/lib/entities/contact-identity";

function prismaRole(value: ReturnType<typeof resolveEntityIdentity>["roleType"]) {
  return value.toUpperCase() as never;
}

function prismaQuality(value: ReturnType<typeof resolveEntityIdentity>["contactQualityTier"]) {
  return value.toUpperCase() as never;
}

async function ensureBuilderAlias(builderId: string, rawName: string | null) {
  const normalizedRaw = normalizeWhitespace(rawName);

  if (!normalizedRaw) {
    return;
  }

  const existingAlias = await prisma.builderAlias.findFirst({
    where: {
      builderId,
      rawName: normalizedRaw
    },
    select: {
      id: true
    }
  });

  if (!existingAlias) {
    await prisma.builderAlias.create({
      data: {
        builderId,
        rawName: normalizedRaw
      }
    });
  }
}

async function backfillCompanies() {
  const companies = await prisma.company.findMany({
    orderBy: {
      normalizedName: "asc"
    }
  });

  for (const company of companies) {
    const rawName = company.rawSourceName ?? company.legalName;
    const identity = resolveEntityIdentity(
      {
        builderName: rawName,
        contractorName: null,
        developerName: null,
        ownerName: null
      },
      {
        phone: company.phone,
        email: company.email,
        website: company.website
      }
    );

    await prisma.company.update({
      where: {
        id: company.id
      },
      data: {
        rawSourceName: identity.rawSourceName ?? rawName,
        preferredSalesName: identity.preferredSalesName,
        roleType: prismaRole(identity.roleType),
        contactQualityTier: prismaQuality(identity.contactQualityTier),
        preferredContactTarget: identity.preferredContactTarget,
        entityConfidenceScore: identity.entityConfidenceScore
      }
    });
  }
}

async function backfillBuilders() {
  const builders = await prisma.builder.findMany({
    include: {
      company: true
    },
    orderBy: {
      normalizedName: "asc"
    }
  });

  for (const builder of builders) {
    const rawName =
      builder.rawSourceName ??
      builder.company?.rawSourceName ??
      builder.name ??
      builder.company?.legalName ??
      null;
    const contact = {
      phone: builder.phone ?? builder.company?.phone ?? null,
      email: builder.email ?? builder.company?.email ?? null,
      website: builder.company?.website ?? null
    };
    const identity = resolveEntityIdentity(
      {
        builderName: rawName,
        contractorName: null,
        developerName: null,
        ownerName: null
      },
      contact
    );

    await prisma.builder.update({
      where: {
        id: builder.id
      },
      data: {
        rawSourceName: identity.rawSourceName ?? rawName,
        preferredSalesName: identity.preferredSalesName,
        roleType: prismaRole(identity.roleType),
        contactQualityTier: prismaQuality(identity.contactQualityTier),
        preferredContactTarget: identity.preferredContactTarget,
        confidenceScore: identity.entityConfidenceScore
      }
    });

    await ensureBuilderAlias(builder.id, identity.rawSourceName ?? rawName);

    if (builder.companyId) {
      await prisma.company.update({
        where: {
          id: builder.companyId
        },
        data: {
          rawSourceName: identity.rawSourceName ?? rawName ?? builder.company?.rawSourceName,
          preferredSalesName: identity.preferredSalesName ?? builder.company?.preferredSalesName,
          roleType: prismaRole(identity.roleType),
          contactQualityTier: prismaQuality(identity.contactQualityTier),
          preferredContactTarget: identity.preferredContactTarget,
          entityConfidenceScore: identity.entityConfidenceScore
        }
      });
    }
  }
}

async function backfillOpportunities() {
  const opportunities = await prisma.plotOpportunity.findMany({
    include: {
      builder: {
        include: {
          company: true,
          aliases: true
        }
      }
    },
    orderBy: {
      signalDate: "desc"
    }
  });

  for (const opportunity of opportunities) {
    const rawName =
      opportunity.builder?.rawSourceName ??
      opportunity.builder?.company?.rawSourceName ??
      opportunity.rawSourceName ??
      opportunity.builderName ??
      opportunity.likelyCompanyName ??
      opportunity.builder?.name ??
      opportunity.builder?.company?.legalName ??
      null;
    const contact = {
      phone: opportunity.builder?.phone ?? opportunity.builder?.company?.phone ?? null,
      email: opportunity.builder?.email ?? opportunity.builder?.company?.email ?? null,
      website: opportunity.builder?.company?.website ?? null
    };
    const identity = resolveEntityIdentity(
      {
        builderName: rawName,
        contractorName: null,
        developerName: null,
        ownerName: rawName
      },
      contact
    );

    await prisma.plotOpportunity.update({
      where: {
        id: opportunity.id
      },
      data: {
        rawSourceName: identity.rawSourceName ?? rawName,
        normalizedEntityName: identity.normalizedEntityName,
        preferredSalesName: identity.preferredSalesName,
        legalEntityName: identity.legalEntityName ?? rawName,
        roleType: prismaRole(identity.roleType),
        entityConfidenceScore: identity.entityConfidenceScore,
        contactQualityTier: prismaQuality(identity.contactQualityTier),
        preferredContactTarget: identity.preferredContactTarget
      }
    });
  }
}

export async function backfillStoredContactIdentities() {
  await backfillCompanies();
  await backfillBuilders();
  await backfillOpportunities();
}
