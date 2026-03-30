import { ManualImportPanel } from "@/components/sources/manual-import-panel";
import { SourceOperationsPanel } from "@/components/sources/source-operations-panel";
import { PageHeader } from "@/components/layout/page-header";
import { ReviewQueuePanel } from "@/components/sources/review-queue-panel";
import { SourceRegistryTable } from "@/components/sources/source-registry-table";
import { getOpenReviewQueueItems, getSourceRecords } from "@/lib/opportunities/live-data";

export default async function SourcesPage() {
  const [sources, reviewItems] = await Promise.all([
    getSourceRecords(),
    getOpenReviewQueueItems()
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Source Registry"
        title="Admin-managed connector and import registry"
        description="Database-backed official-source coverage across the Cedar Rapids corridor, plus manual import fallback and sync controls."
      />
      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <SourceOperationsPanel />
        <ManualImportPanel />
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SourceRegistryTable sources={sources} />
        <ReviewQueuePanel items={reviewItems} />
      </section>
    </div>
  );
}
