import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCedarRapidsAnchor, seededTerritories } from "@/lib/geo/territories";
import { BuilderRecord } from "@/types/domain";

export function MapPlaceholder({ builders }: { builders: BuilderRecord[] }) {
  const anchor = getCedarRapidsAnchor();

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Corridor Opportunity Map</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.12),transparent_35%),linear-gradient(135deg,#eff6ff_0%,#f8fafc_100%)] p-8">
          <div className="max-w-md text-center">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Leaflet/OpenStreetMap slot</p>
            <h3 className="mt-4 text-2xl font-semibold text-slate-900">Cedar Rapids corridor anchor</h3>
            <p className="mt-3 text-sm text-slate-600">
              Seeded map state is centered on {anchor.lat}, {anchor.lng} with cluster overlays for grouped builder activity.
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="text-sm font-medium">Saved territory views</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {seededTerritories.map((territory) => (
                <li key={territory.id}>• {territory.name}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <p className="text-sm font-medium">Builder activity on map</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {builders.map((builder) => (
                <li key={builder.id}>
                  {builder.name}: {builder.activeProperties} plots, score {builder.leadScore}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
