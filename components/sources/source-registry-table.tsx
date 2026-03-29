import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { SourceRecord } from "@/types/domain";

export function SourceRegistryTable({ sources }: { sources: SourceRecord[] }) {
  return (
    <div className="space-y-4">
      {sources.map((source) => (
        <Card key={source.id}>
          <CardHeader>
            <div>
              <CardTitle>{source.name}</CardTitle>
              <p className="mt-2 text-sm text-slate-600">
                {source.city}, {source.county} • {source.sourceType}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={source.syncStatus === "success" ? "green" : source.syncStatus === "warning" ? "amber" : "red"}>
                {source.syncStatus}
              </Badge>
              <Badge tone="red">Confidence {source.sourceConfidenceScore}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Parser" value={source.parserType} />
              <Info label="Frequency" value={source.syncFrequency} />
              <Info label="Last Success" value={formatDate(source.lastSuccessfulSync)} />
              <Info label="Freshness" value={`${source.sourceFreshnessScore}`} />
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">Recent sync logs</p>
              <div className="mt-3 space-y-3">
                {source.logs.map((log) => (
                  <div key={`${source.id}-${log.timestamp}`} className="rounded-2xl border bg-white p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{log.level}</p>
                    <p className="mt-1 text-sm text-slate-700">{log.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
