import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCedarRapidsAnchor, seededTerritories } from "@/lib/geo/territories";
import { BuilderRecord } from "@/types/domain";

export function MapPlaceholder({ builders }: { builders: BuilderRecord[] }) {
  const anchor = getCedarRapidsAnchor();

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <p className="eyebrow-label">Map system</p>
          <CardTitle className="mt-2">Corridor Opportunity Map</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.09),transparent_34%),linear-gradient(135deg,rgba(26,29,34,1)_0%,rgba(18,20,24,1)_100%)] p-8">
          <div className="max-w-md text-center">
            <p className="engraved-label">Leaflet/OpenStreetMap slot</p>
            <h3 className="mt-4 font-serif text-2xl tracking-[-0.04em] text-white">Cedar Rapids corridor anchor</h3>
            <p className="mt-3 text-sm text-white/56">
              Seeded map state is centered on {anchor.lat}, {anchor.lng} with cluster overlays for grouped builder activity.
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
            <p className="eyebrow-label">Saved territory views</p>
            <ul className="mt-3 space-y-2 text-sm text-white/58">
              {seededTerritories.map((territory) => (
                <li key={territory.id}>• {territory.name}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
            <p className="eyebrow-label">Builder activity on map</p>
            <ul className="mt-3 space-y-2 text-sm text-white/58">
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
