import { PageHeader } from "@/components/layout/page-header";
import { PlotQueue } from "@/components/opportunities/plot-queue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRepOptions } from "@/lib/app/defaults";
import { getBuilderEntityPresentation, getOpportunityEntityPresentation } from "@/lib/entities/contact-identity";
import { COUNTIES_NEAR_ME_LABEL } from "@/lib/geo/territories";
import { SourceRegistryTable } from "@/components/sources/source-registry-table";
import { getBuilderRecords, getOpportunityData, getSourceRecords } from "@/lib/opportunities/live-data";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: {
    county?: string;
    city?: string;
    jurisdiction?: string;
    territory?: string;
  };
}) {
  const selectedCounty = searchParams?.county ?? COUNTIES_NEAR_ME_LABEL;
  const selectedCity = searchParams?.city ?? "All cities";
  const selectedJurisdiction = searchParams?.jurisdiction ?? "All jurisdictions";
  const selectedTerritory = searchParams?.territory ?? "All territories";
  const [data, sources, builders, reps] = await Promise.all([
    getOpportunityData({
      county: searchParams?.county ?? null,
      city: searchParams?.city ?? null,
      jurisdiction: searchParams?.jurisdiction ?? null,
      territory: searchParams?.territory ?? null
    }),
    getSourceRecords(),
    getBuilderRecords(),
    getRepOptions()
  ]);
  const plotQueue = data.opportunities.filter(
    (item) => !["contacted", "won", "lost", "not_a_fit"].includes(item.bidStatus)
  );
  const followUpsDue = data.opportunities.filter((item) => item.bidStatus === "contacted" && item.suggestedFollowUpDate);
  const mostActiveCounties = [...new Map(
    plotQueue.map((opportunity) => [
      opportunity.county,
      plotQueue.filter((item) => item.county === opportunity.county).length
    ])
  ).entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="BuildSignal"
        title="Catch the build before the bid list fills up"
        description="Work the Plot Queue every morning to find early lots, verify the right builder contact, and move fast on insulation and shelving bids across Eastern Iowa."
      />
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Top opportunities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {plotQueue.slice(0, 5).map((opportunity) => (
              <div key={opportunity.id} className="rounded-2xl border bg-slate-50 p-4">
                {(() => {
                  const entity = getOpportunityEntityPresentation(opportunity);

                  return (
                    <>
                      <p className="font-medium text-slate-900">{opportunity.address || opportunity.parcelNumber || "Parcel lead"}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {entity.displayName} • {opportunity.county}
                      </p>
                      {entity.relatedEntityName ? <p className="mt-1 text-sm text-slate-500">Related Entity: {entity.relatedEntityName}</p> : null}
                      <p className="mt-2 text-sm text-slate-700">{opportunity.nextAction}</p>
                    </>
                  );
                })()}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Hottest builders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {builders.slice(0, 5).map((builder) => (
              <div key={builder.id} className="rounded-2xl border bg-slate-50 p-4">
                <p className="font-medium text-slate-900">{getBuilderEntityPresentation(builder).displayName}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {builder.openOpportunities} open properties • {builder.counties.join(", ")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Most active counties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mostActiveCounties.map(([county, count]) => (
              <div key={county} className="rounded-2xl border bg-slate-50 p-4">
                <p className="font-medium text-slate-900">{county}</p>
                <p className="mt-1 text-sm text-slate-600">{count} open opportunity records</p>
              </div>
            ))}
            {followUpsDue.length ? (
              <div className="rounded-2xl border bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Next follow-up due</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {getOpportunityEntityPresentation(followUpsDue[0]).displayName}
                </p>
                <p className="mt-1 text-sm text-slate-600">{formatDate(followUpsDue[0].suggestedFollowUpDate)}</p>
              </div>
            ) : null}
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
        reps={reps}
      />
      <SourceRegistryTable sources={sources.filter((source) => source.active)} />
    </div>
  );
}
