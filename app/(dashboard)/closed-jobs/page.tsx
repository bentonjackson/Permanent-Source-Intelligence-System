import { PageHeader } from "@/components/layout/page-header";
import { ClosedJobsBoard } from "@/components/opportunities/closed-jobs-board";
import { COUNTIES_NEAR_ME_LABEL } from "@/lib/geo/territories";
import { getOpportunityData } from "@/lib/opportunities/live-data";

export default async function ClosedJobsPage({
  searchParams
}: {
  searchParams?: { county?: string };
}) {
  const selectedCounty = searchParams?.county ?? COUNTIES_NEAR_ME_LABEL;
  const data = await getOpportunityData({
    county: searchParams?.county ?? null
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Closed"
        title="Won and lost jobs that are no longer in our court"
        description="Once a contacted lead is awarded or declined, it moves here automatically so Contacted stays focused on active follow-up."
      />
      <ClosedJobsBoard opportunities={data.opportunities} counties={data.counties} selectedCounty={selectedCounty} />
    </div>
  );
}
