import { MetricCard } from "@/components/dashboard/metric-card";
import { PageHeader } from "@/components/layout/page-header";
import { PlotQueue } from "@/components/opportunities/plot-queue";
import { SourceRegistryTable } from "@/components/sources/source-registry-table";
import { dashboardSnapshot } from "@/lib/sample-data";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plot Queue"
        title="Lots and parcels that look ready for an insulation or shelving bid"
        description="Start with empty plots, multifamily filings, commercial lots, and early permit signals. Work the builder or GC before competitors do."
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Open Opportunities" value={String(dashboardSnapshot.plotQueue.length)} detail="Lots or parcels with a likely new-build signal." />
        <MetricCard label="Need Builder Research" value={String(dashboardSnapshot.plotQueue.filter((item) => item.bidStatus === "researching_builder").length)} detail="Opportunities where the builder is not ready for outreach yet." />
        <MetricCard label="Ready to Bid" value={String(dashboardSnapshot.plotQueue.filter((item) => item.bidStatus === "ready_to_contact" || item.bidStatus === "bid_requested").length)} detail="The best lots to call on right now." />
        <MetricCard label="Multifamily + Commercial" value={String(dashboardSnapshot.plotQueue.filter((item) => item.projectSegment !== "single_family").length)} detail="Additional project types now tracked in the same queue." />
      </section>
      <PlotQueue opportunities={dashboardSnapshot.plotQueue} />
      <SourceRegistryTable sources={dashboardSnapshot.syncHealth.slice(0, 1)} />
    </div>
  );
}
