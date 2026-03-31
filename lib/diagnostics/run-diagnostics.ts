import { ensureBaselineMetadata } from "@/lib/app/defaults";
import { prisma } from "@/lib/db/client";
import { getOpportunityData, getSourceRecords } from "@/lib/opportunities/live-data";
import { officialSourceDefinitions } from "@/lib/sources/official-sources";
import { summarizeTransformationConsistency } from "@/lib/validation/live-data-validation";

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
    opportunityData,
    sourceRecords,
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
    getOpportunityData(),
    getSourceRecords(),
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
  const liveActiveSources = sourceRecords.filter((source) => source.active && source.dataOrigin === "live");
  const mockActiveSources = sourceRecords.filter((source) => source.active && source.dataOrigin === "mock");
  const staleLiveSources = sourceRecords.filter((source) => source.active && source.freshnessState === "stale");
  const agingLiveSources = sourceRecords.filter((source) => source.active && source.freshnessState === "aging");
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
  const inactiveRegisteredSources = sources.filter((source) => !source.active).length;
  const missingSnapshots = opportunities.filter((opportunity) => !opportunity.contactSnapshot).length;
  const duplicateParcelCount = buildDuplicateCount(
    opportunities.map((opportunity) => opportunity.parcelNumber ?? "")
  );
  const duplicateAddressCount = buildDuplicateCount(
    opportunities.map((opportunity) =>
      [opportunity.address ?? "", opportunity.city ?? "", opportunity.county ?? ""].join("|").toLowerCase()
    )
  );
  const highPriorityCount = opportunities.filter((opportunity) => opportunity.opportunityScore >= 80).length;
  const unresolvedContacts = opportunities.filter((opportunity) => !opportunity.contactSnapshot?.primaryPhone && !opportunity.contactSnapshot?.primaryEmail).length;
  const highValueContactGaps = opportunities.filter(
    (opportunity) =>
      opportunity.opportunityScore >= 70 &&
      !opportunity.contactSnapshot?.primaryPhone &&
      !opportunity.contactSnapshot?.primaryEmail
  ).length;
  const staleContacted = opportunities.filter((opportunity) => {
    if (opportunity.bidStatus !== "CONTACTED") {
      return false;
    }

    const anchor =
      opportunity.lastContactedAt ??
      opportunity.contactedAt ??
      opportunity.inquiredAt ??
      opportunity.updatedAt;

    return Date.now() - anchor.getTime() > 1000 * 60 * 60 * 24 * 7;
  }).length;
  const missingFollowUp = opportunities.filter(
    (opportunity) =>
      opportunity.bidStatus === "CONTACTED" &&
      (opportunity.followUpNeeded || opportunity.needsFollowUp) &&
      !opportunity.nextFollowUpAt &&
      !opportunity.nextFollowUpDate
  ).length;
  const driftedSources = sourceRecords.filter((source) => (source.warningFlags?.length ?? 0) > 0).length;
  const transformation = summarizeTransformationConsistency(opportunityData.opportunities);

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
      name: "freshness_watchdog",
      status: staleLiveSources.length === 0 ? "pass" : "warn",
      details: `${staleLiveSources.length} stale live source(s), ${agingLiveSources.length} aging live source(s).`
    },
    {
      name: "live_source_origin",
      status: mockActiveSources.length === 0 ? "pass" : "warn",
      details: `${liveActiveSources.length} active live source(s), ${mockActiveSources.length} active mock source(s).`
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
    },
    {
      name: "lead_intelligence_quality",
      status: highPriorityCount > 0 && highValueContactGaps === 0 ? "pass" : "warn",
      details: `${highPriorityCount} opportunity record(s) are currently high priority; ${unresolvedContacts} still lack a primary phone/email snapshot, including ${highValueContactGaps} high-value contact gap(s).`
    },
    {
      name: "source_drift",
      status: driftedSources === 0 ? "pass" : "warn",
      details: `${driftedSources} source(s) currently show drift or degraded-output warning flags.`
    },
    {
      name: "stale_work_queue",
      status: staleContacted === 0 && missingFollowUp === 0 ? "pass" : "warn",
      details: `${staleContacted} contacted lead(s) are stale and ${missingFollowUp} contacted lead(s) are missing a next follow-up date.`
    },
    {
      name: "inactive_registered_sources",
      status: inactiveRegisteredSources === 0 ? "pass" : "warn",
      details: `${inactiveRegisteredSources} registered source(s) are currently inactive.`
    },
    {
      name: "transformation_consistency",
      status: transformation.mismatchCount === 0 ? "pass" : "warn",
      details: `${transformation.mismatchCount} of ${transformation.sampledCount} sampled opportunity records did not match recomputed intelligence fields.`
    }
  ] as const;

  return {
    ok: checks.every((check) => check.status !== "fail"),
    summary: {
      activeSourceDefinitions: activeDefinitions.length,
      activeSources: activeSources.length,
      liveActiveSources: liveActiveSources.length,
      mockActiveSources: mockActiveSources.length,
      staleSources: staleSources.length,
      staleLiveSources: staleLiveSources.length,
      agingLiveSources: agingLiveSources.length,
      unhealthySources: unhealthySources.length,
      opportunities: opportunities.length,
      contacted: contactedCount,
      closed: closedCount,
      highPriorityCount,
      highValueContactGaps,
      transformationMismatchCount: transformation.mismatchCount,
      contactSnapshots: snapshotsCount,
      missingSnapshots,
      unresolvedContacts,
      staleContacted,
      missingFollowUp,
      openReviewItems: openReviewCount,
      duplicateParcelCount,
      duplicateAddressCount,
      driftedSources,
      inactiveRegisteredSources
    },
    checks
  };
}
