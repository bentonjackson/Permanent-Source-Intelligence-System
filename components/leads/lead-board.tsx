import { stageOrder } from "@/lib/auth/config";
import { BuilderRecord } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LeadBoard({ builders }: { builders: BuilderRecord[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {stageOrder.map((stage) => {
        const stageBuilders = builders.filter((builder) => builder.pipelineStage === stage);

        return (
          <Card key={stage} className="min-h-[280px]">
            <CardHeader>
              <CardTitle className="text-base">{stage}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stageBuilders.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-slate-50 p-4 text-sm text-slate-500">No grouped leads in this stage.</div>
              ) : (
                stageBuilders.map((builder) => (
                  <div key={builder.id} className="rounded-2xl border bg-slate-50 p-4">
                    <p className="font-medium text-slate-900">{builder.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {builder.activeProperties} active plots • {builder.assignedRep}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge tone="green">Score {builder.leadScore}</Badge>
                      <Badge tone="slate">{builder.counties.join(", ")}</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
