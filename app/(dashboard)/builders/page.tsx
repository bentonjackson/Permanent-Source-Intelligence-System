import { BuilderList } from "@/components/builders/builder-list";
import { PageHeader } from "@/components/layout/page-header";
import { getBuilderRecords } from "@/lib/opportunities/live-data";

export default async function BuildersPage() {
  const builders = await getBuilderRecords();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Builder View"
        title="Builders with active lots and early build signals"
        description="Use this after the plot queue when you want to see all open lots tied to the same builder."
      />
      <BuilderList builders={builders} />
    </div>
  );
}
