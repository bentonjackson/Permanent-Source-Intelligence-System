import { BuilderList } from "@/components/builders/builder-list";
import { PageHeader } from "@/components/layout/page-header";
import { builders } from "@/lib/sample-data";

export default function BuildersPage() {
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
