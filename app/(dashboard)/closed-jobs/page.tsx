import { PageHeader } from "@/components/layout/page-header";
import { ClosedJobsBoard } from "@/components/opportunities/closed-jobs-board";
import { plotOpportunities } from "@/lib/sample-data";

export default function ClosedJobsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Awarded / Declined"
        title="Jobs that are no longer in our court"
        description="Once a contacted lead is awarded or declined, it moves here automatically so the Contacted section stays focused on active follow-up."
      />
      <ClosedJobsBoard opportunities={plotOpportunities} />
    </div>
  );
}
