import { PageHeader } from "@/components/layout/page-header";
import { PlotQueue } from "@/components/opportunities/plot-queue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRepOptions } from "@/lib/app/defaults";
import { getOpportunityEntityPresentation } from "@/lib/entities/contact-identity";
import { COUNTIES_NEAR_ME_LABEL } from "@/lib/geo/territories";
import { SourceRegistryTable } from "@/components/sources/source-registry-table";
import { getDashboardSnapshot, getOpportunityData, getSourceRecords } from "@/lib/opportunities/live-data";

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: {
    county?: string;
    city?: string;
    jurisdiction?: string;
    territory?: string;
    search?: string;
    jobFit?: string;
    recency?: string;
    minScore?: string;
    hasContactInfo?: string;
  };
}) {
  const selectedCounty = searchParams?.county ?? COUNTIES_NEAR_ME_LABEL;
  const selectedCity = searchParams?.city ?? "All cities";
  const selectedJurisdiction = searchParams?.jurisdiction ?? "All jurisdictions";
  const selectedTerritory = searchParams?.territory ?? "All territories";
  const [data, snapshot, sources, reps] = await Promise.all([
    getOpportunityData({
      county: searchParams?.county ?? null,
      city: searchParams?.city ?? null,
      jurisdiction: searchParams?.jurisdiction ?? null,
      territory: searchParams?.territory ?? null,
      search: searchParams?.search ?? null,
      jobFit: (searchParams?.jobFit as "all" | "insulation" | "shelving" | "both" | "low" | undefined) ?? "all",
      recency: (searchParams?.recency as "all" | "0_7_days" | "8_30_days" | "31_90_days" | "older" | undefined) ?? "all",
      minScore: searchParams?.minScore ? Number(searchParams.minScore) : null,
      hasContactInfo: searchParams?.hasContactInfo === "true" ? true : null
    }),
    getDashboardSnapshot(),
    getSourceRecords(),
    getRepOptions()
  ]);
  const plotQueue = data.opportunities.filter(
    (item) => !["contacted", "won", "lost", "not_a_fit"].includes(item.bidStatus)
  );
  const keyInsights = snapshot.insights.filter((insight) =>
    ["new-permits", "high-priority", "missing-contact", "unreviewed"].includes(insight.id)
  );
  const primaryViews = snapshot.savedViews.slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="BuildSignal"
        title="Catch the build before the bid list fills up"
        description="Work the Plot Queue every morning to find early lots, verify the right builder contact, and move fast on insulation and shelving bids across Eastern Iowa."
      />
      <section className="grid gap-4 xl:grid-cols-4">
        {keyInsights.map((insight) => (
          <a key={insight.id} href={insight.href}>
            <Card className="h-full">
              <CardHeader>
                <p className="eyebrow-label">{insight.label}</p>
                <CardTitle className="mt-2 text-[1.8rem]">{insight.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white/62">{insight.detail}</p>
              </CardContent>
            </Card>
          </a>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <div>
              <p className="eyebrow-label">What Needs Action</p>
              <CardTitle className="mt-2">Priority queue</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {plotQueue.slice(0, 3).map((opportunity) => (
              <div key={opportunity.id} className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
                {(() => {
                  const entity = getOpportunityEntityPresentation(opportunity);

                  return (
                    <>
                      <p className="font-serif text-lg tracking-[-0.03em] text-white">{entity.displayName}</p>
                      <p className="mt-2 text-sm text-white/84">{opportunity.address || opportunity.parcelNumber || "Parcel lead"}</p>
                      <p className="mt-1 text-sm text-white/54">
                        {opportunity.jobFit.replaceAll("_", " ")} • {opportunity.county}
                      </p>
                      {entity.relatedEntityName ? <p className="mt-1 text-sm text-white/42">Related entity: {entity.relatedEntityName}</p> : null}
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-red-200">{opportunity.nextAction}</p>
                    </>
                  );
                })()}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <p className="eyebrow-label">Saved Views</p>
              <CardTitle className="mt-2">Go straight to work</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {primaryViews.map((view) => (
              <a
                key={view.id}
                href={view.href}
                className="block rounded-[16px] border border-red-900/85 bg-red-900 p-4 text-white shadow-[0_14px_28px_-18px_rgba(127,29,29,0.82)] transition-colors duration-200 hover:border-red-800 hover:bg-red-800"
              >
                <p className="font-serif text-lg tracking-[-0.03em] text-white">{view.label}</p>
                <p className="mt-2 text-sm text-white/82">{view.description}</p>
              </a>
            ))}
          </CardContent>
        </Card>
      </section>
      <PlotQueue
        opportunities={data.opportunities}
        counties={data.counties}
        cities={data.cities}
        jurisdictions={data.jurisdictions}
        territories={data.territories}
        selectedCounty={selectedCounty}
        selectedCity={selectedCity}
        selectedJurisdiction={selectedJurisdiction}
        selectedTerritory={selectedTerritory}
        initialSearch={searchParams?.search ?? ""}
        initialJobFit={(searchParams?.jobFit as "all" | "insulation" | "shelving" | "both" | "low" | undefined) ?? "all"}
        initialRecency={(searchParams?.recency as "all" | "0_7_days" | "8_30_days" | "31_90_days" | "older" | undefined) ?? "all"}
        initialMinScore={(searchParams?.minScore as "0" | "60" | "80" | undefined) ?? "0"}
        initialHasContactOnly={searchParams?.hasContactInfo === "true"}
        reps={reps}
      />
      <SourceRegistryTable sources={sources.filter((source) => source.active)} />
    </div>
  );
}
