import { PageHeader } from "@/components/layout/page-header";
import { SourceRegistryTable } from "@/components/sources/source-registry-table";
import { sources } from "@/lib/sample-data";

export default function SourcesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Source Registry"
        title="Admin-managed connector and import registry"
        description="Control public permit sources, manual import fallbacks, sync health, parser types, and job logs from one place."
      />
      <SourceRegistryTable sources={sources} />
    </div>
  );
}
