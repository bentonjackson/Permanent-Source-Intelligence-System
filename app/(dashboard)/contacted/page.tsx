import { getRepOptions } from "@/lib/app/defaults";
import { PageHeader } from "@/components/layout/page-header";
import { ContactedLeadsBoard } from "@/components/opportunities/contacted-leads-board";
import { COUNTIES_NEAR_ME_LABEL } from "@/lib/geo/territories";
import { getOpportunityData } from "@/lib/opportunities/live-data";

export default async function ContactedPage({
  searchParams
}: {
  searchParams?: { county?: string };
}) {
  const selectedCounty = searchParams?.county ?? COUNTIES_NEAR_ME_LABEL;
  const [data, reps] = await Promise.all([
    getOpportunityData({
      county: searchParams?.county ?? null,
      status: "contacted"
    }),
    getRepOptions()
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Contacted"
        title="Active follow-ups after first builder contact"
        description="Track the parcel, last contact date, next follow-up, and notes until the bid is won or lost."
      />
      <ContactedLeadsBoard
        opportunities={data.opportunities}
        counties={data.counties}
        selectedCounty={selectedCounty}
        reps={reps}
      />
    </div>
  );
}
