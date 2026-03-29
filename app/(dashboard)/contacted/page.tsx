import { PageHeader } from "@/components/layout/page-header";
import { ContactedLeadsBoard } from "@/components/opportunities/contacted-leads-board";
import { plotOpportunities } from "@/lib/sample-data";

export default function ContactedPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Contacted"
        title="All leads you have already reached out to"
        description="One compiled folder for parcel history, inquiry date, follow-up tracking, and notes after you make first contact."
      />
      <ContactedLeadsBoard opportunities={plotOpportunities} />
    </div>
  );
}
