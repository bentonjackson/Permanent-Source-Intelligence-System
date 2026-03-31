import { BuilderList } from "@/components/builders/builder-list";
import { PageHeader } from "@/components/layout/page-header";
import { getBuilderRecords } from "@/lib/opportunities/live-data";

export default async function BuildersPage() {
  const builders = await getBuilderRecords();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Contractor Intelligence"
        title="Builder and contractor activity across the corridor"
        description="Use this view to spot the most active companies, see where they are building, and decide who deserves outreach first."
      />
      <BuilderList builders={builders} />
    </div>
  );
}
