import { ensureBaselineMetadata } from "@/lib/app/defaults";
import { prisma } from "@/lib/db/client";
import { officialSourceDefinitions } from "@/lib/sources/official-sources";

function buildDuplicateCount(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + (count - 1), 0);
}

export async function runDiagnostics() {
  const baseline = await ensureBaselineMetadata();
  const [
    sources,
    opportunities,
    snapshotsCount,
    openReviewCount,
    weakIdentityReviews,
    missingContactReviews,
    contactedCount,
    closedCount
  ] = await Promise.all([
    prisma.source.findMany({
      where: { organizationId: baseline.organizationId },
      include: {
        healthChecks: {
          orderBy: { checkedAt: "desc" },
          take: 1
        }
      }
    }),
    prisma.plotOpportunity.findMany({
      where: { organizationId: baseline.organizationId },
      include: {
        contactSnapshot: true
      }
    }),
    prisma.opportunityContactSnapshot.count({
      where: { organizationId: baseline.organizationId }
    }),
    prisma.reviewQueueItem.count({
      where: {
        organizationId: baseline.organizationId,
        status: { in: ["OPEN", "IN_PROGRESS"] }
      }
    }),
    prisma.reviewQueueItem.count({
      where: {
        organizationId: baseline.organizationId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        reviewType: "WEAK_IDENTITY"
      }
    }),
    prisma.reviewQueueItem.count({
      where: {
        organizationId: baseline.organizationId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        reviewType: "MISSING_CONTACT"
      }
    }),
    prisma.plotOpportunity.count({
      where: {
        organizationId: baseline.organizationId,
        bidStatus: "CONTACTED"
      }
    }),
    prisma.plotOpportunity.count({
      where: {
        organizationId: baseline.organizationId,
        bidStatus: { in: ["WON", "LOST", "NOT_A_FIT"] }
      }
    })
  ]);

  const activeDefinitions = officialSourceDefinitions.filter((source) => source.active);
  const activeSources = sources.filter((source) => source.active);
  const staleSources = activeSources.filter((source) => {
    const latestHealth = source.healthChecks[0];
    if (!latestHealth) {
      return true;
    }

    return Date.now() - latestHealth.checkedAt.getTime() > 1000 * 60 * 60 * 48;
  });
  const unhealthySources = activeSources.filter((source) => {
    const latestHealth = source.healthChecks[0];
    return !latestHealth || latestHealth.status === "failed";
  });
  const missingSnapshots = opportunities.filter((opportunity) => !opportunity.contactSnapshot).length;
  const duplicateParcelCount = buildDuplicateCount(
    opportunities.map((opportunity) => opportunity.parcelNumber ?? "")
  );
  const duplicateAddressCount = buildDuplicateCount(
    opportunities.map((opportunity) =>
      [opportunity.address ?? "", opportunity.city ?? "", opportunity.county ?? ""].join("|").toLowerCase()
    )
  );

  const checks = [
    {
      name: "active_source_registry",
      status: activeDefinitions.length > 0 && activeSources.length > 0 ? "pass" : "fail",
      details: `${activeDefinitions.length} active source definition(s), ${activeSources.length} active DB source row(s).`
    },
    {
      name: "source_health",
      status: unhealthySources.length === 0 ? "pass" : "warn",
      details: `${unhealthySources.length} unhealthy active source(s), ${staleSources.length} stale active source(s).`
    },
    {
      name: "opportunity_snapshots",
      status: missingSnapshots === 0 ? "pass" : "warn",
      details: `${snapshotsCount} stored snapshot(s); ${missingSnapshots} opportunity record(s) missing a contact snapshot.`
    },
    {
      name: "workflow_lifecycle",
      status: opportunities.length > 0 ? "pass" : "warn",
      details: `${opportunities.length} opportunities total, ${contactedCount} contacted, ${closedCount} closed.`
    },
    {
      name: "review_queue",
      status: openReviewCount === 0 ? "pass" : "warn",
      details: `${openReviewCount} open review item(s), including ${weakIdentityReviews} weak-identity and ${missingContactReviews} missing-contact items.`
    },
    {
      name: "duplicate_risk",
      status: duplicateParcelCount === 0 && duplicateAddressCount === 0 ? "pass" : "warn",
      details: `${duplicateParcelCount} duplicate parcel key(s), ${duplicateAddressCount} duplicate address key(s).`
    }
  ] as const;

  return {
    ok: checks.every((check) => check.status !== "fail"),
    summary: {
      activeSourceDefinitions: activeDefinitions.length,
      activeSources: activeSources.length,
      staleSources: staleSources.length,
      unhealthySources: unhealthySources.length,
      opportunities: opportunities.length,
      contacted: contactedCount,
      closed: closedCount,
      contactSnapshots: snapshotsCount,
      missingSnapshots,
      openReviewItems: openReviewCount,
      duplicateParcelCount,
      duplicateAddressCount
    },
    checks
  };
}
